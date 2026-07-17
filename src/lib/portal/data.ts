import { cache } from "react";
import { db } from "./server";
import type {
  Workspace, WorkspaceData, TargetList, Lead, OutreachChannel, Kpi, JourneyItem,
  CrmCard, CrmStage, ReplyCategory, BlocklistEntry, BlocklistReason, BlocklistSource,
  IntelligenceSection, IntelligenceKind, RoadmapItem,
} from "./types";

// Relationship timeline shown inside the Library module. Seeded per workspace
// here (real milestones); move to a `workspace_events` table when the volume
// justifies it. Dates are ISO literals — never computed at runtime.
const JOURNEY_SEED: Record<string, JourneyItem[]> = {
  "arco-irish": [
    { id: "aj1", date: "2026-06-25", kind: "call", title: "Onboarding & discovery call", detail: "Captured Paul's voice, ICP and assets: boutique executive search, sells to CEO/founder (not HR), British English, punchy-not-formal.", tags: ["voice", "ICP"] },
    { id: "aj2", date: "2026-07-01", kind: "milestone", title: "Retainer starts", detail: "Build & Operate plan begins. Arco Irish is the first Apex pilot.", tags: ["commercial"] },
    { id: "aj3", date: "2026-07-03", kind: "decision", title: "ICP & blocklist locked", detail: "Confirmed 30–300 employees, no in-house HR proxy. Do-not-contact list locked (6 clients + anchors + 26 competitors).", tags: ["targeting"] },
    { id: "aj4", date: "2026-07-14", kind: "build", title: "Campaign built · list live", detail: "1,113 verified leads sourced across 4 lists (No-HR, Has-HR, Company Direct, VIP). Copy drafted, intelligence library live.", tags: ["build", "leads"] },
    { id: "aj5", date: "2026-07-15", kind: "decision", title: "Review call — copy in Paul's voice", detail: "Reverted to Paul's single canonical version (no randomisation), added his phone to the signature, removed Zartis, agreed LinkedIn content 2x/month. CRM in build.", tags: ["copy", "voice"] },
  ],
};

// Workspace-scoped reads from Supabase. Every function returns null when the DB
// client is absent (no service key) so callers fall back to mock data. Emails
// are masked HERE (server side) — the raw address never reaches the client UI.

const CHANNELS: OutreachChannel[] = ["email", "linkedin", "whatsapp", "call", "ads"];
function toChannels(v: unknown): OutreachChannel[] {
  if (!Array.isArray(v)) return [];
  return v.filter((c): c is OutreachChannel => CHANNELS.includes(c as OutreachChannel));
}

// "andrei@circularo.com" -> "a••••@circularo.com"
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "";
  const [local, domain] = email.split("@");
  const head = local.slice(0, 1) || "•";
  return `${head}••••@${domain}`;
}

function workspaceFromRow(row: Record<string, unknown>, coldLeads: number): Workspace {
  return {
    slug: String(row.slug),
    name: String(row.name ?? row.slug),
    owner: String(row.owner_name ?? ""),
    ownerRole: String(row.owner_role ?? ""),
    plan: String(row.plan ?? ""),
    accent: String(row.accent ?? "#FFD60A"),
    live: row.live !== false,
    coldLeads,
    warmLeads: 0, // filled by the CRM loader when that module is wired
    meetings: 0,
    pipelineUsd: 0,
  };
}

// Columns every caller needs. The rendered email/LinkedIn bodies are deliberately
// NOT here: they are ~1.7MB of the ~2MB this used to transfer, and only the Target
// Lists table (which previews and sends them) ever reads them. Callers that just
// count — the dashboard and the channel modules — pass withBodies:false and move
// ~100KB instead.
const LEAD_COLS =
  "id,list_id,list_segment,full_name,role,company,sector,domain,email,linkedin_url,has_draft,phone,why_now,hr_lead_name,hr_lead_title";
// Email 1 (previewed + sent from the table) and the VIP's prepared LinkedIn note.
// Email 2/3 and linkedin2 are per-lead in the DB but nothing renders them yet;
// they stay out so the table doesn't carry another megabyte for nothing.
const LEAD_BODY_COLS = "email1_subject,email1_body,linkedin1";

// Target Lists module: the workspace, its 4 lists, and every lead.
// Addresses are masked by default; pass unmask for the owning client (they paid for
// these leads and exported them in the old portal) — never for a demo prospect.
export const loadTargetLists = cache(async function loadTargetLists(
  slug: string,
  opts: { unmask?: boolean; withBodies?: boolean } = {}
): Promise<{ ws: Workspace; lists: TargetList[]; leads: Lead[] } | null> {
  const sb = db();
  if (!sb) return null;
  const withBodies = opts.withBodies !== false;

  const { data: wsRow } = await sb.from("workspaces").select("*").eq("slug", slug).maybeSingle();
  if (!wsRow) return null;
  const wsId = wsRow.id as string;

  const { data: listRows } = await sb
    .from("target_lists")
    .select("*")
    .eq("workspace_id", wsId)
    .order("created_at", { ascending: true });

  // PostgREST caps rows per request (server max-rows, ~1000), so this pages through
  // the leads. Round-trip latency dominates here, not bytes, so the pages go out at
  // once: target_lists already carries lead_count, which tells us how many to expect.
  // If those counts are stale we keep paging sequentially from where they ran out,
  // so a wrong count can never silently truncate a client's list.
  const PAGE = 1000;
  const cols = withBodies ? `${LEAD_COLS},${LEAD_BODY_COLS}` : LEAD_COLS;
  // `cols` is built at runtime, so supabase-js can't infer the row shape from the
  // select literal — hence the cast to a plain record, which the mapper below reads.
  const page = async (from: number): Promise<Record<string, unknown>[]> => {
    const { data } = await sb
      .from("target_list_leads")
      .select(cols)
      .eq("workspace_id", wsId)
      .range(from, from + PAGE - 1);
    return (data ?? []) as unknown as Record<string, unknown>[];
  };

  const expected = (listRows ?? []).reduce((n, r) => n + Number(r.lead_count ?? 0), 0);
  const upfront = Math.max(1, Math.ceil(expected / PAGE));
  const settled = await Promise.all(
    Array.from({ length: upfront }, (_, i) => page(i * PAGE))
  );

  const leadRows: Record<string, unknown>[] = [];
  let short = false;
  for (const rows of settled) {
    leadRows.push(...rows);
    if (rows.length < PAGE) short = true;
  }
  for (let from = upfront * PAGE; !short && from < 50000; from += PAGE) {
    const rows = await page(from);
    leadRows.push(...rows);
    if (rows.length < PAGE) break;
  }

  const leads: Lead[] = (leadRows ?? []).map((r) => {
    const email = (r.email as string | null) || "";
    const subject = String(r.email1_subject ?? "");
    const body = String(r.email1_body ?? "");
    // No precomputed mailto href. It embeds the whole body percent-encoded, so every
    // email would cross the wire twice (once as text, once inside the link) — on a
    // 1,113-lead list that was ~3MB of pure duplication. The client builds the link
    // on click instead. `canSend` also carries the masking rule: only the owner, who
    // has the real address in emailDisplay, ever gets a sendable link.
    const canSend = Boolean(email && body && opts.unmask);
    return {
      id: String(r.id),
      listId: String(r.list_id),
      segment: (r.list_segment as string | null) || undefined,
      name: String(r.full_name ?? ""),
      role: String(r.role ?? ""),
      company: String(r.company ?? ""),
      sector: String(r.sector ?? ""),
      domain: String(r.domain ?? ""),
      emailDisplay: opts.unmask ? email : maskEmail(email),
      linkedin: Boolean(r.linkedin_url),
      linkedinUrl: (r.linkedin_url as string | null) || undefined,
      hasEmail: Boolean(email),
      hasDraft: Boolean(r.has_draft ?? body),
      emailSubject: subject || undefined,
      emailBody: body || undefined,
      canSend,
      // White-glove fields — the VIP tab works these by hand (phone, LinkedIn note,
      // the dated signal). Masked for a demo prospect, same rule as the address.
      phone: opts.unmask ? (r.phone as string | null) || undefined : undefined,
      whyNow: (r.why_now as string | null) || undefined,
      linkedinNote: (r.linkedin1 as string | null) || undefined,
      hrLeadName: (r.hr_lead_name as string | null) || undefined,
      hrLeadTitle: (r.hr_lead_title as string | null) || undefined,
    };
  });

  const lists: TargetList[] = (listRows ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    note: String(r.note ?? ""),
    count: Number(r.lead_count ?? leads.filter((l) => l.listId === String(r.id)).length),
    channels: toChannels(r.channels),
  }));

  return { ws: workspaceFromRow(wsRow, leads.length), lists, leads };
});

// Just the workspace + its cold-lead count, for pages that show a name and a badge
// (roadmap, blocklist, library). They used to call loadTargetLists, which drags
// every lead and every rendered email body — ~2MB and ~4s — to render a heading.
// The count comes back as a header, so no lead rows cross the wire at all.
export const loadWorkspace = cache(async function loadWorkspace(
  slug: string
): Promise<Workspace | null> {
  const sb = db();
  if (!sb) return null;

  const { data: wsRow } = await sb.from("workspaces").select("*").eq("slug", slug).maybeSingle();
  if (!wsRow) return null;

  const { count } = await sb
    .from("target_list_leads")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", wsRow.id as string);

  return workspaceFromRow(wsRow as Record<string, unknown>, count ?? 0);
});

// Stable, readable deep-link key for a list, derived from its name. Used by the
// sidebar (to build ?list=<key> links) and the Target Lists view (to preselect the
// tab). The list's DB id is NOT stable — the loader deletes and recreates the rows
// on every reload — so we key on the name, which does not change.
export function listKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Just the workspace's lists (id, name, count, key), no leads. The sidebar lists
// each one as its own menu item; this reads 4 tiny rows instead of loadTargetLists'
// ~1MB. Ordered as created (List 1, 2, 3, then VIP).
export const loadListsMeta = cache(async function loadListsMeta(
  slug: string
): Promise<{ key: string; name: string; count: number }[]> {
  const sb = db();
  if (!sb) return [];
  const { data: wsRow } = await sb.from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (!wsRow) return [];
  const { data: rows } = await sb
    .from("target_lists")
    .select("name, lead_count")
    .eq("workspace_id", wsRow.id as string)
    .order("created_at", { ascending: true });
  return (rows ?? []).map((r) => ({
    key: listKey(String(r.name ?? "")),
    name: String(r.name ?? ""),
    count: Number(r.lead_count ?? 0),
  }));
});

// ── Warm pipeline (CRM) ──────────────────────────────────────────────────────
// Sourced from the same Render CRM API the internal cockpit uses, so the portal
// and the cockpit always show identical numbers.
//
// The CRM is a product EVERY workspace has; the hot leads inside it belong to one
// workspace only. That isolation is enforced server-side: crm_api.py resolves the
// ?workspace slug to an id, filters engaged_prospects by it, and returns nothing
// when the slug is unknown or missing. There is deliberately no allowlist here —
// an allowlist would be a client-side gate on other clients' data, and the first
// person to add a slug to it would leak Luxvance's book. A workspace with no
// replies yet (Arco, until its first) simply comes back empty, which is the truth.
const CRM_API = process.env.NEXT_PUBLIC_BACKEND_URL || "https://agency-os-api.onrender.com";

const STAGES: CrmStage[] = ["neutral", "mql", "sql", "discovery", "proposal_sent", "won", "lost"];
const CATEGORIES: ReplyCategory[] = ["Positive/SQL", "MQL", "Neutral", "Negative"];
const CH_MAP: Record<string, OutreachChannel> = {
  email: "email", linkedin: "linkedin", whatsapp: "whatsapp", call: "call",
};

function toStage(v: unknown): CrmStage {
  const s = String(v ?? "");
  return STAGES.includes(s as CrmStage) ? (s as CrmStage) : "neutral";
}
function toCategory(v: unknown): ReplyCategory {
  const s = String(v ?? "");
  return CATEGORIES.includes(s as ReplyCategory) ? (s as ReplyCategory) : "Neutral";
}
function toChannel(v: unknown): OutreachChannel | null {
  return CH_MAP[String(v ?? "").toLowerCase()] ?? null;
}

export async function loadCrm(
  slug: string
): Promise<{ cards: CrmCard[]; warm: number; meetings: number }> {
  const empty = { cards: [] as CrmCard[], warm: 0, meetings: 0 };
  if (!slug) return empty; // never ask the API for "every workspace"
  try {
    const [pRes, sRes] = await Promise.all([
      fetch(`${CRM_API}/api/crm/prospects?workspace=${encodeURIComponent(slug)}`, { next: { revalidate: 60 } }),
      fetch(`${CRM_API}/api/crm/summary?workspace=${encodeURIComponent(slug)}`, { next: { revalidate: 60 } }),
    ]);
    const pJson = pRes.ok ? await pRes.json() : null;
    const sJson = sRes.ok ? await sRes.json() : null;
    const rows: Record<string, unknown>[] = Array.isArray(pJson)
      ? pJson
      : Array.isArray(pJson?.prospects)
        ? pJson.prospects
        : [];

    const cards: CrmCard[] = rows.map((r) => {
      const chans = [toChannel(r.last_channel), toChannel(r.next_channel)];
      if (r.has_linkedin) chans.push("linkedin");
      const channels = Array.from(new Set(chans.filter(Boolean))) as OutreachChannel[];
      const nextCh = toChannel(r.next_channel);
      const next = r.wants_meeting
        ? "Send calendar link"
        : nextCh
          ? `Next: ${nextCh[0].toUpperCase()}${nextCh.slice(1)}`
          : String(r.stage_label ?? "Follow up");
      return {
        id: String(r.id),
        stage: toStage(r.stage),
        company: String(r.company ?? ""),
        person: String(r.name ?? ""),
        personRole: String(r.job_title ?? ""),
        category: toCategory(r.category),
        snippet: String(r.reply_snippet ?? ""),
        country: String(r.country ?? ""),
        heat: Number(r.heat ?? 0),
        next,
        channels,
        buildSent: Boolean(r.has_build || r.build_delivered),
      };
    });

    const warm = Number(sJson?.counts?.total ?? cards.length);
    const meetings = Number(sJson?.counts?.meetings ?? 0);
    return { cards, warm, meetings };
  } catch {
    return empty;
  }
}

// ── Blocklist (do-not-contact) ───────────────────────────────────────────────
// This workspace's own entries plus any global (workspace_id null) ones. Tolerant:
// returns [] if the table doesn't exist yet or the DB is absent, so the module
// renders an empty state instead of erroring.
const BL_REASONS: BlocklistReason[] = ["client", "competitor", "unsubscribe"];
function toReason(v: unknown): BlocklistReason {
  const s = String(v ?? "");
  return BL_REASONS.includes(s as BlocklistReason) ? (s as BlocklistReason) : "competitor";
}

export async function loadBlocklist(slug: string): Promise<BlocklistEntry[]> {
  const sb = db();
  if (!sb) return [];
  const { data: wsRow } = await sb.from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (!wsRow) return [];
  const wsId = wsRow.id as string;

  const { data, error } = await sb
    .from("blocklist")
    .select("*")
    .or(`workspace_id.eq.${wsId},workspace_id.is.null`)
    .order("reason", { ascending: true })
    .order("company_name", { ascending: true });
  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    reason: toReason(r.reason),
    companyName: String(r.company_name ?? ""),
    domain: String(r.domain ?? ""),
    email: String(r.email ?? ""),
    personName: String(r.person_name ?? ""),
    linkedinUrl: String(r.linkedin_url ?? ""),
    note: String(r.note ?? ""),
    source: (String(r.source ?? "manual") as BlocklistSource),
    global: r.workspace_id == null,
    createdAt: String(r.created_at ?? ""),
  }));
}

// ── Intelligence Library (Octave-style client brain) ─────────────────────────
// ONE table, two readers: this portal renders it, and the reply/outreach LLM
// loads the very same rows as mandatory context before writing. Tolerant: []
// until the table exists, so the module shows an honest empty state.
const INTEL_KINDS: IntelligenceKind[] = [
  "playbook", "overview", "founder", "voice", "icp", "offer", "differentiator",
  "proof", "segment", "persona", "objection", "asset", "call_note", "research",
];
function toIntelKind(v: unknown): IntelligenceKind {
  const s = String(v ?? "");
  return INTEL_KINDS.includes(s as IntelligenceKind) ? (s as IntelligenceKind) : "overview";
}

export async function loadIntelligence(slug: string): Promise<IntelligenceSection[]> {
  const sb = db();
  if (!sb) return [];
  const { data: wsRow } = await sb.from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (!wsRow) return [];
  const { data, error } = await sb
    .from("intelligence_library")
    .select("*")
    .eq("workspace_id", wsRow.id as string)
    .order("sort", { ascending: true });
  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    kind: toIntelKind(r.kind),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    meta: (r.meta && typeof r.meta === "object" ? (r.meta as Record<string, string>) : undefined),
    sort: Number(r.sort ?? 0),
    updatedAt: String(r.updated_at ?? ""),
  }));
}

// ── Client Success Roadmap (delivery log + what's next) ──────────────────────
// Its own module. Operational log of what Luxvance has done for the client since
// kickoff, plus what's still pending. Seeded per workspace here (never any client
// relationship / competitor names — that's the Blocklist's job). Move to a
// `client_roadmap` table when the volume justifies it.
const ROADMAP_SEED: Record<string, RoadmapItem[]> = {
  "arco-irish": [
    { id: "r1", date: "2026-06-25", status: "done", kind: "call", title: "Onboarding & discovery call", detail: "Captured Paul's voice, ICP and assets: boutique executive search selling to the CEO (not HR), British English, punchy but not too formal.", tags: ["voice", "ICP"] },
    { id: "r2", date: "2026-07-01", status: "done", kind: "milestone", title: "Retainer starts", detail: "Build & Operate plan begins. Arco Irish is the first Apex pilot.", tags: ["commercial"] },
    { id: "r3", date: "2026-07-03", status: "done", kind: "decision", title: "ICP & blocklist locked", detail: "Confirmed 30–300 employees with no in-house HR proxy. The do-not-contact list was locked and moved into the Blocklist module.", tags: ["targeting"] },
    { id: "r4", date: "2026-07-14", status: "done", kind: "build", title: "Campaign built · list live", detail: "1,113 verified leads sourced across 4 target lists. Copy drafted and the intelligence library went live.", tags: ["build", "leads"] },
    { id: "r5", date: "2026-07-15", status: "done", kind: "decision", title: "Review call — copy in Paul's voice", detail: "Locked Paul's single canonical version (no randomisation), added his phone to the signature and agreed LinkedIn content twice a month.", tags: ["copy", "voice"] },
    { id: "r6", date: "2026-07-16", status: "in_progress", kind: "build", title: "Client workspace live", detail: "Arco's own portal: target lists, the Live Deals CRM, the intelligence library, the blocklist and this roadmap — all in one place.", tags: ["platform"] },
    { id: "r7", date: "", status: "planned", kind: "launch", title: "Campaign go-live", detail: "Approve the final copy with Paul, then start sending about two emails a week with a three-day follow-up. Target 5% reply rate.", tags: ["launch"] },
    { id: "r8", date: "", status: "planned", kind: "milestone", title: "LinkedIn content · twice a month", detail: "Repurpose Paul's older posts into a steady organic presence, plus a short trust-building video down the line.", tags: ["content"] },
    { id: "r9", date: "2026-08-08", status: "planned", kind: "milestone", title: "August cover — Apex pilot", detail: "While Paul is away (8–16 Aug), Apex drafts replies, pre-books from the calendar and alerts Paul on WhatsApp within seconds.", tags: ["apex"] },
  ],
};

export async function loadRoadmap(slug: string): Promise<RoadmapItem[]> {
  return ROADMAP_SEED[slug] ?? [];
}

// Whole-workspace load for every module. Target Lists (cold population) is fully
// live. The warm/campaign/content modules read live too, but their source tables
// are only populated as the campaign runs, so today they come back EMPTY — the
// modules render honest empty states instead of mock. Wire each source as its
// data lands (engaged_prospects → CRM, content_posts → Calendar, etc.).
export async function loadPortal(
  slug: string
): Promise<{ ws: Workspace; data: WorkspaceData } | null> {
  // Counts only — the dashboard and the channel modules never render an email body.
  const tl = await loadTargetLists(slug, { withBodies: false });
  if (!tl) return null;
  const { ws, lists, leads } = tl;

  const withEmail = leads.filter((l) => l.hasEmail).length;
  const readyToSend = leads.filter((l) => l.hasDraft).length;
  const withLinkedin = leads.filter((l) => l.linkedin).length;

  const crm = await loadCrm(slug);

  const kpis: Kpi[] = [
    { label: "Cold leads live", value: leads.length.toLocaleString(), sub: `across ${lists.length} target lists` },
    { label: "Emails on file", value: withEmail.toLocaleString(), sub: "ready to personalize" },
    { label: "Drafts ready", value: readyToSend.toLocaleString(), sub: "one click to send", tone: "good" },
    { label: "On LinkedIn", value: withLinkedin.toLocaleString(), sub: "for the connect + follow" },
    { label: "Warm in pipeline", value: crm.warm.toLocaleString(), sub: "replies land here", tone: "good" },
    { label: "Meetings booked", value: crm.meetings.toLocaleString(), sub: "this quarter" },
  ];

  const data: WorkspaceData = {
    kpis,
    activity: [],
    lists,
    leads,
    emailCampaigns: [],
    linkedinCampaigns: [],
    phoneTouches: [],
    content: [],
    crm: crm.cards,
    library: [],
    journey: JOURNEY_SEED[slug] ?? [],
  };
  return { ws, data };
}

// Agency view: every workspace with a live cold-lead count. The warm / meetings
// / pipeline figures come from the CRM loader once that module is wired to a
// live source, so they read 0 today rather than mock numbers. Returns null when
// the DB is absent so the agency page falls back to the mock roster.
export async function loadWorkspaces(): Promise<Workspace[] | null> {
  const sb = db();
  if (!sb) return null;

  const { data: rows } = await sb
    .from("workspaces")
    .select("*")
    .order("is_agency", { ascending: false })
    .order("name", { ascending: true });
  if (!rows) return null;

  const out: Workspace[] = [];
  for (const row of rows) {
    const { count } = await sb
      .from("target_list_leads")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", row.id as string);
    const w = workspaceFromRow(row as Record<string, unknown>, count ?? 0);
    // Warm/meetings from the same CRM source (wired for Luxvance today).
    const crm = await loadCrm(w.slug);
    w.warmLeads = crm.warm;
    w.meetings = crm.meetings;
    out.push(w);
  }
  return out;
}
