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
  | "whatsapp"
  | "content"
  | "crm"
  | "library";

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
  name: string;
  role: string;
  company: string;
  sector: string;
  domain: string; // for the favicon
  emailMasked: string; // never the raw address in the client UI
  linkedin: boolean;
  hasEmail: boolean;
  hasDraft: boolean;
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
}
