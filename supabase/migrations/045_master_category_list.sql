-- =============================================================
-- Migration 045: the master category list
--
-- Loads DigitalPaani's 48-category master taxonomy (Digital_Paani
-- Category List.xlsx, "Master Category" sheet) into sensor_categories:
--   * Category   -> name (rendered readably: PH -> pH, IO_LIST -> I/O List)
--   * Remarks    -> "group" (the column already exists, unused until now)
--   * Sub-Categories -> aliases[] (NEW column)
--
-- Aliases are working data, not documentation: they feed the spell-tolerance
-- lexicon and the chat's category routing, so "EC sensor" or "MLSS probe"
-- resolves to the right category without anyone typing its formal name.
--
-- Existing categories are RENAMED, never replaced, where the master list is
-- unambiguously the same thing — renaming keeps the id, and therefore keeps
-- OCEMS and MAG-110 attached to their documents and flows.
-- 'Maintenance & Safety' and 'Other' aren't in the master list; they are left
-- untouched rather than silently deleted.
-- =============================================================
begin;

alter table public.sensor_categories
  add column if not exists aliases text[] not null default '{}';

-- ---------- 1. reconcile existing rows with the master list ----------
-- Same concept, different wording. Done BEFORE the upsert so the unique
-- name constraint doesn't create a duplicate pair.
update public.sensor_categories set name = 'VFD'                    where name = 'AC Drive';
update public.sensor_categories set name = 'Gas Detection'          where name = 'Gas Analyser';
update public.sensor_categories set name = 'Water Quality Analyser' where name = 'Water Quality';
-- 'Level', 'Flow' and 'Pressure' already match the master list by name.

-- ---------- 2. upsert the 48 master categories ----------
insert into public.sensor_categories (name, "group", aliases) values
  ('Level',                    'Instrumentation', array['Ultrasonic Level','Radar Level','Hydrostatic Level','Level Transmitter','Level Switch','Float']),
  ('Flow',                     'Instrumentation', array['Electromagnetic Flow Meter','Ultrasonic Flow Meter','Magnetic Flow Meter','Flow Transmitter','Flow Switch','Magmeter']),
  ('Pressure',                 'Instrumentation', array['Pressure Transmitter','Pressure Switch','Pressure Gauge','Vacuum Transmitter','Vacuum Gauge']),
  ('pH',                       'Instrumentation', array['pH Sensor','pH Transmitter','pH Analyzer','pH Controller','pH probe','pH electrode']),
  ('ORP',                      'Instrumentation', array['ORP Sensor','ORP Transmitter','ORP Analyzer','Redox']),
  ('Dissolved Oxygen (DO)',    'Instrumentation', array['DO Sensor','DO Transmitter','DO Analyzer','Dissolved Oxygen','DO probe']),
  ('Conductivity / EC',        'Instrumentation', array['Conductivity Sensor','EC Sensor','Conductivity Transmitter','Conductivity Analyzer','TDS']),
  ('Turbidity',                'Instrumentation', array['Turbidity Sensor','Turbidity Transmitter','Turbidity Analyzer','NTU']),
  ('TSS / MLSS',               'Instrumentation', array['TSS Sensor','MLSS Sensor','Suspended Solids Analyzer','TSS Transmitter','Suspended Solids']),
  ('COD',                      'Instrumentation', array['COD Analyzer','COD Sensor','COD Transmitter','Chemical Oxygen Demand']),
  ('BOD',                      'Instrumentation', array['BOD Analyzer','BOD Sensor','BOD Transmitter','Biochemical Oxygen Demand']),
  ('Chlorine',                 'Instrumentation', array['Free Chlorine','Total Chlorine','Residual Chlorine','Chlorine Analyzer']),
  ('Temperature',              'Instrumentation', array['PT100','RTD','Temperature Sensor','Temperature Transmitter','Thermocouple']),
  ('Gas Detection',            'Instrumentation', array['H2S','CH4','O2','CO','CO2','Multi Gas Detector','Gas Sensor']),
  ('Water Quality Analyser',   'Instrumentation', array['Multi Parameter Analyzer','Online Water Quality Analyzer','Water Quality Controller','OCEMS','CEMS']),
  ('Energy Meter',             'Instrumentation', array['Single Phase Energy Meter','Three Phase Energy Meter','Multifunction Energy Meter','Modbus Energy Meter']),
  ('CT / PT',                  'Instrumentation', array['Current Transformer','Potential Transformer','CT Selection','CT/PT Wiring']),
  ('Switches (Float / Level / Pressure / Flow)', 'Instrumentation', array['Float Switch','Level Switch','Pressure Switch','Flow Switch','Limit Switch','Digital Sensor Switch']),
  ('Proximity',                'Instrumentation', array['Inductive','Capacitive','Magnetic','Proximity Switch','Proximity Sensor']),
  ('Position',                 'Instrumentation', array['Position Sensor','Limit Switch','Linear Position','Rotary Position']),
  ('Vibration',                'Instrumentation', array['Vibration Sensor','Vibration Transmitter','Vibration Monitor']),
  ('Load Cell / Weighing',     'Instrumentation', array['Load Cell','Weight Transmitter','Weight Indicator','Weighing System']),
  ('Indicator / Display',      'Instrumentation', array['Digital Indicator','Panel Meter','Process Display','Digital Display']),
  ('Modbus / RS485',           'Instrumentation', array['Modbus RTU','RS485','Register Maps','Slave Address','Communication Settings']),
  ('Ethernet / Modbus TCP',    'Instrumentation', array['Ethernet Devices','Modbus TCP','TCP/IP','Network Configuration']),
  ('PLC',                      'PLC',             array['General PLC','PLC User Manual','PLC Catalogue']),
  ('HMI',                      'HMI',             array['General HMI','HMI User Manual','HMI Catalogue','Touch Panel']),
  ('VFD',                      'VFD',             array['General VFD','VFD User Manual','VFD Catalogue','Variable Frequency Drive','AC Drive','Inverter']),
  ('Control Panel',            'Electrical Panel & Control', array['Control Panel','Control BOM','Control Wiring']),
  ('Marshalling Panel',        'Electrical Panel & Control', array['Marshalling Panel','Terminal Arrangement','Wiring']),
  ('VFD Panel',                'Electrical Panel & Control', array['VFD Panel','VFD BOM','VFD Wiring']),
  ('PLC Panel',                'Electrical Panel & Control', array['PLC Panel']),
  ('Overload Relay',           'Electrical Panel & Control', array['OLR Manuals','Selection','Settings','Overload Relay']),
  ('Soft Starter',             'Electrical Panel & Control', array['Soft Starter Manuals','Parameters','Wiring']),
  ('Star-Delta Starter',       'Electrical Panel & Control', array['Star Delta Starter','Timer','Wiring']),
  ('DOL Starter',              'Electrical Panel & Control', array['DOL Starter','Contactor','OLR','Wiring']),
  ('Surge Protection',         'Electrical Panel & Control', array['SPD','Surge Protector','Selection','Wiring']),
  ('I/O List',                 'Drawing & Engineering',      array['DI','DO','AI','AO','Modbus','I/O Master List']),
  ('FAT',                      'Testing & Commissioning',    array['FAT Procedure','FAT Checklist','FAT Report','Factory Acceptance Test']),
  ('SAT',                      'Testing & Commissioning',    array['SAT Procedure','SAT Checklist','SAT Report','Site Acceptance Test']),
  ('Loop Check',               'Testing & Commissioning',    array['Loop Check Procedure','Loop Check Report']),
  ('I/O Check',                'Testing & Commissioning',    array['I/O Check','I/O Test Report']),
  ('Sensor Testing',           'Testing & Commissioning',    array['Sensor Test Cases','Calibration','Verification']),
  ('Panel Testing',            'Testing & Commissioning',    array['Panel Inspection','Continuity','Megger','Functional Test']),
  ('Calibration Certificate',  'General Documentation',      array['Calibration Certificates','Traceability']),
  ('Technical Reference',      'General Documentation',      array['Technical References','Engineering Guides']),
  ('Training Material',        'General Documentation',      array['Training Manuals','Tutorials','Training Presentations']),
  ('General Reference',        'General Documentation',      array['General Technical Documents','Reference Material'])
on conflict (name) do update
  set "group" = excluded."group",
      aliases = excluded.aliases;

-- ---------- 3. every category needs its "general guidance" entry ----------
-- Category-scoped uploads attach to it; without one the upload form errors.
insert into public.sensor_models (make_id, category_id, model_no, name, is_general)
select null, c.id, 'General — ' || c.name, 'General ' || c.name || ' guidance', true
from public.sensor_categories c
where not exists (
  select 1 from public.sensor_models sm
  where sm.category_id = c.id and sm.is_general = true
);

commit;
