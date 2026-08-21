import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/portal/server";
import { portalMode } from "@/lib/portal/access";

/**
 * The copy written for ONE lead: the email, its follow-ups, the LinkedIn message.
 *
 * It is a request of its own because of what shipping them together cost. The Cold
 * Pipeline hands the browser every lead in the workspace, and Paul's workspace has
 * 1,147 of them; with the rendered bodies attached that page was 4.2 MB and took five
 * seconds to answer, to show one email at a time. Without them it is a fraction of
 * that, and the one body somebody actually opens arrives in a few hundred bytes.
 *
 * Scoped like everything else that touches a workspace: the lead must belong to the
 * workspace named in the request, and a demo visitor gets nothing. Checking the lead's
 * workspace_id rather than trusting the id is the whole point — an id is guessable and
 * the copy is the client's.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("workspace") ?? "").trim();
  const id = (searchParams.get("id") ?? "").trim();
  if (!slug || !id) {
    return NextResponse.json({ error: "workspace and id required" }, { status: 400 });
  }

  // A magnet is opened on a bare link by anyone holding it, so the copy inside one is
  // the prospect's to read. A CLIENT's copy is not: it is what we write in his name.
  const mode = await portalMode(slug);
  if (mode === "demo") return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const sb = db();
  if (!sb) return NextResponse.json({ error: "no database" }, { status: 503 });

  const { data: wsRow } = await sb
    .from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (!wsRow) return NextResponse.json({ error: "unknown workspace" }, { status: 404 });

  const { data, error } = await sb
    .from("target_list_leads")
    .select("id,email1_subject,email1_body,email2_body,email3_body,linkedin1,whatsapp1")
    .eq("id", id)
    .eq("workspace_id", wsRow.id)      // the guard, not the id alone
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    id: String(data.id),
    emailSubject: data.email1_subject ?? "",
    emailBody: data.email1_body ?? "",
    emailBody2: data.email2_body ?? "",
    emailBody3: data.email3_body ?? "",
    linkedinNote: data.linkedin1 ?? "",
    whatsappNote: data.whatsapp1 ?? "",
  });
}
