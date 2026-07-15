import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Validates the shared portal password and, on success, sets the gate cookie
// that proxy.ts checks. Pure form POST (no client JS). Open-redirect safe:
// `next` must be a same-site absolute path.

const COOKIE = "lxv_gate";

function safeNext(raw: string): string {
  // Only allow a single-slash absolute path (blocks //evil.com and full URLs).
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));

  const expected = process.env.PORTAL_PASSWORD;
  const token = process.env.PORTAL_ACCESS_TOKEN;

  if (!expected || !token || password !== expected) {
    const back = new URL("/gate", request.url);
    back.searchParams.set("next", next);
    back.searchParams.set("error", "1");
    return NextResponse.redirect(back, { status: 303 });
  }

  const res = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
