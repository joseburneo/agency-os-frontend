import type { ModuleKey } from "./types";

// Per-workspace module visibility. Pure config (no server imports) so the client
// sidebar can import it directly. Default = every module (Luxvance runs the full
// stack). Overrides trim a client's portal to its actual engagement.

// "cadence" — Sequence & Schedule: the full multi-channel journey (every email
// and LinkedIn touch with its copy) plus sending windows and daily limits.
export const CADENCE_MODULE: ModuleKey = "cadence";

// Retired from the menu on 2026-08-13 (Jose). Each of these was a real tab with
// nothing behind it and no roadmap to fill it, and a sidebar of empty rooms reads
// as an unfinished product rather than an ambitious one:
//
//   cadence       Sequence & Schedule — belongs INSIDE Email Campaigns when that
//                 module is built, not as a peer to it
//   whatsapp      WhatsApp & Phone
//   content       Content Calendar
//   linkedin-ads  the whole Ads section
//   meta-ads
//
// The keys and their routes still exist, so nothing 404s for anyone holding a
// link and putting one back is a one-line change. They are simply not offered.
const RETIRED: ModuleKey[] = ["cadence", "whatsapp", "content", "linkedin-ads", "meta-ads"];

export const ALL_MODULES: ModuleKey[] = [
  "dashboard",
  "crm",
  "target-lists",
  "email",
  "linkedin",
  "library",
  "blocklist",
  "roadmap",
];

const OVERRIDES: Record<string, ModuleKey[]> = {
  // Arco Irish — cold-outreach engagement: email + CRM, plus its lead lists (the
  // Build), the sequence & schedule (cadence), intelligence library (the client
  // brain), do-not-contact blocklist and the client-success roadmap.
  // No WhatsApp, no content calendar, no ads / Meta. LinkedIn is worked white-glove
  // from the VIP lists (no LinkedIn sequencer running), so the LinkedIn Campaigns
  // module stays hidden until one exists — an empty tab reads as a broken product
  // (Jose, 2026-08-03).
  "arco-irish": ["dashboard", "crm", "target-lists", "email", "library", "blocklist", "roadmap"],

  // Kcal and Connect Resources — email-led outbound. Same shape as Arco but without
  // LinkedIn: both ran on email only, and an empty LinkedIn tab reads as a broken
  // product rather than a channel they have not switched on. Add "linkedin" back the
  // day either one starts a LinkedIn sequence.
  "kcal": ["dashboard", "crm", "target-lists", "email", "library", "blocklist", "roadmap"],
  "connect-resources": ["dashboard", "crm", "target-lists", "email", "library", "blocklist", "roadmap"],
};

export function enabledModules(slug: string): ModuleKey[] {
  // RETIRED is filtered here rather than trusted to be absent from every list, so an
  // override written before 2026-08-13 (or pasted from an old one) cannot quietly
  // bring an empty tab back.
  return (OVERRIDES[slug] ?? ALL_MODULES).filter((m) => !RETIRED.includes(m));
}

export function isModuleEnabled(slug: string, key: ModuleKey): boolean {
  return enabledModules(slug).includes(key);
}

// Demo (prospect preview) shows only the "feel the product" modules, read-mostly:
// their real 50 leads (Target Lists), the exact outreach (Email + LinkedIn), and
// the pipeline it fills (CRM). No Library/Journey, WhatsApp or Content in a demo.
// Cadence stays out too: demo workspaces have no locked sequence yet, and an
// empty "not configured" page would break the demo's feel.
export const DEMO_MODULES: ModuleKey[] = ["dashboard", "target-lists", "email", "linkedin", "crm"];

// A MAGNET is a three-page piece of sales material: the page that explains what
// we found about their business, their fifty leads with the outreach written,
// and their Brain — the Intelligence Library the Build seeded from its research,
// which doubles as the platform's strongest promise ("your Brain has already
// started building"). Everything else in the app has nothing in it for a
// prospect, and a sidebar of empty modules reads as an unfinished product
// rather than a generous gift.
export const MAGNET_MODULES: ModuleKey[] = ["dashboard", "target-lists", "library"];

// Per-magnet extras: a magnet that has advanced past "gift" into a live deal can
// earn additional modules (e.g. the proposal delivered as a Client Success
// Roadmap inside the prospect's own workspace).
const MAGNET_EXTRAS: Record<string, ModuleKey[]> = {
  "pepe-rodr-guez-de-vera": ["roadmap", "proposal"],
};

// What a given visitor sees: the workspace's own set, further trimmed to the
// demo set when this is a prospect preview.
export function visibleModules(slug: string, demo: boolean, kind?: string): ModuleKey[] {
  // A magnet is trimmed for everyone who opens it, agency included: what Jose
  // reviews before sending has to be what the prospect will actually see.
  if (kind === "magnet") return [...MAGNET_MODULES, ...(MAGNET_EXTRAS[slug] ?? [])];
  const base = enabledModules(slug);
  return demo ? base.filter((m) => DEMO_MODULES.includes(m)) : base;
}

export function isModuleVisible(slug: string, key: ModuleKey, demo: boolean, kind?: string): boolean {
  return visibleModules(slug, demo, kind).includes(key);
}
