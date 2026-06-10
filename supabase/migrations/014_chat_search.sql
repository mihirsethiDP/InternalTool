-- =============================================================
-- Migration 014: chat_search RPC
--
-- Wide search for the in-app chatbot. Unlike search_documents (which
-- ANDs all query tokens), chat_search:
--   - Strips common English stopwords
--   - ORs the remaining tokens (so a long question still returns hits)
--   - Returns one row per consolidated doc, ranked by ts_rank
--
-- When AI search ships, the chatbot UI continues to call this RPC for
-- citations and adds a synthesised answer on top.
-- =============================================================
begin;

create or replace function public.chat_search(q text, p_limit int default 5)
returns table (
  document_id uuid,
  document_title text,
  section text,
  snippet text,
  rank real
)
language sql stable as $$
  with q_parsed as (
    select coalesce(
      (
        select string_agg(t || ':*', ' | ')
        from unnest(
          regexp_split_to_array(
            regexp_replace(lower(coalesce(q, '')), '[^a-z0-9 ]+', ' ', 'g'),
            '\s+'
          )
        ) as t
        where t <> ''
          and length(t) > 1
          and t not in (
            'a','an','the','and','or','of','to','for','in','on','at','is','are','was','were',
            'be','been','being','have','has','had','do','does','did','will','would','should',
            'could','can','may','might','must','i','you','he','she','it','we','they','what',
            'which','who','whom','this','that','these','those','am','as','if','then','than',
            'so','such','also','very','really','about','how','when','where','why','please',
            'help','me','my','your','our','their','some','any','all','each','few','more',
            'most','other','no','not','only','same','too','just','from','with','by','into',
            'through','during','before','after','above','below','between','out','up','down',
            'over','under','again','further','once','here','there','now','own','well'
          )
      ),
      ''
    )::tsquery as tsq,
    coalesce(trim(q), '') as q_trim
  ),
  chunk_matches as (
    select cd.id as consolidated_doc_id,
           (coalesce(mk.name, '') || ' ' || coalesce(sm.model_no, '')) as document_title,
           c.section,
           c.chunk_text,
           c.id as chunk_id,
           ts_rank(c.tsv, q_parsed.tsq) as rank
    from public.consolidated_docs cd
    join public.consolidated_doc_chunks c on c.consolidated_doc_id = cd.id
    join public.sensor_models sm on sm.id = cd.sensor_model_id
    left join public.sensor_makes mk on mk.id = sm.make_id
    cross join q_parsed
    where q_parsed.tsq <> ''::tsquery
      and c.tsv @@ q_parsed.tsq
  ),
  best_per_doc as (
    select distinct on (cm.consolidated_doc_id)
      cm.consolidated_doc_id, cm.document_title, cm.section, cm.chunk_text, cm.rank
    from chunk_matches cm
    order by cm.consolidated_doc_id, cm.rank desc, cm.chunk_id asc
  )
  select consolidated_doc_id as document_id,
         document_title,
         section,
         public.match_snippet(chunk_text, q) as snippet,
         rank
  from best_per_doc
  order by rank desc
  limit p_limit;
$$;

commit;

-- Smoke test (after some consolidated docs exist)
-- select * from public.chat_search('how do I troubleshoot H2S poisoning on the ORP sensor', 5);
