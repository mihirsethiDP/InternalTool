-- =============================================================
-- Migration 025: unanswered query log
--
-- Records queries that returned nothing (from search or chat) so admins
-- can see what operators need that the library doesn't have yet — the
-- "no content at all" case, and the demand signal for what to document
-- next. Feeds the insights dashboard.
-- =============================================================
begin;

create table if not exists public.unanswered_queries (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  source text not null check (source in ('search', 'chat')),
  sensor_model_id uuid references public.sensor_models(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists unanswered_created_idx on public.unanswered_queries(created_at desc);
create index if not exists unanswered_query_idx on public.unanswered_queries(lower(query));

alter table public.unanswered_queries enable row level security;

create or replace function public.set_unanswered_user() returns trigger language plpgsql as $$
begin new.user_id := coalesce(new.user_id, auth.uid()); return new; end $$;
drop trigger if exists trg_set_unanswered_user on public.unanswered_queries;
create trigger trg_set_unanswered_user before insert on public.unanswered_queries
  for each row execute function public.set_unanswered_user();

drop policy if exists unanswered_insert on public.unanswered_queries;
create policy unanswered_insert on public.unanswered_queries for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists unanswered_select on public.unanswered_queries;
create policy unanswered_select on public.unanswered_queries for select to authenticated
  using (public.current_role() = 'admin');

commit;
