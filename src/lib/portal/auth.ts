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
