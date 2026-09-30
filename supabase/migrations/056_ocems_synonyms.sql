-- =============================================================
-- Migration 056: the water quality analyser's regulatory name
--
-- In the field the multi-parameter analyser is "the OCEMS" (Online
-- Continuous Effluent Monitoring System) or just "WA". The category already
-- lists OCEMS as an alias (routing menu); this teaches the SEARCH layer
-- (full-text synonyms used by search_documents / chat_search / chat_retrieve)
-- and the chat's issue aliases the same vocabulary.
-- =============================================================
insert into public.search_synonyms (terms, notes)
select ARRAY['ocems','cems','water analyzer','water analyser','water quality analyser','water quality analyzer','effluent monitoring','online continuous effluent monitoring system','wa','multi parameter analyzer','multiparameter analyser'],
       'OCEMS = water quality analyser (regulatory name)'
where not exists (select 1 from public.search_synonyms where 'ocems' = any(terms));

-- Category alias list: make sure the long form and the short form are there.
update public.sensor_categories
   set aliases = (
     select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['OCEMS','CEMS','WA','Water Analyzer','Water Analyser','Online Continuous Effluent Monitoring System','Effluent Monitoring System']) as a
   )
 where name = 'Water Quality Analyser';

-- Issues for the analyser: let "OCEMS ..." phrasings match their aliases too.
update public.issues i
   set aliases = (select array_agg(distinct a) from unnest(coalesce(i.aliases, '{}'::text[]) || ARRAY['ocems ' || lower(i.label)]) as a)
  from public.sensor_categories c
 where i.sensor_category_id = c.id and c.name = 'Water Quality Analyser'
   and not exists (select 1 from unnest(coalesce(i.aliases, '{}'::text[])) a where a ilike 'ocems %');
