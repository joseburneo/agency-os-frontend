import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AGENCY_COOKIE, wsCookie, demoCookie, scopeToken, demoToken } from "./gate";
import { isModuleVisible } from "./modules";
import type { ModuleKey } from "./types";

// Server-side read of how the current visitor is unlocked for a workspace.
// Mirrors the proxy's checks (agency > client > demo), so a page can render the
// lite/sandboxed demo experience for prospects while Jose and paying clients get
// the full workspace. When the gate is off (no secret, e.g. local dev) everyone
// is treated as agency so nothing is hidden.
export type PortalMode = "agency" | "client" | "demo";

export async function portalMode(slug: string): Promise<PortalMode> {
  const secret = process.env.PORTAL_ACCESS_TOKEN;
  if (!secret) return "agency";
  const jar = await cookies();
  if (jar.get(AGENCY_COOKIE)?.value === (await scopeToken(secret, "agency"))) return "agency";
  if (jar.get(wsCookie(slug))?.value === (await scopeToken(secret, `ws:${slug}`))) return "client";
  if (jar.get(demoCookie(slug))?.value === (await demoToken(secret, slug))) return "demo";
  return "agency";
}

// Guard a module page: 404 if this visitor's mode can't see it. A demo prospect
// hitting /w/<slug>/library (or any non-demo module) by URL gets notFound().
export async function assertModuleVisible(slug: string, key: ModuleKey): Promise<void> {
  const mode = await portalMode(slug);
  if (!isModuleVisible(slug, key, mode === "demo")) notFound();
}
