-- =============================================================
-- Migration 039: connect document TYPES to approval SECTIONS
--
-- Admin usability: "why are document types different from the categorization
-- done at approval?" — Types describe the UPLOADED FILE (what it is); activity
-- sections describe WHERE its content lands in the sensor's consolidated
-- reference (what the user is trying to do). They looked like two competing
-- taxonomies because nothing connected them.
--
-- Fix: each type carries a default_section that PRE-FILLS the section choice
-- at approval (admin can still override). Editable in Admin → Document types.
-- =============================================================
begin;

alter table public.document_types
  add column if not exists default_section text;

-- Sensible defaults by key; anything unmatched stays NULL (admin decides).
update public.document_types set default_section = 'install_commission'   where default_section is null and key ilike '%install%';
update public.document_types set default_section = 'troubleshoot_repair'  where default_section is null and (key ilike '%troubleshoot%' or key ilike '%repair%');
update public.document_types set default_section = 'calibrate'            where default_section is null and key ilike '%calibrat%';
update public.document_types set default_section = 'maintenance_planning' where default_section is null and key ilike '%maintenance%';
update public.document_types set default_section = 'clean'                where default_section is null and key ilike '%clean%';
update public.document_types set default_section = 'configure'            where default_section is null and (key ilike '%config%' or key ilike '%setting%');
update public.document_types set default_section = 'other'                where default_section is null and (key ilike '%data_sheet%' or key ilike '%datasheet%' or key ilike '%spec%');

commit;
