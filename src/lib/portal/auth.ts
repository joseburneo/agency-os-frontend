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
