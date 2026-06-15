-- =============================================================
-- Migration 024: answer feedback (success-metric foundation)
--
-- Captures whether an answer actually helped the operator solve their
-- problem. This is the core success signal: solved = a ticket avoided.
--   helpful = true                  -> solved
--   helpful = false (+ reason)      -> content existed but didn't help
-- (The "no content at all" case is captured separately by the
--  unanswered-query log in a later migration.)
-- =============================================================
begin;

create table if not exists public.answer_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  query text,
  consolidated_doc_id uuid references public.consolidated_docs(id) on delete set null,
  sensor_model_id uuid references public.sensor_models(id) on delete set null,
  helpful boolean not null,
  reason text,
  source text not null check (source in ('viewer', 'search', 'chat')),
  created_at timestamptz default now()
);
create index if not exists answer_feedback_created_idx on public.answer_feedback(created_at desc);
create index if not exists answer_feedback_helpful_idx on public.answer_feedback(helpful);
create index if not exists answer_feedback_doc_idx on public.answer_feedback(consolidated_doc_id);

alter table public.answer_feedback enable row level security;

-- Auto-stamp the submitter.
create or replace function public.set_feedback_user() returns trigger language plpgsql as $$
begin new.user_id := coalesce(new.user_id, auth.uid()); return new; end $$;
drop trigger if exists trg_set_feedback_user on public.answer_feedback;
create trigger trg_set_feedback_user before insert on public.answer_feedback
  for each row execute function public.set_feedback_user();

-- Anyone signed in can submit feedback (as themselves).
drop policy if exists feedback_insert on public.answer_feedback;
create policy feedback_insert on public.answer_feedback for insert to authenticated
  with check (user_id = auth.uid());

-- Users see their own; admins see all (for the dashboard).
drop policy if exists feedback_select on public.answer_feedback;
create policy feedback_select on public.answer_feedback for select to authenticated
  using (user_id = auth.uid() or public.current_role() = 'admin');

commit;
