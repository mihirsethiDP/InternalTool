-- Migration 007b: Technical Data Sheet documents for all 8 sensors.
-- Run AFTER 007a.
begin;

insert into public.documents (title, type_id, sensor_model_id, page_count, size_bytes) values
('VizSens-ODO — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='VizSens-ODO'), 1, 0),
('VizSens-pH (Analog) — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='VizSens-pH (Analog)'), 1, 0),
('VizSens-ORP (Analog) — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='VizSens-ORP (Analog)'), 1, 0),
('VizSens-EC (Analog) — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='VizSens-EC (Analog)'), 1, 0),
('VizSens-TDS (Analog) — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='VizSens-TDS (Analog)'), 1, 0),
('UPCS-MAG-110 — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='UPCS-MAG-110'), 1, 0),
('UPC-WA-202 — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='UPC-WA-202'), 1, 0),
('BT-UL — Technical Data Sheet',
 (select id from public.document_types where key='datasheet'),
 (select id from public.sensor_models where model_no='BT-UL'), 1, 0);

insert into public.document_chunks (document_id, page_number, chunk_text) values
((select id from public.documents where title='VizSens-ODO — Technical Data Sheet'), 1,
 'VizSens-ODO Optical Dissolved Oxygen Sensor by Advance Analytik KFT. Uses fluorescence technology: a luminescent material on the sensor cap is excited by blue LED light and emits red light; the intensity and time of the red light indicate oxygen molecule concentration. Features include oxygen-sensitive membrane design, NTC temperature compensation, measurement without oxygen consumption or flow or stirring, breakthrough fluorescence technology, low maintenance with built-in self-diagnosis, plug-and-play installation, factory calibration with optional field calibration. Measurement range DO 0 to 20 mg/L or 0 to 200 percent saturation. Temperature range 0 to 45 degrees Celsius. Accuracy DO plus or minus 3 percent or plus or minus 0.3 mg/L of measured value. Resolution 0.01 mg/L. Repeatability plus or minus 0.3 mg/L. Pressure range up to 0.3 MPa. Body material SS316L for fresh water or Titanium alloy for ocean and marine applications. Cover polyphenylene plus glass fiber. Weight 1.4 kg. Cable length standard 10 m extendable to 100 m. Power supply DC 9 to 36 V. Communication Modbus RS485. Storage temperature -15 to 60 C.'),
((select id from public.documents where title='VizSens-pH (Analog) — Technical Data Sheet'), 1,
 'VizSens-pH (Analog) pH Sensor by Advance Analytik KFT. Combination electrode with glass indicating electrode and reference electrode for reliable pH measurement in water treatment, hydrological monitoring, wastewater treatment, swimming pools, fish ponds, fertilizer, chemical and biology industries. Features: good repeatability and stability suitable for fresh and sea water. Measurement range 0 to 14 pH. Simple manual cleaning. Optional analog-to-digital conversion module for digital signal output with high anti-jamming capacity. Materials: Black Polypropylene shell, Ag/AgCl reference gel. Dimensions Diameter 28.7 mm by Length 195 mm. Cable length standard 10 m, extendable to 20 m. Measurement accuracy pH plus or minus 0.1 pH; Temperature plus or minus 0.5 C. Temperature range 0 to 80 C. Pressure range up to 0.6 MPa. Zero potential pH value 7 plus or minus 0.25 pH (15 mV). Slope at least 95 percent. Internal resistance up to 250 MΩ. Alkaline error 0.2 pH at 1 mol/L Na+ pH 14 at 25 C. Weight 0.2 kg.'),
((select id from public.documents where title='VizSens-ORP (Analog) — Technical Data Sheet'), 1,
 'VizSens-ORP (Analog) ORP Sensor by Advance Analytik KFT. Combination electrode with precious metals indicator electrode and reference electrode. Measures the potential difference between the working battery composed of the measuring electrode and the reference electrode in solution. Online ORP monitoring suitable for fresh and sea water testing. Measurement range -2000 mV to +2000 mV. Materials: Black Polypropylene shell, Ag/AgCl reference gel. Dimensions Diameter 28.7 mm by Length 195 mm. Weight 0.2 kg. Cable length standard 10 m extendable to 20 m. Pressure range up to 0.6 MPa. Temperature range 0 to 80 C. Zero potential value 86 plus or minus 15 mV at 25 C in pH 7.00 solution containing saturated quinhydrone. Range at least 170 mV at 25 C in pH 4.00 solution containing saturated quinhydrone. Response time up to 10 seconds reaches 95 percent of end value after stirring.'),
((select id from public.documents where title='VizSens-EC (Analog) — Technical Data Sheet'), 1,
 'VizSens-EC (Analog) Conductivity Sensor by Advance Analytik KFT. Glass platinum electrode for accurate conductivity monitoring in water treatment, hydrological monitoring, wastewater treatment, swimming pools, fish ponds, fertilizer, chemical and biology industries. Determines conductivity from voltage and current values. Wide measurement range 10 to 5000 microSiemens per cm (cell constant k = 1). Measurement accuracy plus or minus 1 percent or plus or minus 1 microSiemens per cm. Temperature range 0 to 80 C with PT1000 temperature compensation. Pressure range up to 0.6 MPa. Response time 10 seconds to reach 95 percent of end value. Materials: Black polypropylene shell, glass platinum electrode. Dimensions Diameter 28.7 mm by Length 195 mm. Weight 0.2 kg. Cable length standard 10 m extendable to 20 m. Optional analog-to-digital conversion module for digital signal output.'),
((select id from public.documents where title='VizSens-TDS (Analog) — Technical Data Sheet'), 1,
 'VizSens-TDS (Analog) TDS Sensor by Advance Analytik KFT. Glass platinum electrode for reliable Total Dissolved Solids monitoring. Determines TDS from voltage and current values. Used in water treatment, hydrological monitoring, wastewater treatment, swimming pools, fish ponds, fertilizer, chemical and biology industries. Measurement range 0 to 20000 mg/L (cell constant k = 1). Measurement accuracy plus or minus 1 percent or plus or minus 1 mg/L. Temperature range 0 to 80 C with PT1000 temperature compensation. Pressure range up to 0.6 MPa. Response time 10 seconds to reach 95 percent of end value. Materials: Black polypropylene shell, glass platinum electrode. Dimensions Diameter 28.7 mm by Length 195 mm. Weight 0.2 kg. Cable length standard 10 m extendable to 20 m. Note: TDS is derived from conductivity using a configurable conversion factor (typically 0.5 for natural water, 0.7 for wastewater).'),
((select id from public.documents where title='UPCS-MAG-110 — Technical Data Sheet'), 1,
 'UPCS-MAG-110 Electromagnetic Flow Meter by UPC Instruments Pvt. Ltd. (ISO 9001:2015 and 14001-2015 CE and TUV SUD certified). Used in ETP, STP, WTP plants, borewell, chemical, petrochemical, fertilizer, beverage and process industries for measuring flow rate and totalized volume of conductive liquids. Working principle: Faradays Law of Electromagnetic Induction. A magnetic field is generated by coils; as conductive liquid passes through the field an electric voltage is induced in the liquid directly proportional to its velocity, perpendicular to both the flow direction and the field. The induced voltage E = K times B times V times D, where K is the flow tube constant, B is the magnetic field strength, V is the mean flow velocity and D is the electrode spacing. The induced voltage is independent of temperature, viscosity, pressure, density and conductivity provided conductivity is above the minimum threshold and the pipe is completely full. HSN Code 90261010. Output 4-20 mA plus pulse plus Modbus RTU. Power supply 90-250 VAC. Recommended upstream straight run 5 pipe diameters, downstream 3 pipe diameters.'),
((select id from public.documents where title='UPC-WA-202 — Technical Data Sheet'), 1,
 'UPC-WA-202 Online Water Analyzer (OCEMS multi-parameter) by UPC Instruments Pvt. Ltd. Used in industrial and municipal wastewater applications including ETP, STP, WTP. Primarily based on UV spectroscopy, known for stability and low operating cost. Measures organic matter (COD/BOD proxies), nitrate, colour, aromatic hydrocarbons (PAH). External probes can be added for physiochemical parameters including pH, ORP, dissolved oxygen, conductivity and turbidity. Also supports parameters like Na, K, TSS via add-on modules. Features automatic zero on cleaning solution and allows very high suspended solids without clogging — suitable for industrial and municipal wastewater. Web-based interface allows remote configuration and data download. Automatic cleaning system with long-life lamp; maintenance is mostly limited to periodic refill of inexpensive cleaning solution. Certifications CE, TUV SUD. CPCB and SPCB compliance for online stack and effluent monitoring.'),
((select id from public.documents where title='BT-UL — Technical Data Sheet'), 1,
 'Brotek BT-UL High-Performance Ultrasonic Level Meter with OLED Display, with 4 to 20 mA output. Applications: storage tanks, water and wastewater treatment facilities, effluent treatment plants, canals and irrigation systems. Measuring range 0 to 6 m or 0 to 10 m. Blind spot 0.3 m. Accuracy plus or minus 0.3 percent of full scale. Frequency 20 to 350 kHz depending on model. Power supply DC 18 to 28 V. Output 4 to 20 mA or RS485. Protection rating IP65. Operating temperature atmospheric. Operating pressure atmospheric. Housing ABS engineering plastics. Installation interface G1 1/2 tube thread with gong ring (47 mm diameter). Display OLED with English menu, self-illuminating for low-light visibility. Three-button keyboard control. Digital filtering and dynamic echo recognition. Adjustable analog output scaling with full-scale start and end point configuration.');

commit;

select 'datasheet docs' as t, count(*) from public.documents
 where type_id = (select id from public.document_types where key='datasheet')
   and storage_path is null;
