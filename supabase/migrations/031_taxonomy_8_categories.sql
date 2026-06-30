-- =============================================================
-- Migration 031: remap the 14 work-types → 8 activity categories (MECE)
--
-- Supervisor round-2 feedback: replace the overlapping 14-type taxonomy with 8
-- activity-based categories (+ 'other' kept as a catch-all). Mapping:
--   troubleshooting, corrective, data_quality   -> troubleshoot_repair
--   cleaning                                     -> clean
--   calibration, verification                    -> calibrate
--   inspection, electrical                       -> inspect
--   configuration, software                      -> configure
--   consumable, component                        -> replace
--   preventive                                   -> maintenance_planning
--   install_improve                              -> install_commission
--   other                                        -> other  (unchanged)
--
-- Remaps: consolidated_docs.content_markdown headers, consolidated_doc_chunks
-- .section, document_submissions.target_section, routing_rules.sections[], and
-- the two CHECK constraints. Existing content is preserved (old revisions remain
-- in consolidated_doc_revisions). Where two old sections merge into one new key,
-- the markdown ends up with two '## newkey' blocks — the app merges them on read
-- and consolidates them on the next edit.
-- =============================================================
begin;

-- ---------- 0. Drop the old CHECK constraints so updates can proceed ----------
alter table public.document_submissions drop constraint if exists document_submissions_target_section_check;
alter table public.consolidated_doc_chunks drop constraint if exists consolidated_doc_chunks_section_check;

-- ---------- 1. Rewrite the markdown section headers (one rename per old key) ----------
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+troubleshooting[ \t]*$', '## troubleshoot_repair', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+corrective[ \t]*$',      '## troubleshoot_repair', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+data_quality[ \t]*$',    '## troubleshoot_repair', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+cleaning[ \t]*$',        '## clean', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+calibration[ \t]*$',     '## calibrate', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+verification[ \t]*$',    '## calibrate', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+inspection[ \t]*$',      '## inspect', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+electrical[ \t]*$',      '## inspect', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+configuration[ \t]*$',   '## configure', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+software[ \t]*$',        '## configure', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+consumable[ \t]*$',      '## replace', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+component[ \t]*$',       '## replace', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+preventive[ \t]*$',      '## maintenance_planning', 'gn');
update public.consolidated_docs set content_markdown = regexp_replace(content_markdown, '^##[ \t]+install_improve[ \t]*$', '## install_commission', 'gn');

-- ---------- 2. Remap chunk section tags ----------
update public.consolidated_doc_chunks set section = case section
  when 'troubleshooting' then 'troubleshoot_repair'
  when 'corrective'      then 'troubleshoot_repair'
  when 'data_quality'    then 'troubleshoot_repair'
  when 'cleaning'        then 'clean'
  when 'calibration'     then 'calibrate'
  when 'verification'    then 'calibrate'
  when 'inspection'      then 'inspect'
  when 'electrical'      then 'inspect'
  when 'configuration'   then 'configure'
  when 'software'        then 'configure'
  when 'consumable'      then 'replace'
  when 'component'       then 'replace'
  when 'preventive'      then 'maintenance_planning'
  when 'install_improve' then 'install_commission'
  else section
end;

-- ---------- 3. Remap submission target_section ----------
update public.document_submissions set target_section = case target_section
  when 'troubleshooting' then 'troubleshoot_repair'
  when 'corrective'      then 'troubleshoot_repair'
  when 'data_quality'    then 'troubleshoot_repair'
  when 'cleaning'        then 'clean'
  when 'calibration'     then 'calibrate'
  when 'verification'    then 'calibrate'
  when 'inspection'      then 'inspect'
  when 'electrical'      then 'inspect'
  when 'configuration'   then 'configure'
  when 'software'        then 'configure'
  when 'consumable'      then 'replace'
  when 'component'       then 'replace'
  when 'preventive'      then 'maintenance_planning'
  when 'install_improve' then 'install_commission'
  else target_section
end
where target_section is not null;

-- ---------- 4. Remap routing_rules.sections[] ----------
update public.routing_rules set sections = (
  select coalesce(array_agg(distinct nk), '{}')
  from unnest(sections) s
  cross join lateral (
    select case s
      when 'troubleshooting' then 'troubleshoot_repair'
      when 'corrective'      then 'troubleshoot_repair'
      when 'data_quality'    then 'troubleshoot_repair'
      when 'cleaning'        then 'clean'
      when 'calibration'     then 'calibrate'
      when 'verification'    then 'calibrate'
      when 'inspection'      then 'inspect'
      when 'electrical'      then 'inspect'
      when 'configuration'   then 'configure'
      when 'software'        then 'configure'
      when 'consumable'      then 'replace'
      when 'component'       then 'replace'
      when 'preventive'      then 'maintenance_planning'
      when 'install_improve' then 'install_commission'
      else s
    end as nk
  ) m
);

-- ---------- 5. Re-add CHECK constraints with the new keys ----------
alter table public.document_submissions
  add constraint document_submissions_target_section_check
  check (target_section in (
    'install_commission','configure','inspect','clean','calibrate',
    'replace','troubleshoot_repair','maintenance_planning','other'
  ) or target_section is null);

alter table public.consolidated_doc_chunks
  add constraint consolidated_doc_chunks_section_check
  check (section in (
    'install_commission','configure','inspect','clean','calibrate',
    'replace','troubleshoot_repair','maintenance_planning','other'
  ));

commit;
