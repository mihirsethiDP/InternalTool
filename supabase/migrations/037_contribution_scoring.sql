-- =============================================================
-- Migration 037: contribution scoring (incentivize good uploads)
--
-- Every time an admin APPROVES a submission, the uploader earns points.
-- Points live in an append-only ledger so the score is always auditable and
-- a leaderboard is a simple aggregate. A UNIQUE(submission_id, reason) guard
-- makes awarding idempotent — re-approving or a double-click never double-pays.
--
-- Defaults (enforced in app code, not here): +10 for an approved submission,
-- +5 bonus when that approval produces at least one diagnostic flow.
-- =============================================================
begin;

create table if not exists public.contribution_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid references public.document_submissions(id) on delete set null,
  points int not null default 0,
  reason text not null,                       -- 'approved' | 'flow_bonus' | ...
  created_at timestamptz not null default now(),
  unique (submission_id, reason)              -- idempotent awards
);

create index if not exists contribution_events_user_idx on public.contribution_events (user_id);
create index if not exists contribution_events_created_idx on public.contribution_events (created_at desc);

alter table public.contribution_events enable row level security;

-- Everyone signed in can READ the ledger (their own score + the leaderboard).
drop policy if exists contribution_select on public.contribution_events;
create policy contribution_select on public.contribution_events for select to authenticated using (true);

-- Only admins WRITE points (they're granted at approval time). Never the earner.
drop policy if exists contribution_write on public.contribution_events;
create policy contribution_write on public.contribution_events for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Leaderboard helper: points + approved-count per contributor, most first.
-- SECURITY INVOKER + pinned search_path; reads run under the caller's RLS,
-- which is `using(true)` above, so any signed-in user can see the board.
create or replace function public.contribution_leaderboard()
returns table (user_id uuid, full_name text, email text, total_points bigint, approvals bigint)
language sql stable
set search_path = public, pg_temp
as $$
  select ce.user_id,
         p.full_name,
         p.email,
         coalesce(sum(ce.points), 0) as total_points,
         count(*) filter (where ce.reason = 'approved') as approvals
  from public.contribution_events ce
  join public.profiles p on p.id = ce.user_id
  group by ce.user_id, p.full_name, p.email
  order by total_points desc, approvals desc;
$$;

grant execute on function public.contribution_leaderboard() to authenticated;

commit;
