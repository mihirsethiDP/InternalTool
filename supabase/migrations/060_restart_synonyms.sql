-- =============================================================
-- Migration 060: "restart / reboot" means power it off and on
--
-- Agent QA (2026-11-13): "router restart kaise kare" found nothing although
-- the Archer MR200 manual describes the POWER ON/OFF button, and the
-- datalogger/camera fixes say "unplug, wait, plug back in". One-word
-- triggers expand to the manuals' phrasing (see migration 058 for why).
-- =============================================================
insert into public.search_synonyms (terms, notes)
select ARRAY['restart','reboot','restarting','rebooting','reset','power cycle','power off','switch off','turn off','unplug','off and on','power on/off'],
       'restarting a device (operator words vs manual phrasing)'
where not exists (select 1 from public.search_synonyms where 'reboot' = any(terms) and 'power cycle' = any(terms));
