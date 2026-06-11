-- =============================================================
-- Migration 017: expanded doc categories + pilot sensors
--
-- 1. Expands the section taxonomy from 5 to 11:
--    manual, install, troubleshooting, datasheet, calibration,
--    cleaning, spares, ppm, wiring, safety, other
-- 2. Adds matching document_types (scope 'general') so the upload
--    modal offers them.
-- 3. Adds sensor_models.is_pilot and marks the two pilot sensors:
--    UPC UPCS-MAG-110 and Advance Analytik OCEMS (created if missing).
-- =============================================================
begin;

-- ---------- 1. Expand section check constraints ----------
alter table public.document_submissions
  drop constraint if exists document_submissions_target_section_check;
alter table public.document_submissions
  add constraint document_submissions_target_section_check
  check (target_section in (
    'manual','install','troubleshooting','datasheet','calibration',
    'cleaning','spares','ppm','wiring','safety','other'
  ) or target_section is null);

alter table public.consolidated_doc_chunks
  drop constraint if exists consolidated_doc_chunks_section_check;
alter table public.consolidated_doc_chunks
  add constraint consolidated_doc_chunks_section_check
  check (section in (
    'manual','install','troubleshooting','datasheet','calibration',
    'cleaning','spares','ppm','wiring','safety','other'
  ));

-- ---------- 2. New document types ----------
insert into public.document_types (key, label, sort_order, scope) values
  ('calibration_procedure', 'Calibration Procedure', 45, 'general'),
  ('cleaning_maintenance', 'Cleaning & Maintenance', 46, 'general'),
  ('spares_list', 'Spares & Consumables List', 47, 'general'),
  ('ppm_schedule', 'Preventive Maintenance (PPM) Schedule', 48, 'general'),
  ('wiring_comm', 'Wiring & Communication', 49, 'general'),
  ('safety_handling', 'Safety & Handling', 50, 'general')
on conflict (key) do nothing;

-- ---------- 3. Pilot sensors ----------
alter table public.sensor_models
  add column if not exists is_pilot boolean not null default false;

-- Create the Advance Analytik OCEMS model if it does not exist
insert into public.sensor_models (make_id, category_id, model_no, name)
select
  (select id from public.sensor_makes where name = 'Advance Analytik'),
  (select id from public.sensor_categories where name = 'Water Quality'),
  'OCEMS',
  'Online Continuous Effluent Monitoring System (pH / ORP / EC / TDS)'
where not exists (
  select 1 from public.sensor_models sm
  join public.sensor_makes mk on mk.id = sm.make_id
  where mk.name = 'Advance Analytik' and sm.model_no = 'OCEMS'
);

update public.sensor_models set is_pilot = false;
update public.sensor_models sm set is_pilot = true
from public.sensor_makes mk
where mk.id = sm.make_id
  and ((mk.name = 'UPC' and sm.model_no = 'UPCS-MAG-110')
    or (mk.name = 'Advance Analytik' and sm.model_no = 'OCEMS'));

commit;

-- Verify
select mk.name as make, sm.model_no, sm.is_pilot
from public.sensor_models sm join public.sensor_makes mk on mk.id = sm.make_id
order by sm.is_pilot desc, mk.name;
