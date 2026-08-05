import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAgency } from "@/lib/portal/access";
import { db } from "@/lib/portal/server";
import { newInviteToken, tokenHash, inviteExpiry } from "@/lib/portal/auth";

// Agency-only management of portal logins.
//
// We never choose or learn anyone's password. Creating an account stores no
// password at all: it mints a single-use token, keeps only its hash, and emails
// the raw value as a "set your password" link. A reset is the same call again.
// So "revoke someone" and "they forgot their password" are the same two buttons.
//
// Two levels:
//   role='client'  + slug  → that workspace only
//   role='agency'  (no slug) → superadmin, opens every workspace
//
// GET    ?slug=arco-irish | ?agency=1   → who can sign in (never returns hashes)
// POST   {email, slug?|agency?, full_name?, send?}  → create or re-invite
// DELETE {email, slug?|agency?}         → revoke (row stays, for the audit trail)

const BACKEND = process.env.CRM_BACKEND_URL || "https://agency-os-api.onrender.com";
const APP_BASE = process.env.APP_BASE_URL || "https://app.luxvance.com";

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

/** Ask the backend to send the branded invite/reset email through Gmail. Vercel has
 *  no SMTP; Render holds the Gmail app password, and luxvance.com sends only through
 *  Google. Returns null on success or a reason to surface. */
async function sendAccountMail(
  kind: "invite" | "reset",
  to: string,
  link: string,
  name: string,
  workspace: string,
): Promise<string | null> {
  const key = process.env.CRM_API_KEY;
  if (!key) return "CRM_API_KEY is not set";
  try {
    const r = await fetch(`${BACKEND}/api/account/mail`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CRM-Key": key },
      body: JSON.stringify({ kind, to, link, name, workspace }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return `mailer returned ${r.status}: ${(await r.text()).slice(0, 200)}`;
    return null;
  } catch (e) {
    return `mailer unreachable: ${e instanceof Error ? e.message : "unknown"}`;
  }
}

export async function GET(request: NextRequest) {
  const bad = await guard();
  if (bad) return bad;
  const sp = request.nextUrl.searchParams;
  const cols = "id,email,full_name,role,created_at,last_login_at,disabled_at,password_set_at,invite_sent_at,invite_expires_at";
  let q = db()!.from("portal_users").select(cols).order("created_at");
  if (sp.get("agency")) {
    q = q.is("workspace_id", null);
  } else {
    const wsid = await workspaceId(sp.get("slug") || "");
    if (!wsid) return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
    q = q.eq("workspace_id", wsid);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // password_set_at null = invited but never activated, which is the state the
  // agency actually needs to see ("did Paul ever log in?").
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: NextRequest) {
  const bad = await guard();
  if (bad) return bad;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const slug = String(body.slug ?? "");
  const asAgency = Boolean(body.agency);
  const fullName = body.full_name ? String(body.full_name) : null;
  const send = body.send !== false;   // default: actually email them

  if (!email.includes("@")) return NextResponse.json({ error: "invalid email" }, { status: 400 });
  if (!asAgency && !slug) return NextResponse.json({ error: "slug or agency required" }, { status: 400 });

  let wsid: string | null = null;
  let wsName = "";
  if (!asAgency) {
    const { data } = await db()!.from("workspaces").select("id,name").eq("slug", slug).maybeSingle();
    if (!data) return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
    wsid = data.id as string;
    wsName = (data.name as string) || slug;
  }

  const token = newInviteToken();
  const row = {
    workspace_id: wsid,
    email,
    full_name: fullName,
    role: asAgency ? "agency" : "client",
    invite_token_hash: await tokenHash(token),
    invite_expires_at: inviteExpiry(),
    invite_sent_at: new Date().toISOString(),
    disabled_at: null,
    // Re-inviting revokes the old password on purpose: an account being reset
    // should not stay usable with the credentials that prompted the reset.
    password_hash: null,
  };

  // Agency rows have workspace_id NULL, which no unique CONSTRAINT can cover
  // (NULLs are distinct), so upsert cannot dedupe them — look first and update.
  const { data: existing } = await db()!
    .from("portal_users")
    .select("id")
    .eq("email", email)
    [asAgency ? "is" : "eq"]("workspace_id", asAgency ? null : (wsid as string))
    .maybeSingle();

  const { error } = existing
    ? await db()!.from("portal_users").update(row).eq("id", existing.id as string)
    : await db()!.from("portal_users").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const link = `${APP_BASE}/set-password?t=${encodeURIComponent(token)}`;
  if (!send) return NextResponse.json({ ok: true, email, link, emailed: false });

  const kind = existing ? "reset" : "invite";
  const failure = await sendAccountMail(kind, email, link, fullName || "", asAgency ? "" : wsName);
  if (failure) {
    // The account exists and the token is live — hand the link back so the invite
    // can still be delivered by hand rather than silently dying in a mailer error.
    return NextResponse.json({ ok: true, email, link, emailed: false, warning: failure });
  }
  return NextResponse.json({ ok: true, email, emailed: true, kind });
}

export async function DELETE(request: NextRequest) {
  const bad = await guard();
  if (bad) return bad;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const asAgency = Boolean(body.agency);
  let q = db()!
    .from("portal_users")
    // Revoking also kills any outstanding invite link and the stored password.
    .update({ disabled_at: new Date().toISOString(), invite_token_hash: null, password_hash: null })
    .eq("email", email);
  if (asAgency) {
    q = q.is("workspace_id", null);
  } else {
    const wsid = await workspaceId(String(body.slug ?? ""));
    if (!wsid) return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
    q = q.eq("workspace_id", wsid);
  }
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
