-- =============================================================
-- Migration 013: open INSERT on notifications for authenticated users
--
-- Adds RLS INSERT policy so the client can:
--   - From Upload modal → fan out 'submission_created' to all admins
--   - From Review queue → 'submission_approved' / 'submission_rejected'
--     to the submission's uploader
--
-- For an internal tool with trusted users this is acceptable. The SELECT
-- policy still restricts each user to their own notifications.
-- =============================================================
begin;

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
  with check (true);

-- Enable Postgres realtime broadcasts for notifications so the bell can
-- update without polling.
alter publication supabase_realtime add table public.notifications;

commit;
