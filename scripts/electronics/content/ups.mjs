// 1 kVA online UPS — content for the CATEGORY's general entry. The three
// makes on site (Microtek, BPE, Emerson/Vertiv) share the same safe checks
// and PPM; only the fault indicators and the OEM to call differ, and the OEM
// is resolved per make from escalation_contacts.
//
// Source: "UPS Troubleshooting Document.docx" (DigitalPaani, 2026), with
// indicator behaviour cross-checked against the Vertiv Liebert ITA2 / GXT MT+
// manuals. Written to be followed with nothing but the phone in hand.

export const sections = {
  other: `# 1 kVA online UPS — read this first

**Safety first. STOP and check before touching the UPS or its wiring:**

- Smoke or a burning smell from the unit
- Sparks, crackling sounds or visible arcing
- Water or any liquid near or inside the unit
- Cracked, melted, bulging or swollen casing

If **any** of these is present: do not touch the unit or its cables. If it can be reached without contact, switch OFF the input MCB / wall switch feeding the UPS from a distance, keep everyone away, and call the OEM helpline immediately — say it is an emergency. Do not continue with any other check.

**Rules for every visit**

- Never open the UPS casing or the battery compartment. OEM technicians only.
- Never repair, rewire or replace parts yourself.
- To cut power, use the designated switch or MCB — never pull cables.
- If in doubt, stop and call the OEM. Asking for help is always acceptable.

## The three makes at a glance

Identify the make from the nameplate before troubleshooting. The safe checks are identical; the indicators and the support line differ.

| Make | What the panel shows | Notes |
|---|---|---|
| Microtek | Short alphanumeric fault code (E01, E02 …) on the front display | Code list in Troubleshoot & Repair |
| BPE (BPC) | Front-panel LEDs and beep patterns rather than a code screen | The sticker inside the front flap carries this model's LED legend |
| Emerson (Vertiv) | Standard online-UPS indicators: green run, yellow alarm, red fault; LCD alarm list | Emerson's power business is now **Vertiv** — an older "Emerson" nameplate is serviced under the Vertiv name; search both |

## Where the model and serial number are

Every OEM asks for both before booking a visit. On a tower-style 1 kVA UPS look for a rectangular barcode sticker printed "Model No.", "Sr. No." or "S/N" — most often on the **rear panel or side**, occasionally on the base. If the sticker is worn or hidden behind a rack, the same details are on the invoice, packing box or AMC/warranty card. Do not open the unit to find them.
`,

  inspect: `# Weekly visual check (nothing needs switching off)

Walk past the UPS once a week and confirm:

1. Vents and fan openings are free of dust and not blocked by boxes or furniture.
2. No new cables, extension boards or devices have been added to the UPS output since the last check.
3. Indicator lights are in their normal state — steady green — and no fault light is on.
4. No unusual smell, heat, noise or vibration from the unit.
5. The area around the UPS is dry and clear of flammable material.
6. A fire extinguisher is accessible nearby and nothing flammable is stored against the unit.

If anything looks off, go to Troubleshoot & Repair and match the symptom rather than proceeding to the monthly test.

## What the lights and beeps generally mean

Exact layouts differ slightly by model, but almost every 1 kVA online UPS follows this pattern:

| Indicator | Usually means |
|---|---|
| Steady green | Mains present, UPS charging / operating normally |
| Blinking amber / yellow | Running on battery — mains has failed or is out of range |
| Steady or blinking red | Fault — overload, battery fault or internal fault. Note the exact pattern |
| Continuous beep | Battery critically low, or a fault needing attention — shut down connected equipment safely soon |
| Short beep every few seconds | Normally just "running on battery" — not an emergency by itself |
| Display shows a code (E01, F03, "OL", "Batt Flt") | Model-specific fault code — write it down exactly and read it to the OEM |
`,

  troubleshoot_repair: `# Identify the symptom

Match what the UPS is doing to one situation below. Each lists the safe checks the site team can do, what to avoid, and what to have ready before calling the OEM. In every case the escalation is the OEM's customer care — never an internal repair.

## 1. No display / completely dead
No lights, no display, no sound.

**Safe checks**
1. Confirm the wall socket / MCB feeding the UPS is ON and has not tripped.
2. Check the input power cord is firmly plugged in at both ends.
3. If the UPS has its own ON/OFF rocker switch, confirm it is ON.
4. Test the socket with another device to prove it has power.

**Do not** open the unit or the battery compartment.

**Note before calling:** model & serial number · how long it has been dead · whether the socket has power.

## 2. Continuous beeping
A steady continuous beep — different from the short periodic beep that only means "on battery".

**Safe checks**
1. Note whether mains has failed (UPS on battery) or the UPS is on mains and still beeping.
2. If safe, shut down the connected equipment normally before the battery runs out.

**Do not** silence it by unplugging the battery or opening the casing.

**Note before calling:** model & serial · mains present or not · any code on the display.

## 3. Not switching to battery on a power cut
Power goes out and the connected devices die immediately.

**Safe checks**
1. Confirm the load is plugged into the UPS **output** sockets, not a wall socket that bypasses it.
2. Check the battery indicator lights on the front panel and note the colour.

**Do not** test or swap the internal battery yourself.

**Note before calling:** model & serial · UPS age / last battery replacement · which output socket was used.

## 4. Backup time very short
Switches to battery correctly but lasts a minute or two instead of the expected time.

**Safe checks**
1. Note roughly how long it used to last versus now.
2. Check nothing extra or heavier has been plugged into the UPS recently.

**Do not** open or test the battery — this is very commonly a battery at end of life (2–3 years).

**Note before calling:** model & serial · battery age · current vs expected backup time.

## 5. Overload alarm / tripping
Beeps or trips with an overload indicator lit.

**Safe checks**
1. Count roughly how many devices are on the UPS output.
2. If possible, safely unplug one or two non-critical devices and see if the alarm clears.

**Do not** keep resetting or forcing it back on if it keeps tripping.

**Note before calling:** model & serial · list of connected devices · whether unplugging clears the alarm.

## 6. Red fault light on
A red indicator or "fault" light on the front panel.

**Safe checks**
1. Note exactly which light is red and whether it is steady or blinking.
2. Check the display for any accompanying text or code and write it down exactly.
3. One careful restart is fine: off, wait 10 seconds, on. If the fault returns, stop and call.

**Do not** restart the unit repeatedly.

**Note before calling:** model & serial · which indicator, steady or blinking · exact code or text.

## 7. Output sockets not powering the load
UPS looks fine (lights normal) but the connected equipment gets no power.

**Safe checks**
1. Prove the device itself works — plug it straight into a wall socket briefly.
2. Confirm the UPS output switch, if any, is on. Try a different output socket.

**Do not** open the UPS to inspect internal wiring.

**Note before calling:** model & serial · which output socket was tried · result of the wall-socket test.

## 8. Burning smell / unusual noise
This is a safety issue, not a routine fault. Go back to **Safety first** at the top of the reference and follow those steps — nothing else in this section applies.

## Microtek — common on-screen error codes

Your exact model may label a couple of these slightly differently; if the display shows something not listed, note it exactly and read it to Microtek support.

| Code | Likely meaning |
|---|---|
| E01 | Battery disconnected or dead |
| E02 | Overload — too many devices / too much load |
| E03 | Battery low |
| E04 | Output short circuit |
| E05 | Input fuse blown |
| E06 | Internal fault — needs a technician |
| E07 | Charging issue |
| E08 | Input voltage too high or too low |

**BPE and Emerson/Vertiv units:** the display panel or a sticker inside the front flap carries a small code table specific to that model — photograph it and read the exact code to the OEM rather than guessing. On Vertiv units, in UPS Fault state the red alarm indicator is solid and the buzzer sounds continuously; the LCD alarm list names the fault.
`,

  maintenance_planning: `# Planned preventive maintenance (PPM)

A UPS can look completely normal right up to the moment mains fails — and that is when a weak battery lets everyone down. These checks catch a weakening battery or a developing fault early.

| Task | Who | Frequency |
|---|---|---|
| Visual inspection (see Inspect) | Site operator | Weekly |
| Battery backup switch-over test (below) | Site operator | Monthly |
| Review backup-time trend across past tests | Site operator / facility lead | Monthly, at the time of the test |
| Full load-bank battery test / professional inspection | OEM technician (AMC visit) | Annually, or per AMC terms |
| Battery replacement | OEM technician | Typically every 2–3 years, or when tests show declining backup time |

## Monthly battery backup test (simulated power failure)

This deliberately removes mains for a short, controlled period so the UPS switches to battery — exactly as in a real power cut. It is the single best way to know the battery will hold up when needed.

**Before you start:** pick a low-risk window (not during critical work) and tell whoever uses the connected equipment that power will briefly switch to backup. Never run this test without checking it is an acceptable time.

1. Confirm what is connected to the UPS and that a brief switch to battery is acceptable right now.
2. Note the exact start time.
3. Switch OFF the mains input feeding the UPS — the wall switch or MCB, **not** the UPS's own on/off button.
4. Confirm the UPS switches to battery within a couple of seconds (amber/yellow indicator; connected equipment stays powered). If it does not, or the load drops: stop, switch mains back ON, and treat it as a fault — see "Not switching to battery".
5. Let it run on battery for **2 to 5 minutes only**. Do not run the battery down.
6. While on battery, watch for any fault light, unusual sound or smell, or the equipment losing power. If any occurs: stop immediately, switch mains back ON, call the OEM.
7. Switch the mains input back ON. Confirm the UPS returns to steady green and resumes charging.
8. Record the result in the PPM log straight away.

**Reading the result**

- **PASS** — switched over immediately, ran the full window, returned cleanly. No action.
- **WATCH** — switched over, but backup felt weaker than previous tests or the fan/noise seemed different. Keep an eye on it and mention it at the next AMC visit — the earliest sign of battery ageing.
- **FAIL** — did not switch to battery, dropped the load, or showed a fault/smell/noise. Call the OEM proactively and book a visit before it happens in a real power cut.

## Worth adding to the routine

- Keep the last few months' results side by side — a gradually shrinking backup time is the clearest early warning of a dying battery.
- Track battery age / last replacement date. Sealed lead-acid (SMF) batteries in 1 kVA units last about 2–3 years even when symptom-free — plan replacement, don't wait for failure.
- Recount what is plugged in periodically — load creeps up over time.
- Note the room's ambient temperature; batteries degrade faster in hot, poorly ventilated rooms.
- Clean dust from external vents and casing monthly (exterior only).
- Confirm the audible alarm actually sounds during the battery test — a silent alarm is itself a fault to report.
- File every OEM/AMC service report with this log.
`,

  replace: `# Battery replacement

Battery replacement is an **OEM technician** job — never open the battery compartment yourself.

- Plan it, don't wait for it: sealed lead-acid (SMF) batteries in a 1 kVA online UPS typically last 2–3 years even when they show no symptoms.
- Trigger a replacement request when the monthly test trend shows backup time shrinking, when a test FAILS, or when the OEM's annual load-bank test recommends it.
- Before booking, have ready: model & serial number, battery age or last replacement date, and the last three monthly test results.
- After replacement, run one monthly backup test within the first week and record it as the new baseline.
`,
};

// Diagnostic flows — one per symptom in the handbook. `vendor_support`
// resolves to the plant's UPS make via escalation_contacts.make_id.
const oem = (id, text) => ({ id, kind: 'escalate', text, skill: 'vendor_support' });
const A = (id, text, next, extra = {}) => ({ id, kind: 'action', text, next, visit: 'no_visit', skill: 'anyone', source_section: 'troubleshoot_repair', ...extra });
const Q = (id, text, options) => ({ id, kind: 'question', text, options });
const R = (id, text) => ({ id, kind: 'resolve', text });

const SAFETY = Q('safety', 'Before anything else — is there smoke, a burning smell, sparks, crackling, liquid near the unit, or a cracked/bulging casing?', [
  { label: 'Yes — one of those', next: 'emergency' },
  { label: 'No, none of that', next: 'go' },
]);
const EMERGENCY = { id: 'emergency', kind: 'escalate', skill: 'vendor_support', text: 'Do NOT touch the UPS or its cables. If you can reach it without contact, switch OFF the input MCB or wall switch feeding it from a distance. Keep everyone away. Call the OEM helpline now and say it is an emergency.' };

export const flows = [
  {
    title: 'UPS is completely dead — no lights, no display, no sound',
    trigger_symptoms: ['ups dead', 'no display', 'ups not turning on', 'ups off', 'no lights', 'ups band hai', 'ups not starting'],
    definition: {
      start: 'safety',
      nodes: [
        SAFETY, EMERGENCY,
        A('go', 'Check the wall socket or MCB feeding the UPS: is it switched ON and not tripped? Reset it if it has tripped.', 'cord'),
        A('cord', 'Check the input power cord is pushed firmly in at both ends — at the wall and at the back of the UPS.', 'rocker'),
        A('rocker', 'If the UPS has its own ON/OFF rocker switch (usually at the back), confirm it is ON.', 'socket'),
        A('socket', 'Plug another device (a phone charger or lamp) into the same wall socket to prove the socket has power.', 'alive'),
        Q('alive', 'Does the UPS show any light or sound now?', [
          { label: 'Yes — it is on', next: 'ok' },
          { label: 'Still dead', next: 'call' },
        ]),
        R('ok', 'The UPS is powered again. Watch it for a minute — if it beeps continuously or shows a fault code, come back and pick that symptom.'),
        oem('call', 'Do not open the unit. Call the OEM customer care and book a visit. Have ready: model & serial number (rear/side sticker), how long it has been dead, and whether the socket has power.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
  {
    title: 'UPS beeping continuously',
    trigger_symptoms: ['continuous beep', 'ups beeping', 'beeping non stop', 'alarm sound', 'ups awaaz', 'buzzer'],
    definition: {
      start: 'safety',
      nodes: [
        SAFETY, EMERGENCY,
        Q('go', 'Is the beep steady and continuous, or a short beep every few seconds?', [
          { label: 'Short beep every few seconds', next: 'onbatt' },
          { label: 'Steady, continuous beep', next: 'mains' },
        ]),
        R('onbatt', 'A short periodic beep normally just means the UPS is running on battery because mains has failed. Not an emergency by itself — restore mains and it should stop. If mains is present and it still beeps like this, treat it as a fault and call the OEM.'),
        Q('mains', 'Is mains power present right now (other equipment in the room is on)?', [
          { label: 'Mains has failed', next: 'shutdown' },
          { label: 'Mains is present', next: 'code' },
        ]),
        A('shutdown', 'The battery is running low. Shut down the connected equipment normally (computer / server / datalogger) before the battery runs out. Do NOT silence the beep by unplugging the battery or opening the casing.', 'code'),
        A('code', 'Look at the display: write down any code or text exactly as shown (E01, "Batt Flt", OL …).', 'call'),
        oem('call', 'Call the OEM customer care and book a visit. Have ready: model & serial number, whether mains is present, and the exact code on the display.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
  {
    title: 'UPS did not switch to battery when power failed',
    trigger_symptoms: ['not switching to battery', 'no backup', 'load dropped on power cut', 'ups failed during power cut', 'backup nahi', 'power cut everything went off'],
    definition: {
      start: 'safety',
      nodes: [
        SAFETY, EMERGENCY,
        A('go', 'Check where the load is plugged in: the connected equipment must be in the UPS OUTPUT sockets, not in a wall socket that bypasses the UPS.', 'wrongsocket'),
        Q('wrongsocket', 'Was the equipment plugged into a wall socket instead of the UPS output?', [
          { label: 'Yes — it bypassed the UPS', next: 'moved' },
          { label: 'No — it was on the UPS output', next: 'indicator' },
        ]),
        R('moved', 'Move the equipment to the UPS output sockets. That was why it lost power. Run the monthly backup test (Maintenance Planning) to confirm the UPS itself is healthy.'),
        A('indicator', 'Look at the battery indicator lights on the front panel and note their colour (green / amber / red) and whether steady or blinking.', 'call'),
        oem('call', 'Do NOT test or swap the internal battery yourself. Call the OEM customer care and book a visit. Have ready: model & serial number, the UPS age or last battery replacement date, and which output socket was used.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
  {
    title: 'UPS backup time is very short',
    trigger_symptoms: ['backup very short', 'battery lasts a minute', 'backup time reduced', 'battery drains fast', 'battery weak', 'backup kam'],
    definition: {
      start: 'safety',
      nodes: [
        SAFETY, EMERGENCY,
        A('go', 'Note roughly how long the backup used to last and how long it lasts now (check the PPM test log if you keep one).', 'load'),
        A('load', 'Check nothing extra or heavier has been plugged into the UPS output recently — count the devices.', 'added'),
        Q('added', 'Was something new or heavy added to the UPS?', [
          { label: 'Yes', next: 'remove' },
          { label: 'No, same load as before', next: 'call' },
        ]),
        A('remove', 'Move the added device to a wall socket (if it does not need backup) and re-check backup time at the next monthly test.', 'call'),
        oem('call', 'A short backup with the same load is very commonly a battery at end of life (2–3 years). Do NOT open or test the battery. Call the OEM customer care and book a battery inspection. Have ready: model & serial number, battery age, and current vs expected backup time.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
  {
    title: 'UPS overload alarm or tripping',
    trigger_symptoms: ['overload', 'ups tripping', 'OL on display', 'E02', 'too much load', 'ups trips'],
    definition: {
      start: 'safety',
      nodes: [
        SAFETY, EMERGENCY,
        A('go', 'Count roughly how many devices are plugged into the UPS output sockets and note them down.', 'unplug'),
        A('unplug', 'If it is safe, unplug one or two non-critical devices from the UPS output to reduce the load. Do NOT keep resetting or forcing the UPS back on if it keeps tripping.', 'cleared'),
        Q('cleared', 'Did the overload alarm clear after reducing the load?', [
          { label: 'Yes — alarm cleared', next: 'ok' },
          { label: 'No — still in alarm', next: 'call' },
        ]),
        R('ok', 'The UPS was overloaded. Keep the removed devices off the UPS (or on a wall socket) and recount the load at the next weekly check.'),
        oem('call', 'Call the OEM customer care and book a visit. Have ready: model & serial number, the list of devices connected, and whether unplugging devices changed anything.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
  {
    title: 'Red fault light on the UPS',
    trigger_symptoms: ['red light', 'fault light', 'fault indicator', 'red led', 'fault code', 'E06', 'error code on display'],
    definition: {
      start: 'safety',
      nodes: [
        SAFETY, EMERGENCY,
        A('go', 'Note exactly which indicator is red and whether it is steady or blinking.', 'code'),
        A('code', 'Check the display for any accompanying text or code and write it down exactly (E01, F03, "OL", "Batt Flt" …). On BPE and Vertiv units, photograph the code sticker inside the front flap too.', 'restart'),
        A('restart', 'One careful restart only: switch the UPS off, wait 10 seconds, switch it on.', 'returned'),
        Q('returned', 'Did the red fault light come back?', [
          { label: 'No — it is steady green now', next: 'ok' },
          { label: 'Yes — fault returned', next: 'call' },
        ]),
        R('ok', 'The fault cleared on restart. Record the code you saw in the PPM log and mention it at the next AMC visit. If it recurs, do not restart again — call the OEM.'),
        oem('call', 'Do NOT restart it again. Call the OEM customer care and read out the exact code. Have ready: model & serial number, which indicator was red (steady or blinking), and the exact code or text.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
  {
    title: 'UPS output sockets not powering the connected equipment',
    trigger_symptoms: ['output not working', 'no output', 'socket not working', 'equipment not getting power from ups', 'ups on but load off'],
    definition: {
      start: 'safety',
      nodes: [
        SAFETY, EMERGENCY,
        A('go', 'Prove the connected device itself works: plug it straight into a wall socket briefly and check it powers on.', 'deviceok'),
        Q('deviceok', 'Does the device work on the wall socket?', [
          { label: 'No — device is dead too', next: 'devicefault' },
          { label: 'Yes — device is fine', next: 'outswitch' },
        ]),
        R('devicefault', 'The problem is the connected device or its cable, not the UPS. Get that device checked; the UPS can stay in service.'),
        A('outswitch', 'Confirm the UPS output switch, if it has one, is turned on. Then try a different output socket on the UPS.', 'works'),
        Q('works', 'Does the equipment get power from the UPS now?', [
          { label: 'Yes', next: 'ok' },
          { label: 'No', next: 'call' },
        ]),
        R('ok', 'Working again. If it was one specific socket that failed, label it "do not use" and report it at the next AMC visit.'),
        oem('call', 'Do NOT open the UPS to inspect the wiring. Call the OEM customer care and book a visit. Have ready: model & serial number, which output socket was tried, and the wall-socket test result.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
];

// Curated issues (what operators say) → the flows above, in try-order.
export const issues = [
  { label: 'UPS completely dead', aliases: ['no display', 'ups not turning on', 'ups off', 'no lights', 'ups band'], flows: ['UPS is completely dead — no lights, no display, no sound'] },
  { label: 'UPS beeping', aliases: ['continuous beep', 'alarm sounding', 'buzzer', 'beep beep', 'ups awaaz kar raha'], flows: ['UPS beeping continuously'] },
  { label: 'No backup on power cut', aliases: ['not switching to battery', 'load dropped', 'everything went off in power cut', 'backup nahi mila'], flows: ['UPS did not switch to battery when power failed'] },
  { label: 'Backup time very short', aliases: ['battery weak', 'battery drains', 'backup reduced', 'lasts one minute'], flows: ['UPS backup time is very short'] },
  { label: 'Overload / tripping', aliases: ['overload alarm', 'OL', 'E02', 'ups trips'], flows: ['UPS overload alarm or tripping'] },
  { label: 'Red fault light / error code', aliases: ['red light', 'fault light', 'error code', 'E06', 'fault code'], flows: ['Red fault light on the UPS'] },
  { label: 'Output not powering equipment', aliases: ['no output', 'socket not working', 'load off but ups on'], flows: ['UPS output sockets not powering the connected equipment'] },
];

// OEM customer care, one row per make, all under the `vendor_support` skill
// so a flow's "call the OEM" resolves to the plant's own UPS make.
export const contacts = [
  { make: 'Microtek',         person_name: 'Microtek customer care',        contact: 'Phone 9717117333 · cc@microtek.in',                          notes: 'Alternate / emergency: 9717117333. Have model & serial number ready.' },
  { make: 'BPE',              person_name: 'BPE (Best Power Equipments) customer care', contact: 'Toll-free 1800 103 1247 · support@bpee.com',      notes: 'Have model & serial number ready. LED legend sticker is inside the front flap.' },
  { make: 'Emerson (Vertiv)', person_name: 'Emerson / Vertiv customer care', contact: 'Phone 000 800 440 1117 · support.mas.apac@emerson.com',      notes: 'Emerson power business is now Vertiv — an older Emerson nameplate may be serviced under the Vertiv name; check both.' },
];

// Source documents for the Documents tab.
export const sources = [
  { file: 'ups_troubleshooting_handbook_dp.docx', text: 'ups_troubleshooting_handbook_dp.txt', title: 'UPS Troubleshooting Handbook — 1 kVA online UPS (Microtek · BPE · Emerson/Vertiv)', type: 'troubleshoot_repair' },
  { url: 'https://www.vertiv.com/4910f4/globalassets/products/critical-power/uninterruptible-power-supplies-ups/liebert-ita-2-ups/liebert-ita2-1kva_3kva-ups_.pdf', file: 'vertiv_liebert_ita2_1-3kva_manual.pdf', text: 'vertiv_liebert_ita2_1-3kva_manual.txt', title: 'Vertiv Liebert ITA2 1–3 kVA UPS — User Manual', type: 'install_commission', make: 'Emerson (Vertiv)' },
  { url: 'https://www.vertiv.com/48e436/globalassets/products/critical-power/uninterruptible-power-supplies-ups/liebert-gxt-mt-1000va---3000va-user-manual.pdf', file: 'vertiv_liebert_gxt_mt_plus_manual.pdf', text: 'vertiv_liebert_gxt_mt_plus_manual.txt', title: 'Vertiv Liebert GXT MT+ 1–3 kVA UPS — User Manual', type: 'install_commission', make: 'Emerson (Vertiv)' },
  { url: 'https://5.imimg.com/data5/TD/NH/WW/SELLER-82012192/microtek-online-ups.pdf', file: 'microtek_online_ups_catalog.pdf', text: 'microtek_online_ups_catalog.txt', title: 'Microtek Online UPS — Product Catalogue (LED / LCD indications)', type: 'other', make: 'Microtek' },
  { url: 'https://bpee.com/assets/images/pdf/PB_Series_User_Manual.pdf', title: 'BPE PB Series 1 kVA Online UPS — User Manual (vendor site)', type: 'install_commission', make: 'BPE', note: 'bpee.com blocks automated download; open the link in a browser. Also on ManualsLib: https://www.manualslib.com/manual/3207714/Bpe-Pb-Series.html' },
];
