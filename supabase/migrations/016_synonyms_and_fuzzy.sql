-- =============================================================
-- Migration 016: synonym expansion + thesaurus + trigram fallback
--
-- Three quality lifts to the search RPC (no API key needed):
--
-- 1. Synonym dictionary — domain-curated groups of equivalent terms.
--    Searching "leak" matches docs containing "leakage" / "spillage" /
--    "seepage". Phrases also supported: "hydrogen sulfide" <-> "h2s".
--
-- 2. Thesaurus (multi-word concepts) — same table, multi-word entries
--    use Postgres tsquery phrase operator <->.
--
-- 3. Trigram fallback — when the primary query returns zero hits, retry
--    with word_similarity() so typos and partial matches still surface
--    something. Falls back inside the RPC; no UI change needed.
--
-- Both search_documents (search bar) and chat_search (chatbot) gain all
-- three improvements automatically because they share q_to_prefix_tsquery.
-- =============================================================
begin;

-- ---------- 1. Synonym table ----------
create table if not exists public.search_synonyms (
  id uuid primary key default gen_random_uuid(),
  terms text[] not null,            -- array of equivalent terms / phrases
  notes text,                       -- optional admin note
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One row -> all its terms are mutual synonyms. A term can appear in
-- multiple rows; lookups union all matches.
create index if not exists synonyms_terms_idx on public.search_synonyms using gin (terms);

alter table public.search_synonyms enable row level security;

drop policy if exists synonyms_select on public.search_synonyms;
create policy synonyms_select on public.search_synonyms for select to authenticated using (true);

drop policy if exists synonyms_write on public.search_synonyms;
create policy synonyms_write on public.search_synonyms for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Seed with sensor-domain synonyms. Admins can edit later via SQL or a UI.
truncate table public.search_synonyms;
insert into public.search_synonyms (terms, notes) values
  -- Common faults
  (ARRAY['drift','drifting','offset','reading off','inaccurate','incorrect','wrong'], 'reading-quality faults'),
  (ARRAY['leak','leakage','leaking','spillage','seepage','dripping'], 'fluid escape'),
  (ARRAY['foul','fouling','fouled','coating','scaling','biofilm','deposit','build-up','buildup'], 'electrode surface contamination'),
  (ARRAY['noise','noisy','unstable','jumpy','fluctuating','fluctuation','erratic'], 'unstable readings'),
  (ARRAY['slow','lagging','delayed','sluggish','slow response'], 'response time issues'),
  (ARRAY['stuck','frozen','flat','no change','unchanging'], 'no-response readings'),
  (ARRAY['error','fault','alarm','warning','code'], 'fault indications'),
  (ARRAY['poison','poisoning','contamination','damaged','degraded','dead'], 'irreversible sensor damage'),

  -- Maintenance verbs
  (ARRAY['clean','cleaning','wipe','wash','decontaminate','sanitize','rinse'], 'cleaning actions'),
  (ARRAY['calibrate','calibration','calibrated','zero','span','calibrating'], 'calibration'),
  (ARRAY['fix','repair','replace','replacement','service','swap'], 'corrective action'),
  (ARRAY['install','installation','mount','mounting','fit','fitting'], 'install'),
  (ARRAY['troubleshoot','troubleshooting','debug','diagnose','problem','issue'], 'troubleshooting umbrella'),
  (ARRAY['maintain','maintenance','upkeep','servicing','routine'], 'maintenance'),
  (ARRAY['verify','verification','test','testing','validation','validate'], 'verification'),

  -- Hardware
  (ARRAY['sensor','probe','transmitter','device','instrument'], 'measurement device'),
  (ARRAY['cable','wire','wiring','connection','connector','terminal','lead'], 'electrical connection'),
  (ARRAY['power','voltage','supply','vdc','dc','24v','12v'], 'electrical supply'),
  (ARRAY['display','screen','lcd','oled','readout','indicator'], 'display'),

  -- Process / site
  (ARRAY['wastewater','sewage','effluent','stp','etp','wtp'], 'water treatment sites'),
  (ARRAY['plant','site','facility'], 'site'),
  (ARRAY['equipment','asset','machinery'], 'process equipment'),

  -- Document types
  (ARRAY['manual','guide','instructions','documentation','handbook'], 'manual / guide'),
  (ARRAY['datasheet','specification','spec','specs','data sheet','technical data sheet'], 'datasheet'),
  (ARRAY['certificate','cert','warranty'], 'certificates'),

  -- Water-quality sensor parameters
  (ARRAY['ph','acidity','alkalinity'], 'pH'),
  (ARRAY['orp','redox','oxidation','potential','reduction-oxidation','reduction oxidation'], 'ORP'),
  (ARRAY['do','dissolved oxygen','oxygen','odo','optical do'], 'dissolved oxygen'),
  (ARRAY['ec','conductivity','conductance'], 'conductivity'),
  (ARRAY['tds','total dissolved solids','salinity'], 'TDS'),
  (ARRAY['hydrogen sulfide','h2s','sulfide','rotten egg'], 'H2S'),

  -- Vendors / catalog
  (ARRAY['vendor','manufacturer','oem','supplier','brand','make'], 'vendor'),
  (ARRAY['ultrasonic','sonic','echo'], 'ultrasonic measurement'),
  (ARRAY['magnetic','electromagnetic','mag','magmeter'], 'magnetic flow'),
  (ARRAY['flow','flowrate','flow rate','rate'], 'flow');

-- ---------- 2. Updated q_to_prefix_tsquery with synonym expansion ----------
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
begin
  cleaned := regexp_replace(lower(coalesce(q, '')), '[^a-z0-9 ]+', ' ', 'g');
  tokens := regexp_split_to_array(trim(cleaned), '\s+');
  per_token_parts := ARRAY[]::text[];

  foreach tk in array tokens loop
    if tk is null or length(tk) = 0 then continue; end if;

    -- Find synonym groups containing this token. Unnest and union all terms.
    syn_array := (
      select array_agg(distinct lower(s2))
      from public.search_synonyms ss, unnest(ss.terms) s2
      where exists (
        select 1 from unnest(ss.terms) t where lower(t) = tk
      )
    );

    if syn_array is null or array_length(syn_array, 1) is null then
      -- no synonym -> just prefix-match the original token
      per_token_parts := array_append(per_token_parts, tk || ':*');
    else
      -- build OR group: (term1:* | term2:* | phrase <-> word:* ...)
      inner_parts := ARRAY[]::text[];
      foreach s in array syn_array loop
        if s is null or length(s) = 0 then continue; end if;
        if position(' ' in s) > 0 then
          -- multi-word: phrase operator with prefix on last token
          inner_parts := array_append(inner_parts,
            '(' || replace(trim(s), ' ', ' <-> ') || ':*)');
        else
          inner_parts := array_append(inner_parts, s || ':*');
        end if;
      end loop;
      if array_length(inner_parts, 1) is null then
        per_token_parts := array_append(per_token_parts, tk || ':*');
      else
        per_token_parts := array_append(per_token_parts,
          '(' || array_to_string(inner_parts, ' | ') || ')');
      end if;
    end if;
  end loop;

  if per_token_parts is null or array_length(per_token_parts, 1) is null then
    return ''::tsquery;
  end if;

  result_str := array_to_string(per_token_parts, ' & ');
  return result_str::tsquery;
exception when others then
  -- defensive: if anything in the tsquery cast fails, return empty (no match)
  return ''::tsquery;
end $$;

-- ---------- 3. Search RPCs gain trigram fallback ----------
-- Drop and recreate search_documents with the same signature, adding a
-- fuzzy fallback CTE that only fires when primary FTS returns 0 rows.
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
    select cd.id as consolidated_doc_id,
           sm.id as sensor_model_id,
           (coalesce(mk.name, '') || ' ' || coalesce(sm.model_no, '') || ' — Consolidated reference') as document_title,
           sm.model_no as sensor_model_no,
           mk.name as sensor_make,
           sm.category_id, sm.make_id
    from public.consolidated_docs cd
    join public.sensor_models sm on sm.id = cd.sensor_model_id
    left join public.sensor_makes mk on mk.id = sm.make_id
    where (p_sensor_model_id is null or sm.id = p_sensor_model_id)
      and (p_category_id is null or sm.category_id = p_category_id)
      and (p_make_id is null or sm.make_id = p_make_id)
  ),
  q_parsed as (
    select public.q_to_prefix_tsquery(q) as tsq,
           coalesce(trim(q), '') as q_trim,
           split_part(trim(regexp_replace(lower(coalesce(q,'')), '[^a-z0-9 ]+', ' ', 'g')), ' ', 1) as first_term
  ),
  chunk_matches as (
    select b.consolidated_doc_id, b.document_title, b.sensor_model_no, b.sensor_make,
           c.id as chunk_id, c.section,
           c.chunk_text,
           ts_rank(c.tsv, q_parsed.tsq) as rank,
           case when q_parsed.first_term <> ''
                 and position(q_parsed.first_term in lower(c.chunk_text)) > 0
                then 0 else 1 end as literal_priority
    from base b
    join public.consolidated_doc_chunks c on c.consolidated_doc_id = b.consolidated_doc_id
    cross join q_parsed
    where q_parsed.q_trim <> ''
      and q_parsed.tsq <> ''::tsquery
      and c.tsv @@ q_parsed.tsq
      and (p_type_key is null or c.section = p_type_key)
  ),
  best_per_doc as (
    select distinct on (cm.consolidated_doc_id)
      cm.consolidated_doc_id, cm.document_title, cm.sensor_model_no, cm.sensor_make,
      cm.section, cm.chunk_text, cm.rank
    from chunk_matches cm
    order by cm.consolidated_doc_id, cm.literal_priority asc, cm.rank desc, cm.chunk_id asc
  ),
  -- Fuzzy fallback: only when primary matched nothing.
  fuzzy_chunks as (
    select b.consolidated_doc_id, b.document_title, b.sensor_model_no, b.sensor_make,
           c.id as chunk_id, c.section, c.chunk_text,
           word_similarity(lower(q_parsed.q_trim), lower(c.chunk_text)) as sim
    from base b
    join public.consolidated_doc_chunks c on c.consolidated_doc_id = b.consolidated_doc_id
    cross join q_parsed
    where q_parsed.q_trim <> ''
      and word_similarity(lower(q_parsed.q_trim), lower(c.chunk_text)) > 0.3
      and (p_type_key is null or c.section = p_type_key)
      and not exists (select 1 from chunk_matches)
  ),
  best_fuzzy as (
    select distinct on (consolidated_doc_id)
      consolidated_doc_id, document_title, sensor_model_no, sensor_make,
      section, chunk_text, sim as rank
    from fuzzy_chunks
    order by consolidated_doc_id, sim desc, chunk_id asc
  ),
  no_q as (
    select b.consolidated_doc_id, b.document_title, null::text as type_label,
           null::text, null::text,
           b.sensor_model_no, b.sensor_make,
           null::int as page_number, ''::text as snippet, 0::real as rank
    from base b, q_parsed
    where q_parsed.q_trim = ''
    limit p_limit
  ),
  with_q as (
    select bpd.consolidated_doc_id, bpd.document_title, bpd.section as type_label,
           null::text, null::text,
           bpd.sensor_model_no, bpd.sensor_make,
           null::int as page_number,
           public.match_snippet(bpd.chunk_text, q_parsed.q_trim) as snippet,
           bpd.rank
    from best_per_doc bpd, q_parsed
    limit p_limit
  ),
  with_q_fuzzy as (
    select bf.consolidated_doc_id, bf.document_title, bf.section as type_label,
           null::text, null::text,
           bf.sensor_model_no, bf.sensor_make,
           null::int as page_number,
           '~ ' || public.match_snippet(bf.chunk_text, q_parsed.q_trim) as snippet,
           bf.rank
    from best_fuzzy bf, q_parsed
    limit p_limit
  )
  select * from no_q
  union all
  select * from with_q
  union all
  select * from with_q_fuzzy
  order by rank desc nulls last, document_title
  limit p_limit;
$$;

-- chat_search also benefits from synonyms via the shared q_to_prefix_tsquery —
-- but it currently has its own inline tokenisation. Replace with the shared
-- one so chat results get the synonym lift too. Adds a fuzzy fallback as well.
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
    select public.q_to_prefix_tsquery(q) as tsq,
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
  ),
  fuzzy_chunks as (
    select cd.id as consolidated_doc_id,
           (coalesce(mk.name, '') || ' ' || coalesce(sm.model_no, '')) as document_title,
           c.section, c.chunk_text,
           c.id as chunk_id,
           word_similarity(lower(q_parsed.q_trim), lower(c.chunk_text)) as sim
    from public.consolidated_docs cd
    join public.consolidated_doc_chunks c on c.consolidated_doc_id = cd.id
    join public.sensor_models sm on sm.id = cd.sensor_model_id
    left join public.sensor_makes mk on mk.id = sm.make_id
    cross join q_parsed
    where q_parsed.q_trim <> ''
      and word_similarity(lower(q_parsed.q_trim), lower(c.chunk_text)) > 0.3
      and not exists (select 1 from chunk_matches)
  ),
  best_fuzzy as (
    select distinct on (consolidated_doc_id)
      consolidated_doc_id, document_title, section, chunk_text, sim as rank
    from fuzzy_chunks
    order by consolidated_doc_id, sim desc, chunk_id asc
  )
  select consolidated_doc_id as document_id, document_title, section,
         public.match_snippet(chunk_text, q) as snippet, rank
  from best_per_doc
  union all
  select consolidated_doc_id, document_title, section,
         '~ ' || public.match_snippet(chunk_text, q) as snippet,
         rank
  from best_fuzzy
  order by rank desc
  limit p_limit;
$$;

commit;

-- Smoke tests
-- select * from public.search_documents('leaking');         -- should match "leak"/"leakage" via synonyms
-- select * from public.search_documents('flouresce');       -- typo -> trigram fallback (snippet prefixed with '~ ')
-- select * from public.search_documents('rotten egg');      -- multi-word synonym for H2S
-- select * from public.chat_search('how do I clean the probe');
