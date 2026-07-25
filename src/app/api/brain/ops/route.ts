import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/portal/server";
import { portalMode } from "@/lib/portal/access";

// The Brain's operational fields — the exact values every generation surface
// reads verbatim (client_brain.sender_identity on Render): the client's own
// booking link, warm-reply signature, writing language and hard rules. They
// live as columns on `workspaces`; prose knowledge stays in the library table.
// Agency or the owning client may write; a demo prospect never can.
const FIELDS = ["booking_link", "signature_html", "brain_language", "brain_rules"] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "").trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const mode = await portalMode(slug);
  if (mode === "demo") return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const sb = db();
  if (!sb) return NextResponse.json({ error: "no database" }, { status: 503 });

  const { data: wsRow } = await sb.from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (!wsRow) return NextResponse.json({ error: "unknown workspace" }, { status: 404 });

  const patch: Record<string, string | null> = {};
  for (const f of FIELDS) {
    if (f in (body ?? {})) {
      const v = String(body[f] ?? "").trim();
      patch[f] = v || null; // empty clears the field — the engine treats null as unset
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no known field in payload" }, { status: 400 });
  }

  const { error } = await sb.from("workspaces").update(patch).eq("id", wsRow.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: Object.keys(patch) });
}
