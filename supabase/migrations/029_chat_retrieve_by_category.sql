-- =============================================================
-- Migration 029: chat_retrieve gains category-level scoping
--
-- The elicitation/router layer routes first at SENSOR-TYPE (category) level,
-- then narrows to make/model. chat_retrieve previously scoped only by a single
-- sensor_model_id; add an optional p_category_id so the assistant can answer
-- across all models in a category (e.g. "Flow") before a model is chosen.
-- =============================================================
begin;

drop function if exists public.chat_retrieve(text, uuid, int);

create or replace function public.chat_retrieve(
  q text,
  p_sensor_model_id uuid default null,
  p_category_id uuid default null,
  p_limit int default 8
)
returns table (
  document_id uuid,
  document_title text,
  section text,
  chunk_text text,
  rank real,
  match_kind text
)
language sql stable as $$
  with q_parsed as (
    select public.q_to_prefix_tsquery(q) as andq,
           public.q_to_or_tsquery(q) as orq,
           coalesce(trim(q), '') as q_trim
  ),
  src as (
    select cd.id as doc,
           (coalesce(mk.name, '') || ' ' || coalesce(sm.model_no, '')) as title,
           c.id as chunk_id, c.section, c.chunk_text, c.tsv
    from public.consolidated_docs cd
    join public.consolidated_doc_chunks c on c.consolidated_doc_id = cd.id
    join public.sensor_models sm on sm.id = cd.sensor_model_id
    left join public.sensor_makes mk on mk.id = sm.make_id
    where (p_sensor_model_id is null or sm.id = p_sensor_model_id)
      and (p_category_id is null or sm.category_id = p_category_id)
  ),
  and_m as (
    select src.doc, src.title, src.section, src.chunk_text, src.chunk_id,
           ts_rank(src.tsv, qp.andq) as rank, 'exact'::text as match_kind
    from src cross join q_parsed qp
    where qp.andq <> ''::tsquery and src.tsv @@ qp.andq
  ),
  or_m as (
    select src.doc, src.title, src.section, src.chunk_text, src.chunk_id,
           ts_rank(src.tsv, qp.orq) as rank, 'related'::text as match_kind
    from src cross join q_parsed qp
    where qp.orq <> ''::tsquery and src.tsv @@ qp.orq
      and not exists (select 1 from and_m)
  ),
  fuzzy as (
    select src.doc, src.title, src.section, src.chunk_text, src.chunk_id,
           word_similarity(lower(qp.q_trim), lower(src.chunk_text)) as rank,
           'fuzzy'::text as match_kind
    from src cross join q_parsed qp
    where qp.q_trim <> ''
      and word_similarity(lower(qp.q_trim), lower(src.chunk_text)) > 0.4
      and not exists (select 1 from and_m)
      and not exists (select 1 from or_m)
  ),
  combined as (
    select * from and_m
    union all select * from or_m
    union all select * from fuzzy
  )
  select doc as document_id, title as document_title, section, chunk_text, rank, match_kind
  from combined
  order by rank desc, chunk_id asc
  limit p_limit;
$$;

grant execute on function public.chat_retrieve(text, uuid, uuid, int) to anon, authenticated;

commit;
