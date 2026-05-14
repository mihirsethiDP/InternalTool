-- =============================================================
-- Option B: simplified catalog
-- Keeps makes (deduped), drops noisy sensor_models and PLCs,
-- replaces 68 sub-categories with 6 clean sensor families.
-- Documents already uploaded survive: their sensor_model_id / plc_id
-- will be set to NULL by the existing FK on-delete-set-null.
--
-- HOW TO SWITCH PATHS LATER
-- - Option A (empty even makes):     delete from public.sensor_makes;
-- - Option C (clean subset of orig): rerun 002_seed.sql, then manually
--                                    delete rows that aren't needed
-- - Option D (full original):        rerun 002_seed.sql as-is
-- =============================================================
begin;

-- 1. Wipe sensor_models + plcs (documents stay; their links go null)
delete from public.sensor_models;
delete from public.plcs;

-- 2. Wipe and replace categories
delete from public.sensor_categories;
insert into public.sensor_categories (name, "group") values
  ('Flow', 'Sensors'),
  ('Level', 'Sensors'),
  ('Pressure', 'Sensors'),
  ('Water Quality', 'Sensors'),
  ('Maintenance & Safety', 'Sensors'),
  ('Other', 'Sensors');

-- 3. Normalize + dedupe makes (case-insensitive, trimmed)
update public.sensor_makes set name = trim(name);
with ranked as (
  select id, name,
         row_number() over (partition by lower(trim(name)) order by id) as rn
  from public.sensor_makes
)
delete from public.sensor_makes where id in (select id from ranked where rn > 1);

commit;

-- Verify
select 'categories' as t, count(*) from public.sensor_categories
union all select 'makes', count(*) from public.sensor_makes
union all select 'sensor_models', count(*) from public.sensor_models
union all select 'plcs', count(*) from public.plcs;
