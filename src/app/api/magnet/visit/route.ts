import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/portal/server";
import { portalMode } from "@/lib/portal/access";

// Record that a MAGNET workspace was opened, and by WHOM.
//
// The old version counted every visit that did not carry an agency cookie as the
// prospect. That is not the same thing: opening the link from a phone, from the
// sent mail, or in a private window carries no cookie either, so our own checks
// were filed as prospect opens and the CRM reported them as a signal. Six of the
// seventeen first opens on record landed within nine minutes of the link being
// sent, which is nobody but us.
//
// So attribution is positive now, never inferred from an absence:
//   preview=1          our own link, opened from the CRM        -> agency
//   v=<share_token>    the link we delivered to the prospect    -> prospect
//   neither            someone who got here another way         -> unknown
//
// Every view is also written as its own row with the path, because a counter can
// never answer the question that actually matters: did they reach the leads.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "").trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const path = String(body?.path ?? "").slice(0, 200) || null;
  const token = String(body?.token ?? "").trim();
  const preview = Boolean(body?.preview);
  const visitKey = String(body?.visitKey ?? "").slice(0, 64) || null;

  const sb = db();
  if (!sb) return NextResponse.json({ error: "no database" }, { status: 503 });

  const { data: ws } = await sb
    .from("workspaces")
    .select("id, kind, first_opened_at, open_count, prospect_first_opened_at, prospect_open_count")
    .eq("slug", slug)
    .maybeSingle();
  if (!ws) return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
  if (ws.kind !== "magnet") return NextResponse.json({ ok: true, skipped: "not a magnet" });

  // The agency cookie still short-circuits when it is there. It is the cheapest
  // signal available; it is just no longer the only one we rely on.
  const mode = await portalMode(slug);
  let source: "agency" | "prospect" | "unknown" = "unknown";
  if (preview || mode === "agency") {
    source = "agency";
  } else if (token) {
    const { data: magnet } = await sb
      .from("magnets")
      .select("share_token")
      .eq("slug", slug)
      .maybeSingle();
    if (magnet?.share_token && magnet.share_token === token) source = "prospect";
  }

  const now = new Date().toISOString();
  await sb.from("magnet_views").insert({
    slug, path, source, visit_key: visitKey,
    referrer: (request.headers.get("referer") || "").slice(0, 300) || null,
  });

  // open_count keeps its old meaning (every visit, ours included) so nothing that
  // reads it changes under it. The prospect_* columns are the ones the CRM shows.
  const patch: Record<string, unknown> = {
    first_opened_at: ws.first_opened_at ?? now,
    last_opened_at: now,
    open_count: (ws.open_count ?? 0) + 1,
  };
  if (source === "prospect") {
    patch.prospect_first_opened_at = ws.prospect_first_opened_at ?? now;
    patch.prospect_last_opened_at = now;
    patch.prospect_open_count = (ws.prospect_open_count ?? 0) + 1;
  }
  await sb.from("workspaces").update(patch).eq("id", ws.id);
  return NextResponse.json({ ok: true, source });
}
