-- =============================================================
-- Migration 026: search relevance fixes + retrieval RPC for RAG
--
-- Three problems with conversational chatbot queries are fixed here:
--
-- 1. STOPWORDS. q_to_prefix_tsquery ANDed *every* word in the query,
--    including filler like "how", "do", "the", "is". Those lexemes never
--    appear in the english-stemmed tsv, so a natural question like
--    "how do I clean the probe" matched NOTHING via FTS and silently fell
--    through to the loose trigram fallback — which surfaced near-random
--    "one stray word" results. We now strip a curated English stopword
--    list before building the query.
--
-- 2. HARMFUL SYNONYM. "do" was a synonym for dissolved oxygen, so any
--    question containing "do" ("how DO I…") dragged in DO-sensor docs.
--    Removed "do" from that synonym group (kept the real DO terms).
--
-- 3. RECALL. Strict AND across all content words is brittle. We add an
--    OR-of-content-words fallback (q_to_or_tsquery) that fires only when
--    the strict AND finds nothing, BEFORE dropping to trigram. Precise
--    lexeme matching, just looser — far better than fuzzy noise.
--
-- Plus a new chat_retrieve() RPC that returns the FULL matched chunk text
-- (not a teaser snippet) for the top hits, so the chat-answer Edge Function
-- can feed verified content to the LLM. Layered exact -> related -> fuzzy,
-- each row tagged with match_kind.
-- =============================================================
begin;

-- ---------- 1. Drop the harmful "do" synonym ----------
update public.search_synonyms
set terms = array_remove(terms, 'do')
where 'do' = any(terms);

-- ---------- 2. q_to_prefix_tsquery: strip stopwords (AND semantics) ----------
create or replace function public.q_to_prefix_tsquery(q text)
returns tsquery
language plpgsql
stable
as $$
declare
  cleaned text;
  tokens text[];
  tk text;
  syn_array text[];
  inner_parts text[];
  per_token_parts text[];
  s text;
  result_str text;
  stop text[] := ARRAY[
    'the','a','an','and','or','of','to','in','on','at','for','with','from','by','as',
    'is','are','was','were','be','been','being','am',
    'do','does','did','done','doing',
    'how','what','why','when','where','which','who','whom','whose',
    'i','you','it','its','we','they','he','she','me','my','mine','your','yours','our','ours','their',
    'this','that','these','those','there','here',
    'can','could','should','would','will','shall','may','might','must',
    'if','then','than','so','but','not','no','yes',
    'please','help','need','needs','want','wants','get','got','have','has','had',
    'about','into','over','under','out','up','down','off','any','some','all','more','most'
  ];
begin
  cleaned := regexp_replace(lower(coalesce(q, '')), '[^a-z0-9 ]+', ' ', 'g');
  tokens := regexp_split_to_array(trim(cleaned), '\s+');
  per_token_parts := ARRAY[]::text[];

  foreach tk in array tokens loop
    if tk is null or length(tk) < 2 then continue; end if;
    if tk = any(stop) then continue; end if;

    syn_array := (
      select array_agg(distinct lower(s2))
      from public.search_synonyms ss, unnest(ss.terms) s2
      where exists (select 1 from unnest(ss.terms) t where lower(t) = tk)
    );

    if syn_array is null or array_length(syn_array, 1) is null then
      per_token_parts := array_append(per_token_parts, tk || ':*');
    else
      inner_parts := ARRAY[]::text[];
      foreach s in array syn_array loop
        if s is null or length(s) = 0 then continue; end if;
        if position(' ' in s) > 0 then
          inner_parts := array_append(inner_parts, '(' || replace(trim(s), ' ', ' <-> ') || ':*)');
        else
          inner_parts := array_append(inner_parts, s || ':*');
        end if;
      end loop;
      if array_length(inner_parts, 1) is null then
        per_token_parts := array_append(per_token_parts, tk || ':*');
      else
        per_token_parts := array_append(per_token_parts, '(' || array_to_string(inner_parts, ' | ') || ')');
      end if;
    end if;
  end loop;

  if per_token_parts is null or array_length(per_token_parts, 1) is null then
    return ''::tsquery;
  end if;

  result_str := array_to_string(per_token_parts, ' & ');
  return result_str::tsquery;
exception when others then
  return ''::tsquery;
end $$;

-- ---------- 3. q_to_or_tsquery: same expansion, OR across content words ----------
-- Used as a recall fallback when the strict AND query matches nothing.
create or replace function public.q_to_or_tsquery(q text)
returns tsquery
language plpgsql
stable
as $$
declare
  cleaned text;
  tokens text[];
  tk text;
  syn_array text[];
  inner_parts text[];
  per_token_parts text[];
  s text;
  result_str text;
  stop text[] := ARRAY[
    'the','a','an','and','or','of','to','in','on','at','for','with','from','by','as',
    'is','are','was','were','be','been','being','am',
    'do','does','did','done','doing',
    'how','what','why','when','where','which','who','whom','whose',
    'i','you','it','its','we','they','he','she','me','my','mine','your','yours','our','ours','their',
    'this','that','these','those','there','here',
    'can','could','should','would','will','shall','may','might','must',
    'if','then','than','so','but','not','no','yes',
    'please','help','need','needs','want','wants','get','got','have','has','had',
    'about','into','over','under','out','up','down','off','any','some','all','more','most'
  ];
begin
  cleaned := regexp_replace(lower(coalesce(q, '')), '[^a-z0-9 ]+', ' ', 'g');
  tokens := regexp_split_to_array(trim(cleaned), '\s+');
  per_token_parts := ARRAY[]::text[];

  foreach tk in array tokens loop
    if tk is null or length(tk) < 2 then continue; end if;
    if tk = any(stop) then continue; end if;

    syn_array := (
      select array_agg(distinct lower(s2))
      from public.search_synonyms ss, unnest(ss.terms) s2
      where exists (select 1 from unnest(ss.terms) t where lower(t) = tk)
    );

    if syn_array is null or array_length(syn_array, 1) is null then
      per_token_parts := array_append(per_token_parts, tk || ':*');
    else
      inner_parts := ARRAY[]::text[];
      foreach s in array syn_array loop
        if s is null or length(s) = 0 then continue; end if;
        if position(' ' in s) > 0 then
          inner_parts := array_append(inner_parts, '(' || replace(trim(s), ' ', ' <-> ') || ':*)');
        else
          inner_parts := array_append(inner_parts, s || ':*');
        end if;
      end loop;
      if array_length(inner_parts, 1) is null then
        per_token_parts := array_append(per_token_parts, tk || ':*');
      else
        per_token_parts := array_append(per_token_parts, '(' || array_to_string(inner_parts, ' | ') || ')');
      end if;
    end if;
  end loop;

  if per_token_parts is null or array_length(per_token_parts, 1) is null then
    return ''::tsquery;
  end if;

  -- OR across content tokens
  result_str := array_to_string(per_token_parts, ' | ');
  return result_str::tsquery;
exception when others then
  return ''::tsquery;
end $$;

-- ---------- 4. chat_retrieve: full chunks for the LLM (RAG context) ----------
-- Returns the best chunks' FULL text (not a teaser), layered exact ->
-- related -> fuzzy. Optional sensor-model scoping for the "narrow to my
-- make & model" flow. Used by the chat-answer Edge Function.
drop function if exists public.chat_retrieve(text, uuid, int);

create or replace function public.chat_retrieve(
  q text,
  p_sensor_model_id uuid default null,
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

grant execute on function public.chat_retrieve(text, uuid, int) to anon, authenticated;

-- ---------- 5. chat_search: add OR fallback before trigram ----------
-- Keeps the retrieval-only path (citations / no-AI mode) sharp too.
drop function if exists public.chat_search(text, int);

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
  ),
  and_m as (
    select src.doc, src.title, src.section, src.chunk_text, src.chunk_id,
           ts_rank(src.tsv, qp.andq) as rank
    from src cross join q_parsed qp
    where qp.andq <> ''::tsquery and src.tsv @@ qp.andq
  ),
  or_m as (
    select src.doc, src.title, src.section, src.chunk_text, src.chunk_id,
           ts_rank(src.tsv, qp.orq) as rank
    from src cross join q_parsed qp
    where qp.orq <> ''::tsquery and src.tsv @@ qp.orq
      and not exists (select 1 from and_m)
  ),
  fuzzy as (
    select src.doc, src.title, src.section, src.chunk_text, src.chunk_id,
           word_similarity(lower(qp.q_trim), lower(src.chunk_text)) as rank
    from src cross join q_parsed qp
    where qp.q_trim <> ''
      and word_similarity(lower(qp.q_trim), lower(src.chunk_text)) > 0.4
      and not exists (select 1 from and_m)
      and not exists (select 1 from or_m)
  ),
  unioned as (
    select *, 0 as tier from and_m
    union all select *, 1 as tier from or_m
    union all select *, 2 as tier from fuzzy
  ),
  best_per_doc as (
    select distinct on (doc) doc, title, section, chunk_text, rank, tier
    from unioned
    order by doc, tier asc, rank desc, chunk_id asc
  )
  select doc as document_id, title as document_title, section,
         case when tier = 2 then '~ ' else '' end || public.match_snippet(chunk_text, q) as snippet,
         rank
  from best_per_doc
  order by tier asc, rank desc
  limit p_limit;
$$;

commit;

-- Smoke tests (run after applying):
-- select * from public.chat_retrieve('how do I clean the pH probe');   -- exact/related, full chunks
-- select * from public.chat_retrieve('reading is drifting');           -- drift synonym, no stopword pollution
-- select * from public.chat_search('how do I clean the probe');        -- should no longer be junk
-- select public.q_to_prefix_tsquery('how do I clean the probe');       -- => 'clean':* & 'probe':*  (filler gone)
-- select public.q_to_or_tsquery('ph reading drifting');                -- => OR across content terms
