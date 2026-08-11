-- =============================================================
-- Migration 043: remember what the AI detected at upload time
--
-- A real upload usually covers SEVERAL activities (a manual with cleaning +
-- maintenance + calibration). The uploader picks the primary type, but the
-- detected set is worth keeping: the approve screen uses it to pre-select the
-- "split across sections" parts, so the admin doesn't redo the analysis.
--
-- Purely informational — nullable, no behaviour depends on it being present.
-- =============================================================
begin;

alter table public.document_submissions
  add column if not exists detected_sections text[];

commit;
