import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { redeemInvite, MIN_PASSWORD } from "@/lib/portal/auth";

// Redeems an invite / reset link. PUBLIC on purpose — the token IS the
// authorisation, which is why it is single-use, expiring, and stored only as a
// hash. Plain form POST, no client JS, same as the gate.

// Same brake as /api/gate: a token is 256 bits so it cannot be guessed, but the
// limiter keeps a flood of attempts from becoming a PBKDF2 CPU drain.
const ATTEMPTS = new Map<string, { n: number; until: number }>();
const MAX_ATTEMPTS = 12;
const WINDOW_MS = 10 * 60_000;

function tooMany(ip: string): boolean {
  const hit = ATTEMPTS.get(ip);
  return !!hit && Date.now() <= hit.until && hit.n >= MAX_ATTEMPTS;
}
function note(ip: string): void {
  const now = Date.now();
  const hit = ATTEMPTS.get(ip);
  if (!hit || now > hit.until) ATTEMPTS.set(ip, { n: 1, until: now + WINDOW_MS });
  else hit.n += 1;
  if (ATTEMPTS.size > 5000) for (const [k, v] of ATTEMPTS) if (now > v.until) ATTEMPTS.delete(k);
}

function back(request: NextRequest, token: string, message: string): NextResponse {
  const url = new URL("/set-password", request.url);
  if (token) url.searchParams.set("t", token);
  url.searchParams.set("error", encodeURIComponent(message));
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  if (tooMany(ip)) return back(request, token, "Too many attempts. Wait a few minutes.");
  if (!token) return back(request, "", "This link is not valid.");
  if (password !== confirm) return back(request, token, "The two passwords do not match.");
  if (password.length < MIN_PASSWORD) {
    return back(request, token, `Password must be at least ${MIN_PASSWORD} characters.`);
  }

  const result = await redeemInvite(token, password);
  if (!result.ok) {
    note(ip);
    return back(request, token, result.reason);
  }
  const done = new URL("/set-password", request.url);
  done.searchParams.set("done", "1");
  // Carry the workspace so the confirmation page can send them to THEIR gate.
  if (result.slug) done.searchParams.set("slug", result.slug);
  return NextResponse.redirect(done, { status: 303 });
}
