import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next 16 renamed `middleware` -> `proxy`. This gates the whole app behind a
// single shared password so the deploy stays private (client preview) until
// per-workspace auth lands. The gate is DISABLED automatically when no
// PORTAL_ACCESS_TOKEN is configured, so local dev and previews are never locked
// out by accident.

const COOKIE = "lxv_gate";

export function proxy(request: NextRequest) {
  const token = process.env.PORTAL_ACCESS_TOKEN;
  if (!token) return NextResponse.next(); // gate off when unconfigured

  if (request.cookies.get(COOKIE)?.value === token) return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = url.pathname + url.search;
  url.pathname = "/gate";
  url.search = "";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  // Gate every page. Exclude the gate page itself, all API routes (own auth),
  // Next internals and static icons so assets and the login POST stay reachable.
  matcher: [
    "/((?!api|_next/static|_next/image|gate|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest).*)",
  ],
};
