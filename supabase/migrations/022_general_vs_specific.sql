-- =============================================================
-- Migration 022: general (category-level) vs make/model-specific content
--
-- General guidance that applies to ALL sensors of a category (e.g. all
-- Water Quality probes share membrane/calibration troubleshooting) is
-- represented as a synthetic "general" sensor_model per category. This
-- reuses the whole consolidated pipeline (submissions -> approval ->
-- consolidated_docs -> chunks -> search) with zero new tables, so general
-- content is searchable for free and editable through the same tools.
--
-- A specific sensor's page layers in the general content for its category.
-- =============================================================
begin;

alter table public.sensor_models
  add column if not exists is_general boolean not null default false;

-- One general entry per category (make_id null, flagged is_general).
insert into public.sensor_models (make_id, category_id, model_no, name, is_general)
select null, c.id, 'General — ' || c.name, 'General ' || c.name || ' guidance', true
from public.sensor_categories c
where not exists (
  select 1 from public.sensor_models sm
  where sm.category_id = c.id and sm.is_general = true
);

commit;

-- Verify
select mk.name as make, sm.model_no, sm.is_general, c.name as category
from public.sensor_models sm
left join public.sensor_makes mk on mk.id = sm.make_id
left join public.sensor_categories c on c.id = sm.category_id
where sm.is_general
order by c.name;
