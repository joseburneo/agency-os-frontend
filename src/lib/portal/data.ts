import { db } from "./server";
import type { Workspace, WorkspaceData, TargetList, Lead, OutreachChannel, Kpi, JourneyItem } from "./types";

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

// Target Lists module: the workspace, its 4 lists, and every lead (masked).
export async function loadTargetLists(
  slug: string
): Promise<{ ws: Workspace; lists: TargetList[]; leads: Lead[] } | null> {
  const sb = db();
  if (!sb) return null;

  const { data: wsRow } = await sb.from("workspaces").select("*").eq("slug", slug).maybeSingle();
  if (!wsRow) return null;
  const wsId = wsRow.id as string;

  const { data: listRows } = await sb
    .from("target_lists")
    .select("*")
    .eq("workspace_id", wsId)
    .order("created_at", { ascending: true });

  // PostgREST caps rows per request (server max-rows, ~1000), so page through all leads.
  const leadRows: Record<string, unknown>[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data } = await sb
      .from("target_list_leads")
      .select(
        "id,list_id,full_name,role,company,sector,domain,email,linkedin_url,has_draft,email1_subject,email1_body"
      )
      .eq("workspace_id", wsId)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    leadRows.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE) break;
  }

  const leads: Lead[] = (leadRows ?? []).map((r) => {
    const email = (r.email as string | null) || "";
    const subject = String(r.email1_subject ?? "");
    const body = String(r.email1_body ?? "");
    const mailto =
      email && body
        ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        : undefined;
    return {
      id: String(r.id),
      listId: String(r.list_id),
      name: String(r.full_name ?? ""),
      role: String(r.role ?? ""),
      company: String(r.company ?? ""),
      sector: String(r.sector ?? ""),
      domain: String(r.domain ?? ""),
      emailMasked: maskEmail(email),
      linkedin: Boolean(r.linkedin_url),
      linkedinUrl: (r.linkedin_url as string | null) || undefined,
      hasEmail: Boolean(email),
      hasDraft: Boolean(r.has_draft ?? body),
      emailSubject: subject || undefined,
      emailBody: body || undefined,
      mailto,
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
}

// Whole-workspace load for every module. Target Lists (cold population) is fully
// live. The warm/campaign/content modules read live too, but their source tables
// are only populated as the campaign runs, so today they come back EMPTY — the
// modules render honest empty states instead of mock. Wire each source as its
// data lands (engaged_prospects → CRM, content_posts → Calendar, etc.).
export async function loadPortal(
  slug: string
): Promise<{ ws: Workspace; data: WorkspaceData } | null> {
  const tl = await loadTargetLists(slug);
  if (!tl) return null;
  const { ws, lists, leads } = tl;

  const withEmail = leads.filter((l) => l.hasEmail).length;
  const readyToSend = leads.filter((l) => l.hasDraft).length;
  const withLinkedin = leads.filter((l) => l.linkedin).length;

  const kpis: Kpi[] = [
    { label: "Cold leads live", value: leads.length.toLocaleString(), sub: `across ${lists.length} target lists` },
    { label: "Emails on file", value: withEmail.toLocaleString(), sub: "ready to personalize" },
    { label: "Drafts ready", value: readyToSend.toLocaleString(), sub: "one click to send", tone: "good" },
    { label: "On LinkedIn", value: withLinkedin.toLocaleString(), sub: "for the connect + follow" },
    { label: "Warm in pipeline", value: "0", sub: "replies land here", tone: "good" },
    { label: "Meetings booked", value: "0", sub: "this quarter" },
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
    crm: [],
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
    out.push(workspaceFromRow(row as Record<string, unknown>, count ?? 0));
  }
  return out;
}
