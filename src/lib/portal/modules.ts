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
];

const OVERRIDES: Record<string, ModuleKey[]> = {
  // Arco Irish — cold-outreach engagement: email + LinkedIn + CRM, plus its lead
  // lists (the Build) and intelligence library (the Journey). No WhatsApp,
  // no content calendar, no ads / Meta.
  "arco-irish": ["dashboard", "target-lists", "email", "linkedin", "crm", "library"],
};

export function enabledModules(slug: string): ModuleKey[] {
  return OVERRIDES[slug] ?? ALL_MODULES;
}

export function isModuleEnabled(slug: string, key: ModuleKey): boolean {
  return enabledModules(slug).includes(key);
}
