-- Migration 007a: real POC catalog — makes + models only
-- Run this FIRST. Then 007b, then 007c.
begin;

delete from public.document_chunks
  where document_id in (select id from public.documents where storage_path is null);
delete from public.documents where storage_path is null;
delete from public.plant_sensors;
delete from public.sensor_models;
delete from public.sensor_makes;

insert into public.sensor_makes (name) values
  ('Advance Analytik'),
  ('UPC'),
  ('Brotek');

insert into public.sensor_models (make_id, category_id, model_no, name, vendor_url) values
  ((select id from public.sensor_makes where name='Advance Analytik'),
   (select id from public.sensor_categories where name='Water Quality'),
   'VizSens-ODO', 'Optical Dissolved Oxygen Sensor', null),
  ((select id from public.sensor_makes where name='Advance Analytik'),
   (select id from public.sensor_categories where name='Water Quality'),
   'VizSens-pH (Analog)', 'pH Sensor', null),
  ((select id from public.sensor_makes where name='Advance Analytik'),
   (select id from public.sensor_categories where name='Water Quality'),
   'VizSens-ORP (Analog)', 'ORP Sensor', null),
  ((select id from public.sensor_makes where name='Advance Analytik'),
   (select id from public.sensor_categories where name='Water Quality'),
   'VizSens-EC (Analog)', 'Conductivity Sensor', null),
  ((select id from public.sensor_makes where name='Advance Analytik'),
   (select id from public.sensor_categories where name='Water Quality'),
   'VizSens-TDS (Analog)', 'TDS Sensor', null),
  ((select id from public.sensor_makes where name='UPC'),
   (select id from public.sensor_categories where name='Flow'),
   'UPCS-MAG-110', 'Electromagnetic Flow Meter', null),
  ((select id from public.sensor_makes where name='UPC'),
   (select id from public.sensor_categories where name='Water Quality'),
   'UPC-WA-202', 'Water Analyzer / OCEMS (multi-parameter)', null),
  ((select id from public.sensor_makes where name='Brotek'),
   (select id from public.sensor_categories where name='Level'),
   'BT-UL', 'Ultrasonic Level Meter',
   'https://www.brotekswitch.com/ultrasonic-level-transmitter-with-4-to-20-ma-output/');

commit;

select 'makes' as t, count(*) from public.sensor_makes
union all select 'models', count(*) from public.sensor_models;
