-- =============================================================
-- Migration 055: lexicon_words returns one array, not one row per word
--
-- PostgREST caps a set-returning function at 1,000 rows like any other
-- select, so 054's version silently handed back the first 1,000 of ~7,000
-- words — "pipe" was not among them. One row carrying a text[] has no cap.
-- Also closes the function to the anon role: it is for signed-in users.
-- =============================================================
drop function if exists public.lexicon_words();

create or replace function public.lexicon_words()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct lower(w)), '{}')
    from public.consolidated_doc_chunks c,
         regexp_split_to_table(c.chunk_text, '[^A-Za-z]+') as w
   where length(w) between 4 and 24
$$;

revoke all on function public.lexicon_words() from public;
revoke all on function public.lexicon_words() from anon;
grant execute on function public.lexicon_words() to authenticated;
