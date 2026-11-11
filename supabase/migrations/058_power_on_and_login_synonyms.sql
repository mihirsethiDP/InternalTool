-- =============================================================
-- Migration 058: field words for "turn it on" and "open the router page"
--
-- Replaying the questions the chatbot could not answer (2026-11-11) found two
-- vocabulary gaps between how operators ask and how manuals are written:
--   "how to start ups", "router not powering on"   vs  "Press and hold ON …
--    to power on the UPS", "Turn on the UPS"
--   "tp link ka page kaise open kre", "router main page" vs "Log into your
--    4G LTE Router", "web management page", "tplinkmodem.net"
-- Synonyms are triggered by a SINGLE word of the question and expand to the
-- listed phrases (q_to_prefix_tsquery), so each group carries one-word
-- triggers plus the manuals' phrases. Bare "on" and "power" are deliberately
-- NOT triggers: "on" is everywhere ("error on display") and "power" already
-- belongs to the power = voltage = supply group.
-- =============================================================
insert into public.search_synonyms (terms, notes)
select ARRAY['start','starting','startup','chalu','boot','booting','powering','turning','switch on','turn on','power on','power up','press and hold','powered on','switched on'],
       'turning a device on (operator words vs manual phrasing)'
where not exists (select 1 from public.search_synonyms where 'chalu' = any(terms));

insert into public.search_synonyms (terms, notes)
select ARRAY['login','logon','logging','page','webpage','website','log in','log into','web management','management page','tplinkmodem','web interface','admin page'],
       'opening a router/device web page (operator words vs manual phrasing)'
where not exists (select 1 from public.search_synonyms where 'tplinkmodem' = any(terms));
