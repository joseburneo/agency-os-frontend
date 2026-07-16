import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/portal/server";
import { portalMode } from "@/lib/portal/access";

const KINDS = [
  "playbook", "overview", "founder", "voice", "icp", "offer", "differentiator",
  "proof", "segment", "persona", "objection", "asset", "call_note", "research",
];

// Create or update one Intelligence Library section. This is the client's brain —
// the single source of truth every agent reads — so edits flow straight to Supabase
// and take effect everywhere at once. Agency or the owning client may write; a demo
// prospect never can.
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

  const kind = KINDS.includes(String(body?.kind)) ? String(body.kind) : "overview";
  const title = String(body?.title ?? "").trim();
  const text = String(body?.body ?? "").trim();
  const sort = Number.isFinite(Number(body?.sort)) ? Number(body.sort) : 0;
  const meta = body?.meta && typeof body.meta === "object" ? body.meta : null;
  const id = String(body?.id ?? "").trim();

  if (!title && !text) {
    return NextResponse.json({ error: "a title or body is required" }, { status: 400 });
  }

  const row = {
    workspace_id: wsRow.id,
    kind,
    title: title || "(untitled)",
    body: text,
    meta,
    sort,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    // Scoped update — can only touch a section in this workspace.
    const { data, error } = await sb
      .from("intelligence_library")
      .update(row)
      .eq("id", id)
      .eq("workspace_id", wsRow.id)
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id ?? id });
  }

  const { data, error } = await sb
    .from("intelligence_library")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}
