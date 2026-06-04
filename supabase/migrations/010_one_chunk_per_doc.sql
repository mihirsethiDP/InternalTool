-- =============================================================
-- Migration 010: deterministic + best-chunk-per-doc search
--
-- Symptom: searching the same word twice could return different
-- chunks of the same document. The chunk that literally contains
-- the query term shows highlights; sibling chunks (matching via
-- stem / prefix) don't, because match_snippet falls back to the
-- chunk's first 320 chars where the word doesn't appear.
--
-- Fix:
--   1. Collapse to ONE chunk per document (no more multiple results
--      for the same doc).
--   2. Prefer the chunk that contains the literal first query token,
--      breaking remaining ties by ts_rank desc, then page_number,
--      then chunk id (deterministic).
-- =============================================================
begin;

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
           coalesce(trim(q), '') as q_trim,
           -- first lowercased alphanumeric token (used to prefer literal-match chunks)
           split_part(trim(regexp_replace(lower(coalesce(q, '')), '[^a-z0-9 ]+', ' ', 'g')), ' ', 1) as first_term
  ),
  chunk_matches as (
    select b.document_id, b.document_title, b.type_label, b.plant_name,
           b.equipment_name, b.sensor_model_no, b.sensor_make,
           c.id as chunk_id,
           c.page_number,
           c.chunk_text,
           ts_rank(c.tsv, q_parsed.tsq) as rank,
           -- 0 if chunk literally contains the first query token (highlight will work),
           -- 1 otherwise (lower priority — match is via stem)
           case when q_parsed.first_term <> ''
                 and position(q_parsed.first_term in lower(c.chunk_text)) > 0
                then 0 else 1
           end as literal_priority
    from base b
    join public.document_chunks c on c.document_id = b.document_id
    cross join q_parsed
    where q_parsed.q_trim <> ''
      and q_parsed.tsq <> ''::tsquery
      and c.tsv @@ q_parsed.tsq
  ),
  best_per_doc as (
    select distinct on (cm.document_id)
      cm.document_id, cm.document_title, cm.type_label, cm.plant_name,
      cm.equipment_name, cm.sensor_model_no, cm.sensor_make,
      cm.page_number, cm.chunk_text, cm.rank
    from chunk_matches cm
    order by cm.document_id,
             cm.literal_priority asc,   -- prefer literal-containing chunks
             cm.rank desc,
             cm.page_number asc nulls last,
             cm.chunk_id asc
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
    select bpd.document_id, bpd.document_title, bpd.type_label, bpd.plant_name,
           bpd.equipment_name, bpd.sensor_model_no, bpd.sensor_make,
           bpd.page_number,
           public.match_snippet(bpd.chunk_text, q_parsed.q_trim) as snippet,
           bpd.rank
    from best_per_doc bpd, q_parsed
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
  order by rank desc nulls last, document_id
  limit p_limit;
$$;

commit;

-- Sanity: search "poison" — should return exactly one row per matching doc,
-- with snippet text that contains the literal word (so highlight will work).
select document_title, page_number, position('poison' in lower(snippet)) as poison_pos
from public.search_documents('poison');
