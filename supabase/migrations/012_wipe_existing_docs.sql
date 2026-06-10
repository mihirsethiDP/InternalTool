-- =============================================================
-- Migration 012: clean slate — wipe seeded and uploaded documents
--
-- ⚠️ DESTRUCTIVE. Run only after you're ready to start fresh under the
-- new maker-checker workflow. Sensor catalog (makes / models / categories)
-- is preserved.
--
-- What gets wiped:
--   - All document_chunks
--   - All documents (both seeded and real uploads)
--   - All Storage objects under the `documents` bucket
--   - Any existing submissions (in case of partial state)
--   - Any existing consolidated_docs (rebuilt as you re-upload)
--
-- After running, the catalog still has the 8 sensors and 3 makes,
-- but every consolidated doc starts empty and your team rebuilds
-- via the new maker-checker flow.
-- =============================================================
begin;

-- 1. App-level data
delete from public.consolidated_doc_chunks;
delete from public.consolidated_docs;
delete from public.document_submissions;
delete from public.document_chunks;
delete from public.documents;

-- 2. Files in Storage
delete from storage.objects where bucket_id = 'documents';

commit;

-- Verify (everything except sensor catalog should be 0)
select 'documents' as t, count(*) from public.documents
union all select 'document_chunks', count(*) from public.document_chunks
union all select 'document_submissions', count(*) from public.document_submissions
union all select 'consolidated_docs', count(*) from public.consolidated_docs
union all select 'consolidated_doc_chunks', count(*) from public.consolidated_doc_chunks
union all select 'storage objects (documents bucket)', count(*) from storage.objects where bucket_id='documents'
union all select 'sensor models (kept)', count(*) from public.sensor_models
union all select 'sensor makes (kept)', count(*) from public.sensor_makes;
