import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AGENCY_COOKIE, wsCookie, scopeToken, parseWsKeys } from "@/lib/portal/gate";
import { getWorkspaceHash, verifyPassword } from "@/lib/portal/auth";

// Validates a submitted key against the agency password OR the target
// workspace's key, then sets the matching scope cookie. The agency password
// wins from any gate (it unlocks everything). Pure form POST, no client JS.

function safeNext(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));
  const scope = String(form.get("scope") ?? "agency");

  const secret = process.env.PORTAL_ACCESS_TOKEN;
  const agencyPw = process.env.PORTAL_AGENCY_PASSWORD;
  const wsKeys = parseWsKeys(process.env.PORTAL_WS_KEYS);
  // Per-person agency keys ("jose:pw,ben:pw2") so each teammate has their OWN
  // agency password, revocable individually, without sharing Jose's. Any match
  // unlocks the same agency scope as PORTAL_AGENCY_PASSWORD.
  const agencyKeys = parseWsKeys(process.env.PORTAL_AGENCY_KEYS);

  // 1) Agency key — unlocks everything, from any gate. Jose's password OR any
  //    named teammate key (e.g. Ben's).
  const isAgencyPw = Boolean(
    secret && password &&
      (password === agencyPw || Object.values(agencyKeys).includes(password))
  );
  if (secret && isAgencyPw) {
    const res = NextResponse.redirect(new URL(next, request.url), { status: 303 });
    res.cookies.set(AGENCY_COOKIE, await scopeToken(secret, "agency"), COOKIE_OPTS);
    return res;
  }

  // 2) This workspace — the client's own password (DB hash) if they've set one,
  //    otherwise the bootstrap key from PORTAL_WS_KEYS (the temp password we
  //    emailed them). Either way it unlocks only /w/<scope>.
  if (secret && scope !== "agency") {
    const dbHash = await getWorkspaceHash(scope);
    const ok = dbHash
      ? await verifyPassword(password, dbHash)
      : Boolean(wsKeys[scope] && password === wsKeys[scope]);
    if (ok) {
      const res = NextResponse.redirect(new URL(next, request.url), { status: 303 });
      res.cookies.set(wsCookie(scope), await scopeToken(secret, `ws:${scope}`), COOKIE_OPTS);
      return res;
    }
  }

  // 3) Wrong key — back to the gate for this scope.
  const back = new URL("/gate", request.url);
  back.searchParams.set("next", next);
  back.searchParams.set("scope", scope);
  back.searchParams.set("error", "1");
  return NextResponse.redirect(back, { status: 303 });
}
