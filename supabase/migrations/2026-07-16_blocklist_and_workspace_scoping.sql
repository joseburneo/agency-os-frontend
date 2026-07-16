-- Luxvance Platform — Blocklist + workspace scoping (run once in Supabase SQL editor)
-- Project: sgaeggmkmipcoikzqwpy
-- Safe to re-run: every statement is idempotent.
--
-- What this does (schema only — no client data lives in this public repo):
--   1. Creates the shared do-not-contact `blocklist` table (per-workspace + global).
--   2. Backfills engaged_prospects.workspace_id (column already exists, all NULL today)
--      to Luxvance — every warm prospect on file today is Luxvance's own book.
--   3. Adds workspaces.password_hash for self-serve client passwords.
--
-- Client blocklist seeds (e.g. Arco Irish's do-not-contact list) are CONFIDENTIAL
-- and must NOT be committed to this public repo. They are applied separately from a
-- local, un-tracked seed file — see supabase/seeds.local/ (gitignored).
--
-- Workspace id: Luxvance = c5b0e59c-e248-42fc-94d1-5ae90714b947

-- ── 1. Blocklist table ──────────────────────────────────────────────────────
create table if not exists public.blocklist (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces(id) on delete cascade,  -- null = global
  reason        text not null check (reason in ('client','competitor','unsubscribe')),
  company_name  text,
  domain        text,
  email         text,
  person_name   text,
  linkedin_url  text,
  note          text,
  source        text not null default 'manual' check (source in ('manual','auto_unsubscribe')),
  created_by    text,
  created_at    timestamptz not null default now()
);

create index if not exists blocklist_workspace_idx on public.blocklist (workspace_id);
create index if not exists blocklist_domain_idx    on public.blocklist (lower(domain));
create index if not exists blocklist_email_idx     on public.blocklist (lower(email));

-- ── 2. Backfill engaged_prospects → Luxvance ────────────────────────────────
update public.engaged_prospects
set workspace_id = 'c5b0e59c-e248-42fc-94d1-5ae90714b947'
where workspace_id is null;

-- ── 3. Self-serve client passwords ──────────────────────────────────────────
alter table public.workspaces
  add column if not exists password_hash       text,
  add column if not exists password_updated_at timestamptz;

-- ── Client blocklist seeds ──────────────────────────────────────────────────
-- Run the per-client seed AFTER this migration, from the local (gitignored) file
-- supabase/seeds.local/arco-irish-blocklist.sql — client relationships stay off
-- the public repo.
