-- =============================================================
-- Migration 009: replace ts_headline with a deterministic snippet
--
-- ts_headline was emitting <b>...</b> markers on words that did not
-- match the prefix tsquery (likely a quirk with English parser tokens
-- like "TDS" / "Taj" near the actual match). Switch to a custom
-- match_snippet() that returns a plain-text window around the first
-- occurrence of the first query token. The frontend highlights the
-- whole matching word using a prefix-aware regex.
-- =============================================================
begin;

create or replace function public.match_snippet(t text, q text, window_size int default 320)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
  first_term text;
  pos int;
  start_pos int;
  end_pos int;
  out_text text;
begin
  if t is null or t = '' then return ''; end if;

  cleaned := regexp_replace(lower(coalesce(q, '')), '[^a-z0-9 ]+', ' ', 'g');
  first_term := split_part(trim(cleaned), ' ', 1);

  if first_term = '' or length(first_term) < 2 then
    return left(t, window_size);
  end if;

  pos := position(first_term in lower(t));
  if pos = 0 then
    return left(t, window_size);
  end if;

  start_pos := greatest(1, pos - 60);
  end_pos := least(length(t), start_pos + window_size);
  out_text := substr(t, start_pos, end_pos - start_pos);

  if start_pos > 1 then out_text := '… ' || out_text; end if;
  if end_pos < length(t) then out_text := out_text || ' …'; end if;

  return out_text;
end $$;

drop function if exists public.search_documents(text, uuid, uuid, uuid, text, uuid, uuid, uuid, int);

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
  q_parsed as (
    select public.q_to_prefix_tsquery(q) as tsq,
           coalesce(trim(q), '') as q_trim
  ),
  no_q as (
    select b.document_id, b.document_title, b.type_label, b.plant_name,
           b.equipment_name, b.sensor_model_no, b.sensor_make,
           null::int as page_number, ''::text as snippet, 0::real as rank
    from base b, q_parsed
    where q_parsed.q_trim = ''
    limit p_limit
  ),
  with_q as (
    select b.document_id, b.document_title, b.type_label, b.plant_name,
           b.equipment_name, b.sensor_model_no, b.sensor_make,
           c.page_number,
           public.match_snippet(c.chunk_text, q_parsed.q_trim) as snippet,
           ts_rank(c.tsv, q_parsed.tsq) as rank
    from base b
    join public.document_chunks c on c.document_id = b.document_id
    cross join q_parsed
    where q_parsed.q_trim <> ''
      and q_parsed.tsq <> ''::tsquery
      and c.tsv @@ q_parsed.tsq
    order by rank desc
    limit p_limit
  ),
  with_q_titles as (
    select b.document_id, b.document_title, b.type_label, b.plant_name,
           b.equipment_name, b.sensor_model_no, b.sensor_make,
           null::int, ''::text, 0.05::real
    from base b, q_parsed
    where q_parsed.q_trim <> ''
      and (
        b.document_title ilike '%' || q_parsed.q_trim || '%'
        or coalesce(b.plant_name, '') ilike '%' || q_parsed.q_trim || '%'
        or coalesce(b.equipment_name, '') ilike '%' || q_parsed.q_trim || '%'
        or coalesce(b.sensor_model_no, '') ilike '%' || q_parsed.q_trim || '%'
        or coalesce(b.sensor_make, '') ilike '%' || q_parsed.q_trim || '%'
      )
      and not exists (
        select 1 from public.document_chunks c
        where c.document_id = b.document_id
          and c.tsv @@ q_parsed.tsq
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

-- Smoke test: should highlight only Troubleshooting / Troubleshoot variants
select left(snippet, 200) as snippet_preview from public.search_documents('troublesho') limit 3;
