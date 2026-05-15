-- =============================================================
-- Migration 004: equipment + document scope
-- - Adds `equipment` table (children of a plant)
-- - Adds `equipment_id` to plant_sensors (replaces tag_no/location_on_plant
--   semantically; old columns left for backward compat)
-- - Adds `equipment_id` to documents (for test/calibration certs)
-- - Adds `scope` to document_types so UI can drive required fields
-- =============================================================
begin;

-- 1. document_types.scope
alter table public.document_types
  add column if not exists scope text not null default 'general'
  check (scope in ('general','plant','plant_sensor','plant_with_sensor_refs'));

update public.document_types set scope = case key
  when 'sensor_manual'           then 'general'
  when 'installation_guide'      then 'general'
  when 'troubleshooting'         then 'general'
  when 'datasheet'               then 'general'
  when 'test_certificate'        then 'plant_sensor'
  when 'calibration_certificate' then 'plant_sensor'
  when 'handover'                then 'plant'
  when 'io_list'                 then 'plant'
  when 'p_and_id'                then 'plant'
  when 'onboarding'              then 'plant'
  when 'design_data_sheet'       then 'plant'
  when 'warranty_certificate'    then 'plant_with_sensor_refs'
  else 'general'
end;

-- 2. equipment table
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz default now(),
  unique (plant_id, name)
);
create index if not exists equipment_plant_idx on public.equipment(plant_id);

alter table public.equipment enable row level security;
drop policy if exists equipment_select on public.equipment;
create policy equipment_select on public.equipment for select to authenticated using (true);
drop policy if exists equipment_write on public.equipment;
create policy equipment_write on public.equipment for all to authenticated
  using (public.current_role() in ('uploader','admin'))
  with check (public.current_role() in ('uploader','admin'));

-- 3. plant_sensors.equipment_id (legacy tag_no / location_on_plant stay for now)
alter table public.plant_sensors
  add column if not exists equipment_id uuid references public.equipment(id) on delete set null;

-- 4. documents.equipment_id (test cert / calibration cert specifically apply to one)
alter table public.documents
  add column if not exists equipment_id uuid references public.documents(id) on delete set null;
-- NOTE: above had a typo (referenced documents) — fix it explicitly:
alter table public.documents drop column if exists equipment_id;
alter table public.documents
  add column equipment_id uuid references public.equipment(id) on delete set null;
create index if not exists documents_equipment_idx on public.documents(equipment_id);

-- 5. Search RPC: include equipment in results & accept equipment filter
drop function if exists public.search_documents(text, uuid, uuid, uuid, text, uuid, uuid, int);

create or replace function public.search_documents(
  q text,
  p_plant_id uuid default null,
  p_sensor_model_id uuid default null,
  p_plc_id uuid default null,
  p_type_key text default null,
  p_category_id uuid default null,
  p_make_id uuid default null,
  p_equipment_id uuid default null,
  p_limit int default 50
)
returns table (
  document_id uuid,
  document_title text,
  type_label text,
  plant_name text,
  equipment_name text,
  sensor_model_no text,
  sensor_make text,
  page_number int,
  snippet text,
  rank real
)
language sql stable as $$
  with base as (
    select d.id as document_id,
           d.title as document_title,
           dt.label as type_label,
           pl.name as plant_name,
           eq.name as equipment_name,
           sm.model_no as sensor_model_no,
           mk.name as sensor_make,
           sm.category_id, sm.make_id
    from public.documents d
    left join public.document_types dt on dt.id = d.type_id
    left join public.plants pl on pl.id = d.plant_id
    left join public.equipment eq on eq.id = d.equipment_id
    left join public.sensor_models sm on sm.id = d.sensor_model_id
    left join public.sensor_makes mk on mk.id = sm.make_id
    where (p_plant_id is null or d.plant_id = p_plant_id)
      and (p_sensor_model_id is null or d.sensor_model_id = p_sensor_model_id)
      and (p_plc_id is null or d.plc_id = p_plc_id)
      and (p_type_key is null or dt.key = p_type_key)
      and (p_category_id is null or sm.category_id = p_category_id)
      and (p_make_id is null or sm.make_id = p_make_id)
      and (p_equipment_id is null or d.equipment_id = p_equipment_id)
  ),
  no_q as (
    select b.document_id, b.document_title, b.type_label, b.plant_name,
           b.equipment_name, b.sensor_model_no, b.sensor_make,
           null::int as page_number, ''::text as snippet, 0::real as rank
    from base b
    where coalesce(trim(q), '') = ''
    limit p_limit
  ),
  with_q as (
    select b.document_id, b.document_title, b.type_label, b.plant_name,
           b.equipment_name, b.sensor_model_no, b.sensor_make,
           c.page_number,
           ts_headline('english', c.chunk_text, websearch_to_tsquery('english', q),
                       'MaxFragments=1,MinWords=10,MaxWords=30,ShortWord=2') as snippet,
           ts_rank(c.tsv, websearch_to_tsquery('english', q)) as rank
    from base b
    join public.document_chunks c on c.document_id = b.document_id
    where coalesce(trim(q), '') <> ''
      and c.tsv @@ websearch_to_tsquery('english', q)
    order by rank desc
    limit p_limit
  ),
  with_q_titles as (
    select b.document_id, b.document_title, b.type_label, b.plant_name,
           b.equipment_name, b.sensor_model_no, b.sensor_make,
           null::int, ''::text, 0.05::real
    from base b
    where coalesce(trim(q), '') <> ''
      and (
        b.document_title ilike '%' || q || '%'
        or coalesce(b.plant_name, '') ilike '%' || q || '%'
        or coalesce(b.equipment_name, '') ilike '%' || q || '%'
        or coalesce(b.sensor_model_no, '') ilike '%' || q || '%'
        or coalesce(b.sensor_make, '') ilike '%' || q || '%'
      )
      and not exists (
        select 1 from public.document_chunks c
        where c.document_id = b.document_id
          and c.tsv @@ websearch_to_tsquery('english', q)
      )
    limit p_limit
  )
  select * from no_q
  union all
  select * from with_q
  union all
  select * from with_q_titles
  order by rank desc nulls last
  limit p_limit;
$$;

commit;
