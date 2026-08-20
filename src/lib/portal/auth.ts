import { db } from "./server";

// Self-serve password storage for client workspaces. Passwords are salted +
// PBKDF2-hashed (Web Crypto, node-safe in route handlers) and kept in
// workspaces.password_hash. Until a workspace sets its own password that column
// is NULL and login falls back to the bootstrap key in PORTAL_WS_KEYS.

const ITER = 100_000;

function b64(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iter: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    key,
    256
  );
  return b64(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITER);
  return `pbkdf2$${ITER}$${b64(salt.buffer)}$${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iter = Number(parts[1]);
  if (!Number.isFinite(iter) || iter <= 0) return false;
  const actual = await pbkdf2(password, fromB64(parts[2]), iter);
  const expected = parts[3];
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// Reads the stored hash. Returns null when the DB is absent OR the column does
// not exist yet (pre-migration) OR no password has been set — every case falls
// back to the bootstrap env key, so login keeps working throughout the rollout.
export async function getWorkspaceHash(slug: string): Promise<string | null> {
  const sb = db();
  if (!sb) return null;
  const { data, error } = await sb
    .from("workspaces")
    .select("password_hash")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return null;
  return (data?.password_hash as string | null) ?? null;
}

export async function setWorkspacePassword(slug: string, password: string): Promise<boolean> {
  const sb = db();
  if (!sb) return false;
  const hash = await hashPassword(password);
  const { error } = await sb
    .from("workspaces")
    .update({ password_hash: hash, password_updated_at: new Date().toISOString() })
    .eq("slug", slug);
  return !error;
}

export async function hasOwnPassword(slug: string): Promise<boolean> {
  return (await getWorkspaceHash(slug)) !== null;
}

// ── per-person login (portal_users, migration 022) ───────────────────────────
// A CLIENT workspace signs in with EMAIL + PASSWORD, one row per human, so access
// can be granted and revoked per person and a session carries a real identity.
// Demo/magnet workspaces have no users and never reach this code — the link is
// their access. A workspace with no users falls back to the legacy shared
// password, so nothing breaks while people are migrated across.

export type PortalUser = { id: string; email: string; full_name: string | null; role: string };

// ── invite / reset tokens ────────────────────────────────────────────────────
// We never choose or learn a password. Creating an account (or resetting one)
// mints a random token, stores only its SHA-256, and emails the raw value once.
// A leaked database row therefore cannot be replayed into an account takeover.

const INVITE_TTL_DAYS = 7;

export function newInviteToken(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const b of raw) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function tokenHash(token: string): Promise<string> {
  const bits = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return b64(bits);
}

export function inviteExpiry(): string {
  return new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString();
}

/** Consume a token: set the password, clear the token, stamp activation.
 *  Returns the reason it failed, or null on success. One shot — the token is
 *  cleared in the same update that sets the password. */
export async function redeemInvite(
  token: string,
  password: string,
): Promise<{ ok: true; email: string; slug: string | null } | { ok: false; reason: string }> {
  const sb = db();
  if (!sb) return { ok: false, reason: "no database" };
  if (password.length < MIN_PASSWORD) {
    return { ok: false, reason: `Password must be at least ${MIN_PASSWORD} characters.` };
  }
  const { data, error } = await sb
    .from("portal_users")
    .select("id,email,invite_expires_at,disabled_at,workspaces(slug)")
    .eq("invite_token_hash", await tokenHash(token))
    .maybeSingle();
  if (error || !data) return { ok: false, reason: "This link is not valid." };
  if (data.disabled_at) return { ok: false, reason: "This account is disabled." };
  if (!data.invite_expires_at || new Date(data.invite_expires_at as string) < new Date()) {
    return { ok: false, reason: "This link has expired. Ask us for a new one." };
  }
  const { error: upErr } = await sb
    .from("portal_users")
    .update({
      password_hash: await hashPassword(password),
      password_set_at: new Date().toISOString(),
      invite_token_hash: null,
      invite_expires_at: null,
    })
    .eq("id", data.id as string);
  if (upErr) return { ok: false, reason: "Could not save the password. Try again." };
  // The slug travels back so the "Go to sign in" button can point at the person's
  // OWN workspace gate. Sending them to the bare /gate lands them on the AGENCY
  // gate, where a client's credentials can never match — which is exactly how
  // Paul got locked out minutes after setting his password (2026-08-20).
  const ws = (data as { workspaces?: { slug?: string } | null }).workspaces;
  return { ok: true, email: data.email as string, slug: ws?.slug ?? null };
}

// Jose's call (2026-08-05): 8, not 12. These are people we onboard by hand, the
// login is rate-limited, and a length nobody can remember gets written on a note.
export const MIN_PASSWORD = 8;

/** True when this workspace has at least one enabled user — i.e. it is on the
 *  email+password flow. False (or a DB error) keeps the legacy password gate. */
export async function hasUsers(slug: string): Promise<boolean> {
  const sb = db();
  if (!sb) return false;
  const { data, error } = await sb
    .from("portal_users")
    .select("id, workspaces!inner(slug)")
    .eq("workspaces.slug", slug)
    .is("disabled_at", null)
    .limit(1);
  if (error) return false;               // table absent pre-migration → legacy gate
  return (data?.length ?? 0) > 0;
}

/** An AGENCY superadmin (workspace_id IS NULL): one account, every workspace.
 *  Checked before any workspace login, so Jose's own credentials open the client
 *  portal he is looking at, exactly as the old shared agency password did. */
export async function verifyAgencyUser(email: string, password: string): Promise<PortalUser | null> {
  const sb = db();
  if (!sb) return null;
  const mail = email.trim().toLowerCase();
  if (!mail || !password) return null;
  const { data, error } = await sb
    .from("portal_users")
    .select("id, email, full_name, role, password_hash")
    .is("workspace_id", null)
    .eq("role", "agency")
    .eq("email", mail)
    .is("disabled_at", null)
    .maybeSingle();
  const stored = (!error && (data?.password_hash as string | null)) || null;
  if (!stored || !(await verifyPassword(password, stored))) return null;
  void sb.from("portal_users").update({ last_login_at: new Date().toISOString() })
    .eq("id", data!.id as string).then(() => {}, () => {});
  return {
    id: data!.id as string,
    email: data!.email as string,
    full_name: (data!.full_name as string | null) ?? null,
    role: "agency",
  };
}

/** Verify email + password for a workspace. Returns the user on success, else null.
 *  Constant-ish time: an unknown email still pays a PBKDF2 round, so the response
 *  time cannot be used to enumerate who has an account. */
export async function verifyUser(
  slug: string,
  email: string,
  password: string,
): Promise<PortalUser | null> {
  const sb = db();
  if (!sb) return null;
  const mail = email.trim().toLowerCase();
  if (!mail || !password) return null;
  const { data, error } = await sb
    .from("portal_users")
    .select("id, email, full_name, role, password_hash, workspaces!inner(slug)")
    .eq("workspaces.slug", slug)
    .eq("email", mail)
    .is("disabled_at", null)
    .maybeSingle();
  const stored = (!error && (data?.password_hash as string | null)) || null;
  if (!stored) {
    // Burn a comparable amount of work against a throwaway hash so "no such user"
    // and "wrong password" are indistinguishable from the outside.
    await pbkdf2(password, crypto.getRandomValues(new Uint8Array(16)), ITER);
    return null;
  }
  if (!(await verifyPassword(password, stored))) return null;
  void sb.from("portal_users").update({ last_login_at: new Date().toISOString() })
    .eq("id", data!.id as string).then(() => {}, () => {});
  return {
    id: data!.id as string,
    email: data!.email as string,
    full_name: (data!.full_name as string | null) ?? null,
    role: (data!.role as string) || "client",
  };
}

/** Sign a client in WITHOUT knowing which workspace they belong to.
 *
 *  The bare app.luxvance.com — and the "Go to sign in" button after setting a
 *  password — both land on the AGENCY gate, which only ever checked agency
 *  credentials. A client typing a perfectly correct email and password there was
 *  told they "didn't match", with no way to discover the /w/<slug> URL that would
 *  have worked. Now the agency gate resolves the person from their email and
 *  drops them into their own workspace instead.
 *
 *  Returns the first workspace whose stored hash verifies. */
export async function verifyUserAnyWorkspace(
  email: string,
  password: string,
): Promise<{ user: PortalUser; slug: string } | null> {
  const sb = db();
  if (!sb) return null;
  const mail = email.trim().toLowerCase();
  if (!mail || !password) return null;
  const { data, error } = await sb
    .from("portal_users")
    .select("id, email, full_name, role, password_hash, workspaces!inner(slug)")
    .eq("email", mail)
    .not("workspace_id", "is", null)
    .is("disabled_at", null);
  if (error || !data?.length) return null;
  for (const row of data as unknown as Array<{
    id: string; email: string; full_name: string | null; role: string;
    password_hash: string | null; workspaces: { slug: string } | null;
  }>) {
    const slug = row.workspaces?.slug;
    if (!slug || !row.password_hash) continue;
    if (!(await verifyPassword(password, row.password_hash))) continue;
    void sb.from("portal_users").update({ last_login_at: new Date().toISOString() })
      .eq("id", row.id).then(() => {}, () => {});
    return {
      user: { id: row.id, email: row.email, full_name: row.full_name ?? null, role: row.role || "client" },
      slug,
    };
  }
  return null;
}

/** Change one PERSON's password (portal_users), not the workspace's shared one.
 *  A workspace on per-person login verifies at sign-in against portal_users, so
 *  writing a change to workspaces.password_hash silently locks the user out. */
export async function setUserPassword(userId: string, password: string): Promise<boolean> {
  const sb = db();
  if (!sb) return false;
  const { error } = await sb
    .from("portal_users")
    .update({ password_hash: await hashPassword(password), password_set_at: new Date().toISOString() })
    .eq("id", userId);
  return !error;
}
