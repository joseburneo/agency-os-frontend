import { cache } from "react";
import { db } from "./server";
import type {
  Workspace, WorkspaceData, TargetList, Lead, OutreachChannel, Kpi, JourneyItem,
  CrmCard, CrmSummary, CrmTopLead, CrmStage, ReplyCategory, BlocklistEntry, BlocklistReason, BlocklistSource,
  IntelligenceSection, IntelligenceKind, RoadmapItem, EmailCampaign,
} from "./types";

// Relationship timeline shown inside the Library module. Seeded per workspace
// here (real milestones); move to a `workspace_events` table when the volume
// justifies it. Dates are ISO literals — never computed at runtime.
const JOURNEY_SEED: Record<string, JourneyItem[]> = {
  "arco-irish": [
    { id: "aj1", date: "2026-06-25", kind: "call", title: "Onboarding & discovery call", detail: "Captured Paul's voice, ICP and assets: boutique executive search, sells to CEO/founder (not HR), British English, punchy-not-formal.", tags: ["voice", "ICP"] },
    { id: "aj2", date: "2026-07-01", kind: "milestone", title: "Retainer starts", detail: "Build & Operate plan begins. Arco Irish is the first Apex pilot.", tags: ["commercial"] },
    { id: "aj3", date: "2026-07-03", kind: "decision", title: "ICP & blocklist locked", detail: "Confirmed 30–300 employees, no in-house HR proxy. Do-not-contact list locked (6 clients + anchors + 26 competitors).", tags: ["targeting"] },
    { id: "aj4", date: "2026-07-14", kind: "build", title: "Campaign built · list live", detail: "1,064 qualified leads across 4 lists (No-HR, Has-HR, Company Direct, VIP). Copy drafted, intelligence library live.", tags: ["build", "leads"] },
    { id: "aj5", date: "2026-07-15", kind: "decision", title: "Review call — copy in Paul's voice", detail: "Reverted to Paul's single canonical version (no randomisation), added his phone to the signature, removed Zartis, agreed LinkedIn content 2x/month. CRM in build.", tags: ["copy", "voice"] },
    { id: "aj6", date: "2026-07-17", kind: "build", title: "Client workspace live", detail: "Paul's own workspace went live: the lists, the sequence, the intelligence library, the blocklist and this journey, all in one place.", tags: ["platform"] },
    { id: "aj7", date: "2026-07-22", kind: "decision", title: "Launch review — grant-led copy", detail: "Agreed a shorter message led by the Enterprise Ireland Key Hires Grant, a two-step follow-up in Paul's own words, low-volume sending and LinkedIn in parallel.", tags: ["copy", "launch"] },
  ],
};

// Workspace-scoped reads from Supabase. Every function returns null when the DB
// client is absent (no service key) so callers fall back to mock data.
//
// Addresses are NOT masked any more, for anyone. The 50 real verified emails are
// the whole value of a magnet, and a masked list demos nothing. maskEmail below
// is kept for a caller that opts in, but no page does today. What a demo
// prospect cannot do is export the file — that gate lives in the target-lists page.

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
    kind: (row.kind as string) === "magnet" ? "magnet" : "client",
    isAgency: row.is_agency === true,
    slug: String(row.slug),
    name: String(row.name ?? row.slug),
    domain: (row.domain as string | null) || undefined,
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

// ── Magnets: a separate domain from our campaign leads ───────────────────────
// A magnet is the prospect's OWN gift — their ~50 leads, built for them, owned by
// them. Our real campaign leads live in target_list_leads and are what graduates
// into the CRM. Conflating the two put 1,606 prospect-owned rows (59% of the
// table) into "our leads"; magnets now read from magnets + magnet_leads instead.
//
// The migration fallbacks that let these read the old tables mid-move were removed
// on 2026-08-18, once target_list_leads held no source='magnet' rows at all. A
// magnet resolves through its own tables or not at all.

type MagnetRow = { id: string; content: Record<string, unknown> | null };

// workspace id -> its magnet row. One magnet per magnet workspace (unique index).
const loadMagnetFor = cache(async function loadMagnetFor(wsId: string): Promise<MagnetRow | null> {
  const sb = db();
  if (!sb) return null;
  const { data } = await sb
    .from("magnets")
    .select("id,content")
    .eq("workspace_id", wsId)
    .maybeSingle();
  return data ? { id: String(data.id), content: (data.content ?? null) as Record<string, unknown> | null } : null;
});

// The lead count behind a workspace badge. A magnet counts its own leads; a client
// counts the campaign leads. Falls back for a magnet whose rows have not moved yet.
async function leadCountFor(wsRow: Record<string, unknown>): Promise<number> {
  const sb = db();
  if (!sb) return 0;
  const wsId = String(wsRow.id);
  if (wsRow.kind === "magnet") {
    const magnet = await loadMagnetFor(wsId);
    if (!magnet) return 0;
    const { count } = await sb
      .from("magnet_leads")
      .select("id", { count: "exact", head: true })
      .eq("magnet_id", magnet.id);
    return count ?? 0;
  }
  const { count } = await sb
    .from("target_list_leads")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", wsId);
  return count ?? 0;
}

// The columns the magnet workspace renders. No addresses: a magnet ships LinkedIn
// and the written outreach, and the emails are bought after the 15-minute call.
const MAGNET_COLS =
  "id,full_name,role,company,sector,domain,country,linkedin_url,linkedin_company," +
  "why_now,has_draft,list_name,list_note,list_sort,list_channels";
const MAGNET_BODY_COLS = "email_subject,email_copy,linkedin_copy";

// A magnet's lists and leads, in the shape the Target Lists view already renders.
// The list level is denormalized onto each lead (list_name / list_note / list_sort),
// so the tabs are rebuilt here rather than joined: a magnet is written once and read
// many times, and 5 of the 39 magnets are genuinely multi-list — ku217's five
// hand-designed tabs, land-of-the-braves' two pillars — which a flat list would lose.
async function loadMagnetLists(
  magnetId: string,
  withBodies: boolean
): Promise<{ lists: TargetList[]; leads: Lead[] }> {
  const sb = db();
  if (!sb) return { lists: [], leads: [] };
  const cols = withBodies ? `${MAGNET_COLS},${MAGNET_BODY_COLS}` : MAGNET_COLS;

  const PAGE = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 50000; from += PAGE) {
    const { data } = await sb
      .from("magnet_leads")
      .select(cols)
      .eq("magnet_id", magnetId)
      .order("list_sort", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  // Tab id from the sort index, which the build assigns per list and never reuses.
  // It has to be stable across renders: the view filters leads by lead.listId.
  const listId = (r: Record<string, unknown>) => `m${Number(r.list_sort ?? 0)}`;

  const leads: Lead[] = rows.map((r) => {
    const subject = String(r.email_subject ?? "");
    const body = String(r.email_copy ?? "");
    return {
      id: String(r.id),
      listId: listId(r),
      name: String(r.full_name ?? ""),
      role: String(r.role ?? ""),
      company: String(r.company ?? ""),
      sector: String(r.sector ?? ""),
      domain: String(r.domain ?? ""),
      // A magnet has no addresses on file, so there is nothing to show or mask and
      // nothing to send: the prospect opens their own mail client from the preview.
      emailDisplay: "",
      linkedin: Boolean(r.linkedin_url),
      linkedinUrl: (r.linkedin_url as string | null) || undefined,
      linkedinCompany: (r.linkedin_company as string | null) || undefined,
      hasEmail: false,
      hasDraft: Boolean(r.has_draft ?? body),
      emailSubject: subject || undefined,
      emailBody: body || undefined,
      canSend: false,
      whyNow: (r.why_now as string | null) || undefined,
      linkedinNote: (r.linkedin_copy as string | null) || undefined,
      country: (r.country as string | null) || undefined,
    };
  });

  const seen = new Map<string, TargetList>();
  for (const r of rows) {
    const id = listId(r);
    if (seen.has(id)) {
      seen.get(id)!.count += 1;
      continue;
    }
    seen.set(id, {
      id,
      name: String(r.list_name ?? "Your targeted leads"),
      note: String(r.list_note ?? ""),
      count: 1,
      channels: toChannels(r.list_channels),
    });
  }
  const lists = [...seen.values()].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return { lists, leads };
}

// Columns every caller needs. The rendered email/LinkedIn bodies are deliberately
// NOT here: they are ~1.7MB of the ~2MB this used to transfer, and only the Target
// Lists table (which previews and sends them) ever reads them. Callers that just
// count — the dashboard and the channel modules — pass withBodies:false and move
// ~100KB instead.
const LEAD_COLS =
  "id,list_id,list_segment,full_name,role,company,sector,domain,country,email,linkedin_url,linkedin_company,has_draft,phone,why_now,hr_lead_name,hr_lead_title";
// Email 1 (previewed + sent from the table) and the VIP's prepared LinkedIn note.
// Email 2/3 and linkedin2 are per-lead in the DB but nothing renders them yet;
// they stay out so the table doesn't carry another megabyte for nothing.
const LEAD_BODY_COLS = "email1_subject,email1_body,email2_body,email3_body,linkedin1,whatsapp1";

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

  // A magnet's leads belong to the prospect, not to us, and live in magnet_leads.
  // This returns whatever the magnet has, including nothing: target_list_leads is
  // ours now, so falling through to it would show a prospect our client campaigns.
  if (wsRow.kind === "magnet") {
    const magnet = await loadMagnetFor(wsId);
    const { lists, leads } = magnet
      ? await loadMagnetLists(magnet.id, withBodies)
      : { lists: [] as TargetList[], leads: [] as Lead[] };
    return { ws: workspaceFromRow(wsRow, leads.length), lists, leads };
  }

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
      // The company page, beside the person. A magnet ships no addresses, so
      // these two links are the evidence that the targeting is real.
      linkedinCompany: (r.linkedin_company as string | null) || undefined,
      hasEmail: Boolean(email),
      hasDraft: Boolean(r.has_draft ?? body),
      emailSubject: subject || undefined,
      emailBody: body || undefined,
      emailBody2: String(r.email2_body ?? "") || undefined,
      emailBody3: String(r.email3_body ?? "") || undefined,
      canSend,
      // White-glove fields — the VIP tab works these by hand (phone, LinkedIn note,
      // the dated signal). Masked for a demo prospect, same rule as the address.
      phone: opts.unmask ? (r.phone as string | null) || undefined : undefined,
      whyNow: (r.why_now as string | null) || undefined,
      linkedinNote: (r.linkedin1 as string | null) || undefined,
      // Prefilled into wa.me on click. Masked with the phone: without a number
      // the opener is useless, and a demo prospect gets neither.
      whatsappNote: opts.unmask ? (r.whatsapp1 as string | null) || undefined : undefined,
      hrLeadName: (r.hr_lead_name as string | null) || undefined,
      hrLeadTitle: (r.hr_lead_title as string | null) || undefined,
      country: (r.country as string | null) || undefined,
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

  const count = await leadCountFor(wsRow as Record<string, unknown>);

  return workspaceFromRow(wsRow as Record<string, unknown>, count);
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
  const { data: wsRow } = await sb.from("workspaces").select("id,kind").eq("slug", slug).maybeSingle();
  if (!wsRow) return [];
  // A magnet's tabs come from its own leads, where the list level is denormalized.
  if (wsRow.kind === "magnet") {
    const magnet = await loadMagnetFor(String(wsRow.id));
    if (!magnet) return [];
    const { lists } = await loadMagnetLists(magnet.id, false);
    return lists.map((l) => ({ key: listKey(l.name), name: l.name, count: l.count }));
  }
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
): Promise<{ cards: CrmCard[]; warm: number; meetings: number; summary: CrmSummary }> {
  const emptySummary: CrmSummary = {
    total: 0, wantsMeeting: 0, hotNow: 0, waitingUs: 0, waitingThem: 0,
    meetings: 0, withBuild: 0, top: [],
  };
  const empty = { cards: [] as CrmCard[], warm: 0, meetings: 0, summary: emptySummary };
  if (!slug) return empty; // never ask the API for "every workspace"
  try {
    // Same-origin browser calls go through /api/crm (the proxy adds the key), but
    // this runs server-side, so it must authenticate itself: without X-CRM-Key the
    // Render API returns "bad or missing X-CRM-Key" and the whole dashboard reads
    // zero even when the workspace is full of live conversations. X-CRM-Scope pins
    // the read to this one workspace, exactly as the proxy does for a client session.
    const key = process.env.CRM_API_KEY;
    const headers: Record<string, string> = { "X-CRM-Scope": slug };
    if (key) headers["X-CRM-Key"] = key;
    // Bounded: a Render mid-deploy answers nothing for minutes, and an unbounded
    // fetch here once stalled the Vercel build's prerender of "/" past its 60s
    // budget. Better an empty CRM slice than a failed build or a hung page.
    const [pRes, sRes] = await Promise.all([
      fetch(`${CRM_API}/api/crm/prospects?workspace=${encodeURIComponent(slug)}`,
        { headers, next: { revalidate: 60 }, signal: AbortSignal.timeout(15000) }),
      fetch(`${CRM_API}/api/crm/summary?workspace=${encodeURIComponent(slug)}`,
        { headers, next: { revalidate: 60 }, signal: AbortSignal.timeout(15000) }),
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

    const c = sJson?.counts ?? {};
    const warm = Number(c.total ?? cards.length);
    const meetings = Number(c.meetings ?? 0);
    const top: CrmTopLead[] = (Array.isArray(sJson?.top) ? sJson.top : []).map(
      (t: Record<string, unknown>) => ({
        id: String(t.id ?? ""),
        name: String(t.name ?? ""),
        company: String(t.company ?? ""),
        heat: Number(t.heat ?? 0),
        reason: String(t.heat_reason ?? ""),
        wantsMeeting: Boolean(t.wants_meeting),
        lastReplyAt: String(t.last_reply_at ?? ""),
      })
    );
    const summary: CrmSummary = {
      total: Number(c.total ?? cards.length),
      wantsMeeting: Number(c.wants_meeting ?? 0),
      hotNow: Number(c.hot_now ?? 0),
      waitingUs: Number(c.waiting_us ?? 0),
      waitingThem: Number(c.waiting_them ?? 0),
      meetings,
      withBuild: Number(c.with_build ?? 0),
      top,
    };
    return { cards, warm, meetings, summary };
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

// Scoped to the ONE client that owns the workspace. Never widen this: a block list
// belongs to a single client, and showing another client's suppressions here would
// both leak who they work with and wrongly suppress legitimate leads.
export async function loadBlocklist(slug: string): Promise<BlocklistEntry[]> {
  const sb = db();
  if (!sb) return [];
  const { data: wsRow } = await sb
    .from("workspaces")
    .select("client_id")
    .eq("slug", slug)
    .maybeSingle();
  const clientId = wsRow?.client_id as string | undefined;
  if (!clientId) return [];

  const { data, error } = await sb
    .from("blocklist")
    .select("*")
    .eq("client_id", clientId)
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

// The Brain's operational fields — the exact values the Render engine injects
// verbatim into every draft (client_brain.sender_identity). Columns on
// `workspaces`, edited in the Brain module via /api/brain/ops.
export type BrainOps = {
  booking_link: string;
  signature_html: string;
  brain_language: string;
  brain_rules: string;
};

export const loadBrainOps = cache(async function loadBrainOps(slug: string): Promise<BrainOps> {
  const empty: BrainOps = { booking_link: "", signature_html: "", brain_language: "", brain_rules: "" };
  const sb = db();
  if (!sb) return empty;
  const { data } = await sb
    .from("workspaces")
    .select("booking_link,signature_html,brain_language,brain_rules")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return empty;
  return {
    booking_link: String(data.booking_link ?? ""),
    signature_html: String(data.signature_html ?? ""),
    brain_language: String(data.brain_language ?? ""),
    brain_rules: String(data.brain_rules ?? ""),
  };
});

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
  // Pepe / Terroir Comando: the $1,750/mo proposal delivered as a roadmap inside
  // his own workspace (his team reviews it Friday Aug 7). Spanish on purpose.
  "pepe-rodr-guez-de-vera": [
    { id: "p1", date: "2026-08-03", status: "done", kind: "build", title: "Workspace y primeras listas construidas", detail: "29 sumilleres de restaurantes premium de España y 20 casas importadoras en los 6 países de vuestra nota, investigados y con el email y el mensaje de LinkedIn ya escritos. Sin coste para Terroir Comando: es nuestra muestra de trabajo.", tags: ["build", "listas"] },
    { id: "p2", date: "2026-08-04", status: "done", kind: "call", title: "Llamada de descubrimiento", detail: "52 minutos con Pepe y Pedro: vuestro plan de 6 semanas, los viajes, Smartlead, HubSpot y el objetivo real: liberar el tiempo del equipo y llegar más veces al inbox del comprador.", tags: ["discovery"] },
    { id: "p3", date: "2026-08-07", status: "in_progress", kind: "decision", title: "Vuestra decisión · plan de $1,750/mes", detail: "El equipo valora el plan: dos campañas al mes, un país cada una, siguiendo vuestro calendario de viajes, con todo lo de abajo incluido. Partimos de vuestras listas y las ampliamos con nuestros proveedores. Si usamos vuestra suscripción de Smartlead, lo descontamos del precio. Las dudas que salgan el viernes las respondemos por correo el mismo día.", tags: ["comercial"] },
    { id: "p4", date: "", status: "planned", kind: "build", title: "Semana 1 · Infraestructura y deliverability, todo en un solo lugar", detail: "Analizamos vuestra infraestructura y volúmenes de envío, revisamos los ~10 dominios contra los spam houses y compramos los dominios y cuentas de correo extra que hagan falta, mitad Google y mitad Microsoft. Todo queda unificado en nuestra plataforma, con acceso para el equipo. Monitoreo con alertas, rotación con dominios de reserva, política GDPR lista para publicar, y conexión de Smartlead más el API hacia vuestro HubSpot.", tags: ["deliverability", "setup"] },
    { id: "p5", date: "", status: "planned", kind: "build", title: "Semana 2 · La lista de cada país: la vuestra, ampliada", detail: "Partimos de vuestra lista y compramos con nuestros proveedores los prospectos que faltan para maximizar la cobertura del país. Cada contacto se califica y se enriquece uno a uno por nuestros agentes, con su business intelligence guardado en la base de datos, el teléfono cuando se puede conseguir, y los correos verificados dos veces para que no haya bounces.", tags: ["lista", "enriquecimiento"] },
    { id: "p6", date: "", status: "planned", kind: "launch", title: "Semana 3 · Emails únicos, con vuestro branding", detail: "Un email por contacto, escrito con el contexto de cada casa y control de calidad multi-agente, visible aquí en vuestras listas antes de salir. El envío sale desde vuestro Smartlead, con vuestro look and feel, vuestra firma y vuestro branding: para el prospecto, quien escribe es Terroir Comando.", tags: ["copy", "launch"] },
    { id: "p7", date: "", status: "planned", kind: "milestone", title: "Semana 4+ · Respuestas, seguimientos y agenda para el viaje", detail: "Todas las respuestas se ven en esta plataforma y cada positivo se crea como contacto en vuestro HubSpot por API. El copiloto avisa de cada seguimiento pendiente, por correo, LinkedIn o WhatsApp (con el teléfono ya en la ficha), y ayuda a escribir cada mensaje. Ninguna ficha se escapa. Objetivo: la agenda del viaje cargada antes de volar.", tags: ["respuestas", "reuniones"] },
    { id: "p8", date: "", status: "planned", kind: "milestone", title: "Cada mes · dos países del calendario", detail: "Dos campañas al mes, un país cada una, sincronizadas con vuestros viajes: Alemania y Suiza para septiembre, Francia y Portugal después, y los que vengan. Nosotros llegamos antes que el avión.", tags: ["cadencia"] },
    { id: "p9", date: "2027-01-05", status: "planned", kind: "milestone", title: "Enero · el proyecto completo", detail: "Cuando amplíes presupuesto: base de datos SQL propia, servidor en Alemania con los scripts, gestión completa de respuestas y el lead magnet de maridajes por menú que salió de tu idea en la llamada. La infraestructura queda vuestra.", tags: ["enero", "upgrade"] },
  ],
  "arco-irish": [
    { id: "r1", date: "2026-06-25", status: "done", kind: "call", title: "Onboarding & discovery call", detail: "Captured Paul's voice, ICP and assets: boutique executive search selling to the CEO (not HR), British English, punchy but not too formal.", tags: ["voice", "ICP"] },
    { id: "r2", date: "2026-07-01", status: "done", kind: "milestone", title: "Retainer starts", detail: "Build & Operate plan begins. Arco Irish is the first Apex pilot.", tags: ["commercial"] },
    { id: "r3", date: "2026-07-03", status: "done", kind: "decision", title: "ICP & blocklist locked", detail: "Confirmed 30–300 employees with no in-house HR proxy. The do-not-contact list was locked and moved into the Blocklist module.", tags: ["targeting"] },
    { id: "r4", date: "2026-07-14", status: "done", kind: "build", title: "Campaign built · list live", detail: "1,064 qualified leads across 4 target lists. Copy drafted and the intelligence library went live.", tags: ["build", "leads"] },
    { id: "r5", date: "2026-07-15", status: "done", kind: "decision", title: "Review call — copy in Paul's voice", detail: "Locked Paul's single canonical version (no randomisation), added his phone to the signature and agreed LinkedIn content twice a month.", tags: ["copy", "voice"] },
    { id: "r6", date: "2026-07-17", status: "done", kind: "build", title: "Client workspace live", detail: "Arco's own workspace: target lists, the Live Deals CRM, the intelligence library, the blocklist and this roadmap, all in one place.", tags: ["platform"] },
    { id: "r7", date: "2026-07-22", status: "done", kind: "call", title: "Launch review call", detail: "Agreed a shorter message led by the Enterprise Ireland Key Hires Grant, with a two-step follow-up drawn from your own words. Confirmed low-volume sending and LinkedIn to the same names in parallel.", tags: ["copy", "launch"] },
    { id: "r8", date: "2026-07-22", status: "in_progress", kind: "build", title: "Ready to send", detail: "The sequence and lists are built across your nine warm inboxes, and every change you asked for is in. We apply the final grant-led copy, then the first emails go out.", tags: ["launch"] },
    { id: "r9", date: "", status: "planned", kind: "launch", title: "Campaign go-live", detail: "Start sending at low volume, up to about 30 a day, Tuesday to Thursday, email and LinkedIn to the same names, with a three-day follow-up. Target 5% reply rate.", tags: ["launch"] },
    { id: "r10", date: "", status: "planned", kind: "milestone", title: "LinkedIn — connect and content", detail: "Connect with the leaders we have no email for, and turn Paul's older posts into a steady organic presence twice a month, plus a short trust-building video down the line.", tags: ["content"] },
    { id: "r11", date: "2026-08-08", status: "planned", kind: "milestone", title: "August cover — Apex pilot", detail: "While Paul is away (8–16 Aug), Apex drafts replies, pre-books from the calendar and alerts Paul on WhatsApp within seconds.", tags: ["apex"] },
  ],
};

export async function loadRoadmap(slug: string): Promise<RoadmapItem[]> {
  return ROADMAP_SEED[slug] ?? [];
}

// Email campaign stats, live from the `campaigns` table (synced from Instantly by
// the Render backend; the agency /campaigns page reads the same rows). Scope:
// workspaces.client_id → campaigns.client_id. Rates arrive as "1.01%" strings.
// `steps` is not synced; every live sequence today is 3 emails.
const asPct = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
};
const asStatus = (v: unknown): EmailCampaign["status"] => {
  const s = String(v ?? "").toLowerCase();
  return s === "active" || s === "paused" || s === "completed" ? s : "draft";
};

export const loadEmailCampaigns = cache(async function loadEmailCampaigns(
  slug: string
): Promise<EmailCampaign[]> {
  const sb = db();
  if (!sb) return [];
  const { data: wsRow } = await sb
    .from("workspaces")
    .select("client_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!wsRow?.client_id) return [];
  const { data: rows } = await sb
    .from("campaigns")
    .select("id, campaign_name, status, emails_sent, open_rate, reply_rate, opportunities")
    .eq("client_id", wsRow.client_id)
    .order("emails_sent", { ascending: false });
  return (rows ?? []).map((r) => ({
    id: String(r.id),
    name: r.campaign_name ?? "Untitled campaign",
    status: asStatus(r.status),
    sent: r.emails_sent ?? 0,
    openRate: asPct(r.open_rate),
    replyRate: asPct(r.reply_rate),
    positive: r.opportunities ?? 0,
    steps: 3,
  }));
});

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
    emailCampaigns: await loadEmailCampaigns(slug),
    linkedinCampaigns: [],
    phoneTouches: [],
    content: [],
    crm: crm.cards,
    crmSummary: crm.summary,
    library: [],
    journey: JOURNEY_SEED[slug] ?? [],
  };
  return { ws, data };
}

// Agency view: every workspace with a live cold-lead count. The warm / meetings
// / pipeline figures come from the CRM loader once that module is wired to a
// live source, so they read 0 today rather than mock numbers. Returns null when
// the DB is absent so the agency page falls back to the mock roster.
// 'client' | 'magnet'. Cached per request: the sidebar, the layout and every
// module guard ask for it while rendering one page.
export const loadWorkspaceKind = cache(async function loadWorkspaceKind(slug: string): Promise<string> {
  const sb = db();
  if (!sb) return "client";
  const { data } = await sb.from("workspaces").select("kind").eq("slug", slug).maybeSingle();
  return (data?.kind as string) || "client";
});

// The research behind a magnet, stored when it was built. Shape mirrors
// lead_magnet.generate_brief: personal_note, company_summary, executive_summary,
// primary_audience {...}, secondary_audiences[], outreach_angle, talking_points[].
export const loadMagnetBrief = cache(async function loadMagnetBrief(slug: string) {
  const sb = db();
  if (!sb) return null;
  const { data } = await sb.from("workspaces").select("id,kind,name,owner_name,domain")
    .eq("slug", slug).maybeSingle();
  if (!data || data.kind !== "magnet") return null;

  // The research lives on the magnet itself. It used to be workspaces.brief_json,
  // which was retired on 2026-08-18 — one copy, in magnets.content.
  const magnet = await loadMagnetFor(String(data.id));
  const brief = magnet?.content;
  if (!brief || Object.keys(brief).length === 0) return null;

  // A magnet built as a plan (no list yet) hides the "Your list" section rather
  // than linking to an empty Target Lists page.
  const leadCount = await leadCountFor(data as Record<string, unknown>);
  return {
    brief,
    name: String(data.name ?? ""),
    owner: String(data.owner_name ?? ""),
    domain: (data.domain as string | null) || undefined,
    leadCount,
  };
});


// Warm + meeting counts for EVERY workspace, in one query.
//
// This used to be loadCrm() called once per workspace inside loadWorkspaces(), which
// meant two Render API calls each. With 44 workspaces (5 clients, 39 magnets) that was
// 88 concurrent requests on every page load under /w/ — the layout calls
// loadWorkspaces(), so opening the CRM fired all of them just to label the sidebar
// switcher. Each response carried the workspace's full prospect list, so memory on the
// single Render instance climbed from its usual ~320 MB to the 2 GB ceiling and the
// service was OOM-killed and restarted (2026-08-19). While it restarted, loadCrm's
// 15s AbortSignal fired and the board rendered EMPTY — counts in the sidebar, zero in
// every column, "Could not load the briefing".
//
// The switcher only ever needed two numbers per workspace. engaged_prospects is small
// (under a thousand rows), so one select of two columns answers all 44 at once.
const crmCountsByWorkspace = cache(async function crmCountsByWorkspace(): Promise<Map<string, { warm: number; meetings: number }>> {
  const out = new Map<string, { warm: number; meetings: number }>();
  const sb = db();
  if (!sb) return out;
  const { data } = await sb
    .from("engaged_prospects")
    .select("workspace_id,status")
    .limit(20000);
  for (const r of (data ?? []) as { workspace_id?: string; status?: string }[]) {
    const k = String(r.workspace_id ?? "");
    if (!k) continue;
    const cur = out.get(k) ?? { warm: 0, meetings: 0 };
    cur.warm += 1;
    if (r.status === "meeting_booked") cur.meetings += 1;
    out.set(k, cur);
  }
  return out;
});


// Cold-lead counts for EVERY workspace, in three queries instead of one per workspace.
//
// leadCountFor() asks per workspace, and for a magnet it asks twice (find the magnet,
// then count its leads). With 39 magnets and 5 clients that was 83 queries — and the
// layout calls loadWorkspaces on every navigation, twice, so a single click on a
// sidebar module fired 166. That is why clicking a tab sat dead for ~3 seconds.
//
// Both lead tables are small (a few thousand rows), so one column-only select of each
// answers all 44 workspaces at once and we count in memory.
const loadLeadCounts = cache(async function loadLeadCounts(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const sb = db();
  if (!sb) return out;
  const [magnets, magnetLeads, listLeads] = await Promise.all([
    sb.from("magnets").select("id,workspace_id").limit(5000),
    sb.from("magnet_leads").select("magnet_id").limit(50000),
    sb.from("target_list_leads").select("workspace_id").limit(50000),
  ]);
  const wsOfMagnet = new Map<string, string>();
  for (const m of (magnets.data ?? []) as { id?: string; workspace_id?: string }[]) {
    if (m.id && m.workspace_id) wsOfMagnet.set(String(m.id), String(m.workspace_id));
  }
  for (const l of (magnetLeads.data ?? []) as { magnet_id?: string }[]) {
    const ws = wsOfMagnet.get(String(l.magnet_id ?? ""));
    if (ws) out.set(ws, (out.get(ws) ?? 0) + 1);
  }
  for (const l of (listLeads.data ?? []) as { workspace_id?: string }[]) {
    const ws = String(l.workspace_id ?? "");
    if (ws) out.set(ws, (out.get(ws) ?? 0) + 1);
  }
  return out;
});

// cache() dedupes within a single render pass. generateMetadata and the layout body
// both need this, and without it every navigation paid for the whole thing twice.
export const loadWorkspaces = cache(async function loadWorkspaces(): Promise<Workspace[] | null> {
  const sb = db();
  if (!sb) return null;

  const { data: rows } = await sb
    .from("workspaces")
    .select("*")
    .order("is_agency", { ascending: false })
    .order("name", { ascending: true });
  if (!rows) return null;

  // One query for every workspace's warm/meeting numbers, instead of one CRM fetch
  // each. See crmCountsByWorkspace above for what that cost us.
  // Two prepared maps, then pure assembly: no per-workspace round trip at all.
  const [counts, leads] = await Promise.all([crmCountsByWorkspace(), loadLeadCounts()]);
  return rows.map((row) => {
    const id = String((row as Record<string, unknown>).id ?? "");
    const w = workspaceFromRow(row as Record<string, unknown>, leads.get(id) ?? 0);
    const c = counts.get(id) ?? { warm: 0, meetings: 0 };
    w.warmLeads = c.warm;
    w.meetings = c.meetings;
    return w;
  });
})
