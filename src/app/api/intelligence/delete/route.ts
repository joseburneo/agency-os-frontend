import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/portal/server";
import { portalMode } from "@/lib/portal/access";

// Delete one Intelligence Library section, scoped to the owning workspace. Agency or
// the owning client only; never a demo prospect.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "").trim();
  const id = String(body?.id ?? "").trim();
  if (!slug || !id) return NextResponse.json({ error: "slug and id required" }, { status: 400 });

  const mode = await portalMode(slug);
  if (mode === "demo") return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const sb = db();
  if (!sb) return NextResponse.json({ error: "no database" }, { status: 503 });

  const { data: wsRow } = await sb.from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (!wsRow) return NextResponse.json({ error: "unknown workspace" }, { status: 404 });

  const { error } = await sb
    .from("intelligence_library")
    .delete()
    .eq("id", id)
    .eq("workspace_id", wsRow.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
