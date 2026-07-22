-- Luxvance Platform — Scope the block list by CLIENT, not by portal workspace
-- Project: sgaeggmkmipcoikzqwpy
-- Safe to re-run: every statement is idempotent.
--
-- Why: the block list is per client. Someone who unsubscribed from Global Food Ventures
-- is NOT blocked for Luxvance or Kcal, and the reverse holds too. Two problems made the
-- old shape unsafe to load real data into:
--
--   1. `workspace_id` is nullable and the 2026-07-16 migration defined null as "global".
--      loadBlocklist() read it as `.or(workspace_id.eq.<ws>,workspace_id.is.null)`, so
--      every null-scoped row showed up in EVERY client's portal. Bulk-loading the 3,557
--      suppressions exported from Instantly would have leaked each client's
--      do-not-contact list to all the others.
--   2. `public.workspaces` only holds portal workspaces (3 rows). Kcal, GFV, CapQuest,
--      Connect Resources and Remly have no workspace, so ~2,783 of their suppressions had
--      nowhere correct to live.
--
-- `public.clients` has a row per client and maps 1:1 to the Instantly workspace through
-- `instantly_workspace_id`, so it is the right scope. `workspaces.client_id` already
-- exists, so a portal slug still resolves to a client in one hop.

-- ── 1. The authoritative scope ──────────────────────────────────────────────
alter table public.blocklist
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

-- ── 2. Backfill from the portal workspace that owned each existing row ───────
update public.blocklist b
set    client_id = w.client_id
from   public.workspaces w
where  b.workspace_id = w.id
  and  b.client_id is null
  and  w.client_id is not null;

-- ── 3. Indexes ──────────────────────────────────────────────────────────────
create index if not exists blocklist_client_idx on public.blocklist (client_id);

-- Re-importing an export must not duplicate rows. An email can appear once per client,
-- and a domain-only block once per client.
create unique index if not exists blocklist_client_email_uidx
  on public.blocklist (client_id, lower(email))
  where email is not null;

create unique index if not exists blocklist_client_domain_uidx
  on public.blocklist (client_id, lower(domain))
  where domain is not null and email is null;

-- ── 4. After the frontend deploy that reads client_id ────────────────────────
-- Run these only once the deployed app no longer reads `workspace_id`, otherwise the
-- Arco portal's add-to-blocklist button starts failing.
--
--   alter table public.blocklist alter column client_id set not null;
--   alter table public.blocklist drop column workspace_id;
