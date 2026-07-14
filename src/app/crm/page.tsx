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
  call_notes: string;
  call_notes_at: string | null;
  dossier_facts: Record<string, unknown>;
  dossier_status: string;
  research: {
    website: string;
    google_company: string;
    google_person: string;
    linkedin_person: string;
    linkedin_company: string;
    fireflies: string;
  };
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

// Tidy a reply snippet for the card: collapse newlines/whitespace, drop a leading quote or
// list marker ("1.", "-", "•") and any greeting so the preview opens on the real content.
function cleanSnippet(s: string): string {
  let t = (s || "").replace(/\s+/g, " ").trim();
  t = t.replace(/^["“”'`\s]+/, "");
  t = t.replace(/^(\d+[.)]\s+|[-•]\s+)/, "");
  t = t.replace(/^(hi|hello|hey|dear)\b[^,]*,\s*/i, "");
  return t.trim();
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

const FREE_MAIL = new Set(["gmail.com","googlemail.com","outlook.com","hotmail.com","live.com",
  "yahoo.com","icloud.com","me.com","aol.com","proton.me","protonmail.com","msn.com"]);

// The prospect's company domain, for their favicon. Prefer the email domain (a B2B
// prospect emails from their company), skipping free mailboxes.
function domainOf(email?: string): string {
  const d = (email || "").split("@")[1]?.trim().toLowerCase() || "";
  return d && !FREE_MAIL.has(d) ? d : "";
}

// A small logo from a domain's favicon (Google's service). Falls back to a monogram tile
// if the icon fails, so a missing favicon never leaves a broken image.
function Favicon({ domain, label, size = 20, className = "" }: {
  domain: string; label?: string; size?: number; className?: string;
}) {
  const [ok, setOk] = useState(true);
  if (domain && ok) {
    return (
      <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        width={size} height={size} alt={label || domain} onError={() => setOk(false)}
        className={`rounded-[4px] shrink-0 ${className}`} style={{ width: size, height: size }} />
    );
  }
  return (
    <span className={`inline-grid place-items-center rounded-[4px] bg-secondary text-muted-foreground shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {(label || domain || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

// Brand favicon for a channel tab (real logos: Gmail / LinkedIn / WhatsApp), phone glyph
// for a call. Keeps the CRM feeling like the tools Jose actually sends from.
const CHANNEL_BRAND: Record<string, string> = {
  email: "gmail.com", linkedin: "linkedin.com", whatsapp: "whatsapp.com", call: "",
};

// Per-source brand identity for the conversation. Each thread block is one mailbox/channel,
// so a burner email reads as Instantly, jose@luxvance.com as Gmail, and LinkedIn/WhatsApp
// as themselves. The bar/ring tint the bubbles so the thread feels wired to the real tool.
type Src = "gmail" | "instantly" | "linkedin" | "whatsapp";
const SRC: Record<Src, { logo: string; name: string; bar: string; ring: string; tint: string }> = {
  gmail:     { logo: "gmail.com",    name: "Gmail",     bar: "#EA4335", ring: "rgba(234,67,53,.30)",  tint: "rgba(234,67,53,.08)" },
  instantly: { logo: "instantly.ai", name: "Instantly", bar: "#6D5EF7", ring: "rgba(109,94,247,.32)", tint: "rgba(109,94,247,.09)" },
  linkedin:  { logo: "linkedin.com", name: "LinkedIn",  bar: "#0A66C2", ring: "rgba(10,102,194,.35)", tint: "rgba(10,102,194,.10)" },
  whatsapp:  { logo: "whatsapp.com", name: "WhatsApp",  bar: "#25D366", ring: "rgba(37,211,102,.35)", tint: "rgba(37,211,102,.10)" },
};
// A conversation block is one channel: derive its source for the logo + tint.
function convoSource(c: Convo): Src {
  const ch = `${c.channel || ""} ${c.kind || ""}`.toLowerCase();
  if (ch.includes("linkedin")) return "linkedin";
  if (ch.includes("whatsapp") || ch.includes("wa_")) return "whatsapp";
  return c.kind === "work_mailbox" ? "gmail" : "instantly";
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
// Collapsible: it's a great morning read but pure summary, so on a laptop it should be able
// to fold away and give the board the vertical room. State persists across reloads.
function Briefing({ onOpen }: { onOpen: (id: number) => void }) {
  const [s, setS] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (typeof window !== "undefined") setOpen(localStorage.getItem("crm.briefing") !== "0");
  }, []);
  const toggle = () => setOpen((o) => { const n = !o; if (typeof window !== "undefined") localStorage.setItem("crm.briefing", n ? "1" : "0"); return n; });
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/crm/summary`)
      .then((r) => r.json()).then(setS).catch(() => setS(null)).finally(() => setLoading(false));
  }, []);
  return (
    <div className="bg-gradient-to-br from-card to-card/40 border border-[#FFD60A]/20 rounded-2xl px-5 py-4 mb-4">
      <button onClick={toggle} className="w-full flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        <Sparkles className="w-4 h-4 text-[#FFD60A]" />
        <span className="neon-hl">// WHERE_YOU_STAND</span>
        {!open && s && <span className="normal-case tracking-normal text-muted-foreground font-normal truncate ml-1">— {s.counts.waiting_us} your turn · {s.counts.hot_now} hot · {s.counts.wants_meeting} want to meet</span>}
        <ChevronRight className={`w-4 h-4 text-muted-foreground ml-auto transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (loading ? (
        <div className="text-sm text-muted-foreground mt-2">Reading the pipeline…</div>
      ) : s ? (
        <div className="mt-2.5">
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
        </div>
      ) : (
        <div className="text-sm text-muted-foreground mt-2">Could not load the briefing.</div>
      ))}
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
function shortAddr(a: string): string {
  a = a || "";
  return a.length <= 28 ? a : `${a.slice(0, 14)}…${a.slice(-11)}`;
}
// Direction-agnostic identity of a message: same two addresses = same route.
function routeKey(m: ThreadMsg): string { return [m.from_addr, m.to_addr].filter(Boolean).sort().join("|"); }

// One conversation = one mailbox/burner = one campaign the prospect went through.
// The backend groups the full cross-campaign history this way so a prospect hit by two
// campaigns reads as two clean threads, each labeled with the burner that ran it.
type Convo = {
  eaccount: string; domain: string; channel: string; kind: string;
  replied: boolean; active: boolean; count: number; reply_count: number;
  sent_count: number; first_at: string | null; last_at: string | null;
  last_reply_at: string | null; subject: string; messages: ThreadMsg[];
};

// A single campaign thread: a labeled, collapsible block. The burner + a REPLIED/no-reply
// badge sit in the header so Jose knows at a glance which mailbox ran it and whether the
// prospect ever answered. Open by default only for the primary (most-recent replied) one.
function ConvoBlock({ c, themName, defaultOpen }: { c: Convo; themName: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const src = SRC[convoSource(c)];
  const routeShow = c.messages.map((m, i) => i === 0 || routeKey(m) !== routeKey(c.messages[i - 1]));
  const ordered = [...c.messages].reverse(); // newest first inside the block
  return (
    <div className={`rounded-xl border overflow-hidden ${
      c.active ? "border-[#FFD60A]/40 bg-[#FFD60A]/[0.02]"
      : c.replied ? "border-border" : "border-border/60"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-secondary/40 transition-colors">
        <Favicon domain={src.logo} label={src.name} size={18} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-foreground truncate">{cleanSubject(c.subject) || "(no subject)"}</span>
            {c.active && <span className="shrink-0 text-[8.5px] uppercase tracking-[0.1em] px-1 py-px rounded bg-[#FFD60A]/15 text-[#FFD60A]">active</span>}
          </div>
          <div className="text-[10.5px] text-muted-foreground truncate">
            <span style={{ color: src.bar }}>{src.name}</span> · {c.eaccount}
          </div>
        </div>
        {c.replied
          ? <span className="shrink-0 text-[10px] font-medium text-[#26D07C]">{c.reply_count} repl{c.reply_count > 1 ? "ies" : "y"}</span>
          : <span className="shrink-0 text-[10px] text-muted-foreground/80">no reply</span>}
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{c.sent_count} sent</span>
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{timeAgo(c.last_at)}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground w-3 text-center">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2.5 space-y-3 border-t border-border">
          {ordered.map((m, i) => {
            const orig = c.messages.length - 1 - i;
            const who = m.from_me ? "You" : themName;
            const latest = i === 0 && !m.from_me;
            const route = routeShow[orig] && (m.from_addr || m.to_addr) ? (
              <>{shortAddr(m.from_addr)} <span style={{ color: src.bar }}>&gt;</span> {shortAddr(m.to_addr)}</>
            ) : null;
            return (
              <div key={i} className={`flex gap-2.5 ${m.from_me ? "flex-row-reverse" : ""}`}>
                <div className="shrink-0 w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold overflow-hidden"
                  style={m.from_me ? { background: "rgba(255,214,10,.15)", color: "#FFD60A" } : { background: src.tint }}>
                  {m.from_me ? "JB" : <Favicon domain={src.logo} label={src.name} size={16} />}
                </div>
                {m.from_me ? (
                  // OUR reply — dark bubble tinted with the channel colour it went out on
                  <div className="max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm border"
                    style={{ background: src.tint, borderColor: src.ring }}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-semibold" style={{ color: src.bar }}>You</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{timeAgo(m.at)}</span>
                      <span className="text-[9px] uppercase tracking-wide" style={{ color: src.bar }}>via {src.name}</span>
                    </div>
                    {route && <div className="text-[10.5px] text-muted-foreground/80 mb-1.5 truncate">{route}</div>}
                    <div className="text-foreground whitespace-pre-wrap leading-relaxed">{m.text}</div>
                  </div>
                ) : (
                  // THEIR reply — white "paper" like the real inbox, so HTML email renders faithfully
                  <div className="max-w-[82%] rounded-2xl overflow-hidden border shadow-sm bg-white"
                    style={{ borderColor: latest ? src.ring : "rgba(0,0,0,.10)", borderLeft: `3px solid ${src.bar}` }}>
                    <div className="px-3.5 py-2.5 text-sm text-[#1a1a1a]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-semibold text-[#111]">{who}</span>
                        <span className="text-[11px] text-[#6b7280] tabular-nums">{timeAgo(m.at)}</span>
                        {latest && <span className="text-[10px] font-medium" style={{ color: src.bar }}>latest</span>}
                      </div>
                      {route && <div className="text-[10.5px] text-[#6b7280] mb-1.5 truncate">{route}</div>}
                      <div className="whitespace-pre-wrap leading-relaxed text-[#1a1a1a]">{m.text}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Conversation({ id, themName, fallback }: { id: number; themName: string; fallback?: string }) {
  const [convos, setConvos] = useState<Convo[] | null>(null);
  useEffect(() => {
    setConvos(null);
    fetch(`${API}/api/crm/prospect/${id}/thread`)
      .then((r) => r.json())
      .then((j) => setConvos(j.conversations || []))
      .catch(() => setConvos([]));
  }, [id]);

  if (convos === null) return <div className="text-sm text-muted-foreground p-2">Loading conversation…</div>;
  if (convos.length === 0) {
    return fallback
      ? <div className="bg-card border border-border rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap">{fallback}</div>
      : <div className="text-sm text-muted-foreground p-2">No email thread found in Instantly.</div>;
  }
  const repliedCount = convos.filter((c) => c.replied).length;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[#FFD60A]/65">
        <span>// CONVERSATIONS · {convos.length}</span>
        {repliedCount > 0 && <span className="text-[#26D07C]/70 normal-case tracking-normal">{repliedCount} replied</span>}
        {convos.length - repliedCount > 0 && <span className="text-muted-foreground/60 normal-case tracking-normal">{convos.length - repliedCount} cold campaign{convos.length - repliedCount > 1 ? "s" : ""}</span>}
      </div>
      {convos.map((c, i) => (
        <ConvoBlock key={c.eaccount} c={c} themName={themName} defaultOpen={i === 0} />
      ))}
    </div>
  );
}

// ── reply composer: channel tabs + draft + send + copilot ────────────
type DraftResp = { channel: string; step: number; goal: string; draft: string; can_send: boolean; gmail_live: boolean };
type Chan = "email" | "linkedin" | "whatsapp" | "call";
type CoLog = { role: "you" | "copilot"; content: string };

function useComposer(d: Detail, onSent: () => void) {
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
  return { d, chan, setChan, text, setDraft, gen, send, askCopilot, drafting, sending, sent, setSent, co, setCo, coBusy, coLog, canSendEmail, gmailLive, draftLabel };
}
type ComposerCtl = ReturnType<typeof useComposer>;

// Copilot chat-to-edit — lifted out of the composer so it can sit in the right rail (per
// the redesign) while still editing the composer's draft, which lives in the shared state.
function Copilot({ c }: { c: ComposerCtl }) {
  const { co, setCo, askCopilot, coBusy, coLog } = c;
  return (
    <div className="rounded-xl border border-[#FFD60A]/25 bg-[#FFD60A]/[0.04] p-3 space-y-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#FFD60A] font-semibold">
        <Bot className="w-4 h-4" /> Ask copilot
      </div>
      {coLog.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
          {coLog.map((l, i) => (
            <div key={i} className={l.role === "you" ? "text-muted-foreground" : "text-[#FFD60A]"}>
              <span className="font-semibold">{l.role === "you" ? "You: " : "Copilot: "}</span>{l.content}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles className="w-4 h-4 text-[#FFD60A] absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={co} onChange={(e) => setCo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askCopilot(); } }}
            placeholder="shorter, warmer, add the Build link…"
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50" />
        </div>
        <button onClick={askCopilot} disabled={coBusy || !co.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFD60A]/40 px-3 py-2 text-sm text-[#FFD60A] hover:bg-[#FFD60A]/10 disabled:opacity-40 transition-colors">
          {coBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function Composer({ c }: { c: ComposerCtl }) {
  const { d, chan, setChan, text, setDraft, gen, send, drafting, sending, sent, setSent, canSendEmail, gmailLive, draftLabel } = c;

  return (
    <div className="border border-border rounded-xl bg-popover/95 p-4 space-y-2.5">
      {/* channel tabs + how it sends */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {(["email", "linkedin", "whatsapp", "call"] as Chan[]).map((ch) => (
            <button key={ch} onClick={() => { setChan(ch); setSent(null); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                chan === ch ? "bg-[#FFD60A]/12 text-[#FFD60A]" : "text-muted-foreground hover:bg-secondary"}`}>
              {CHANNEL_BRAND[ch]
                ? <Favicon domain={CHANNEL_BRAND[ch]} label={CHANNEL_META[ch].label} size={14} />
                : <Phone className="w-3.5 h-3.5 text-[#5fe08a]" />}
              {CHANNEL_META[ch].label}
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
        placeholder={`Write your ${CHANNEL_META[chan].label} message, or ask the copilot…`}
        rows={Math.min(12, Math.max(4, text.split("\n").length + 1))}
        className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50 resize-y"
      />

      {/* the branded Luxvance signature is attached automatically on send */}
      {chan === "email" && (
        <div className="flex items-center gap-2 rounded-lg border border-[#C9A84C]/25 bg-[#C9A84C]/[0.06] px-2.5 py-1.5">
          <Favicon domain="luxvance.com" label="Luxvance" size={16} />
          <span className="text-[11px] text-muted-foreground leading-tight">
            <span className="text-[#C9A84C] font-medium">Luxvance signature</span> attached on send · logo · tagline · book link. Just end with a sign-off like <span className="text-foreground">Best,</span>
          </span>
        </div>
      )}

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
// The intelligence panel: the discovery-call notes (Fireflies) + the distilled why-they-fit
// dossier + the 6 raw research sources, each expandable. This is the "deep research" surfaced
// in the CRM so Jose can see, on the card, exactly why a prospect fits and what was said.
const FACT_ROWS: [string, string][] = [
  ["best_angle", "Best angle"], ["what_they_sell", "What they sell"],
  ["their_icp", "Who they sell to"], ["pain_points", "Likely pain"],
  ["buying_signals", "Buying signals"], ["person_notes", "About them"],
  ["objections", "Objections"],
];
const RESEARCH_ROWS: [string, string][] = [
  ["fireflies", "📞 Discovery call"], ["linkedin_person", "in Person LinkedIn"],
  ["linkedin_company", "in Company LinkedIn"], ["google_person", "🔎 Person on the web"],
  ["google_company", "🔎 Company on the web"], ["website", "🌐 Website"],
];
function factStr(v: unknown): string {
  if (Array.isArray(v)) return v.filter(Boolean).map(String).join(" · ");
  return v == null ? "" : String(v);
}
function Expandable({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-foreground hover:bg-secondary/50">
        <span className="font-medium">{label}</span>
        <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <p className="px-3 pb-3 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">{text}</p>}
    </div>
  );
}
function IntelPanel({ d }: { d: Detail }) {
  const f = (d.dossier_facts || {}) as Record<string, unknown>;
  const facts = FACT_ROWS.map(([k, l]) => [l, factStr(f[k])] as [string, string]).filter(([, v]) => v);
  const research = RESEARCH_ROWS.map(([k, l]) => [l, (d.research?.[k as keyof typeof d.research] || "")] as [string, string]).filter(([, v]) => v);
  const ffCount = research.length;
  if (!facts.length && !ffCount && !d.call_notes) return null;
  return (
    <div className="rounded-xl border border-[#FFD60A]/20 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#FFD60A]">
        <Bot className="w-4 h-4" /> Intelligence · why they fit
        {d.dossier_status && <span className="ml-auto text-[10px] font-normal text-muted-foreground uppercase">{ffCount}/6 sources</span>}
      </div>
      {/* call notes get top billing when we have them */}
      {d.call_notes && (
        <div className="rounded-lg border border-[#26D07C]/25 bg-[#26D07C]/5 p-3">
          <div className="text-[11px] font-semibold text-[#5fe08a] mb-1">📞 Call notes (Fireflies){d.call_notes_at ? ` · ${fmtDate(d.call_notes_at)}` : ""}</div>
          <p className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">{d.call_notes}</p>
        </div>
      )}
      {facts.length > 0 && (
        <dl className="space-y-1.5">
          {facts.map(([label, val]) => (
            <div key={label} className="text-xs">
              <dt className="text-muted-foreground/70 text-[10px] uppercase tracking-wide">{label}</dt>
              <dd className="text-foreground/90 leading-snug">{val}</dd>
            </div>
          ))}
        </dl>
      )}
      {research.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Raw research</div>
          {research.map(([label, text]) => <Expandable key={label} label={label} text={text} />)}
        </div>
      )}
    </div>
  );
}

// Detail cache: hovering a board card warms its detail so the click opens instantly.
// The backend now serves the intent read and Build check from a per-row cache, so an
// unchanged card never pays the gpt-5 + 8s-HEAD cost again. force=true (the ↻ button,
// or any mutation) bypasses both caches and recomputes fresh.
const _detailCache = new Map<number, Promise<Detail | null>>();
function loadDetail(id: number, force = false): Promise<Detail | null> {
  if (!force && _detailCache.has(id)) return _detailCache.get(id)!;
  const p = fetch(`${API}/api/crm/prospect/${id}${force ? "?refresh=true" : ""}`)
    .then((r) => (r.ok ? (r.json() as Promise<Detail>) : null))
    .catch(() => null);
  _detailCache.set(id, p);
  return p;
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{k}</dt>
      <dd className="text-foreground text-right truncate">{v}</dd>
    </div>
  );
}

// The left rail: who-and-where a closer needs at a glance — deal facts, which channels are
// reachable, the Build status, and quick actions. Build/contact management tools tuck into a
// collapsible so the rail stays clean by default.
function DealRail({ d, both, reload }: { d: Detail; both: () => void; reload: (f?: boolean) => void }) {
  const [tools, setTools] = useState(false);
  const [fuOpen, setFuOpen] = useState(false);
  const [fuChan, setFuChan] = useState(d.next?.next_channel || "email");
  const [fuDate, setFuDate] = useState(d.next?.next_touch_at ? d.next.next_touch_at.slice(0, 10) : "");
  const [fuBusy, setFuBusy] = useState(false);
  const saveFu = (clear = false) => {
    setFuBusy(true);
    fetch(`${API}/api/crm/prospect/${d.id}/follow-up`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: fuChan, at: clear ? null : (fuDate ? new Date(`${fuDate}T09:00:00`).toISOString() : null) }),
    }).then((r) => { if (r.ok) { reload(true); setFuOpen(false); } }).finally(() => setFuBusy(false));
  };
  const build = d.build_url
    ? (d.build_delivered ? { t: "Delivered", c: "#26D07C" } : d.build_published ? { t: "Published", c: "#FFD60A" } : { t: "Built", c: "#f0b45f" })
    : null;
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold mb-2">Deal</div>
        <dl className="space-y-2 text-[12.5px]">
          <Row k="Source" v={d.reply_campaign || "Cold outbound"} />
          <Row k="Segment" v={d.category || "—"} />
          <Row k="Replied" v={<span className="tabular-nums">{timeAgo(d.last_reply_at)}</span>} />
          <Row k="Last touch" v={<span className="tabular-nums">{d.last_touch_at ? `${timeAgo(d.last_touch_at)}${d.last_channel ? ` · ${d.last_channel}` : ""}` : "—"}</span>} />
          <Row k="Next step" v={
            <button onClick={() => setFuOpen((v) => !v)} className="text-[#FFD60A] hover:underline decoration-dotted underline-offset-2">
              {d.next?.next_touch_at ? `${d.next.next_channel || "email"} · ${fmtDate(d.next.next_touch_at)}` : "set follow-up"}
            </button>
          } />
        </dl>
        {fuOpen && (
          <div className="mt-3 rounded-lg border border-[#FFD60A]/30 bg-[#FFD60A]/[0.04] p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#FFD60A] font-semibold">Set follow-up</div>
            <div className="flex items-center gap-2">
              <select value={fuChan} onChange={(e) => setFuChan(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50">
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="call">Call</option>
              </select>
              <input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => saveFu(false)} disabled={fuBusy || !fuDate}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#FFD60A] px-3 py-1.5 text-[12px] font-semibold text-[#0A0E1A] hover:bg-[#ffdf3a] disabled:opacity-40 transition-colors">
                {fuBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />} Save reminder
              </button>
              {d.next?.next_touch_at && (
                <button onClick={() => saveFu(true)} disabled={fuBusy}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* REACH THEM — always visible so Jose can call / WhatsApp / LinkedIn / email right now */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold mb-2">Reach them</div>
        <ContactActions d={d} onChanged={() => reload(true)} />
      </div>

      {/* BUILD — compact status + open; generate/optimize behind a toggle */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold">Build</span>
          <button onClick={() => setTools((v) => !v)} className="ml-auto text-[11px] text-muted-foreground hover:text-[#FFD60A]">
            {tools ? "Hide" : d.build_url ? "Manage" : "Generate"}
          </button>
        </div>
        {build ? (
          <div className="flex items-center gap-2 text-[12px]">
            <span style={{ color: build.c }}>● {build.t}</span>
            {d.build_slug && <span className="text-muted-foreground/70 truncate">/{d.build_slug}</span>}
            {d.build_url && <a href={d.build_url} target="_blank" rel="noreferrer" className="ml-auto text-[#FFD60A] hover:underline shrink-0">Open</a>}
          </div>
        ) : (
          <div className="text-[12px] text-muted-foreground">No Build yet.</div>
        )}
        {tools && <div className="mt-3"><BuildCard d={d} onChanged={both} /></div>}
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold mb-2">Quick actions</div>
        <div className="flex flex-col gap-1.5">
          <button onClick={() => reload(true)}
            className="text-left text-[12.5px] rounded-lg border border-border bg-card px-3 py-2 text-foreground hover:border-[#FFD60A]/40 transition-colors inline-flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh intelligence
          </button>
          <button onClick={() => navigator.clipboard.writeText(d.email)}
            className="text-left text-[12.5px] rounded-lg border border-border bg-card px-3 py-2 text-foreground hover:border-[#FFD60A]/40 transition-colors inline-flex items-center gap-2">
            <Copy className="w-3.5 h-3.5" /> Copy email
          </button>
          <button onClick={() => setFuOpen(true)}
            className="text-left text-[12.5px] rounded-lg border border-border bg-card px-3 py-2 text-foreground hover:border-[#FFD60A]/40 transition-colors inline-flex items-center gap-2">
            <CalendarClock className="w-3.5 h-3.5" /> Set follow-up
          </button>
        </div>
      </div>
    </div>
  );
}

// The 3-column workspace. useComposer lives here so the centre Composer and the right-rail
// Copilot share one draft. Keyed by prospect id so switching cards resets the draft.
function RecordBody({ d, id, themName, reload, both }: { d: Detail; id: number; themName: string; reload: (f?: boolean) => void; both: () => void }) {
  const c = useComposer(d, both);
  const a = actNow(d);
  const tone = a.tone === "green" ? "border-[#5fe08a]/40 bg-[#22c55e]/8 text-[#5fe08a]"
    : a.tone === "gold" ? "border-[#FFD60A]/40 bg-[#FFD60A]/8 text-[#FFD60A]" : "border-border bg-card text-foreground";
  return (
    <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-[23%_1fr_30%]">
      {/* LEFT rail */}
      <div className="lg:overflow-y-auto p-4 lg:p-5 lg:border-r border-border">
        <DealRail d={d} both={both} reload={reload} />
      </div>

      {/* CENTER: what-to-do banner + conversation hero + docked composer */}
      <div className="flex flex-col lg:min-h-0 lg:border-r border-border">
        <div className="flex-1 lg:min-h-0 lg:overflow-y-auto p-4 lg:p-5 space-y-3">
          <div className={`rounded-xl border px-3.5 py-2.5 ${tone}`}>
            <div className="flex items-center gap-2 text-sm font-semibold"><Zap className="w-4 h-4" /> {a.title}</div>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">{a.detail}</p>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">// CONVERSATION · NEWEST_FIRST</div>
          <Conversation id={id} themName={themName} fallback={d.reply_text} />
        </div>
        <div className="shrink-0 p-4 lg:p-5 border-t border-border">
          <Composer c={c} />
        </div>
      </div>

      {/* RIGHT: intelligence + copilot */}
      <div className="lg:overflow-y-auto p-4 lg:p-5 space-y-4">
        <IntelPanel d={d} />
        <Copilot c={c} />
      </div>
    </div>
  );
}

const STAGES: { key: string; label: string }[] = [
  { key: "new_reply", label: "New reply" },
  { key: "in_conversation", label: "In conversation" },
  { key: "discovery_booked", label: "Discovery booked" },
  { key: "proposal_sent", label: "Proposal sent" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost / Parked" },
];

// Stage selector in the card header — advances the prospect along the funnel via the same
// endpoint as dragging on the board, so a deal moves without leaving the card. Picking
// "Discovery booked" or "Won" also marks the meeting booked server-side (status stays in sync).
function StageMenu({ d, onChanged }: { d: Detail; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cur = STAGES.find((s) => s.key === d.stage) || STAGES[0];
  const pick = (key: string) => {
    setOpen(false);
    if (key === d.stage) return;
    setBusy(true);
    fetch(`${API}/api/crm/prospect/${d.id}/stage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: key }),
    }).then((r) => { if (r.ok) onChanged(); }).finally(() => setBusy(false));
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-[#26D07C]/40 bg-[#22c55e]/10 px-3 py-2 text-sm font-medium text-[#5fe08a] hover:bg-[#22c55e]/15 disabled:opacity-40 transition-colors">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
        {cur.label}
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-52 rounded-lg border border-border bg-popover shadow-xl z-20 py-1">
            {STAGES.map((s) => (
              <button key={s.key} onClick={() => pick(s.key)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${s.key === d.stage ? "text-[#FFD60A]" : "text-foreground"}`}>
                <span className="inline-block w-3">{s.key === d.stage ? "●" : ""}</span> {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Record({ id, initial, onClose, onChanged }: { id: number; initial?: Card; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [themName, setThemName] = useState(initial?.name?.trim().split(/\s+/)[0] || "Them");
  const [loading, setLoading] = useState(true);

  const reload = useCallback((force = false) => {
    setLoading(true);
    loadDetail(id, force).then((j) => setD(j)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { reload(); }, [id, reload]);
  useEffect(() => {
    fetch(`${API}/api/crm/prospect/${id}/thread`).then((r) => r.json())
      .then((j) => setThemName(j.them_name || "Them")).catch(() => {});
  }, [id]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const both = () => { reload(true); onChanged(); };

  const head = d ?? initial;
  const h = head ? heatChip(head.heat) : null;
  const headDomain = head ? domainOf(head.email) : "";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative m-auto w-full h-full lg:h-[94vh] lg:my-[3vh] max-w-[1600px] bg-popover border border-border lg:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* header */}
        <div className="shrink-0 border-b border-border px-5 py-3.5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg grid place-items-center text-sm font-bold shrink-0 bg-[#26D07C]/12 text-[#26D07C] border border-[#26D07C]/30">
              {initials(head?.name || "?")}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-foreground truncate">{head?.name || "…"}</h2>
                {h && <Badge text={h.hot ? "🔥 Hot" : h.label} className={h.cls} />}
                {head?.category && <Badge text={head.category} className="bg-[#FFD60A]/12 text-[#FFD60A]" />}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate flex items-center gap-1.5">
                {headDomain && <Favicon domain={headDomain} label={head?.company} size={16} />}
                <span className="truncate">{head?.job_title ? `${head.job_title} · ` : ""}{head?.company}{head?.country ? ` · ${head.country}` : ""}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {d && <StageMenu d={d} onChanged={both} />}
            <button onClick={onClose} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading && !d ? (
          <div className="p-6 text-muted-foreground text-sm">Loading…</div>
        ) : d ? (
          <RecordBody key={id} d={d} id={id} themName={themName} reload={reload} both={both} />
        ) : (
          <div className="p-6 text-muted-foreground text-sm">Could not load this prospect.</div>
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
    <tr onClick={() => onOpen(r.id)} onMouseEnter={() => loadDetail(r.id)}
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
      onMouseEnter={() => loadDetail(r.id)}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(r.id))}
      className={`w-full text-left bg-card border border-border rounded-xl p-3 hover:border-[#FFD60A]/50 transition-colors ${rotEdge(r)}`}>
      {/* person → title → company (with its logo), heat on the right */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* 1 · person name */}
          <div className="font-semibold text-foreground text-sm truncate flex items-center gap-1.5">
            {r.wants_meeting && r.waiting_on !== "closed" && <span className="text-[11px]" title="Asked to meet">📅</span>}{r.name}
          </div>
          {/* 2 · their title */}
          {r.job_title && <div className="text-[11px] text-muted-foreground/90 truncate mt-0.5">{r.job_title}</div>}
          {/* 3 · company + logo */}
          <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
            {domainOf(r.email) && <Favicon domain={domainOf(r.email)} label={r.company} size={14} />}
            <span className="truncate">{r.company || r.email}</span>
          </div>
        </div>
        {r.waiting_on !== "closed" && (
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${h.cls}`} title={`Heat ${r.heat}${r.heat_reason ? " · " + r.heat_reason : ""}`}>
            {h.hot && <Flame className="w-2.5 h-2.5" />}{r.heat}
          </span>
        )}
      </div>

      {/* their actual words — the context that makes this a cockpit, not a list */}
      {cleanSnippet(r.reply_snippet) && (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground/90 line-clamp-2 border-l-2 border-[#FFD60A]/25 pl-2">
          {cleanSnippet(r.reply_snippet)}
        </p>
      )}

      {/* footer: category · country · clock · build · assets */}
      <div className="flex items-center gap-1.5 mt-2.5 text-[10px]">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-medium ${cat.cls}`}>{cat.label}</span>
        {r.country && <span className="text-muted-foreground/70 truncate max-w-[5rem]">{r.country}</span>}
        <span className={`ml-auto tabular-nums ${clock.cls}`}>{clock.text}</span>
        {(r.build_delivered || r.has_build) && (
          <span title={r.build_delivered ? "Build delivered — the prospect got their lead magnet" : "Build ready — not sent yet"}
            className={`inline-block w-1.5 h-1.5 rounded-full ${r.build_delivered ? "bg-[#26D07C]" : "bg-[#FFD60A]"}`} />
        )}
        {r.has_phone && <span title="Phone on file — you can call / WhatsApp" className="text-muted-foreground/60">☎</span>}
        {r.has_linkedin && <span title="LinkedIn on file — you can view the profile / connect" className="text-[#5fd0e0]/70 font-semibold">in</span>}
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
      className={`shrink-0 w-[19rem] rounded-xl p-2 transition-colors ${over ? ring : "bg-card/30"}`}>
      <div className="px-2 py-1.5 mb-1 border-b border-border/60">
        <div className="flex items-center gap-2">
          <h3 className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-[#FFD60A]" : tone === "green" ? "text-[#5fe08a]" : "text-foreground"}`}>{title}</h3>
          <span className="text-xs text-muted-foreground tabular-nums ml-auto">{rows.length}</span>
        </div>
        {hint && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>}
      </div>
      <div className="space-y-2 max-h-[calc(100vh-13rem)] overflow-y-auto pr-1 pt-1">
        {rows.map((r) => <BoardCard key={r.id} r={r} onOpen={onOpen} />)}
        {rows.length === 0 && <div className="text-[11px] text-muted-foreground/50 px-2 py-6 text-center border border-dashed border-border/50 rounded-lg">drop here</div>}
      </div>
    </div>
  );
}

// The funnel = our lead journey, in order. Each column is a stage; drag a card right as
// the deal advances. Kept in sync with the backend FUNNEL_STAGES.
// Per-column sort — the controls a VP actually works a pipeline by.
type SortKey = "heat" | "stalled" | "value" | "recent" | "name";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "heat", label: "🔥 Priority (hottest)" },
  { key: "stalled", label: "🕒 Most stalled" },
  { key: "value", label: "⭐ Best fit (Positive/SQL)" },
  { key: "recent", label: "⚡ Recently active" },
  { key: "name", label: "A–Z name" },
];
function catRank(cat: string): number {
  const c = (cat || "").toLowerCase();
  if (c.includes("positive") || c.includes("sql")) return 3;
  if (c.includes("mql")) return 2;
  if (c.includes("neg") || c.includes("not")) return 0;
  return 1;
}
// The tiles double as board filters — click "Hot now" and the whole pipeline narrows to hot
// cards, click again to clear. null = no filter (show everything).
type BoardFilter = null | "us" | "hot" | "wants" | "them" | "meetings";
const FILTER_LABEL: Record<Exclude<BoardFilter, null>, string> = {
  us: "⚡ Your turn", hot: "🔥 Hot now", wants: "📅 Want to meet",
  them: "Waiting on them", meetings: "Meetings booked",
};
function passesFilter(c: Card, f: BoardFilter): boolean {
  switch (f) {
    case "us": return c.waiting_on === "us";
    case "hot": return c.heat >= 70;
    case "wants": return c.wants_meeting;
    case "them": return c.waiting_on === "them";
    case "meetings": return c.status === "meeting_booked";
    default: return true;
  }
}
function matchQuery(c: Card, q: string): boolean {
  if (!q.trim()) return true;
  const t = q.toLowerCase();
  return c.name.toLowerCase().includes(t) || c.company.toLowerCase().includes(t) || c.email.toLowerCase().includes(t);
}
function sortCards(list: Card[], by: SortKey): Card[] {
  const ms = (s: string | null) => (s ? new Date(s).getTime() : 0);
  const r = [...list];
  switch (by) {
    case "stalled": // oldest last activity first (deals rotting at the top)
      return r.sort((a, b) => (ms(a.last_touch_at) || ms(a.last_reply_at)) - (ms(b.last_touch_at) || ms(b.last_reply_at)));
    case "value":
      return r.sort((a, b) => catRank(b.category) - catRank(a.category) || b.heat - a.heat);
    case "recent":
      return r.sort((a, b) => Math.max(ms(b.last_reply_at), ms(b.last_touch_at)) - Math.max(ms(a.last_reply_at), ms(a.last_touch_at)));
    case "name":
      return r.sort((a, b) => a.name.localeCompare(b.name));
    default: // heat
      return r.sort((a, b) => b.heat - a.heat || ms(a.last_reply_at) - ms(b.last_reply_at));
  }
}

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
  const [filter, setFilter] = useState<BoardFilter>(null);
  const [view, setView] = useState<"queue" | "board">("board");
  const [sortBy, setSortBy] = useState<SortKey>("heat");
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
    const r = rows.filter((x) => matchQuery(x, q) && passesFilter(x, filter));
    const ms = (s: string | null) => (s ? new Date(s).getTime() : 0);
    // Hottest first: heat desc, then most-overdue.
    const us = r.filter((x) => x.waiting_on === "us").sort((a, b) => b.heat - a.heat || ms(a.last_reply_at) - ms(b.last_reply_at));
    const them = r.filter((x) => x.waiting_on === "them").sort((a, b) => ms(a.next_touch_at) - ms(b.next_touch_at));
    const closed = r.filter((x) => x.waiting_on === "closed");
    return { us, them, closed };
  }, [rows, q, filter]);

  return (
    <div className="max-w-[1760px] mx-auto">
      {/* one compact command bar: identity · search · view · sort · refresh */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-xl font-bold neon tracking-tight mr-1 shrink-0">// LUXVANCE_CRM</h1>
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email…"
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50" />
        </div>
        <div className="flex items-center bg-card border border-border rounded-lg p-0.5 shrink-0">
          <button onClick={() => setView("board")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "board" ? "bg-[#FFD60A]/12 text-[#FFD60A]" : "text-muted-foreground"}`}>
            <LayoutGrid className="w-4 h-4" /> Board
          </button>
          <button onClick={() => setView("queue")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "queue" ? "bg-[#FFD60A]/12 text-[#FFD60A]" : "text-muted-foreground"}`}>
            <List className="w-4 h-4" /> Queue
          </button>
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
          title="Sort each column"
          className="bg-card border border-border rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/40 cursor-pointer shrink-0">
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <button onClick={load} title="Refresh" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-2 py-1.5 shrink-0">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <Briefing onOpen={openRecord} />

      {/* the tiles ARE the filters: click to narrow the pipeline, click again to clear */}
      {funnel && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Tile label="⚡ Your turn" value={funnel.waiting_us} accent active={filter === "us"} onClick={() => setFilter((f) => (f === "us" ? null : "us"))} />
          <Tile label="Hot now" value={funnel.hot_now} icon={<Flame className="w-4 h-4 text-[#ff9b9b]" />} active={filter === "hot"} onClick={() => setFilter((f) => (f === "hot" ? null : "hot"))} />
          <Tile label="Want to meet" value={funnel.wants_meeting} active={filter === "wants"} onClick={() => setFilter((f) => (f === "wants" ? null : "wants"))} />
          <Tile label="Waiting on them" value={funnel.waiting_them} active={filter === "them"} onClick={() => setFilter((f) => (f === "them" ? null : "them"))} />
          <Tile label="Meetings" value={funnel.by_status?.meeting_booked?.count || 0} active={filter === "meetings"} onClick={() => setFilter((f) => (f === "meetings" ? null : "meetings"))} />
        </div>
      )}

      {/* active-filter chip, so it's obvious the pipeline is narrowed + how to clear it */}
      {filter && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <span className="text-muted-foreground">Filtered:</span>
          <button onClick={() => setFilter(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD60A]/10 border border-[#FFD60A]/40 text-[#FFD60A] px-2.5 py-1 font-medium hover:bg-[#FFD60A]/15 transition-colors">
            {FILTER_LABEL[filter]} <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-16">Loading…</div>
      ) : view === "queue" ? (
        <>
          {groups.us.length > 0 && <PipelineSection title="// YOUR_TURN" hint="they replied, the ball is with us · hottest first" rows={groups.us} onOpen={openRecord} accent />}
          {groups.them.length > 0 && <PipelineSection title="// WAITING_ON_THEM" hint="we replied last" rows={groups.them} onOpen={openRecord} />}
          {groups.closed.length > 0 && <PipelineSection title="// BOOKED_&_CLOSED" rows={groups.closed} onOpen={openRecord} />}
          {groups.us.length === 0 && groups.them.length === 0 && groups.closed.length === 0 && (
            <div className="text-center text-muted-foreground py-16">No prospects match.</div>
          )}
        </>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {FUNNEL.map((s) => {
            const col = sortCards(rows.filter((x) => matchQuery(x, q) && passesFilter(x, filter) && (x.stage || "new_reply") === s.key), sortBy);
            return (
              <BoardColumn key={s.key} title={s.title} hint={s.hint} tone={s.tone}
                accent={s.key === "new_reply"} rows={col} onOpen={openRecord}
                onDrop={(id) => moveStage(id, s.key)} />
            );
          })}
        </div>
      )}

      {openId !== null && <Record id={openId} initial={rows.find((r) => r.id === openId)} onClose={() => openRecord(null)} onChanged={load} />}
    </div>
  );
}
