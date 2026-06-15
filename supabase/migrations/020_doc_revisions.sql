-- =============================================================
-- Migration 020: version history for consolidated references
--
-- Every write to a consolidated reference (approval-merge, manual edit,
-- or revert) records a snapshot here, so admins can see what changed,
-- by whom and when, and restore any prior version.
-- =============================================================
begin;

create table if not exists public.consolidated_doc_revisions (
  id uuid primary key default gen_random_uuid(),
  consolidated_doc_id uuid not null references public.consolidated_docs(id) on delete cascade,
  content_markdown text not null,
  change_kind text not null check (change_kind in ('approval', 'edit', 'revert')),
  note text,
  -- references profiles (not auth.users) so the author email can be embedded
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz default now()
);
create index if not exists cdr_doc_idx on public.consolidated_doc_revisions(consolidated_doc_id, changed_at desc);

alter table public.consolidated_doc_revisions enable row level security;

drop policy if exists cdr_select on public.consolidated_doc_revisions;
create policy cdr_select on public.consolidated_doc_revisions for select to authenticated
  using (public.current_role() = 'admin');

drop policy if exists cdr_write on public.consolidated_doc_revisions;
create policy cdr_write on public.consolidated_doc_revisions for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Auto-stamp the author.
create or replace function public.set_revision_author() returns trigger language plpgsql as $$
begin new.changed_by := coalesce(new.changed_by, auth.uid()); return new; end $$;
drop trigger if exists trg_set_revision_author on public.consolidated_doc_revisions;
create trigger trg_set_revision_author before insert on public.consolidated_doc_revisions
  for each row execute function public.set_revision_author();

commit;
