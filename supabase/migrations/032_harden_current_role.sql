-- =============================================================
-- Migration 032: harden public.current_role() (security review)
--
-- current_role() is the role gate behind nearly every write/admin RLS policy
-- (consolidated_docs, routing_rules, submission approval, profiles admin
-- update, storage write/delete, etc.). It was defined as a plain (INVOKER)
-- function with no pinned search_path, so it:
--   (a) relied on the session search_path resolving `profiles` to `public`, and
--   (b) read public.profiles under the CALLER's RLS — which only works today
--       because profiles_select is `using(true)`; tightening that policy later
--       would silently break every role check.
--
-- Recreate it as SECURITY DEFINER with a pinned search_path so it robustly
-- returns the caller's role regardless of the profiles read policy. Body is a
-- trivial, parameter-free lookup keyed on auth.uid() — safe under DEFINER.
-- (Supabase's own linter flags RLS-helper functions that aren't set up this way.)
-- =============================================================
begin;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Keep execute available to the roles the policies run as.
grant execute on function public.current_role() to authenticated, anon;

commit;
