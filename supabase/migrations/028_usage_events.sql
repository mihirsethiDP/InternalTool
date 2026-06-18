-- =============================================================
-- Migration 028: generic usage-event log
--
-- Lightweight, future-proof event stream for product signals that aren't
-- feedback or unanswered-queries. First use: counting "Search the web" clicks
-- (a signal that self-service + the library didn't satisfy the operator and
-- they escalated outside the tool).
-- =============================================================
begin;

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event text not null,              -- e.g. 'web_search'
  query text,                       -- the query in play, if any
  source text,                      -- 'chat' | 'search' | ...
  created_at timestamptz default now()
);
create index if not exists usage_events_created_idx on public.usage_events(created_at desc);
create index if not exists usage_events_event_idx on public.usage_events(event);

alter table public.usage_events enable row level security;

-- Auto-stamp the actor.
create or replace function public.set_usage_event_user() returns trigger language plpgsql as $$
begin new.user_id := coalesce(new.user_id, auth.uid()); return new; end $$;
drop trigger if exists trg_set_usage_event_user on public.usage_events;
create trigger trg_set_usage_event_user before insert on public.usage_events
  for each row execute function public.set_usage_event_user();

-- Anyone signed in can log their own events.
drop policy if exists usage_events_insert on public.usage_events;
create policy usage_events_insert on public.usage_events for insert to authenticated
  with check (user_id = auth.uid());

-- Submitters see their own; admins see all (for the dashboard).
drop policy if exists usage_events_select on public.usage_events;
create policy usage_events_select on public.usage_events for select to authenticated
  using (user_id = auth.uid() or public.current_role() = 'admin');

commit;
