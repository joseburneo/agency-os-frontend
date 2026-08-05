import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAgency } from "@/lib/portal/access";
import { db } from "@/lib/portal/server";
import { hashPassword } from "@/lib/portal/auth";

// Agency-only management of client workspace logins (portal_users, migration 022).
// This is how a client gets an account: Jose creates it with an email and a first
// password, and hands those over. There is no self-signup — a workspace's people
// are decided by us.
//
// GET    ?slug=arco-irish   → who can sign in (never returns hashes)
// POST   {slug, email, password, full_name?}  → create or reset that person
// DELETE {slug, email}      → revoke (sets disabled_at; the row stays for the audit trail)

async function workspaceId(slug: string): Promise<string | null> {
  const sb = db();
  if (!sb) return null;
  const { data } = await sb.from("workspaces").select("id").eq("slug", slug).maybeSingle();
  return (data?.id as string) ?? null;
}

async function guard(): Promise<NextResponse | null> {
  if (!(await isAgency())) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  if (!db()) return NextResponse.json({ error: "no database" }, { status: 503 });
  return null;
}

export async function GET(request: NextRequest) {
  const bad = await guard();
  if (bad) return bad;
  const slug = request.nextUrl.searchParams.get("slug") || "";
  const wsid = await workspaceId(slug);
  if (!wsid) return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
  const { data, error } = await db()!
    .from("portal_users")
    .select("id,email,full_name,role,created_at,last_login_at,disabled_at")
    .eq("workspace_id", wsid)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: NextRequest) {
  const bad = await guard();
  if (bad) return bad;
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = body.full_name ? String(body.full_name) : null;

  if (!email.includes("@")) return NextResponse.json({ error: "invalid email" }, { status: 400 });
  // Short passwords are the whole reason the bootstrap keys were guessable.
  if (password.length < 12) {
    return NextResponse.json({ error: "password must be at least 12 characters" }, { status: 400 });
  }
  const wsid = await workspaceId(slug);
  if (!wsid) return NextResponse.json({ error: "unknown workspace" }, { status: 404 });

  // Upsert on (workspace_id, lower(email)) — so POSTing an existing person is a
  // password reset, and it also clears a previous revocation.
  const { error } = await db()!
    .from("portal_users")
    .upsert(
      {
        workspace_id: wsid,
        email,
        password_hash: await hashPassword(password),
        full_name: fullName,
        disabled_at: null,
      },
      { onConflict: "workspace_id,email" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, slug, email });
}

export async function DELETE(request: NextRequest) {
  const bad = await guard();
  if (bad) return bad;
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const wsid = await workspaceId(slug);
  if (!wsid) return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
  const { error } = await db()!
    .from("portal_users")
    .update({ disabled_at: new Date().toISOString() })
    .eq("workspace_id", wsid)
    .eq("email", email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
