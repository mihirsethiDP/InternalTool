-- =============================================================
-- Migration 049: sections are validated against the table, not a frozen list
--
-- Approving into an admin-added section failed with
--   violates check constraint "document_submissions_target_section_check"
-- because two CHECK constraints still froze the nine original keys (031).
-- 046-048 made the section list data-driven everywhere in the app; the
-- database was the last place still holding a hard-coded copy.
--
-- consolidated_doc_chunks.section carries the SAME frozen list. It isn't what
-- the admin hit first, but it would have failed a step later when the approved
-- content is indexed — so a section could be approved and then never be
-- searchable. Both are replaced here.
--
-- A foreign key says the real rule ("must be a section that exists") and needs
-- no migration when the next category is added:
--   * submissions: ON DELETE SET NULL — losing a type shouldn't delete the
--     submission, it just loses its pre-filled target.
--   * chunks: default RESTRICT — a type with indexed content cannot be
--     deleted out from under it, which is what the Admin panel already tells
--     the user ("in use by existing documents").
-- =============================================================
begin;

-- Safety: every value in use must already exist as a type, or the FK fails.
insert into public.document_types (key, label, scope, default_section, sort_order)
select v.k, initcap(replace(v.k, '_', ' ')), 'general', v.k, 900
from (
  select distinct target_section as k from public.document_submissions where target_section is not null
  union
  select distinct section as k from public.consolidated_doc_chunks
) v
where not exists (select 1 from public.document_types t where t.key = v.k)
on conflict (key) do nothing;

alter table public.document_submissions
  drop constraint if exists document_submissions_target_section_check;
alter table public.document_submissions
  drop constraint if exists document_submissions_target_section_fkey;
alter table public.document_submissions
  add constraint document_submissions_target_section_fkey
  foreign key (target_section) references public.document_types(key)
  on update cascade on delete set null;

alter table public.consolidated_doc_chunks
  drop constraint if exists consolidated_doc_chunks_section_check;
alter table public.consolidated_doc_chunks
  drop constraint if exists consolidated_doc_chunks_section_fkey;
alter table public.consolidated_doc_chunks
  add constraint consolidated_doc_chunks_section_fkey
  foreign key (section) references public.document_types(key)
  on update cascade;

commit;
