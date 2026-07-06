-- =============================================================
-- Migration 034: Diagnostic Flow Engine + escalation directory
--
-- diagnostic_flows — AI-drafted, human-approved decision trees that walk a
-- technician from symptom → checks → fix, with escalation exits. Owned by a
-- sensor CATEGORY (category-level guidance) or a specific MODEL. Drafted by
-- the chat-answer edge function (mode 'generate-flow') from APPROVED document
-- text only; an admin reviews and approves before the assistant can use them.
--
-- escalation_contacts — admin-managed directory of skills/roles that flow
-- 'escalate' nodes reference by skill_key (e.g. electrical_engineer), so the
-- person on call can change without editing every flow.
--
-- definition jsonb shape (validated client-side AND in the edge function):
--   {
--     "start": "n1",
--     "nodes": [
--       { "id":"n1", "kind":"question", "text":"Is the display blank?",
--         "options":[{"label":"Yes","next":"n2"},{"label":"No","next":"n3"}] },
--       { "id":"n2", "kind":"action", "text":"Check the 24V supply at ...",
--         "source_section":"troubleshoot_repair", "next":"n4" },
--       { "id":"n5", "kind":"resolve", "text":"Reading should be restored." },
--       { "id":"n6", "kind":"escalate", "skill":"electrical_engineer",
--         "text":"Panel voltage check requires an electrician." }
--     ]
--   }
-- =============================================================
begin;

-- ---------- 1. diagnostic_flows ----------
create table if not exists public.diagnostic_flows (
  id uuid primary key default gen_random_uuid(),
  sensor_category_id uuid not null references public.sensor_categories(id) on delete cascade,
  sensor_model_id uuid references public.sensor_models(id) on delete cascade, -- null => category-level
  title text not null,
  trigger_symptoms text[] not null default '{}',
  definition jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  source_doc_id uuid references public.consolidated_docs(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diagnostic_flows_category_idx on public.diagnostic_flows (sensor_category_id, status);
create index if not exists diagnostic_flows_model_idx on public.diagnostic_flows (sensor_model_id, status);
create index if not exists diagnostic_flows_symptoms_idx on public.diagnostic_flows using gin (trigger_symptoms);

alter table public.diagnostic_flows enable row level security;

-- Everyone signed in can read APPROVED flows (the assistant runs them);
-- drafts/archived are admin-only so half-baked steps never reach users.
drop policy if exists diagnostic_flows_select on public.diagnostic_flows;
create policy diagnostic_flows_select on public.diagnostic_flows for select to authenticated
  using (status = 'approved' or public.current_role() = 'admin');

drop policy if exists diagnostic_flows_write on public.diagnostic_flows;
create policy diagnostic_flows_write on public.diagnostic_flows for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ---------- 2. escalation_contacts ----------
create table if not exists public.escalation_contacts (
  id uuid primary key default gen_random_uuid(),
  skill_key text not null unique,
  label text not null,
  person_name text,
  contact text,          -- phone / email / how to reach, free text
  notes text,
  active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

alter table public.escalation_contacts enable row level security;

drop policy if exists escalation_contacts_select on public.escalation_contacts;
create policy escalation_contacts_select on public.escalation_contacts for select to authenticated using (true);

drop policy if exists escalation_contacts_write on public.escalation_contacts;
create policy escalation_contacts_write on public.escalation_contacts for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Seed the skill directory (admin fills in who + how to reach them later).
-- The flow generator may only reference skill_keys that exist here.
insert into public.escalation_contacts (skill_key, label, sort_order) values
  ('electrical_engineer',        'Electrical engineer',                     10),
  ('instrumentation_technician', 'Instrumentation technician',              20),
  ('plc_technician',             'PLC / automation technician',             30),
  ('equipment_access',           'Person authorized to switch equipment',   40),
  ('vendor_support',             'Sensor vendor support',                   50),
  ('supervisor',                 'Plant supervisor',                        60)
on conflict (skill_key) do nothing;

commit;
