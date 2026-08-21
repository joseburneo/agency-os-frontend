import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { loadWorkspaceKind } from "./data";
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
  // No cookie matched: fall back to the LEAST privileged mode, never "agency".
  // Pages are already gated by the proxy, but /api/* is excluded from its matcher,
  // so the write routes (intelligence/save|delete|optimize, blocklist/add|remove)
  // authorize on this return value alone — "agency" here let an anonymous request
  // edit any workspace's library and blocklist.
  return "demo";
}

// May this visitor WRITE this workspace's Brain (library sections + the ops
// fields on the workspace row)? Agency and the owning client always may.
//
// A demo visitor may too, but ONLY on a magnet (Jose, 2026-08-21). A magnet is
// sales material we want the prospect to correct: every edit lands in
// intelligence_library, the same table a paying client uses, so a prospect who
// signs starts onboarding pre-loaded — and the edit itself is the most valuable
// thing they can give us. It costs one database row. Same doctrine the
// Prospecting proxy already runs on: the wall is at the buy, not at the input.
//
// The kind check is the whole security of this function, not a detail. /api/* is
// excluded from the proxy matcher, so an anonymous POST naming a PAYING client's
// slug also resolves to "demo" here. Without the check, anyone on the internet
// could rewrite the Brain that the reply engine loads as mandatory context
// before writing in that client's name. A paying workspace is never
// kind='magnet', so it stays locked.
export async function canEditBrain(slug: string): Promise<boolean> {
  const mode = await portalMode(slug);
  if (mode !== "demo") return true;
  return (await loadWorkspaceKind(slug)) === "magnet";
}

// Guard a module page: 404 if this visitor's mode can't see it. A demo prospect
// hitting /w/<slug>/library (or any non-demo module) by URL gets notFound().
export async function assertModuleVisible(slug: string, key: ModuleKey): Promise<void> {
  const [mode, kind] = await Promise.all([portalMode(slug), loadWorkspaceKind(slug)]);
  if (!isModuleVisible(slug, key, mode === "demo", kind)) notFound();
}

// True only for the agency session (Jose / the team). Used to gate the internal
// Handbook and any other agency-only surface. Route handlers must call this
// themselves — the proxy already gates non-/w pages, but /api/* is excluded from
// the proxy matcher, so an API route serving agency content re-checks here.
// When the gate is off (no secret, local dev) everyone is agency.
export async function isAgency(): Promise<boolean> {
  const secret = process.env.PORTAL_ACCESS_TOKEN;
  if (!secret) return true;
  const jar = await cookies();
  return jar.get(AGENCY_COOKIE)?.value === (await scopeToken(secret, "agency"));
}
