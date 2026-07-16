import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/portal/server";
import { portalMode } from "@/lib/portal/access";

// Remove one blocklist entry. Scoped: an entry is only deletable from the very
// workspace that owns it (never another client's, never a global entry from a
// client view). Agency or the owning client only; demo prospects can't write.
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

  // Only delete rows that belong to this workspace — global (null) entries and
  // other clients' entries are untouchable from here.
  const { error } = await sb.from("blocklist").delete().eq("id", id).eq("workspace_id", wsRow.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
