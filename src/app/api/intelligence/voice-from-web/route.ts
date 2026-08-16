import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { portalMode } from "@/lib/portal/access";

// Draft the Voice & tone section by mirroring the client's own website.
//
// Same shape as the optimize proxy: auth here, the LLM call on the backend that
// holds the key, never a direct browser call to Render. Demo sessions are
// refused — a prospect preview has no business writing into a Brain.
//
// Returns a DRAFT ({ ok, title, body, source }). Nothing is saved: the human
// reads it, edits it, and saves it through the normal path. A voice section
// written by a model and stored without anyone reading it is worse than none,
// because every email afterwards inherits it silently.
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://agency-os-api.onrender.com";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "").trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const mode = await portalMode(slug);
  if (mode === "demo") return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  try {
    const res = await fetch(`${BACKEND}/api/intelligence/voice-from-web`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: String(body?.domain ?? ""),
        company: String(body?.company ?? ""),
      }),
      // Fetching up to six pages and then a reasoning model: slower than the
      // optimizer, and worth waiting for rather than retrying.
      signal: AbortSignal.timeout(90000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "could not reach the writer" }, { status: 502 });
  }
}
