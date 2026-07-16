import type { ModuleKey } from "./types";

// Per-workspace module visibility. Pure config (no server imports) so the client
// sidebar can import it directly. Default = every module (Luxvance runs the full
// stack). Overrides trim a client's portal to its actual engagement.

export const ALL_MODULES: ModuleKey[] = [
  "dashboard",
  "target-lists",
  "email",
  "linkedin",
  "whatsapp",
  "content",
  "crm",
  "library",
  "blocklist",
];

const OVERRIDES: Record<string, ModuleKey[]> = {
  // Arco Irish — cold-outreach engagement: email + LinkedIn + CRM, plus its lead
  // lists (the Build), intelligence library (the Journey) and its do-not-contact
  // blocklist. No WhatsApp, no content calendar, no ads / Meta.
  "arco-irish": ["dashboard", "target-lists", "email", "linkedin", "crm", "library", "blocklist"],
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
export const DEMO_MODULES: ModuleKey[] = ["dashboard", "target-lists", "email", "linkedin", "crm"];

// What a given visitor sees: the workspace's own set, further trimmed to the
// demo set when this is a prospect preview.
export function visibleModules(slug: string, demo: boolean): ModuleKey[] {
  const base = enabledModules(slug);
  return demo ? base.filter((m) => DEMO_MODULES.includes(m)) : base;
}

export function isModuleVisible(slug: string, key: ModuleKey, demo: boolean): boolean {
  return visibleModules(slug, demo).includes(key);
}
