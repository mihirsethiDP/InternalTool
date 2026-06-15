-- =============================================================
-- Migration 019: send-back-for-changes + no hard delete on reject
--
-- Per review feedback: rejecting a submission should NOT silently delete
-- the file. Most "rejections" are really "needs changes" — the maker
-- should be able to revise and resubmit. Hard delete becomes a separate,
-- explicit admin action for genuine junk only.
--
-- Adds:
--   - status 'changes_requested' to document_submissions
--   - decision 'changes_requested'
--   - notification kind 'submission_changes_requested'
-- =============================================================
begin;

-- 1. status check: add 'changes_requested'
alter table public.document_submissions
  drop constraint if exists document_submissions_status_check;
alter table public.document_submissions
  add constraint document_submissions_status_check
  check (status in ('pending', 'approved', 'rejected', 'changes_requested'));

-- 2. decision check: add 'changes_requested'
alter table public.document_submissions
  drop constraint if exists document_submissions_decision_check;
alter table public.document_submissions
  add constraint document_submissions_decision_check
  check (decision in ('replace_section', 'append_section', 'rejected', 'changes_requested') or decision is null);

-- 3. notification kind check: add 'submission_changes_requested'
alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('submission_created', 'submission_approved', 'submission_rejected', 'submission_changes_requested'));

commit;
