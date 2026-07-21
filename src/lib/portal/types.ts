// Luxvance Platform — portal domain types.
// One workspace = one client = its own database (namespace by workspace_id).
// The portal has an AGENCY view (all workspaces) and a CLIENT view (one workspace,
// all modules). Two lead populations per workspace: COLD (target lists → outreach)
// and WARM (replied → the Sales CRM funnel).

export type ModuleKey =
  | "dashboard"
  | "target-lists"
  | "email"
  | "linkedin"
  | "cadence"
  | "whatsapp"
  | "content"
  | "linkedin-ads"
  | "meta-ads"
  | "crm"
  | "library"
  | "blocklist"
  | "roadmap";

export interface Workspace {
  slug: string;
  name: string;
  owner: string; // primary client contact
  ownerRole: string;
  plan: string;
  accent: string; // hex, per-workspace accent used sparingly
  live: boolean;
  // headline counts surfaced in the agency view + workspace chip
  coldLeads: number;
  warmLeads: number;
  meetings: number;
  pipelineUsd: number;
}

// ── Target Lists (COLD population) ──────────────────────────────────────
export interface TargetList {
  id: string;
  name: string;
  note: string;
  count: number;
  channels: OutreachChannel[]; // where this list is activated
}

export type OutreachChannel = "email" | "linkedin" | "whatsapp" | "call" | "ads";

export interface Lead {
  id: string;
  listId: string;
  segment?: string; // nohr | hashr | direct | vip — drives the VIP tab's extra columns
  name: string;
  role: string;
  company: string;
  sector: string;
  domain: string; // for the favicon
  emailDisplay: string; // the owning client sees the real address; a demo prospect sees it masked
  linkedin: boolean;
  linkedinUrl?: string; // real profile URL (owner view) for the "View" link
  linkedinCompany?: string; // the company's LinkedIn page
  hasEmail: boolean;
  hasDraft: boolean;
  // Draft/Preview payload — present in the owner (client) view so Paul can read
  // and send the rendered Email 1. Built server-side; mailto carries the raw
  // recipient (the owner sends to their own leads).
  emailSubject?: string;
  emailBody?: string;
  // True when this viewer may send: owner only, address + rendered body on file. The
  // mailto link is built in the browser from emailDisplay/emailSubject/emailBody —
  // never precomputed, or every body ships a second time percent-encoded.
  canSend?: boolean;
  // White-glove fields, used by the VIP tab: Paul emails, connects on LinkedIn with
  // the prepared note, then calls. Withheld from a demo prospect, like the address.
  phone?: string;
  whyNow?: string; // the dated signal that earned the VIP slot
  linkedinNote?: string; // prepared connection message, copy-to-clipboard
  whatsappNote?: string; // prepared opener, prefilled into the wa.me link
  hrLeadName?: string;
  hrLeadTitle?: string;
}

// ── Email + LinkedIn campaigns ──────────────────────────────────────────
export type CampaignStatus = "active" | "paused" | "draft" | "completed";

export interface EmailCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  sent: number;
  openRate: number; // %
  replyRate: number; // %
  positive: number; // positive replies
  steps: number;
}

export interface LinkedInCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  invitesSent: number;
  accepted: number; // %
  replied: number; // count
  messagesSent: number;
}

// ── WhatsApp & Phone ────────────────────────────────────────────────────
export type TouchChannel = "whatsapp" | "call";
export type TouchOutcome = "delivered" | "replied" | "connected" | "voicemail" | "no-answer" | "queued";

export interface PhoneTouch {
  id: string;
  name: string;
  company: string;
  phoneMasked: string;
  channel: TouchChannel;
  outcome: TouchOutcome;
  when: string; // human label, e.g. "2h ago"
}

// ── LinkedIn organic content calendar ───────────────────────────────────
export type ContentStatus = "idea" | "draft" | "scheduled" | "published";

export interface ContentPost {
  id: string;
  title: string;
  hook: string;
  status: ContentStatus;
  date: string; // ISO date (no time) — pass in via mock, never Date.now()
  format: "text" | "carousel" | "video" | "poll";
}

// ── Sales CRM (WARM population) ─────────────────────────────────────────
// Qualification-to-close taxonomy (locked 2026-07-15).
export type CrmStage = "neutral" | "mql" | "sql" | "discovery" | "proposal_sent" | "won" | "lost";
export type ReplyCategory = "Positive/SQL" | "MQL" | "Neutral" | "Negative";

export interface CrmCard {
  id: string;
  stage: CrmStage;
  company: string;
  person: string;
  personRole: string;
  category: ReplyCategory;
  snippet: string;
  country: string;
  heat: number; // 0-100 priority score
  next: string; // next action label
  channels: OutreachChannel[]; // touched so far
  buildSent: boolean;
}

// ── Intelligence Library ────────────────────────────────────────────────
export type LibraryKind = "dossier" | "playbook" | "research" | "asset";

export interface LibraryItem {
  id: string;
  title: string;
  kind: LibraryKind;
  summary: string;
  sources: number; // how many research sources feed it
  updated: string; // human label
}

// ── Journey (relationship timeline, lives inside the Library module) ─────
export type JourneyKind = "call" | "milestone" | "decision" | "build" | "launch";

export interface JourneyItem {
  id: string;
  date: string; // ISO date (no time) — pass in, never Date.now()
  kind: JourneyKind;
  title: string;
  detail: string;
  tags?: string[];
}

// ── Intelligence Library (Octave-style client brain) ────────────────────
// One Supabase table (`intelligence_library`, one row per section) is the SINGLE
// source of truth: the portal renders it AND the reply/outreach LLM loads it as
// mandatory context before writing anything. Edit once → client view and every
// agent update together. Sections are typed so the UI can group them.
export type IntelligenceKind =
  | "playbook"        // rules of engagement the agents obey above all
  | "overview"        // who they are, the one-liner
  | "founder"         // the owner/sender's background + pedigree
  | "voice"           // how they write (tone, do/don't)
  | "icp"             // who they sell to
  | "offer"           // what they sell
  | "differentiator"  // why they win
  | "proof"           // named recommendations / testimonials
  | "segment"         // a target segment / campaign
  | "persona"         // a buyer persona
  | "objection"       // objection → response
  | "asset"           // links, signature, infra
  | "call_note"       // notes from a call
  | "research";       // Google / LinkedIn / website research

export interface IntelligenceSection {
  id: string;
  kind: IntelligenceKind;
  title: string;
  body: string;
  meta?: Record<string, string>; // author, role, date, source, url…
  sort: number;
  updatedAt: string;
}

// ── Client Success Roadmap (delivery log + what's next) ─────────────────
// Its OWN module, separate from the Intelligence Library: everything done since
// kickoff plus what's still pending. Reuses the milestone kinds; adds a status.
export type RoadmapStatus = "done" | "in_progress" | "planned";

export interface RoadmapItem {
  id: string;
  date: string;      // ISO date, or "" when a planned item has no fixed date
  status: RoadmapStatus;
  kind: JourneyKind;
  title: string;
  detail: string;
  tags?: string[];
}

// ── Blocklist (do-not-contact) ──────────────────────────────────────────
// One shared do-not-contact book per workspace. Buckets: current/past clients,
// competitors, and unsubscribes. workspace_id null = a global entry (blocked for
// every workspace). Matched on domain (company-level) or email (person-level).
export type BlocklistReason = "client" | "competitor" | "unsubscribe";
export type BlocklistSource = "manual" | "auto_unsubscribe";

export interface BlocklistEntry {
  id: string;
  reason: BlocklistReason;
  companyName: string;
  domain: string;
  email: string;
  personName: string;
  linkedinUrl: string;
  note: string;
  source: BlocklistSource;
  global: boolean; // true when it applies to every workspace (workspace_id null)
  createdAt: string;
}

// ── Dashboard ───────────────────────────────────────────────────────────
export interface Kpi {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "good" | "warn";
}

export interface ActivityItem {
  id: string;
  channel: OutreachChannel | "crm";
  text: string;
  when: string;
}

export interface WorkspaceData {
  kpis: Kpi[];
  activity: ActivityItem[];
  lists: TargetList[];
  leads: Lead[];
  emailCampaigns: EmailCampaign[];
  linkedinCampaigns: LinkedInCampaign[];
  phoneTouches: PhoneTouch[];
  content: ContentPost[];
  crm: CrmCard[];
  library: LibraryItem[];
  journey: JourneyItem[];
}
