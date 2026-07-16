import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { portalMode } from "@/lib/portal/access";

// Proxy the Intelligence Library copilot: the browser never calls Render directly.
// Auth stays here (agency or owning client only, never demo); the heavy LLM call
// runs on the backend that holds the OpenAI key. Returns { ok, title, body }.
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://agency-os-api.onrender.com";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "").trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const mode = await portalMode(slug);
  if (mode === "demo") return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  try {
    const res = await fetch(`${BACKEND}/api/intelligence/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: String(body?.kind ?? ""),
        title: String(body?.title ?? ""),
        body: String(body?.body ?? ""),
        instruction: String(body?.instruction ?? ""),
        brain_context: String(body?.brain_context ?? ""),
      }),
      // The optimizer can take a few seconds; give it room but don't hang forever.
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `optimizer offline (${res.status})` }, { status: 502 });
    }
    const json = await res.json();
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ error: "optimizer unreachable" }, { status: 502 });
  }
}
