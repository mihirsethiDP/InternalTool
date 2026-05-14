-- AUTO-GENERATED from master costing xlsx by scripts/build-seed.mjs
-- Run AFTER 001_init.sql.
begin;

-- Categories
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 150MM', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 200MM', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - (PTFE)', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 100MM', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 250MM', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - (PTFE) REMOTE TYPE', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 20MM', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 80MM', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 125MM', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - REMOTE TYPE', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('VORTEX FLOW METER', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - (Rubber Lining)', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flowmeter - (PTFE)', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flowmeter - (Rubber Lining)', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 300MM', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 400MM', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 500MM', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 65MM', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - PTFE', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Electromagnetic Flow Meter - 50mm', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Air Flow Meter', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Annubar Insertion Type Air flow Meter', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Insertion Type Air flow Meter', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Mass Air flow Meter', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Mass Type Air flow Meter - 40mm', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Mass Type Air flow Meter - 50mm', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Mass Type Air flow Meter - 65mm', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Mass Type Air flow Meter - 80mm', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Mass Type Air flow Meter - 100mm', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Mass Type Air flow Meter - 125mm', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Mass Type Air flow Meter - 150mm', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Mass Type Air flow Meter - 200mm', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Mass Type Air flow Meter - 250mm', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Thermal Mass Type Air flow Meter - 300mm', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Vortex type air flow meter', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('FOR STP', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('FOR WTP', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('SITRANS FMS500 Magnetic flow sensor
Make : Siemens
Model No. : 7ME6532-4PJ03-1GA3-Z A00
Line Size: 8" (200 mm)', 'Flow') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Ultrasonic Level Transmitter', 'Level') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Radar Level Transmitter - Vega', 'Level') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Capacitance Level Transmitter - Trumen', 'Level') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('WLC - Blueseas', 'Level') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Modbus Output - ULT', 'Level') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('For Fuel Tank', 'Level') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Ultrasonic differential level transmitter (0-10 MTR)', 'Level') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('DO Sensor

(DIP type Sensor- Installed in the tank)', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('pH Sensor', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('MLSS(TSS) Sensor', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Turbidity Sensor', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Conductivity Sensor', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Ammonium Nitrogen', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Ammonical Nitrogen & Nitrate Sensor', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Phosphorous Analyzer', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('TSS Sensor', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('TDS Meter', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Odour Control Sensor', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('GV108 Sensor Module - Methane gas Detector', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('GV 09PRO 2CH PANEL', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('GV 09PRO 4CH PANEL', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Armored Cable - Armored Cable 0.5sq mm 4 Core', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Sentry Sensor - Water Monitoring Services', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('PH, FRC, Turbidity & TDS Analyser', 'Water Quality') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('HIGH PRESSURE SWITCH', 'Pressure') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Differrential Pressure transmitter (0-6 BAR)', 'Pressure') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('Temperature Sensor', 'Maintenance & Safety') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('MAGNETIC FLOAT OPERATED PIVOTED LEVEL SWITCH - FPS', 'Maintenance & Safety') on conflict (name) do nothing;
insert into public.sensor_categories (name, "group") values ('WLC', 'Maintenance & Safety') on conflict (name) do nothing;

-- Makes
insert into public.sensor_makes (name) values ('UPC') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('YOKOGAWA') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('SIEMENS') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Peltek') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Iota Flow') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Rockwin') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Krohne Marshall') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Electronet') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Aster') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Atlantech') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Radix') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('IMTB Engg') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Metaval + Emerson') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Broil') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Schmidt') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Addmass') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Forbes Marshell') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('ABB') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('E&H') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('XYLEM') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Electromagnetic Flow Meter - 80MM') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Brotek') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('PUNE TECHTROL') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Trumen') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Sapsonic') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Siemens') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('P&F') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('TOSHNIWAL') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('SBEM') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Forbe Marshall') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Vega') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('EIP') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Pune Techtrol') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Blueseas') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Pune Techtrol Pvt Ltd.') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('FORBE MARSHALL') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Measuring Range: 0 to 20.00 mg/l
2. Output: RS 485 Modbus
3. Working condition: 0 to 60°C,
4. Power Supply: 9 to 12 VDC, Current <50mA
5. Protection: IP 68') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Range 0-20 mg/L 
Measurement Technology: Optical 
Temperature: 0-50 degC 
Pressure 3 bar 
Sensor Housing Material: POM + SS316 
Sensor Cable : 10 Meters 
Sensor IP Rating: IP68') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Advanced Premium Optical DO+ Temperature Sensor BH-
505A(2 in 1 Sensor)

Range : 0-20 mg/L
Accuracy : +/-3%
Temperature : 0 to 50 Degree
Output : RS485
Protection Grade : IP68
MOC : SS
Cable Length : 5 M') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. IP65') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Type of Input - DO Electrode
2. Output - RS485, 4-20mA
3. Weatherproof IP 67') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Transmitter and Sensor - 2 year warranty') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Measuring Range 0 - 20.00 ppm, 0 - 20.0 mg/L, 0 - 200% saturation
2. No Calibration required
3. IP68') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Sensor with Transmitter') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Dissolved Oxygen: 0 to 20 mg/L (ppm)
Liquid Temperature: 0 to 40 ̊C
Liquid Pressure: 0 to 100 kPa
Flow speed: 20 cm/s or more') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Method: Fluorescence method
Range: 0-20 ppm
Cable length: 10 mtr
Accuracy: ±5%
Body:SUS316L
Digital RS485 output
IP68 rating') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Measuring range - 0-14 PH
2. Working temp - 0-60 degree cel
3. IP Grade - IP68
4. Data Output - Modbus/RS485') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Advanced Online pH+Temperature Sensor FLDBHG-106(2
in 1 Sensor)
Range : 0-14 pH
Accuracy : +/-0.01 pH
Temperature : 0 to 65 Degree
Pressure Range : 0-2 Bar
Output : RS485
Protection Grade : IP68
Shell Material : POM
Cable Length :5 M') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Transmitter and Sensor') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Measuring range - 0-14 PH
2. Temp Range - 0-105 Degree cel
3. Flow rate - 0-2m/s
4. Pressure range - 0-6.9 bar at 100 degree cel') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('ProMinent make compact controller for pH
with LCD display with temperature correction
pt 1000 with P / PID controller with pulse,
relay and analogue output 0/4-20 mA for
controlling one pump with sen') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('ORP with chlorine dosing pump') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Online ORP/Temp Controller with pH Sensor and 5m Cable 
2. Output - 1 x 4-20mA, Modbus, Relays, 100 to 240 VAC 
3. Range: -1000 to +1000 mV
4. IP68') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Advanced ORP Sensor FLDBH2733DAR
Range : -1500 - +1500 mV
Accuracy : +/-20 mV
Temperature : 0 to 50 Degree
Pressure Range : 0-2 Bar
Output : RS485 
Protection Grade : IP68
Shell Material : POM
Cable Length : 5 M') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Sensor with transmitter') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('ProMinent make compact controller for ORP
with LCD display with temperature correction
pt 1000 with P / PID controller with pulse,
relay and analogue output 0/4-20 mA for
controlling one pump with sen') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Sensor with transmitter (Range- 0-10,000 ppm)') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Advanced Premium MLSS + Temperature Sensor With Self
Cleaning Brush FLDBH7865D
Range : 0-50000 mg/L
Accuracy : +/-10%
Temperature : 0 to 45 Degree
Pressure Range : 0-2 Bar
Output : RS485
Protection Grade : IP68
Shell Material : SS') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('VizSens-SS Online TSS Sensor
Method: Infrared absorption scattered light.
Range: 0-20,000
Self Cleaning Brush
Cable length: 10 mtr
Accuracy: ±5%
Body:SUS316L
Digital RS485 output
IP68 rating') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Range - Turbidity (TRB): 0.001 - 9999 NTU
Solids (TSS): 0.001 - 500 g/L
2. working temp - 0 - 50 °C') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Measuring Range - 0-20 NTU
2. Working Temp - 5-40 degee cel
3. Analog interface - 4-20mA
4. Calibration - One or two points calibration
5. Installation method - Flow through cell installtion, submerged installation') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Advanced Premium Optical Turbidity + Suspended Solids+
Tracability + Temperature Sensor BH1400D(4 in 1 Sensor)
Range : 0-4000 NTU
Accuracy : +/-5%
Temperature : 0 to 45 Degree
Pressure Range : 0-3 Bar
Output : RS485
Protection Grade : IP68
Working Principle : 900 Scatered Light
Shell Material : PVC, SS') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Range 0-200 NTU 
Measurement Technology: 90 degree IR scattered light method 
Temperature: 0-50 degC 
Flow Through Type Turbidity sensor') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Measuring Range - 0.001 to 4000 NTU
2. Working temp - 0 to 40 °C (32 to 104°F)') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Turbidity Online Analyzer') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Turbidity sensor with wiper') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Self cleaning turbidity sensor
2. Output - RS485, supports modbus
3. Range - 0-1000 NTU
4. IP68') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Temp range - 0-50 degree cel
2. Pressure range - 5bar
3. IP68') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('ProMinent make compact controller for
conductivity with conductivity sensor LFTK-1
20mS/CM, with sensor housing & cable') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Temp range - –20 to 200°C
2. Flow Rate - 0–3 m/s (0–10 ft./s)') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Total Hardness - 20-500ppm') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Total Hardness - 0-500ppm') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Range: 
COD-600 ppm
BOD- 300 ppm') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Range: 
COD-1100 ppm 
BOD- 350 ppm
Range: 
COD-2200 ppm 
BOD- 700 ppm') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Transmitter and sensor') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('(Range -  0 - 1000 ppm)') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('ProMinent make compact controller for
Chlorine CLB 0- 2 mA 0-5 ppm sensor, sensor
housing and cable') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Sensor & Transmitter 
Capacity : upto 7000ppm') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Sensor & Transmitter') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Material - SS316L
2. Weight - 15kg
3. Protection class - IP65
4. Operating Temp - 5 ... 55°C
5. Data Transfer - USB type A
6. Output - RS485, 4-20mA
7. IP65') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Online Multi Channel Controller for pH/BOD/COD/TSS Display
2. 1 x RS 485 Modbus, 2 x 4-20mA Analog Output, Relays, 220 VAC 
3. Range: Check range from catalog
4. TUV Germany Certified, Meets CPCB Guidelines, More than 500+ Installations') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('BOD/COD/TSS: 0 - 1000 mg/l
pH: 0-14
TDS: 0-1000 (mg/L)
Ranges are customizable') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Model: Viz-Eco-EQMS') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Measuring range - 0.35 ~ 10m
2. Operating temp - -20 ~ +70°C
3. Output - 4~20mA
4. IP67') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Measuring range - Mud position - 0.2~12m
2. Temperature:0~50.0°C
3. IP65') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Location - Effluent of IC reactor, biomass recirculation line
and influent (Inlet location optional; dependent
on wastewater characteristics)
2. Temp - -40 to 60° C
3. Range - 0-10000 mg/l for COD
4. Output - 4-20 mA. DC, Isolated
5. IP67') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Inlet :
COD - 0-1000ppm
BOD- 0-1000ppm
TSS- 0-1000ppm
PH - 0-14 PH
Outlet:
COD - 0-1000ppm
BOD- 0-1000ppm
TSS- 0-1000ppm
PH - 0-14 PH
Datalogger with 1year connectivity to CPCP and SPCB except TN, Sikkim, kerala') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Measurement Rage - 0-100ppm, SiO2

Reagent''s life is 90 days. Reagent will be available @ Extra cost of 75,000/- INR') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Measurement Rage - 0-100ppm, SiO2

Reagent will be available @ Extra cost of 35,000/- INR.') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Measuring Method: Colorimetric
Power Supply: 230 VAC
Output: 4-20 mA Analog
Sample Temperature: 10 °C - 30 °C
Protection: IP55


Includes-
 One initial set of reagents
 Sample pot
 25 microns manual cleaning filter') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Measuring Range: 0-100 ppm Si') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Dual Channel Transmitter with one pH & one FRC sensor') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Dual Channel Transmitter with one TDS & one Turbidity sensor') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Capacity - 5 N.m (0.37 KW & RPM 910)') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('https://drive.google.com/file/d/1Tf-88fQqfcyFLWWiQem1zzNywONG3k4P/view?usp=drive_link') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('https://drive.google.com/file/d/1LBJAoS_Jh7Mu6gA-F81MMjvplnaOefzc/view?usp=drive_link') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('DANFOSS') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('MAKE') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Connection location - Horizontal and vertical pipe mounting
Flow direction in line with the arrow marking on the process connection
2. IP30') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('1. Operating pressure - 10kgf/cm² (1000KPa)
2. Temp of fluid - Max 100°C (212°F)') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Capacity - 1KVA , 2 in built battery & half hr battery backup') on conflict (name) do nothing;
insert into public.sensor_makes (name) values ('Capacity - 1KVA , 3 in built battery & half hr battery backup') on conflict (name) do nothing;

-- Sensor models
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'UPC'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), 'UPCS-MAG-110', 'Electromagnetic Flow Meter - 25MM', NULL, 'UPC', 'P1
Suitable for Internal 
applications', 15000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 40MM', 'Condition : General', NULL, NULL, 15000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Media : Liquids', NULL, 'PTFE used in high temp', 15500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Working Temp : 150°C', NULL, 'Corrosive fluids and slurries', 16500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 80MM', 'Output : 4-20 mA & RS485', NULL, NULL, 17500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'YOKOGAWA'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 20MM'), 'MagFlow 6410', 'Electromagnetic Flow Meter - 25MM', 'Power Supply : 80 - 300 V AC/DC', NULL, NULL, 67725);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 20MM'), NULL, 'Electromagnetic Flow Meter - 40MM', 'Output : 4-20 mA + Open Collector Pulse', NULL, NULL, 63525);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 20MM'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Communication Interface : GPRS + RS 485 (Modbus RTU)', NULL, NULL, 65625);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 20MM'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Data Logger : Not Required', NULL, NULL, 68828);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 80MM'), NULL, 'Electromagnetic Flow Meter - 100MM', 'Design of measuring sensor : Flange ANSI 150', NULL, NULL, 82525);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 125MM'), NULL, 'Electromagnetic Flow Meter - 150MM', 'Flange Material : Carbon Steel', NULL, NULL, 90825);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 125MM'), NULL, 'Electromagnetic Flow Meter - 200MM', 'Electrode Material : SS 316L
Earthing Rings / Electrode : SS 316
Measuring Tube : SS 304
Coil Housing : Carbon Steel
Protection Class : IP 68', NULL, NULL, 109725);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 250MM'), NULL, 'Electromagnetic Flow Meter - 300MM', 'Cable length : 10 meter
Accuracy : +/- 0.5%', NULL, NULL, 144375);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'SIEMENS'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - REMOTE TYPE'), 'Model: 7ME6532-4HJ03-1JA3-Z', 'Electromagnetic Flow Meter - 80MM', 'Electromagnetic Flow meter (Remote Type)', NULL, NULL, 90000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - REMOTE TYPE'), 'A05+F01+T00 +FDK:085U0220', 'Electromagnetic Flow Meter - 150MM', 'Cable length: 5 mtr
Power Supply: 230VAC', NULL, NULL, 103000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - REMOTE TYPE'), NULL, 'Electromagnetic Flow Meter - 300MM', 'Output:4-20ma (Hart)', NULL, NULL, 159000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'UPC'), (select id from public.sensor_categories where name = 'VORTEX FLOW METER'), NULL, 'Electromagnetic Flow Meter - 25MM', 'SIZE:25MM
Principle of Measurement: Vortex Method
With Pressure & Temp. Compensation
Display :In Built LCD Display,
Temp: <250 Degree C,
Power Supply: 24VDC
Media: Steam, Accuracy:±1.0%
Maximum Pressure:16 Bar
Connection: WAFER TYPE
O/P: RS485/4-20mA DC,Make: "UPC"', NULL, NULL, 38937);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Peltek'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), 'PLT-WFM-I-220', 'Electromagnetic Flow Meter - 25MM', NULL, 'Peltek', 'P2
Suitable for Internal 
applications', 16400);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 40MM', 'Condition : General', NULL, NULL, 17199);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Media : Liquids', NULL, NULL, 18500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Working Temp : 180°C', NULL, 'It prevents corrosion', 19700);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 80MM', 'Output : 4-20 mA DC', NULL, 'Substance contamination', 20700);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 100MM', 'Std. IP 65', NULL, 'ignition and explosion', 23000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Iota Flow'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), 'MM-25-1-S-T-S-IP68-2-M-P-2-B-C-2-S-0', 'Electromagnetic Flow Meter - 25MM', NULL, 'iota.pdf', 'P2
Suitable for Internal 
applications', 45780);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), 'MM-40-1-S-T-S-IP68-2-M-P-2-B-C-2-S-0', 'Electromagnetic Flow Meter - 40MM', NULL, NULL, NULL, 46088);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), 'MM-50-1-S-T-S-IP68-2-M-P-2-B-C-2-S-0', 'Electromagnetic Flow Meter - 50MM', NULL, NULL, NULL, 50435);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), 'MM-65-1-S-T-S-IP68-2-M-P-2-B-C-2-S-O', 'Electromagnetic Flow Meter - 65MM', NULL, NULL, 'It prevents corrosion', 52514);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), 'MM-80-1-S-T-S-IP68-2-M-A-2-B-C-2-S-O-O', 'Electromagnetic Flow Meter - 80MM', NULL, NULL, 'Substance contamination', 56945);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), 'MM-100-1-S-T-S-IP68-2-M-A-2-B-C-2-S-O', 'Electromagnetic Flow Meter - 100MM', NULL, NULL, 'ignition and explosion', 59598);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), 'MM-150-1-S-T-S-IP68-2-M-P-2-B-C-2-S-O', 'Electromagnetic Flow Meter - 150MM', NULL, NULL, NULL, 72268);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), 'MM-200-1-S-T-S-IP68-2-M-P-2-B-C-2-S-O', 'Electromagnetic Flow Meter - 200MM', NULL, NULL, NULL, 82775);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), 'MM-250-1-S-T-S-IP68-2-M-P-2-B-C-2-S-O', 'Electromagnetic Flow Meter - 250MM', NULL, NULL, NULL, 121660);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Rockwin'), (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 40MM', NULL, NULL, 'P3', 43200);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Condition : General', NULL, NULL, 45600);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Media : Conductive Liquids', NULL, 'PTFE used in high temp', 49800);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 80MM', 'Working Temp : 180°C', NULL, 'Corrosive fluids and slurries', 55200);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 100MM', 'Output : 4‐20 mA', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Rockwin'), (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 40MM', 'Condition : General', NULL, 'P3', 37800);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Media : Conductive Liquids', NULL, NULL, 40200);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Working Temp : 180°C', NULL, 'It prevents corrosion', 41400);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 80MM', 'Output : 4‐20 mA', NULL, 'Substance contamination', 42600);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 100MM', NULL, NULL, 'ignition and explosion', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Krohne Marshall'), (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 40MM', NULL, NULL, 'P1', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Condition : General', NULL, 'Suitable for industries', 84500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Media : Conductive Liquids', NULL, NULL, 86000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 80MM', 'Working Temp : 180°C', NULL, 'It prevents corrosion', 75000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 100MM', 'Output : 4‐20 mA', NULL, 'Substance contamination', 88000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flowmeter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 150MM', NULL, NULL, 'ignition and explosion', 92000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Electronet'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), 'ELMAG 200', 'Electromagnetic Flow Meter - 25MM', NULL, NULL, 'P3
Suitable for internal & External Applications', 21280);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 40MM', 'Condition : General', NULL, NULL, 22395);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Media : Liquid', NULL, 'It prevents corrosion', 22870);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Working Temp : -20 to 85°C', 'Electronet', 'Substance contamination', 23820);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 80MM', 'Output : 4 to 20mA DC', NULL, 'ignition and explosion', 24930);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (Rubber Lining)'), NULL, 'Electromagnetic Flow Meter - 100MM', 'Weather Proof IP-67, IP-68', NULL, NULL, 28100);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Electronet'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), 'ELMAG 200', 'Electromagnetic Flow Meter - 25MM', NULL, NULL, 'P3
Suitable for internal & External Applications', 23350);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 40MM', 'Condition : General', NULL, NULL, 24300);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Media : Liquid', NULL, NULL, 25570);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Working Temp : -20 to 220°C', 'Electronet', 'PTFE used in high temp', 26680);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 80MM', 'Output : 4 to 20mA DC', NULL, 'Corrosive fluids and slurries', 29060);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - (PTFE)'), NULL, 'Electromagnetic Flow Meter - 100MM', 'Weather Proof IP-67, IP-68', NULL, NULL, 33980);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Aster'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), 'Mag-Flow-650', 'Electromagnetic Flow Meter - 25MM', NULL, NULL, 'P3
Suitable for Internal Application', 23000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 40MM', 'Condition : General', NULL, NULL, 26000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Media : Any conductive fluid', 'Aster', 'PTFE used in high temp', 29000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Working Temp :', NULL, 'Corrosive fluids and slurries', 32100);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 80MM', 'Output : 4-20 mA & RS485', NULL, NULL, 32100);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 100MM', 'Weather proof IP 65', NULL, NULL, 38200);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Atlantech'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), 'MAGTECH 2000', 'Electromagnetic Flow Meter - 25MM', NULL, NULL, 'P2
Suitable for Internal & External Applications', 17000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 40MM', 'Condition : General', NULL, NULL, 17500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Media : Conductive Liquids', 'Atlantech', 'PTFE used in high temp', 18000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Working Temp : 180°C', NULL, 'Corrosive fluids and slurries', 18500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 80MM', 'Output : 4‐20 mA', NULL, NULL, 19500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 100MM', 'IP‐68 Protec on class available', NULL, NULL, 22000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Radix'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), 'EFM401', 'Electromagnetic Flow Meter - 25MM', NULL, NULL, 'P3
Suitable for Internal & External Applications', 28595);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 40MM', 'Condition : General', NULL, NULL, 30595);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Media : Conductive Liquids', NULL, 'PTFE used in high temp', 32270);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Working Temp : 180°C', 'Radix', 'Corrosive fluids and slurries', 36260);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 80MM', 'Output : 4‐20 mA', NULL, NULL, 40790);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'IMTB Engg'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), 'QTLD', 'Electromagnetic Flow Meter - 25MM', NULL, NULL, 'P3
Suitable for Internal & External Applications', 24500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 40MM', 'Condition : General', NULL, NULL, 28500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 50MM', 'Media : Conductive Liquids', NULL, 'PTFE used in high temp', 35000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 65MM', 'Working Temp : 180°C', 'Imtb Engg', 'Corrosive fluids and slurries', 39000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 80MM', 'Output : 4‐20 mA', NULL, NULL, 55000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter'), NULL, 'Electromagnetic Flow Meter - 100MM', 'Sensor: IP65 , IP68 (submersible, only available for remote type)', NULL, NULL, 72000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Metaval + Emerson'), (select id from public.sensor_categories where name = 'Annubar Insertion Type Air flow Meter'), '2051CD3A22A1AB4M5D4DFQ4', 'Annubar Insertion Type Air flow Meter - Metaval + Emerson - 250mm', 'Installation Type      -  Insertion/Flanged
Medium    -    For Air/Gas', 'Metaval', 'P1', 90000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Annubar Insertion Type Air flow Meter'), NULL, 'Annubar Insertion Type Air flow Meter - Metaval + Emerson - 300mm', 'Power Consumption - 15Watt', NULL, NULL, 95000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Annubar Insertion Type Air flow Meter'), NULL, 'Annubar Insertion Type Air flow Meter - Metaval + Emerson - 400mm', 'Output    -    4-20 mA', NULL, NULL, 110000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Broil'), (select id from public.sensor_categories where name = 'Thermal Insertion Type Air flow Meter'), 'BT-TMFM- S.S.S', 'Thermal Insertion Type Air flow Meter - Broil - 250mm', 'Measuring medium - various gases', 'Broil', 'P3
Suitable for internal 
applications only', 93000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Thermal Insertion Type Air flow Meter'), NULL, 'Thermal Insertion Type Air flow Meter - Broil - 300mm', 'working temp - Sensor: -40? ~+220?
Transmitter: -20? ~+45?', NULL, NULL, 93000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Thermal Insertion Type Air flow Meter'), NULL, 'Thermal Insertion Type Air flow Meter - Broil - 400mm', 'Output - 4-20mA, RS485
IP65', NULL, NULL, 100500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Schmidt'), (select id from public.sensor_categories where name = 'Thermal Insertion Type Air flow Meter'), 'SS 20.260', 'Thermal Insertion Type Air flow Meter - Schmidt - 350mm', 'Protection class - IP65', 'Schmidt', 'P3
Suitable for internal 
applications only', 75000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Thermal Insertion Type Air flow Meter'), NULL, 'Thermal Insertion Type Air flow Meter - Schmidt - 500mm', 'Output - 4-20mA', NULL, NULL, 90000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Thermal Insertion Type Air flow Meter'), NULL, NULL, 'Installation Position - Any', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Addmass'), (select id from public.sensor_categories where name = 'Thermal Mass Air flow Meter'), NULL, 'Thermal Mass Type Air flow Meter - 25mm', NULL, NULL, NULL, 55000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Forbes Marshell'), (select id from public.sensor_categories where name = 'Vortex type air flow meter'), NULL, 'Vortex Type Air flow Meter - 80mm', NULL, NULL, NULL, 220000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'ABB'), (select id from public.sensor_categories where name = 'Vortex type air flow meter'), NULL, 'Electromagnetic Flow Meter - 50MM', NULL, NULL, NULL, 90000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'E&H'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 150MM'), NULL, 'Electromagnetic Flow Meter - 50MM', NULL, NULL, NULL, 150000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'SIEMENS'), (select id from public.sensor_categories where name = 'FOR STP'), NULL, 'Electromagnetic Flow Meter - 50MM', NULL, NULL, NULL, 93400);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'SIEMENS'), (select id from public.sensor_categories where name = 'FOR WTP'), NULL, 'SITRANS FMS500 Magnetic flow sensor
Make : Siemens
Model No. : 7ME6532-4HJ03-1GA3-Z A00
Line Size: 6" (150 mm)', NULL, NULL, NULL, 75650);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'SIEMENS'), (select id from public.sensor_categories where name = 'SITRANS FMS500 Magnetic flow sensor
Make : Siemens
Model No. : 7ME6532-4PJ03-1GA3-Z A00
Line Size: 8" (200 mm)'), NULL, 'Averaging Pitot Tube
Type: Direct Mount with 3 Valve manifold
Pipe Size : NPS 12, SCH : 40
Probe Size : 34 mm
Probe Shape : Diamond
End Support:Will be provided
Instrument Connection : 1 No. 3-Valve Manifold,
½” NPT (F)
Probe Material : SS316
3-Valve Manifold
Packing PTFE
Valve Manifold Material: SS316
Sleeve Material: SS316
End Coupling Material: SS316

Accessories
* DP Transmitter - 01 No.
Make: Siemens
Model No.: 7MF0340

* Impluse tube - 20 Mtr.
 
* CS Pipe - 06 No.', NULL, NULL, NULL, 104000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'XYLEM'), (select id from public.sensor_categories where name = 'SITRANS FMS500 Magnetic flow sensor
Make : Siemens
Model No. : 7ME6532-4PJ03-1GA3-Z A00
Line Size: 8" (200 mm)'), NULL, 'Electromagnetic Flow Meter - 50MM', NULL, NULL, NULL, 93400);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Electromagnetic Flow Meter - 80MM'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 150MM'), '9555', NULL, '27300', '36855', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Electromagnetic Flow Meter - 80MM'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 150MM'), '28000', NULL, '80000', '108000', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Electromagnetic Flow Meter - 80MM'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 150MM'), 'Only supply and installation will be charged 10000 extra', NULL, '36855', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Electromagnetic Flow Meter - 80MM'), (select id from public.sensor_categories where name = 'Electromagnetic Flow Meter - 150MM'), NULL, NULL, '108000', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Brotek'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), 'BT-UL-06', 'Ultrasonic Level Transmitter', 'Size - 0-5mtr
Output - 4-20mA', 'Brotek ULT', 'P1', 9800);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), 'BT-UL-10', 'Ultrasonic Level Transmitter', 'Size - 0-10mtr
Output - 4-20mA', NULL, 'Suitable for Internal applications
and used in open tanks', 16000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'UPC'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), NULL, 'Ultrasonic Level Transmitter', 'Size - 0-5mtr
Output - 4-20mA', NULL, NULL, 14000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'PUNE TECHTROL'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), NULL, 'Ultrasonic Level Transmitter', 'Size - 0-5mtr
Output - 4-20mA', NULL, NULL, 13000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Trumen'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), 'TLU', 'Ultrasonic Level Transmitter', 'Size - 0-5mtr
Output - 4-20mA', 'Trumen ULT', 'P2', 23000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), NULL, 'Ultrasonic Level Transmitter', 'Size - 0-10mtr
Output - 4-20mA', NULL, 'Suitable for Internal applications', 25200);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Sapsonic'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), NULL, 'Ultrasonic Level Transmitter', 'Size - 0-10mtr
Output - 4-20mA', NULL, 'Not tested yet', 22000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Addmass'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), 'AULT-10M', 'Ultrasonic Level Transmitter', 'Size - 0-10mtr
Output - 4-20mA', 'Addmass ULT', 'P3

Suitable for Internal applications', 20500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Siemens'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), 'SITRANS Probe LU240 Ultrasonic level transmitter
Make: Siemens
Model No.: 7ML5110-1DD07-4AK3', 'Ultrasonic Level Transmitter', 'Size - 0-6mtr
Output - 4-20mA', 'Siemens ULT', 'P3

Suitable for Internal & External applications', 40000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'ABB'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), 'LST200', 'Ultrasonic Level Transmitter', 'Size - 0-8mtr
Output - 4-20mA', 'ABB ULT', 'P3

Suitable for Internal applications', 38500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'E&H'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), 'FMU30-AAHGAARGF+Z1', 'Ultrasonic Level Transmitter', 'Range - 0-5mtr
Output - 4-20mA', NULL, NULL, 74300);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'P&F'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), 'UC6000-30GM-IUR2-V15', 'Ultrasonic Level Transmitter', 'Range - 0-5mtr
Output - 4-20mA', 'https://drive.google.com/file/d/1Hc82FuEWqQC7BFLXRAnO9RZkL3z3v2Bp/view?usp=sharing', NULL, 13000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'XYLEM'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), NULL, 'Ultrasonic Level Transmitter', 'Range - 0-5mtr
Output - 4-20mA', NULL, NULL, 72000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'TOSHNIWAL'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), NULL, 'Ultrasonic Level Transmitter', 'TLU1000A1-A10DC24A1N
Ultrasonic Level Transmitter:
Principle: Non-contact, Ultrasonic Pulse,
Type: Integral Mount;
Housing Material: ABS
Antenna Material : ABS
Measuring Range : 6 Meters;
Power Supply : 12V~36V DC
Wire System : 2-Wire (For DC Only)
Output : 4~20mA with RS485
Accuracy : 0.5%
Process Connection : G2 Thread', NULL, NULL, 21500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'SBEM'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), NULL, 'Ultrasonic Level Transmitter', 'SBEM Make Ultrasonic Level Transmitter
Model No: 136 UP T AM 01 08 01 00 00 1
A:Type of Transmitter:Two Wire ( 4-20 mA)
M:Cable Entry:With Display M20* 1.5
01:Sensor Material:PP
08 : 08m (With Display)
01:Display Version:With Display
00:Slip-on Flange:Not Applicable
00:Material of Construction for Slip-on flange:Not Applicable
1:Power Supply:24 VDC', NULL, NULL, 30000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Forbe Marshall'), (select id from public.sensor_categories where name = 'Ultrasonic Level Transmitter'), NULL, 'Ultrasonic Level Transmitter', 'Range - 0-5mtr
Output - 4-20mA', NULL, NULL, 60000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Vega'), (select id from public.sensor_categories where name = 'Radar Level Transmitter - Vega'), 'VEGAPULS C 11', 'Radar Level Transmitter', 'Size - 8mtr
Output 4-20mA', 'Vega Radar', 'P3

Suitable for Internal & External application', 50000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Siemens'), (select id from public.sensor_categories where name = 'Radar Level Transmitter - Vega'), 'SITRANS LR150', 'Radar Level Transmitter', 'Size - 8mtr
Output 4-20mA', 'Siemens Radar', 'P3

Suitable for Internal applications', 68500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'EIP'), (select id from public.sensor_categories where name = 'Radar Level Transmitter - Vega'), 'CW59C-P-A-C-GD-B-D-B-10', 'Radar Level Transmitter', 'NON CONTACT RADAR LEVEL
TRANSMITTER', NULL, NULL, 15900);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'TOSHNIWAL'), (select id from public.sensor_categories where name = 'Radar Level Transmitter - Vega'), NULL, 'Radar Level Transmitter', 'TLR1000B9-W10GNMT-TM
Radar Level Transmitter:
Type : FMCW, Non-contact type
Application: Liquid
Wave Frequency : 80GHz
Beam Angle : 3 Deg C
Antenna Material : PTFE
Measuring Range : 0 to 6 Meter
Process Connection : G2 Thread
Process Temperature : -40~80 Deg C
Process Pressure : Normal atm. pressure
Cable Entry : M20X1.5(F)
Housing Material : Cast Aluminium
Output : 4-20mA with Modbus
Power Supply : 2-wire; 24V DC
Accuracy : +/- 2mm
IP Rating: IP67
Display : Integral LCD Display', NULL, NULL, 39300);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'SBEM'), (select id from public.sensor_categories where name = 'Radar Level Transmitter - Vega'), NULL, 'Radar Level Transmitter', 'SBEM Make 138-W51-Radar Level Transmitter Liquid & Solids
Model No: 138 W51 1 1 0 41 0 10
1:Measuring Range:Liquid
1:Process Connection:Slip on Flange
0:Signal Output:4-20mA
41:Slip-on Flange:4" Flanged
0:MOC-Slip-on Flange:Polypropylene (PP)
10:Cable Length:10 M
: :Please click below link to view leaflet
www.sbeminstruments.com/wp-content/uploads/2025/02/LF-138-0814-R02.pdf', NULL, NULL, 55000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'E&H'), (select id from public.sensor_categories where name = 'Radar Level Transmitter - Vega'), 'FMR20-AAABMWDEVEE3+Z1', 'Radar Level Transmitter', 'Range - 0-10mtr', NULL, NULL, 112700);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Trumen'), (select id from public.sensor_categories where name = 'Capacitance Level Transmitter - Trumen'), 'TLC2', 'Capacitance Level Transmitter', 'Process Pressure absolute 
max. 20 bar', 'Trumen CLT', 'P1

Suitable for Internal & External applications', 23000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Pune Techtrol'), (select id from public.sensor_categories where name = 'Capacitance Level Transmitter - Trumen'), NULL, 'Capacitance Level Transmitter', 'Range - 0-5mtr', NULL, 'Received price verbally on a call', 12000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Siemens'), (select id from public.sensor_categories where name = 'Capacitance Level Transmitter - Trumen'), 'SITRANS LC300', 'Capacitance Level Transmitter', 'Size - 25mtr
Process pressure - upto 35bar', 'Siemens Capacitance', 'P3

Suitable for Internal applications', 166190);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Blueseas'), (select id from public.sensor_categories where name = 'WLC - Blueseas'), NULL, 'WLC', NULL, NULL, NULL, 285);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Pune Techtrol Pvt Ltd.'), (select id from public.sensor_categories where name = 'WLC - Blueseas'), NULL, 'WLC ( 4 Point)', NULL, NULL, NULL, 7265);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Brotek'), (select id from public.sensor_categories where name = 'Modbus Output - ULT'), NULL, 'Ultrasonic Level Transmitter - Brotek', 'Range: Up to 6m

Blind Spot: O.3m
Error difference : 土0. 3%F. S
Display: OLED
Keyboard: Three-digit patch keys
Frequency: 20 to 350KHz
Power supply: DC18-28V
Power: <0. 6W
Output : RS485
Instrument material: ABS engineering
plastics
Dimensions: Φ75mmX 132mm X G1
1/2
Installation interface: G1 1/2 tube thread
with going ring (diameter 47mm)
Protection rating: IP65', NULL, NULL, 10500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Brotek'), (select id from public.sensor_categories where name = 'For Fuel Tank'), NULL, 'Ultrasonic Level Transmitter - Brotek', 'Range: Up to 10m

Blind Spot: O.3m
Error difference : 土0.3%F. S
Display: OLED English menu
Keyboard: Three-digit patch keys
Frequency: 20 to 350KHz
Power supply: DC18-28V
Power: <0. 6W
Output : 4 to 20mA
Sensor material: ABS engineering plastics
Enclosure material : Die-Cast Aluminium
Installation interface: M60X2 or 61mm
round hole with large gong ring
Protection rating: IP65', NULL, NULL, 26500);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Brotek'), (select id from public.sensor_categories where name = 'For Fuel Tank'), NULL, 'Radar Level Transmitter - Brotek', 'Application : Liquid Storage Tank
Measuring medium:Liquid
Measuring Range : 10 Meter
Process Connection:11⁄2” BSP Thread
Process Temperature: -40~85oC
Process Pressure: -0.1~2MPa
Humidity : ≤95%RH
Antenna material: PTFE / integral filling
Accuracy: ±1mm
Frequency: 76-81 GHz
Antenna type : Lens antenna
Launch angle: 8°
Power Supply:15~28VDC
Signal output: 4...20mA/HART
Outer casing : Die-Cast Aluminium
Protection Level: IP67
Explosion-proof Grade : ExdiaIICT6', NULL, NULL, 63000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'ABB'), (select id from public.sensor_categories where name = 'For Fuel Tank'), NULL, 'Ultrasonic differential level transmitter (0-5 MTR)', NULL, NULL, NULL, 108358);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'E&H'), (select id from public.sensor_categories where name = 'Ultrasonic differential level transmitter (0-10 MTR)'), NULL, 'Ultrasonic differential level transmitter (0-5 MTR)', NULL, NULL, NULL, 65000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'FORBE MARSHALL'), (select id from public.sensor_categories where name = 'Ultrasonic differential level transmitter (0-10 MTR)'), NULL, 'Ultrasonic differential level transmitter (0-5 MTR)', NULL, NULL, NULL, 190000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'SIEMENS'), (select id from public.sensor_categories where name = 'Ultrasonic differential level transmitter (0-10 MTR)'), NULL, 'Ultrasonic differential level transmitter (0-5 MTR)', NULL, NULL, NULL, 89290);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Measuring Range: 0 to 20.00 mg/l
2. Output: RS 485 Modbus
3. Working condition: 0 to 60°C,
4. Power Supply: 9 to 12 VDC, Current <50mA
5. Protection: IP 68'), (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), 'Aquadax', NULL, 'ODO 20S', 'P2
It can be used for Internal & External Applications', 'It will be installed in the Aeration tanks where air is supplied by blowers to monitor the DO in the tank. 
It is a DIP type sensor which will always be dipped in the tank. 
Calibration and cleaning needs to be done atleast once every month. 

In case of high sludge content in the aeration tank, consider making an arrangement with ball (like done in EMS)

For transmitter consider a canopy to avoid water entering the transmitter.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Range 0-20 mg/L 
Measurement Technology: Optical 
Temperature: 0-50 degC 
Pressure 3 bar 
Sensor Housing Material: POM + SS316 
Sensor Cable : 10 Meters 
Sensor IP Rating: IP68'), (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), NULL, NULL, 'BI 1360', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Advanced Premium Optical DO+ Temperature Sensor BH-
505A(2 in 1 Sensor)

Range : 0-20 mg/L
Accuracy : +/-3%
Temperature : 0 to 50 Degree
Output : RS485
Protection Grade : IP68
MOC : SS
Cable Length : 5 M'), (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. IP65'), (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), 'Forbes Marshell', NULL, 'AquaMax', 'P1
It can be used for Internal Applications
Not getting positive response from Domain team. Need to search vendors.', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Type of Input - DO Electrode
2. Output - RS485, 4-20mA
3. Weatherproof IP 67'), (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), 'DO Sensor', NULL, 'DO - 100S', 'P3
It can be used for Internal Applications', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), 'DO sensor with Transmitter', NULL, NULL, 'DO sensor with Transmitter', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Transmitter and Sensor - 2 year warranty'), (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Measuring Range 0 - 20.00 ppm, 0 - 20.0 mg/L, 0 - 200% saturation
2. No Calibration required
3. IP68'), (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), 'Hach', NULL, 'LDO® Probe, Model 2', 'P3
It can be used for Internal & External Applications', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Sensor with Transmitter'), (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Dissolved Oxygen: 0 to 20 mg/L (ppm)
Liquid Temperature: 0 to 40 ̊C
Liquid Pressure: 0 to 100 kPa
Flow speed: 20 cm/s or more'), (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), 'Yakogawa', NULL, 'DO30G', 'P3
It can be used for Internal & External Applications', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), NULL, NULL, 'COS61D', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Method: Fluorescence method
Range: 0-20 ppm
Cable length: 10 mtr
Accuracy: ±5%
Body:SUS316L
Digital RS485 output
IP68 rating'), (select id from public.sensor_categories where name = 'DO Sensor

(DIP type Sensor- Installed in the tank)'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Measuring range - 0-14 PH
2. Working temp - 0-60 degree cel
3. IP Grade - IP68
4. Data Output - Modbus/RS485'), (select id from public.sensor_categories where name = 'pH Sensor'), 'PH Sensor', NULL, 'PH14D', 'P1
It can be used for Internal & External Applications', 'Can be DIP type or flow type (installed in line). Body is made of glass or PTFE.

Electrode life is only 1 year. Needs to be replaced every year. Transmitter can be reused. 

Needs calibration every 15-30 days. Regeneration of electrode to be done using KCl solution. For Flow type, prefer PTFE sensor. 


 pH has a relation with Temeprature, so prefer pH and temperature together to note any fluctuation.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Advanced Online pH+Temperature Sensor FLDBHG-106(2
in 1 Sensor)
Range : 0-14 pH
Accuracy : +/-0.01 pH
Temperature : 0 to 65 Degree
Pressure Range : 0-2 Bar
Output : RS485
Protection Grade : IP68
Shell Material : POM
Cable Length :5 M'), (select id from public.sensor_categories where name = 'pH Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Transmitter and Sensor'), (select id from public.sensor_categories where name = 'pH Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Measuring range - 0-14 PH
2. Temp Range - 0-105 Degree cel
3. Flow rate - 0-2m/s
4. Pressure range - 0-6.9 bar at 100 degree cel'), (select id from public.sensor_categories where name = 'pH Sensor'), 'Hach', NULL, 'DPC1R1A', 'P2
It can be used for Internal & External Applications', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'ProMinent make compact controller for pH
with LCD display with temperature correction
pt 1000 with P / PID controller with pulse,
relay and analogue output 0/4-20 mA for
controlling one pump with sen'), (select id from public.sensor_categories where name = 'pH Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'ORP with chlorine dosing pump'), (select id from public.sensor_categories where name = 'pH Sensor'), NULL, 'ORP Sensor', NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Online ORP/Temp Controller with pH Sensor and 5m Cable 
2. Output - 1 x 4-20mA, Modbus, Relays, 100 to 240 VAC 
3. Range: -1000 to +1000 mV
4. IP68'), (select id from public.sensor_categories where name = 'pH Sensor'), 'Aquadax ORP', NULL, 'ADVIT PRO ORP14', 'P1
It can be used for Internal & External Applications', 'ORP range needs to be finalised based on application. Prefer ph and ORP together. 
 For RO application, flow type is preferred.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Advanced ORP Sensor FLDBH2733DAR
Range : -1500 - +1500 mV
Accuracy : +/-20 mV
Temperature : 0 to 50 Degree
Pressure Range : 0-2 Bar
Output : RS485 
Protection Grade : IP68
Shell Material : POM
Cable Length : 5 M'), (select id from public.sensor_categories where name = 'pH Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Sensor with transmitter'), (select id from public.sensor_categories where name = 'pH Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'ProMinent make compact controller for ORP
with LCD display with temperature correction
pt 1000 with P / PID controller with pulse,
relay and analogue output 0/4-20 mA for
controlling one pump with sen'), (select id from public.sensor_categories where name = 'pH Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'MLSS(TSS) Sensor'), NULL, NULL, NULL, 'P1 (only for STP)
It can be used for Internal & External Applications', 'MLSS sensor will be quoted in the biological reactor. Range of MLSS is around 1500-6000 ppm (Depending on type of bioreactor). Sensor will be DIP type. MLSS measures the biomass in the bioreactor. 

TSS sensor can be flow or DIP type. Range will depend on the area of application. TSS measures the solids in the tank.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Sensor with transmitter (Range- 0-10,000 ppm)'), (select id from public.sensor_categories where name = 'MLSS(TSS) Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Advanced Premium MLSS + Temperature Sensor With Self
Cleaning Brush FLDBH7865D
Range : 0-50000 mg/L
Accuracy : +/-10%
Temperature : 0 to 45 Degree
Pressure Range : 0-2 Bar
Output : RS485
Protection Grade : IP68
Shell Material : SS'), (select id from public.sensor_categories where name = 'MLSS(TSS) Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'VizSens-SS Online TSS Sensor
Method: Infrared absorption scattered light.
Range: 0-20,000
Self Cleaning Brush
Cable length: 10 mtr
Accuracy: ±5%
Body:SUS316L
Digital RS485 output
IP68 rating'), (select id from public.sensor_categories where name = 'MLSS(TSS) Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'MLSS(TSS) Sensor'), NULL, NULL, 'ViSolid 700 IQ', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Range - Turbidity (TRB): 0.001 - 9999 NTU
Solids (TSS): 0.001 - 500 g/L
2. working temp - 0 - 50 °C'), (select id from public.sensor_categories where name = 'MLSS(TSS) Sensor'), 'Hach', NULL, 'TSS sc', 'P2
It can be used for Internal & External Applications', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Measuring Range - 0-20 NTU
2. Working Temp - 5-40 degee cel
3. Analog interface - 4-20mA
4. Calibration - One or two points calibration
5. Installation method - Flow through cell installtion, submerged installation'), (select id from public.sensor_categories where name = 'Turbidity Sensor'), 'Aquadax', NULL, 'T400S', 'P1 (only for STP)
It can be used for Internal & External Applications', 'Turbidity sensor needs to be installed in a flow cell (black colour tank). Its pricing needs to be added with the sensor. Turbidity sensor range will depend on unit of application. (for Primary it can go upto 500 NTU). 

Turbidity has a relation with TSS, so either turbidity or TSS sensor can be used.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Advanced Premium Optical Turbidity + Suspended Solids+
Tracability + Temperature Sensor BH1400D(4 in 1 Sensor)
Range : 0-4000 NTU
Accuracy : +/-5%
Temperature : 0 to 45 Degree
Pressure Range : 0-3 Bar
Output : RS485
Protection Grade : IP68
Working Principle : 900 Scatered Light
Shell Material : PVC, SS'), (select id from public.sensor_categories where name = 'Turbidity Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Range 0-200 NTU 
Measurement Technology: 90 degree IR scattered light method 
Temperature: 0-50 degC 
Flow Through Type Turbidity sensor'), (select id from public.sensor_categories where name = 'Turbidity Sensor'), NULL, NULL, 'Agasthya 2021 series', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Measuring Range - 0.001 to 4000 NTU
2. Working temp - 0 to 40 °C (32 to 104°F)'), (select id from public.sensor_categories where name = 'Turbidity Sensor'), 'Hach', NULL, '2983700', 'P2
It can be used for Internal & External Applications', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Sensor with Transmitter'), (select id from public.sensor_categories where name = 'Turbidity Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Turbidity Online Analyzer'), (select id from public.sensor_categories where name = 'Turbidity Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Turbidity sensor with wiper'), (select id from public.sensor_categories where name = 'Turbidity Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Self cleaning turbidity sensor
2. Output - RS485, supports modbus
3. Range - 0-1000 NTU
4. IP68'), (select id from public.sensor_categories where name = 'Turbidity Sensor'), 'Desun Uniwill', NULL, 'DST410', 'P3
It can be used for Internal & External Applications', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Temp range - 0-50 degree cel
2. Pressure range - 5bar
3. IP68'), (select id from public.sensor_categories where name = 'Conductivity Sensor'), 'Aquadax', NULL, 'Advit EC 2000', 'P1
It can be used for Internal & External Applications', 'Range to be decided based on application. Mostly preferred for RO applications.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Sensor with transmitter'), (select id from public.sensor_categories where name = 'Conductivity Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'ProMinent make compact controller for
conductivity with conductivity sensor LFTK-1
20mS/CM, with sensor housing & cable'), (select id from public.sensor_categories where name = 'Conductivity Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Temp range - –20 to 200°C
2. Flow Rate - 0–3 m/s (0–10 ft./s)'), (select id from public.sensor_categories where name = 'Conductivity Sensor'), 'Hach', NULL, 'D3422A1', 'P2
It can be used for Internal & External Applications', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Total Hardness - 20-500ppm'), (select id from public.sensor_categories where name = 'Conductivity Sensor'), NULL, 'Hardness Analyzer', NULL, NULL, 'Range will depend on its application.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Total Hardness - 0-500ppm'), (select id from public.sensor_categories where name = 'Conductivity Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Total Hardness - 20-500ppm'), (select id from public.sensor_categories where name = 'Conductivity Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Conductivity Sensor'), NULL, 'Alkalinity Analyzer', NULL, NULL, 'Not sure of its working. Need to get its technical specification to understand its priciple.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Ammonium Nitrogen'), NULL, NULL, '61000', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Ammonium Nitrogen'), NULL, NULL, '105000', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Ammonium Nitrogen'), NULL, NULL, '52000', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Ammonical Nitrogen & Nitrate Sensor'), NULL, 'Online pH, Ammonical Nitrogen & Nitrate Sensor (Make : S:CAN)', NULL, NULL, 'Will be used in biological reactor to monitor the ammonia. Range will depend on industry effluent. 
Ammonical Nitrate and ammonia has a correlating factor so can be used in to monitor the ammonia.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Phosphorous Analyzer'), NULL, 'Online Total Phosphorous Analyzer (Make : S:CAN) Axis Nano', NULL, NULL, 'WIll be used in biological reactor. Need to check the specifications.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Range: 
COD-600 ppm
BOD- 300 ppm'), (select id from public.sensor_categories where name = 'Phosphorous Analyzer'), NULL, 'COD Sensor', NULL, NULL, 'COD sensors will be used mostly in ETP at different stages. Range will depend on the tank of installation depending on the the parameters of the tanks.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Range: 
COD-1100 ppm 
BOD- 350 ppm
Range: 
COD-2200 ppm 
BOD- 700 ppm'), (select id from public.sensor_categories where name = 'Phosphorous Analyzer'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Transmitter and sensor'), (select id from public.sensor_categories where name = 'Phosphorous Analyzer'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '(Range -  0 - 1000 ppm)'), (select id from public.sensor_categories where name = 'Phosphorous Analyzer'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Phosphorous Analyzer'), NULL, 'FRC Sensor', NULL, NULL, 'FRC sensor range will be mostly 0-10 ppm. It will be both DIP or flow type depending upon applicaiton.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'ProMinent make compact controller for
Chlorine CLB 0- 2 mA 0-5 ppm sensor, sensor
housing and cable'), (select id from public.sensor_categories where name = 'Phosphorous Analyzer'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Sensor & Transmitter 
Capacity : upto 7000ppm'), (select id from public.sensor_categories where name = 'TDS Meter'), '0-50,000 ppm', NULL, '1,08,000', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Sensor & Transmitter'), (select id from public.sensor_categories where name = 'TDS Meter'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Odour Control Sensor'), NULL, 'GV108 Sensor Module - H2S gas Detector', NULL, NULL, 'Wall mounting type sensor to identify the gas in the area (can be methane, VOC, H2S)', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Material - SS316L
2. Weight - 15kg
3. Protection class - IP65
4. Operating Temp - 5 ... 55°C
5. Data Transfer - USB type A
6. Output - RS485, 4-20mA
7. IP65'), (select id from public.sensor_categories where name = 'Armored Cable - Armored Cable 0.5sq mm 4 Core'), 'Hamera', 'Online Monitoring Services (pH,BOD,COD & TSS)', 'L800', 'It can be used for Internal Applications', 'Trios response is not good as per domain team. 

Self cleaning sensor should be preferred. Calibration standards should be purchased along with the sensor.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Online Multi Channel Controller for pH/BOD/COD/TSS Display
2. 1 x RS 485 Modbus, 2 x 4-20mA Analog Output, Relays, 220 VAC 
3. Range: Check range from catalog
4. TUV Germany Certified, Meets CPCB Guidelines, More than 500+ Installations'), (select id from public.sensor_categories where name = 'Armored Cable - Armored Cable 0.5sq mm 4 Core'), NULL, NULL, 'Tribox Mini Controller with LISA and TpH Sensor, Make: Trios Germany', 'It can be used for Internal & External Applications', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Armored Cable - Armored Cable 0.5sq mm 4 Core'), NULL, NULL, 'UV300', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Armored Cable - Armored Cable 0.5sq mm 4 Core'), NULL, NULL, '615000', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'BOD/COD/TSS: 0 - 1000 mg/l
pH: 0-14
TDS: 0-1000 (mg/L)
Ranges are customizable'), (select id from public.sensor_categories where name = 'Armored Cable - Armored Cable 0.5sq mm 4 Core'), NULL, NULL, '495000', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Model: Viz-Eco-EQMS'), (select id from public.sensor_categories where name = 'Armored Cable - Armored Cable 0.5sq mm 4 Core'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Measuring range - 0.35 ~ 10m
2. Operating temp - -20 ~ +70°C
3. Output - 4~20mA
4. IP67'), (select id from public.sensor_categories where name = 'Armored Cable - Armored Cable 0.5sq mm 4 Core'), 'Wess Measurement', 'Ultrasonic Sludge Level Sensor (Sludge Blanket Sensor)', 'ENV120', 'It can be used for Internal Applications', 'Sludge blanket sensor needs to be purchased for automating lsudge removal. 
Its range will depend upon clarifier and sludge depth. Discuss about self cleaning option.', NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Measuring range - Mud position - 0.2~12m
2. Temperature:0~50.0°C
3. IP65'), (select id from public.sensor_categories where name = 'Armored Cable - Armored Cable 0.5sq mm 4 Core'), 'Sino Inst', NULL, NULL, 'It can be used for Internal Applications', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Armored Cable - Armored Cable 0.5sq mm 4 Core'), NULL, NULL, 'KTO: SONATAXsc PROBE & PIVOT MOUNTING', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Location - Effluent of IC reactor, biomass recirculation line
and influent (Inlet location optional; dependent
on wastewater characteristics)
2. Temp - -40 to 60° C
3. Range - 0-10000 mg/l for COD
4. Output - 4-20 mA. DC, Isolated
5. IP67'), (select id from public.sensor_categories where name = 'Sentry Sensor - Water Monitoring Services'), 'Sentry', '1. Control and data management panel
2. sensors (The sensors are set to send a signal once every minute)
3. Cable Length Will Be 100m for Each Probe', 'SP2-03', 'It can be used for Internal Applications', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Inlet :
COD - 0-1000ppm
BOD- 0-1000ppm
TSS- 0-1000ppm
PH - 0-14 PH
Outlet:
COD - 0-1000ppm
BOD- 0-1000ppm
TSS- 0-1000ppm
PH - 0-14 PH
Datalogger with 1year connectivity to CPCP and SPCB except TN, Sikkim, kerala'), (select id from public.sensor_categories where name = 'Sentry Sensor - Water Monitoring Services'), NULL, 'Online Monitoring system', 'Hemera L800', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Sentry Sensor - Water Monitoring Services'), NULL, NULL, 'UV-VIS SPECTRO PHOTOMETRY', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Measurement Rage - 0-100ppm, SiO2

Reagent''s life is 90 days. Reagent will be available @ Extra cost of 75,000/- INR'), (select id from public.sensor_categories where name = 'Sentry Sensor - Water Monitoring Services'), NULL, 'Silica Analyser', '5500 SC', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Measurement Rage - 0-100ppm, SiO2

Reagent will be available @ Extra cost of 35,000/- INR.'), (select id from public.sensor_categories where name = 'Sentry Sensor - Water Monitoring Services'), NULL, NULL, 'CA 6', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Measuring Method: Colorimetric
Power Supply: 230 VAC
Output: 4-20 mA Analog
Sample Temperature: 10 °C - 30 °C
Protection: IP55


Includes-
 One initial set of reagents
 Sample pot
 25 microns manual cleaning filter'), (select id from public.sensor_categories where name = 'Sentry Sensor - Water Monitoring Services'), NULL, NULL, 'Model: Micromac C Silicates', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Measuring Range: 0-100 ppm Si'), (select id from public.sensor_categories where name = 'Sentry Sensor - Water Monitoring Services'), NULL, NULL, 'UV300', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Dual Channel Transmitter with one pH & one FRC sensor'), (select id from public.sensor_categories where name = 'PH, FRC, Turbidity & TDS Analyser'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Dual Channel Transmitter with one TDS & one Turbidity sensor'), (select id from public.sensor_categories where name = 'PH, FRC, Turbidity & TDS Analyser'), NULL, NULL, NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Capacity - 5 N.m (0.37 KW & RPM 910)'), (select id from public.sensor_categories where name = 'PH, FRC, Turbidity & TDS Analyser'), NULL, 'Rotary Torque Sensor (Transformer type)', NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Capacity - 5 N.m (0.37 KW & RPM 910)'), (select id from public.sensor_categories where name = 'PH, FRC, Turbidity & TDS Analyser'), NULL, 'Rotary Torque Sensor (Optical type)', NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'https://drive.google.com/file/d/1Tf-88fQqfcyFLWWiQem1zzNywONG3k4P/view?usp=drive_link'), (select id from public.sensor_categories where name = 'PH, FRC, Turbidity & TDS Analyser'), NULL, 'Fluoride Analyzer', NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'PH, FRC, Turbidity & TDS Analyser'), NULL, 'Flouride Sensor online', '2 year warranty', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'https://drive.google.com/file/d/1LBJAoS_Jh7Mu6gA-F81MMjvplnaOefzc/view?usp=drive_link'), (select id from public.sensor_categories where name = 'PH, FRC, Turbidity & TDS Analyser'), 'https://drive.google.com/file/d/1MaUdXNXTJf9v_TbbMpySIPwhm-UXl3Wg/view?usp=drive_link', 'Fluoride sensor (lab based) + Reagent', NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'FORBE MARSHALL'), (select id from public.sensor_categories where name = 'HIGH PRESSURE SWITCH'), NULL, 'LOW PRESSURE SWITCH', NULL, NULL, NULL, 5250);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'DANFOSS'), (select id from public.sensor_categories where name = 'HIGH PRESSURE SWITCH'), NULL, 'LOW PRESSURE SWITCH', NULL, NULL, NULL, 2000);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'MAKE'), (select id from public.sensor_categories where name = 'HIGH PRESSURE SWITCH'), NULL, 'ITEM DESCRIPTION', NULL, NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'ABB'), (select id from public.sensor_categories where name = 'HIGH PRESSURE SWITCH'), NULL, 'Differrential Pressure transmitter (0-1 BAR)', NULL, NULL, NULL, 39095);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'SIEMENS'), (select id from public.sensor_categories where name = 'Differrential Pressure transmitter (0-6 BAR)'), NULL, 'Differrential Pressure transmitter (0-1 BAR)', NULL, NULL, NULL, 35150);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Temperature Sensor'), NULL, 'Temperature Sensor - RTD', 'RTJ200-S-A3-A-6-50-5-TT', 'P1', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Temperature Sensor'), NULL, 'Humidity Sensor', 'HTW201', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Connection location - Horizontal and vertical pipe mounting
Flow direction in line with the arrow marking on the process connection
2. IP30'), (select id from public.sensor_categories where name = 'Temperature Sensor'), 'wika', 'Flow Switch', 'FSM-6100', 'P1', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = '1. Operating pressure - 10kgf/cm² (1000KPa)
2. Temp of fluid - Max 100°C (212°F)'), (select id from public.sensor_categories where name = 'Temperature Sensor'), 'Honeywell', NULL, 'WFS-6000', 'P2', NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Temperature Sensor'), NULL, 'Energy Meter', 'EM306', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (NULL, (select id from public.sensor_categories where name = 'Temperature Sensor'), NULL, NULL, 'WL400011OOOO', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Capacity - 1KVA , 2 in built battery & half hr battery backup'), (select id from public.sensor_categories where name = 'Temperature Sensor'), NULL, 'UPS', 'NM24EM1KK11-IB', NULL, NULL, NULL);
insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values ((select id from public.sensor_makes where name = 'Capacity - 1KVA , 3 in built battery & half hr battery backup'), (select id from public.sensor_categories where name = 'Temperature Sensor'), NULL, NULL, NULL, NULL, NULL, NULL);

-- PLCs
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Siemens', 'CPU ST40 -Siemens', 'CPU ST40 -Siemens', NULL, 'P3', 20596.8);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('CPU ST60 - Siemens', 'SM DI08', 'SM DI08 - Siemens', NULL, 'Higher cost', 3323.2);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Mitsubishi', 'FX5U64MT-ESS', 'FX5U64MT-ESS - Mitsubishi', NULL, 'P3', 38775);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('FX5-16EX/ES - Mitsubishi', 'FX5-8EY/ES', 'FX5-8EY/ES - Mitsubishi', NULL, 'Higher cost', 5250);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Delta', 'PLC DVP 16DI 12DO', 'PLC DVP 16DI 12DO', NULL, 'P2', 13722.5);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Delta', 'Expansion Card 16DI', 'Expansion Card 16DI', NULL, NULL, 10254.75);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Delta', 'Expansion Card 16DO', 'Expansion Card 16DO', 'DELTA_IA-PLC_DVP_TP_C_EN_20220906.pdf', 'Lower cost', 4031.5);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Expansion Card 8DO', 'Expansion Card 4AI', 'Expansion Card 4AI', NULL, NULL, 6019.75);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Expansion Card 4AI', 'AS228P-A', 'AS228P-A', '16 DIGITAL INPUT & 12 DIGITAL OUTPUT', 'CPU', 20295);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Expansion Card 4AI', 'AS32AM10N-A', 'AS32AM10N-A', '32 DIGITAL INPUT MODULE', 'DI MODULE', 8978.75);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Expansion Card 4AI', 'AS32AN02T-A', 'AS32AN02T-A', '32 DIGITAL OUTPUT MODULE', 'DO MODULE', 9193.25);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Expansion Card 4AI', 'AS04AD-A', 'AS04AD-A', '4 CH ANALOG INPUT MODULE', 'AI MODULE', 9619.5);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Expansion Card 4AI', 'AS06XA-A', 'AS06XA-A', '4 CH ANALOG INPUT AND 2 CH ANALOG OUTPUT MODULE', 'AI/AO MODULE', 10903.75);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Expansion Card 4AI', 'DOP-110WS', 'DOP-110WS', '7'''' HMI WITH ETHERNET PORT', 'HMI', 32635.2);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Expansion Card 4AI', 'PLC DVP 8DI, 4DO with ethernet port', 'PLC DVP 8DI, 4DO with ethernet port', 'DVP12SE11R', NULL, 12655);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Expansion Card 4AI', '8DI, 8DO', '8DI, 8DO', 'DVP16SP11R', NULL, 3107);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('L&T', 'U – Series PLC', 'U – Series PLC', NULL, 'P3', 31080);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('Digital Input', 'Digital Output', 'Digital Output', NULL, 'higher cost', 19320);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Fuji', 'VFD-0.75kw', 'VFD-0.75kw', NULL, 'P1', 10360);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-1.5kw', 'VFD-2.2kw', 'VFD-2.2kw', NULL, 'Lower cost', 14500);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-1.5kw', 'VFD-3kw', 'VFD-3kw', 'Model : FRN0029E2S-4GBX', 'Technical support whenever required', 16000);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-1.5kw', 'VFD-5.5kw', 'VFD-5.5kw', NULL, NULL, 19280);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-1.5kw', 'VFD-7.5kw', 'VFD-7.5kw', NULL, NULL, 22880);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-1.5kw', 'VFD-11kw', 'VFD-11kw', NULL, NULL, 24080);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-1.5kw', 'VFD-15kw', 'VFD-15kw', NULL, NULL, 32000);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Siemens', 'VFD-0.75kw', 'VFD-0.75kw', NULL, 'P3', 15110.4);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Danfoss', 'VFD-0.37KW', 'VFD-0.37KW', NULL, 'P1', 6823);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-0.75kw', 'VFD-1.5KW', 'VFD-1.5KW', NULL, NULL, 10060);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-0.75kw', 'VFD-2.2Kw', 'VFD-2.2Kw', NULL, NULL, 13583);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-0.75kw', 'VFD-3kw', 'VFD-3kw', NULL, NULL, 16447);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Delta', 'VFD-0.75kw', 'VFD-0.75kw', NULL, 'P2', 12013);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-l&T', 'VFD-0.75kw', 'VFD-0.75kw', NULL, 'P3', 11395);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-ABB', 'VFD-0.75kw', 'VFD-0.75kw', NULL, 'P3', 12013);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Schneider', 'VFD-0.75kw', 'VFD-0.75kw', NULL, 'P3', 9084.24);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'VFD-3.7kw with Filter', 'VFD-3.7kw with Filter', 'PowerFlex 525 AC Drive, 380-480VAC', NULL, 42855.29);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'VFD-7.5kw with Filter', 'VFD-7.5kw with Filter', 'PowerFlex 525 AC Drive, 380-480VAC', NULL, 62251.18);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'Part Description', 'Part Description', NULL, 'Unit Price', NULL);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'MAIN BASE UNIT', 'MAIN BASE UNIT', NULL, '11647', NULL);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'HIGH-SPEED UNIVERSAL MODEL QCPU MODULE', 'HIGH-SPEED UNIVERSAL MODEL QCPU MODULE', NULL, '78869', NULL);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'POWER SUPPLY MODULE', 'POWER SUPPLY MODULE', NULL, '7410', NULL);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'DC INPUT MODULE (64 CHANNEL NPN)', 'DC INPUT MODULE (64 CHANNEL NPN)', NULL, '11096', NULL);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'DC INPUT MODULE (16 CHANNEL NPN)', 'DC INPUT MODULE (16 CHANNEL NPN)', NULL, '6422', NULL);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'TRANSISTOR OUTPUT MODULE (64 CHANNEL PNP)', 'TRANSISTOR OUTPUT MODULE (64 CHANNEL PNP)', NULL, '21261', NULL);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'CONTACT OUTPUT MODULE (16 CHANNEL PNP)', 'CONTACT OUTPUT MODULE (16 CHANNEL PNP)', NULL, '8740', NULL);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'CHANNEL ISOLATED ANALOG-DIGITAL CONVERTER MODULE (-10 TO 10 V DC (VOLTAGE)/0 TO 20 MA DC (CURRENT))', 'CHANNEL ISOLATED ANALOG-DIGITAL CONVERTER MODULE (-10 TO 10 V DC (VOLTAGE)/0 TO 20 MA DC (CURRENT))', NULL, '38684', NULL);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', '4-CHANNEL ANALOG-DIGITAL CONVERTER MODULE (0–20 MA,
 4–20 MA, ±10 V)', '4-CHANNEL ANALOG-DIGITAL CONVERTER MODULE (0–20 MA,
 4–20 MA, ±10 V)', NULL, '16264', NULL);
insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values ('VFD-Allen Bradley (Rockwell)', 'HMI FOR DISPLAY', 'HMI FOR DISPLAY', NULL, '163989', NULL);

commit;