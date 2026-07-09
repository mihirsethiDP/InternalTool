-- =============================================================
-- Migration 038: don't expose emails via the contributor leaderboard
--
-- 037's contribution_leaderboard() returned each contributor's email, and it
-- runs SECURITY INVOKER under profiles_select (using(true)) — so ANY signed-in
-- user (not just admins) could read every teammate's email through the public
-- leaderboard. The board only needs a display name + points, so drop email.
-- (Return-type change → must DROP then CREATE.)
-- =============================================================
begin;

drop function if exists public.contribution_leaderboard();

create function public.contribution_leaderboard()
returns table (user_id uuid, full_name text, total_points bigint, approvals bigint)
language sql stable
set search_path = public, pg_temp
as $$
  select ce.user_id,
         p.full_name,
         coalesce(sum(ce.points), 0) as total_points,
         count(*) filter (where ce.reason = 'approved') as approvals
  from public.contribution_events ce
  join public.profiles p on p.id = ce.user_id
  group by ce.user_id, p.full_name
  order by total_points desc, approvals desc;
$$;

grant execute on function public.contribution_leaderboard() to authenticated;

commit;
