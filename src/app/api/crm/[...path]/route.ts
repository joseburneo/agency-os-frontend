import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { AGENCY_COOKIE, wsCookie, scopeToken } from "@/lib/portal/gate";

// The CRM's front door. Until 2026-08-05 the browser called the Render API
// DIRECTLY and that API had no authentication of any kind: an anonymous
// `curl https://agency-os-api.onrender.com/api/crm/prospect/1/thread` returned a
// client's whole conversation, and `POST .../send` would send email from a live
// burner. This proxy is what closes it, on the same pattern as api/voice:
//
//   1. The browser now talks to THIS route (same origin), so the session cookie
//      is the credential and the backend secret never ships to the client.
//   2. The session decides the SCOPE. Agency sees everything; a client session
//      is pinned to its own workspace and cannot ask for another one — the
//      `workspace` parameter is overwritten here, not trusted from the caller.
//   3. `X-CRM-Scope` carries that decision to the backend, which uses it to
//      constrain the per-prospect routes (the id is a sequential integer, so
//      without it /prospect/512 is a cross-tenant read).
//
// Demo sessions get 403: the magnet preview has no business in the CRM.

const BACKEND = process.env.CRM_BACKEND_URL || "https://agency-os-api.onrender.com";

type Scope = { kind: "agency" } | { kind: "ws"; slug: string } | null;

/** Which scope this request's cookies prove. Agency wins; otherwise the first
 *  workspace cookie whose HMAC validates. Null = no valid session. */
async function resolveScope(): Promise<Scope> {
  const secret = process.env.PORTAL_ACCESS_TOKEN;
  // No gate configured (local dev / preview) — behave exactly as before this proxy.
  if (!secret) return { kind: "agency" };
  const jar = await cookies();
  if (jar.get(AGENCY_COOKIE)?.value === (await scopeToken(secret, "agency"))) {
    return { kind: "agency" };
  }
  for (const c of jar.getAll()) {
    if (!c.name.startsWith("lxv_ws_")) continue;
    const slug = c.name.slice("lxv_ws_".length);
    if (slug && c.value === (await scopeToken(secret, `ws:${slug}`))) {
      return { kind: "ws", slug };
    }
  }
  return null;
}

async function forward(
  request: NextRequest,
  parts: string[],
  method: "GET" | "POST",
): Promise<NextResponse> {
  const scope = await resolveScope();
  if (!scope) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(`${BACKEND}/api/crm/${parts.join("/")}`);
  request.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
  if (scope.kind === "ws") {
    // A client session is pinned to its own workspace, whatever it asked for.
    url.searchParams.set("workspace", scope.slug);
  }

  const key = process.env.CRM_API_KEY;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-CRM-Scope": scope.kind === "agency" ? "agency" : scope.slug,
  };
  if (key) headers["X-CRM-Key"] = key;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? await request.text() : undefined,
      // Render cold starts and the copilot's flagship call are the slow paths.
      signal: AbortSignal.timeout(60000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "crm api unreachable" }, { status: 502 });
  }
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/crm/[...path]">) {
  const { path } = await ctx.params;
  return forward(request, path, "GET");
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/crm/[...path]">) {
  const { path } = await ctx.params;
  return forward(request, path, "POST");
}
