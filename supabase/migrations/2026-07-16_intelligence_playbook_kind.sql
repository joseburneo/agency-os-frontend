-- Luxvance Platform — add the 'playbook' kind to the Intelligence Library.
-- Run once in the Supabase SQL editor (the intelligence_library table already exists).
--
-- 'playbook' = the client's RULES OF ENGAGEMENT — the steering the reply/outreach agents
-- obey above all else (e.g. "don't push for a meeting or propose times unless the prospect
-- shows clear intent"). client_brain.py injects these first so they dominate every draft.

alter table public.intelligence_library
  drop constraint if exists intelligence_library_kind_check;

alter table public.intelligence_library
  add constraint intelligence_library_kind_check check (kind in (
    'playbook','overview','founder','voice','icp','offer','differentiator',
    'proof','segment','persona','objection','asset','call_note','research'));
