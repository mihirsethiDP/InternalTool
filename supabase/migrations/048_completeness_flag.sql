-- =============================================================
-- Migration 048: which sections count as "documented"
--
-- Completeness was the eight activity sections, hard-coded — so "Technical
-- Data Sheet" (added in Admin) could be fully populated and the sensor still
-- read as incomplete. Requested: spec sheets should count.
--
-- Rather than hard-code a tenth key, each section now carries the flag, so
-- the next section an admin adds decides its own answer.
--
-- NOTE: this changes the DENOMINATOR. A sensor previously "3 of 8" becomes
-- "3 of 9" until its datasheet section is filled — existing percentages move,
-- which is the point of the change, not a bug.
-- =============================================================
begin;

alter table public.document_types
  add column if not exists counts_toward_completeness boolean not null default true;

-- "Other" is the catch-all — content landing there says nothing about whether
-- the sensor is documented, so it stays out of the score (unchanged behaviour).
update public.document_types
   set counts_toward_completeness = false
 where key = 'other';

commit;
