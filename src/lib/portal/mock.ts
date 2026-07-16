// Seed data for the portal shell. Modeled on the real workspaces (Luxvance own
// outbound + Arco Irish / Paul Herrick). This is the mock layer: swap each getter
// for a workspace-scoped Supabase query once the DB is wired (see lib/portal/data.ts).
// No Date.now()/new Date() here — dates are literal ISO strings.

import type { Workspace, WorkspaceData } from "./types";

export const WORKSPACES: Workspace[] = [
  {
    slug: "luxvance",
    name: "Luxvance",
    owner: "José Burneo",
    ownerRole: "Co-Founder",
    plan: "Agency · own outbound",
    accent: "#FFD60A",
    live: true,
    coldLeads: 1840,
    warmLeads: 63,
    meetings: 19,
    pipelineUsd: 214000,
  },
  {
    slug: "arco-irish",
    name: "Arco Irish",
    owner: "Paul Herrick",
    ownerRole: "CEO & Founder",
    plan: "Build & Operate",
    accent: "#26D07C",
    live: true,
    coldLeads: 1114,
    warmLeads: 27,
    meetings: 11,
    pipelineUsd: 96500,
  },
];

export function getWorkspace(slug: string): Workspace | undefined {
  return WORKSPACES.find((w) => w.slug === slug);
}

// ── Arco Irish workspace data (the fully dressed client, from Paul's portal) ──
const ARCO: WorkspaceData = {
  kpis: [
    { label: "Cold leads live", value: "1,114", sub: "across 4 target lists" },
    { label: "Warm in pipeline", value: "27", sub: "replied · being worked", tone: "good" },
    { label: "Meetings booked", value: "11", sub: "6 held · 5 upcoming", tone: "good" },
    { label: "Reply rate", value: "1.8%", sub: "email · last 30 days" },
    { label: "Open rate", value: "46%", sub: "email · last 30 days" },
    { label: "Pipeline value", value: "$96.5k", sub: "weighted, this quarter" },
  ],
  activity: [
    { id: "a1", channel: "crm", text: "Michael York (GDHF) moved to Discovery", when: "18m ago" },
    { id: "a2", channel: "email", text: "List 1 · sequence step 2 sent to 214 leads", when: "1h ago" },
    { id: "a3", channel: "linkedin", text: "Stephen Keogh accepted the connection", when: "2h ago" },
    { id: "a4", channel: "whatsapp", text: "Reply from John Wallace (Sorensen)", when: "3h ago" },
    { id: "a5", channel: "call", text: "Connected with Emmett Kilduff (Eagle Alpha)", when: "5h ago" },
    { id: "a6", channel: "email", text: "New reply · Jim Hughes (Innovate) — positive", when: "6h ago" },
  ],
  lists: [
    { id: "l1", name: "No in-house HR leader", note: "Founders & CEOs at 30–300-person Irish firms with no senior HR function.", count: 447, channels: ["email", "linkedin"] },
    { id: "l2", name: "Has senior HR", note: "Firms with an HR head — routed to the People lead, softer angle.", count: 328, channels: ["email", "linkedin", "ads"] },
    { id: "l3", name: "Company Direct", note: "Company-level general inboxes where no leader email resolved.", count: 290, channels: ["email"] },
    { id: "l4", name: "VIP · white glove", note: "High-value accounts worked by hand, manual approval on every send.", count: 49, channels: ["email", "linkedin", "whatsapp", "call"] },
  ],
  leads: [
    { id: "c1", listId: "l1", name: "Pritesh Tiwari", role: "Founder & Chief Data Scientist", company: "DSW", sector: "Software / SaaS", domain: "datasciencewizards.ai", emailMasked: "p••••@datasciencewizards.ai", linkedin: true, hasEmail: true, hasDraft: true },
    { id: "c2", listId: "l1", name: "Paul McCarthy", role: "Founder, Board Member", company: "Snapfix", sector: "Software / SaaS", domain: "snapfix.com", emailMasked: "p••••@snapfix.com", linkedin: true, hasEmail: true, hasDraft: true },
    { id: "c3", listId: "l1", name: "Brian Thompson", role: "Founder, Managing Director", company: "OutForm Consulting", sector: "Accounting / advisory", domain: "outformconsulting.com", emailMasked: "b••••@outformconsulting.com", linkedin: true, hasEmail: true, hasDraft: true },
    { id: "c4", listId: "l1", name: "Stephen Keogh", role: "Managing Partner", company: "MHP Sellors", sector: "Law / legal", domain: "mhpsellors.ie", emailMasked: "", linkedin: true, hasEmail: false, hasDraft: false },
    { id: "c5", listId: "l1", name: "John Wallace", role: "Managing Director", company: "Sorensen Civil Engineering", sector: "Engineering", domain: "sorensen.ie", emailMasked: "j••••@sorensen.ie", linkedin: true, hasEmail: true, hasDraft: true },
    { id: "c6", listId: "l1", name: "Michael York", role: "Chief Executive Officer", company: "GDHF", sector: "Financial services", domain: "gdhf-lease.com", emailMasked: "m••••@gdhf-lease.com", linkedin: true, hasEmail: true, hasDraft: true },
    { id: "c7", listId: "l1", name: "Emmett Kilduff", role: "Founder & Chairman", company: "Eagle Alpha", sector: "Technology / data", domain: "eaglealpha.com", emailMasked: "e••••@eaglealpha.com", linkedin: true, hasEmail: true, hasDraft: true },
    { id: "c8", listId: "l1", name: "Jim Hughes", role: "Chief Executive Officer", company: "Innovate", sector: "IT services", domain: "innovate.ie", emailMasked: "j••••@innovate.ie", linkedin: true, hasEmail: true, hasDraft: true },
    { id: "c9", listId: "l1", name: "Wayne Crosbie", role: "CEO / Managing Director", company: "Crosbie Group", sector: "Engineering", domain: "crosbie.ie", emailMasked: "w••••@crosbie.ie", linkedin: true, hasEmail: true, hasDraft: true },
    { id: "c10", listId: "l2", name: "Aoife Brennan", role: "Head of People", company: "Fenergo", sector: "Software / SaaS", domain: "fenergo.com", emailMasked: "a••••@fenergo.com", linkedin: true, hasEmail: true, hasDraft: true },
    { id: "c11", listId: "l2", name: "Colm Byrne", role: "HR Director", company: "Kingspan", sector: "Manufacturing", domain: "kingspan.com", emailMasked: "c••••@kingspan.com", linkedin: true, hasEmail: true, hasDraft: false },
    { id: "c12", listId: "l4", name: "Sharon Kelly", role: "Chief Executive", company: "Version 1", sector: "IT services", domain: "version1.com", emailMasked: "s••••@version1.com", linkedin: true, hasEmail: true, hasDraft: true },
  ],
  emailCampaigns: [
    { id: "e1", name: "List 1 · No in-house HR · CEO direct", status: "active", sent: 3820, openRate: 47, replyRate: 1.9, positive: 9, steps: 4 },
    { id: "e2", name: "List 2 · Has senior HR · People lead", status: "active", sent: 2140, openRate: 44, replyRate: 1.4, positive: 4, steps: 4 },
    { id: "e3", name: "List 3 · Company Direct", status: "paused", sent: 980, openRate: 39, replyRate: 0.9, positive: 1, steps: 3 },
    { id: "e4", name: "VIP · white glove", status: "draft", sent: 0, openRate: 0, replyRate: 0, positive: 0, steps: 5 },
  ],
  linkedinCampaigns: [
    { id: "li1", name: "List 1 · Founder connect + follow", status: "active", invitesSent: 412, accepted: 38, replied: 22, messagesSent: 156 },
    { id: "li2", name: "List 2 · People-lead warm angle", status: "active", invitesSent: 280, accepted: 41, replied: 14, messagesSent: 98 },
    { id: "li3", name: "VIP · manual touch", status: "paused", invitesSent: 40, accepted: 55, replied: 9, messagesSent: 61 },
  ],
  phoneTouches: [
    { id: "p1", name: "John Wallace", company: "Sorensen", phoneMasked: "+353 87 •• •• 412", channel: "whatsapp", outcome: "replied", when: "3h ago" },
    { id: "p2", name: "Emmett Kilduff", company: "Eagle Alpha", phoneMasked: "+353 86 •• •• 907", channel: "call", outcome: "connected", when: "5h ago" },
    { id: "p3", name: "Sharon Kelly", company: "Version 1", phoneMasked: "+353 85 •• •• 233", channel: "whatsapp", outcome: "delivered", when: "6h ago" },
    { id: "p4", name: "Wayne Crosbie", company: "Crosbie Group", phoneMasked: "+353 87 •• •• 118", channel: "call", outcome: "voicemail", when: "yesterday" },
    { id: "p5", name: "Colm Byrne", company: "Kingspan", phoneMasked: "+353 86 •• •• 640", channel: "whatsapp", outcome: "queued", when: "queued" },
  ],
  content: [
    { id: "ct1", title: "Why fast-growing Irish firms outgrow their first HR hire", hook: "The 30-to-300 gap nobody plans for.", status: "scheduled", date: "2026-07-16", format: "text" },
    { id: "ct2", title: "3 signs your ops lead is quietly running HR", hook: "And what it is costing you.", status: "scheduled", date: "2026-07-18", format: "carousel" },
    { id: "ct3", title: "The real cost of a bad first HR hire", hook: "A short teardown.", status: "draft", date: "2026-07-21", format: "text" },
    { id: "ct4", title: "What we learned onboarding 40 Irish SMEs", hook: "Patterns across sectors.", status: "idea", date: "2026-07-24", format: "video" },
    { id: "ct5", title: "Poll: who owns HR before you hire a Head of People?", hook: "", status: "published", date: "2026-07-11", format: "poll" },
  ],
  crm: [
    { id: "w1", stage: "sql", company: "GDHF", person: "Michael York", personRole: "Chief Executive Officer", category: "Positive/SQL", snippet: "Yes, this is timely — we've been thinking about exactly this. Can you send a time?", country: "Ireland", heat: 77, next: "Send booking link", channels: ["email"], buildSent: true },
    { id: "w2", stage: "neutral", company: "Snapfix", person: "Paul McCarthy", personRole: "Founder", category: "Neutral", snippet: "Appreciate the note. Who is this for exactly?", country: "Ireland", heat: 44, next: "Qualify reply", channels: ["email", "linkedin"], buildSent: false },
    { id: "w3", stage: "mql", company: "Sorensen", person: "John Wallace", personRole: "Managing Director", category: "MQL", snippet: "Interesting timing. Send me some info and I'll take a look.", country: "Ireland", heat: 55, next: "Send Build", channels: ["email", "whatsapp"], buildSent: false },
    { id: "w4", stage: "mql", company: "Innovate", person: "Jim Hughes", personRole: "Chief Executive Officer", category: "MQL", snippet: "Could be relevant for Q4. What does onboarding look like?", country: "Ireland", heat: 50, next: "Send Build", channels: ["email"], buildSent: false },
    { id: "w5", stage: "discovery", company: "Eagle Alpha", person: "Emmett Kilduff", personRole: "Founder & Chairman", category: "Positive/SQL", snippet: "Booked for Wednesday. Looking forward to it.", country: "Ireland", heat: 62, next: "Prep discovery", channels: ["email", "call"], buildSent: true },
    { id: "w6", stage: "discovery", company: "Version 1", person: "Sharon Kelly", personRole: "Chief Executive", category: "Positive/SQL", snippet: "Let's talk Thursday afternoon. Send the invite.", country: "Ireland", heat: 66, next: "Send invite", channels: ["email", "whatsapp"], buildSent: true },
    { id: "w7", stage: "proposal_sent", company: "MHP Sellors", person: "Stephen Keogh", personRole: "Managing Partner", category: "Positive/SQL", snippet: "Thanks for the proposal — reviewing internally, back to you next week.", country: "Ireland", heat: 59, next: "Follow up Mon", channels: ["email", "linkedin"], buildSent: true },
    { id: "w8", stage: "won", company: "OutForm Consulting", person: "Brian Thompson", personRole: "Managing Director", category: "Positive/SQL", snippet: "Let's do it. Send the agreement.", country: "Ireland", heat: 90, next: "Kickoff", channels: ["email", "call"], buildSent: true },
    { id: "w9", stage: "lost", company: "Kingspan", person: "Colm Byrne", personRole: "HR Director", category: "Negative", snippet: "We have this covered in-house, thanks.", country: "Ireland", heat: 10, next: "Nurture in 90d", channels: ["email"], buildSent: false },
  ],
  library: [
    { id: "lib1", title: "Arco Irish — ICP & positioning dossier", kind: "dossier", summary: "Who Arco sells to, the wedge, and the message that lands with owner-led Irish SMEs.", sources: 6, updated: "2d ago" },
    { id: "lib2", title: "No-in-house-HR play", kind: "playbook", summary: "The CEO-direct angle: why it works, the sequence, and the objection map.", sources: 4, updated: "5d ago" },
    { id: "lib3", title: "Irish SME hiring-signal research", kind: "research", summary: "Firms scaling past 30 heads without a People function — the intent signal.", sources: 5, updated: "1w ago" },
    { id: "lib4", title: "Per-contact dossiers · List 1", kind: "dossier", summary: "447 CEO profiles with company facts + why-fit, feeding the personalized first line.", sources: 6, updated: "1d ago" },
    { id: "lib5", title: "Brand kit & email templates", kind: "asset", summary: "Approved tone, signature, and the 4 proven Step-1 shapes for Arco.", sources: 2, updated: "3w ago" },
  ],
  journey: [],
};

// ── Luxvance own-outbound workspace (leaner, founder-led) ──
const LUXVANCE: WorkspaceData = {
  kpis: [
    { label: "Cold leads live", value: "1,840", sub: "IE founders + UK heads of sales" },
    { label: "Warm in pipeline", value: "63", sub: "replied · being worked", tone: "good" },
    { label: "Meetings booked", value: "19", sub: "own outbound", tone: "good" },
    { label: "Reply rate", value: "2.1%", sub: "email · last 30 days" },
    { label: "Open rate", value: "49%", sub: "email · last 30 days" },
    { label: "Pipeline value", value: "$214k", sub: "weighted, this quarter" },
  ],
  activity: [
    { id: "la1", channel: "crm", text: "E. J. McDougall (LECANGS) — new positive reply", when: "22m ago" },
    { id: "la2", channel: "email", text: "SaaS founders IE · step 3 sent to 320 leads", when: "1h ago" },
    { id: "la3", channel: "linkedin", text: "Guy Kashtan (Odeeo) accepted + replied", when: "2h ago" },
    { id: "la4", channel: "crm", text: "Formidium moved to Proposal Sent", when: "4h ago" },
  ],
  lists: [
    { id: "ll1", name: "IE SaaS founders 20–200", note: "Early founders, pre-Series A bias — our prime ICP.", count: 860, channels: ["email", "linkedin"] },
    { id: "ll2", name: "UK Heads of Sales", note: "Below-CEO, revenue owners at scaling SaaS.", count: 640, channels: ["email", "linkedin", "ads"] },
    { id: "ll3", name: "Reconnect · warm 2026", note: "Prior conversations to reopen.", count: 340, channels: ["email"] },
  ],
  leads: [
    { id: "x1", listId: "ll1", name: "Guy Kashtan", role: "VP of Business Development", company: "Odeeo", sector: "AdTech", domain: "odeeo.io", emailMasked: "g••••@odeeo.io", linkedin: true, hasEmail: true, hasDraft: true },
    { id: "x2", listId: "ll1", name: "Rohan Premnath", role: "Business Development Director", company: "AudioStack", sector: "AI / audio", domain: "audiostack.ai", emailMasked: "r••••@audiostack.ai", linkedin: true, hasEmail: true, hasDraft: true },
    { id: "x3", listId: "ll2", name: "Hugo Dessi", role: "Head of Sales", company: "SaleCycle", sector: "MarTech", domain: "salecycle.com", emailMasked: "h••••@salecycle.com", linkedin: true, hasEmail: true, hasDraft: false },
    { id: "x4", listId: "ll2", name: "Daniel Hijazi", role: "Founder & CEO", company: "Micron Agritech", sector: "AgriTech", domain: "micronagritech.com", emailMasked: "d••••@micronagritech.com", linkedin: true, hasEmail: true, hasDraft: true },
  ],
  emailCampaigns: [
    { id: "le1", name: "IE SaaS founders · Creative Ideas", status: "active", sent: 6300, openRate: 51, replyRate: 2.3, positive: 14, steps: 4 },
    { id: "le2", name: "UK Heads of Sales · Recent promotion", status: "active", sent: 4100, openRate: 48, replyRate: 1.9, positive: 8, steps: 4 },
    { id: "le3", name: "Reconnect · warm 2026", status: "draft", sent: 0, openRate: 0, replyRate: 0, positive: 0, steps: 3 },
  ],
  linkedinCampaigns: [
    { id: "lli1", name: "IE founders · connect + Build", status: "active", invitesSent: 520, accepted: 44, replied: 31, messagesSent: 210 },
    { id: "lli2", name: "UK sales leaders", status: "active", invitesSent: 360, accepted: 39, replied: 18, messagesSent: 140 },
  ],
  phoneTouches: [
    { id: "lp1", name: "Guy Kashtan", company: "Odeeo", phoneMasked: "+972 5• •• •• 220", channel: "whatsapp", outcome: "replied", when: "2h ago" },
    { id: "lp2", name: "Daniel Hijazi", company: "Micron Agritech", phoneMasked: "+353 8• •• •• 771", channel: "call", outcome: "connected", when: "1d ago" },
  ],
  content: [
    { id: "lct1", title: "We build revenue machines — here's the stack", hook: "The 12 agents behind every booked call.", status: "scheduled", date: "2026-07-16", format: "carousel" },
    { id: "lct2", title: "Cold list → booked call: the whole funnel in one image", hook: "", status: "draft", date: "2026-07-19", format: "text" },
    { id: "lct3", title: "Why the Build is the ad", hook: "The lead magnet that IS the demo.", status: "idea", date: "2026-07-23", format: "video" },
  ],
  crm: [
    { id: "lw1", stage: "sql", company: "LECANGS Fulfillment", person: "Hamid Qassimi", personRole: "Business Development Director", category: "Positive/SQL", snippet: "Yes thanks — let's set something up.", country: "United States", heat: 59, next: "Send booking link", channels: ["email"], buildSent: false },
    { id: "lw2", stage: "mql", company: "Odeeo", person: "Guy Kashtan", personRole: "VP of Business Development", category: "MQL", snippet: "Appreciate the outreach. If the message was tailored to our ICP I'd consider it.", country: "Israel", heat: 50, next: "Send Build", channels: ["email", "linkedin", "whatsapp"], buildSent: false },
    { id: "lw3", stage: "discovery", company: "AudioStack", person: "Rohan Premnath", personRole: "Business Development Director", category: "MQL", snippet: "Booked for next Tuesday. Look forward to it.", country: "United Kingdom", heat: 50, next: "Prep discovery", channels: ["email"], buildSent: true },
    { id: "lw4", stage: "proposal_sent", company: "Formidium", person: "Sushil Jain", personRole: "SVP Business Development", category: "Positive/SQL", snippet: "You joining the call? Warm regards, Sushil.", country: "India", heat: 59, next: "Follow up", channels: ["email", "call"], buildSent: true },
    { id: "lw5", stage: "won", company: "Arco Irish", person: "Paul Herrick", personRole: "CEO & Founder", category: "Positive/SQL", snippet: "Let's build it. First pilot.", country: "Ireland", heat: 95, next: "Operate", channels: ["email", "call"], buildSent: true },
  ],
  library: [
    { id: "llib1", title: "Luxvance ICP — early founders", kind: "dossier", summary: "Pre-funding TAM, the founder-first wedge, and the offer ladder.", sources: 6, updated: "1d ago" },
    { id: "llib2", title: "Proven campaign templates", kind: "playbook", summary: "Creative Ideas, New Hire, Lookalike — the three that always run.", sources: 5, updated: "4d ago" },
    { id: "llib3", title: "The Build — sales asset", kind: "asset", summary: "The per-prospect lead magnet that doubles as the product demo.", sources: 3, updated: "2d ago" },
  ],
  journey: [],
};

const DATA: Record<string, WorkspaceData> = {
  luxvance: LUXVANCE,
  "arco-irish": ARCO,
};

export function getWorkspaceData(slug: string): WorkspaceData | undefined {
  return DATA[slug];
}
