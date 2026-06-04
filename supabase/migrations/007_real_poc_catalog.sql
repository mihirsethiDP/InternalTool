-- =============================================================
-- Migration 007: real POC catalog with actual model numbers
--
-- Replaces the placeholder catalog from 006 with the real product
-- names extracted from datasheets the user provided:
--   - Advance Analytik VizSens series (5 sensors)
--   - UPC UPCS-MAG-110 (electromagnetic flow meter)
--   - UPC UPC-WA-202 (water analyzer / OCEMS multi-parameter)
--   - Brotek BT-UL (ultrasonic level meter, from brotekswitch.com)
--
-- For each sensor: 1 Technical Data Sheet document + 1 Troubleshooting
-- Steps document, both with searchable chunk text. The Open button will
-- route to the vendor URL if no actual file is uploaded; when the user
-- uploads the real PDF, storage_path takes precedence.
-- =============================================================
begin;

-- Cleanup demo data
delete from public.document_chunks
  where document_id in (select id from public.documents where storage_path is null);
delete from public.documents where storage_path is null;
delete from public.plant_sensors;
delete from public.sensor_models;
delete from public.sensor_makes;

-- ---------- Makes ----------
insert into public.sensor_makes (name) values
  ('Advance Analytik'),
  ('UPC'),
  ('Brotek');

-- ---------- Sensor models ----------
insert into public.sensor_models (make_id, category_id, model_no, name, vendor_url) values
  -- Advance Analytik VizSens series
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
  -- UPC
  ((select id from public.sensor_makes where name='UPC'),
   (select id from public.sensor_categories where name='Flow'),
   'UPCS-MAG-110', 'Electromagnetic Flow Meter', null),
  ((select id from public.sensor_makes where name='UPC'),
   (select id from public.sensor_categories where name='Water Quality'),
   'UPC-WA-202', 'Water Analyzer / OCEMS (multi-parameter)', null),
  -- Brotek
  ((select id from public.sensor_makes where name='Brotek'),
   (select id from public.sensor_categories where name='Level'),
   'BT-UL', 'Ultrasonic Level Meter',
   'https://www.brotekswitch.com/ultrasonic-level-transmitter-with-4-to-20-ma-output/');

-- =============================================================
-- DOCUMENTS — one datasheet + one troubleshooting doc per sensor
-- Stored as searchable text in document_chunks. The user can later
-- upload the actual PDF, which will set storage_path and override
-- the vendor_url for the "Open" button.
-- =============================================================

-- Helper pattern: insert document, then chunk(s).

-- ---------- 1. VizSens-ODO ----------
insert into public.documents (title, type_id, sensor_model_id, page_count, size_bytes) values
('VizSens-ODO — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='VizSens-ODO'), 1, 0),
('VizSens-ODO — Troubleshooting Steps',
 (select id from public.document_types where key='troubleshooting'),
 (select id from public.sensor_models where model_no='VizSens-ODO'), 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
((select id from public.documents where title='VizSens-ODO — Technical Data Sheet'), 1,
 'VizSens-ODO Optical Dissolved Oxygen Sensor by Advance Analytik KFT. Uses fluorescence technology: a luminescent material on the sensor cap is excited by blue LED light and emits red light; the intensity and time of the red light indicate oxygen molecule concentration. Features include oxygen-sensitive membrane design, NTC temperature compensation, measurement without oxygen consumption or flow or stirring, breakthrough fluorescence technology, low maintenance with built-in self-diagnosis, plug-and-play installation, factory calibration with optional field calibration. Measurement range DO 0 to 20 mg/L or 0 to 200 percent saturation. Temperature range 0 to 45 degrees Celsius. Accuracy DO plus or minus 3 percent or plus or minus 0.3 mg/L of measured value. Resolution 0.01 mg/L. Repeatability plus or minus 0.3 mg/L. Pressure range up to 0.3 MPa. Body material SS316L for fresh water or Titanium alloy for ocean and marine applications. Cover polyphenylene plus glass fiber. Weight 1.4 kg. Cable length standard 10 m extendable to 100 m. Power supply DC 9 to 36 V. Communication Modbus RS485. Storage temperature -15 to 60 C.'),
((select id from public.documents where title='VizSens-ODO — Troubleshooting Steps'), 1,
 'VizSens-ODO Troubleshooting. Issue 1 — Reading drifts upward or downward over time: most common cause is build-up on the luminescent cap from biofilm, oil, or fine particulate. Action: clean the cap with mild soap and water (Alconox) or alcohol if oils are present. Never use chlorine-based cleaners or organic solvents — they bleach the fluorescent coating and shorten sensor life permanently. Issue 2 — Slow response: cap fouling reducing oxygen diffusion. Action: inspect and clean the cap; replace it if coating cannot be removed. Typical cap life is 2 years in clean water and 6 to 12 months in heavy wastewater. Issue 3 — Reading stable but offset from expected value: perform air-saturation calibration by holding the sensor in humid air for 15 minutes, then zero/span via the controller menu. Issue 4 — Temperature reading wrong: cross-check with a calibrated thermometer; if the discrepancy exceeds 1 C the NTC element has failed and the sensor needs service or replacement. Issue 5 — Output stuck at zero or full scale: loose wiring or power supply problem. Verify 9 to 36 VDC at terminals; for Modbus check RS485 A and B polarity. Issue 6 — Sudden drop in sensitivity: chlorine, ozone, or other strong oxidizers have damaged the luminescent material — replace the cap.');

-- ---------- 2. VizSens-pH (Analog) ----------
insert into public.documents (title, type_id, sensor_model_id, page_count, size_bytes) values
('VizSens-pH (Analog) — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='VizSens-pH (Analog)'), 1, 0),
('VizSens-pH (Analog) — Troubleshooting Steps',
 (select id from public.document_types where key='troubleshooting'),
 (select id from public.sensor_models where model_no='VizSens-pH (Analog)'), 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
((select id from public.documents where title='VizSens-pH (Analog) — Technical Data Sheet'), 1,
 'VizSens-pH (Analog) pH Sensor by Advance Analytik KFT. Combination electrode with glass indicating electrode and reference electrode for reliable pH measurement in water treatment, hydrological monitoring, wastewater treatment, swimming pools, fish ponds, fertilizer, chemical and biology industries. Features: good repeatability and stability suitable for fresh and sea water. Measurement range 0 to 14 pH. Simple manual cleaning. Optional analog-to-digital conversion module for digital signal output with high anti-jamming capacity. Materials: Black Polypropylene shell, Ag/AgCl reference gel. Dimensions Diameter 28.7 mm by Length 195 mm. Cable length standard 10 m, extendable to 20 m. Measurement accuracy pH plus or minus 0.1 pH; Temperature plus or minus 0.5 C. Temperature range 0 to 80 C. Pressure range up to 0.6 MPa. Zero potential pH value 7 plus or minus 0.25 pH (15 mV). Slope at least 95 percent. Internal resistance up to 250 MΩ. Alkaline error 0.2 pH at 1 mol/L Na+ pH 14 at 25 C. Weight 0.2 kg.'),
((select id from public.documents where title='VizSens-pH (Analog) — Troubleshooting Steps'), 1,
 'VizSens-pH (Analog) Troubleshooting. Issue 1 — pH drift in wastewater: a clogged reference junction is the number one cause of drift in glass pH electrodes. Suspended solids, biological growth, or chemical precipitate block the junction. Action: soak the sensor tip in 0.1 M HCl for 5 minutes, rinse with distilled water, recondition in pH 7 buffer for 30 minutes. Issue 2 — Reference electrode poisoning: in wastewater containing sulfides, heavy metals or proteins, the reference electrolyte can be chemically altered. Symptom: stable but completely wrong readings. Action: replace the sensor — poisoning is irreversible. Issue 3 — Slow response or flat slope at calibration: glass bulb fouled by oils, biofilm or scaling. Action: soak in detergent solution, then in 0.1 M HCl, rinse, recalibrate. Issue 4 — Unstable / noisy readings: poor grounding or wet connector. Verify the analog cable shield is grounded at the controller end only; check for moisture ingress at the connector and dry it. Issue 5 — Calibration fails or slope below 95 percent: replace buffer solutions with fresh, in-date pH 4 and pH 7 at room temperature. If slope is still below 90 percent, the sensor is end-of-life. Issue 6 — Temperature compensation off: confirm PT1000 element is intact; some applications need manual temperature setting if no PT1000 is wired. Routine maintenance: clean monthly in wastewater; recalibrate every 30 to 60 days.');

-- ---------- 3. VizSens-ORP (Analog) ----------
insert into public.documents (title, type_id, sensor_model_id, page_count, size_bytes) values
('VizSens-ORP (Analog) — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='VizSens-ORP (Analog)'), 1, 0),
('VizSens-ORP (Analog) — Troubleshooting Steps',
 (select id from public.document_types where key='troubleshooting'),
 (select id from public.sensor_models where model_no='VizSens-ORP (Analog)'), 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
((select id from public.documents where title='VizSens-ORP (Analog) — Technical Data Sheet'), 1,
 'VizSens-ORP (Analog) ORP Sensor by Advance Analytik KFT. Combination electrode with precious metals indicator electrode and reference electrode. Measures the potential difference between the working battery composed of the measuring electrode and the reference electrode in solution. Online ORP monitoring suitable for fresh and sea water testing. Measurement range -2000 mV to +2000 mV. Materials: Black Polypropylene shell, Ag/AgCl reference gel. Dimensions Diameter 28.7 mm by Length 195 mm. Weight 0.2 kg. Cable length standard 10 m extendable to 20 m. Pressure range up to 0.6 MPa. Temperature range 0 to 80 C. Zero potential value 86 plus or minus 15 mV at 25 C in pH 7.00 solution containing saturated quinhydrone. Range at least 170 mV at 25 C in pH 4.00 solution containing saturated quinhydrone. Response time up to 10 seconds reaches 95 percent of end value after stirring. Optional analog-to-digital conversion module for digital signal output.'),
((select id from public.documents where title='VizSens-ORP (Analog) — Troubleshooting Steps'), 1,
 'VizSens-ORP (Analog) Troubleshooting. Issue 1 — Phantom drift in anaerobic wastewater: Hydrogen Sulfide (H2S) diffuses through the liquid junction and reacts with the silver inside, forming silver sulfide (Ag2S). The reading looks stable but is hundreds of millivolts off from reality. Action: replace the sensor; for installations with persistent H2S, request a double-junction PTFE reference variant. Issue 2 — Unstable readings: usually fouling of the precious metal tip with oils or biofilm. Action: polish the tip gently with a non-abrasive cloth or jewellers rouge, rinse with distilled water, recondition in standard solution. Issue 3 — Sensor verification: use a standard ORP solution such as Zobells solution or Lights solution; reading should be within plus or minus 10 mV of the reference value. If outside this tolerance the sensor is degraded. Issue 4 — Slow response after stirring: reference electrolyte depleted or junction clogged — replace the sensor (gel reference is not refillable). Issue 5 — Output stuck at full scale: open circuit on the cable; check connector and continuity. Issue 6 — Reading drifts with temperature: ORP is temperature-sensitive even though no compensation is built in; reference all measurements to the controller temperature reading. Routine maintenance: verify against standard solution monthly; expected sensor life is 6 to 18 months in wastewater.');

-- ---------- 4. VizSens-EC (Analog) — Conductivity ----------
insert into public.documents (title, type_id, sensor_model_id, page_count, size_bytes) values
('VizSens-EC (Analog) — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='VizSens-EC (Analog)'), 1, 0),
('VizSens-EC (Analog) — Troubleshooting Steps',
 (select id from public.document_types where key='troubleshooting'),
 (select id from public.sensor_models where model_no='VizSens-EC (Analog)'), 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
((select id from public.documents where title='VizSens-EC (Analog) — Technical Data Sheet'), 1,
 'VizSens-EC (Analog) Conductivity Sensor by Advance Analytik KFT. Glass platinum electrode for accurate conductivity monitoring in water treatment, hydrological monitoring, wastewater treatment, swimming pools, fish ponds, fertilizer, chemical and biology industries. Determines conductivity from voltage and current values. Glass platinum electrode known for durability and consistent performance. Wide measurement range 10 to 5000 microSiemens per cm (cell constant k = 1). Measurement accuracy plus or minus 1 percent or plus or minus 1 microSiemens per cm. Temperature range 0 to 80 C with PT1000 temperature compensation. Pressure range up to 0.6 MPa. Response time 10 seconds to reach 95 percent of end value. Materials: Black polypropylene shell, glass platinum electrode. Dimensions Diameter 28.7 mm by Length 195 mm. Weight 0.2 kg. Cable length standard 10 m extendable to 20 m. Optional analog-to-digital conversion module enables digital signal output with high anti-jamming capacity and long transmission distance.'),
((select id from public.documents where title='VizSens-EC (Analog) — Troubleshooting Steps'), 1,
 'VizSens-EC (Analog) Troubleshooting. Issue 1 — Reading drifts low or fluctuates in wastewater: biological growth, mineral scaling, or chemical precipitation coats the electrodes and alters the cell constant. Action: clean monthly with dilute white vinegar (5 percent acetic acid) for calcium and mineral deposits; dilute bleach (1 percent) for black organic deposits with thorough rinse; acetone for oils and fats. Issue 2 — Platinum black flaking or worn off: the platinum coating is essential for accuracy in high-conductivity solutions. If flaking or if cell constant has changed by 50 percent, the cell must be cleaned and re-platinized or replaced. Issue 3 — Reading much lower than expected: trapped air bubble between the electrodes. Action: dip the probe several times, gently shake to dislodge bubbles, hold vertical during measurement. Issue 4 — Reading near zero: open circuit or fully fouled electrodes; verify continuity with a multimeter, then clean. Issue 5 — Slow response: aged or fouled electrodes — clean and recalibrate with a known KCl standard (1413 microSiemens per cm). Issue 6 — For severely fouling wastewater, consider switching to an electrodeless (toroidal) conductivity probe which uses electromagnetic induction and is immune to fouling and corrosion.');

-- ---------- 5. VizSens-TDS (Analog) ----------
insert into public.documents (title, type_id, sensor_model_id, page_count, size_bytes) values
('VizSens-TDS (Analog) — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='VizSens-TDS (Analog)'), 1, 0),
('VizSens-TDS (Analog) — Troubleshooting Steps',
 (select id from public.document_types where key='troubleshooting'),
 (select id from public.sensor_models where model_no='VizSens-TDS (Analog)'), 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
((select id from public.documents where title='VizSens-TDS (Analog) — Technical Data Sheet'), 1,
 'VizSens-TDS (Analog) TDS Sensor by Advance Analytik KFT. Glass platinum electrode for reliable Total Dissolved Solids monitoring. Determines TDS from voltage and current values. Used in water treatment, hydrological monitoring, wastewater treatment, swimming pools, fish ponds, fertilizer, chemical and biology industries. Measurement range 0 to 20,000 mg/L (cell constant k = 1). Measurement accuracy plus or minus 1 percent or plus or minus 1 mg/L. Temperature range 0 to 80 C with PT1000 temperature compensation. Pressure range up to 0.6 MPa. Response time 10 seconds to reach 95 percent of end value. Materials: Black polypropylene shell, glass platinum electrode. Dimensions Diameter 28.7 mm by Length 195 mm. Weight 0.2 kg. Cable length standard 10 m extendable to 20 m. Optional analog-to-digital conversion module for high-anti-jamming digital output. Note: TDS is derived from conductivity using a configurable conversion factor (typically 0.5 for natural water, 0.7 for wastewater).'),
((select id from public.documents where title='VizSens-TDS (Analog) — Troubleshooting Steps'), 1,
 'VizSens-TDS (Analog) Troubleshooting. TDS sensors use the same platinum electrode technology as EC sensors and share most failure modes. Issue 1 — TDS reading drifts high over time: scale or biofilm on the electrode. Action: clean monthly with 5 percent vinegar for mineral scale, 1 percent bleach for biofilm; rinse thoroughly. Issue 2 — Sudden jump to unrealistic TDS values: check the conductivity-to-TDS conversion factor in the controller; typical values are 0.5 for natural water and 0.7 for wastewater. A wrong factor produces consistent multiplicative error. Issue 3 — Reading too low: air bubble trapped between electrodes — dip the probe several times to dislodge. Issue 4 — Slow response: fouled electrodes; clean and recalibrate against a known TDS standard. Issue 5 — Cell constant drift: verify by measuring a known standard; if the reading is off by more than 5 percent the cell constant has shifted due to platinum erosion. Re-platinize if possible or replace. Issue 6 — Output zero: open circuit; check cable continuity and connector seating. Issue 7 — For high-fouling wastewater, switch to a toroidal (electrodeless) probe.');

-- ---------- 6. UPCS-MAG-110 ----------
insert into public.documents (title, type_id, sensor_model_id, page_count, size_bytes) values
('UPCS-MAG-110 — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='UPCS-MAG-110'), 1, 0),
('UPCS-MAG-110 — Troubleshooting Steps',
 (select id from public.document_types where key='troubleshooting'),
 (select id from public.sensor_models where model_no='UPCS-MAG-110'), 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
((select id from public.documents where title='UPCS-MAG-110 — Technical Data Sheet'), 1,
 'UPCS-MAG-110 Electromagnetic Flow Meter by UPC Instruments Pvt. Ltd. (ISO 9001:2015 and 14001-2015 CE and TUV SUD certified). Used in ETP, STP, WTP plants, borewell, chemical, petrochemical, fertilizer, beverage and process industries for measuring flow rate and totalized volume of conductive liquids. Working principle: Faradays Law of Electromagnetic Induction. A magnetic field is generated by coils; as conductive liquid passes through the field an electric voltage is induced in the liquid directly proportional to its velocity, perpendicular to both the flow direction and the field. The induced voltage E = K times B times V times D, where K is the flow tube constant, B is the magnetic field strength, V is the mean flow velocity and D is the electrode spacing. Volume flow Q = V times pi times D squared divided by 4. The induced voltage is independent of temperature, viscosity, pressure, density and conductivity provided conductivity is above the minimum threshold and the pipe is completely full. HSN Code 90261010. Output 4-20 mA plus pulse plus Modbus RTU. Power supply 90-250 VAC. Recommended upstream straight run 5 pipe diameters, downstream 3 pipe diameters.'),
((select id from public.documents where title='UPCS-MAG-110 — Troubleshooting Steps'), 1,
 'UPCS-MAG-110 Troubleshooting. Issue 1 — No flow reading despite known flow: confirm the pipe is completely full of liquid (the meter cannot measure with air entrainment). Check that grounding rings are installed and connected on both sides of the sensor with 4 mm² copper wire to the transmitter ground terminal; ground impedance should be below 10 ohms. About 50 percent of magnetic-meter failures are caused by improper grounding. Issue 2 — Erratic or jumping readings: poor grounding or air bubbles in the line. Bleed the line at the high point; verify ground continuity. Issue 3 — Empty pipe error / alarm: pipe is not full, or the empty-pipe detection threshold is mis-set. Action: ensure the pipe is full at the meter location; check and adjust the empty-pipe threshold parameter in the transmitter. Issue 4 — Electrode coating: insulating buildup on electrodes (common in wastewater with grease or biofilm) blocks the signal, causing low or erratic readings. Symptom: electrode impedance exceeds 1 MΩ (typical clean range is 10 kΩ to 100 kΩ in conductive fluids). Action: isolate, remove the sensor, clean the electrodes with appropriate solvent, reinstall, verify impedance. Issue 5 — Reverse flow indication: check the flow direction arrow on the meter body — it must align with actual flow direction. Issue 6 — Low conductivity liquid: meter requires the liquid conductivity to exceed the minimum threshold (typically 5 microSiemens per cm). For low-conductivity service contact UPC. Issue 7 — Drifting calibration: verify the K factor / cell tube constant has not been changed in the menu; the value from the factory calibration certificate is the authoritative one.');

-- ---------- 7. UPC-WA-202 ----------
insert into public.documents (title, type_id, sensor_model_id, page_count, size_bytes) values
('UPC-WA-202 — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='UPC-WA-202'), 1, 0),
('UPC-WA-202 — Troubleshooting Steps',
 (select id from public.document_types where key='troubleshooting'),
 (select id from public.sensor_models where model_no='UPC-WA-202'), 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
((select id from public.documents where title='UPC-WA-202 — Technical Data Sheet'), 1,
 'UPC-WA-202 Online Water Analyzer (OCEMS multi-parameter) by UPC Instruments Pvt. Ltd. Used in industrial and municipal wastewater applications including ETP, STP, WTP. Primarily based on UV spectroscopy, known for stability and low operating cost. Measures organic matter (COD/BOD proxies), nitrate, colour, aromatic hydrocarbons (PAH). External probes can be added for physiochemical parameters including pH, ORP, dissolved oxygen, conductivity and turbidity. Also supports parameters like Na, K, TSS via add-on modules. Features automatic zero on cleaning solution and allows very high suspended solids without clogging — suitable for industrial and municipal wastewater. Web-based interface allows remote configuration and data download. Automatic cleaning system with long-life lamp; maintenance is mostly limited to periodic refill of inexpensive cleaning solution. Certifications CE, TUV SUD. CPCB and SPCB compliance for online stack and effluent monitoring. Data logging onto on-board logger with upload to servers per CPCB and SPCB guidelines.'),
((select id from public.documents where title='UPC-WA-202 — Troubleshooting Steps'), 1,
 'UPC-WA-202 Troubleshooting. Because the WA-202 is a multi-parameter analyzer based on UV spectroscopy with optional external probes, troubleshooting is parameter-specific. Issue 1 — UV absorbance drift: usually fouling of the optical window or cuvette. Action: trigger an auto-zero cycle with fresh cleaning solution; if drift persists, manually clean the optical window with cleaning fluid and lint-free wipe. Refill cleaning solution if low. Issue 2 — High suspended solids causing readings above range: confirm the SS bypass / clog protection is active; some installations need an upstream coarse strainer despite WA-202 high-SS tolerance. Issue 3 — Auto-zero failure: cleaning solution exhausted or pump fault. Check level and prime the cleaning pump. Issue 4 — Lamp end-of-life: typical UV lamp life is 6,000 hours; check the lamp hours counter and replace as needed. Issue 5 — External probe (pH/ORP/DO/EC/turbidity) reading wrong: refer to that probes individual troubleshooting; common causes are fouling, junction blockage or calibration drift. Issue 6 — Communication / data upload failure: check internet connectivity at the cabinet; verify SIM data balance if cellular; confirm CPCB endpoint credentials. Issue 7 — Cell window scratches or etching: replace the cuvette assembly; never use abrasive cleaning. Routine maintenance: weekly visual check, monthly cleaning-solution refill, quarterly external-probe calibration.');

-- ---------- 8. Brotek BT-UL ----------
insert into public.documents (title, type_id, sensor_model_id, vendor_url, page_count, size_bytes) values
('BT-UL — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='BT-UL'),
 'https://www.brotekswitch.com/ultrasonic-level-transmitter-with-4-to-20-ma-output/', 1, 0),
('BT-UL — Troubleshooting Steps',
 (select id from public.document_types where key='troubleshooting'),
 (select id from public.sensor_models where model_no='BT-UL'), null, 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
((select id from public.documents where title='BT-UL — Technical Data Sheet'), 1,
 'Brotek BT-UL High-Performance Ultrasonic Level Meter with OLED Display, with 4 to 20 mA output. Applications: storage tanks, water and wastewater treatment facilities, effluent treatment plants, canals and irrigation systems. Measuring range 0 to 6 m or 0 to 10 m. Blind spot 0.3 m. Accuracy plus or minus 0.3 percent of full scale. Frequency 20 to 350 kHz depending on model. Power supply DC 18 to 28 V. Output 4 to 20 mA or RS485. Protection rating IP65. Operating temperature atmospheric. Operating pressure atmospheric. Housing ABS engineering plastics. Installation interface G1 1/2 tube thread with gong ring (47 mm diameter). Display OLED with English menu, self-illuminating for low-light visibility. Three-button keyboard control. Digital filtering and dynamic echo recognition. Adjustable analog output scaling with full-scale start and end point configuration. Wide voltage adaptation across the 18-28 VDC range.'),
((select id from public.documents where title='BT-UL — Troubleshooting Steps'), 1,
 'Brotek BT-UL Troubleshooting. Issue 1 — Echo loss / no reading: most common cause is foam covering more than 40 to 50 percent of the liquid surface; the foam absorbs ultrasonic energy. Action: install a stilling well or waveguide pipe so the probe measures inside a column with reduced foam. For chronic heavy foam, switch to a radar level meter (radar penetrates foam under 5 cm). Issue 2 — Random / jumping values when level is in the blind zone: the BT-UL blind spot is 0.3 m; if liquid rises into the blind zone the meter outputs arbitrary values. Action: re-mount higher so the maximum liquid level stays at least 0.3 m below the probe face. Issue 3 — Temperature-related drift in summer or hot vapours: steam or mist above 30 to 40 C attenuates the ultrasonic signal and water droplets condense on the probe face. Action: shade the probe from direct sun, fit a vapour shield, or extend the probe up the standpipe to keep the probe face dry. Issue 4 — Output stuck at 4 mA: verify 18 to 28 VDC at the terminals; confirm full-scale start point is correctly configured. Issue 5 — Output stuck at 20 mA: liquid is above the configured full-scale or echo is being lost — check both. Issue 6 — Reading drifts after cleaning: condensation on the probe face. Wipe dry and allow to stabilize. Issue 7 — Mounting too close to a wall, ladder or fill inlet: false echoes from these obstructions. Re-mount with at least 30 cm clearance from any vertical surface and away from the inflow column.');

commit;

-- Verification
select 'makes' as t, count(*) from public.sensor_makes
union all select 'models', count(*) from public.sensor_models
union all select 'documents (seeded)', count(*) from public.documents where storage_path is null
union all select 'documents (real uploads)', count(*) from public.documents where storage_path is not null
union all select 'chunks', count(*) from public.document_chunks;
