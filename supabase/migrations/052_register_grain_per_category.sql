-- =============================================================
-- Migration 052: one device can serve several categories
--
-- Multi-parameter analysers are common in the fleet: a HACH UVAS plus sc is
-- the plant's BOD sensor AND its COD sensor; a Hemera L800 covers BOD, COD
-- and TSS; the Digital Paani BHT reports Biomass Health, DO and MLSS. The
-- register therefore needs one row per (plant, model, category), not per
-- (plant, model) — otherwise the COD row overwrites the BOD row on import.
-- =============================================================
begin;

drop index if exists public.plant_sensors_plant_model_key;

update public.plant_sensors ps
   set category_id = sm.category_id
  from public.sensor_models sm
 where sm.id = ps.sensor_model_id and ps.category_id is null;

create unique index if not exists plant_sensors_plant_model_category_key
  on public.plant_sensors (plant_id, sensor_model_id, category_id);

commit;
