-- Luxvance Platform — Intelligence Library (run once in Supabase SQL editor)
-- Project: sgaeggmkmipcoikzqwpy · schema only (no client data in this public repo).
--
-- ONE table, TWO readers:
--   1. the client portal renders these rows (the Intelligence Library module), and
--   2. the reply / outreach LLM loads the very same rows as mandatory context
--      before it writes anything. Edit once → client view and every agent update
--      together. This IS "the client" — the perspective every message starts from.
--
-- Sections model (one row per knowledge card) keeps it Octave-flexible: add a new
-- persona, call note or proof point without a schema change. `kind` groups them in
-- the UI; `sort` orders within a group.

create table if not exists public.intelligence_library (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  kind          text not null check (kind in (
                  'overview','founder','voice','icp','offer','differentiator',
                  'proof','segment','persona','objection','asset','call_note','research')),
  title         text not null,
  body          text not null default '',
  meta          jsonb,               -- author, role, date, source, url…
  sort          int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists intelligence_library_ws_idx   on public.intelligence_library (workspace_id);
create index if not exists intelligence_library_kind_idx on public.intelligence_library (workspace_id, kind);

-- Client content (e.g. Arco Irish's brain) is CONFIDENTIAL and is seeded from the
-- local, un-tracked file supabase/seeds.local/arco-irish-intelligence.sql — never
-- committed to this public repo.
