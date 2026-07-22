import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/portal/server";
import { portalMode } from "@/lib/portal/access";

// Remove one blocklist entry. Scoped: an entry is only deletable by the client who
// owns it, never another client's. Agency or the owning client only; demo prospects
// can't write.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "").trim();
  const id = String(body?.id ?? "").trim();
  if (!slug || !id) return NextResponse.json({ error: "slug and id required" }, { status: 400 });

  const mode = await portalMode(slug);
  if (mode === "demo") return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const sb = db();
  if (!sb) return NextResponse.json({ error: "no database" }, { status: 503 });

  const { data: wsRow } = await sb
    .from("workspaces")
    .select("client_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!wsRow?.client_id) {
    return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
  }

  // Only delete rows that belong to this client — another client's entries are
  // untouchable from here.
  const { error } = await sb
    .from("blocklist")
    .delete()
    .eq("id", id)
    .eq("client_id", wsRow.client_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
