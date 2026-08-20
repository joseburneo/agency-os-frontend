import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AGENCY_COOKIE, wsCookie, scopeToken, parseWsKeys } from "@/lib/portal/gate";
import {
  getWorkspaceHash,
  verifyPassword,
  hasUsers,
  verifyUser,
  verifyAgencyUser,
  verifyUserAnyWorkspace,
} from "@/lib/portal/auth";

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

// Brute-force brake. The workspace keys were a guessable `<slug>-<year>` pattern
// and this route had no limiter at all, so a few thousand guesses opened a client
// portal. Per (ip, scope), in-process — one Vercel instance is enough friction for
// a form nobody legitimate submits more than a handful of times.
const ATTEMPTS = new Map<string, { n: number; until: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60_000;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hit = ATTEMPTS.get(key);
  if (!hit || now > hit.until) return false;
  return hit.n >= MAX_ATTEMPTS;
}
function recordFailure(key: string): void {
  const now = Date.now();
  const hit = ATTEMPTS.get(key);
  if (!hit || now > hit.until) ATTEMPTS.set(key, { n: 1, until: now + WINDOW_MS });
  else hit.n += 1;
  if (ATTEMPTS.size > 5000) for (const [k, v] of ATTEMPTS) if (now > v.until) ATTEMPTS.delete(k);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const email = String(form.get("email") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));
  const scope = String(form.get("scope") ?? "agency");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rlKey = `${ip}|${scope}`;

  if (rateLimited(rlKey)) {
    const back = new URL("/gate", request.url);
    back.searchParams.set("next", next);
    back.searchParams.set("scope", scope);
    back.searchParams.set("error", "rate");
    return NextResponse.redirect(back, { status: 303 });
  }

  const secret = process.env.PORTAL_ACCESS_TOKEN;
  const agencyPw = process.env.PORTAL_AGENCY_PASSWORD;
  const wsKeys = parseWsKeys(process.env.PORTAL_WS_KEYS);
  // Per-person agency keys ("jose:pw,ben:pw2") so each teammate has their OWN
  // agency password, revocable individually, without sharing Jose's. Any match
  // unlocks the same agency scope as PORTAL_AGENCY_PASSWORD.
  const agencyKeys = parseWsKeys(process.env.PORTAL_AGENCY_KEYS);

  // 1) Agency key — unlocks everything, from any gate. Jose's password OR any
  //    named teammate key (e.g. Ben's).
  // A named agency account (portal_users, role='agency') wins first — that is the
  // per-person superadmin, and it opens any workspace just like the shared key did.
  // PORTAL_AGENCY_PASSWORD stays as break-glass: if the DB or the invite email ever
  // fails, we must not be locked out of our own product.
  if (secret && email && (await verifyAgencyUser(email, password))) {
    const res = NextResponse.redirect(new URL(next, request.url), { status: 303 });
    res.cookies.set(AGENCY_COOKIE, await scopeToken(secret, "agency"), COOKIE_OPTS);
    return res;
  }

  const isAgencyPw = Boolean(
    secret && password &&
      (password === agencyPw || Object.values(agencyKeys).includes(password))
  );
  if (secret && isAgencyPw) {
    const res = NextResponse.redirect(new URL(next, request.url), { status: 303 });
    res.cookies.set(AGENCY_COOKIE, await scopeToken(secret, "agency"), COOKIE_OPTS);
    return res;
  }

  // 1b) A CLIENT who landed on the agency gate. The bare app.luxvance.com and the
  //     "Go to sign in" button after setting a password both send people here, and
  //     before this branch a client's correct credentials were rejected with no hint
  //     that /w/<slug> was the URL they needed. Resolve them from their email and
  //     drop them straight into their own workspace.
  if (secret && scope === "agency" && email && password) {
    const hit = await verifyUserAnyWorkspace(email, password);
    if (hit) {
      const res = NextResponse.redirect(new URL(`/w/${hit.slug}`, request.url), { status: 303 });
      res.cookies.set(wsCookie(hit.slug), await scopeToken(secret, `ws:${hit.slug}`), COOKIE_OPTS);
      return res;
    }
  }

  // 2) This workspace. A client workspace with real users signs in with EMAIL +
  //    PASSWORD (portal_users, one row per human, revocable individually). A
  //    workspace with no users yet keeps the legacy shared password — its own DB
  //    hash, else the bootstrap key from PORTAL_WS_KEYS — so nobody is locked out
  //    mid-migration. Demo/magnet workspaces never reach here: the proxy lets them
  //    straight through on the link alone.
  if (secret && scope !== "agency") {
    let ok = false;
    if (await hasUsers(scope)) {
      ok = (await verifyUser(scope, email, password)) !== null;
    } else {
      const dbHash = await getWorkspaceHash(scope);
      ok = dbHash
        ? await verifyPassword(password, dbHash)
        : Boolean(wsKeys[scope] && password === wsKeys[scope]);
    }
    if (ok) {
      const res = NextResponse.redirect(new URL(next, request.url), { status: 303 });
      res.cookies.set(wsCookie(scope), await scopeToken(secret, `ws:${scope}`), COOKIE_OPTS);
      return res;
    }
  }

  // 3) Wrong credentials — back to the gate for this scope.
  recordFailure(rlKey);
  const back = new URL("/gate", request.url);
  back.searchParams.set("next", next);
  back.searchParams.set("scope", scope);
  back.searchParams.set("error", "1");
  return NextResponse.redirect(back, { status: 303 });
}
