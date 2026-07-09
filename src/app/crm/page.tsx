"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  X, Mail, Link2, Phone, MessageCircle, ExternalLink, Copy, Check,
  Search, RefreshCw, CalendarClock, Sparkles,
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
  has_phone: boolean;
  has_linkedin: boolean;
  reply_snippet: string;
  last_reply_at: string | null;
};

type Funnel = {
  total: number;
  with_build: number;
  due_now: number;
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
const CHANNEL_STYLE: Record<string, string> = {
  email: "bg-[#FFD60A]/12 text-[#FFD60A]",
  linkedin: "bg-[#3b82f6]/15 text-[#7cb0ff]",
  whatsapp: "bg-[#22c55e]/15 text-[#5fe08a]",
  call: "bg-[#a78bfa]/15 text-[#c4b1ff]",
};

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
function Drawer({ id, onClose }: { id: number; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/crm/prospect/${id}`)
      .then((r) => r.json())
      .then((j) => setD(j))
      .catch(() => setD(null))
      .finally(() => setLoading(false));
  }, [id]);

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
            </div>

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

            {/* their reply */}
            {d.reply_text && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">What they said</div>
                <div className="bg-card border border-border rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {d.reply_text}
                </div>
              </div>
            )}

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
              ) : (
                <div className="text-sm text-muted-foreground">No Build yet.</div>
              )}
            </div>

            {/* channels — copy-ready */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reach them</div>
              <div className="space-y-1.5">
                <ChannelRow icon={<Mail className="w-4 h-4" />} label={d.email}
                  open={`mailto:${d.email}`} copy={d.email} />
                {d.linkedin_url && (
                  <ChannelRow icon={<Link2 className="w-4 h-4" />} label="LinkedIn profile"
                    open={d.linkedin_url} copy={d.linkedin_url} />
                )}
                {d.phone && (
                  <ChannelRow icon={<Phone className="w-4 h-4" />} label={d.phone}
                    open={`tel:${d.phone}`} copy={d.phone} />
                )}
                {d.wa_link && (
                  <ChannelRow icon={<MessageCircle className="w-4 h-4" />} label="WhatsApp"
                    open={d.wa_link} copy={d.phone} />
                )}
              </div>
            </div>

            {/* send note */}
            <div className="text-xs text-muted-foreground border-t border-border pt-4">
              {d.live_channel === "gmail"
                ? "Live thread is on Gmail (jose@luxvance.com). Reply from your inbox, not the burner."
                : "Approve and send the drafted follow-up from Slack. It replies on-thread via Instantly."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelRow({ icon, label, open, copy }: { icon: ReactNode; label: string; open: string; copy: string }) {
  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <a href={open} target="_blank" rel="noreferrer" className="flex-1 text-sm text-foreground hover:text-[#FFD60A] truncate">
        {label}
      </a>
      <CopyBtn value={copy} />
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────
export default function CrmPage() {
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [rows, setRows] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
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

  const filtered = useMemo(() => {
    let r = rows;
    if (dueOnly) r = r.filter((x) => x.status === "active" && isDue(x.next_touch_at));
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter((x) =>
        x.name.toLowerCase().includes(t) || x.company.toLowerCase().includes(t) || x.email.toLowerCase().includes(t));
    }
    return r;
  }, [rows, q, dueOnly]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">Prospects who replied · live follow-up pipeline</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* funnel tiles */}
      {funnel && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Tile label="Total prospects" value={funnel.total} />
          <button onClick={() => setDueOnly((v) => !v)} className="text-left">
            <Tile label="Due now" value={funnel.due_now} accent />
          </button>
          <Tile label="With Build" value={funnel.with_build} />
          <Tile label="In cadence" value={funnel.by_status?.active?.count || 0} />
          <Tile label="Meetings" value={funnel.by_status?.meeting_booked?.count || 0} />
        </div>
      )}

      {/* controls */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, company, email…"
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/50"
          />
        </div>
        <button
          onClick={() => setDueOnly((v) => !v)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            dueOnly ? "bg-[#FFD60A]/10 text-[#FFD60A] border-[#FFD60A]/40" : "text-muted-foreground border-border hover:bg-secondary"
          }`}
        >
          Due now
        </button>
        <span className="text-sm text-muted-foreground ml-auto tabular-nums">{filtered.length} shown</span>
      </div>

      {/* table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="px-4 py-3 font-medium">Prospect</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Next touch</th>
                <th className="px-4 py-3 font-medium">Build</th>
                <th className="px-4 py-3 font-medium">Last reply</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No prospects.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => setOpenId(r.id)}
                  className="border-b border-border/60 last:border-0 hover:bg-secondary/60 cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.company || r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.stage_label}</td>
                  <td className="px-4 py-3">
                    {r.next_channel ? (
                      <div className="flex items-center gap-2">
                        <Badge text={r.next_channel} className={`capitalize ${CHANNEL_STYLE[r.next_channel] || "bg-secondary text-secondary-foreground"}`} />
                        <span className={`text-xs ${isDue(r.next_touch_at) ? "text-[#FFD60A]" : "text-muted-foreground"}`}>
                          {isDue(r.next_touch_at) ? "due" : fmtDate(r.next_touch_at)}
                        </span>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${r.has_build ? "bg-[#5fe08a]" : "bg-muted-foreground/40"}`} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{fmtDate(r.last_reply_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openId !== null && <Drawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
