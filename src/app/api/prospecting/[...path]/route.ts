import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { AGENCY_COOKIE, wsCookie, demoCookie, scopeToken, demoToken } from "@/lib/portal/gate";

// Front door for the Prospecting module, on the same pattern as api/crm: the
// browser talks to this same-origin route, the session cookie is the credential,
// and the backend secret never reaches the client.
//
// It differs from the CRM proxy in one deliberate way: a DEMO session is allowed
// through. The CRM proxy 403s demo because a prospect has no business reading a
// pipeline, but here the demo searching IS the product pitch. The wall is at the
// buy, not at the search, and it is enforced on the server: the backend reads
// workspaces.kind and refuses to export for a magnet. Nothing about "can I
// export" is decided in the browser, so hiding the button is a courtesy and not
// the control.
//
// As in api/crm, the workspace is OVERWRITTEN from the proven session rather
// than trusted from the caller, so a demo link for one slug cannot search from
// another workspace's allowance.

const BACKEND = process.env.CRM_BACKEND_URL || "https://agency-os-api.onrender.com";

type Scope = { kind: "agency" } | { kind: "ws"; slug: string } | { kind: "demo"; slug: string } | null;

async function resolveScope(): Promise<Scope> {
  const secret = process.env.PORTAL_ACCESS_TOKEN;
  // No gate configured (local dev / preview): behave as agency, as the rest of
  // the portal does.
  if (!secret) return { kind: "agency" };
  const jar = await cookies();
  if (jar.get(AGENCY_COOKIE)?.value === (await scopeToken(secret, "agency"))) {
    return { kind: "agency" };
  }
  // A client session outranks a demo one for the same workspace, so check every
  // client cookie before falling back to demo.
  for (const c of jar.getAll()) {
    if (!c.name.startsWith("lxv_ws_")) continue;
    const slug = c.name.slice("lxv_ws_".length);
    if (slug && c.value === (await scopeToken(secret, `ws:${slug}`))) {
      return { kind: "ws", slug };
    }
  }
  for (const c of jar.getAll()) {
    if (!c.name.startsWith("lxv_demo_")) continue;
    const slug = c.name.slice("lxv_demo_".length);
    if (slug && c.value === (await demoToken(secret, slug))) {
      return { kind: "demo", slug };
    }
  }
  return null;
}

async function forward(
  request: NextRequest,
  parts: string[],
  method: "GET" | "POST",
): Promise<Response> {
  const scope = await resolveScope();
  if (!scope) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(`${BACKEND}/api/prospecting/${parts.join("/")}`);
  request.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
  if (scope.kind !== "agency") {
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
      // A Clay search pages twice and the interpret call runs a reasoning model,
      // both on top of a possible Render cold start.
      signal: AbortSignal.timeout(120000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "prospecting api unreachable" }, { status: 502 });
  }
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/prospecting/[...path]">) {
  const { path } = await ctx.params;
  return forward(request, path, "GET");
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/prospecting/[...path]">) {
  const { path } = await ctx.params;
  return forward(request, path, "POST");
}
