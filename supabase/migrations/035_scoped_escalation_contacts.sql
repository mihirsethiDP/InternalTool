-- =============================================================
-- Migration 035: scope escalation contacts by plant / sensor make
--
-- The person to call is not the same everywhere: each plant has its own
-- electrician / equipment-access person, and vendor support depends on the
-- sensor's manufacturer. An escalation_contacts row can now be:
--   - GLOBAL   (plant_id null, make_id null)  — the default for that skill
--   - PLANT    (plant_id set)                 — overrides at that plant
--   - MAKE     (make_id set)                  — vendor contact for that make
--
-- Multiple people per skill are allowed (the unique(skill_key) constraint
-- goes away). Flows keep referencing only skill_key — resolution to the right
-- person happens at runtime in the chat, so flows stay portable.
-- =============================================================
begin;

alter table public.escalation_contacts
  drop constraint if exists escalation_contacts_skill_key_key;

alter table public.escalation_contacts
  add column if not exists plant_id uuid references public.plants(id) on delete cascade,
  add column if not exists make_id uuid references public.sensor_makes(id) on delete cascade;

create index if not exists escalation_contacts_skill_idx
  on public.escalation_contacts (skill_key, active);

commit;
