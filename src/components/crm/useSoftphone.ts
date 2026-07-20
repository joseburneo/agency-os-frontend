"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Call, Device } from "@twilio/voice-sdk";

// The CRM's phone. Two ways to place the same call:
//
//   browser  A WebRTC leg from this tab, via the Twilio Voice SDK. Default: no
//            carrier involved, instant, and the audio stays in the browser.
//   dialout  The server rings YOUR mobile first and bridges the prospect when you
//            pick up. Slower and bills two legs, but it is a plain phone call on
//            your side, which is what survives networks that block VoIP (the UAE
//            mobile networks do). Use it when browser audio fails or is one-way.
//
// The SDK is imported lazily so its ~200KB never lands in the first paint of a
// board that mostly gets used for email.

export type CallState = "idle" | "connecting" | "ringing" | "live" | "ended" | "error";
export type CallMode = "browser" | "dialout";

type TokenResp = { token: string; identity: string; caller_id: string; recording?: boolean };

export function useSoftphone() {
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [callerId, setCallerId] = useState("");
  const [recording, setRecording] = useState(false);
  const [callSid, setCallSid] = useState<string | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTick = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  // Tear the device down on unmount: a live Device keeps a websocket open and,
  // worse, an un-hung-up call keeps billing after the operator closes the tab.
  useEffect(() => () => {
    stopTick();
    try { callRef.current?.disconnect(); } catch { /* already gone */ }
    try { deviceRef.current?.destroy(); } catch { /* already gone */ }
  }, []);

  const ensureDevice = useCallback(async (): Promise<Device> => {
    if (deviceRef.current) return deviceRef.current;

    const res = await fetch("/api/voice/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: "jose" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || j.detail || `token failed (${res.status})`);
    }
    const j: TokenResp = await res.json();
    setCallerId(j.caller_id || "");
    setRecording(!!j.recording);

    const { Device } = await import("@twilio/voice-sdk");
    const device = new Device(j.token, {
      // Dublin first: we mostly call Ireland, the UK and the EU, and routing the
      // media through Ashburn would add a transatlantic hop to every call.
      edge: ["dublin", "ashburn"],
      closeProtection: true,   // browser warns before closing a tab mid-call
    });
    device.on("error", (e: { message?: string }) => {
      setError(e?.message || "device error");
      setState("error");
    });
    deviceRef.current = device;
    return device;
  }, []);

  const hangup = useCallback(() => {
    stopTick();
    try { callRef.current?.disconnect(); } catch { /* already gone */ }
    callRef.current = null;
    setState((s) => (s === "idle" ? "idle" : "ended"));
  }, []);

  const call = useCallback(
    async (to: string, prospectId: number, mode: CallMode = "browser") => {
      setError(null);
      setSeconds(0);
      setCallSid(null);
      setMuted(false);

      const dest = (to || "").replace(/[^\d+]/g, "");
      if (!dest.startsWith("+")) {
        setError("The number must be in international format, starting with +.");
        setState("error");
        return;
      }

      if (mode === "dialout") {
        setState("connecting");
        try {
          const res = await fetch("/api/voice/dialout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: dest, prospect_id: prospectId }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || j.detail || `dial-out failed (${res.status})`);
          setCallSid(j.call_sid || null);
          // Nothing to stream here: the call lives on the two phones, not this tab.
          setState("ringing");
        } catch (e) {
          setError(e instanceof Error ? e.message : "dial-out failed");
          setState("error");
        }
        return;
      }

      setState("connecting");
      try {
        const device = await ensureDevice();
        const c = await device.connect({
          params: { To: dest, prospect_id: String(prospectId) },
        });
        callRef.current = c;
        setState("ringing");

        c.on("accept", () => {
          setState("live");
          setCallSid(c.parameters?.CallSid || null);
          stopTick();
          tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        });
        const end = () => {
          stopTick();
          callRef.current = null;
          setState("ended");
        };
        c.on("disconnect", end);
        c.on("cancel", end);
        c.on("reject", end);
        c.on("error", (e: { message?: string }) => {
          stopTick();
          setError(e?.message || "call error");
          setState("error");
        });
      } catch (e) {
        // The usual cause is a blocked microphone: the browser needs permission
        // before it will open the audio track, and it only asks on user action.
        const msg = e instanceof Error ? e.message : "could not start the call";
        setError(/permission|NotAllowed/i.test(msg)
          ? "The browser blocked the microphone. Allow it for this site and try again."
          : msg);
        setState("error");
      }
    },
    [ensureDevice],
  );

  const toggleMute = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    const next = !muted;
    c.mute(next);
    setMuted(next);
  }, [muted]);

  const reset = useCallback(() => { setState("idle"); setError(null); setSeconds(0); }, []);

  // Log what actually happened, which Twilio cannot know: voicemail, gatekeeper,
  // wrong number. Fire-and-forget; a failed log must never block the next call.
  const logOutcome = useCallback((outcome: string, notes?: string) => {
    if (!callSid) return;
    fetch("/api/voice/outcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call_sid: callSid, outcome, notes }),
    }).catch(() => {});
  }, [callSid]);

  return { state, error, muted, seconds, callerId, recording, callSid,
           call, hangup, toggleMute, reset, logOutcome };
}

export function fmtDuration(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
