import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AGENCY_COOKIE, wsCookie, scopeToken, requiredScope } from "@/lib/portal/gate";

// Next 16 renamed `middleware` -> `proxy`. Two-tier gate:
//   • agency cookie unlocks everything (agency view + any workspace),
//   • a per-workspace cookie unlocks only its own /w/<slug>.
// Disabled automatically when PORTAL_ACCESS_TOKEN (the cookie secret) is unset,
// so local dev and previews are never locked out by accident.

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
    const ok = request.cookies.get(wsCookie(scope.slug))?.value === (await scopeToken(secret, `ws:${scope.slug}`));
    if (ok) return NextResponse.next();
    return toGate(request, path, scope.slug);
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
