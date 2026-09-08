-- =============================================================
-- Migration 050: two holes found by a security audit
--
-- 1. UPLOADERS COULD DESTROY THE TAXONOMY.
--    001_init granted one FOR ALL policy over a list of "catalog" tables to
--    uploader OR admin. That list includes sensor_categories and
--    document_types — which are no longer neutral reference data:
--    document_types rows ARE the approval sections (040/046), and
--    diagnostic_flows.sensor_category_id / issues.sensor_category_id are
--    ON DELETE CASCADE. An uploader deleting one category therefore silently
--    destroyed APPROVED diagnostic flows and their issues — proven in the
--    audit, with no admin check and no recycle bin.
--
--    Uploaders keep write access where they actually need it (documents,
--    document_chunks, sensor_models — "add a sensor I'm uploading for").
--    The taxonomy itself becomes admin-only.
--
-- 2. TELEMETRY WAS SILENTLY ADMIN-ONLY.
--    Non-admins could not insert unanswered_queries, and logUnanswered()
--    swallows the error — so "most requested, not found" in Insights only
--    ever recorded ADMIN questions. The signal that tells you what to
--    document next was structurally near-empty.
-- =============================================================
begin;

-- ---------- 1. taxonomy: admin-only writes ----------
do $$ declare t text;
begin
  foreach t in array array['sensor_categories', 'document_types'] loop
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format($p$create policy %I_write on public.%I for all to authenticated
                     using (public.current_role() = 'admin')
                     with check (public.current_role() = 'admin')$p$, t, t);
  end loop;
end $$;

-- Deleting a category must never take approved content with it. RESTRICT
-- makes the dependency explicit (the delete fails) instead of cascading.
alter table public.diagnostic_flows
  drop constraint if exists diagnostic_flows_sensor_category_id_fkey;
alter table public.diagnostic_flows
  add constraint diagnostic_flows_sensor_category_id_fkey
  foreign key (sensor_category_id) references public.sensor_categories(id) on delete restrict;

alter table public.issues
  drop constraint if exists issues_sensor_category_id_fkey;
alter table public.issues
  add constraint issues_sensor_category_id_fkey
  foreign key (sensor_category_id) references public.sensor_categories(id) on delete restrict;

-- ---------- 2. anyone signed in can log a gap ----------
drop policy if exists unanswered_insert on public.unanswered_queries;
create policy unanswered_insert on public.unanswered_queries for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

commit;
