-- =============================================================
-- Migration 042: let uploaders actually resubmit after changes requested
--
-- BUG (found in live testing): submissions_update (011) is admin-only, so an
-- uploader's "Revise & resubmit" matched ZERO rows. Postgres RLS filters the
-- row out rather than erroring, and PostgREST returns no error for a 0-row
-- UPDATE — so the app reported success while the submission stayed in
-- "changes requested" forever.
--
-- This adds a tightly-scoped second policy (policies OR together, so admins
-- keep full rights): an uploader may move THEIR OWN row from
-- 'changes_requested' to 'pending' — and nothing else. They cannot approve
-- their own work (the WITH CHECK pins the new status to 'pending'), cannot
-- touch anyone else's row, and cannot edit an already-approved submission.
-- =============================================================
begin;

drop policy if exists submissions_resubmit on public.document_submissions;
create policy submissions_resubmit on public.document_submissions for update to authenticated
  using (uploaded_by = auth.uid() and status = 'changes_requested')
  with check (uploaded_by = auth.uid() and status = 'pending');

commit;
