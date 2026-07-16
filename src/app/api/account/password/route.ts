import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { AGENCY_COOKIE, wsCookie, scopeToken, parseWsKeys } from "@/lib/portal/gate";
import { getWorkspaceHash, verifyPassword, setWorkspacePassword } from "@/lib/portal/auth";

// Change a workspace's password (self-serve). The requester must already hold
// that workspace's cookie, or be the agency. The current password is verified
// against the DB hash if set, else the bootstrap env key — unless the agency is
// doing it, which can always reset. New password is salted + hashed in the DB.
function back(request: NextRequest, slug: string, err?: string) {
  const url = new URL(`/w/${slug}/settings`, request.url);
  if (err) url.searchParams.set("error", err);
  else url.searchParams.set("ok", "1");
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.PORTAL_ACCESS_TOKEN;
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("new") ?? "");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  // Gate disabled (local dev): nothing to protect, just persist.
  if (!secret) {
    await setWorkspacePassword(slug, next);
    return back(request, slug);
  }

  const jar = await cookies();
  const isAgency = jar.get(AGENCY_COOKIE)?.value === (await scopeToken(secret, "agency"));
  const isThisWs = jar.get(wsCookie(slug))?.value === (await scopeToken(secret, `ws:${slug}`));
  if (!isAgency && !isThisWs) return back(request, slug, "unauthorized");

  if (next.length < 6) return back(request, slug, "short");

  // Non-agency must prove the current password.
  if (!isAgency) {
    const dbHash = await getWorkspaceHash(slug);
    const ok = dbHash
      ? await verifyPassword(current, dbHash)
      : parseWsKeys(process.env.PORTAL_WS_KEYS)[slug] === current;
    if (!ok) return back(request, slug, "badcurrent");
  }

  const saved = await setWorkspacePassword(slug, next);
  if (!saved) return back(request, slug, "save");
  return back(request, slug);
}
