-- =============================================================
-- Migration 033: FRESH LAUNCH — wipe all data, keep schema + config
--
-- ⚠️ DESTRUCTIVE. Empties the tool for a clean launch while leaving every
-- feature intact. Run once, then run scripts/wipe-storage.mjs to clear the
-- uploaded files.
--
-- KEEPS: schema, functions, RLS, Edge Function; user accounts (profiles);
--   sensor CATEGORIES + their synthetic 'general' sensor_models (is_general);
--   DOCUMENT TYPES; the domain SYNONYM dictionary.
-- WIPES: all real sensors + makes, all documents & consolidated content
--   (docs/chunks/revisions), submissions, routing rules, plants/equipment,
--   and all telemetry (feedback, unanswered queries, tickets, usage events,
--   notifications).
--
-- Ordered deletes (children before parents) to respect FKs.
-- =============================================================
begin;

-- Telemetry / activity
delete from public.notifications;
delete from public.answer_feedback;
delete from public.unanswered_queries;
delete from public.support_tickets;
delete from public.usage_events;

-- Router layer
delete from public.routing_rules;

-- Consolidated content (revisions → chunks → docs)
delete from public.consolidated_doc_revisions;
delete from public.consolidated_doc_chunks;
delete from public.consolidated_docs;

-- Submissions + legacy document tables
delete from public.document_submissions;
delete from public.document_chunks;
delete from public.documents;

-- Operational data: plants cascade to plant_sensors, plant_plcs, equipment
delete from public.plants;

-- Sensor catalog: drop the real models + makes; KEEP the per-category
-- 'general' entries so category-level guidance still has a home.
delete from public.sensor_models where is_general = false;
delete from public.sensor_makes;

commit;
