import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/portal/server";
import { portalMode } from "@/lib/portal/access";

// Add one do-not-contact entry to a workspace's blocklist. Agency or the client
// who owns the workspace may write; a demo prospect never can. Needs at least a
// company name, a domain, or an email to be a real match target.
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

  const reason = ["client", "competitor", "unsubscribe"].includes(String(body?.reason))
    ? String(body.reason)
    : "competitor";
  const companyName = String(body?.companyName ?? "").trim();
  const domain = String(body?.domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const email = String(body?.email ?? "").trim().toLowerCase();
  const personName = String(body?.personName ?? "").trim();
  const linkedinUrl = String(body?.linkedinUrl ?? "").trim();
  const note = String(body?.note ?? "").trim();

  if (!companyName && !domain && !email) {
    return NextResponse.json({ error: "need a company, domain, or email" }, { status: 400 });
  }

  const { error } = await sb.from("blocklist").insert({
    workspace_id: wsRow.id,
    reason,
    company_name: companyName || null,
    domain: domain || null,
    email: email || null,
    person_name: personName || null,
    linkedin_url: linkedinUrl || null,
    note: note || null,
    source: "manual",
    created_by: mode,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
