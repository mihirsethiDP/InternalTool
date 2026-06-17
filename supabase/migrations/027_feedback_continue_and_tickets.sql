-- =============================================================
-- Migration 027: chat continuation flag + support tickets
--
-- 1. answer_feedback.continued — when an answer didn't help and the operator
--    chose to keep asking (continue the conversation) rather than give up, we
--    record it. Lets the dashboard see the "answer failed → kept trying" funnel.
--
-- 2. support_tickets — when self-service fails, the operator can log a ticket.
--    Stored here first (so nothing is lost / it's tracked), then pushed to the
--    external CustomerHub. The external_* / status columns track that sync.
-- =============================================================
begin;

-- ---------- 1. Continuation flag ----------
alter table public.answer_feedback
  add column if not exists continued boolean not null default false;

-- ---------- 2. Support tickets ----------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  description text not null,
  query text,                       -- the originating chat/search query
  sensor_model_id uuid references public.sensor_models(id) on delete set null,
  plant_name text,                  -- CustomerHub is organised by plant
  contact_email text,
  status text not null default 'open'
    check (status in ('open', 'syncing', 'synced', 'failed', 'closed')),
  external_system text,             -- e.g. 'customerhub'
  external_ref text,                -- id returned by the external system
  sync_error text,
  created_at timestamptz default now()
);
create index if not exists support_tickets_created_idx on public.support_tickets(created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status);
create index if not exists support_tickets_user_idx on public.support_tickets(user_id);

alter table public.support_tickets enable row level security;

-- Auto-stamp the submitter.
create or replace function public.set_ticket_user() returns trigger language plpgsql as $$
begin new.user_id := coalesce(new.user_id, auth.uid()); return new; end $$;
drop trigger if exists trg_set_ticket_user on public.support_tickets;
create trigger trg_set_ticket_user before insert on public.support_tickets
  for each row execute function public.set_ticket_user();

-- Anyone signed in can log a ticket (as themselves).
drop policy if exists tickets_insert on public.support_tickets;
create policy tickets_insert on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid());

-- Submitters see their own; admins see all.
drop policy if exists tickets_select on public.support_tickets;
create policy tickets_select on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.current_role() = 'admin');

-- Admins can update status (e.g. close); the sync worker uses the service role.
drop policy if exists tickets_update on public.support_tickets;
create policy tickets_update on public.support_tickets for update to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

commit;
