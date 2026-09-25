-- =============================================================
-- Migration 054: the documentation's own vocabulary for the spell-corrector
--
-- The chat corrects typos against a lexicon of catalogue words (makes,
-- models, categories, synonyms). Any other word of four letters or more was
-- treated as a misspelling and snapped to the nearest known word — which
-- turned "empty pipe error" into "empty wipe error" and made the reference
-- unfindable. The lexicon now also loads every word that appears in the
-- approved references, so domain vocabulary is known by definition.
-- =============================================================
create or replace function public.lexicon_words()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct lower(w)
    from public.consolidated_doc_chunks c,
         regexp_split_to_table(c.chunk_text, '[^A-Za-z]+') as w
   where length(w) between 4 and 24
$$;

revoke all on function public.lexicon_words() from public;
grant execute on function public.lexicon_words() to authenticated;
