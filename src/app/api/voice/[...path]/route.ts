import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAgency } from "@/lib/portal/access";

// Proxy for the CRM's Call button. The browser NEVER talks to the voice API on
// Render directly, for two reasons:
//
//   1. The backend gates /api/crm/voice/* on VOICE_APP_SECRET. If the browser
//      carried that secret it would be public, and a public token endpoint is a
//      stranger dialing the world on our Twilio balance. The secret stays here,
//      server-side, and never ships to the client bundle.
//   2. Placing calls is agency-only. isAgency() is the same check the Handbook
//      uses; client and demo sessions get 403 even inside a workspace.
//
// Only the routes below are reachable. Anything else 404s, so this proxy can
// never become a general tunnel into the backend.
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://agency-os-api.onrender.com";

const POST_PATHS = new Set(["token", "dialout", "outcome"]);
const GET_PATHS = new Set(["health"]);

function allowed(parts: string[], method: "GET" | "POST"): boolean {
  const [head] = parts;
  if (method === "POST") return parts.length === 1 && POST_PATHS.has(head);
  // calls/<numeric prospect id>
  if (parts.length === 2 && head === "calls") return /^\d+$/.test(parts[1]);
  return parts.length === 1 && GET_PATHS.has(head);
}

async function forward(
  request: NextRequest,
  parts: string[],
  method: "GET" | "POST",
): Promise<NextResponse> {
  if (!(await isAgency())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  if (!allowed(parts, method)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const secret = process.env.VOICE_APP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "VOICE_APP_SECRET is not set" }, { status: 503 });
  }

  const body = method === "POST" ? await request.text() : undefined;
  try {
    const res = await fetch(`${BACKEND}/api/crm/voice/${parts.join("/")}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Voice-Key": secret },
      body,
      // Twilio's REST call in dialout mode is the slow one; a token is instant.
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ error: "voice api unreachable" }, { status: 502 });
  }
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/voice/[...path]">) {
  const { path } = await ctx.params;
  return forward(request, path, "GET");
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/voice/[...path]">) {
  const { path } = await ctx.params;
  return forward(request, path, "POST");
}
