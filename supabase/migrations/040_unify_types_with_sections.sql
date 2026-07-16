-- =============================================================
-- Migration 040: document types = approval activity sections (1:1)
--
-- Admin feedback: "match the document type selection with the selection at
-- the time of approving docs." One taxonomy now: the type an uploader picks
-- IS the activity section the content lands in at approval (pre-filled via
-- default_section; the admin can still override in edge cases).
--
-- Old file-centric types (Sensor Manual, Datasheet, …) are re-pointed to
-- their equivalent activity (via their 039 default_section, else Other) on
-- any submissions/documents referencing them, then removed.
--
-- NOTE: already applied to prod 2026-07-16 via service role (data-only).
-- Kept for repo history + fresh environments. Idempotent.
-- =============================================================
begin;

-- 1. Ensure the 9 unified rows exist (keys = activity section keys).
insert into public.document_types (key, label, scope, default_section, sort_order) values
  ('install_commission',   'Install & Commission',   'general', 'install_commission',   1),
  ('configure',            'Configure',              'general', 'configure',            2),
  ('inspect',              'Inspect',                'general', 'inspect',              3),
  ('clean',                'Clean',                  'general', 'clean',                4),
  ('calibrate',            'Calibrate',              'general', 'calibrate',            5),
  ('replace',              'Replace',                'general', 'replace',              6),
  ('troubleshoot_repair',  'Troubleshoot & Repair',  'general', 'troubleshoot_repair',  7),
  ('maintenance_planning', 'Maintenance Planning',   'general', 'maintenance_planning', 8),
  ('other',                'Other',                  'general', 'other',                9)
on conflict (key) do update
  set label = excluded.label,
      scope = excluded.scope,
      default_section = excluded.default_section,
      sort_order = excluded.sort_order;

-- 2. Re-point references from old file-centric types to their equivalent.
with old_types as (
  select id, coalesce(default_section, 'other') as section
  from public.document_types
  where scope = 'general'
    and key not in ('install_commission','configure','inspect','clean','calibrate',
                    'replace','troubleshoot_repair','maintenance_planning','other')
)
update public.document_submissions s
set type_id = nt.id
from old_types ot
join public.document_types nt on nt.key = ot.section
where s.type_id = ot.id;

with old_types as (
  select id, coalesce(default_section, 'other') as section
  from public.document_types
  where scope = 'general'
    and key not in ('install_commission','configure','inspect','clean','calibrate',
                    'replace','troubleshoot_repair','maintenance_planning','other')
)
update public.documents d
set type_id = nt.id
from old_types ot
join public.document_types nt on nt.key = ot.section
where d.type_id = ot.id;

-- 3. Remove the old rows.
delete from public.document_types
where scope = 'general'
  and key not in ('install_commission','configure','inspect','clean','calibrate',
                  'replace','troubleshoot_repair','maintenance_planning','other');

commit;
