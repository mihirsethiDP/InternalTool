-- =============================================================
-- Migration 057: "constant readings" is a stuck reading
--
-- Field phrasing for a frozen value: "constant", "same value", "not
-- changing", "flat line". Joins the existing stuck/frozen synonym group so
-- search and chat retrieval treat them alike.
-- =============================================================
update public.search_synonyms
   set terms = (select array_agg(distinct t) from unnest(terms || ARRAY['constant','constant reading','same value','not changing','flat line','flatline','fixed value','no variation']) as t)
 where 'stuck' = any(terms)
   and not ('constant' = any(terms));
