-- =============================================================
-- Migration 036: recycle bin (soft delete) + launch cleanup
--
-- 1. SOFT DELETE for consolidated references and document submissions:
--    deleted_at/deleted_by columns. Deleting from the UI now only stamps
--    these; the doc sits in Admin → Recycle bin for 30 days, restorable
--    with everything related. Search/chat exclusion is automatic because
--    soft-deleting also removes the doc's derived chunks (rebuilt from
--    content_markdown on restore). RLS hides soft-deleted rows from
--    non-admins. Purge after 30 days is done lazily by the Recycle bin
--    panel (works on the free tier — no pg_cron dependency).
--
-- 2. Remove the 'supervisor' escalation skill: this tool is about sensors,
--    not the plants they're installed in.
--
-- 3. Prune document_types to the set actually offered at upload time
--    (scope = 'general') so Admin → Document types matches the uploader.
-- =============================================================
begin;

-- ---------- 1. soft delete ----------
alter table public.consolidated_docs
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.document_submissions
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists consolidated_docs_deleted_idx on public.consolidated_docs (deleted_at) where deleted_at is not null;
create index if not exists document_submissions_deleted_idx on public.document_submissions (deleted_at) where deleted_at is not null;

-- Non-admins never see soft-deleted rows; admins see them (for the bin).
-- NOTE: policies OR together — the old permissive one MUST be dropped.
drop policy if exists consolidated_select on public.consolidated_docs;
drop policy if exists consolidated_docs_select on public.consolidated_docs;
create policy consolidated_docs_select on public.consolidated_docs for select to authenticated
  using (deleted_at is null or public.current_role() = 'admin');

drop policy if exists submissions_select on public.document_submissions;
create policy submissions_select on public.document_submissions for select to authenticated
  using (
    (deleted_at is null or public.current_role() = 'admin')
    and (uploaded_by = auth.uid() or public.current_role() = 'admin')
  );

-- ---------- 2. sensors, not plants ----------
delete from public.escalation_contacts where skill_key = 'supervisor';

-- ---------- 3. document types = upload-time set ----------
delete from public.document_types where scope is distinct from 'general';

commit;
