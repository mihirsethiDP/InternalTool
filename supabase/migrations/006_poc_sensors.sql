-- =============================================================
-- Migration 006: POC sensor seed
-- Scope change: tool is now focused on sensor troubleshooting + manuals
-- + datasheets only. Plant-related document types remain in the DB but
-- are hidden from the UI (the UI filters to scope='general').
--
-- Wipes existing makes/models/dummy docs, then seeds the 5 POC sensors:
--   1. Advance Analytik  · DO              (Water Quality)
--   2. Advance Analytik  · OCEMS           (Water Quality)
--   3. UPC               · OCEMS           (Water Quality)
--   4. UPC               · Flow Meter      (Flow)
--   5. LFAI              · Level Transmitter (Level)
-- =============================================================
begin;

-- Clean previous demo data and old catalog. Real uploads are preserved
-- (they have storage_path NOT NULL).
delete from public.document_chunks
  where document_id in (select id from public.documents where storage_path is null);
delete from public.documents where storage_path is null;
delete from public.plant_sensors;
delete from public.sensor_models;
delete from public.sensor_makes;

-- Seed makes
insert into public.sensor_makes (name) values
  ('Advance Analytik'),
  ('UPC'),
  ('LFAI');

-- Seed the 5 POC models
insert into public.sensor_models (make_id, category_id, model_no, name) values
  ((select id from public.sensor_makes where name='Advance Analytik'),
   (select id from public.sensor_categories where name='Water Quality'),
   'DO', 'Dissolved Oxygen Sensor'),
  ((select id from public.sensor_makes where name='Advance Analytik'),
   (select id from public.sensor_categories where name='Water Quality'),
   'OCEMS', 'Online Continuous Emission Monitoring System'),
  ((select id from public.sensor_makes where name='UPC'),
   (select id from public.sensor_categories where name='Water Quality'),
   'OCEMS', 'Online Continuous Emission Monitoring System'),
  ((select id from public.sensor_makes where name='UPC'),
   (select id from public.sensor_categories where name='Flow'),
   'Flow Meter', 'Electromagnetic Flow Meter'),
  ((select id from public.sensor_makes where name='LFAI'),
   (select id from public.sensor_categories where name='Level'),
   'Level Transmitter', 'Hydrostatic Level Transmitter');

commit;

-- Verify
select 'makes' as t, count(*) from public.sensor_makes
union all select 'models', count(*) from public.sensor_models
union all select 'real documents', count(*) from public.documents where storage_path is not null
union all select 'demo documents', count(*) from public.documents where storage_path is null;
