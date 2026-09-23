// Site datalogger — Raspberry Pi 4 Model B (4 GB). It is the bridge between
// the plant's PLC and DigitalPaani's software: nothing more, nothing less
// (Mihir, 2026-09-23). So the only symptom anyone reports is "the plant
// stopped reporting", and the fix tree is power → network → PLC link → reboot.
//
// Sources: Raspberry Pi 4 Model B datasheet (Release 1.1, March 2024);
// Adafruit "Raspberry Pi Care and Troubleshooting" (2025); Raspberry Pi
// documentation — LED warning flash codes.

export const sections = {
  tds: `# Raspberry Pi 4 Model B — what matters for the datalogger

| Item | Value |
|---|---|
| Board | Raspberry Pi 4 Model B, 4 GB RAM |
| Power input | USB-C, **5 V at 3 A** (a 5 V / 2.5 A supply is acceptable only if USB devices draw under 500 mA). Use the official Raspberry Pi USB-C supply |
| Absolute maximum input | 6.0 V — anything above damages the board permanently |
| Downstream USB | Approximately 1.1 A in total across the four USB ports |
| Network | Gigabit Ethernet (RJ45); 2.4 / 5 GHz Wi-Fi; Bluetooth 5.0 |
| Storage | microSD card (the operating system and the datalogger software live on it) |
| Operating temperature | 0 to 50 °C ambient recommended |
| Thermal behaviour | Throttles CPU speed above 80–85 °C rather than shutting down — a very hot cabinet slows it, and can make it unstable |
| Ports | 2 × USB 2.0, 2 × USB 3.0, 2 × micro-HDMI, 40-pin GPIO header, 3.5 mm A/V jack |
| Boot | From the microSD card via on-board EEPROM bootloader (not from the card itself as on older models) |
| Indicators | **Red PWR** LED — power present; **Green ACT** LED — flickers on card activity, and blinks a fault code when it cannot boot |
`,

  install_commission: `# Installing the datalogger at a plant

The datalogger is the PLC-to-cloud bridge. It needs three things: clean power, a network path to the internet, and a link to the PLC.

1. **Mount** it inside the panel or enclosure, off the floor, away from the VFDs and contactors, with the vents unobstructed. Ambient must stay within 0–50 °C — a sealed panel in the sun will exceed this.
2. **Power** it from the official 5 V / 3 A USB-C supply on a UPS-backed socket. Never power it from a phone charger or a thin charge-only cable: undervoltage shows as random reboots and corrupted SD cards.
3. **Network**: plug the Ethernet cable into the RJ45 port and into the site router / 4G gateway. Confirm the link lights on the port come on. (Wi-Fi is the fallback, not the default.)
4. **PLC link**: connect the PLC communication cable (RS-485 / Ethernet, per the site's I/O sheet) and confirm the PLC is powered.
5. **Power on** and wait 2 minutes. Expect: red PWR LED steady, green ACT LED flickering, Ethernet link lights on.
6. **Confirm in the software** that the plant is reporting live values before leaving site. If it is not, follow "Plant stopped reporting" in Troubleshoot & Repair.
7. Record the plant code, the datalogger's serial number (on the board) and the SIM/router details in the plant notes.

**Care rules (from the Raspberry Pi guide)**
- Never touch the GPIO header pins while powered — there is no protection circuitry; a static shock or a shorted pin kills the board.
- Never let 5 V touch any other pin, and never short the 3.3 V pins to ground.
- Keep it dry. Water on the board is fatal.
- Do not reuse an SD card "that works in another Pi" — image it fresh.
`,

  inspect: `# Quick health check (30 seconds, on site)

| Look at | Healthy | Worry when |
|---|---|---|
| Red PWR LED | Steady on | Off (no power) or flickering (undervoltage / bad supply) |
| Green ACT LED | Irregular flicker | Off for minutes, or a **repeating blink pattern** (boot fault — see codes in Troubleshoot & Repair) |
| Ethernet port lights | Link light on, activity flickering | Both dark (cable, router or port) |
| Router / 4G gateway | Internet indicator on | No internet / SIM fault |
| PLC | Powered, RUN light on | PLC off or in fault |
| Board and enclosure | Cool to warm, dry, dust-free | Hot to touch, condensation, dust in vents |
| Cables | Seated firmly | Loose USB-C, RJ45 or PLC cable |
`,

  clean: `# Cleaning

- Power off (unplug USB-C) before cleaning.
- Blow dust out of the enclosure vents and off the board with dry air only — never liquids, never a vacuum nozzle on the board (static).
- Check the enclosure gasket and cable glands for dust ingress and re-seat.
- Power back on and confirm the plant is reporting.
`,

  troubleshoot_repair: `# Plant stopped reporting — the fix tree

Work top to bottom. Each step takes under two minutes. Stop as soon as data returns.

## 1. Power
1. Is the **red PWR LED** on? If not: check the USB-C cable is fully inserted; check the socket / UPS output has power (plug a phone charger in to prove it); swap to the official 5 V / 3 A supply if a different one is in use.
2. Red LED flickering or the board rebooting on its own = **undervoltage**. Replace the power supply and cable — cheap chargers and thin cables cannot deliver 3 A.

## 2. Network
1. Look at the **Ethernet port lights**. Dark = no link: re-seat the RJ45 cable at both ends; try another cable; try another port on the router.
2. Check the **router / 4G gateway**: is its internet indicator on? Reboot it (off 30 s, on, wait 2 minutes). If it uses a SIM, check the SIM has balance / is active.
3. If the site also has Wi-Fi as the path, confirm the network is up and the password has not been changed.

## 3. PLC link
1. Is the **PLC powered** and in RUN? A PLC that is off or in fault has nothing to give the datalogger — the software shows "not reporting" even though the datalogger is fine.
2. Re-seat the **PLC communication cable** (RS-485 / Ethernet) at both ends. Check for cut or crushed cable along the tray.

## 4. Reboot the datalogger
1. Unplug the USB-C power, wait **30 seconds**, plug it back in.
2. Wait 2 minutes. Red LED steady, green LED flickering, link lights on.
3. Check the software for live values.

## 5. Read the green LED
If the board will not boot, the **green ACT LED** blinks a code: a number of long flashes, then short flashes, repeating after a two-second pause.

| Long | Short | Meaning | What to do |
|---|---|---|---|
| 0 | 3 | Generic failure to boot | Re-seat the SD card; if it repeats, the card needs re-imaging |
| 0 | 4 | start*.elf not found | SD card missing or corrupted — re-seat, then re-image |
| 0 | 7 | Kernel image not found | SD card corrupted — re-image |
| 0 | 8 | SDRAM failure | Board fault — replace the datalogger |
| 0 | 9 | Insufficient SDRAM | Board fault — replace |
| 0 | 10 | In HALT state | Power-cycle; if it repeats, re-image |
| 1 | 2 | SD card over-current | Faulty SD card — replace the card |
| 2 | 1 | Partition not FAT | Card imaged wrongly — re-image |
| 2 | 2 | Failed to read from partition | Card failing — re-image on a new card |
| 2 | 3 | Extended partition not FAT | Re-image |
| 2 | 4 | File signature / hash mismatch | Re-image |
| 3 | 1 | SPI EEPROM error | Bootloader corrupt — EEPROM recovery (engineering) |
| 3 | 2 | SPI EEPROM is write-protected | Engineering |
| 3 | 3 | I2C error | Board fault — replace |
| 4 | 4 | Unsupported board type | Wrong image for this board — re-image |
| 4 | 5 | Fatal firmware error | Re-image; if it repeats, replace |
| 4 | 6 / 4 | 7 | Power failure type A / B | Power supply problem — replace the supply and cable |

**Sanity check with no SD card:** unplug power, remove the SD card, apply power. A healthy board blinks **4 short flashes repeatedly** (start*.elf not found — expected without a card). No pattern at all means the EEPROM bootloader is corrupt or the board is dead.

## 6. Still not reporting
Escalate to the DigitalPaani support desk with: plant code, what the red and green LEDs are doing, whether the Ethernet link lights are on, whether the PLC is in RUN, and what you have already tried. They can check from the cloud side whether the datalogger is reaching the server and, if needed, send a freshly imaged SD card or a replacement unit.
`,

  replace: `# Replacing the SD card or the datalogger

**SD card (most common):** a corrupted card shows as a repeating green-LED code or a board that never gets past the red LED. Cards are re-imaged by DigitalPaani engineering with the plant's configuration — the site team swaps the card, they do not image it. Power off, swap the card, power on, wait 2 minutes, confirm reporting.

**Whole unit:** replace the board when it shows an SDRAM (0 long / 8 or 9 short), I2C (3/3) or repeating fatal firmware code, when it will not power with a known-good supply, or when it has been wet. Move the SD card, power supply and cables to the new unit; record the new serial number in the plant notes.

**Power supply:** replace on any undervoltage sign (flickering red LED, random reboots) — always with the official 5 V / 3 A USB-C supply.
`,

  maintenance_planning: `# Preventive routine

| Task | Who | Frequency |
|---|---|---|
| 30-second health check (Inspect) | Site operator | Weekly |
| Confirm the plant is reporting live in the software | Site operator | Weekly, same visit |
| Clean vents / check enclosure for dust and condensation | Site operator | Monthly |
| Check power supply and cables for heat or damage | Site operator | Monthly |
| Verify the UPS backing the datalogger passes its monthly test | Site operator | Monthly (see the UPS reference) |
| Review reboot / offline history from the cloud side | DigitalPaani engineering | Quarterly |
| Proactive SD card replacement | DigitalPaani engineering | Every 2–3 years, or on the first corruption |

The two things that kill dataloggers in the field are heat and bad power. Keep the panel ventilated and the supply official.
`,
};

const A = (id, text, next, extra = {}) => ({ id, kind: 'action', text, next, visit: 'no_visit', skill: 'anyone', source_section: 'troubleshoot_repair', ...extra });
const Q = (id, text, options) => ({ id, kind: 'question', text, options });
const R = (id, text) => ({ id, kind: 'resolve', text });
const DP = (id, text) => ({ id, kind: 'escalate', text, skill: 'dp_support' });

export const flows = [
  {
    title: 'Plant stopped reporting — datalogger offline',
    trigger_symptoms: ['plant not reporting', 'data not coming', 'datalogger offline', 'no data', 'readings stopped', 'plant offline', 'data stopped', 'logger not working', 'raspberry pi not working'],
    definition: {
      start: 'red',
      nodes: [
        Q('red', 'Look at the datalogger. Is the small RED light on the board on?', [
          { label: 'Yes — red light is on', next: 'green' },
          { label: 'No red light', next: 'power' },
          { label: 'Red light flickering', next: 'psu' },
        ]),
        A('power', 'Check the USB-C power cable is pushed fully into the board, and that the socket or UPS output it is on has power — plug a phone charger into the same socket to prove it.', 'redback'),
        Q('redback', 'Is the red light on now?', [
          { label: 'Yes', next: 'green' },
          { label: 'Still off', next: 'psu' },
        ]),
        A('psu', 'Replace the power supply and cable with the official Raspberry Pi 5 V / 3 A USB-C supply (a phone charger or thin cable cannot deliver enough current and causes flickering, reboots and corrupted cards).', 'redback2'),
        Q('redback2', 'Red light steady now?', [
          { label: 'Yes', next: 'green' },
          { label: 'Still off or flickering', next: 'deadboard' },
        ]),
        DP('deadboard', 'No steady red light with a known-good supply means the board has failed. Contact the DigitalPaani support desk with the plant code — a replacement datalogger will be arranged. Do not open or probe the board.'),
        Q('green', 'Now the GREEN light: what is it doing?', [
          { label: 'Flickering irregularly', next: 'link' },
          { label: 'Off completely', next: 'reboot' },
          { label: 'Blinking a repeating pattern', next: 'code' },
        ]),
        A('link', 'Look at the Ethernet port on the board: are the small link lights on? If dark, re-seat the network cable at both ends and try another cable or another port on the router.', 'router'),
        A('router', 'Check the site router or 4G gateway: is its internet light on? Switch it off, wait 30 seconds, switch on and wait two minutes. If it uses a SIM, confirm the SIM is active and has balance.', 'plc'),
        A('plc', 'Check the PLC: is it powered and showing RUN? Re-seat the PLC communication cable at both ends. A PLC that is off or in fault gives the datalogger nothing to send.', 'reboot'),
        A('reboot', 'Reboot the datalogger: unplug the USB-C power, wait 30 seconds, plug it back in. Wait two minutes — red steady, green flickering, link lights on.', 'reporting'),
        Q('reporting', 'Check the software. Is the plant reporting live values now?', [
          { label: 'Yes — data is back', next: 'ok' },
          { label: 'No', next: 'green2' },
        ]),
        R('ok', 'The plant is reporting again. Note in the plant log which step fixed it — if it was the power supply or the router, that is a repeat offender worth replacing properly.'),
        Q('green2', 'After the reboot, what is the green light doing?', [
          { label: 'Flickering, but still no data', next: 'help' },
          { label: 'Blinking a repeating pattern', next: 'code' },
          { label: 'Off', next: 'help' },
        ]),
        A('code', 'Count the pattern: a number of LONG flashes, then SHORT flashes, repeating after a 2-second pause. Write it down as "long / short" (for example 0 long / 4 short). The table in Troubleshoot & Repair says what each means — most patterns are a corrupted SD card.', 'help'),
        DP('help', 'Contact the DigitalPaani support desk with: the plant code, what the red and green lights are doing (and any blink pattern), whether the Ethernet link lights are on, whether the PLC is in RUN, and what you have tried. They will check from the cloud side and send a freshly imaged SD card or a replacement unit if needed.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
  {
    title: 'Datalogger green light blinking a repeating pattern',
    trigger_symptoms: ['green light blinking', 'led blinking pattern', 'pi not booting', 'datalogger not booting', 'blink code', 'act led'],
    definition: {
      start: 'count',
      nodes: [
        A('count', 'Count the pattern on the green light: LONG flashes first (possibly none), then SHORT flashes, repeating after a 2-second pause. Note it as long / short.', 'which'),
        Q('which', 'Which pattern is it?', [
          { label: '0 long / 3, 4 or 7 short', next: 'sd' },
          { label: '1 long / 2 short', next: 'sdfault' },
          { label: '2 long / any short', next: 'sd' },
          { label: '0 long / 8 or 9 short, or 3 long / 3 short', next: 'board' },
          { label: '4 long / 6 or 7 short', next: 'psu' },
          { label: 'Something else', next: 'help' },
        ]),
        A('sd', 'The SD card is missing, unseated or corrupted. Power off, remove the SD card, check it is clean and undamaged, push it back in until it clicks, power on and wait two minutes.', 'boots'),
        Q('boots', 'Does it boot now (green flickering irregularly, plant reporting)?', [
          { label: 'Yes', next: 'ok' },
          { label: 'No — same pattern', next: 'reimage' },
        ]),
        R('ok', 'The card had come loose. If this repeats, ask for a replacement card — a card that keeps failing is failing.'),
        DP('reimage', 'The card needs re-imaging with this plant\'s configuration. Contact the DigitalPaani support desk with the plant code and the blink pattern; they will send a freshly imaged card (or a replacement unit).'),
        DP('sdfault', 'SD card over-current: the card itself is faulty. Contact the DigitalPaani support desk for a replacement imaged card — do not keep power-cycling.'),
        DP('board', 'Memory or I2C fault on the board itself. The datalogger needs replacing — contact the DigitalPaani support desk with the plant code.'),
        A('psu', 'Power failure code: replace the power supply and cable with the official 5 V / 3 A USB-C supply, then power on again.', 'boots'),
        DP('help', 'Send the plant code and the exact pattern (long / short) to the DigitalPaani support desk; they will match it against the full code table and advise.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
];

export const issues = [
  { label: 'Plant not reporting / datalogger offline', aliases: ['data not coming', 'no data', 'readings stopped', 'plant offline', 'logger down', 'pi offline', 'data band', 'plant stopped sending data', 'dashboard not updating', 'site offline', 'data nahi aa raha', 'plant ka data nahi aa raha', 'not reporting', 'stopped reporting', 'values not updating'], flows: ['Plant stopped reporting — datalogger offline'] },
  { label: 'Datalogger not booting (blink code)', aliases: ['green light blinking', 'blink pattern', 'pi not booting', 'act led blinking'], flows: ['Datalogger green light blinking a repeating pattern', 'Plant stopped reporting — datalogger offline'] },
];

// Internal escalation — not a vendor. Global row; Admin fills in the person.
export const contacts = [
  { skill_key: 'dp_support', label: 'DigitalPaani support desk', person_name: null, contact: null, notes: 'Datalogger / cloud-side checks, imaged SD cards and replacement units. Fill in the on-call number and email.' },
];

export const sources = [
  { url: 'https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-datasheet.pdf', file: 'rpi4_datasheet.pdf', text: 'rpi_ds.txt', title: 'Raspberry Pi 4 Model B — Datasheet (Release 1.1, March 2024)', type: 'tds' },
  { url: 'https://learn.adafruit.com/raspberry-pi-care-and-troubleshooting', file: 'rpi_care_troubleshooting_adafruit.pdf', text: 'rpi_care.txt', title: 'Raspberry Pi Care and Troubleshooting (Adafruit, 2025)', type: 'troubleshoot_repair' },
  { url: 'https://www.raspberrypi.com/documentation/computers/configuration.html#led-warning-flash-codes', title: 'Raspberry Pi documentation — LED warning flash codes', type: 'troubleshoot_repair', textInline: `LED warning flash codes (raspberrypi.com documentation). When a Raspberry Pi fails to boot or shuts down unexpectedly, the on-board LED provides a diagnostic signal as a flashing pattern. Long flashes always occur before short ones; sometimes there are no long flashes. In most cases the pattern repeats after a two-second pause.
Long / Short — Status: 0/3 Generic failure to boot · 0/4 start*.elf not found · 0/7 Kernel image not found · 0/8 SDRAM failure · 0/9 Insufficient SDRAM · 0/10 In HALT state · 1/2 SD card overcurrent detected · 2/1 Partition not FAT · 2/2 Failed to read from partition · 2/3 Extended partition not FAT · 2/4 File signature/hash mismatch (Pi 4 and 5) · 3/1 SPI EEPROM error (Pi 4 and 5) · 3/2 SPI EEPROM is write protected (Pi 4 and 5) · 3/3 I2C error (Pi 4 and 5) · 3/4 Secure-boot configuration isn't valid · 4/3 RP1 not found · 4/4 Unsupported board type · 4/5 Fatal firmware error · 4/6 Power failure type A · 4/7 Power failure type B.` },
];
