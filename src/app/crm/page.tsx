"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  X, Link2, MessageCircle, Phone, ExternalLink, Copy, Check,
  Search, RefreshCw, CalendarClock, Sparkles, Send, PenLine, Loader2,
  Flame, LayoutGrid, List, Bot, ChevronRight, Zap,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "https://agency-os-api.onrender.com";

// ── types ───────────────────────────────────────────────────────────
type Card = {
  id: number;
  email: string;
  name: string;
  company: string;
  job_title: string;
  country: string;
  category: string;
  status: string;
  status_label: string;
  seq_step: number;
  stage_label: string;
  stage: string;
  stage_name: string;
  next_channel: string | null;
  next_touch_at: string | null;
  last_channel: string | null;
  last_touch_at: string | null;
  has_build: boolean;
  build_url: string;
  build_status: string | null;
  build_delivered: boolean;
  has_phone: boolean;
  has_linkedin: boolean;
  reply_snippet: string;
  last_reply_at: string | null;
  waiting_on: "us" | "them" | "closed";
  wants_meeting: boolean;
  heat: number;
  heat_reason: string;
};

type Funnel = {
  total: number;
  with_build: number;
  due_now: number;
  waiting_us: number;
  waiting_them: number;
  wants_meeting: number;
  hot_now: number;
  by_status: Record<string, { count: number; label: string }>;
  by_step: Record<string, { count: number; label: string }>;
};

type Detail = Card & {
  reply_text: string;
  reply_subject: string;
  phone: string;
  linkedin_url: string;
  wa_link: string;
  build_slug: string | null;
  build_name: string;
  build_audience: string;
  build_leads: number;
  build_published: boolean;
  live_channel: string;
  can_send_email: boolean;
  intent_label: string;
  intent_summary: string;
  reply_campaign: string;
  notes: string;
  next: {
    next_step: number | null;
    next_channel: string | null;
    next_goal: string | null;
    next_touch_at: string | null;
  };
};

type Summary = {
  counts: {
    total: number; waiting_us: number; waiting_them: number; wants_meeting: number;
    hot_now: number; meetings: number; with_build: number;
  };
  top: { id: number; name: string; company: string; heat: number; heat_reason: string; wants_meeting: boolean; last_reply_at: string | null }[];
  briefing: string;
};

// ── helpers ─────────────────────────────────────────────────────────
function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function isDue(s: string | null): boolean {
  if (!s) return false;
  return new Date(s).getTime() <= Date.now();
}

function timeAgo(s: string | null): string {
  if (!s) return "—";
  const t = new Date(s).getTime();
  if (isNaN(t)) return "—";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function daysSince(s: string | null): number {
  if (!s) return 0;
  const t = new Date(s).getTime();
  if (isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}

// Heat → a color+icon+label chip. Gold is the priority accent; red flags the truly
// hot. Never color alone (accessibility): always a label too.
function heatChip(heat: number): { label: string; cls: string; hot: boolean } {
  if (heat >= 70) return { label: "Hot", cls: "bg-[#ef4444]/15 text-[#ff9b9b] border border-[#ef4444]/30", hot: true };
  if (heat >= 45) return { label: "Warm", cls: "bg-[#FFD60A]/12 text-[#FFD60A] border border-[#FFD60A]/25", hot: false };
  return { label: "Cool", cls: "bg-secondary text-muted-foreground border border-border", hot: false };
}

// Category → a color-coded pill. Signal Green for Positive/SQL (a live buyer), gold for
// MQL, muted for the rest. Green = "go" per the brand's on-screen accent rule.
function catPill(category: string): { label: string; cls: string } {
  const c = (category || "").toLowerCase();
  if (c.includes("positive") || c.includes("sql"))
    return { label: category, cls: "bg-[#26D07C]/15 text-[#5fe08a] border border-[#26D07C]/30" };
  if (c.includes("mql"))
    return { label: category, cls: "bg-[#FFD60A]/12 text-[#FFD60A] border border-[#FFD60A]/25" };
  if (c.includes("neg") || c.includes("not") || c.includes("unsub"))
    return { label: category, cls: "bg-[#ef4444]/10 text-[#ff9b9b] border border-[#ef4444]/25" };
  return { label: category || "Reply", cls: "bg-secondary text-muted-foreground border border-border" };
}

// Deal-rot: the longer a reply we owe goes unanswered, the louder the left edge.
function rotEdge(card: Card): string {
  if (card.waiting_on !== "us") return "";
  const d = daysSince(card.last_reply_at);
  if (d >= 7) return "border-l-2 border-l-[#ef4444]";
  if (d >= 3) return "border-l-2 border-l-[#f59e0b]";
  if (d >= 1) return "border-l-2 border-l-[#FFD60A]";
  return "border-l-2 border-l-transparent";
}

// What to actually do with this prospect right now, in plain words. Replaces the raw
// cadence goal (which reads as noise when the ball is in our court).
function actNow(d: Detail): { title: string; detail: string; tone: "green" | "gold" | "muted" } {
  if (d.status === "meeting_booked") return { title: "Meeting booked", detail: "Out of the queue. Prep for the call.", tone: "green" };
  if (d.status === "stopped" || d.status === "exhausted") return { title: "Closed", detail: "No action needed.", tone: "muted" };
  if (d.waiting_on === "us") {
    // Real intent (gpt-5-mini read of their actual last message) beats the keyword.
    const s = d.intent_summary || "";
    switch (d.intent_label) {
      case "wants_meeting": return { title: "They want to meet", detail: s || "Reply with two time slots, or use Book to send the calendar link.", tone: "green" };
      case "meeting_already_set": return { title: "Meeting already set", detail: s || "A meeting looks arranged. Confirm and prep, or mark it booked.", tone: "green" };
      case "positive": return { title: "Positive reply", detail: s || "They are interested. Move toward a short call.", tone: "gold" };
      case "question": return { title: "They asked a question", detail: s || "Answer their question directly.", tone: "gold" };
      case "referral": return { title: "They pointed you elsewhere", detail: s || "They referred you to someone else. Ask for the intro.", tone: "gold" };
      case "not_interested":
      case "using_competitor": return { title: "Soft no", detail: s || "They are not looking right now. Keep it warm, do not push.", tone: "muted" };
      default:
        return { title: "They are waiting on your reply", detail: s || (d.heat_reason ? `Answer their last message. ${d.heat_reason}.` : "Answer their last message below."), tone: "gold" };
    }
  }
  if (d.next.next_channel && d.next.next_touch_at) {
    return { title: "Waiting on them", detail: `You replied last. Next nudge: ${d.next.next_channel}, ${isDue(d.next.next_touch_at) ? "due now" : fmtDate(d.next.next_touch_at)}.`, tone: "muted" };
  }
  return { title: "Waiting on them", detail: "You replied last. No follow-up scheduled.", tone: "muted" };
}

const CHANNEL_META: Record<string, { label: string; cls: string }> = {
  email: { label: "Email", cls: "text-[#7cb0ff]" },
  linkedin: { label: "LinkedIn", cls: "text-[#5fd0e0]" },
  whatsapp: { label: "WhatsApp", cls: "text-[#5fe08a]" },
  call: { label: "Call", cls: "text-[#f0b45f]" },
};

function initials(name: string): string {
  const p = (name || "?").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}

function linkedinSearchUrl(name: string, company: string): string {
  const q = [name, company].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
}

// ── tiny shared components ───────────────────────────────────────────
function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}>
      {text}
    </span>
  );
}

function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className="inline-flex items-center gap-1.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      title="Copy"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-[#5fe08a]" /> : <Copy className="w-3.5 h-3.5" />}
      {label && <span className="text-xs">{ok ? "Copied" : label}</span>}
    </button>
  );
}

function Tile({ label, value, accent, icon, onClick, active }: {
  label: string; value: number; accent?: boolean; icon?: ReactNode; onClick?: () => void; active?: boolean;
}) {
  const cls = `bg-card rounded-xl px-4 py-3 border text-left w-full transition-colors ${
    active ? "border-[#FFD60A] ring-1 ring-[#FFD60A]/40"
    : accent && value > 0 ? "border-[#FFD60A]/40" : "border-border"
  } ${onClick ? "hover:border-[#FFD60A]/60 cursor-pointer" : ""}`;
  const inner = (
    <>
      <div className="flex items-center gap-1.5">
        <div className={`text-2xl font-semibold tabular-nums ${accent && value > 0 ? "text-[#FFD60A]" : "text-foreground"}`}>{value}</div>
        {icon}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </>
  );
  return onClick ? <button onClick={onClick} className={cls}>{inner}</button> : <div className={cls}>{inner}</div>;
}

// ── landing briefing: where we stand ─────────────────────────────────
function Briefing({ onOpen }: { onOpen: (id: number) => void }) {
  const [s, setS] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/crm/summary`)
      .then((r) => r.json()).then(setS).catch(() => setS(null)).finally(() => setLoading(false));
  }, []);
  return (
    <div className="bg-gradient-to-br from-card to-card/40 border border-[#FFD60A]/20 rounded-2xl p-5 mb-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2">
        <Sparkles className="w-4 h-4 text-[#FFD60A]" />
        <span className="neon-hl">// WHERE_YOU_STAND</span>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Reading the pipeline…</div>
      ) : s ? (
        <>
          <p className="text-[15px] text-foreground leading-relaxed max-w-3xl">{s.briefing}</p>
          {s.top.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {s.top.map((t) => {
                const h = heatChip(t.heat);
                return (
                  <button key={t.id} onClick={() => onOpen(t.id)}
                    className="inline-flex items-center gap-2 rounded-full bg-background border border-border px-3 py-1.5 text-sm hover:border-[#FFD60A]/50 transition-colors">
                    {t.wants_meeting ? <span title="wants to meet">📅</span> : h.hot ? <Flame className="w-3.5 h-3.5 text-[#ff9b9b]" /> : null}
                    <span className="text-foreground font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(t.last_reply_at)}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-muted-foreground">Could not load the briefing.</div>
      )}
    </div>
  );
}

// ── conversation thread (live from Instantly) ────────────────────────
type ThreadMsg = { from_me: boolean; at: string | null; subject: string; text: string; from_addr: string; to_addr: string; eaccount: string };

// Distill the email chrome: strip Re:/Fwd: chains, collapse whitespace.
function cleanSubject(s: string): string {
  const t = (s || "").replace(/^((re|fwd|fw)\s*:\s*)+/i, "").replace(/\s+/g, " ").trim();
  return t || "(no subject)";
}
function addrDomain(a: string): string { return (a || "").split("@")[1] || ""; }
function shortAddr(a: string): string {
  a = a || "";
  return a.length <= 28 ? a : `${a.slice(0, 14)}…${a.slice(-11)}`;
}
// Direction-agnostic identity of a message: same two addresses = same route.
function routeKey(m: ThreadMsg): string { return [m.from_addr, m.to_addr].filter(Boolean).sort().join("|"); }

function Conversation({ id, themName, fallback }: { id: number; themName: string; fallback?: string }) {
  const [msgs, setMsgs] = useState<ThreadMsg[] | null>(null);
  const [burner, setBurner] = useState("");
  const [hidden, setHidden] = useState(0);
  const [subject, setSubject] = useState("");
  useEffect(() => {
    setMsgs(null);
    fetch(`${API}/api/crm/prospect/${id}/thread`)
      .then((r) => r.json())
      .then((j) => { setMsgs(j.messages || []); setBurner(j.burner || ""); setHidden(j.hidden || 0); setSubject(j.subject || ""); })
      .catch(() => setMsgs([]));
  }, [id]);

  if (msgs === null) return <div className="text-sm text-muted-foreground p-2">Loading conversation…</div>;
  if (msgs.length === 0) {
    return fallback
      ? <div className="bg-card border border-border rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap">{fallback}</div>
      : <div className="text-sm text-muted-foreground p-2">No email thread found in Instantly.</div>;
  }
  // Compute in chronological order (msgs oldest first):
  // route line shows only when the {from,to} pair changes (opener + any switch).
  const routeShow = msgs.map((m, i) => i === 0 || routeKey(m) !== routeKey(msgs[i - 1]));
  // graduation = our outbound from-domain moving off the burner onto luxvance.com.
  let gradIndex = -1, sawBurnerOut = false;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (!m.from_me || !m.from_addr) continue;
    if (addrDomain(m.from_addr) === "luxvance.com") { if (sawBurnerOut) { gradIndex = i; break; } }
    else sawBurnerOut = true;
  }
  const graduated = burner.endsWith("luxvance.com");
  // Newest on top: Jose sees the latest reply first, no scrolling.
  const ordered = [...msgs].reverse();
  return (
    <div className="space-y-3">
      {/* thread header: subject once + the current sending identity */}
      <div className="pb-2.5 mb-1 border-b border-border">
        <div className="text-[10px] uppercase tracking-[0.12em] text-[#FFD60A]/65 mb-0.5">// THREAD</div>
        <div className="text-[13px] font-semibold text-foreground truncate">{cleanSubject(subject)}</div>
        {burner && (
          <div className={`text-[11px] mt-0.5 ${graduated ? "text-[#FFD60A]/85" : "text-muted-foreground"}`}>
            via {burner}{hidden > 0 && <span className="text-muted-foreground/70"> · {hidden} hidden from other campaigns</span>}
          </div>
        )}
      </div>
      {ordered.map((m, i) => {
        const orig = msgs.length - 1 - i;
        const who = m.from_me ? "You" : themName;
        const latest = i === 0;
        const divider = gradIndex > 0 && orig === gradIndex - 1; // boundary, rendered above older half
        return (
          <div key={i}>
            {divider && (
              <div className="flex items-center gap-3 my-3 text-[10px] uppercase tracking-[0.12em] text-[#FFD60A]">
                <span className="flex-1 h-px bg-[#FFD60A]/35" />
                // MOVED TO DIRECT · jose@luxvance.com
                <span className="flex-1 h-px bg-[#FFD60A]/35" />
              </div>
            )}
            <div className={`flex gap-2.5 ${m.from_me ? "flex-row-reverse" : ""}`}>
              <div className={`shrink-0 w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold ${
                m.from_me ? "bg-[#FFD60A]/15 text-[#FFD60A]" : "bg-secondary text-muted-foreground"}`}>
                {m.from_me ? "JB" : initials(themName)}
              </div>
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm border ${
                m.from_me ? "bg-[#FFD60A]/8 border-[#FFD60A]/25"
                : latest ? "bg-card border-[#FFD60A]/40 ring-1 ring-[#FFD60A]/20" : "bg-card border-border"}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[11px] font-semibold ${m.from_me ? "text-[#FFD60A]" : "text-foreground"}`}>{who}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{timeAgo(m.at)}</span>
                  {latest && !m.from_me && <span className="text-[10px] text-[#FFD60A] font-medium">latest</span>}
                </div>
                {routeShow[orig] && (m.from_addr || m.to_addr) && (
                  <div className="text-[10.5px] text-muted-foreground/80 mb-1.5 truncate">
                    {shortAddr(m.from_addr)} <span className="text-[#FFD60A]">&gt;</span> {shortAddr(m.to_addr)}
                  </div>
                )}
                <div className="text-foreground whitespace-pre-wrap leading-relaxed">{m.text}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── reply composer: channel tabs + draft + send + copilot ────────────
type DraftResp = { channel: string; step: number; goal: string; draft: string; can_send: boolean; gmail_live: boolean };
type Chan = "email" | "linkedin" | "whatsapp" | "call";
type CoLog = { role: "you" | "copilot"; content: string };

function ReplyComposer({ d, onSent }: { d: Detail; onSent: () => void }) {
  const id = d.id;
  const [chan, setChan] = useState<Chan>("email");
  const [drafts, setDrafts] = useState<Record<Chan, string>>({ email: "", linkedin: "", whatsapp: "", call: "" });
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [co, setCo] = useState("");
  const [coBusy, setCoBusy] = useState(false);
  const [coLog, setCoLog] = useState<CoLog[]>([]);

  const setDraft = (c: Chan, v: string) => setDrafts((p) => ({ ...p, [c]: v }));
  const text = drafts[chan];

  const gen = (intent?: "book") => {
    setDrafting(true); setSent(null);
    const q = intent ? `?channel=${chan}&intent=${intent}` : `?channel=${chan}`;
    fetch(`${API}/api/crm/prospect/${id}/draft${q}`)
      .then((r) => r.json())
      .then((j: DraftResp) => { setDraft(chan, j.draft || ""); })
      .catch(() => {})
      .finally(() => setDrafting(false));
  };

  const send = () => {
    setSending(true);
    fetch(`${API}/api/crm/prospect/${id}/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, channel: "email" }),
    })
      .then(async (r) => {
        if (r.ok) { setSent("ok"); onSent(); }
        else { const e = await r.json().catch(() => ({})); setSent("err:" + (e.detail || r.status)); }
      })
      .catch((e) => setSent("err:" + e))
      .finally(() => setSending(false));
  };

  const askCopilot = () => {
    if (!co.trim()) return;
    const instruction = co.trim();
    setCoBusy(true); setCoLog((l) => [...l, { role: "you", content: instruction }]); setCo("");
    fetch(`${API}/api/crm/prospect/${id}/copilot`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: instruction, draft: drafts[chan], target: chan, history: coLog.map((x) => ({ role: x.role === "you" ? "user" : "assistant", content: x.content })) }),
    })
      .then((r) => r.json())
      .then((j) => { if (j.draft) setDraft(chan, j.draft); setCoLog((l) => [...l, { role: "copilot", content: j.reply || "Updated the draft." }]); })
      .catch(() => setCoLog((l) => [...l, { role: "copilot", content: "Copilot failed. Try again." }]))
      .finally(() => setCoBusy(false));
  };

  const canSendEmail = chan === "email" && d.can_send_email;
  const gmailLive = d.live_channel === "gmail";
  const draftLabel = chan === "email" ? "Draft with AI" : chan === "linkedin" ? "Draft LinkedIn" : chan === "whatsapp" ? "Draft WhatsApp" : "Talking points";

  return (
    <div className="border-b border-border bg-popover/95 p-4 space-y-2.5">
      {/* channel tabs + how it sends */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {(["email", "linkedin", "whatsapp", "call"] as Chan[]).map((c) => (
            <button key={c} onClick={() => { setChan(c); setSent(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                chan === c ? "bg-[#FFD60A]/12 text-[#FFD60A]" : "text-muted-foreground hover:bg-secondary"}`}>
              {CHANNEL_META[c].label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {chan === "email"
            ? (canSendEmail ? "Sends on-thread via Instantly" : gmailLive ? "Reply from Gmail" : "No thread — copy & send")
            : "Copy & send by hand"}
        </span>
      </div>

      {/* always-visible reply box */}
      <textarea
        value={text} onChange={(e) => setDraft(chan, e.target.value)}
        placeholder={`Write your ${CHANNEL_META[chan].label} message, or click ${draftLabel}…`}
        rows={Math.min(12, Math.max(4, text.split("\n").length + 1))}
        className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50 resize-y"
      />

      {/* one-click: drop the Build (lead magnet) link into the message */}
      {d.build_url && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDraft(chan, (text.trim() ? text.trimEnd() + "\n\n" : "") + `Here is your Build: ${d.build_url}`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFD60A]/30 bg-[#FFD60A]/8 px-2.5 py-1.5 text-xs text-[#FFD60A] hover:bg-[#FFD60A]/12 transition-colors">
            🧲 Insert Build link
          </button>
          <span className="text-[11px] text-muted-foreground truncate">{d.build_name || "Their Build"}</span>
        </div>
      )}

      {/* copilot chat-to-edit */}
      {coLog.length > 0 && (
        <div className="space-y-1.5 max-h-24 overflow-y-auto text-xs">
          {coLog.map((l, i) => (
            <div key={i} className={l.role === "you" ? "text-muted-foreground" : "text-[#FFD60A]"}>
              <span className="font-semibold">{l.role === "you" ? "You: " : "Copilot: "}</span>{l.content}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Bot className="w-4 h-4 text-[#FFD60A] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={co} onChange={(e) => setCo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askCopilot(); } }}
            placeholder="Ask copilot: shorter, warmer, add the Build link…"
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50"
          />
        </div>
        <button onClick={askCopilot} disabled={coBusy || !co.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFD60A]/40 px-3 py-2 text-sm text-[#FFD60A] hover:bg-[#FFD60A]/10 disabled:opacity-40 transition-colors">
          {coBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        </button>
      </div>

      {/* actions */}
      {sent === "ok" ? (
        <div className="flex items-center gap-2 text-sm text-[#5fe08a]"><Check className="w-4 h-4" /> Sent on-thread via Instantly. Cadence advanced.</div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {canSendEmail ? (
            <button onClick={send} disabled={sending || !text.trim()}
              className="neon-btn inline-flex items-center gap-2 rounded-lg bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:bg-[#ffdf3a] disabled:opacity-40 transition-colors">
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send via Instantly</>}
            </button>
          ) : chan !== "email" && text.trim() ? (
            <a href={chan === "whatsapp" && d.phone ? (d.wa_link || `https://wa.me/${d.phone.replace(/[^\d]/g, "")}`) : chan === "linkedin" ? (d.linkedin_url || linkedinSearchUrl(d.name, d.company)) : "#"}
              target="_blank" rel="noreferrer"
              onClick={() => navigator.clipboard.writeText(text)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:bg-[#ffdf3a] transition-colors">
              <Copy className="w-4 h-4" /> Copy & open {CHANNEL_META[chan].label}
            </a>
          ) : null}
          <button onClick={() => gen()} disabled={drafting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFD60A]/40 px-3 py-2 text-sm text-[#FFD60A] hover:bg-[#FFD60A]/10 disabled:opacity-40 transition-colors">
            {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />} {draftLabel}
          </button>
          {chan === "email" && (
            <button onClick={() => gen("book")} disabled={drafting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#5fe08a]/40 px-3 py-2 text-sm text-[#5fe08a] hover:bg-[#22c55e]/10 disabled:opacity-40 transition-colors"
              title="Draft a booking message with the calendar link">
              <CalendarClock className="w-4 h-4" /> Book
            </button>
          )}
          <button onClick={() => { navigator.clipboard.writeText(text); }} disabled={!text.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
          {chan === "email" && !canSendEmail && (
            <span className="text-[11px] text-muted-foreground flex-1 min-w-[8rem]">
              {gmailLive ? "This lead's live thread is Gmail — reply from jose@luxvance.com." : "No Instantly thread on file — copy and send from your inbox."}
            </span>
          )}
        </div>
      )}
      {sent?.startsWith("err:") && <div className="text-xs text-[#ef4444]">Send failed: {sent.slice(4)}</div>}
    </div>
  );
}

// ── build card: the Build IS the lead magnet ─────────────────────────
function BuildCard({ d, onChanged }: { d: Detail; onChanged: () => void }) {
  const id = d.id;
  const [building, setBuilding] = useState(d.build_status === "building");
  const [err, setErr] = useState<string | null>(null);
  const [instr, setInstr] = useState("");        // optional extra context for the Build
  const [showInstr, setShowInstr] = useState(false);
  const [optimize, setOptimize] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // Poll the detail endpoint until the Build link appears (or changes, after a
  // rebuild). d.build_url captured here is the "before" value for this render.
  const poll = () => {
    if (!alive.current) return;
    fetch(`${API}/api/crm/prospect/${id}`).then((r) => r.json()).then((j) => {
      if (!alive.current) return;
      if (j.build_url && j.build_url !== d.build_url) { setBuilding(false); onChanged(); }
      else if (j.build_status === "error") { setBuilding(false); setErr("Build failed. Check credits or niche coverage, then retry."); }
      else setTimeout(poll, 6000);
    }).catch(() => { if (alive.current) setTimeout(poll, 8000); });
  };
  // Generate straight from the conversation. instr is optional extra guidance for
  // anything not in the emails. force=true rebuilds an existing Build.
  const start = (force: boolean) => {
    setBuilding(true); setErr(null); setOptimize(false);
    fetch(`${API}/api/crm/prospect/${id}/build`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions: instr.trim(), force }),
    }).then((r) => { if (!r.ok) throw new Error(); setTimeout(poll, 6000); })
      .catch(() => { setBuilding(false); setErr("Could not start the Build."); });
  };

  const statusLine = d.build_delivered
    ? { txt: "Delivered to prospect", cls: "text-[#5fe08a]" }
    : d.build_published ? { txt: "Published · link live", cls: "text-[#FFD60A]" }
    : { txt: "Built · link not resolving", cls: "text-[#ef4444]" };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base leading-none">🧲</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">// THEIR_BUILD</span>
        <span className="text-[11px] text-muted-foreground">· the lead magnet</span>
      </div>

      {building ? (
        <div className="flex items-center gap-2 rounded-xl border border-[#FFD60A]/30 bg-[#FFD60A]/8 px-4 py-3 text-sm text-[#FFD60A]">
          <Loader2 className="w-4 h-4 animate-spin" /> Building… sourcing ~50 real leads + copy (about a minute).
        </div>
      ) : d.build_url ? (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">🧲</span>
                <span className="font-semibold text-foreground truncate">{d.build_name || "Their Build"}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {d.build_audience || "Personalized sample"}{d.build_leads ? ` · ${d.build_leads} sample leads` : ""}
              </div>
            </div>
            <span className={`shrink-0 text-xs ${statusLine.cls}`}>{statusLine.txt}</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={d.build_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFD60A]/10 border border-[#FFD60A]/40 px-3 py-2 text-sm text-[#FFD60A] hover:bg-[#FFD60A]/15 transition-colors">
              Open the Build <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <CopyBtn value={d.build_url} label="Copy link" />
            <button onClick={() => setOptimize((v) => !v)}
              className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Optimize
            </button>
          </div>
          <div className="text-[11px] text-muted-foreground break-all">{d.build_url}</div>
          {optimize && (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="text-xs text-muted-foreground">Rebuild keeps the conversation context. Add anything you want changed.</div>
              <textarea value={instr} onChange={(e) => setInstr(e.target.value)} rows={3}
                placeholder="e.g. focus on Series A fintech in the UK, drop agencies…"
                className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50 resize-y" />
              <button onClick={() => start(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:bg-[#ffdf3a] transition-colors">
                <Sparkles className="w-4 h-4" /> Rebuild the Build
              </button>
            </div>
          )}
          {err && <div className="text-xs text-[#ef4444]">{err}</div>}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="text-sm text-foreground">
            Generate a personalized Build: about 50 of their ideal leads plus tailored copy. It reads the conversation automatically.
          </div>
          <button onClick={() => setShowInstr((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <PenLine className="w-3.5 h-3.5" /> {showInstr ? "Hide" : "Add"} instructions (optional)
          </button>
          {showInstr && (
            <textarea value={instr} onChange={(e) => setInstr(e.target.value)} rows={3}
              placeholder="Anything to consider that is not in the emails? e.g. target only US mid-market, avoid competitors…"
              className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50 resize-y" />
          )}
          <button onClick={() => start(false)}
            className="neon-btn w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFD60A] px-4 py-3 text-sm font-semibold text-[#0A0E1A] hover:bg-[#ffdf3a] transition-colors">
            🧲 Generate the Build
          </button>
          {err && <div className="text-xs text-[#ef4444]">{err}</div>}
        </div>
      )}
    </div>
  );
}

// ── channel contacts (LinkedIn + Phone) ──────────────────────────────
function ContactActions({ d, onChanged }: { d: Detail; onChanged: () => void }) {
  const [finding, setFinding] = useState(false);
  const [findNote, setFindNote] = useState<string | null>(null);

  // The email-thread scan runs automatically server-side when the record opens, so
  // there is no "find in thread" button. The only button is Clay (paid, optional).
  const shopClay = () => {
    setFinding(true); setFindNote(null);
    fetch(`${API}/api/crm/prospect/${d.id}/find-phone?source=clay`, { method: "POST" })
      .then((r) => r.json())
      .then((j) => { if (j.found) onChanged(); else setFindNote(j.note || "Clay lookup not available yet."); })
      .catch(() => setFindNote("Clay lookup failed."))
      .finally(() => setFinding(false));
  };

  return (
    <div className="space-y-3">
      {/* LinkedIn */}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
          <Link2 className="w-4 h-4 text-[#5fd0e0]" /> LinkedIn
        </div>
        {d.linkedin_url ? (
          <div className="flex items-center gap-2">
            <a href={d.linkedin_url} target="_blank" rel="noreferrer"
              className="flex-1 inline-flex items-center gap-2 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground hover:text-[#FFD60A] truncate">
              Open profile & connect <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
            <CopyBtn value={d.linkedin_url} />
          </div>
        ) : (
          <a href={linkedinSearchUrl(d.name, d.company)} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#5fd0e0]/40 bg-[#5fd0e0]/10 px-3 py-2 text-sm text-[#5fd0e0] hover:bg-[#5fd0e0]/15 transition-colors">
            <Search className="w-3.5 h-3.5" /> Search on LinkedIn to connect <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Phone / WhatsApp / Call */}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
          <Phone className="w-4 h-4 text-[#f0b45f]" /> Phone · WhatsApp · Call
        </div>
        {d.phone ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-foreground tabular-nums">{d.phone}</span>
              <CopyBtn value={d.phone} label="Copy to call" />
            </div>
            <div className="flex items-center gap-2">
              <a href={d.wa_link || `https://wa.me/${d.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-[#5fe08a]/40 bg-[#22c55e]/10 px-3 py-2 text-sm text-[#5fe08a] hover:bg-[#22c55e]/15 transition-colors">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
              <a href={`tel:${d.phone}`}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors">
                <Phone className="w-4 h-4" /> Call
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">No number in the email thread. Shop for it with Clay (paid).</div>
            <button onClick={shopClay} disabled={finding}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#f0b45f]/40 bg-[#f0b45f]/10 px-3 py-2 text-sm text-[#f0b45f] hover:bg-[#f0b45f]/15 disabled:opacity-40 transition-colors">
              {finding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Shop via Clay
            </button>
            {findNote && <div className="text-xs text-muted-foreground">{findNote}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── record (wide full-screen) ────────────────────────────────────────
function Record({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [themName, setThemName] = useState("Them");
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  const reload = useCallback(() => {
    fetch(`${API}/api/crm/prospect/${id}`).then((r) => r.json())
      .then((j) => setD(j)).catch(() => setD(null)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { setLoading(true); reload(); }, [id, reload]);
  useEffect(() => {
    fetch(`${API}/api/crm/prospect/${id}/thread`).then((r) => r.json())
      .then((j) => setThemName(j.them_name || "Them")).catch(() => {});
  }, [id]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const both = () => { reload(); onChanged(); };
  const book = () => {
    setBooking(true);
    fetch(`${API}/api/crm/prospect/${id}/book`, { method: "POST" })
      .then((r) => { if (r.ok) both(); }).finally(() => setBooking(false));
  };

  const booked = d?.status === "meeting_booked";
  const h = d ? heatChip(d.heat) : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-6xl h-full bg-popover border-l border-border flex flex-col">
        {/* header / highlights strip */}
        <div className="shrink-0 border-b border-border px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground truncate">{d?.name || "…"}</h2>
              {h && <Badge text={h.hot ? "🔥 Hot" : h.label} className={h.cls} />}
              {d?.wants_meeting && !booked && <Badge text="📅 wants to meet" className="bg-[#22c55e]/15 text-[#5fe08a]" />}
              {d?.category && <Badge text={d.category} className="bg-[#FFD60A]/12 text-[#FFD60A]" />}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {d?.job_title ? `${d.job_title} · ` : ""}{d?.company}{d?.country ? ` · ${d.country}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {booked ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#5fe08a]/40 bg-[#22c55e]/10 px-3 py-2 text-sm text-[#5fe08a]">
                <CalendarClock className="w-4 h-4" /> Booked
              </span>
            ) : (
              <button onClick={book} disabled={booking}
                className="inline-flex items-center gap-2 rounded-lg border border-[#5fe08a]/40 bg-[#22c55e]/10 px-3 py-2 text-sm font-medium text-[#5fe08a] hover:bg-[#22c55e]/15 disabled:opacity-40 transition-colors">
                {booking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />} Mark booked
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading || !d ? (
          <div className="p-6 text-muted-foreground text-sm">Loading…</div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            {/* LEFT: context + actions */}
            <div className="overflow-y-auto p-6 space-y-5 lg:border-r border-border">
              {/* act now */}
              {(() => {
                const a = actNow(d);
                const tone = a.tone === "green" ? "border-[#5fe08a]/40 bg-[#22c55e]/8"
                  : a.tone === "gold" ? "border-[#FFD60A]/40 bg-[#FFD60A]/8" : "border-border bg-card";
                const txt = a.tone === "green" ? "text-[#5fe08a]" : a.tone === "gold" ? "text-[#FFD60A]" : "text-foreground";
                return (
                  <div className={`rounded-xl border p-4 ${tone}`}>
                    <div className={`flex items-center gap-2 text-sm font-semibold ${txt}`}>
                      <Zap className="w-4 h-4" /> {a.title}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{a.detail}</p>
                  </div>
                );
              })()}

              <BuildCard d={d} onChanged={both} />
              <ContactActions d={d} onChanged={reload} />

              <div className="text-xs text-muted-foreground border-t border-border pt-4">
                {d.live_channel === "gmail"
                  ? "Live thread is on Gmail (jose@luxvance.com). Reply from your inbox, not the burner."
                  : "Email sends go on-thread via Instantly. LinkedIn, WhatsApp and calls are copy-and-send by hand. Nothing sends until you click."}
              </div>
            </div>

            {/* RIGHT: composer on top, newest-first conversation below */}
            <div className="flex flex-col min-h-0">
              <ReplyComposer d={d} onSent={both} />
              <div className="flex-1 min-h-0 overflow-y-auto p-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">// CONVERSATION · NEWEST_FIRST</div>
                <Conversation id={id} themName={themName} fallback={d.reply_text} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── queue row ────────────────────────────────────────────────────────
function ProspectRow({ r, onOpen }: { r: Card; onOpen: (id: number) => void }) {
  const mine = r.waiting_on === "us";
  const h = heatChip(r.heat);
  return (
    <tr onClick={() => onOpen(r.id)}
      className={`border-b border-border/60 last:border-0 hover:bg-secondary/60 cursor-pointer ${rotEdge(r)}`}>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground flex items-center gap-2">
          {r.name}
          {r.wants_meeting && r.waiting_on !== "closed" && <span className="text-[11px]" title="Wants to meet">📅</span>}
        </div>
        <div className="text-xs text-muted-foreground">{r.job_title ? `${r.job_title} · ` : ""}{r.company || r.email}</div>
      </td>
      <td className="px-3 py-3">
        {r.waiting_on !== "closed" && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${h.cls}`}>
            {h.hot && <Flame className="w-3 h-3" />}{h.label}
          </span>
        )}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="text-[11px] text-muted-foreground">replied</div>
        <div className={`text-sm tabular-nums ${mine ? "text-[#FFD60A]" : "text-foreground"}`}>{timeAgo(r.last_reply_at)}</div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-block w-2 h-2 rounded-full ${r.build_delivered ? "bg-[#5fe08a]" : r.has_build ? "bg-[#FFD60A]" : "bg-muted-foreground/40"}`}
          title={r.build_delivered ? "Build delivered" : r.has_build ? "Build ready" : "No Build"} />
      </td>
      <td className="px-4 py-3 text-right">
        {r.waiting_on === "us" ? (
          <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${
            r.wants_meeting ? "bg-[#22c55e]/15 text-[#5fe08a]" : "bg-[#FFD60A]/12 text-[#FFD60A]"}`}>
            {r.wants_meeting ? "Book" : "Reply"}
          </span>
        ) : r.waiting_on === "them" ? (
          <span className="text-xs text-muted-foreground">
            {r.next_channel ? `next: ${r.next_channel} ${isDue(r.next_touch_at) ? "due" : fmtDate(r.next_touch_at)}` : "waiting"}
          </span>
        ) : <span className="text-xs text-[#5fe08a]">booked</span>}
      </td>
    </tr>
  );
}

function PipelineSection({ title, hint, rows, onOpen, accent }: {
  title: string; hint?: string; rows: Card[]; onOpen: (id: number) => void; accent?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h2 className={`text-sm font-semibold ${accent ? "text-[#FFD60A]" : "text-foreground"}`}>{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{rows.length}</span>
        {hint && <span className="text-xs text-muted-foreground ml-auto">{hint}</span>}
      </div>
      <div className={`bg-card border rounded-xl overflow-hidden ${accent ? "border-[#FFD60A]/30" : "border-border"}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><tbody>
            {rows.map((r) => <ProspectRow key={r.id} r={r} onOpen={onOpen} />)}
          </tbody></table>
        </div>
      </div>
    </div>
  );
}

// ── board (kanban) ───────────────────────────────────────────────────
function BoardCard({ r, onOpen }: { r: Card; onOpen: (id: number) => void }) {
  const h = heatChip(r.heat);
  const cat = catPill(r.category);
  const owed = r.waiting_on === "us" ? daysSince(r.last_reply_at) : 0;
  // The footer clock reads differently per column: when the ball is with us it's a
  // "silent for N days" debt (loud past 3d); when it's on them it's the next scheduled
  // nudge; when closed it's the stage. This is the single most action-driving line.
  const clock =
    r.waiting_on === "us"
      ? { text: owed <= 0 ? "replied today" : `${owed}d silent`, cls: owed >= 7 ? "text-[#ff9b9b]" : owed >= 3 ? "text-[#f0b45f]" : "text-muted-foreground" }
      : r.waiting_on === "them"
      ? { text: r.next_touch_at ? (isDue(r.next_touch_at) ? "nudge due" : `next ${fmtDate(r.next_touch_at)}`) : timeAgo(r.last_touch_at), cls: r.next_touch_at && isDue(r.next_touch_at) ? "text-[#FFD60A]" : "text-muted-foreground" }
      : { text: r.stage_label || r.status_label, cls: "text-muted-foreground" };
  return (
    <button onClick={() => onOpen(r.id)} draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(r.id))}
      className={`w-full text-left bg-card border border-border rounded-xl p-3 hover:border-[#FFD60A]/50 transition-colors ${rotEdge(r)}`}>
      {/* name + heat */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-foreground text-sm truncate flex items-center gap-1.5">
            {r.wants_meeting && r.waiting_on !== "closed" && <span className="text-[11px]">📅</span>}{r.name}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {[r.job_title, r.company].filter(Boolean).join(" · ") || r.email}
          </div>
        </div>
        {r.waiting_on !== "closed" && (
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${h.cls}`}>
            {h.hot && <Flame className="w-2.5 h-2.5" />}{r.heat}
          </span>
        )}
      </div>

      {/* their actual words — the context that makes this a cockpit, not a list */}
      {r.reply_snippet && (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground/90 line-clamp-2 border-l border-border pl-2">
          “{r.reply_snippet}”
        </p>
      )}

      {/* footer: category · country · clock · build · assets */}
      <div className="flex items-center gap-1.5 mt-2.5 text-[10px]">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-medium ${cat.cls}`}>{cat.label}</span>
        {r.country && <span className="text-muted-foreground/70 truncate max-w-[5rem]">{r.country}</span>}
        <span className={`ml-auto tabular-nums ${clock.cls}`}>{clock.text}</span>
        {(r.build_delivered || r.has_build) && (
          <span title={r.build_delivered ? "Build sent" : "Build ready"}
            className={`inline-block w-1.5 h-1.5 rounded-full ${r.build_delivered ? "bg-[#26D07C]" : "bg-[#FFD60A]"}`} />
        )}
        {r.has_phone && <span title="Phone on file" className="text-muted-foreground/60">☎</span>}
        {r.has_linkedin && <span title="LinkedIn on file" className="text-[#5fd0e0]/70 font-semibold">in</span>}
      </div>
    </button>
  );
}

function BoardColumn({ title, hint, accent, tone, rows, onOpen, onDrop }: {
  title: string; hint?: string; accent?: boolean; tone?: "green" | "muted";
  rows: Card[]; onOpen: (id: number) => void; onDrop?: (id: number) => void;
}) {
  const [over, setOver] = useState(false);
  const ring = tone === "green" ? "bg-[#26D07C]/8 ring-1 ring-[#26D07C]/40"
    : tone === "muted" ? "bg-muted/20 ring-1 ring-border" : "bg-[#FFD60A]/6 ring-1 ring-[#FFD60A]/40";
  return (
    <div
      onDragOver={onDrop ? (e) => { e.preventDefault(); setOver(true); } : undefined}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop ? (e) => { e.preventDefault(); setOver(false); const id = Number(e.dataTransfer.getData("text/plain")); if (id) onDrop(id); } : undefined}
      className={`shrink-0 w-[17rem] rounded-xl p-2 transition-colors ${over ? ring : "bg-card/30"}`}>
      <div className="px-2 py-1.5 mb-1 border-b border-border/60">
        <div className="flex items-center gap-2">
          <h3 className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-[#FFD60A]" : tone === "green" ? "text-[#5fe08a]" : "text-foreground"}`}>{title}</h3>
          <span className="text-xs text-muted-foreground tabular-nums ml-auto">{rows.length}</span>
        </div>
        {hint && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>}
      </div>
      <div className="space-y-2 max-h-[calc(100vh-20rem)] overflow-y-auto pr-1 pt-1">
        {rows.map((r) => <BoardCard key={r.id} r={r} onOpen={onOpen} />)}
        {rows.length === 0 && <div className="text-[11px] text-muted-foreground/50 px-2 py-6 text-center border border-dashed border-border/50 rounded-lg">drop here</div>}
      </div>
    </div>
  );
}

// The funnel = our lead journey, in order. Each column is a stage; drag a card right as
// the deal advances. Kept in sync with the backend FUNNEL_STAGES.
const FUNNEL: { key: string; title: string; hint: string; tone?: "green" | "muted" }[] = [
  { key: "new_reply",        title: "New reply",       hint: "replied · Build being prepped" },
  { key: "in_conversation",  title: "In conversation", hint: "nurturing · Build sent" },
  { key: "discovery_booked", title: "Discovery",       hint: "call booked / held" },
  { key: "proposal_sent",    title: "Proposal sent",   hint: "after they saw the Build" },
  { key: "won",              title: "Won",             hint: "closed · client", tone: "green" },
  { key: "lost",             title: "Lost / Parked",   hint: "dead or not now", tone: "muted" },
];

// ── page ─────────────────────────────────────────────────────────────
export default function CrmPage() {
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [rows, setRows] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [view, setView] = useState<"queue" | "board">("board");
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/crm/prospects`).then((r) => r.json())
      .then((j) => { setFunnel(j.funnel); setRows(j.prospects || []); })
      .catch(() => { setFunnel(null); setRows([]); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Deep link: /crm?lead=<id> opens that prospect straight away (from a Slack alert).
  // Keep the URL in sync so back/close and sharing behave.
  const openRecord = useCallback((id: number | null) => {
    setOpenId(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", id ? `/crm?lead=${id}` : "/crm");
    }
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("lead");
    if (p && !isNaN(Number(p))) setOpenId(Number(p));
  }, []);
  // Live-sync: on open, ask the server to refresh the queue from the real Instantly
  // threads (catches replies/sends made anywhere), then pull the fresh data.
  useEffect(() => {
    fetch(`${API}/api/crm/refresh`, { method: "POST" })
      .then((r) => r.json())
      .then((j) => { if (j.started) setTimeout(load, 12000); })
      .catch(() => {});
  }, [load]);

  // Drag a card to a funnel column → persist the stage, then refresh so the queue/cadence
  // (which the backend keeps in sync with the stage) and the board agree.
  const moveStage = (id: number, stage: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, stage } : r)));  // optimistic
    fetch(`${API}/api/crm/prospect/${id}/stage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    }).then((r) => { if (r.ok) load(); else load(); });
  };

  const groups = useMemo(() => {
    let r = rows;
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter((x) => x.name.toLowerCase().includes(t) || x.company.toLowerCase().includes(t) || x.email.toLowerCase().includes(t));
    }
    const ms = (s: string | null) => (s ? new Date(s).getTime() : 0);
    // Hottest first: heat desc, then most-overdue.
    const us = r.filter((x) => x.waiting_on === "us").sort((a, b) => b.heat - a.heat || ms(a.last_reply_at) - ms(b.last_reply_at));
    const them = r.filter((x) => x.waiting_on === "them").sort((a, b) => ms(a.next_touch_at) - ms(b.next_touch_at));
    const closed = r.filter((x) => x.waiting_on === "closed");
    return { us, them, closed };
  }, [rows, q]);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold neon tracking-tight">// LUXVANCE_CRM</h1>
          <p className="text-sm text-muted-foreground mt-1 term-prompt">reply pipeline · work the queue, book the call</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-card border border-border rounded-lg p-0.5">
            <button onClick={() => setView("queue")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "queue" ? "bg-[#FFD60A]/12 text-[#FFD60A]" : "text-muted-foreground"}`}>
              <List className="w-4 h-4" /> Queue
            </button>
            <button onClick={() => setView("board")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "board" ? "bg-[#FFD60A]/12 text-[#FFD60A]" : "text-muted-foreground"}`}>
              <LayoutGrid className="w-4 h-4" /> Board
            </button>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-2 py-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <Briefing onOpen={openRecord} />

      {funnel && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Tile label="⚡ Your turn" value={funnel.waiting_us} accent active={onlyMine} onClick={() => setOnlyMine((v) => !v)} />
          <Tile label="Hot now" value={funnel.hot_now} icon={<Flame className="w-4 h-4 text-[#ff9b9b]" />} />
          <Tile label="Want to meet" value={funnel.wants_meeting} />
          <Tile label="Waiting on them" value={funnel.waiting_them} />
          <Tile label="Meetings" value={funnel.by_status?.meeting_booked?.count || 0} />
        </div>
      )}

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email…"
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50" />
        </div>
        {view === "queue" && (
          <button onClick={() => setOnlyMine((v) => !v)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${onlyMine ? "bg-[#FFD60A]/10 text-[#FFD60A] border-[#FFD60A]/40" : "text-muted-foreground border-border hover:bg-secondary"}`}>
            Only your turn
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-16">Loading…</div>
      ) : view === "queue" ? (
        <>
          <PipelineSection title="// YOUR_TURN" hint="they replied, the ball is with us · hottest first" rows={groups.us} onOpen={openRecord} accent />
          {!onlyMine && <PipelineSection title="// WAITING_ON_THEM" hint="we replied last" rows={groups.them} onOpen={openRecord} />}
          {!onlyMine && <PipelineSection title="// BOOKED_&_CLOSED" rows={groups.closed} onOpen={openRecord} />}
          {groups.us.length === 0 && groups.them.length === 0 && groups.closed.length === 0 && (
            <div className="text-center text-muted-foreground py-16">No prospects.</div>
          )}
        </>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {FUNNEL.map((s) => {
            const ms = (v: string | null) => (v ? new Date(v).getTime() : 0);
            const col = (q.trim()
              ? rows.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()) || x.company.toLowerCase().includes(q.toLowerCase()) || x.email.toLowerCase().includes(q.toLowerCase()))
              : rows
            ).filter((x) => (x.stage || "new_reply") === s.key)
              // hottest first, then most-overdue
              .sort((a, b) => b.heat - a.heat || ms(a.last_reply_at) - ms(b.last_reply_at));
            return (
              <BoardColumn key={s.key} title={s.title} hint={s.hint} tone={s.tone}
                accent={s.key === "new_reply"} rows={col} onOpen={openRecord}
                onDrop={(id) => moveStage(id, s.key)} />
            );
          })}
        </div>
      )}

      {openId !== null && <Record id={openId} onClose={() => openRecord(null)} onChanged={load} />}
    </div>
  );
}
