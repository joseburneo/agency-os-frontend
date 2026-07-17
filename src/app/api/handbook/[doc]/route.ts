import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAgency } from "@/lib/portal/access";
import { db } from "@/lib/portal/server";

// Serve an internal Handbook doc as a full standalone HTML page — AGENCY ONLY.
// The doc CONTENT lives in a PRIVATE Supabase Storage bucket ("handbook"), never
// in this public repo. /api/* is excluded from the proxy matcher, so this route
// re-checks the agency cookie itself; a client, demo, or stranger gets 404.
const DOCS: Record<string, string> = {
  "system-brief": "system-brief.html",
  "optimization-roadmap": "optimization-roadmap.html",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ doc: string }> }
) {
  if (!(await isAgency())) {
    return new NextResponse("Not found", { status: 404 });
  }
  const { doc } = await params;
  const object = DOCS[doc];
  if (!object) return new NextResponse("Not found", { status: 404 });

  const sb = db();
  if (!sb) return new NextResponse("Unavailable", { status: 503 });

  const { data, error } = await sb.storage.from("handbook").download(object);
  if (error || !data) return new NextResponse("Not found", { status: 404 });

  const html = await data.text();
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
