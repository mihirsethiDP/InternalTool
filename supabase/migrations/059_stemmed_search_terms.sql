-- =============================================================
-- Migration 059: search question words the way passages are indexed
--
-- Passages are indexed with English stemming (to_tsvector('english', …)):
-- "calibrate" is stored as calibr, "installation" as instal, "UPS" as up,
-- "readings" as read. q_to_prefix_tsquery / q_to_or_tsquery built the query
-- by hand and CAST it to tsquery, which does NOT stem — so "calibrate:*"
-- looked for words starting with "calibrate" and found none. Measured on
-- 2026-11-11, as searched before this migration:
--     calibrate 0 · cleaning 0 · installation 0 · replace 0 · readings 0
--     offline 0 · fluctuating 0 · batteries 0 · ups 16
-- and stemmed: 145 · 89 · 269 · 56 · 96 · 12 · 10 · 50 · 262.
-- Every such question fell through to loose any-word matching (or nothing),
-- which is where most "no data found" answers came from.
--
-- Fix: every word (question word or synonym word) becomes
--   (word:* | stem:*)
-- i.e. today's match OR the stemmed match, so nothing that matched before
-- can stop matching. Phrases keep <->; the stop-word list is unchanged.
-- Both builders share one core; chat_search, chat_retrieve and
-- search_documents pick this up automatically.
-- =============================================================
begin;

-- One word → '(word:* | stem:*)' (or 'word:*' when the stem is the word, or
-- the word is an English stop word that the stemmer drops).
create or replace function public.ts_term(w text)
returns text
language plpgsql
stable
as $$
declare
  stem text;
begin
  w := regexp_replace(lower(coalesce(w, '')), '[^a-z0-9]+', '', 'g');
  if length(w) = 0 then return null; end if;
  stem := (ts_lexize('english_stem', w))[1];
  if stem is null or stem = '' or stem = w then
    return w || ':*';
  end if;
  return '(' || w || ':* | ' || stem || ':*)';
end $$;

-- A synonym term → one ts_term, or a <-> phrase of ts_terms. Punctuation in
-- terms ("build-up", "192.168.1.1") splits into phrase words instead of
-- breaking the cast (which used to make the WHOLE query match nothing).
create or replace function public.ts_phrase(s text)
returns text
language plpgsql
stable
as $$
declare
  words text[];
  parts text[] := ARRAY[]::text[];
  w text;
  t text;
begin
  words := regexp_split_to_array(trim(regexp_replace(lower(coalesce(s, '')), '[^a-z0-9]+', ' ', 'g')), '\s+');
  foreach w in array words loop
    t := public.ts_term(w);
    if t is not null then parts := array_append(parts, t); end if;
  end loop;
  if array_length(parts, 1) is null then return null; end if;
  if array_length(parts, 1) = 1 then return parts[1]; end if;
  return '(' || array_to_string(parts, ' <-> ') || ')';
end $$;

-- Shared core: one tsquery fragment per content word of the question,
-- synonym groups expanded, stop words skipped.
create or replace function public.q_to_tsquery_parts(q text)
returns text[]
language plpgsql
stable
as $$
declare
  cleaned text;
  tokens text[];
  tk text;
  syn_array text[];
  inner_parts text[];
  per_token_parts text[] := ARRAY[]::text[];
  s text;
  t text;
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

  foreach tk in array tokens loop
    if tk is null or length(tk) < 2 then continue; end if;
    if tk = any(stop) then continue; end if;

    syn_array := (
      select array_agg(distinct lower(s2))
      from public.search_synonyms ss, unnest(ss.terms) s2
      where exists (select 1 from unnest(ss.terms) x where lower(x) = tk)
    );

    if syn_array is null or array_length(syn_array, 1) is null then
      t := public.ts_term(tk);
      if t is not null then per_token_parts := array_append(per_token_parts, t); end if;
    else
      inner_parts := ARRAY[]::text[];
      foreach s in array syn_array loop
        t := public.ts_phrase(s);
        if t is not null then inner_parts := array_append(inner_parts, t); end if;
      end loop;
      if array_length(inner_parts, 1) is null then
        t := public.ts_term(tk);
        if t is not null then per_token_parts := array_append(per_token_parts, t); end if;
      else
        per_token_parts := array_append(per_token_parts, '(' || array_to_string(inner_parts, ' | ') || ')');
      end if;
    end if;
  end loop;
  return per_token_parts;
end $$;

create or replace function public.q_to_prefix_tsquery(q text)
returns tsquery
language plpgsql
stable
as $$
declare
  parts text[];
begin
  parts := public.q_to_tsquery_parts(q);
  if parts is null or array_length(parts, 1) is null then return ''::tsquery; end if;
  return array_to_string(parts, ' & ')::tsquery;
exception when others then
  return ''::tsquery;
end $$;

create or replace function public.q_to_or_tsquery(q text)
returns tsquery
language plpgsql
stable
as $$
declare
  parts text[];
begin
  parts := public.q_to_tsquery_parts(q);
  if parts is null or array_length(parts, 1) is null then return ''::tsquery; end if;
  return array_to_string(parts, ' | ')::tsquery;
exception when others then
  return ''::tsquery;
end $$;

grant execute on function public.ts_term(text) to authenticated;
grant execute on function public.ts_phrase(text) to authenticated;
grant execute on function public.q_to_tsquery_parts(text) to authenticated;

commit;

-- Check after running:
--   select public.q_to_prefix_tsquery('how to calibrate the pH sensor');
--     => ( 'calibrate':* | 'calibr':* ) & 'ph':* & 'sensor':*
--   select count(*) from consolidated_doc_chunks where tsv @@ public.q_to_prefix_tsquery('installation');
