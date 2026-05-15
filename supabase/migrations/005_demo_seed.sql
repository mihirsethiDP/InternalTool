-- =============================================================
-- Migration 005: demo seed
-- - Wipes existing makes + models
-- - Seeds 4 makes, 4 models
-- - Creates 1 demo plant with 3 equipment and 4 linked sensors
-- - Creates 17 dummy documents (general + plant-specific) with
--   realistic searchable text in document_chunks, so search-within-doc
--   queries work without needing actual PDF uploads.
-- Idempotent: re-running deletes all dummy data (storage_path IS NULL)
-- and re-inserts. Real uploads (which always have storage_path) survive.
-- =============================================================
begin;

-- 1. Cleanup dummy data + old catalog
delete from public.document_chunks
  where document_id in (select id from public.documents where storage_path is null);
delete from public.documents where storage_path is null;
delete from public.plant_sensors
  where sensor_model_id in (select id from public.sensor_models);
delete from public.sensor_models;
delete from public.sensor_makes;

-- 2. Makes
insert into public.sensor_makes (name) values
  ('Siemens'),
  ('Brotek'),
  ('UPC'),
  ('Forbes Marshall');

-- 3. Models — each tied to a make and a category
insert into public.sensor_models (make_id, category_id, model_no, name, vendor_url) values
  ((select id from public.sensor_makes where name='Brotek'),
   (select id from public.sensor_categories where name='Level'),
   'UT 116', 'Ultrasonic Level Transmitter',
   'https://www.brotek.com'),
  ((select id from public.sensor_makes where name='Forbes Marshall'),
   (select id from public.sensor_categories where name='Flow'),
   'FM 456', 'Electromagnetic Flow Meter',
   'https://www.forbesmarshall.com'),
  ((select id from public.sensor_makes where name='UPC'),
   (select id from public.sensor_categories where name='Level'),
   'LK 489', 'Hydrostatic Level Transmitter',
   'https://www.upcindia.com'),
  ((select id from public.sensor_makes where name='Siemens'),
   (select id from public.sensor_categories where name='Pressure'),
   'PT 689', 'Pressure Transmitter',
   'https://www.siemens.com');

-- 4. Demo plant
insert into public.plants (name, location)
values ('STP Aurangabad', 'Aurangabad, Maharashtra')
on conflict (name) do nothing;

-- 5. Equipment
insert into public.equipment (plant_id, name)
select (select id from public.plants where name='STP Aurangabad'), v
from (values ('Aeration Tank'), ('Filter Feed Pump'), ('Sludge Sump')) as e(v)
on conflict (plant_id, name) do nothing;

-- 6. Link sensors to plant + equipment
insert into public.plant_sensors (plant_id, sensor_model_id, equipment_id) values
  ((select id from public.plants where name='STP Aurangabad'),
   (select id from public.sensor_models where model_no='UT 116'),
   (select id from public.equipment where name='Aeration Tank' and plant_id=(select id from public.plants where name='STP Aurangabad'))),
  ((select id from public.plants where name='STP Aurangabad'),
   (select id from public.sensor_models where model_no='LK 489'),
   (select id from public.equipment where name='Sludge Sump' and plant_id=(select id from public.plants where name='STP Aurangabad'))),
  ((select id from public.plants where name='STP Aurangabad'),
   (select id from public.sensor_models where model_no='FM 456'),
   (select id from public.equipment where name='Filter Feed Pump' and plant_id=(select id from public.plants where name='STP Aurangabad'))),
  ((select id from public.plants where name='STP Aurangabad'),
   (select id from public.sensor_models where model_no='PT 689'),
   (select id from public.equipment where name='Filter Feed Pump' and plant_id=(select id from public.plants where name='STP Aurangabad')));

-- ===========================================================
-- 7. General (sensor-catalog) documents
-- ===========================================================
-- Helper macros via CTEs: pull type_id, model_id once.
-- Each insert: documents row → then chunks row(s).

-- ----- Brotek UT 116 -----
insert into public.documents (title, type_id, sensor_model_id, vendor_url, page_count, size_bytes)
values
  ('Brotek UT 116 — Sensor Manual',
   (select id from public.document_types where key='sensor_manual'),
   (select id from public.sensor_models where model_no='UT 116'),
   'https://www.brotek.com', 1, 0),
  ('Brotek UT 116 — Installation Guide',
   (select id from public.document_types where key='installation_guide'),
   (select id from public.sensor_models where model_no='UT 116'),
   'https://www.brotek.com', 1, 0),
  ('Brotek UT 116 — Troubleshooting Steps',
   (select id from public.document_types where key='troubleshooting'),
   (select id from public.sensor_models where model_no='UT 116'),
   'https://www.brotek.com', 1, 0),
  ('Brotek UT 116 — Technical Data Sheet',
   (select id from public.document_types where key='datasheet'),
   (select id from public.sensor_models where model_no='UT 116'),
   'https://www.brotek.com', 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
  ((select id from public.documents where title='Brotek UT 116 — Sensor Manual'), 1,
   'The Brotek UT 116 is an ultrasonic level transmitter designed for non-contact continuous level measurement of liquids in storage tanks, aeration basins, sumps, and open channels at wastewater treatment plants. Measuring range 0.3 m to 10 m with an accuracy of plus or minus 0.25 percent of full scale. The sensor uses a 70 kHz transducer with a 6-degree beam angle for tight focus in narrow tanks. Power supply 24 VDC, 4-20 mA loop-powered output with HART communication. Operating temperature minus 20 to plus 70 degrees Celsius. IP68 protection.'),
  ((select id from public.documents where title='Brotek UT 116 — Installation Guide'), 1,
   'Mount the UT 116 vertically above the medium with a minimum distance of 30 cm from the sensor face to the highest expected liquid level. Use the supplied 1.5 inch BSP mounting bracket. Avoid mounting near the tank inlet or in line with falling liquid that may create turbulence. For the aeration tank application, mount the sensor at least one meter away from any agitator or aerator. Connect 24 VDC supply to terminals 1 (+) and 2 (-). The 4-20 mA output appears on terminals 3 and 4. Calibration is performed using the LCD menu: Setup, Empty Distance, Full Distance.'),
  ((select id from public.documents where title='Brotek UT 116 — Troubleshooting Steps'), 1,
   'ERR-01 indicates echo loss. The sensor cannot detect a return ultrasonic pulse. Check that the sensor face is clean and free of foam, condensation, or debris. Verify that the mounting is rigid and the sensor is not tilted more than 2 degrees. ERR-02 indicates a temperature out-of-range condition; the sensor will not measure reliably above 70 degrees Celsius or below minus 20 degrees Celsius. ERR-03 indicates a power supply problem; verify 24 VDC at terminals 1 and 2. If readings fluctuate erratically, enable the damping filter through the menu: set damping to 5 seconds for typical wastewater applications. For turbulent surfaces, increase damping to 10 to 15 seconds. To restore factory defaults, hold the SET button for 10 seconds.'),
  ((select id from public.documents where title='Brotek UT 116 — Technical Data Sheet'), 1,
   'Measuring principle ultrasonic time-of-flight. Frequency 70 kHz. Beam angle 6 degrees. Process connection 1.5 inch BSP threaded. Cable length 5 m standard, up to 30 m optional. Output signal 4-20 mA with HART. Resolution 1 mm. Repeatability plus or minus 0.1 percent. Power 24 VDC, 30 mA. Housing PBT with stainless steel mounting hardware. Ambient temperature operating range minus 20 to 70 C. Storage temperature minus 40 to 85 C. Approvals CE, ATEX zone 2 optional. Weight 1.2 kg.');

-- ----- Forbes Marshall FM 456 -----
insert into public.documents (title, type_id, sensor_model_id, vendor_url, page_count, size_bytes)
values
  ('Forbes Marshall FM 456 — Sensor Manual',
   (select id from public.document_types where key='sensor_manual'),
   (select id from public.sensor_models where model_no='FM 456'),
   'https://www.forbesmarshall.com', 1, 0),
  ('Forbes Marshall FM 456 — Installation Guide',
   (select id from public.document_types where key='installation_guide'),
   (select id from public.sensor_models where model_no='FM 456'),
   'https://www.forbesmarshall.com', 1, 0),
  ('Forbes Marshall FM 456 — Troubleshooting Steps',
   (select id from public.document_types where key='troubleshooting'),
   (select id from public.sensor_models where model_no='FM 456'),
   'https://www.forbesmarshall.com', 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
  ((select id from public.documents where title='Forbes Marshall FM 456 — Sensor Manual'), 1,
   'The Forbes Marshall FM 456 is an electromagnetic flow meter suitable for measuring conductive liquids in wastewater treatment processes including raw sewage, treated effluent, and chemically dosed lines. Nominal pipe sizes DN 50 to DN 1000. Liner material EPDM or PTFE. Electrode material 316L stainless steel or Hastelloy. Accuracy plus or minus 0.5 percent of measured value above 1 m per second. The meter requires a minimum upstream straight run of 5 pipe diameters and downstream of 3 pipe diameters for accurate measurement. Output 4-20 mA plus pulse plus Modbus RTU. Power supply 90 to 250 VAC.'),
  ((select id from public.documents where title='Forbes Marshall FM 456 — Installation Guide'), 1,
   'Install the FM 456 flow meter in a horizontal or vertical pipe section ensuring the pipe is always full of liquid. Avoid installing immediately after pumps, elbows, valves, or pipe reductions; maintain the recommended 5D upstream and 3D downstream straight pipe runs. Ensure that the meter is grounded properly using the supplied grounding rings, especially for non-conducting pipes. The flow direction arrow on the meter body must align with the actual flow direction. Make electrical connections using shielded cable; terminate the shield at the meter only.'),
  ((select id from public.documents where title='Forbes Marshall FM 456 — Troubleshooting Steps'), 1,
   'No flow reading despite known flow: check that the pipe is completely full and the meter is grounded with the grounding rings installed. Erratic readings often indicate poor grounding or air entrainment in the line; bleed the line and verify ground continuity. Display error E1 indicates empty pipe detection; check the empty pipe threshold parameter or actual liquid level. Display error E2 indicates electrode short or open circuit; inspect electrodes for buildup or coating. For low-conductivity liquids below 5 microSiemens per cm, contact Forbes Marshall service.');

-- ----- UPC LK 489 -----
insert into public.documents (title, type_id, sensor_model_id, vendor_url, page_count, size_bytes)
values
  ('UPC LK 489 — Sensor Manual',
   (select id from public.document_types where key='sensor_manual'),
   (select id from public.sensor_models where model_no='LK 489'),
   'https://www.upcindia.com', 1, 0),
  ('UPC LK 489 — Technical Data Sheet',
   (select id from public.document_types where key='datasheet'),
   (select id from public.sensor_models where model_no='LK 489'),
   'https://www.upcindia.com', 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
  ((select id from public.documents where title='UPC LK 489 — Sensor Manual'), 1,
   'The UPC LK 489 is a submersible hydrostatic level transmitter for continuous level measurement of water and wastewater. The transmitter is fully submersible to 50 m water depth. Ranges available 0 to 5 m, 0 to 10 m, 0 to 20 m water column. The sensing diaphragm is 316L stainless steel with a ceramic capacitive cell. The vented cable design compensates automatically for atmospheric pressure changes. Operating temperature 0 to 60 degrees Celsius. Output 4-20 mA two-wire loop, optionally with RS-485 Modbus.'),
  ((select id from public.documents where title='UPC LK 489 — Technical Data Sheet'), 1,
   'Measuring principle: hydrostatic pressure with capacitive ceramic cell. Accuracy 0.25 percent of full scale. Long-term stability 0.1 percent per year. Power 12 to 30 VDC. Output 4-20 mA. Materials wetted parts 316L SS, Hastelloy C optional for aggressive chemistry. Cable PE-Polyurethane sheathed, standard length 10 m, custom up to 100 m. Approvals IP68, CE, ATEX zone 0 optional. Calibration procedure: install in known reference depth, zero the output, verify span.');

-- ----- Siemens PT 689 -----
insert into public.documents (title, type_id, sensor_model_id, vendor_url, page_count, size_bytes)
values
  ('Siemens PT 689 — Sensor Manual',
   (select id from public.document_types where key='sensor_manual'),
   (select id from public.sensor_models where model_no='PT 689'),
   'https://www.siemens.com', 1, 0),
  ('Siemens PT 689 — Installation Guide',
   (select id from public.document_types where key='installation_guide'),
   (select id from public.sensor_models where model_no='PT 689'),
   'https://www.siemens.com', 1, 0),
  ('Siemens PT 689 — Troubleshooting Steps',
   (select id from public.document_types where key='troubleshooting'),
   (select id from public.sensor_models where model_no='PT 689'),
   'https://www.siemens.com', 1, 0),
  ('Siemens PT 689 — Technical Data Sheet',
   (select id from public.document_types where key='datasheet'),
   (select id from public.sensor_models where model_no='PT 689'),
   'https://www.siemens.com', 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
  ((select id from public.documents where title='Siemens PT 689 — Sensor Manual'), 1,
   'The Siemens PT 689 is a gauge pressure transmitter for liquid and gas process measurement. Ranges from 0 to 100 mbar up to 0 to 600 bar. Wetted parts 316L stainless steel diaphragm with optional gold-plated overlay for hydrogen service. The transmitter accepts a wide power supply 10.5 to 45 VDC and provides 4-20 mA HART communication output. Local LCD displays primary value and 3-button operation allows full configuration on site. The PT 689 is suitable for filter feed pump discharge pressure monitoring on the filter feed pump skid.'),
  ((select id from public.documents where title='Siemens PT 689 — Installation Guide'), 1,
   'Install the PT 689 with the process connection oriented downward for liquid service to avoid trapping air at the diaphragm. For high-temperature service above 80 degrees Celsius, use a cooling element or remote diaphragm seal. Mount on the filter feed pump discharge using a 0.5 inch NPT process connection. Provide a shutoff valve and impulse line for service. Electrical connection: M20 cable gland, terminals 1 and 2 for the 4-20 mA loop. Earth the housing to plant ground.'),
  ((select id from public.documents where title='Siemens PT 689 — Troubleshooting Steps'), 1,
   'If the output is stuck at 4 mA, verify loop power supply voltage at the transmitter terminals; minimum 10.5 VDC required. Output stuck at 20 mA indicates that the measured pressure exceeds the configured upper range value; check the actual process pressure and reconfigure the URV if needed. Negative drift on the zero reading often indicates a clogged impulse line; flush the impulse line with clean water and re-zero. HART communication failure: verify a minimum loop resistance of 250 ohms in the loop, otherwise the HART signal cannot be modulated. To perform a zero calibration, depress the Z button for 3 seconds with the transmitter at zero pressure.'),
  ((select id from public.documents where title='Siemens PT 689 — Technical Data Sheet'), 1,
   'Accuracy reference 0.075 percent of span. Long-term stability 0.1 percent per year. Span turndown 100 to 1. Output 4-20 mA HART. Power 10.5 to 45 VDC. Process temperature minus 40 to 125 degrees Celsius standard. Materials 316L SS housing, FKM seal, Hastelloy C diaphragm optional. Approvals CE, ATEX, IECEx. Weight 1.5 kg. Process connection 0.5 inch NPT male standard.');

-- ===========================================================
-- 8. Plant-specific documents for STP Aurangabad
-- ===========================================================
insert into public.documents (title, type_id, plant_id, page_count, size_bytes) values
  ('STP Aurangabad — Handover Document',
   (select id from public.document_types where key='handover'),
   (select id from public.plants where name='STP Aurangabad'), 1, 0),
  ('STP Aurangabad — Input Output List',
   (select id from public.document_types where key='io_list'),
   (select id from public.plants where name='STP Aurangabad'), 1, 0),
  ('STP Aurangabad — P&ID Drawing',
   (select id from public.document_types where key='p_and_id'),
   (select id from public.plants where name='STP Aurangabad'), 1, 0),
  ('STP Aurangabad — Warranty Certificate',
   (select id from public.document_types where key='warranty_certificate'),
   (select id from public.plants where name='STP Aurangabad'), 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
  ((select id from public.documents where title='STP Aurangabad — Handover Document'), 1,
   'This handover document certifies that the Sewage Treatment Plant at Aurangabad has been commissioned and accepted by the client. All process equipment has been functionally tested and meets the design intent. The aeration tank, filter feed pump skid, and sludge sump are operational with installed instrumentation. Mechanical, electrical, and instrumentation handover signed off by site engineer and client representative on the date of acceptance. Operation and maintenance manuals have been delivered. Spare parts list and recommended preventive maintenance schedules are appended.'),
  ((select id from public.documents where title='STP Aurangabad — Input Output List'), 1,
   'I/O list for STP Aurangabad PLC system. Analog inputs: AI-01 Aeration Tank Level Brotek UT 116 4-20mA, AI-02 Sludge Sump Level UPC LK 489 4-20mA, AI-03 Filter Feed Pump Flow Forbes Marshall FM 456 4-20mA, AI-04 Filter Feed Pump Discharge Pressure Siemens PT 689 4-20mA. Digital inputs: DI-01 to DI-12 motor run feedback, valve limit switches, emergency stop. Analog outputs: AO-01 blower VFD speed reference, AO-02 dosing pump stroke. Digital outputs: DO-01 to DO-16 motor start commands, valve solenoids, alarm horns.'),
  ((select id from public.documents where title='STP Aurangabad — P&ID Drawing'), 1,
   'Process and Instrumentation Diagram for STP Aurangabad. Sheet 1 of 2 covers preliminary treatment, primary settling, and aeration. Equipment tags include AT-01 aeration tank, FFP-01 filter feed pump, SS-01 sludge sump. Instrumentation tags include LT-101 aeration tank level transmitter Brotek UT 116, FT-101 filter feed pump flow meter Forbes Marshall FM 456, PT-101 filter feed pump discharge pressure transmitter Siemens PT 689, LT-102 sludge sump level UPC LK 489. Valve and line specifications per project standard.'),
  ((select id from public.documents where title='STP Aurangabad — Warranty Certificate'), 1,
   'Digital Paani warranty certificate for STP Aurangabad. The following instrumentation is covered under our 24-month warranty from the date of plant handover: Brotek UT 116 ultrasonic level transmitter installed on the Aeration Tank, UPC LK 489 hydrostatic level transmitter installed on the Sludge Sump, Forbes Marshall FM 456 electromagnetic flow meter installed on the Filter Feed Pump line, and Siemens PT 689 pressure transmitter installed on the Filter Feed Pump discharge. The warranty covers manufacturing defects and includes onsite support response within 48 hours. Calibration certificates for each sensor are filed under the plant test certificates folder.');

commit;

-- Verification
select 'makes' as t, count(*) from public.sensor_makes
union all select 'models', count(*) from public.sensor_models
union all select 'plants', count(*) from public.plants
union all select 'equipment', count(*) from public.equipment
union all select 'plant_sensors', count(*) from public.plant_sensors
union all select 'documents (demo)', count(*) from public.documents where storage_path is null
union all select 'chunks', count(*) from public.document_chunks;
