-- =============================================================
-- Migration 023: auto-create a general entry for every new category
--
-- So that whenever a sensor category is added (from the Admin UI or
-- directly in SQL), its synthetic "general" sensor_model is created
-- immediately — making the category usable as a general-guidance target
-- without any extra step. Depends on migration 022 (is_general column).
-- =============================================================
begin;

create or replace function public.create_general_for_category()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.sensor_models (make_id, category_id, model_no, name, is_general)
  values (null, new.id, 'General — ' || new.name, 'General ' || new.name || ' guidance', true);
  return new;
end $$;

drop trigger if exists trg_create_general_for_category on public.sensor_categories;
create trigger trg_create_general_for_category
  after insert on public.sensor_categories
  for each row execute function public.create_general_for_category();

commit;
