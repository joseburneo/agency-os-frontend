import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/portal/server";
import { portalMode } from "@/lib/portal/access";

// Record that a MAGNET workspace was opened. The moment the prospect looks at
// their Build is the moment to follow up, so the CRM card reads these fields.
// Agency visits (Jose reviewing before sending) are dropped; only magnet
// workspaces are tracked, so client portals collect nothing here.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "").trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const mode = await portalMode(slug);
  if (mode === "agency") return NextResponse.json({ ok: true, skipped: "agency" });

  const sb = db();
  if (!sb) return NextResponse.json({ error: "no database" }, { status: 503 });

  const { data: ws } = await sb
    .from("workspaces")
    .select("id, kind, first_opened_at, open_count")
    .eq("slug", slug)
    .maybeSingle();
  if (!ws) return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
  if (ws.kind !== "magnet") return NextResponse.json({ ok: true, skipped: "not a magnet" });

  const now = new Date().toISOString();
  await sb
    .from("workspaces")
    .update({
      first_opened_at: ws.first_opened_at ?? now,
      last_opened_at: now,
      open_count: (ws.open_count ?? 0) + 1,
    })
    .eq("id", ws.id);
  return NextResponse.json({ ok: true });
}
