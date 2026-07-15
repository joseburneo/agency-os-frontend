import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client for the portal. Uses the SERVICE ROLE key, which
// bypasses RLS — so it MUST never reach the browser. It is safe: the key is a
// non-NEXT_PUBLIC_ env var (Next never inlines those into client bundles) and
// this module is only imported by server components. (Add the `server-only`
// package and re-add its import for a hard compile-time guard.) Every
// portal query scopes by workspace_id in code, so isolation is enforced here
// even though RLS is bypassed. Auth/login + workspace_members (RLS for real
// client logins) come later; the agency read path works today via this client.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

let client: SupabaseClient | null = null;

// Returns the service client, or null when the key is absent (e.g. local dev
// without the Drive-mounted env). Callers fall back to mock data on null.
export function db(): SupabaseClient | null {
  if (client) return client;
  if (!url || !serviceKey) return null;
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function hasDb(): boolean {
  return Boolean(url && serviceKey);
}
