-- Self-serve portal credentials, per workspace.
--
-- password_hash NULL  => the workspace still logs in with its bootstrap key from
--                        PORTAL_WS_KEYS (the temp password we email the client).
-- password_hash SET   => the client set their own password; the DB hash wins and
--                        the env key is ignored for that workspace.
--
-- Hash format is "pbkdf2$<iterations>$<saltB64>$<hashB64>" (see src/lib/portal/auth.ts).
-- Run once in the Supabase SQL editor (project sgaeggmkmipcoikzqwpy).

alter table workspaces
  add column if not exists password_hash text,
  add column if not exists password_updated_at timestamptz;
