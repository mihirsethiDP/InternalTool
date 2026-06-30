-- =============================================================
-- Migration 030: routing rules (the "router layer")
--
-- Maps a user PROBLEM STATEMENT → the specific procedure section(s) that
-- resolve it, for a given sensor. This is the separate routing layer the
-- supervisor asked for: troubleshooting expressed as relationships between
-- problems and procedures, not as another unstructured document.
--
-- Rules are AI-generated (from the sensor's approved procedures) then
-- human-approved. A rule attached to a category's GENERAL sensor_model is a
-- TYPE-level rule; one on a specific model is make/model-level.
-- =============================================================
begin;

create table if not exists public.routing_rules (
  id uuid primary key default gen_random_uuid(),
  sensor_model_id uuid not null references public.sensor_models(id) on delete cascade,
  problem text not null,                         -- canonical problem statement / symptom
  aliases text[] not null default '{}',          -- alternate phrasings the same rule covers
  sections text[] not null default '{}',         -- work-type section keys to route to (e.g. {calibration,cleaning})
  clarifying_question text,                       -- optional follow-up to disambiguate before routing
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  source text not null default 'ai' check (source in ('ai', 'admin')),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists routing_rules_model_idx on public.routing_rules(sensor_model_id);
create index if not exists routing_rules_status_idx on public.routing_rules(status);

alter table public.routing_rules enable row level security;

-- Approved rules are readable by anyone signed in (the chatbot routes on them).
-- Proposed/rejected are visible only to admins (the review queue).
drop policy if exists routing_rules_select on public.routing_rules;
create policy routing_rules_select on public.routing_rules for select to authenticated
  using (status = 'approved' or public.current_role() = 'admin');

-- Only admins manage rules (the edge function generator uses the service role).
drop policy if exists routing_rules_write on public.routing_rules;
create policy routing_rules_write on public.routing_rules for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

commit;
