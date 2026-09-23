-- =============================================================
-- Migration 053: routing aliases for the datalogger
--
-- Operators never say "datalogger"; they say the plant stopped sending data.
-- Aliases feed the chat's category routing, so these phrasings land on the
-- Datalogger category (and its "plant stopped reporting" flow) instead of
-- drifting to Flow.
-- =============================================================
update public.sensor_categories
   set aliases = (select array(select distinct unnest(aliases || array[
     'plant not reporting','plant stopped reporting','plant offline','data not coming','no data from plant',
     'data stopped','stopped sending data','not sending data','telemetry','cloud connection','data transmission',
     'readings not updating','dashboard not updating','site offline','PLC link','RPi','Raspberry Pi 4'
   ])))
 where name = 'Datalogger';
