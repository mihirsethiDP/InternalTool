-- =============================================================
-- Migration 046: a document type added in Admin is a real section
--
-- Migration 040 declared one taxonomy — the type an uploader picks IS the
-- activity section its content lands in — but the section list stayed
-- hard-coded in the client and the edge function. Adding "Technical Data
-- Sheet" in Admin therefore produced an upload option that the review screen
-- and the AI splitter never knew about (reported from the field).
--
-- The code now reads the list from document_types. This backfills the one
-- piece of data that made a hand-added type inconsistent: default_section,
-- which pre-fills the section at approval.
-- =============================================================
begin;

update public.document_types
   set default_section = key
 where scope = 'general'
   and default_section is null;

commit;
