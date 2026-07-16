import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AGENCY_COOKIE, wsCookie, demoCookie, scopeToken, demoToken, requiredScope } from "@/lib/portal/gate";

// Next 16 renamed `middleware` -> `proxy`. Three-tier gate:
//   • agency cookie unlocks everything (agency view + any workspace),
//   • a per-workspace cookie unlocks only its own /w/<slug> (client password),
//   • a demo cookie / signed ?k= link unlocks a lite preview of /w/<slug>
//     (prospect magnet — no password, sandboxed downstream).
// Disabled automatically when PORTAL_ACCESS_TOKEN (the cookie secret) is unset,
// so local dev and previews are never locked out by accident.

// Demo access has no real expiry — the "expires in 14 days" is copy only, so a
// prospect who comes back late still converts. Never lose a lead to a timer.
const DEMO_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

export async function proxy(request: NextRequest) {
  const secret = process.env.PORTAL_ACCESS_TOKEN;
  if (!secret) return NextResponse.next();

  const path = request.nextUrl.pathname;

  // The agency key opens everything.
  if (request.cookies.get(AGENCY_COOKIE)?.value === (await scopeToken(secret, "agency"))) {
    return NextResponse.next();
  }

  const scope = requiredScope(path);
  if (scope.kind === "ws") {
    const slug = scope.slug;

    // Client password already unlocked this workspace.
    if (request.cookies.get(wsCookie(slug))?.value === (await scopeToken(secret, `ws:${slug}`))) {
      return NextResponse.next();
    }
    // Demo already unlocked in this browser.
    if (request.cookies.get(demoCookie(slug))?.value === (await demoToken(secret, slug))) {
      return NextResponse.next();
    }
    // First hit from a demo magnet link: /w/<slug>?k=<token>. Validate the
    // signed token, drop the demo cookie, and strip ?k from the URL so it never
    // lingers in the address bar or history.
    const k = request.nextUrl.searchParams.get("k");
    if (k && k === (await demoToken(secret, slug))) {
      const clean = request.nextUrl.clone();
      clean.searchParams.delete("k");
      const res = NextResponse.redirect(clean);
      res.cookies.set(demoCookie(slug), await demoToken(secret, slug), DEMO_COOKIE_OPTS);
      return res;
    }
    return toGate(request, path, slug);
  }

  // Agency area, and no agency cookie → agency gate.
  return toGate(request, path, "agency");
}

function toGate(request: NextRequest, next: string, scope: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  url.searchParams.set("next", next);
  url.searchParams.set("scope", scope);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|gate|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest).*)",
  ],
};
