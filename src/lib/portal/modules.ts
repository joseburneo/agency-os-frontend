import type { ModuleKey } from "./types";

// Per-workspace module visibility. Pure config (no server imports) so the client
// sidebar can import it directly. Default = every module (Luxvance runs the full
// stack). Overrides trim a client's portal to its actual engagement.

// "cadence" — Sequence & Schedule: the full multi-channel journey (every email
// and LinkedIn touch with its copy) plus sending windows and daily limits.
export const CADENCE_MODULE: ModuleKey = "cadence";

export const ALL_MODULES: ModuleKey[] = [
  "dashboard",
  "target-lists",
  "email",
  "linkedin",
  CADENCE_MODULE,
  "whatsapp",
  "content",
  "linkedin-ads",
  "meta-ads",
  "crm",
  "library",
  "blocklist",
  "roadmap",
];

const OVERRIDES: Record<string, ModuleKey[]> = {
  // Arco Irish — cold-outreach engagement: email + LinkedIn + CRM, plus its lead
  // lists (the Build), the sequence & schedule (cadence), intelligence library
  // (the client brain), do-not-contact blocklist and the client-success roadmap.
  // No WhatsApp, no content calendar, no ads / Meta.
  "arco-irish": ["dashboard", "target-lists", "email", "linkedin", CADENCE_MODULE, "crm", "library", "blocklist", "roadmap"],
};

export function enabledModules(slug: string): ModuleKey[] {
  return OVERRIDES[slug] ?? ALL_MODULES;
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

// A MAGNET is not a portal, it is a two-page piece of sales material: the page
// that explains what we found about their business, and their fifty leads with
// the outreach written. Everything else in the app has nothing in it for a
// prospect, and a sidebar of empty modules reads as an unfinished product
// rather than a generous gift.
export const MAGNET_MODULES: ModuleKey[] = ["dashboard", "target-lists"];

// What a given visitor sees: the workspace's own set, further trimmed to the
// demo set when this is a prospect preview.
export function visibleModules(slug: string, demo: boolean, kind?: string): ModuleKey[] {
  // A magnet is trimmed for everyone who opens it, agency included: what Jose
  // reviews before sending has to be what the prospect will actually see.
  if (kind === "magnet") return MAGNET_MODULES;
  const base = enabledModules(slug);
  return demo ? base.filter((m) => DEMO_MODULES.includes(m)) : base;
}

export function isModuleVisible(slug: string, key: ModuleKey, demo: boolean, kind?: string): boolean {
  return visibleModules(slug, demo, kind).includes(key);
}
