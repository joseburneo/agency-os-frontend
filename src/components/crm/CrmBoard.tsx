"use client";

import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  X, Link2, MessageCircle, Phone, ExternalLink, Copy, Check,
  Search, RefreshCw, CalendarClock, Sparkles, Send, PenLine, Loader2,
  Flame, LayoutGrid, List, Bot, ChevronRight, Zap, Mail, Magnet, Globe, Plus, MapPin, Building2, Briefcase,
  PhoneCall, PhoneOff, Mic, MicOff, Smartphone, AlertTriangle,
} from "lucide-react";
import DOMPurify from "dompurify";
import { useSoftphone, fmtDuration, type CallMode } from "./useSoftphone";

// Same-origin: every /api/crm/* call goes through src/app/api/crm/[...path], which
// authenticates the session, pins a client to its own workspace, and injects the
// backend key server-side. The browser must never hold that key or reach Render
// directly — that is exactly what left the whole CRM open to the internet.
const API = "";

// Whether this session may generate a Build (the personalized lead magnet).
// AGENCY ONLY. A Build publishes a LUXVANCE-branded workspace at
// app.luxvance.com/w/<slug> and spends Luxvance's Clay + OpenAI credits, so a
// client generating one would hand their own prospect a demo of an agency that
// prospect has never heard of (Jose, 2026-08-08). Personalized lead magnets are
// a paid upgrade: when a client buys it, unlock that workspace on the BACKEND
// (MAGNET_UPGRADE_WORKSPACES) — this context only decides whether to draw the
// buttons, and hiding a button is not a permission.
// Default false so any future caller that forgets the prop fails CLOSED.
const CanBuildCtx = createContext(false);

// ── types ───────────────────────────────────────────────────────────
type Card = {
  id: number;
  email: string;
  name: string;
  company: string;
  job_title: string;
  country: string;
  industry?: string;
  company_country?: string;
  domain?: string;
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
  gone_quiet_days: number;
  waiting_on: "us" | "them" | "closed";
  wants_meeting: boolean;
  heat: number;
  heat_reason: string;
  deal_amount?: number | null;
  phone?: string;
  linkedin_url?: string;
  call_at?: string | null;
  call_held_at?: string | null;
  last_email_touch_at?: string | null;
};

// Country → emoji flag. Values may be "Ireland" or "Dublin, County Dublin, Ireland":
// match on the LAST comma segment. Unknown countries simply render without a flag.
const FLAG_ISO: Record<string, string> = {
  "united arab emirates": "AE", ireland: "IE", "united kingdom": "GB", "united states": "US",
  spain: "ES", germany: "DE", switzerland: "CH", india: "IN", singapore: "SG", lebanon: "LB",
  jordan: "JO", canada: "CA", philippines: "PH", france: "FR", italy: "IT", sweden: "SE",
  "sierra leone": "SL", finland: "FI", estonia: "EE", australia: "AU", kuwait: "KW",
  "south africa": "ZA", netherlands: "NL", "saudi arabia": "SA",
  israel: "IL", portugal: "PT", greece: "GR", egypt: "EG", qatar: "QA", bahrain: "BH",
  oman: "OM", kenya: "KE", nigeria: "NG", brazil: "BR", mexico: "MX", ecuador: "EC",
  "czech republic": "CZ", czechia: "CZ", poland: "PL", denmark: "DK", norway: "NO",
  austria: "AT", belgium: "BE", serbia: "RS", "united states of america": "US",
};
function countryFlag(country?: string | null): string {
  if (!country) return "";
  const last = country.split(",").pop()?.trim().toLowerCase() || "";
  const iso = FLAG_ISO[last] || (last.length === 2 ? last.toUpperCase() : "");
  if (!/^[A-Z]{2}$/.test(iso)) return "";
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

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
  contacts: { email: string; first_seen_at?: string }[];
  build_slug: string | null;
  build_name: string;
  build_audience: string;
  build_leads: number;
  build_published: boolean;
  build_first_opened_at: string | null;
  build_last_opened_at: string | null;
  build_open_count: number;
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
  // The copilot conversation, restored with the card (engaged_prospects.copilot_chat).
  copilot_chat?: { role: "you" | "copilot"; content: string; mode?: string; options?: string[]; hasDraft?: boolean }[];
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

// Quick follow-up presets → local yyyy-mm-dd (timezone-safe, no UTC slice drift).
function presetDate(off: number | "mon"): string {
  const d = new Date();
  if (off === "mon") { const add = ((8 - d.getDay()) % 7) || 7; d.setDate(d.getDate() + add); }
  else d.setDate(d.getDate() + off);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
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

// Compact "3d" / "5h" (no "ago") for the two-sided timing pulse on tiles.
function agoShort(s?: string | null): string {
  if (!s) return "—";
  const t = new Date(s).getTime();
  if (isNaN(t)) return "—";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function chLabel(c?: string | null): string {
  const x = (c || "").toLowerCase();
  return x === "linkedin" ? "LinkedIn" : x === "whatsapp" ? "WhatsApp" : x === "call" ? "Call"
    : x === "email" ? "Email" : (c || "");
}
// Exact "Jul 12, 15:40" for the pulse panel, so timing is unambiguous, not just "3d ago".
function fmtExact(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) + ", " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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
  if (heat >= 70) return { label: "Hot", cls: "bg-danger/15 text-danger-soft border border-danger/30", hot: true };
  if (heat >= 45) return { label: "Warm", cls: "bg-gold/12 text-gold-ink border border-gold/25", hot: false };
  return { label: "Cool", cls: "bg-secondary text-muted-foreground border border-border", hot: false };
}


// Deal-rot: the longer a reply we owe goes unanswered, the louder the left edge.
function rotEdge(card: Card): string {
  if (card.waiting_on !== "us") return "";
  const d = daysSince(card.last_reply_at);
  if (d >= 7) return "border-l-2 border-l-danger";
  if (d >= 3) return "border-l-2 border-l-warn";
  if (d >= 1) return "border-l-2 border-l-gold";
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
  email: { label: "Email", cls: "text-info" },
  linkedin: { label: "LinkedIn", cls: "text-cyan" },
  whatsapp: { label: "WhatsApp", cls: "text-signal-ink" },
  call: { label: "Call", cls: "text-warn" },
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

// A small logo, tried in order: our own artwork (`src`), then the domain's favicon
// (Google's service), then a monogram tile. Each URL remembers its own failure, so a
// missing asset or favicon degrades one step instead of leaving a broken image.
function Favicon({ src, domain, label, size = 20, className = "" }: {
  src?: string; domain?: string; label?: string; size?: number; className?: string;
}) {
  const [bad, setBad] = useState<string[]>([]);
  const chain = [src, domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : ""]
    .filter(Boolean) as string[];
  const url = chain.find((u) => !bad.includes(u));
  if (url) {
    return (
      <img src={url} width={size} height={size} alt={label || domain || ""}
        onError={() => setBad((b) => [...b, url])}
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

// ── who is speaking: company identity in the thread ──────────────────────────
// A cold thread is one COMPANY talking to another, so the message circle carries the
// company logo (AudioStack, Arco Irish, Luxvance) and never a person's initials or the
// pipe the mail came through. The channel is not lost: it rides as a 10px badge in the
// corner of the avatar, and still labels the conversation header above.

// Our side of the thread, per workspace. Supabase `workspaces` (slug, name, domain) is
// the truth; this is its render-time mirror, so an unknown workspace falls back to an
// honest monogram instead of borrowing another company's logo. `logo` is a local asset
// (our own artwork beats a 16px favicon); `domain` is the automatic fallback. To brand a
// new client, drop /brand/<slug>.png in public and add the row.
const WS_BRAND: Record<string, { name: string; logo?: string; domain?: string }> = {
  luxvance: { name: "Luxvance", logo: "/brand/luxvance.png", domain: "luxvance.com" },
  "arco-irish": { name: "Arco Irish", domain: "arcoirish.com" },
  "connect-resources": { name: "Connect Resources", domain: "connectresources.ae" },
  kcal: { name: "Kcal", domain: "kcallife.com" },
  "global-food-ventures": { name: "Global Food Ventures" },
};
// The agency cockpit runs with no slug: that board IS Luxvance's own pipeline.
function wsBrand(slug?: string): { name: string; logo?: string; domain?: string } {
  const key = (slug || "luxvance").toLowerCase();
  return WS_BRAND[key] || { name: key.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) };
}
// Which workspace this board is scoped to, so a message bubble deep in the tree knows
// whose logo to draw on our side without threading the slug through six components.
const WorkspaceCtx = createContext<string | undefined>(undefined);

// The message avatar: company logo, with the channel as a corner badge.
function CompanyAvatar({ logo, domain, label, channelLogo, channelName, tint, size = 32 }: {
  logo?: string; domain?: string; label?: string;
  channelLogo?: string; channelName?: string; tint?: string; size?: number;
}) {
  const badge = Math.round(size * 0.42);
  return (
    <span className="relative shrink-0 block" style={{ width: size, height: size }} title={label}>
      <span className="block rounded-full overflow-hidden grid place-items-center w-full h-full"
        style={{ background: tint || "rgba(255,255,255,.06)" }}>
        <Favicon src={logo} domain={domain} label={label} size={Math.round(size * 0.62)} />
      </span>
      {channelLogo && (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full grid place-items-center bg-background"
          style={{ width: badge, height: badge, padding: 1 }} title={channelName}>
          <Favicon domain={channelLogo} label={channelName} size={badge - 3} className="rounded-full" />
        </span>
      )}
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

// ── location: prospect country + company HQ, with a flag ──────────────
// Both derive from data already on engaged_prospects — the prospect country from
// its `country`, the company HQ from the ccTLD of its `domain` — so nothing here
// reads a second table or a second source.
function flagEmoji(code: string): string {
  const cc = (code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}
// Country NAME -> ISO alpha-2 (the markets we actually sell into, plus majors).
const COUNTRY_CODE: Record<string, string> = {
  "united arab emirates": "AE", uae: "AE", "u.a.e.": "AE", "saudi arabia": "SA", ksa: "SA",
  qatar: "QA", kuwait: "KW", bahrain: "BH", oman: "OM", jordan: "JO", lebanon: "LB",
  egypt: "EG", israel: "IL", turkey: "TR", morocco: "MA", tunisia: "TN",
  netherlands: "NL", ireland: "IE", "united kingdom": "GB", uk: "GB", "great britain": "GB",
  germany: "DE", france: "FR", spain: "ES", portugal: "PT", italy: "IT", belgium: "BE",
  switzerland: "CH", austria: "AT", sweden: "SE", norway: "NO", denmark: "DK", finland: "FI",
  poland: "PL", greece: "GR", romania: "RO", "czech republic": "CZ", czechia: "CZ",
  "united states": "US", "united states of america": "US", usa: "US", "u.s.a.": "US", america: "US",
  canada: "CA", mexico: "MX", brazil: "BR", ecuador: "EC", argentina: "AR", colombia: "CO", chile: "CL",
  india: "IN", pakistan: "PK", bangladesh: "BD", "sri lanka": "LK", philippines: "PH",
  indonesia: "ID", malaysia: "MY", singapore: "SG", "hong kong": "HK", china: "CN",
  japan: "JP", "south korea": "KR", vietnam: "VN", thailand: "TH", australia: "AU", "new zealand": "NZ",
  "south africa": "ZA", nigeria: "NG", kenya: "KE", ghana: "GH", "sierra leone": "SL",
};
// ccTLD -> [ISO code, display name] for company HQ. Generic TLDs (com/io/…) are absent on purpose.
const TLD_COUNTRY: Record<string, [string, string]> = {
  ae: ["AE", "United Arab Emirates"], sa: ["SA", "Saudi Arabia"], qa: ["QA", "Qatar"],
  kw: ["KW", "Kuwait"], bh: ["BH", "Bahrain"], om: ["OM", "Oman"], eg: ["EG", "Egypt"],
  jo: ["JO", "Jordan"], lb: ["LB", "Lebanon"], nl: ["NL", "Netherlands"], ie: ["IE", "Ireland"],
  uk: ["GB", "United Kingdom"], de: ["DE", "Germany"], fr: ["FR", "France"], es: ["ES", "Spain"],
  pt: ["PT", "Portugal"], it: ["IT", "Italy"], be: ["BE", "Belgium"], ch: ["CH", "Switzerland"],
  at: ["AT", "Austria"], se: ["SE", "Sweden"], no: ["NO", "Norway"], dk: ["DK", "Denmark"],
  fi: ["FI", "Finland"], pl: ["PL", "Poland"], ca: ["CA", "Canada"], mx: ["MX", "Mexico"],
  br: ["BR", "Brazil"], ec: ["EC", "Ecuador"], in: ["IN", "India"], pk: ["PK", "Pakistan"],
  ph: ["PH", "Philippines"], my: ["MY", "Malaysia"], sg: ["SG", "Singapore"], hk: ["HK", "Hong Kong"],
  cn: ["CN", "China"], jp: ["JP", "Japan"], au: ["AU", "Australia"], nz: ["NZ", "New Zealand"],
  za: ["ZA", "South Africa"], ng: ["NG", "Nigeria"], ke: ["KE", "Kenya"],
};
function parseCountry(raw?: string): { code: string; name: string } | null {
  if (!raw) return null;
  // "City, Region, Country" -> take the last segment, which is the country.
  const name = raw.split(",").map((s) => s.trim()).filter(Boolean).pop() || raw.trim();
  if (!name) return null;
  return { code: COUNTRY_CODE[name.toLowerCase()] || "", name };
}
function companyCountryFromDomain(domain?: string): { code: string; name: string } | null {
  if (!domain) return null;
  const host = domain.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  const tld = host.split(".").pop() || "";
  const hit = TLD_COUNTRY[tld];
  return hit ? { code: hit[0], name: hit[1] } : null;
}
function LocationLine({ icon: Icon, place, title }: { icon: React.ComponentType<{ className?: string }>; place: { code: string; name: string }; title: string }) {
  const flag = flagEmoji(place.code);
  return (
    <div className="flex items-center gap-1.5 text-[12px]" title={title}>
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      {flag && <span className="text-[13px] leading-none">{flag}</span>}
      <span className="text-foreground truncate">{place.name}</span>
    </div>
  );
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
      {ok ? <Check className="w-3.5 h-3.5 text-signal-ink" /> : <Copy className="w-3.5 h-3.5" />}
      {label && <span className="text-xs">{ok ? "Copied" : label}</span>}
    </button>
  );
}

function Tile({ label, value, accent, icon, onClick, active }: {
  label: string; value: number; accent?: boolean; icon?: ReactNode; onClick?: () => void; active?: boolean;
}) {
  const cls = `bg-card rounded-xl px-4 py-3 border text-left w-full transition-colors ${
    active ? "border-gold ring-1 ring-gold/40"
    : accent && value > 0 ? "border-gold/40" : "border-border"
  } ${onClick ? "hover:border-gold/60 cursor-pointer" : ""}`;
  const inner = (
    <>
      <div className="flex items-center gap-1.5">
        <div className={`text-2xl font-semibold tabular-nums ${accent && value > 0 ? "text-gold-ink" : "text-foreground"}`}>{value}</div>
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
function Briefing({ onOpen, workspace }: { onOpen: (id: number) => void; workspace?: string }) {
  const [s, setS] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (typeof window !== "undefined") setOpen(localStorage.getItem("crm.briefing") !== "0");
  }, []);
  const toggle = () => setOpen((o) => { const n = !o; if (typeof window !== "undefined") localStorage.setItem("crm.briefing", n ? "1" : "0"); return n; });
  useEffect(() => {
    setLoading(true);
    // An error body parses as JSON perfectly well: FastAPI's {"detail": …} used to
    // land in `s`, and the first read of s.counts / s.top threw during render. With
    // no error boundary in the app that took the WHOLE CRM down, not just this
    // panel. Validate the shape before trusting it.
    fetch(`${API}/api/crm/summary${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}`)
      .then(async (r) => (r.ok ? await r.json() : null))
      .then((j) => setS(j && j.counts && Array.isArray(j.top) ? (j as Summary) : null))
      .catch(() => setS(null))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="bg-gradient-to-br from-card to-card/40 border border-gold/20 rounded-2xl px-5 py-4 mb-4">
      <button onClick={toggle} className="w-full flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        <Sparkles className="w-4 h-4 text-gold-ink" />
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
                    className="inline-flex items-center gap-2 rounded-full bg-background border border-border px-3 py-1.5 text-sm hover:border-gold/50 transition-colors">
                    {t.wants_meeting ? <span title="wants to meet">📅</span> : h.hot ? <Flame className="w-3.5 h-3.5 text-danger-soft" /> : null}
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
type ThreadMsg = { from_me: boolean; at: string | null; subject: string; text: string; html?: string; sig?: string; from_addr: string; to_addr: string; eaccount: string; email_id?: string };

// URLs and emails become real links inside a bubble — a pasted Build link should be
// clickable, and seeing it as a link confirms it went out as one.
const LINK_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]|[\w.+-]+@[\w-]+\.[\w.]+)/g;
function linkify(text: string, color: string) {
  return text.split(LINK_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part.includes("@") && !part.startsWith("http") ? `mailto:${part}` : part}
        target="_blank" rel="noopener noreferrer"
        className="underline underline-offset-2 break-all hover:opacity-80" style={{ color }}>
        {part}
      </a>
    ) : part
  );
}

// WhatsApp-style day chips + exact clock times: "5d ago" on every bubble made the
// thread feel like a log; a conversation reads by day and hour.
function dayKey(s: string | null): string { return s ? new Date(s).toDateString() : ""; }
function dayLabel(s: string | null): string {
  if (!s) return "";
  const d = new Date(s), now = new Date();
  const one = 86400000, today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (that === today) return "Today";
  if (today - that === one) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function clock(s: string | null): string {
  return s ? new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
}

// ── Gmail-style HTML mail rendering ──────────────────────────────────
// The backend now serves each message's ORIGINAL html (inbound: the webhook's
// reply_html; outbound: the branded body we actually delivered). We render it the
// way Gmail does: DOMPurify-sanitized, inside a sandboxed iframe so email CSS can
// never leak into the app (and vice versa), with the quoted reply trail split out
// behind Gmail's "···" expander instead of destroyed server-side.

const QUOTE_SELECTOR = [
  "div.gmail_quote", 'blockquote[type="cite"]', 'div[id^="divRplyFwdMsg"]',
  'div[id^="x_divRplyFwdMsg"]', "#appendonsend",
  "div.yahoo_quoted", "div.moz-cite-prefix", "div.protonmail_quote", "div.zmail_extra",
  "div.front-blockquote", "div.msg-quote",
  // Outlook desktop / Word HTML carries NO class and NO id on its trail — the only
  // structural marker is the thin rule above the "From:" header block. Without these
  // two, 16% of real inbound mail rendered its whole quoted chain inline.
  'div[style*="border-top:solid #E1E1E1"]', 'div[style*="border-top:solid #B5C4DF"]',
].join(", ");

// Last resort when no structural marker exists: the first block whose own text OPENS
// a quote header. Anchored at ^ so an outer wrapper holding the real message first
// never matches — and document order means we get the outermost qualifying block.
const QUOTE_TEXT_RE = /^\s*(-{2,}\s*Original Message|-{3,}\s*Forwarded message|_{5,}|On\s.{0,180}?\bwrote\s*:|From\s*:\s*(\S+@|[^\n<]{1,60}[<[]))/i;

function findTextQuoteMarker(root: HTMLElement): Element | null {
  for (const el of Array.from(root.querySelectorAll("div,p,blockquote,table,span"))) {
    const t = (el.textContent || "").trim();
    if (t && QUOTE_TEXT_RE.test(t)) return el;
  }
  // Outlook's header table often puts the label alone in its own bold run
  // ("<b>From:</b> Paul <paul@…>"), which no block-level test can see.
  for (const el of Array.from(root.querySelectorAll("b,strong"))) {
    if (/^from\s*:?$/i.test((el.textContent || "").trim())) return el;
  }
  return null;
}

// Same markers, but matched INSIDE a text node — for clients that leave the header
// loose in a block that also holds the reply ("…thanks.\n-----Original Message-----").
// Returns the exact (node, offset) so the cut lands on the marker, not the block.
const QUOTE_INLINE_RE = /(-{2,}\s*Original Message|-{3,}\s*Forwarded message|\n\s*_{5,}|(^|\n)\s*From\s*:\s*(\S+@|[^\n<]{1,60}[<[])|(^|\n)\s*On\s.{0,180}?\bwrote\s*:)/i;

function findInlineQuoteStart(root: HTMLElement): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const m = QUOTE_INLINE_RE.exec((n as Text).data || "");
    if (m) return { node: n as Text, offset: m.index + (m[0].startsWith("\n") ? 1 : 0) };
  }
  return null;
}

type MailParts = { main: string; quoted: string; empty: boolean; mainBlank: boolean };

function splitMail(raw: string): MailParts {
  if (typeof window === "undefined") return { main: "", quoted: "", empty: true, mainBlank: false };
  // Sanitize first (scripts, event handlers, javascript: URLs all die here — the
  // iframe sandbox below is defense in depth, not the only wall), keeping the DOM
  // so we can split the quoted trail without a reparse.
  const clean = DOMPurify.sanitize(raw, {
    RETURN_DOM: true,
    FORBID_TAGS: ["form", "input", "textarea", "select", "button", "dialog", "iframe"],
  }) as HTMLElement;
  // A mail client's quote marker plus EVERYTHING after it is the collapsed history
  // (Outlook puts the quoted body in ordinary siblings after #divRplyFwdMsg).
  const marker = clean.querySelector(QUOTE_SELECTOR) || findTextQuoteMarker(clean);
  const inline = marker ? null : findInlineQuoteStart(clean);
  let quoted = "";
  if ((marker || inline) && clean.lastChild) {
    const range = document.createRange();
    if (marker) range.setStartBefore(marker);
    else if (inline) range.setStart(inline.node, Math.min(inline.offset, inline.node.length));
    range.setEndAfter(clean.lastChild);
    const holder = document.createElement("div");
    holder.appendChild(range.extractContents());
    quoted = holder.innerHTML;
  }
  // "Empty" = nothing a human would see in the main part (sanitizer ate everything,
  // or whitespace-only markup). The caller then falls back to the plain-text bubble
  // instead of showing a blank white card — or losing the message entirely.
  const visibleText = (clean.textContent || "").replace(/ /g, " ").trim();
  const hasMedia = !!clean.querySelector("img,table");
  // A pure forward has no words of its own: the trail IS the message, so open it
  // rather than showing an empty card with a "···" the reader has to discover.
  const mainBlank = !visibleText && !hasMedia && !!quoted;
  return { main: clean.innerHTML, quoted, empty: !visibleText && !hasMedia && !quoted, mainBlank };
}

// White paper, light color-scheme, images capped to the card width: the message
// renders exactly as the recipient's inbox showed it, inside our dark UI.
function mailDoc(main: string, quoted: string, showQuoted: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><base target="_blank"><style>
  :root{color-scheme:light}
  html,body{margin:0;padding:0;background:#ffffff}
  body{color:#1f2328;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;padding:12px 14px 8px}
  img{max-width:100%;height:auto}
  a{color:#1d4ed8}
  p{margin:0 0 12px}
  blockquote{margin:4px 0 4px .8ex;border-left:2px solid #d5d9df;padding-left:1ex;color:#5f6368}
  .lx-quoted{margin-top:14px;padding-top:10px;border-top:1px solid #eceef1;color:#5f6368}
  </style></head><body>${main}${showQuoted && quoted ? `<div class="lx-quoted">${quoted}</div>` : ""}</body></html>`;
}

function EmailHtmlBubble({ html, fromMe, borderColor, fallback }: { html: string; fromMe: boolean; borderColor?: string; fallback?: ReactNode }) {
  const parts = useMemo(() => splitMail(html), [html]);
  const [showQuoted, setShowQuoted] = useState(false);
  // A forward with no covering note: show the trail straight away.
  useEffect(() => { setShowQuoted(parts.mainBlank); }, [parts.mainBlank]);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(64);
  const syncHeight = useCallback(() => {
    const b = frameRef.current?.contentDocument?.body;
    if (b) setHeight(Math.min(Math.max(b.scrollHeight + 4, 32), 6000));
  }, []);
  // Auto-height that keeps tracking: images/fonts load after onLoad, so observe the
  // iframe body (same-origin is safe — sandbox has no allow-scripts, DOMPurify ran).
  const onLoad = useCallback(() => {
    syncHeight();
    roRef.current?.disconnect();
    const b = frameRef.current?.contentDocument?.body;
    if (b && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(syncHeight);
      ro.observe(b);
      roRef.current = ro;
    }
  }, [syncHeight]);
  useEffect(() => () => roRef.current?.disconnect(), []);
  const srcDoc = useMemo(() => mailDoc(parts.main, parts.quoted, showQuoted), [parts, showQuoted]);
  if (parts.empty) return <>{fallback ?? null}</>;
  return (
    <div className={`w-full rounded-2xl border shadow-sm bg-white overflow-hidden ${fromMe ? "rounded-br-md" : "rounded-bl-md"}`}
      style={{ borderColor: borderColor || (fromMe ? "rgba(201,168,76,0.55)" : "rgba(0,0,0,.10)") }}>
      <iframe ref={frameRef} title="email message" srcDoc={srcDoc} onLoad={onLoad}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer" loading="lazy"
        className="block w-full" style={{ height, border: 0, background: "#fff" }} />
      {parts.quoted && (
        <button type="button" onClick={() => setShowQuoted((q) => !q)}
          title={showQuoted ? "Hide quoted history" : "Show quoted history"}
          className="mx-3.5 mb-2.5 px-2.5 py-1 rounded-full bg-[#eef1f4] hover:bg-[#dfe4e9] text-[#5f6368] text-[10px] leading-none tracking-[0.2em] transition-colors">
          ···
        </button>
      )}
    </div>
  );
}

// The prospect's letterhead (name/title/phones) rides under the message, collapsed.
// It stays one tap away — sometimes the phone number in it is exactly what Jose wants.
function SigToggle({ sig }: { sig: string }) {
  const [openSig, setOpenSig] = useState(false);
  return (
    <div className="mt-1.5">
      <button type="button" onClick={() => setOpenSig((o) => !o)}
        className="text-[10px] tracking-wide text-[#9aa2b1] hover:text-[#4b5563] transition-colors">
        {openSig ? "hide signature" : "· · · signature"}
      </button>
      {openSig && (
        <div className="mt-1 pt-1.5 border-t border-black/10 text-[11.5px] leading-snug text-[#6b7280] whitespace-pre-wrap">
          {sig}
        </div>
      )}
    </div>
  );
}

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
function ConvoBlock({ c, themName, themCompany, themDomain, defaultOpen }: {
  c: Convo; themName: string; themCompany: string; themDomain: string; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const src = SRC[convoSource(c)];
  // Our half of the thread is the workspace's company, never the person who typed it.
  const us = wsBrand(useContext(WorkspaceCtx));
  const routeShow = c.messages.map((m, i) => i === 0 || routeKey(m) !== routeKey(c.messages[i - 1]));
  const ordered = [...c.messages].reverse(); // newest first inside the block
  return (
    <div className={`rounded-xl border overflow-hidden ${
      c.active ? "border-gold/40 bg-gold/[0.02]"
      : c.replied ? "border-border" : "border-border/60"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-secondary/40 transition-colors">
        <Favicon domain={src.logo} label={src.name} size={18} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-foreground truncate">{cleanSubject(c.subject) || "(no subject)"}</span>
            {c.active && <span className="shrink-0 text-[8.5px] uppercase tracking-[0.1em] px-1 py-px rounded bg-gold/15 text-gold-ink">active</span>}
          </div>
          <div className="text-[10.5px] text-muted-foreground truncate">
            <span style={{ color: src.bar }}>{src.name}</span> · {c.eaccount}
          </div>
        </div>
        {c.replied
          ? <span className="shrink-0 text-[10px] font-medium text-signal-ink">{c.reply_count} repl{c.reply_count > 1 ? "ies" : "y"}</span>
          : <span className="shrink-0 text-[10px] text-subtle">no reply</span>}
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{c.sent_count} sent</span>
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{timeAgo(c.last_at)}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground w-3 text-center">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2.5 space-y-1 border-t border-border">
          {ordered.map((m, i) => {
            const orig = c.messages.length - 1 - i;
            const latest = i === 0 && !m.from_me;
            const route = routeShow[orig] && (m.from_addr || m.to_addr) ? (
              <>{shortAddr(m.from_addr)} <span style={{ color: src.bar }}>&gt;</span> {shortAddr(m.to_addr)}</>
            ) : null;
            // Newest-first list: the day chip sits above the newest message of each day.
            const newDay = i === 0 || dayKey(m.at) !== dayKey(ordered[i - 1].at);
            // Stable identity: a new message prepending must not hand this row's
            // iframe/toggle state to a DIFFERENT message (index keys shift on refresh).
            const mkey = m.email_id || `${m.at}|${m.from_addr}|${orig}`;
            return (
              <div key={mkey}>
                {newDay && (
                  <div className="flex items-center gap-3 py-2">
                    <span className="flex-1 h-px bg-border/60" />
                    <span className="text-[9.5px] uppercase tracking-[0.14em] text-subtle">{dayLabel(m.at)}</span>
                    <span className="flex-1 h-px bg-border/60" />
                  </div>
                )}
                <div className={`flex gap-2.5 ${m.from_me ? "flex-row-reverse" : ""}`}>
                  {m.from_me ? (
                    <CompanyAvatar logo={us.logo} domain={us.domain} label={us.name}
                      channelLogo={src.logo} channelName={src.name} tint="rgba(255,214,10,.15)" />
                  ) : (
                    <CompanyAvatar domain={themDomain} label={themCompany || themName}
                      channelLogo={src.logo} channelName={src.name} tint={src.tint} />
                  )}
                  <div className={`${m.html ? "max-w-[min(94%,640px)] w-full" : "max-w-[min(82%,60ch)]"} flex flex-col ${m.from_me ? "items-end" : "items-start"}`}>
                    {m.html ? (
                      // Original HTML, rendered like the real inbox rendered it —
                      // formatting, links, logos, signature — quoted trail behind "···".
                      // If the sanitizer leaves nothing visible, fall back to the
                      // plain-text bubble so a real message can never disappear.
                      <EmailHtmlBubble html={m.html} fromMe={m.from_me}
                        borderColor={!m.from_me && latest ? src.ring : undefined}
                        fallback={m.from_me ? (
                          <div className="rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm border"
                            style={{ background: "rgba(255,255,255,0.045)", borderColor: "rgba(255,214,10,0.4)" }}>
                            <div className="text-foreground whitespace-pre-wrap leading-relaxed">{linkify(m.text, "#FFD60A")}</div>
                          </div>
                        ) : (
                          <div className="rounded-2xl rounded-bl-md border shadow-sm bg-white px-3.5 py-2.5 text-sm text-[#1a1a1a]"
                            style={{ borderColor: latest ? src.ring : "rgba(0,0,0,.10)" }}>
                            <div className="whitespace-pre-wrap leading-relaxed">{linkify(m.text, "#1d4ed8")}</div>
                            {m.sig ? <SigToggle sig={m.sig} /> : null}
                          </div>
                        )} />
                    ) : m.from_me ? (
                      // OUR message — elevated navy, thin gold border (iMessage Luxvance)
                      <div className="rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm border"
                        style={{ background: "rgba(255,255,255,0.045)", borderColor: "rgba(255,214,10,0.4)" }}>
                        <div className="text-foreground whitespace-pre-wrap leading-relaxed">{linkify(m.text, "#FFD60A")}</div>
                      </div>
                    ) : (
                      // THEIR message — white paper, black text, like the real inbox
                      <div className="rounded-2xl rounded-bl-md border shadow-sm bg-white px-3.5 py-2.5 text-sm text-[#1a1a1a]"
                        style={{ borderColor: latest ? src.ring : "rgba(0,0,0,.10)" }}>
                        <div className="whitespace-pre-wrap leading-relaxed">{linkify(m.text, "#1d4ed8")}</div>
                        {m.sig ? <SigToggle sig={m.sig} /> : null}
                      </div>
                    )}
                    {/* meta line UNDER the bubble: hour · via · route — never competing with the text */}
                    <div className={`mt-1 px-1 flex items-center gap-1.5 text-[10px] text-subtle ${m.from_me ? "flex-row-reverse" : ""}`}
                      title={m.at ? new Date(m.at).toLocaleString("en-GB") : undefined}>
                      <span className="tabular-nums">{clock(m.at)}</span>
                      {m.from_me && <span style={{ color: src.bar }}>via {src.name} ✓</span>}
                      {latest && <span className="font-medium" style={{ color: src.bar }}>latest</span>}
                      {route && <span className="truncate max-w-[40ch]">{route}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Conversation({ id, themName, themCompany = "", themDomain = "", fallback, refreshKey }: {
  id: number; themName: string; themCompany?: string; themDomain?: string; fallback?: string; refreshKey?: number;
}) {
  const [convos, setConvos] = useState<Convo[] | null>(null);
  const [uniboxUrl, setUniboxUrl] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    // Blank ONLY when the prospect changes. On a refresh (after a send) we keep the
    // messages on screen: setConvos(null) tore down and rebuilt every iframe in the
    // thread, so the whole conversation flashed white each time Jose replied.
    setFailed(false);
    fetch(`${API}/api/crm/prospect/${id}/thread`)
      .then(async (r) => (r.ok ? await r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (mine !== seq.current) return;   // a newer card won the race
        setConvos(j.conversations || []);
        setUniboxUrl(j.unibox_url || "");
      })
      .catch(() => { if (mine === seq.current) { setFailed(true); setConvos((c) => c ?? []); } });
  }, [id, refreshKey]);
  useEffect(() => { setConvos(null); }, [id]);

  if (convos === null) return <div className="text-sm text-muted-foreground p-2">Loading conversation…</div>;
  if (convos.length === 0) {
    // A failed request is not an empty thread. Saying "no conversation" during a
    // Render cold start made a live prospect look untouched.
    if (failed) {
      return (
        <div className="text-sm text-muted-foreground p-2">
          Could not load the conversation. <button type="button" onClick={() => setConvos(null)}
            className="underline hover:text-foreground">Retry</button>
        </div>
      );
    }
    return fallback
      ? <div className="bg-card border border-border rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap">{fallback}</div>
      : <div className="text-sm text-muted-foreground p-2">No email thread found in Instantly.</div>;
  }
  const repliedCount = convos.filter((c) => c.replied).length;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-gold-ink">
        <span>// CONVERSATIONS · {convos.length}</span>
        {repliedCount > 0 && <span className="text-signal-ink normal-case tracking-normal">{repliedCount} replied</span>}
        {convos.length - repliedCount > 0 && <span className="text-subtle normal-case tracking-normal">{convos.length - repliedCount} cold campaign{convos.length - repliedCount > 1 ? "s" : ""}</span>}
        {uniboxUrl && (
          <a href={uniboxUrl} target="_blank" rel="noopener noreferrer"
            className="ml-auto normal-case tracking-normal text-[10.5px] text-muted-foreground hover:text-gold-ink transition-colors">
            Open in Instantly ↗
          </a>
        )}
      </div>
      {convos.map((c, i) => (
        <ConvoBlock key={c.eaccount} c={c} themName={themName} themCompany={themCompany}
          themDomain={themDomain} defaultOpen={i === 0} />
      ))}
    </div>
  );
}

// ── reply composer: channel tabs + draft + send ──────────────────────
// Generation lives entirely in the copilot below; this component only holds the message and
// sends it. (The old GET /prospect/{id}/draft response type went with the button.)
// One way this reply can leave: on-thread via an alive Instantly account, or a
// thread-resurrection send from the work mailbox (new email, In-Reply-To the stored
// Message-ID, real history quoted) — that one survives any cancelled account.
type SendOption = { via: "instantly" | "gmail"; eaccount: string; label: string; thread?: boolean; provider?: string };

// ESP favicon for a mailbox row ("google" | "microsoft" from Instantly's
// provider_code, resolved server-side — no extra requests, 2 cached favicons).
function ProviderIcon({ provider }: { provider?: string }) {
  const domain = provider === "google" ? "google.com" : provider === "microsoft" ? "microsoft.com" : "";
  if (!domain) return <span className="w-3.5 shrink-0" />;
  return <Favicon domain={domain} label={provider || ""} size={14} className="shrink-0" />;
}

// The Send-from picker. A native <select> cannot render images in its rows, so
// this is a minimal listbox: same look, ESP logo per mailbox, zero extra weight
// (Jose, 2026-08-05: "que se vea profesional pero que se mantenga rápido").
function SenderSelect({ opts, value, onChange }: {
  opts: SendOption[]; value: string; onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sel = opts.find((o) => `${o.via}|${o.eaccount}` === value) || null;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground max-w-full">
        <ProviderIcon provider={sel?.provider} />
        <span className="truncate">{sel?.label || "Pick a mailbox"}</span>
        <span className="text-muted-foreground">▾</span>
      </button>
      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 min-w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl py-1">
            {opts.map((o) => {
              const k = `${o.via}|${o.eaccount}`;
              return (
                <button key={k} type="button"
                  onClick={() => { onChange(k); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs whitespace-nowrap transition-colors hover:bg-white/[0.06] ${k === value ? "text-gold-ink" : "text-foreground"}`}>
                  <ProviderIcon provider={o.provider} />
                  <span className="truncate">{o.label}</span>
                  {k === value && <Check className="w-3 h-3 ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
type Chan = "email" | "linkedin" | "whatsapp" | "call";
// A copilot turn. `mode` is the backend's declared intent for the turn: it either answers,
// asks ONE question before guessing, offers 2-3 moves to pick from, or hands over a draft.
// `options` render as buttons, so a clarifying question is one click, not more typing.
type CoMode = "answer" | "question" | "options" | "draft";
type CoLog = {
  role: "you" | "copilot";
  content: string;
  mode?: CoMode;
  options?: string[];
  hasDraft?: boolean;
};
// What the copilot actually loaded for this prospect. Rendered as chips in its header, so
// "knows this prospect · the thread · the Build" stops being a promise and becomes a receipt:
// a workspace with no Intelligence Library shows a grey Brain chip instead of quietly
// answering as if it had one.
// The settled turn, from the stream's `done` event. Authoritative over the deltas: they are
// for feel, this is what the turn actually was.
type CoDone = {
  mode?: CoMode; reply?: string; draft?: string; options?: string[]; context?: CoContext;
};
type CoContext = {
  brain?: boolean;
  brain_sections?: number;
  dossier_facts?: number;
  sources?: number;
  thread_msgs?: number;
  build_leads?: number;
  notes?: boolean;
  call_notes?: boolean;
  booking_link?: boolean;
};

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
  const [coCtx, setCoCtx] = useState<CoContext | null>(null);
  // The copilot turn currently being written. Rendered as a live bubble under the log and
  // folded into it when the turn settles, so the panel writes in front of you instead of
  // showing "thinking…" for the length of a flagship call.
  const [coStream, setCoStream] = useState("");
  // Whether the last save actually landed. False means migration 015 has not been applied
  // yet: the chat still works, it just does not survive a close, and the panel says so
  // rather than letting a lost conversation look like a bug.
  const [coSaved, setCoSaved] = useState(true);
  const [threadKey, setThreadKey] = useState(0);   // bump to force the thread to reload after a send
  // Sender selector: which mailbox this reply leaves from. Options come from the
  // backend (alive accounts in the client's workspace + the Gmail resurrection path).
  const [sendOpts, setSendOpts] = useState<SendOption[]>([]);
  const [fromKey, setFromKey] = useState("");
  const [threadAcct, setThreadAcct] = useState<{ account: string; alive: boolean }>({ account: "", alive: true });
  // Reply-all routing (the Tanya case, 2026-07-28): To = whoever actually wrote
  // last on the thread, CC = the rest of its participants. Editable chips —
  // what you see is exactly what the send will do.
  const [routeTo, setRouteTo] = useState("");
  const [routeCc, setRouteCc] = useState<string[] | null>(null);
  const [ccAdd, setCcAdd] = useState("");
  // The client owner's real inbox (clients.notify_email). Renders as a one-click
  // "CC <owner>" chip — MANUAL only, the composer never adds it by itself (the
  // auto-CC bridge was killed 2026-07-09 for leaking leads).
  const [clientCc, setClientCc] = useState("");
  // What signature actually rides on the send (the workspace's own). Drives the
  // banner under the textarea, which used to claim "Luxvance signature" in every
  // workspace — a red flag inside a client's portal.
  const [sigInfo, setSigInfo] = useState<{ present: boolean; owner: string }>({ present: false, owner: "" });
  useEffect(() => {
    setSendOpts([]); setFromKey(""); setRouteTo(""); setRouteCc(null); setCcAdd(""); setClientCc("");
    fetch(`${API}/api/crm/prospect/${id}/send-options`)
      .then((r) => r.json())
      .then((j) => {
        const opts: SendOption[] = j.options || [];
        setSendOpts(opts);
        setThreadAcct({ account: j.thread_account || "", alive: !!j.thread_account_alive });
        if (opts.length) setFromKey(`${opts[0].via}|${opts[0].eaccount}`);
        if (j.routing?.to) { setRouteTo(j.routing.to); setRouteCc(j.routing.cc || []); }
        setClientCc((j.client_cc_email || "").toLowerCase());
        setSigInfo({ present: !!j.signature?.present, owner: j.signature?.owner || "" });
      })
      .catch(() => {});
  }, [id]);
  const selectedOpt = sendOpts.find((o) => `${o.via}|${o.eaccount}` === fromKey) || null;

  // Typing clears a previous confirmation, so the composer is never stuck showing
  // "Sent." while you are writing the next message.
  const setDraft = (c: Chan, v: string) => {
    setDrafts((p) => ({ ...p, [c]: v }));
    setSent((s) => (s === "ok" || s === "touched" ? null : s));
  };
  const text = drafts[chan];

  // No auto-draft on card open (Jose, 2026-07-24). It burned a model call on
  // every card just browsing the board, and a draft nobody asked for sitting in
  // the composer reads as the system being pushy. The draft is one click away,
  // through the copilot — the single AI surface on the card since 2026-08-13.

  // Restore the copilot conversation saved on the prospect row. Through a ref so the effect
  // depends on the id alone: `d` is refetched after every send, and depending on it would
  // wipe the turns of the session in progress each time the card reloaded.
  const savedChat = useRef(d.copilot_chat);
  savedChat.current = d.copilot_chat;
  useEffect(() => {
    setCoLog(Array.isArray(savedChat.current) ? (savedChat.current as CoLog[]) : []);
    setCoCtx(null); setCoStream(""); setCoSaved(true);
  }, [id]);

  // Persist the whole visible conversation, turn by turn. Fire and forget: a failed save
  // must never block the chat, it only flips the badge that says it is not being kept.
  const persistChat = (log: CoLog[]) => {
    fetch(`${API}/api/crm/prospect/${id}/copilot/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCoSaved(!!j?.saved))
      .catch(() => setCoSaved(false));
  };

  const clearChat = () => { setCoLog([]); setCoStream(""); persistChat([]); };

  const send = () => {
    setSending(true);
    fetch(`${API}/api/crm/prospect/${id}/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text, channel: "email", eaccount: selectedOpt?.eaccount, via: selectedOpt?.via,
        // Routing chips travel with the send; absent = the thread's own default.
        ...(routeTo ? { to: routeTo, cc: routeCc ?? [] } : {}),
      }),
    })
      .then(async (r) => {
        if (r.ok) { setSent("ok"); setDraft(chan, ""); setThreadKey((k) => k + 1); onSent(); }
        else { const e = await r.json().catch(() => ({})); setSent("err:" + (e.detail || r.status)); }
      })
      .catch((e) => setSent("err:" + e))
      .finally(() => setSending(false));
  };

  // A manual non-email send (WhatsApp / call / LinkedIn) happens outside the app; tell the
  // backend so the board flips to "their turn" instead of nagging us about a touch we made.
  const logTouch = (channel: Chan) => {
    fetch(`${API}/api/crm/prospect/${id}/touch`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    }).then((r) => { if (r.ok) { setSent("touched"); onSent(); } }).catch(() => {});
  };

  // The ONE generation call on the card. The old `Draft with AI` button hit a second
  // endpoint on a weaker model, so the same words produced two different qualities and
  // you could not tell which you had pressed. Everything routes here now, over SSE, so
  // the answer appears as it is written rather than after the whole reasoning call.
  const askCopilot = async (override?: string) => {
    const instruction = (override ?? co).trim();
    if (!instruction || coBusy) return;

    const before = drafts[chan];          // to restore if the turn ends up not being a draft
    const history = coLog.map((x) => ({ role: x.role === "you" ? "user" : "assistant", content: x.content }));
    const mine: CoLog = { role: "you", content: instruction };
    setCoBusy(true); setCoStream(""); setCo("");
    setCoLog((l) => [...l, mine]);

    let say = "", streamedDraft = "", touchedComposer = false;
    let settled: CoDone | null = null;

    const finish = (turn: CoLog) => {
      setCoLog((l) => { const next = [...l, turn]; persistChat(next); return next; });
      setCoStream(""); setCoBusy(false); setDrafting(false);
    };

    try {
      const res = await fetch(`${API}/api/crm/prospect/${id}/copilot/stream`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: instruction, draft: before, target: chan, history }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        // SSE frames are separated by a blank line; the tail may be a partial frame.
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }
          if (ev.type === "context") setCoCtx(ev.context as CoContext);
          else if (ev.type === "say") { say += ev.delta as string; setCoStream(say); }
          else if (ev.type === "draft") {
            // The message writes itself into the composer as it comes.
            if (!touchedComposer) { touchedComposer = true; setDrafting(true); setSent(null); }
            streamedDraft += ev.delta as string;
            setDraft(chan, streamedDraft);
          } else if (ev.type === "done") settled = ev as unknown as CoDone;
          else if (ev.type === "error") throw new Error(String(ev.message || "copilot error"));
        }
      }
    } catch (e) {
      if (touchedComposer) setDraft(chan, before);   // never leave half a message behind
      finish({
        role: "copilot", mode: "answer",
        content: `Copilot failed (${e instanceof Error ? e.message : "unknown"}). Your draft is untouched.`,
      });
      return;
    }

    // `done` is authoritative. The deltas are for feel; this is what the turn actually was,
    // which matters when a stream is cut short or the model reconsiders mid-answer.
    const mode: CoMode = settled?.mode || (streamedDraft ? "draft" : "answer");
    const finalDraft = (settled?.draft || streamedDraft || "").trim();
    const landed = mode === "draft" && !!finalDraft && finalDraft !== before;
    if (landed) setDraft(chan, finalDraft);
    else if (touchedComposer) setDraft(chan, before);
    if (settled?.context) setCoCtx(settled.context);

    const said = (settled?.reply || say).trim();
    finish({
      role: "copilot", mode,
      content: said || (landed ? "Updated the draft." : "No answer came back. Try again."),
      options: Array.isArray(settled?.options) ? settled.options : [],
      hasDraft: landed,
    });
  };

  const canSendEmail = chan === "email" && (sendOpts.length > 0 || d.can_send_email);
  const gmailLive = d.live_channel === "gmail";
  return { d, chan, setChan, text, setDraft, send, logTouch, refresh: onSent, askCopilot, drafting, sending, sent, setSent, co, setCo, coBusy, coLog, coCtx, coStream, coSaved, clearChat, canSendEmail, gmailLive, threadKey, sendOpts, fromKey, setFromKey, selectedOpt, threadAcct, routeTo, routeCc, setRouteCc, ccAdd, setCcAdd, clientCc, sigInfo };
}
type ComposerCtl = ReturnType<typeof useComposer>;

// ── the copilot: the ONE AI surface on the card ──────────────────────
// It used to sit beside a separate "Draft with AI" button that called a different endpoint
// on a weaker model, and beside a Business Intelligence panel showing the very research the
// copilot was reading. Three surfaces, one job. They are one thing now: the chat drafts, the
// research folds in behind it, and the header shows exactly what got loaded.

// Openers, chosen by what the prospect actually did. The old list was four fixed strings for
// every card, which is how you get "How do I handle the price question?" on a prospect who
// never mentioned price.
const COPILOT_SUGGESTIONS: Record<string, string[]> = {
  wants_meeting: ["Draft the reply with two time slots", "Are they actually ready, or being polite?", "What should I ask before the call?"],
  meeting_already_set: ["Draft a short confirmation", "What should I prepare for this call?"],
  positive: ["Draft the reply", "What is the best next move?", "What are they really asking?"],
  question: ["Answer their question", "What are they really asking?", "Draft the reply"],
  referral: ["Draft a reply asking for the intro", "Who should I be talking to here?"],
  not_interested: ["Is this worth keeping warm?", "Draft a short, no-pressure close"],
  using_competitor: ["How do I answer the competitor point?", "Draft a reply that leaves the door open"],
};
const COPILOT_FALLBACK = ["What is the best next move?", "Draft the reply", "What are they really asking?"];

function copilotChips(d: Detail, chan: Chan): string[] {
  if (chan === "call") return ["Give me talking points", "What are they worried about?", "What do I ask to qualify?"];
  const base = COPILOT_SUGGESTIONS[d.intent_label] || COPILOT_FALLBACK;
  if (chan === "linkedin") return ["Draft a short LinkedIn note", ...base.filter((s) => !/draft/i.test(s))].slice(0, 3);
  if (chan === "whatsapp") return ["Draft a WhatsApp nudge", ...base.filter((s) => !/draft/i.test(s))].slice(0, 3);
  return base;
}

// The receipt. Green = loaded, grey = genuinely absent, so an empty Intelligence Library
// is visible BEFORE you read a generic answer and wonder why it sounds like nobody.
function CtxChip({ on, label, title }: { on: boolean; label: string; title: string }) {
  return (
    <span title={title}
      className={`text-[10px] rounded-full px-1.5 py-0.5 border ${on
        ? "border-signal/40 bg-signal/10 text-signal-ink"
        : "border-border bg-transparent text-subtle line-through"}`}>
      {label}
    </span>
  );
}

function ContextChips({ ctx, d }: { ctx: CoContext | null; d: Detail }) {
  // Before the first turn the backend has not answered yet, so fall back to what the card
  // itself already knows. Same shape either way, so the row never pops in.
  const factCount = Object.values(d.dossier_facts || {}).filter(Boolean).length;
  const researchCount = Object.values(d.research || {}).filter((v) => (v || "").trim()).length;
  const c = ctx || {
    brain: undefined, dossier_facts: factCount, sources: researchCount,
    thread_msgs: undefined, build_leads: d.build_leads, notes: !!(d.notes || "").trim(),
    call_notes: !!d.call_notes,
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {c.brain !== undefined && (
        <CtxChip on={!!c.brain} label={c.brain ? `Brain ${c.brain_sections || ""}`.trim() : "Brain"}
          title={c.brain ? "The workspace's own Intelligence Library is loaded" : "This workspace has no Intelligence Library yet, so the copilot writes without its voice and rules"} />
      )}
      <CtxChip on={(c.dossier_facts || 0) > 0} label={`Research ${c.dossier_facts || 0}/8`}
        title="Distilled why-they-fit facts from the dossier" />
      <CtxChip on={(c.sources || 0) > 0} label={`Sources ${c.sources || 0}`}
        title="Raw research behind the summary: site, LinkedIn, web search, call" />
      {c.thread_msgs !== undefined && (
        <CtxChip on={(c.thread_msgs || 0) > 0} label={`Thread ${c.thread_msgs}`} title="Messages of the real conversation in context" />
      )}
      <CtxChip on={(c.build_leads || 0) > 0} label={c.build_leads ? `Build ${c.build_leads}` : "Build"}
        title="Their Build and the sample leads inside it" />
      <CtxChip on={!!c.notes} label="Notes" title="Your handwritten notes on this deal" />
      {c.call_notes && <CtxChip on label="Call" title="What was said on the discovery call" />}
    </div>
  );
}

function Copilot({ c }: { c: ComposerCtl }) {
  const { d, co, setCo, askCopilot, coBusy, coLog, coCtx, coStream, coSaved, clearChat, chan, text, send, sending, canSendEmail } = c;
  const logRef = useRef<HTMLDivElement>(null);
  const [showIntel, setShowIntel] = useState(false);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [coLog, coBusy, coStream]);

  const opening = actNow(d);
  const last = coLog[coLog.length - 1];
  // Chips come from the last copilot turn when it offered any (a question's likely answers,
  // or the moves it proposed); otherwise from what the prospect did.
  const chips = coBusy ? [] : (last?.role === "copilot" && last.options?.length ? last.options : (coLog.length === 0 ? copilotChips(d, chan) : []));
  const draftReady = !!text.trim();

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/[0.05] p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Bot className="w-4 h-4 text-gold-ink" />
        <span className="text-[11px] uppercase tracking-wider text-gold-ink font-semibold">Copilot</span>
        <span className="text-[10px] text-muted-foreground">it drafts, it asks, it never sends by itself</span>
        {coLog.length > 0 && (
          <button onClick={clearChat} disabled={coBusy} title="Start the conversation over"
            className="ml-auto text-[10px] rounded-full border border-border px-2 py-0.5 text-muted-foreground hover:text-gold-ink hover:border-gold/40 disabled:opacity-40 transition-colors">
            New chat
          </button>
        )}
      </div>
      <ContextChips ctx={coCtx} d={d} />
      {/* The chat is kept on the prospect, so it is here again tomorrow. When the column is
          missing (migration 015 not applied) the save fails and this says so, rather than
          letting a conversation vanish and look like a bug. */}
      {!coSaved && (
        <div className="text-[10px] text-gold-ink leading-snug">
          This chat is not being saved. Run migration 015 (`copilot_chat`) and it will persist with the prospect.
        </div>
      )}

      <div ref={logRef} className="space-y-2.5 max-h-[26rem] overflow-y-auto text-[12.5px] leading-relaxed pr-1">
        {/* Opening turn — the intent read the card already computed and cached, rendered as
            the copilot's first message. Costs nothing extra and means the panel is never a
            blank box waiting to be prompted. */}
        <div>
          <span className="font-semibold text-gold-ink inline-flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> {opening.title}
          </span>
          <div className="text-foreground">{opening.detail}</div>
        </div>

        {coLog.map((l, i) => (
          <div key={i}>
            <span className={`font-semibold ${l.role === "you" ? "text-foreground" : "text-gold-ink"}`}>
              {l.role === "you" ? "You" : "Copilot"}
              {l.role === "copilot" && l.mode === "question" && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">needs one thing</span>}
              {l.role === "copilot" && l.hasDraft && <span className="ml-1.5 text-[10px] font-normal text-signal-ink">draft in the composer</span>}
            </span>
            <div className={`whitespace-pre-wrap ${l.role === "you" ? "text-muted-foreground" : "text-foreground"}`}>{l.content}</div>
          </div>
        ))}

        {/* The turn being written. It becomes a normal log entry the moment it settles. */}
        {coBusy && (
          <div>
            <span className="font-semibold text-gold-ink">Copilot</span>
            {coStream ? (
              <div className="whitespace-pre-wrap text-foreground">
                {coStream}<span className="inline-block w-1.5 h-3.5 -mb-0.5 ml-0.5 bg-gold animate-pulse" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-gold-ink text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> reading the deal…
              </div>
            )}
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((p) => (
            <button key={p} onClick={() => askCopilot(p)} disabled={coBusy}
              className="text-[11px] rounded-full border border-gold/30 px-2.5 py-1 text-muted-foreground hover:text-gold-ink hover:border-gold/50 disabled:opacity-40 transition-colors">
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Act on the draft without leaving the panel. Send is the same call the composer
          makes, with the same sender and routing — this is a second door, not a second path. */}
      {draftReady && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-gold/15 pt-2.5">
          {chan === "email" && canSendEmail && (
            <button onClick={send} disabled={sending || coBusy}
              className="neon-btn inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-[12px] font-semibold text-ink-inverse hover:bg-gold-hi disabled:opacity-40 transition-colors">
              {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><Send className="w-3.5 h-3.5" /> Send it</>}
            </button>
          )}
          {["Make it shorter", "More direct", "Warmer"].map((p) => (
            <button key={p} onClick={() => askCopilot(p)} disabled={coBusy}
              className="text-[11px] rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-gold/40 disabled:opacity-40 transition-colors">
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles className="w-4 h-4 text-gold-ink absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={co} onChange={(e) => setCo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askCopilot(); } }}
            placeholder="Ask anything, or say 'draft the reply'…"
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50" />
        </div>
        <button onClick={() => askCopilot()} disabled={coBusy || !co.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 px-3 py-2 text-sm text-gold-ink hover:bg-gold/10 disabled:opacity-40 transition-colors">
          {coBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[10px] text-subtle">When it writes a message, it drops straight into the composer on the left.</p>

      {/* The research it is reading, one click away. Same panel as before, folded in here
          instead of sitting beside the copilot repeating its context back at you. */}
      <div className="pt-1">
        <button onClick={() => setShowIntel((s) => !s)}
          className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-gold-ink transition-colors">
          <span className="uppercase tracking-wider font-semibold">What it knows · the research</span>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showIntel ? "rotate-90" : ""}`} />
        </button>
        {showIntel && <div className="mt-2"><IntelPanel d={d} /></div>}
      </div>
    </div>
  );
}

// ── the phone, inside the card ───────────────────────────────────────
// Everything else in the Call tab is preparation (talking points); this is the
// part that actually dials. It writes the call to prospect_calls server-side, so
// a call made here counts as a touch and the board stops asking for one.
const OUTCOMES = ["connected", "voicemail", "gatekeeper", "wrong-number", "not-interested", "booked"] as const;

function CallPanel({ d, onTouched }: { d: Detail; onTouched: () => void }) {
  const ph = useSoftphone();
  const [mode, setMode] = useState<CallMode>("browser");
  const [logged, setLogged] = useState<string | null>(null);
  const busy = ph.state === "connecting" || ph.state === "ringing" || ph.state === "live";

  // One touch per finished call, not per state change.
  const notified = useRef(false);
  useEffect(() => {
    if (busy) notified.current = false;
    if (ph.state === "ended" && !notified.current) { notified.current = true; onTouched(); }
  }, [ph.state, busy, onTouched]);

  if (!d.phone) {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-[12px] text-muted-foreground">
        No number on file for {d.name.split(" ")[0] || "them"}. Use <span className="text-foreground">Shop via Clay</span> in the left column first, then come back here to dial.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-signal/25 bg-signal/[0.05] px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {!busy ? (
          <button
            onClick={() => { setLogged(null); ph.call(d.phone, d.id, mode); }}
            className="neon-btn inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-signal-hi transition-colors">
            <PhoneCall className="w-4 h-4" /> Call {d.phone}
          </button>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 rounded-lg bg-signal/12 px-3 py-2 text-sm text-signal-ink">
              {ph.state === "live"
                ? <><span className="w-2 h-2 rounded-full bg-signal animate-pulse" /> Live · <span className="tabular-nums">{fmtDuration(ph.seconds)}</span></>
                : <><Loader2 className="w-4 h-4 animate-spin" /> {ph.state === "ringing" ? "Ringing…" : "Connecting…"}</>}
            </span>
            {mode === "browser" && ph.state === "live" && (
              <button onClick={ph.toggleMute}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                {ph.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />} {ph.muted ? "Unmute" : "Mute"}
              </button>
            )}
            <button onClick={ph.hangup}
              className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-ink-inverse hover:bg-danger-hi transition-colors">
              <PhoneOff className="w-4 h-4" /> Hang up
            </button>
          </>
        )}

        {!busy && (
          <button
            onClick={() => setMode((m) => (m === "browser" ? "dialout" : "browser"))}
            title="Dial-out rings your own mobile first, then connects the prospect. Use it on networks that block VoIP."
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
              mode === "dialout"
                ? "border-gold/40 text-gold-ink bg-gold/8"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            <Smartphone className="w-3.5 h-3.5" /> {mode === "dialout" ? "Ring my mobile first" : "From the browser"}
          </button>
        )}
      </div>

      {/* what the prospect sees, and the recording state, never hidden */}
      <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
        {ph.callerId && <span>They see <span className="text-foreground tabular-nums">{ph.callerId}</span></span>}
        {ph.recording && <span className="text-gold-ink">· recording on, the notice plays first</span>}
        {mode === "dialout" && <span>· we ring your mobile, then bridge them</span>}
      </div>

      {ph.error && (
        <div className="flex items-start gap-2 text-[12px] text-danger-soft">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {ph.error}
        </div>
      )}

      {/* right after hanging up: the one thing Twilio cannot know */}
      {ph.state === "ended" && ph.callSid && (
        logged ? (
          <div className="flex items-center gap-2 text-[12px] text-signal-ink"><Check className="w-3.5 h-3.5" /> Logged as {logged}.</div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground mr-1">How did it go?</span>
            {OUTCOMES.map((o) => (
              <button key={o} onClick={() => { ph.logOutcome(o); setLogged(o); }}
                className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                {o.replace("-", " ")}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Composer({ c }: { c: ComposerCtl }) {
  const { d, chan, setChan, text, setDraft, send, logTouch, drafting, sending, sent, setSent, canSendEmail, gmailLive, sendOpts, fromKey, setFromKey, selectedOpt, threadAcct, routeTo, routeCc, setRouteCc, ccAdd, setCcAdd, clientCc } = c;
  // Compact by default so an empty composer never steals the conversation's space; it opens
  // on click or as soon as there's a draft (incl. one the copilot / Draft-with-AI wrote).
  const [open, setOpen] = useState(false);
  // Stay expanded while there's a draft, while drafting, and right after a send/failure so the
  // "Sent · cadence advanced" confirmation is visible (send clears the text, which would
  // otherwise collapse the box in the auto-drafted flow before the user sees the result).
  const expanded = open || !!text.trim() || drafting || sending || !!sent;

  return (
    <div className="border border-border rounded-xl bg-popover/95 p-4 space-y-2.5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-subtle font-semibold">Compose · pick a channel</div>
      {/* channel tabs + how it sends */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {(["email", "linkedin", "whatsapp", "call"] as Chan[]).map((ch) => (
            <button key={ch} onClick={() => { setChan(ch); setSent(null); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                chan === ch ? "bg-gold/12 text-gold-ink" : "text-muted-foreground hover:bg-secondary"}`}>
              {CHANNEL_BRAND[ch]
                ? <Favicon domain={CHANNEL_BRAND[ch]} label={CHANNEL_META[ch].label} size={14} />
                : <Phone className="w-3.5 h-3.5 text-signal-ink" />}
              {CHANNEL_META[ch].label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {chan === "email"
            ? (canSendEmail ? "Sends on-thread via Instantly" : gmailLive ? "Reply from Gmail" : "No thread — copy & send")
            : chan === "call" ? "Dials from here, logged automatically"
            : "Copy & send by hand"}
        </span>
      </div>

      {/* Reply-all routing (the Tanya case): who this reply actually goes to.
          To = whoever wrote last on the thread; CC chips are removable and you
          can add one. What you see here is exactly what the send does. */}
      {chan === "email" && routeTo && (
        <div className="flex items-center flex-wrap gap-1.5 mb-2 text-[11px]">
          <span className="text-muted-foreground">To:</span>
          <span className="inline-flex items-center rounded-md border border-gold/35 bg-gold/10 px-2 py-0.5 text-gold-ink">{routeTo}</span>
          {(routeCc ?? []).length > 0 && <span className="text-muted-foreground ml-1">CC:</span>}
          {(routeCc ?? []).map((a) => (
            <span key={a} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-foreground">
              {a}
              <button type="button" aria-label={`Quitar ${a} del CC`}
                onClick={() => setRouteCc((routeCc ?? []).filter((x) => x !== a))}
                className="text-muted-foreground hover:text-danger-soft">×</button>
            </span>
          ))}
          <input
            value={ccAdd}
            onChange={(e) => setCcAdd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ccAdd.includes("@")) {
                setRouteCc([...(routeCc ?? []), ccAdd.trim().toLowerCase()]);
                setCcAdd("");
              }
            }}
            placeholder="+ CC…"
            className="w-24 bg-transparent border-b border-border/60 text-[11px] text-foreground placeholder:text-subtle focus:outline-none focus:border-gold/50 px-1 py-0.5"
          />
          {/* One-click CC to the client owner's real inbox (clients.notify_email).
              Manual by design — never pre-added (the auto-CC bridge is dead). */}
          {clientCc && !(routeCc ?? []).includes(clientCc) && (
            <button
              type="button"
              onClick={() => setRouteCc([...(routeCc ?? []), clientCc])}
              title={`Añadir ${clientCc} al CC`}
              className="inline-flex items-center gap-1 rounded-md border border-signal/35 bg-signal/10 px-2 py-0.5 text-signal-ink hover:bg-signal/20 transition-colors"
            >
              + CC client · {clientCc}
            </button>
          )}
        </div>
      )}

      {/* the dialer sits above the notes: on the Call tab the phone is the action,
          the talking points below it are the preparation */}
      {chan === "call" && <CallPanel d={d} onTouched={c.refresh} />}

      {!expanded ? (
        <button type="button" onClick={() => setOpen(true)}
          className="w-full text-left bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:border-gold/40 transition-colors">
          {`Write your ${CHANNEL_META[chan].label} message, or ask the copilot…`}
        </button>
      ) : (
      <>
      {/* reply box — drag the bottom-right corner to resize while writing. It opens taller
          now that the AI buttons moved into the copilot: the space they took belongs to the
          message, which is the only thing this column is for. */}
      <textarea
        value={text} onChange={(e) => setDraft(chan, e.target.value)} autoFocus
        placeholder={`Write your ${CHANNEL_META[chan].label} message, or ask the copilot on the right…`}
        rows={Math.min(20, Math.max(8, text.split("\n").length + 2))}
        className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-gold/50 resize-y"
      />

      {/* The workspace's OWN signature is attached automatically on send (from
          workspaces.signature_html via the Brain) — the banner names it truthfully
          per workspace and disappears when none is configured. It used to claim
          "Luxvance signature · logo · tagline" in every workspace, which read as
          a red flag inside a client's portal (Jose, 2026-08-05). */}
      {chan === "email" && c.sigInfo.present && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/25 bg-gold/[0.06] px-2.5 py-1.5">
          <span className="text-[11px] text-muted-foreground leading-tight">
            <span className="text-gold-ink font-medium">{c.sigInfo.owner ? `${c.sigInfo.owner}'s signature` : "Signature"}</span> attached on send. Just end with a sign-off like <span className="text-foreground">Best,</span>
          </span>
        </div>
      )}

      {/* one-click: drop the Build (lead magnet) link into the message */}
      {d.build_url && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDraft(chan, (text.trim() ? text.trimEnd() + "\n\n" : "") + `Here is your Build: ${d.build_url}`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/8 px-2.5 py-1.5 text-xs text-gold-ink hover:bg-gold/12 transition-colors">
            🧲 Insert Build link
          </button>
          <span className="text-[11px] text-muted-foreground truncate">{d.build_name || "Their Build"}</span>
        </div>
      )}

      {/* actions */}
      {/* The confirmation used to REPLACE the action row, and only a channel-tab
          click cleared it — so after one send there was no Send button and the
          only way back was LinkedIn and return. It now sits above the row and
          clears the moment you type again. */}
      {(sent === "ok" || sent === "touched") && (
        <div className="flex items-center gap-2 text-sm text-signal-ink">
          <Check className="w-4 h-4" />
          {sent === "ok" ? "Sent. Cadence advanced."
            : `Logged as ${CHANNEL_META[chan].label} touch. Ball's in their court now.`}
        </div>
      )}
      {(
        <>
        {chan === "email" && sendOpts.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground shrink-0">Send from</span>
            <SenderSelect opts={sendOpts} value={fromKey} onChange={setFromKey} />
            {threadAcct.account && !threadAcct.alive && (
              <span className="text-[11px] text-gold-ink">
                Original mailbox ({threadAcct.account}) is gone — this sends as a continuation of the same thread.
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {canSendEmail ? (
            <button onClick={send} disabled={sending || !text.trim() || (sendOpts.length > 0 && !selectedOpt)}
              className="neon-btn inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-gold-hi disabled:opacity-40 transition-colors">
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                : <><Send className="w-4 h-4" /> {selectedOpt?.via === "gmail" ? `Send from ${selectedOpt.eaccount}` : "Send via Instantly"}</>}
            </button>
          ) : chan !== "email" && chan !== "call" && text.trim() ? (
            <a href={chan === "whatsapp" && d.phone ? (d.wa_link || `https://wa.me/${d.phone.replace(/[^\d]/g, "")}`) : (d.linkedin_url || linkedinSearchUrl(d.name, d.company))}
              target="_blank" rel="noreferrer"
              onClick={() => { navigator.clipboard.writeText(text); logTouch(chan); }}
              className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-gold-hi transition-colors">
              <Copy className="w-4 h-4" /> Copy & open {CHANNEL_META[chan].label}
            </a>
          ) : null}
          {/* "Draft with AI" and "Book" used to live here. Both are the copilot's job now —
              they called a second endpoint on a weaker model, so the same request produced a
              different answer depending on which button you happened to press. */}
          {drafting && (
            <span className="inline-flex items-center gap-1.5 text-sm text-gold-ink">
              <Loader2 className="w-4 h-4 animate-spin" /> Copilot is writing…
            </span>
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
        </>
      )}
      {sent?.startsWith("err:") && (
        <div className="text-xs text-danger">Send failed: {sent.slice(4)} · your text is still here.</div>
      )}
      </>
      )}
    </div>
  );
}

// ── build card: the Build IS the lead magnet ─────────────────────────
function BuildCard({ d, onChanged, autoOptimize = false }: { d: Detail; onChanged: () => void; autoOptimize?: boolean }) {
  const id = d.id;
  const [building, setBuilding] = useState(d.build_status === "building");
  const [err, setErr] = useState<string | null>(null);
  const [instr, setInstr] = useState("");        // optional extra context for the Build
  const [showInstr, setShowInstr] = useState(false);
  // Opened straight from the sidebar's Optimize button, so the refine box is
  // already waiting instead of costing another click.
  const [optimize, setOptimize] = useState(autoOptimize);
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
    ? { txt: "Delivered to prospect", cls: "text-signal-ink" }
    : d.build_published ? { txt: "Published · link live", cls: "text-gold-ink" }
    : { txt: "Built · link not resolving", cls: "text-danger" };
  // The open signal: THE follow-up trigger. "Opened 20m ago" means they are
  // looking at it right now — reach out while the tab is still warm.
  const opened = d.build_last_opened_at
    ? { txt: `Opened ${timeAgo(d.build_last_opened_at)}${(d.build_open_count || 0) > 1 ? ` · ${d.build_open_count} visits` : ""}`,
        hot: Date.now() - new Date(d.build_last_opened_at).getTime() < 3600000 }
    : d.build_delivered ? { txt: "Not opened yet", hot: false } : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base leading-none">🧲</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">// THEIR_BUILD</span>
        <span className="text-[11px] text-muted-foreground">· the lead magnet</span>
      </div>

      {building ? (
        <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/8 px-4 py-3 text-sm text-gold-ink">
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
            <div className="shrink-0 text-right">
              <span className={`block text-xs ${statusLine.cls}`}>{statusLine.txt}</span>
              {opened && (
                <span className={`block text-[11px] mt-0.5 ${opened.hot ? "text-signal-ink font-medium" : "text-muted-foreground"}`}>
                  {opened.hot ? "🔥 " : ""}{opened.txt}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={d.build_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold/10 border border-gold/40 px-3 py-2 text-sm text-gold-ink hover:bg-gold/15 transition-colors">
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
              <div className="text-xs text-muted-foreground">
                Rebuild keeps the conversation context. Add anything you want changed,
                then press the button below. It takes two to four minutes, and the result
                replaces what is there now.
              </div>
              <textarea value={instr} onChange={(e) => setInstr(e.target.value)} rows={3}
                placeholder="e.g. focus on Series A fintech in the UK, drop agencies…"
                className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50 resize-y" />
              <button onClick={() => start(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-gold-hi transition-colors">
                <Sparkles className="w-4 h-4" /> Rebuild the Build
              </button>
            </div>
          )}
          {err && <div className="text-xs text-danger">{err}</div>}
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
              className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50 resize-y" />
          )}
          <button onClick={() => start(false)}
            className="neon-btn w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-ink-inverse hover:bg-gold-hi transition-colors">
            🧲 Generate the Build
          </button>
          {err && <div className="text-xs text-danger">{err}</div>}
        </div>
      )}
    </div>
  );
}

// ── channel contacts (LinkedIn + Phone) ──────────────────────────────
// Add a LinkedIn URL to a contact that has none. LinkedIn is the primary key for
// the cheap Clay phone providers (LeadMagic/Springbolt/Lyne/Prospeo all require it),
// so a replied lead with no profile on file can't be enriched cheaply until one is
// added. Mirrors the manual-phone editor: a quiet "Add LinkedIn profile" row that
// opens an inline input and saves to engaged_prospects.linkedin_url.
function AddLinkedin({ d, onChanged }: { d: Detail; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    const v = val.trim();
    if (!v) { setEditing(false); return; }
    setSaving(true); setErr(null);
    fetch(`${API}/api/crm/prospect/${d.id}/linkedin`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedin_url: v }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setErr(j.detail || "Could not save the URL."); return; }
        setEditing(false); onChanged();
      })
      .catch(() => setErr("Could not save the URL."))
      .finally(() => setSaving(false));
  };

  if (!editing) {
    return (
      <button onClick={() => { setVal(""); setEditing(true); }}
        className="group flex items-center gap-2 text-[12.5px] w-full text-muted-foreground hover:text-cyan transition-colors">
        <Favicon domain="linkedin.com" label="LinkedIn" size={16} className="opacity-40 group-hover:opacity-100 transition-opacity" />
        <span className="flex-1 text-left">Add LinkedIn profile</span>
        <Plus className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Favicon domain="linkedin.com" label="LinkedIn" size={16} />
        <input value={val} onChange={(e) => setVal(e.target.value)} autoFocus
          placeholder="linkedin.com/in/…"
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2.5 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50" />
        <button onClick={save} disabled={saving}
          className="rounded-lg bg-gold px-2.5 py-1.5 text-ink-inverse hover:bg-gold-hi disabled:opacity-40 transition-colors">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => { setEditing(false); setErr(null); }}
          className="rounded-lg border border-border px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {err && <div className="text-[11px] text-danger-soft">{err}</div>}
      <div className="text-[10px] text-subtle">Unlocks the cheaper phone providers for this contact.</div>
    </div>
  );
}

function ContactActions({ d, onChanged }: { d: Detail; onChanged: () => void }) {
  const [finding, setFinding] = useState(false);
  const [findNote, setFindNote] = useState<string | null>(null);
  // Once Clay has run and come back empty for this contact, don't offer another
  // PAID lookup in the same session — a second click would spend a second credit
  // on a search we just learned has no answer. (An existing number never reaches
  // Clay at all: the button is hidden below, and the server short-circuits too.)
  const [triedClay, setTriedClay] = useState(false);
  // A LinkedIn URL just added (or a number that appeared) changes what Clay can do,
  // so re-open the paid lookup after it settled into "searched, nothing found".
  useEffect(() => { setTriedClay(false); }, [d.linkedin_url, d.phone]);
  // Extraction is a guess: a signature can hand us our own number or a switchboard,
  // and a wrong number is worse than none. So the number is always editable.
  const [editing, setEditing] = useState(false);
  const [draftPhone, setDraftPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);

  const savePhone = (value: string) => {
    setSavingPhone(true); setPhoneErr(null);
    fetch(`${API}/api/crm/prospect/${d.id}/phone`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: value }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setPhoneErr(j.detail || "Could not save the number."); return; }
        setEditing(false); onChanged();
      })
      .catch(() => setPhoneErr("Could not save the number."))
      .finally(() => setSavingPhone(false));
  };

  const phoneEditor = (
    <div className="space-y-2">
      <input
        value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)} autoFocus
        placeholder="+353 86 796 1664"
        onKeyDown={(e) => { if (e.key === "Enter") savePhone(draftPhone); if (e.key === "Escape") setEditing(false); }}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground tabular-nums focus:outline-none focus:ring-1 focus:ring-gold/50"
      />
      <div className="flex items-center gap-2">
        <button onClick={() => savePhone(draftPhone)} disabled={savingPhone}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink-inverse hover:bg-gold-hi disabled:opacity-40 transition-colors">
          {savingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
        </button>
        <button onClick={() => { setEditing(false); setPhoneErr(null); }}
          className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          Cancel
        </button>
        {d.phone && (
          <button onClick={() => savePhone("")} title="Remove this number"
            className="rounded-lg border border-border px-3 py-2 text-sm text-danger-soft hover:bg-secondary transition-colors">
            Clear
          </button>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground">
        Any format works. We store it in international format so the dialer can use it.
      </div>
      {phoneErr && <div className="text-[11px] text-danger-soft">{phoneErr}</div>}
    </div>
  );

  // The email-thread scan runs automatically server-side when the record opens, so
  // there is no "find in thread" button. The only button is Clay (paid, optional).
  const shopClay = async () => {
    if (finding || triedClay || d.phone) return; // never fire a second paid lookup
    setFinding(true); setFindNote("Searching Clay…");
    try {
      // Start the cheapest-first waterfall, then poll the same route with the run_id
      // until the number lands (or every provider misses). It runs async because
      // chaining up to six providers can take ~30-60s.
      let j = await fetch(`${API}/api/crm/prospect/${d.id}/find-phone?source=clay`, { method: "POST" }).then((r) => r.json());
      let runId: string = j.run_id || "";
      for (let i = 0; i < 24 && j.queued && runId; i++) {
        await new Promise((res) => setTimeout(res, 5000));
        j = await fetch(`${API}/api/crm/prospect/${d.id}/find-phone?source=clay&run_id=${encodeURIComponent(runId)}`, { method: "POST" }).then((r) => r.json());
        runId = j.run_id || runId;
      }
      if (j.found) { onChanged(); }                     // number arrived → the button is gone
      else if (j.queued) { setFindNote("Still searching Clay — reopen the card in a minute."); }
      else {
        setTriedClay(true);
        setFindNote(j.note || "No mobile found via Clay.");
        // Even with no phone, Clay may have found + saved a LinkedIn — reload so it
        // shows in the contact block and the "Add LinkedIn" row disappears.
        if (j.linkedin_added) onChanged();
      }
    } catch {
      // A network/transport failure is not a completed lookup, so leave the button
      // live — nothing was charged and a retry is fair.
      setFindNote("Clay lookup failed — try again.");
    } finally {
      setFinding(false);
    }
  };

  // No LinkedIn button here anymore — the profile is a branded handle row up in
  // the Contact block, and "open profile" is how you connect. This component is
  // now just the phone: reach out if we have a number, enrich the gap if we don't.
  return (
    <div className="space-y-2">
      {editing ? phoneEditor : d.phone ? (
        <div className="flex items-center gap-1.5">
          <a href={d.wa_link || `https://wa.me/${d.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-signal/40 bg-signal/10 px-3 py-2 text-[12.5px] text-signal-ink hover:bg-signal/15 transition-colors">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
          <a href={`tel:${d.phone}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] text-foreground hover:bg-secondary transition-colors">
            <Phone className="w-3.5 h-3.5" /> Call
          </a>
          <button onClick={() => { setDraftPhone(d.phone); setEditing(true); }} title="Edit or remove this number"
            className="rounded-lg border border-border p-2 text-muted-foreground hover:text-gold-ink transition-colors">
            <PenLine className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {triedClay ? (
            <div className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[12px] text-muted-foreground">
              <Favicon domain="clay.com" label="Clay" size={14} /> Searched Clay — no mobile found
            </div>
          ) : (
            <button onClick={shopClay} disabled={finding}
              title="Runs a paid Clay mobile lookup. Skipped when a number is already on file, and only once per contact."
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[12.5px] font-medium text-foreground hover:border-gold/40 disabled:opacity-40 transition-colors">
              {finding
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enriching the number…</>
                : <><Favicon domain="clay.com" label="Clay" size={15} /> Enrich with Clay <span className="text-[10px] text-subtle font-normal">· phone + LinkedIn</span></>}
            </button>
          )}
          <button onClick={() => { setDraftPhone(""); setEditing(true); }}
            className="w-full text-center text-[11px] text-subtle hover:text-muted-foreground transition-colors py-0.5">
            or add a number manually
          </button>
          {findNote && <div className="text-[11px] text-muted-foreground">{findNote}</div>}
        </div>
      )}
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
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Empty used to render nothing at all, so half the card was blank with no clue
  // why. The dossier is only built automatically when a reply arrives, and that
  // path is off, so every prospect who replied before it existed had an empty
  // panel and no way to fill it. Now the panel says so and offers the button.
  if (!facts.length && !ffCount && !d.call_notes) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Bot className="w-4 h-4" /> Intelligence
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          No research on this prospect yet. It reads their site, their LinkedIn and
          the thread, then distils why they fit and what to lead with.
        </p>
        <button
          onClick={() => {
            setBusy(true); setNote(null);
            fetch(`${API}/api/crm/prospect/${d.id}/research`, { method: "POST" })
              .then((r) => { if (!r.ok) throw new Error(); setNote("Researching. It lands on the card in a couple of minutes."); })
              .catch(() => setNote("Could not start it."))
              .finally(() => setBusy(false));
          }}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[12.5px] text-gold-ink hover:bg-gold/15 disabled:opacity-40 transition-colors"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />} Research this prospect
        </button>
        {note && <div className="text-[11px] text-muted-foreground">{note}</div>}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gold/20 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gold-ink">
        <Bot className="w-4 h-4" /> Business Intelligence · why they fit
        {d.dossier_status && <span className="ml-auto text-[10px] font-normal text-muted-foreground uppercase">{ffCount}/6 sources</span>}
      </div>
      {/* call notes get top billing when we have them */}
      {d.call_notes && (
        <div className="rounded-lg border border-signal/25 bg-signal/5 p-3">
          <div className="text-[11px] font-semibold text-signal-ink mb-1">📞 Call notes (Fireflies){d.call_notes_at ? ` · ${fmtDate(d.call_notes_at)}` : ""}</div>
          <p className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">{d.call_notes}</p>
        </div>
      )}
      {facts.length > 0 && (
        <dl className="space-y-1.5">
          {facts.map(([label, val]) => (
            <div key={label} className="text-xs">
              <dt className="text-subtle text-[10px] uppercase tracking-wide">{label}</dt>
              <dd className="text-foreground/90 leading-snug">{val}</dd>
            </div>
          ))}
        </dl>
      )}
      {research.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] uppercase tracking-wide text-subtle">Raw research</div>
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
  // Agency only — see CanBuildCtx. A client sees the rest of the rail unchanged.
  const canBuild = useContext(CanBuildCtx);
  const [tools, setTools] = useState(false);
  // Which pane the Build tools open on: fresh build vs refine-with-context.
  const [optimizeMode, setOptimizeMode] = useState(false);
  // Their website, from the address we already have. A free-mail domain is the
  // person's mailbox, not their company, so it links nowhere.
  const siteUrl = (() => {
    const dom = (d.email.split("@")[1] || "").toLowerCase();
    const free = ["gmail.com","googlemail.com","outlook.com","hotmail.com","live.com",
      "yahoo.com","yahoo.co.uk","icloud.com","me.com","aol.com","gmx.com",
      "protonmail.com","proton.me","mail.com","yandex.com","zoho.com"];
    return dom && !free.includes(dom) ? `https://${dom}` : "";
  })();
  const [confirmBuild, setConfirmBuild] = useState(false);
  const [starting, setStarting] = useState(false);
  const [buildErr, setBuildErr] = useState<string | null>(null);
  const building = starting || d.build_status === "building";

  // Fire the build from the rail, then watch for the link to change. Polling
  // lives here rather than in the panel below so the rail keeps showing progress
  // whether or not that panel is open.
  const startBuild = () => {
    setConfirmBuild(false);
    setStarting(true);
    setBuildErr(null);
    const before = d.build_url;
    fetch(`${API}/api/crm/prospect/${d.id}/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions: "", force: true }),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        const timer = setInterval(async () => {
          const j = await loadDetail(d.id, true);
          if (!j) return;
          if (j.build_url !== before || j.build_status === "error") {
            clearInterval(timer);
            setStarting(false);
            if (j.build_status === "error") {
              setBuildErr("The build failed. Check the Render logs, then try again.");
            }
            both();
          }
        }, 8000);
        // Measured: a real build is two to four minutes (research, a Clay search
        // the agent may retry, a fit pass and fifty pieces of copy). Ten minutes
        // is the point where it is genuinely not coming back.
        setTimeout(() => { clearInterval(timer); setStarting(false); }, 600000);
      })
      .catch(() => {
        setStarting(false);
        setBuildErr("Could not start it. Try again.");
      });
  };
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
  // Deal value — inline editable, drives prioritization/forecast later.
  const [amt, setAmt] = useState(d.deal_amount != null ? String(d.deal_amount) : "");
  const [amtEdit, setAmtEdit] = useState(false);
  const saveAmt = () => {
    const v = amt.trim() === "" ? null : Number(amt.replace(/[^\d.]/g, ""));
    fetch(`${API}/api/crm/prospect/${d.id}/amount`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: v }),
    }).then((r) => { if (r.ok) reload(true); }).finally(() => setAmtEdit(false));
  };
  // Working note — call outcomes / next-step context that must survive a re-open.
  const [note, setNote] = useState(d.notes || "");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const saveNote = () => {
    setNoteBusy(true); setNoteSaved(false);
    fetch(`${API}/api/crm/prospect/${d.id}/note`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }).then((r) => { if (r.ok) { setNoteSaved(true); reload(true); } }).finally(() => setNoteBusy(false));
  };
  const build = d.build_url
    ? (d.build_delivered ? { t: "Delivered", c: "#26D07C" } : d.build_published ? { t: "Published", c: "#FFD60A" } : { t: "Built", c: "#f0b45f" })
    : null;
  const owe = d.waiting_on === "us";
  return (
    <div className="space-y-5">
      {/* PULSE — the timing on both sides, unambiguous: ↙ THEY last wrote vs ↗ WE last wrote.
          The side that moved LAST tells you whose court the ball is in; the gap = how cold. */}
      <div className="flex items-stretch rounded-lg border border-border bg-card/40 overflow-hidden">
        <div className={`flex-1 px-3 py-2 ${owe ? "bg-info/[0.06]" : ""}`}>
          <div className="text-[9px] uppercase tracking-[0.14em] text-info/80">↙ They last wrote</div>
          <div className={`text-[13px] tabular-nums mt-0.5 ${owe ? "text-gold-ink" : "text-foreground"}`}>{timeAgo(d.last_reply_at)}</div>
          {fmtExact(d.last_reply_at) && <div className="text-[10px] text-subtle tabular-nums">{fmtExact(d.last_reply_at)}</div>}
        </div>
        <div className="w-px bg-border" />
        <div className={`flex-1 px-3 py-2 ${!owe && d.waiting_on !== "closed" ? "bg-signal/[0.05]" : ""}`}>
          <div className="text-[9px] uppercase tracking-[0.14em] text-signal-ink">↗ We last wrote{d.last_channel ? ` · ${chLabel(d.last_channel)}` : ""}</div>
          <div className="text-[13px] tabular-nums mt-0.5 text-foreground">{d.last_touch_at ? timeAgo(d.last_touch_at) : "—"}</div>
          {fmtExact(d.last_touch_at) && <div className="text-[10px] text-subtle tabular-nums">{fmtExact(d.last_touch_at)}</div>}
        </div>
      </div>

      {/* WHO THEY ARE — first, because it is what you check before doing anything
          else on the card: the right person, the right company, and the three
          handles you copy into a call, a CRM or a search. Reaching them lives
          further down; this is for reading and copying. */}
      {/* CONTACT — one identity block. Who they are, every handle we hold on them
          (each carrying its own brand mark, so the record reads as connected rather
          than as a list of blue links), and the actions to reach them. LinkedIn is
          here ONCE, as a real link; the phone lives here too. Reading someone and
          reaching them are no longer two separate rails. */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-subtle font-semibold mb-2">Contact</div>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* identity */}
          <div className="px-3 py-2.5">
            <div className="text-[13.5px] font-semibold text-foreground leading-tight">{d.name || "—"}</div>
            <div className="text-[12px] text-muted-foreground leading-snug mt-0.5 truncate">
              {[d.job_title, d.company].filter(Boolean).join(" · ") || "—"}
            </div>
            {(() => {
              const pc = parseCountry(d.country);
              // Company HQ: prefer the stored value (from graduation/enrichment), else the ccTLD guess.
              const cc = d.company_country ? parseCountry(d.company_country) : companyCountryFromDomain(d.domain || siteUrl);
              const ind = (d.industry || "").trim();
              if (!pc && !cc && !ind) return null;
              return (
                <div className="mt-2 flex flex-col gap-1">
                  {pc && <LocationLine icon={MapPin} place={pc} title="Prospect location" />}
                  {cc && <LocationLine icon={Building2} place={cc} title="Company HQ" />}
                  {ind && (
                    <div className="flex items-center gap-1.5 text-[12px]" title="Industry">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-foreground truncate">{ind}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* handles — each a branded, copyable row. The brand mark does the visual
              work the colour used to do badly (blue-300 washed out on white). */}
          <div className="border-t border-border/70 px-3 py-2 space-y-1.5">
            {d.email && (
              <div className="group flex items-center gap-2 text-[12.5px]">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0 truncate text-foreground" title={d.email}>{d.email}</span>
                <CopyBtn value={d.email} />
              </div>
            )}
            {d.linkedin_url && (
              <div className="group flex items-center gap-2 text-[12.5px]">
                <Favicon domain="linkedin.com" label="LinkedIn" size={16} />
                <a href={d.linkedin_url} target="_blank" rel="noreferrer"
                  className="flex-1 min-w-0 inline-flex items-center gap-1 text-foreground hover:text-[#0A66C2] transition-colors">
                  <span className="truncate">LinkedIn profile</span>
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <CopyBtn value={d.linkedin_url} />
              </div>
            )}
            {!d.linkedin_url && <AddLinkedin d={d} onChanged={() => reload(true)} />}
            {siteUrl && (
              <div className="group flex items-center gap-2 text-[12.5px]">
                <Favicon domain={domainOf(d.email)} label={d.company} size={16} />
                <a href={siteUrl} target="_blank" rel="noreferrer"
                  className="flex-1 min-w-0 inline-flex items-center gap-1 text-foreground hover:text-gold-ink transition-colors">
                  <span className="truncate">{siteUrl.replace(/^https?:\/\//, "")}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <CopyBtn value={siteUrl} />
              </div>
            )}
            {d.phone && (
              <div className="group flex items-center gap-2 text-[12.5px]">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0 truncate text-foreground tabular-nums">{d.phone}</span>
                <CopyBtn value={d.phone} />
              </div>
            )}
            {/* Colleagues seen writing on this thread (Tanya answering for Jaya):
                the account's other people, straight from the conversation. */}
            {(d.contacts ?? []).length > 0 && (
              <div className="pt-1.5 mt-1 border-t border-border/60">
                <div className="text-[9.5px] uppercase tracking-[0.14em] text-subtle mb-1">Also on this thread</div>
                {(d.contacts ?? []).map((ct) => (
                  <div key={ct.email} className="flex items-center gap-2 text-[12px]">
                    <span className="w-4 shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-foreground/90" title={ct.email}>{ct.email}</span>
                    <CopyBtn value={ct.email} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* reach — the outbound actions, plus a coverage strip: at a glance, which
              channels we already hold on them and which is the gap to enrich. */}
          <div className="border-t border-border/70 bg-secondary/30 px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[9.5px] uppercase tracking-[0.16em] text-subtle font-semibold">Reach them</div>
              <div className="flex items-center gap-1.5" title="Channels we hold on this contact">
                <Favicon domain="linkedin.com" size={12} className={d.linkedin_url ? "" : "opacity-25 grayscale"} />
                <Mail className={`w-3 h-3 ${d.email ? "text-signal-ink" : "text-subtle opacity-40"}`} />
                <Globe className={`w-3 h-3 ${siteUrl ? "text-signal-ink" : "text-subtle opacity-40"}`} />
                <Phone className={`w-3 h-3 ${d.phone ? "text-signal-ink" : "text-subtle opacity-40"}`} />
              </div>
            </div>
            <ContactActions d={d} onChanged={() => reload(true)} />
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-subtle font-semibold mb-2">Deal</div>
        <dl className="space-y-2 text-[12.5px]">
          <Row k="Source" v={d.reply_campaign || "Cold outbound"} />
          <Row k="Segment" v={d.category || "—"} />
          <Row k="Deal value" v={
            amtEdit ? (
              <span className="inline-flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <input autoFocus type="text" inputMode="decimal" value={amt}
                  onChange={(e) => setAmt(e.target.value)}
                  onBlur={saveAmt}
                  onKeyDown={(e) => { if (e.key === "Enter") saveAmt(); if (e.key === "Escape") { setAmt(d.deal_amount != null ? String(d.deal_amount) : ""); setAmtEdit(false); } }}
                  className="w-20 bg-background border border-gold/40 rounded px-1.5 py-0.5 text-right text-[12.5px] text-foreground focus:outline-none" />
              </span>
            ) : (
              <button onClick={() => setAmtEdit(true)} className={d.deal_amount != null ? "text-foreground hover:underline decoration-dotted underline-offset-2 tabular-nums" : "text-gold-ink hover:underline decoration-dotted underline-offset-2"}>
                {d.deal_amount != null ? `$${Number(d.deal_amount).toLocaleString()}` : "set value"}
              </button>
            )
          } />
          <Row k="Next step" v={
            <button onClick={() => setFuOpen((v) => !v)} className="text-gold-ink hover:underline decoration-dotted underline-offset-2">
              {d.next?.next_touch_at ? `${d.next.next_channel || "email"} · ${fmtDate(d.next.next_touch_at)}` : "set follow-up"}
            </button>
          } />
        </dl>
        {fuOpen && (
          <div className="mt-3 rounded-lg border border-gold/30 bg-gold/[0.04] p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-gold-ink font-semibold">Set follow-up</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {([["+2 days", 2], ["+1 week", 7], ["Next Mon", "mon"]] as [string, number | "mon"][]).map(([label, off]) => {
                const val = presetDate(off);
                return (
                  <button key={label} onClick={() => setFuDate(val)}
                    className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                      fuDate === val ? "border-gold/50 bg-gold/10 text-gold-ink" : "border-border text-muted-foreground hover:text-gold-ink hover:border-gold/40"}`}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <select value={fuChan} onChange={(e) => setFuChan(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50">
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="call">Call</option>
              </select>
              <input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => saveFu(false)} disabled={fuBusy || !fuDate}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-[12px] font-semibold text-ink-inverse hover:bg-gold-hi disabled:opacity-40 transition-colors">
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

      {/* BUILD — the lead magnet. Sits high in the card because deciding who gets
          one is a first-class call Jose makes per prospect, not an afterthought.
          Creation is deliberately MANUAL: a magnet costs real money and not every
          replier deserves one. Optimize reopens the same build with extra context.
          Hidden entirely for a client session: a Build is Luxvance-branded sales
          material, so a client generating one would send their own prospect a demo
          of an agency that prospect has never heard of. */}
      {canBuild && (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-subtle font-semibold"><span className="text-[13px] mr-1 align-middle">🧲</span> Build · the lead magnet</span>
          {tools && (
            <button onClick={() => setTools(false)} className="ml-auto text-[11px] text-muted-foreground hover:text-gold-ink">Hide</button>
          )}
        </div>
        {build ? (
          <div className="mb-2 space-y-1.5">
            <div className="flex items-center gap-2 text-[12px]">
              <span style={{ color: build.c }}>● {build.t}</span>
              {d.build_url && <a href={d.build_url} target="_blank" rel="noreferrer" className="ml-auto text-gold-ink hover:underline shrink-0">Open</a>}
            </div>
            {/* The whole link, readable. It is what gets pasted into the reply, so
                hiding it behind a truncated slug meant opening the Build to read
                the address off the browser bar. */}
            {d.build_url && (
              <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
                <span className="text-[11px] text-muted-foreground break-all leading-snug">{d.build_url}</span>
                <span className="ml-auto shrink-0"><CopyBtn value={d.build_url} /></span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[12px] text-muted-foreground mb-2">No Build yet.</div>
        )}
        {/* Every click changes something HERE, under the cursor. The previous
            version only expanded a panel further down the rail, so from where you
            clicked nothing moved and the button read as dead. It still takes two
            clicks, because a build spends money and replaces what is there, but the
            first click turns into the confirmation instead of scrolling you away. */}
        {building ? (
          <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/[0.06] px-3 py-2 text-[12.5px] text-gold-ink">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Building… researching, sourcing in Clay and writing the copy. Two to four minutes.
          </div>
        ) : confirmBuild ? (
          <div className="flex items-center gap-1.5">
            <button onClick={startBuild}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-signal px-3 py-2 text-[12.5px] font-semibold text-ink-inverse hover:bg-signal-hi transition-colors">
              <Sparkles className="w-3.5 h-3.5" /> {d.build_url ? "Yes, rebuild it" : "Yes, build it"}
            </button>
            <button onClick={() => setConfirmBuild(false)}
              className="rounded-lg border border-border px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setConfirmBuild(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-[12.5px] font-semibold text-ink-inverse hover:bg-gold-hi transition-colors">
              <Sparkles className="w-3.5 h-3.5" /> {d.build_url ? "Rebuild it" : "Create the Build"}
            </button>
            <button onClick={() => { setOptimizeMode(true); setTools(true); }}
              title="Say what to change before rebuilding"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12.5px] text-foreground hover:border-gold/40 transition-colors">
              Optimize
            </button>
          </div>
        )}
        {buildErr && <div className="mt-1.5 text-[11px] text-danger">{buildErr}</div>}
        {tools && <div className="mt-3"><BuildCard d={d} onChanged={both} autoOptimize={optimizeMode} /></div>}
      </div>
      )}

      {/* NOTES — call outcomes / next-step context that must survive a re-open */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-subtle font-semibold">Notes</span>
          {noteSaved && note === (d.notes || "") && <span className="text-[10px] text-signal-ink">saved</span>}
        </div>
        <textarea value={note} onChange={(e) => { setNote(e.target.value); setNoteSaved(false); }}
          onBlur={() => { if (note !== (d.notes || "")) saveNote(); }}
          placeholder="Spoke — wants pricing, follow Tue. Anything that should greet you next time you open this card…"
          rows={Math.min(8, Math.max(3, note.split("\n").length + 1))}
          className="w-full bg-background border border-border rounded-lg p-2.5 text-[12.5px] text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-gold/40 resize-y" />
        <div className="flex items-center gap-2 mt-1.5">
          <button onClick={saveNote} disabled={noteBusy || note === (d.notes || "")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-gold/40 disabled:opacity-40 transition-colors">
            {noteBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save note
          </button>
          <span className="text-[10px] text-subtle">auto-saves when you click away</span>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-subtle font-semibold mb-2">Quick actions</div>
        <div className="flex flex-col gap-1.5">
          <button onClick={() => reload(true)}
            className="text-left text-[12.5px] rounded-lg border border-border bg-card px-3 py-2 text-foreground hover:border-gold/40 transition-colors inline-flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh intelligence
          </button>
          <button onClick={() => navigator.clipboard.writeText(d.email)}
            className="text-left text-[12.5px] rounded-lg border border-border bg-card px-3 py-2 text-foreground hover:border-gold/40 transition-colors inline-flex items-center gap-2">
            <Copy className="w-3.5 h-3.5" /> Copy email
          </button>
          <button onClick={() => setFuOpen(true)}
            className="text-left text-[12.5px] rounded-lg border border-border bg-card px-3 py-2 text-foreground hover:border-gold/40 transition-colors inline-flex items-center gap-2">
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
  return (
    <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-[23%_1fr_30%]">
      {/* LEFT rail */}
      <div className="lg:overflow-y-auto p-4 lg:p-5 lg:border-r border-border">
        <DealRail d={d} both={both} reload={reload} />
      </div>

      {/* CENTER — ONE continuous scroll: composer → action banner → full thread. Nothing is
          pinned, so a long draft never freezes on top and crush the email thread below; you
          just scroll the whole column down to read the conversation. */}
      <div className="lg:min-h-0 lg:overflow-y-auto lg:border-r border-border">
        {/* 1 · composer — compact by default, expands on click/draft */}
        <div className="p-4 lg:p-5 border-b border-border">
          <Composer c={c} />
        </div>

        {/* 2 · conversation — flows in the same scroll, right under the composer. The
            "what to do now" banner that used to sit between them is the copilot's opening
            turn now, so the center column is only ever the message and the thread. */}
        <div className="p-4 lg:p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">// CONVERSATION · NEWEST_FIRST</div>
          <Conversation id={id} themName={themName} themCompany={d.company}
            themDomain={domainOf(d.email)} fallback={d.reply_text} refreshKey={c.threadKey} />
        </div>
      </div>

      {/* RIGHT: the copilot, and nothing else. The Business Intelligence panel folds inside
          it — one column that is the brain of this card, instead of a chat next to a panel
          showing the same research the chat was already reading. */}
      <div className="lg:overflow-y-auto p-4 lg:p-5">
        <Copilot c={c} />
      </div>
    </div>
  );
}

const STAGES: { key: string; label: string }[] = [
  { key: "mql", label: "MQL" },
  { key: "sql", label: "SQL" },
  { key: "discovery_booked", label: "Discovery booked" },
  { key: "discovery_held", label: "Discovery held" },
  { key: "proposal_sent", label: "Proposal sent" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost / Parked" },
];

// Stage selector in the card header — advances the prospect along the funnel via the same
// endpoint as dragging on the board, so a deal moves without leaving the card. Picking
// "Discovery booked" or "Won" also marks the meeting booked server-side (status stays in sync).
// Dynamic funnel stepper — a live map of where this deal sits, and a one-click way to advance
// it. The "won" node signals green; a stage in the past shows a ✓; "lost" is a separate off-ramp.
function FunnelStepper({ d, onChanged }: { d: Detail; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const flow = STAGES.filter((s) => s.key !== "lost");
  const lost = d.stage === "lost";
  const curIdx = lost ? -1 : Math.max(0, flow.findIndex((s) => s.key === d.stage));
  const set = (key: string) => {
    if (busy || key === d.stage) return;
    setBusy(true);
    fetch(`${API}/api/crm/prospect/${d.id}/stage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: key }),
    }).then((r) => { if (r.ok) onChanged(); }).finally(() => setBusy(false));
  };
  return (
    <div className="shrink-0 border-b border-border px-5 py-2 flex items-center gap-1 overflow-x-auto">
      {flow.map((s, i) => {
        const done = !lost && i < curIdx;
        const active = !lost && i === curIdx;
        const won = s.key === "won";
        const dot = active
          ? (won ? "bg-signal text-ink-inverse" : "bg-gold text-ink-inverse")
          : done ? "bg-signal/25 text-signal-ink" : "bg-secondary text-muted-foreground";
        return (
          <Fragment key={s.key}>
            {i > 0 && <div className={`h-px w-3 lg:w-7 shrink-0 ${!lost && i <= curIdx ? "bg-signal/40" : "bg-border"}`} />}
            <button onClick={() => set(s.key)} disabled={busy}
              title={`Move to ${s.label}`}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                active ? (won ? "bg-signal/15 text-signal-ink" : "bg-gold/12 text-gold-ink") : "text-muted-foreground hover:bg-secondary"}`}>
              <span className={`grid place-items-center w-4 h-4 rounded-full text-[9px] font-bold ${dot}`}>{done ? "✓" : i + 1}</span>
              {s.label}
            </button>
          </Fragment>
        );
      })}
      <button onClick={() => set("lost")} disabled={busy}
        title="Mark this deal lost or parked"
        className={`shrink-0 ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
          lost ? "bg-danger/12 text-danger-soft" : "text-subtle hover:bg-secondary hover:text-danger-soft"}`}>
        {lost ? "● Lost / Parked" : "Mark lost"}
      </button>
    </div>
  );
}

function Record({ id, initial, queue, onNavigate, onClose, onChanged }: { id: number; initial?: Card; queue?: number[]; onNavigate?: (id: number) => void; onClose: () => void; onChanged: () => void }) {
  const qidx = queue ? queue.indexOf(id) : -1;
  const prevId = qidx > 0 ? queue![qidx - 1] : null;
  const nextId = qidx >= 0 && queue && qidx < queue.length - 1 ? queue[qidx + 1] : null;
  const [d, setD] = useState<Detail | null>(null);
  const themName = initial?.name?.trim().split(/\s+/)[0] || "Them";
  const [loading, setLoading] = useState(true);
  // Which load is current. Prev/next used to flip `id` while the previous
  // prospect's detail was still in flight: the thread (keyed on the prop) showed
  // the NEW person while the rail and the composer still held the OLD one, with
  // no skeleton to signal it — so Send could post to the previous prospect.
  const seq = useRef(0);

  const reload = useCallback((force = false) => {
    const mine = ++seq.current;
    setLoading(true);
    loadDetail(id, force)
      .then((j) => { if (mine === seq.current) setD(j); })
      .finally(() => { if (mine === seq.current) setLoading(false); });
  }, [id]);
  // setD(null) on every id change: `loading && !d` then renders the skeleton, so
  // the card is never a mix of two prospects.
  useEffect(() => { setD(null); reload(); }, [id, reload]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // J/K step through the work queue — but never while typing a draft/note/search.
      const el = document.activeElement;
      const typing = el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || (el as HTMLElement).isContentEditable);
      // Escape closes the card — but while writing it belongs to the field
      // (cancel an inline edit), never to the modal: closing unmounts the
      // composer and the draft dies with it.
      if (e.key === "Escape" && !typing) { onClose(); return; }
      if (typing || !onNavigate) return;
      if ((e.key === "j" || e.key === "J") && nextId != null) { e.preventDefault(); onNavigate(nextId); }
      if ((e.key === "k" || e.key === "K") && prevId != null) { e.preventDefault(); onNavigate(prevId); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, onNavigate, nextId, prevId]);

  const both = () => { reload(true); onChanged(); };

  const head = d ?? initial;
  const h = head ? heatChip(head.heat) : null;
  const headDomain = head ? domainOf(head.email) : "";
  // Signal Green means "won / meeting booked" — never decorate a cold or lost prospect with it.
  const closedWon = d?.stage === "won" || d?.stage === "discovery_booked" || d?.stage === "discovery_held" || head?.waiting_on === "closed";
  const avatarCls = closedWon
    ? "bg-signal/12 text-signal-ink border border-signal/30"
    : "bg-secondary text-foreground border border-border";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/88 backdrop-blur-lg" onClick={onClose} />
      <div className="relative m-auto w-full h-full lg:h-[94vh] lg:my-[3vh] max-w-[1600px] bg-popover border border-border lg:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* header */}
        <div className="shrink-0 border-b border-border px-5 py-3.5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-lg grid place-items-center text-sm font-bold shrink-0 ${avatarCls}`}>
              {initials(head?.name || "?")}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-foreground truncate">{head?.name || "…"}</h2>
                {h && <Badge text={h.hot ? "🔥 Hot" : h.label} className={h.cls} />}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate flex items-center gap-1.5">
                {headDomain && <Favicon domain={headDomain} label={head?.company} size={16} />}
                <span className="truncate">{head?.job_title ? `${head.job_title} · ` : ""}{head?.company}{head?.country ? ` · ${head.country}` : ""}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {queue && queue.length > 1 && (
              <div className="flex items-center gap-0.5 mr-1">
                <button onClick={() => prevId != null && onNavigate?.(prevId)} disabled={prevId == null}
                  title="Previous in queue (K)"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent">
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <span className="text-[11px] text-muted-foreground tabular-nums px-1">{qidx + 1}/{queue.length}</span>
                <button onClick={() => nextId != null && onNavigate?.(nextId)} disabled={nextId == null}
                  title="Next in queue (J)"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <button onClick={onClose} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {d && <FunnelStepper d={d} onChanged={both} />}

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
        <div className={`text-sm tabular-nums ${mine ? "text-gold-ink" : "text-foreground"}`}>{timeAgo(r.last_reply_at)}</div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-block w-2 h-2 rounded-full ${r.build_delivered ? "bg-signal" : r.has_build ? "bg-gold" : "bg-muted-foreground/40"}`}
          title={r.build_delivered ? "Build delivered" : r.has_build ? "Build ready" : "No Build"} />
      </td>
      <td className="px-4 py-3 text-right">
        {r.waiting_on === "us" ? (
          <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${
            r.wants_meeting ? "bg-signal/15 text-signal-ink" : "bg-gold/12 text-gold-ink"}`}>
            {r.wants_meeting ? "Book" : "Reply"}
          </span>
        ) : r.waiting_on === "them" ? (
          <span className="text-xs text-muted-foreground">
            {r.next_channel ? `next: ${r.next_channel} ${isDue(r.next_touch_at) ? "due" : fmtDate(r.next_touch_at)}` : "waiting"}
          </span>
        ) : <span className="text-xs text-signal-ink">booked</span>}
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
        <h2 className={`text-sm font-semibold ${accent ? "text-gold-ink" : "text-foreground"}`}>{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{rows.length}</span>
        {hint && <span className="text-xs text-muted-foreground ml-auto">{hint}</span>}
      </div>
      <div className={`bg-card border rounded-xl overflow-hidden ${accent ? "border-gold/30" : "border-border"}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><tbody>
            {rows.map((r) => <ProspectRow key={r.id} r={r} onOpen={onOpen} />)}
          </tbody></table>
        </div>
      </div>
    </div>
  );
}

// A channel icon on the board tile: lit in its brand color when the handle is on file (and
// opens it in one click, without opening the record), dimmed when we don't have it — so the
// row doubles as an at-a-glance reachability map (email / phone / WhatsApp / LinkedIn / Build).
function TileAction({ href, active, title, color, children }: {
  href?: string; active: boolean; title: string; color: string; children: ReactNode;
}) {
  const base = "grid place-items-center w-6 h-6 rounded-md transition-colors shrink-0";
  if (!active || !href)
    return <span title={`${title} · not on file`} className={`${base} text-subtle/50`}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" title={title}
      onClick={(e) => e.stopPropagation()}
      className={`${base} hover:bg-secondary`} style={{ color }}>{children}</a>
  );
}

// ── board (kanban) ───────────────────────────────────────────────────
function BoardCard({ r, onOpen }: { r: Card; onOpen: (id: number) => void }) {
  const h = heatChip(r.heat);
  const dom = domainOf(r.email);
  const waHref = r.phone ? `https://wa.me/${r.phone.replace(/[^\d]/g, "")}` : undefined;
  const liHref = r.linkedin_url || (r.name ? linkedinSearchUrl(r.name, r.company) : undefined);
  const isNew = r.waiting_on === "us" && !!r.last_reply_at && (Date.now() - new Date(r.last_reply_at).getTime()) < 24 * 3600 * 1000;
  const wantsMeet = r.wants_meeting && r.waiting_on !== "closed";
  const owed = r.waiting_on === "us" ? daysSince(r.last_reply_at) : 0;
  // In the Booked column the clock is the CALL: upcoming date (green), no date yet
  // (gold, go book it), or a past date with no transcript = a no-show to rescue (red).
  const callClock = r.stage === "discovery_booked"
    ? (r.call_at
        ? (new Date(r.call_at).getTime() < Date.now() && !r.call_held_at
            ? { text: "call missed · rebook", cls: "text-danger-soft" }
            : { text: `call ${fmtDate(r.call_at)}`, cls: "text-signal-ink" })
        : { text: "no date · book it", cls: "text-gold-ink" })
    : null;
  // The footer clock reads differently per column: when the ball is with us it's a
  // "silent for N days" debt (loud past 3d); when it's on them it's the next scheduled
  // nudge; when closed it's the stage. This is the single most action-driving line.
  const clock = callClock ??
    (r.waiting_on === "us"
      ? { text: owed <= 0 ? "replied today" : `${owed}d silent`, cls: owed >= 7 ? "text-danger-soft" : owed >= 3 ? "text-warn" : "text-muted-foreground" }
      : r.waiting_on === "them"
      ? (r.gone_quiet_days
          // We answered, they went silent, nothing is scheduled: without this the
          // card fell out of every queue forever (the Hisham blind spot).
          ? { text: `quiet ${r.gone_quiet_days}d · nudge due`, cls: "text-gold-ink" }
          : { text: r.next_touch_at ? (isDue(r.next_touch_at) ? "nudge due" : `next ${fmtDate(r.next_touch_at)}`) : timeAgo(r.last_touch_at), cls: r.next_touch_at && isDue(r.next_touch_at) ? "text-gold-ink" : "text-muted-foreground" })
      : { text: r.stage_label || r.status_label, cls: "text-muted-foreground" });
  return (
    <div role="button" tabIndex={0} draggable
      onClick={() => onOpen(r.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(r.id); } }}
      onMouseEnter={() => loadDetail(r.id)}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(r.id))}
      className={`w-full text-left bg-card border border-border rounded-xl p-[18px] hover:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/40 cursor-pointer transition-colors ${rotEdge(r)}`}>
      {/* logo + COMPANY (primary) · person · title — heat + NEW top-right */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {dom
            ? <Favicon domain={dom} label={r.company} size={24} />
            : <div className="w-6 h-6 rounded-md bg-secondary grid place-items-center text-[10px] font-bold text-muted-foreground shrink-0">{initials(r.company || r.name)}</div>}
          <div className="min-w-0">
            {/* 1 · company */}
            <div className="font-semibold text-foreground text-[17px] leading-tight truncate">{r.company || r.email}</div>
            {/* 2 · prospect name */}
            <div className="text-[13px] text-foreground/80 truncate mt-0.5">{r.name}</div>
            {/* 3 · job title */}
            {r.job_title && <div className="text-[12px] text-muted-foreground truncate mt-0.5">{r.job_title}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isNew && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-gold text-ink-inverse" title="Fresh reply — came in within the last 24h">NEW</span>
          )}
          {r.waiting_on !== "closed" && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${h.cls}`} title={`Heat ${r.heat}${r.heat_reason ? " · " + r.heat_reason : ""}`}>
              {h.hot && <Flame className="w-2.5 h-2.5" />}{r.heat}
            </span>
          )}
        </div>
      </div>

      {/* their actual words — the context that makes this a cockpit, not a list */}
      {cleanSnippet(r.reply_snippet) && (
        <p className="mt-2.5 text-[12px] leading-snug text-muted-foreground line-clamp-2 border-l-2 border-gold/25 pl-2.5">
          {cleanSnippet(r.reply_snippet)}
        </p>
      )}

      {/* meta: country · value · the action-driving clock (the column already tells the stage) */}
      <div className="flex items-center gap-1.5 mt-3 text-[11px]">
        {r.country && <span className="text-subtle truncate max-w-[7rem]">{countryFlag(r.country) && <span className="mr-1">{countryFlag(r.country)}</span>}{r.country}</span>}
        {r.deal_amount != null && <span className="text-signal-ink font-semibold tabular-nums">${Number(r.deal_amount).toLocaleString()}</span>}
        <span className={`ml-auto tabular-nums ${clock.cls}`}>{clock.text}</span>
      </div>

      {/* pulse — who moved last, with direction: ↙ they replied · ↗ we sent (+channel) */}
      <div className="flex items-center gap-2.5 mt-1.5 text-[10px]">
        <span title="Last time THEY wrote to us" className="text-info/85">↙ they replied <span className="tabular-nums">{agoShort(r.last_reply_at)}</span></span>
        {/* EMAIL clock only — a call or WhatsApp never paints this line (email decides the turn) */}
        <span title="Last EMAIL we sent them" className="text-signal-ink">↗ we sent <span className="tabular-nums">{agoShort(r.last_email_touch_at ?? r.last_touch_at)}</span>{r.last_email_touch_at ? " · Email" : (r.last_channel ? ` · ${chLabel(r.last_channel)}` : "")}</span>
      </div>

      {/* channels — reachability at a glance + one-click open (email / call / WhatsApp / LinkedIn / Build) */}
      <div className="flex items-center gap-0.5 mt-1.5 -ml-1 pt-1.5 border-t border-border/40">
        {wantsMeet && (
          <span title="Asked to meet — send times / book" className="grid place-items-center w-6 h-6 text-gold-ink shrink-0">
            <CalendarClock className="w-3.5 h-3.5" />
          </span>
        )}
        <TileAction href={`mailto:${r.email}`} active={!!r.email} title="Email" color="#EA4335"><Mail className="w-3.5 h-3.5" /></TileAction>
        <TileAction href={r.phone ? `tel:${r.phone.replace(/[^\d+]/g, "")}` : undefined} active={!!r.phone} title="Call" color="#e6e6e6"><Phone className="w-3.5 h-3.5" /></TileAction>
        <TileAction href={waHref} active={!!r.phone} title="WhatsApp" color="#25D366"><MessageCircle className="w-3.5 h-3.5" /></TileAction>
        <TileAction href={r.linkedin_url || liHref} active={!!r.has_linkedin} title="LinkedIn profile" color="#0A66C2"><Link2 className="w-3.5 h-3.5" /></TileAction>
        <TileAction href={r.build_url || undefined} active={!!r.build_url} title={r.build_delivered ? "Build delivered — open" : "Build ready — open"} color={r.build_delivered ? "#26D07C" : "#FFD60A"}><Magnet className="w-3.5 h-3.5" /></TileAction>
        {r.build_delivered && <span className="text-[9px] text-signal-ink ml-0.5" title="Build delivered to prospect">sent</span>}
      </div>
    </div>
  );
}

// ── to-dos: the saved next steps, worked like a checklist ────────────
// A single next-step row: who + what to do + when, the channel quick-actions to DO it, and a
// Done button that logs the touch (so the board flips to "their turn" and the step clears).
function TodoRow({ r, onOpen, onChanged }: { r: Card; onOpen: (id: number) => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const dom = domainOf(r.email);
  const waHref = r.phone ? `https://wa.me/${r.phone.replace(/[^\d]/g, "")}` : undefined;
  const owe = r.waiting_on === "us";
  const ch = r.next_channel || "email";
  const due = !!r.next_touch_at && isDue(r.next_touch_at);
  const label = owe ? (r.wants_meeting ? "Book — they asked to meet" : "Reply owed")
    : `${ch.charAt(0).toUpperCase() + ch.slice(1)} follow-up`;
  const when = owe ? (daysSince(r.last_reply_at) <= 0 ? "today" : `${daysSince(r.last_reply_at)}d silent`)
    : (r.next_touch_at ? (due ? "due now" : fmtDate(r.next_touch_at)) : "");
  const done = () => {
    setBusy(true);
    fetch(`${API}/api/crm/prospect/${r.id}/touch`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: ch }),
    }).then((res) => { if (res.ok) onChanged(); }).finally(() => setBusy(false));
  };
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-secondary/40 transition-colors">
      <button onClick={() => onOpen(r.id)} onMouseEnter={() => loadDetail(r.id)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
        {dom
          ? <Favicon domain={dom} label={r.company} size={20} />
          : <div className="w-5 h-5 rounded-md bg-secondary grid place-items-center text-[9px] font-bold text-muted-foreground shrink-0">{initials(r.company || r.name)}</div>}
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {r.company || r.email} <span className="text-muted-foreground font-normal">· {r.name}</span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            <span className={owe || due ? "text-gold-ink" : ""}>{label}</span>{r.job_title ? ` · ${r.job_title}` : ""}
          </div>
        </div>
      </button>
      <span className={`text-[11px] tabular-nums shrink-0 hidden sm:block ${owe || due ? "text-gold-ink" : "text-muted-foreground"}`}>{when}</span>
      <div className="flex items-center gap-0.5 shrink-0">
        <TileAction href={`mailto:${r.email}`} active={!!r.email} title="Email" color="#EA4335"><Mail className="w-3.5 h-3.5" /></TileAction>
        <TileAction href={r.phone ? `tel:${r.phone.replace(/[^\d+]/g, "")}` : undefined} active={!!r.phone} title="Call" color="#e6e6e6"><Phone className="w-3.5 h-3.5" /></TileAction>
        <TileAction href={waHref} active={!!r.phone} title="WhatsApp" color="#25D366"><MessageCircle className="w-3.5 h-3.5" /></TileAction>
        <TileAction href={r.linkedin_url || (r.name ? linkedinSearchUrl(r.name, r.company) : undefined)} active={!!r.has_linkedin} title="LinkedIn" color="#0A66C2"><Link2 className="w-3.5 h-3.5" /></TileAction>
        <TileAction href={r.build_url || undefined} active={!!r.build_url} title="Build" color={r.build_delivered ? "#26D07C" : "#FFD60A"}><Magnet className="w-3.5 h-3.5" /></TileAction>
      </div>
      <button onClick={done} disabled={busy} title="Mark this step done — logs the touch and passes the ball to them"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-signal/40 px-2.5 py-1.5 text-xs text-signal-ink hover:bg-signal/10 disabled:opacity-40 transition-colors">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Done
      </button>
    </div>
  );
}

function TodoSection({ title, hint, rows, accent, onOpen, onChanged }: {
  title: string; hint?: string; rows: Card[]; accent?: boolean; onOpen: (id: number) => void; onChanged: () => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h2 className={`text-sm font-semibold ${accent ? "text-gold-ink" : "text-foreground"}`}>{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{rows.length}</span>
        {hint && <span className="text-xs text-muted-foreground ml-auto">{hint}</span>}
      </div>
      <div className={`bg-card border rounded-xl overflow-hidden ${accent ? "border-gold/30" : "border-border"}`}>
        {rows.map((r) => <TodoRow key={r.id} r={r} onOpen={onOpen} onChanged={onChanged} />)}
      </div>
    </div>
  );
}

function TodosView({ todos, onOpen, onChanged }: { todos: Card[]; onOpen: (id: number) => void; onChanged: () => void }) {
  if (todos.length === 0)
    return <div className="text-center text-muted-foreground py-16">No pending next steps — every active prospect is scheduled or waiting. 🎯</div>;
  const now = todos.filter((r) => r.waiting_on === "us" || (r.next_touch_at && isDue(r.next_touch_at)));
  const later = todos.filter((r) => !(r.waiting_on === "us" || (r.next_touch_at && isDue(r.next_touch_at))));
  return (
    <div className="space-y-6 max-w-3xl">
      <TodoSection title="// DO_NOW" hint="owed replies + follow-ups due today" rows={now} accent onOpen={onOpen} onChanged={onChanged} />
      <TodoSection title="// UPCOMING" hint="scheduled follow-ups ahead" rows={later} onOpen={onOpen} onChanged={onChanged} />
    </div>
  );
}

function BoardColumn({ title, hint, accent, tone, rows, onOpen, onDrop }: {
  title: string; hint?: string; accent?: boolean; tone?: "green" | "muted";
  rows: Card[]; onOpen: (id: number) => void; onDrop?: (id: number) => void;
}) {
  const [over, setOver] = useState(false);
  const ring = tone === "green" ? "bg-signal/8 ring-1 ring-signal/40"
    : tone === "muted" ? "bg-muted/20 ring-1 ring-border" : "bg-gold/6 ring-1 ring-gold/40";
  return (
    <div
      onDragOver={onDrop ? (e) => { e.preventDefault(); setOver(true); } : undefined}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop ? (e) => { e.preventDefault(); setOver(false); const id = Number(e.dataTransfer.getData("text/plain")); if (id) onDrop(id); } : undefined}
      className={`shrink-0 w-[24.5rem] rounded-2xl p-2.5 border transition-colors ${over ? ring : "bg-white/[0.018] border-white/[0.055]"}`}>
      <div className="px-2 py-1.5 mb-1 border-b border-border/60">
        <div className="flex items-center gap-2">
          <h3 className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-gold-ink" : tone === "green" ? "text-signal-ink" : "text-foreground"}`}>{title}</h3>
          <span className="text-xs text-muted-foreground tabular-nums ml-auto">{rows.length}</span>
        </div>
        {hint && <p className="text-[10px] text-subtle mt-0.5">{hint}</p>}
      </div>
      <div className="space-y-2 max-h-[calc(100vh-13rem)] overflow-y-auto pr-1 pt-1">
        {rows.map((r) => <BoardCard key={r.id} r={r} onOpen={onOpen} />)}
        {rows.length === 0 && <div className="text-[11px] text-subtle px-2 py-6 text-center border border-dashed border-border/50 rounded-lg">drop here</div>}
      </div>
    </div>
  );
}

// The funnel = our lead journey, in order. Each column is a stage; drag a card right as
// the deal advances. Kept in sync with the backend FUNNEL_STAGES.
// Per-column sort — the controls a VP actually works a pipeline by.
type SortKey = "heat" | "stalled" | "value" | "recent" | "they" | "we" | "name";
// Four orders only (Jose, 30 jul): the two directions, urgency, and rot.
// "Last activity" was redundant with the two directions; Best-fit ≈ Priority; A–Z unused.
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "they", label: "↙ They replied (newest)" },
  { key: "we", label: "↗ We sent (newest)" },
  { key: "heat", label: "🔥 Priority (hottest)" },
  { key: "stalled", label: "🕒 Most stalled" },
];
function catRank(cat: string): number {
  const c = (cat || "").toLowerCase();
  if (c.includes("positive") || c.includes("sql")) return 3;
  if (c.includes("mql")) return 2;
  if (c.includes("neg") || c.includes("not")) return 0;
  return 1;
}
// Filters are combinable (AND): a card must pass EVERY active filter. The tiles cover the
// status filters (with counts); the chip bar adds Build / reach / cadence / last-touch
// dimensions so Jose can isolate exactly the cohort he wants to work, Master-Inbox style.
// Note: "WhatsApp/LinkedIn" here mean reachable-on / last-touched-on (we track a single
// last_channel + seq_step, not a full per-channel send log), so they are the best proxy
// available client-side, not a literal "we sent a LinkedIn DM" flag.
type FilterKey =
  | "us" | "them" | "nudge" | "hot" | "wants" | "meetings"
  | "build_sent" | "build_ready" | "no_build"
  | "has_phone" | "has_linkedin";

const FILTERS: { key: FilterKey; label: string; group: string; test: (c: Card) => boolean }[] = [
  { key: "us",       label: "⚡ Your turn",      group: "Status", test: (c) => c.waiting_on === "us" },
  { key: "them",     label: "Waiting on them",   group: "Status", test: (c) => c.waiting_on === "them" },
  { key: "nudge",    label: "⏰ Nudge due",       group: "Status", test: (c) => c.waiting_on === "them" && !!c.next_touch_at && new Date(c.next_touch_at).getTime() <= Date.now() },
  { key: "hot",      label: "🔥 Hot",            group: "Status", test: (c) => c.heat >= 70 },
  { key: "wants",    label: "📅 Wants meeting",   group: "Status", test: (c) => c.wants_meeting },
  { key: "meetings", label: "✅ Booked",          group: "Status", test: (c) => c.status === "meeting_booked" },
  { key: "build_sent",  label: "🧲 Build sent",        group: "Build", test: (c) => c.build_delivered },
  // The goldmine state: the asset exists, the prospect has never seen it. 44 cards on day one.
  { key: "build_ready", label: "💤 Build never sent",  group: "Build", test: (c) => c.has_build && !c.build_delivered },
  { key: "no_build",    label: "No Build",             group: "Build", test: (c) => !c.has_build },
  { key: "has_phone",    label: "☎ Phone / WhatsApp", group: "Reach", test: (c) => c.has_phone },
  { key: "has_linkedin", label: "🔗 LinkedIn",        group: "Reach", test: (c) => c.has_linkedin },
];
const FILTER_BY_KEY = Object.fromEntries(FILTERS.map((f) => [f.key, f.test])) as Record<FilterKey, (c: Card) => boolean>;
function passesAll(c: Card, active: Set<FilterKey>): boolean {
  for (const k of active) { if (!FILTER_BY_KEY[k]?.(c)) return false; }
  return true;
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
      // Jose's rule (30 jul): freshest activity on EITHER side first — the latest of
      // "they wrote" / "we wrote", newest to oldest. Matches the ↙/↗ line every card
      // already shows, so the column order and the card agree.
      return r.sort((a, b) =>
        Math.max(ms(b.last_reply_at), ms(b.last_touch_at)) - Math.max(ms(a.last_reply_at), ms(a.last_touch_at)));
    case "they": // their last inbound, newest first (Instantly-unibox order)
      return r.sort((a, b) => ms(b.last_reply_at) - ms(a.last_reply_at));
    case "we": // our last EMAIL, newest first (calls/WA do not count — email decides)
      return r.sort((a, b) => ms(b.last_email_touch_at ?? b.last_touch_at) - ms(a.last_email_touch_at ?? a.last_touch_at));
    case "name":
      return r.sort((a, b) => a.name.localeCompare(b.name));
    default: // heat
      return r.sort((a, b) => b.heat - a.heat || ms(a.last_reply_at) - ms(b.last_reply_at));
  }
}

// The two call columns ignore the global sort: what matters there is the CALL.
// Booked: soonest call first, then no-shows/undated (they need action, not hiding).
// Held: most recent call first (freshest context, recap owed).
function sortColumn(list: Card[], stageKey: string, by: SortKey): Card[] {
  const ms = (s?: string | null) => (s ? new Date(s).getTime() : 0);
  if (stageKey === "discovery_booked") {
    const FAR = 8.64e15; // undated sinks below any real date
    return [...list].sort((a, b) => (ms(a.call_at) || FAR) - (ms(b.call_at) || FAR) || b.heat - a.heat);
  }
  if (stageKey === "discovery_held") {
    return [...list].sort((a, b) => ms(b.call_held_at) - ms(a.call_held_at) || b.heat - a.heat);
  }
  return sortCards(list, by);
}

const FUNNEL: { key: string; title: string; hint: string; tone?: "green" | "muted" }[] = [
  { key: "mql",              title: "MQL",              hint: "replied · mild interest" },
  { key: "sql",              title: "SQL",              hint: "asked for something concrete" },
  { key: "discovery_booked", title: "Discovery booked", hint: "call scheduled · make it happen" },
  { key: "discovery_held",   title: "Discovery held",   hint: "call done · work the follow-up" },
  { key: "proposal_sent",    title: "Proposal sent",    hint: "after they saw the Build" },
  { key: "won",              title: "Won",              hint: "closed · client", tone: "green" },
  { key: "lost",             title: "Lost / Parked",    hint: "dead or not now", tone: "muted" },
];

// ── page ─────────────────────────────────────────────────────────────
export function CrmBoard({ workspace, basePath = "/crm", live = true, canBuild = false }: { workspace?: string; basePath?: string; live?: boolean; canBuild?: boolean }) {
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [rows, setRows] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const toggleFilter = (k: FilterKey) => setFilters((prev) => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const [view, setView] = useState<"queue" | "board" | "todos">("board");
  const [sortBy, setSortBy] = useState<SortKey>("they");
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => {
    // Until engaged_prospects carries a per-client column, only Luxvance's book
    // is real; a client workspace shows an honest empty pipeline (not Luxvance's).
    if (!live) { setRows([]); setFunnel(null); setLoading(false); return; }
    setLoading(true);
    fetch(`${API}/api/crm/prospects${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}`).then((r) => r.json())
      .then((j) => { setFunnel(j.funnel); setRows(j.prospects || []); })
      .catch(() => { setFunnel(null); setRows([]); })
      .finally(() => setLoading(false));
  }, [live]);
  useEffect(() => { load(); }, [load]);

  // Deep link: /crm?lead=<id> opens that prospect straight away (from a Slack alert).
  // Keep the URL in sync so back/close and sharing behave.
  const openRecord = useCallback((id: number | null) => {
    setOpenId(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", id ? `${basePath}?lead=${id}` : basePath);
    }
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("lead");
    if (p && !isNaN(Number(p))) setOpenId(Number(p));
  }, []);
  // Live-sync: on open, ask the server to refresh the queue from the real Instantly
  // threads (catches replies/sends made anywhere), then pull the fresh data.
  useEffect(() => {
    if (!live) return;
    fetch(`${API}/api/crm/refresh${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}`, { method: "POST" })
      .then((r) => r.json())
      .then((j) => { if (j.started) setTimeout(load, 12000); })
      .catch(() => {});
  }, [load, live]);

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
    const r = rows.filter((x) => matchQuery(x, q) && passesAll(x, filters));
    const ms = (s: string | null) => (s ? new Date(s).getTime() : 0);
    // Hottest first: heat desc, then most-overdue.
    const us = r.filter((x) => x.waiting_on === "us").sort((a, b) => b.heat - a.heat || ms(a.last_reply_at) - ms(b.last_reply_at));
    const them = r.filter((x) => x.waiting_on === "them").sort((a, b) => ms(a.next_touch_at) - ms(b.next_touch_at));
    const closed = r.filter((x) => x.waiting_on === "closed");
    return { us, them, closed };
  }, [rows, q, filters]);

  // The work queue in triage order (your-turn hottest → waiting → closed) so the open card
  // can step prev/next through exactly the stack Jose is working, without closing it.
  const queueIds = useMemo(() => [...groups.us, ...groups.them, ...groups.closed].map((c) => c.id), [groups]);

  // To-dos = the saved next steps across the pipeline: replies we owe + scheduled follow-ups.
  // Ordered so the ones to do NOW (owed replies, overdue nudges) float to the top.
  const todos = useMemo(() => {
    const ms = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0);
    const items = rows.filter((x) => matchQuery(x, q) && passesAll(x, filters)
      && x.waiting_on !== "closed" && (x.waiting_on === "us" || !!x.next_touch_at));
    const rank = (x: Card) => (x.waiting_on === "us" ? 0 : (x.next_touch_at && isDue(x.next_touch_at) ? 1 : 2));
    return items.sort((a, b) => rank(a) - rank(b) || ms(a.next_touch_at) - ms(b.next_touch_at) || b.heat - a.heat);
  }, [rows, q, filters]);

  // While dragging a card, auto-scroll the board when the cursor nears either edge, so you can
  // drag a lead all the way to Lost / Closed without fighting the horizontal scroll.
  const boardRef = useRef<HTMLDivElement>(null);
  const autoScroll = (e: React.DragEvent) => {
    const el = boardRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const edge = 100;
    if (e.clientX > rect.right - edge) el.scrollLeft += 24;
    else if (e.clientX < rect.left + edge) el.scrollLeft -= 24;
  };

  if (!live) {
    return (
      <div className="w-full">
        <h1 className="text-xl font-bold neon tracking-tight mb-6">// {(workspace ?? "warm").toUpperCase().replace(/-/g, "_")}_LIVE_DEALS</h1>
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <div className="text-[15px] font-semibold text-foreground">No warm leads yet</div>
          <p className="mt-1.5 text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed">
            When a prospect replies to a campaign they land here as a warm lead — replied, scored and ready to close.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CanBuildCtx.Provider value={canBuild}>
    <WorkspaceCtx.Provider value={workspace}>
    <div className="w-full">
      <div className="crm-ambient" aria-hidden />
      {/* one compact command bar: identity · search · view · sort · refresh */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-xl font-bold neon tracking-tight mr-1 shrink-0">// {(workspace ?? "luxvance").toUpperCase().replace(/-/g, "_")}_LIVE_DEALS</h1>
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email…"
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50" />
        </div>
        <div className="flex items-center bg-card border border-border rounded-lg p-0.5 shrink-0">
          <button onClick={() => setView("board")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "board" ? "bg-gold/12 text-gold-ink" : "text-muted-foreground"}`}>
            <LayoutGrid className="w-4 h-4" /> Board
          </button>
          <button onClick={() => setView("queue")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "queue" ? "bg-gold/12 text-gold-ink" : "text-muted-foreground"}`}>
            <List className="w-4 h-4" /> Queue
          </button>
          <button onClick={() => setView("todos")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "todos" ? "bg-gold/12 text-gold-ink" : "text-muted-foreground"}`}>
            <Check className="w-4 h-4" /> To-dos
          </button>
        </div>
        <button onClick={load} title="Refresh" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-2 py-1.5 shrink-0">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <Briefing onOpen={openRecord} workspace={workspace} />

      {/* the tiles ARE the filters: click to narrow the pipeline, click again to clear */}
      {funnel && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          <Tile label="⚡ Your turn" value={funnel.waiting_us} accent active={filters.has("us")} onClick={() => toggleFilter("us")} />
          <Tile label="⏰ Due" value={funnel.due_now} icon={funnel.due_now > 0 ? <CalendarClock className="w-4 h-4 text-gold-ink" /> : undefined} active={filters.has("nudge")} onClick={() => toggleFilter("nudge")} />
          <Tile label="Hot now" value={funnel.hot_now} icon={<Flame className="w-4 h-4 text-danger-soft" />} active={filters.has("hot")} onClick={() => toggleFilter("hot")} />
          <Tile label="Want to meet" value={funnel.wants_meeting} active={filters.has("wants")} onClick={() => toggleFilter("wants")} />
          <Tile label="Waiting on them" value={funnel.waiting_them} active={filters.has("them")} onClick={() => toggleFilter("them")} />
          <Tile label="Meetings" value={funnel.by_status?.meeting_booked?.count || 0} active={filters.has("meetings")} onClick={() => toggleFilter("meetings")} />
        </div>
      )}

      {/* filter chip bar — combinable (AND), Master-Inbox style: isolate the exact cohort to work.
          The sort selector lives HERE, next to the cards it orders (Jose, 30 jul). */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
          title="Sort each column"
          className="bg-card border border-border rounded-full px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-gold/40 cursor-pointer shrink-0">
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <span className="w-px h-4 bg-border mx-1" />
        {FILTERS.filter((f) => f.group !== "Status").map((f) => {
          const on = filters.has(f.key);
          return (
            <button key={f.key} onClick={() => toggleFilter(f.key)} title={f.group}
              className={`text-[11px] rounded-full border px-2.5 py-1 transition-colors ${on ? "bg-gold/15 border-gold/50 text-gold-ink font-medium" : "border-border text-muted-foreground hover:text-foreground hover:border-gold/30"}`}>
              {f.label}
            </button>
          );
        })}
        {filters.size > 0 && (
          <button onClick={() => setFilters(new Set())}
            className="text-[11px] rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-danger-soft hover:border-danger-soft/40 inline-flex items-center gap-1 transition-colors">
            Clear all ({filters.size}) <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-16">Loading…</div>
      ) : view === "todos" ? (
        <TodosView todos={todos} onOpen={openRecord} onChanged={load} />
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
        <div ref={boardRef} onDragOver={autoScroll} className="flex gap-3 overflow-x-auto pb-4">
          {FUNNEL.map((s) => {
            const col = sortColumn(rows.filter((x) => matchQuery(x, q) && passesAll(x, filters) && (x.stage || "mql") === s.key), s.key, sortBy);
            return (
              <BoardColumn key={s.key} title={s.title} hint={s.hint} tone={s.tone}
                accent={s.key === "sql"} rows={col} onOpen={openRecord}
                onDrop={(id) => moveStage(id, s.key)} />
            );
          })}
        </div>
      )}

      {openId !== null && <Record id={openId} initial={rows.find((r) => r.id === openId)} queue={queueIds} onNavigate={openRecord} onClose={() => openRecord(null)} onChanged={load} />}
    </div>
    </WorkspaceCtx.Provider>
    </CanBuildCtx.Provider>
  );
}
