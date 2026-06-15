-- =============================================================
-- Migration 021: work-type taxonomy (keystone)
--
-- The consolidated reference is now organised by OUTPUT work-types (the
-- 14-category maintenance/diagnostic taxonomy) instead of input-document
-- forms. Raw uploads stay as source documents (document_types unchanged);
-- their content is filed into work-type sections at approval.
--
-- This migration:
--   1. Remaps existing section values (old -> nearest work-type)
--   2. Remaps the "## <section>" headers inside stored content_markdown
--   3. Swaps the CHECK constraints to the new section keys
--
-- New section keys:
--   troubleshooting, cleaning, calibration, verification, inspection,
--   electrical, configuration, consumable, component, preventive,
--   corrective, data_quality, install_improve, software, other
--
-- Old -> new mapping:
--   troubleshooting -> troubleshooting     manual    -> other
--   calibration     -> calibration         install   -> other
--   cleaning        -> cleaning            datasheet -> other
--   spares          -> consumable          wiring    -> electrical
--   ppm             -> preventive          safety    -> other
--   other           -> other
-- =============================================================
begin;

-- ---- 1. document_submissions.target_section ----
alter table public.document_submissions
  drop constraint if exists document_submissions_target_section_check;

update public.document_submissions set target_section = case target_section
  when 'spares' then 'consumable'
  when 'ppm'    then 'preventive'
  when 'wiring' then 'electrical'
  when 'manual' then 'other'
  when 'install' then 'other'
  when 'datasheet' then 'other'
  when 'safety' then 'other'
  else target_section
end
where target_section is not null;

alter table public.document_submissions
  add constraint document_submissions_target_section_check
  check (target_section in (
    'troubleshooting','cleaning','calibration','verification','inspection',
    'electrical','configuration','consumable','component','preventive',
    'corrective','data_quality','install_improve','software','other'
  ) or target_section is null);

-- ---- 2. consolidated_doc_chunks.section ----
alter table public.consolidated_doc_chunks
  drop constraint if exists consolidated_doc_chunks_section_check;

update public.consolidated_doc_chunks set section = case section
  when 'spares' then 'consumable'
  when 'ppm'    then 'preventive'
  when 'wiring' then 'electrical'
  when 'manual' then 'other'
  when 'install' then 'other'
  when 'datasheet' then 'other'
  when 'safety' then 'other'
  else section
end;

alter table public.consolidated_doc_chunks
  add constraint consolidated_doc_chunks_section_check
  check (section in (
    'troubleshooting','cleaning','calibration','verification','inspection',
    'electrical','configuration','consumable','component','preventive',
    'corrective','data_quality','install_improve','software','other'
  ));

-- ---- 3. Remap "## <section>" headers inside stored markdown ----
update public.consolidated_docs set content_markdown =
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
    content_markdown,
    '(?im)^##\s+spares\b',    '## consumable',   'g'),
    '(?im)^##\s+ppm\b',       '## preventive',   'g'),
    '(?im)^##\s+wiring\b',    '## electrical',   'g'),
    '(?im)^##\s+manual\b',    '## other',        'g'),
    '(?im)^##\s+install\b',   '## other',        'g'),
    '(?im)^##\s+datasheet\b', '## other',        'g'),
    '(?im)^##\s+safety\b',    '## other',        'g')
where content_markdown is not null;

commit;
