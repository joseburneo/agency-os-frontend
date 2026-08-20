"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, Mail, MessageCircle, RefreshCw } from "lucide-react";
import { Linkedin, SectionLabel } from "@/components/portal/ui";

// Connect your own LinkedIn, mailbox and WhatsApp.
//
// The point of this panel is not configuration, it is the difference between a CRM
// that knows about you and one that does not. Paul Herrick made ~200 LinkedIn
// invitations from our lists and about half were accepted; none of those people, and
// none of those conversations, exist in his CRM, because nothing is connected. The
// moment LinkedIn is connected they arrive.
//
// The password is never typed here and never reaches us. "Connect" opens the
// provider's own hosted login, which also handles 2FA and LinkedIn's checkpoints —
// and which works even when you do not know your password, because your browser
// still does. That was Paul's actual situation on the 2026-08-20 call.

type Account = {
  account_id: string;
  channel: string;
  label: string;
  enabled: boolean;
  connected_at?: string;
  status: string;
};

type Info = { accounts: Account[]; configured: boolean };

const CHANNELS = [
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    blurb: "Your connections, your invitations and your conversations, in the CRM.",
  },
  {
    key: "email",
    label: "Email",
    icon: Mail,
    blurb: "One-to-one replies stay on the same thread as everything else.",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    blurb: "The channel most deals actually close on.",
  },
] as const;

export function ChannelConnect({ slug }: { slug: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    fetch(`/api/crm/channels?workspace=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setInfo(j ? { accounts: j.accounts ?? [], configured: !!j.configured } : null))
      .catch(() => setInfo(null));
  }, [slug]);

  useEffect(load, [load]);

  // The connect window is a round trip through the provider, so when the tab comes
  // back into focus the answer may have changed. Without this the person returns to
  // a panel still showing "Not connected" and reasonably concludes it failed.
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const connect = async (provider: string) => {
    setBusy(provider);
    setErr("");
    try {
      const r = await fetch(`/api/crm/channels/link?workspace=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) {
        setErr(j.detail || j.error || "Could not start the connection. Try again in a moment.");
        return;
      }
      // Same tab, not a popup: blockers eat popups, and the provider redirects back
      // to this page when it is done.
      window.location.href = j.url;
    } catch {
      setErr("Could not reach the server. Try again in a moment.");
    } finally {
      setBusy("");
    }
  };

  const disconnect = async (accountId: string) => {
    setBusy(accountId);
    try {
      await fetch(`/api/crm/channels/disconnect?workspace=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      load();
    } finally {
      setBusy("");
    }
  };

  const forChannel = (key: string) =>
    (info?.accounts ?? []).filter((a) => a.channel === key && a.enabled);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Your accounts</SectionLabel>
        <button
          type="button"
          onClick={load}
          title="Check again"
          className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground transition-colors hover:text-gold-ink"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Connect the accounts you already work from. Your conversations and connections
        come into this workspace, and the copilot writes with them as context. You type
        your password on {"LinkedIn's"} own login page, never here, and we never see or
        store it.
      </p>

      {info && !info.configured && (
        <div className="rounded-lg border border-gold/25 bg-gold/[0.06] px-3.5 py-2.5 text-[12px] text-foreground">
          Connecting accounts is not switched on yet. We are on it.
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-danger-soft/30 bg-danger-soft/[0.06] px-3.5 py-2.5 text-[12px] text-danger-soft">
          {err}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {CHANNELS.map(({ key, label, icon: Icon, blurb }) => {
          const live = forChannel(key);
          const on = live.length > 0;
          return (
            <div
              key={key}
              className="flex items-start gap-3 rounded-lg border border-border bg-card px-3.5 py-3"
            >
              <Icon
                width={16}
                height={16}
                className={`mt-0.5 h-4 w-4 shrink-0 ${on ? "text-signal-ink" : "text-subtle opacity-50"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-foreground">{label}</span>
                  {on ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-signal-ink">
                      <Check className="h-3 w-3" /> Connected
                    </span>
                  ) : (
                    <span className="text-[11px] text-subtle">Not connected</span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{blurb}</p>

                {live.map((a) => (
                  <div
                    key={a.account_id}
                    className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground"
                  >
                    <span className="truncate">{a.label || a.account_id}</span>
                    {/* A LinkedIn session dies on its own every few weeks. Saying so here
                        is the difference between "reconnect me" and "your product is broken". */}
                    {a.status && a.status !== "OK" && (
                      <span className="text-gold-ink">needs reconnecting</span>
                    )}
                    <button
                      type="button"
                      onClick={() => disconnect(a.account_id)}
                      disabled={busy === a.account_id}
                      className="ml-auto shrink-0 text-[11px] text-subtle transition-colors hover:text-danger-soft disabled:opacity-40"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => connect(key)}
                disabled={busy === key || (info ? !info.configured : true)}
                className={`shrink-0 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-colors disabled:opacity-40 ${
                  on
                    ? "border border-border text-muted-foreground hover:text-gold-ink hover:border-gold/40"
                    : "bg-gold text-ink-inverse hover:bg-gold-hi"
                }`}
              >
                {busy === key ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                {on ? "Reconnect" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-subtle">
        LinkedIn signs you out every few weeks on its own, so expect to reconnect about
        once a month. We keep invitations under 100 a week on purpose, which is half of
        {" "}
        {"LinkedIn's"} own ceiling.
      </p>
    </div>
  );
}
