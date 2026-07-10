"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  X, Mail, Link2, MessageCircle, ExternalLink, Copy, Check,
  Search, RefreshCw, CalendarClock, Sparkles, Send, PenLine, Loader2,
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
  next_channel: string | null;
  next_touch_at: string | null;
  last_channel: string | null;
  last_touch_at: string | null;
  has_build: boolean;
  build_url: string;
  build_status: string | null;
  has_phone: boolean;
  has_linkedin: boolean;
  reply_snippet: string;
  last_reply_at: string | null;
  waiting_on: "us" | "them" | "closed";
  wants_meeting: boolean;
};

type Funnel = {
  total: number;
  with_build: number;
  due_now: number;
  waiting_us: number;
  waiting_them: number;
  wants_meeting: number;
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
  build_published: boolean;
  live_channel: string;
  reply_campaign: string;
  notes: string;
  next: {
    next_step: number | null;
    next_channel: string | null;
    next_goal: string | null;
    next_touch_at: string | null;
  };
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

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}>
      {text}
    </span>
  );
}

function CopyBtn({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      title="Copy"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-[#5fe08a]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── stat tile ───────────────────────────────────────────────────────
function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`bg-card rounded-xl px-5 py-4 border ${accent && value > 0 ? "border-[#FFD60A]/40" : "border-border"}`}>
      <div className={`text-2xl font-semibold tabular-nums ${accent && value > 0 ? "text-[#FFD60A]" : "text-foreground"}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

// ── detail drawer ───────────────────────────────────────────────────
function Drawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged?: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [booked, setBooked] = useState(false);
  const [booking, setBooking] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildErr, setBuildErr] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    setLoading(true); setBooked(false);
    setBrief(null); setBuilding(false); setBuildErr(null);
    fetch(`${API}/api/crm/prospect/${id}`)
      .then((r) => r.json())
      .then((j) => { setD(j); setBooked(j.status === "meeting_booked"); setBuilding(j.build_status === "building"); })
      .catch(() => setD(null))
      .finally(() => setLoading(false));
  }, [id]);

  const markBooked = () => {
    setBooking(true);
    fetch(`${API}/api/crm/prospect/${id}/book`, { method: "POST" })
      .then((r) => { if (r.ok) { setBooked(true); onChanged?.(); } })
      .finally(() => setBooking(false));
  };

  const getBrief = () => {
    setBriefLoading(true); setBuildErr(null);
    fetch(`${API}/api/crm/prospect/${id}/build-brief`)
      .then((r) => r.json())
      .then((j) => setBrief(j.instructions || ""))
      .catch(() => setBrief(""))
      .finally(() => setBriefLoading(false));
  };

  const pollBuild = () => {
    if (!alive.current) return;
    fetch(`${API}/api/crm/prospect/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive.current) return;
        if (j.build_url) { setD(j); setBuilding(false); onChanged?.(); }
        else if (j.build_status === "error") { setBuilding(false); setBuildErr("Build failed. Check credits or niche coverage, then retry."); }
        else setTimeout(pollBuild, 6000);
      })
      .catch(() => { if (alive.current) setTimeout(pollBuild, 8000); });
  };

  const startBuild = () => {
    setBuilding(true); setBuildErr(null); setBrief(null);
    fetch(`${API}/api/crm/prospect/${id}/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions: brief || "" }),
    })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); setTimeout(pollBuild, 6000); })
      .catch(() => { setBuilding(false); setBuildErr("Could not start the Build."); });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-popover border-l border-border overflow-y-auto">
        <div className="sticky top-0 bg-popover/95 backdrop-blur border-b border-border px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{d?.name || "…"}</h2>
            <p className="text-sm text-muted-foreground">
              {d?.job_title ? `${d.job_title} · ` : ""}{d?.company}{d?.country ? ` · ${d.country}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !d ? (
          <div className="p-6 text-muted-foreground text-sm">Loading…</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* stage */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge text={d.status_label} className="bg-secondary text-secondary-foreground" />
              <Badge text={d.stage_label} className="bg-secondary text-secondary-foreground" />
              {d.category && <Badge text={d.category} className="bg-[#FFD60A]/12 text-[#FFD60A]" />}
              {d.wants_meeting && <Badge text="📅 wants to meet" className="bg-[#22c55e]/15 text-[#5fe08a]" />}
            </div>

            {/* booking control */}
            {booked ? (
              <div className="flex items-center gap-2 rounded-xl border border-[#5fe08a]/40 bg-[#22c55e]/10 px-4 py-3 text-sm text-[#5fe08a]">
                <CalendarClock className="w-4 h-4" /> Meeting booked. Out of the follow-up queue.
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={markBooked}
                  disabled={booking}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#5fe08a]/40 bg-[#22c55e]/10 px-4 py-2 text-sm font-medium text-[#5fe08a] hover:bg-[#22c55e]/15 disabled:opacity-40 transition-colors"
                >
                  {booking ? <><Loader2 className="w-4 h-4 animate-spin" /> Marking…</> : <><CalendarClock className="w-4 h-4" /> Mark as booked</>}
                </button>
                <span className="text-xs text-muted-foreground">once the call is set</span>
              </div>
            )}

            {/* next touch */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <CalendarClock className="w-4 h-4 text-[#FFD60A]" /> Next touch
              </div>
              {d.next.next_channel ? (
                <div className="text-sm text-muted-foreground">
                  <span className="capitalize text-foreground">{d.next.next_channel}</span>
                  {" · "}
                  <span className={isDue(d.next.next_touch_at) ? "text-[#FFD60A]" : ""}>
                    {isDue(d.next.next_touch_at) ? "due now" : fmtDate(d.next.next_touch_at)}
                  </span>
                  {d.next.next_goal && <p className="mt-1 italic">{d.next.next_goal}</p>}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sequence complete.</div>
              )}
            </div>

            {/* conversation thread (live from Instantly) */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Conversation</div>
              <Conversation id={id} fallback={d.reply_text} />
            </div>

            {/* build */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Their Build</div>
              {d.build_url ? (
                <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-[#FFD60A]" />
                    <span className={d.build_published ? "text-[#5fe08a]" : "text-[#ef4444]"}>
                      {d.build_published ? "Published" : "NOT resolving"}
                    </span>
                  </div>
                  <a href={d.build_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-[#FFD60A] hover:underline">
                    Open <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : building ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#FFD60A]/30 bg-[#FFD60A]/8 px-4 py-3 text-sm text-[#FFD60A]">
                  <Loader2 className="w-4 h-4 animate-spin" /> Building… sourcing ~50 real leads + copy (about a minute). You can keep working.
                </div>
              ) : brief !== null ? (
                <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="text-xs text-muted-foreground">Build brief from the conversation. Edit if needed, then build.</div>
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={Math.min(14, Math.max(5, brief.split("\n").length + 1))}
                    className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50 resize-y"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={startBuild}
                      disabled={!brief.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:bg-[#ffdf3a] disabled:opacity-40 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" /> Generate Build
                    </button>
                    <button
                      onClick={() => setBrief(null)}
                      className="text-sm text-muted-foreground hover:text-foreground px-2 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={getBrief}
                    disabled={briefLoading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFD60A]/40 bg-[#FFD60A]/10 px-4 py-3 text-sm font-medium text-[#FFD60A] hover:bg-[#FFD60A]/15 disabled:opacity-40 transition-colors"
                  >
                    {briefLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Reading the conversation…</>
                      : <><Sparkles className="w-4 h-4" /> Build with context</>}
                  </button>
                  {buildErr && <div className="text-xs text-[#ef4444]">{buildErr}</div>}
                </div>
              )}
            </div>

            {/* per-channel reply areas */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reply</div>
              <div className="space-y-3">
                <ChannelBlock
                  id={id} channel="email"
                  title="Email · Instantly" icon={<Mail className="w-4 h-4" />}
                  contactLabel={d.email} contactHref={`mailto:${d.email}`} contactCopy={d.email}
                />
                <ChannelBlock
                  id={id} channel="linkedin"
                  title="LinkedIn" icon={<Link2 className="w-4 h-4" />}
                  contactLabel={d.linkedin_url ? "LinkedIn profile" : undefined}
                  contactHref={d.linkedin_url || undefined}
                  contactCopy={d.linkedin_url || undefined}
                  missingNote={d.linkedin_url ? undefined : "No LinkedIn URL on file."}
                />
                <ChannelBlock
                  id={id} channel="whatsapp"
                  title="Phone · WhatsApp · SMS" icon={<MessageCircle className="w-4 h-4" />}
                  contactLabel={d.phone || undefined}
                  contactHref={d.phone ? (d.wa_link || `tel:${d.phone}`) : undefined}
                  contactCopy={d.phone || undefined}
                  missingNote={d.phone ? undefined : "No phone on file. Get phone number is coming soon (Clay)."}
                />
              </div>
            </div>

            {/* footer note */}
            <div className="text-xs text-muted-foreground border-t border-border pt-4">
              {d.live_channel === "gmail"
                ? "Live thread is on Gmail (jose@luxvance.com). Reply from your inbox, not the burner."
                : "Email sends go on-thread via Instantly. LinkedIn and WhatsApp are copy-and-send by hand. Nothing sends until you click."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── conversation thread ─────────────────────────────────────────────
type ThreadMsg = { from_me: boolean; at: string | null; subject: string; text: string };

function Conversation({ id, fallback }: { id: number; fallback?: string }) {
  const [msgs, setMsgs] = useState<ThreadMsg[] | null>(null);
  useEffect(() => {
    setMsgs(null);
    fetch(`${API}/api/crm/prospect/${id}/thread`)
      .then((r) => r.json())
      .then((j) => setMsgs(j.messages || []))
      .catch(() => setMsgs([]));
  }, [id]);

  if (msgs === null) {
    return <div className="text-sm text-muted-foreground">Loading conversation…</div>;
  }
  if (msgs.length === 0) {
    return fallback
      ? (
        <div className="bg-card border border-border rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap max-h-56 overflow-y-auto">
          {fallback}
        </div>
      )
      : <div className="text-sm text-muted-foreground">No email thread found in Instantly.</div>;
  }
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {msgs.map((m, i) => (
        <div key={i}
          className={`rounded-xl p-3 text-sm border ${m.from_me
            ? "bg-[#FFD60A]/8 border-[#FFD60A]/25 ml-5"
            : "bg-card border-border mr-5"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-semibold ${m.from_me ? "text-[#FFD60A]" : "text-muted-foreground"}`}>
              {m.from_me ? "Luxvance" : "Them"}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">{fmtDate(m.at)}</span>
          </div>
          <div className="text-foreground whitespace-pre-wrap leading-relaxed">{m.text}</div>
        </div>
      ))}
    </div>
  );
}

// ── per-channel reply area (own draft + send/copy state) ─────────────
type DraftResp = { channel: string; step: number; goal: string; draft: string; can_send: boolean; gmail_live: boolean };

function ChannelBlock({
  id, channel, title, icon, contactLabel, contactHref, contactCopy, missingNote,
}: {
  id: number;
  channel: "email" | "linkedin" | "whatsapp";
  title: string;
  icon: ReactNode;
  contactLabel?: string;
  contactHref?: string;
  contactCopy?: string;
  missingNote?: string;
}) {
  const [draft, setDraft] = useState<DraftResp | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const gen = (intent?: "book") => {
    setDrafting(true); setSent(null);
    const q = intent ? `?channel=${channel}&intent=${intent}` : `?channel=${channel}`;
    fetch(`${API}/api/crm/prospect/${id}/draft${q}`)
      .then((r) => r.json())
      .then((j) => { setDraft(j); setText(j.draft || ""); })
      .catch(() => setDraft(null))
      .finally(() => setDrafting(false));
  };

  const send = () => {
    setSending(true);
    fetch(`${API}/api/crm/prospect/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, channel: "email" }),
    })
      .then(async (r) => {
        if (r.ok) setSent("ok");
        else { const e = await r.json().catch(() => ({})); setSent("err:" + (e.detail || r.status)); }
      })
      .catch((e) => setSent("err:" + e))
      .finally(() => setSending(false));
  };

  const draftLabel = channel === "email" ? "Draft email" : channel === "linkedin" ? "Draft LinkedIn message" : "Draft WhatsApp text";

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[#FFD60A]">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>

      {contactLabel ? (
        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
          {contactHref ? (
            <a href={contactHref} target="_blank" rel="noreferrer" className="flex-1 text-sm text-foreground hover:text-[#FFD60A] truncate">{contactLabel}</a>
          ) : (
            <span className="flex-1 text-sm text-foreground truncate">{contactLabel}</span>
          )}
          {contactCopy && <CopyBtn value={contactCopy} />}
        </div>
      ) : missingNote ? (
        <div className="text-xs text-muted-foreground">{missingNote}</div>
      ) : null}

      {!draft ? (
        <div className="flex gap-2">
          <button
            onClick={() => gen()}
            disabled={drafting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-[#FFD60A]/40 bg-[#FFD60A]/10 px-3 py-2 text-sm font-medium text-[#FFD60A] hover:bg-[#FFD60A]/15 disabled:opacity-40 transition-colors"
          >
            {drafting ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing…</> : <><PenLine className="w-4 h-4" /> {draftLabel}</>}
          </button>
          {channel === "email" && (
            <button
              onClick={() => gen("book")}
              disabled={drafting}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#5fe08a]/40 bg-[#22c55e]/10 px-3 py-2 text-sm font-medium text-[#5fe08a] hover:bg-[#22c55e]/15 disabled:opacity-40 transition-colors"
              title="Draft a booking message with the calendar link"
            >
              <CalendarClock className="w-4 h-4" /> Book
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={Math.min(14, Math.max(4, text.split("\n").length + 1))}
            className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50 resize-y"
          />
          {sent === "ok" ? (
            <div className="flex items-center gap-2 text-sm text-[#5fe08a]">
              <Check className="w-4 h-4" /> Sent on-thread via Instantly. Cadence advanced.
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {channel === "email" && draft.can_send ? (
                <button
                  onClick={send}
                  disabled={sending || !text.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:bg-[#ffdf3a] disabled:opacity-40 transition-colors"
                >
                  {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send via Instantly</>}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground flex-1 min-w-[8rem]">
                  {channel === "email"
                    ? (draft.gmail_live ? "Live thread is Gmail. Send from jose@luxvance.com." : "No Instantly thread. Copy and send by hand.")
                    : "Copy and send by hand."}
                </span>
              )}
              <button
                onClick={() => { navigator.clipboard.writeText(text); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <button
                onClick={() => gen()}
                disabled={drafting}
                title="Redraft"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${drafting ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}
          {sent?.startsWith("err:") && <div className="text-xs text-[#ef4444]">Send failed: {sent.slice(4)}</div>}
        </div>
      )}
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────
export default function CrmPage() {
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [rows, setRows] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    fetch(`${API}/api/crm/prospects`)
      .then((r) => r.json())
      .then((j) => { setFunnel(j.funnel); setRows(j.prospects || []); })
      .catch(() => { setFunnel(null); setRows([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const groups = useMemo(() => {
    let r = rows;
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter((x) =>
        x.name.toLowerCase().includes(t) || x.company.toLowerCase().includes(t) || x.email.toLowerCase().includes(t));
    }
    const ms = (s: string | null) => (s ? new Date(s).getTime() : 0);
    const us = r.filter((x) => x.waiting_on === "us").sort((a, b) => {
      if (a.wants_meeting !== b.wants_meeting) return a.wants_meeting ? -1 : 1; // meeting-intent first
      return ms(a.last_reply_at) - ms(b.last_reply_at);                          // most overdue first
    });
    const them = r.filter((x) => x.waiting_on === "them")
      .sort((a, b) => ms(a.next_touch_at) - ms(b.next_touch_at));
    const closed = r.filter((x) => x.waiting_on === "closed");
    return { us, them, closed };
  }, [rows, q]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">Prospects who replied · work the queue, book the call</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* funnel tiles */}
      {funnel && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <button onClick={() => setOnlyMine((v) => !v)} className="text-left">
            <Tile label="⚡ Your turn" value={funnel.waiting_us} accent />
          </button>
          <Tile label="Want to meet" value={funnel.wants_meeting} />
          <Tile label="Waiting on them" value={funnel.waiting_them} />
          <Tile label="With Build" value={funnel.with_build} />
          <Tile label="Meetings" value={funnel.by_status?.meeting_booked?.count || 0} />
        </div>
      )}

      {/* controls */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, company, email…"
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50"
          />
        </div>
        <button
          onClick={() => setOnlyMine((v) => !v)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            onlyMine ? "bg-[#FFD60A]/10 text-[#FFD60A] border-[#FFD60A]/40" : "text-muted-foreground border-border hover:bg-secondary"
          }`}
        >
          Only your turn
        </button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-16">Loading…</div>
      ) : (
        <>
          <PipelineSection title="⚡ Your turn" hint="they replied, the ball is with us" rows={groups.us} onOpen={setOpenId} accent />
          {!onlyMine && <PipelineSection title="Waiting on them" hint="we replied last" rows={groups.them} onOpen={setOpenId} />}
          {!onlyMine && <PipelineSection title="Booked & closed" rows={groups.closed} onOpen={setOpenId} />}
          {groups.us.length === 0 && groups.them.length === 0 && groups.closed.length === 0 && (
            <div className="text-center text-muted-foreground py-16">No prospects.</div>
          )}
        </>
      )}

      {openId !== null && <Drawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

// ── pipeline section + row ──────────────────────────────────────────
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
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => <ProspectRow key={r.id} r={r} onOpen={onOpen} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProspectRow({ r, onOpen }: { r: Card; onOpen: (id: number) => void }) {
  const mine = r.waiting_on === "us";
  return (
    <tr onClick={() => onOpen(r.id)}
      className="border-b border-border/60 last:border-0 hover:bg-secondary/60 cursor-pointer">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground flex items-center gap-2">
          {r.name}
          {r.wants_meeting && r.waiting_on !== "closed" && <span className="text-[11px]" title="Wants to meet">📅</span>}
        </div>
        <div className="text-xs text-muted-foreground">{r.job_title ? `${r.job_title} · ` : ""}{r.company || r.email}</div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-[11px] text-muted-foreground">replied</div>
        <div className={`text-sm tabular-nums ${mine ? "text-[#FFD60A]" : "text-foreground"}`}>{timeAgo(r.last_reply_at)}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block w-2 h-2 rounded-full ${r.has_build ? "bg-[#5fe08a]" : "bg-muted-foreground/40"}`}
          title={r.has_build ? "Build ready" : "No Build"} />
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
        ) : (
          <span className="text-xs text-[#5fe08a]">booked</span>
        )}
      </td>
    </tr>
  );
}
