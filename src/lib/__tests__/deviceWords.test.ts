import { describe, it, expect } from 'vitest';
import { deviceWordsFrom, namedCategory, type CategoryRef } from '../deviceWords';
import { scoreFlow } from '../flows';
import { matchIssueClient, issuePlausible } from '../issues';

const cats: CategoryRef[] = [
  { id: 'ups', name: 'UPS', aliases: ['Uninterruptible Power Supply', 'Power Backup', 'Inverter'] },
  { id: 'tds', name: 'TDS', aliases: ['TDS Meter', 'TDS Sensor', 'Total Dissolved Solids'] },
  { id: 'ec', name: 'Conductivity / EC', aliases: ['EC Sensor', 'TDS'] },
  { id: 'wqa', name: 'Water Quality Analyser', aliases: ['OCEMS', 'WA'] },
  { id: 'cam', name: 'Camera', aliases: ['CCTV', 'EZVIZ'] },
];
const ignore = deviceWordsFrom(cats);

describe('device words keep the device name from carrying a match', () => {
  const dead = { title: 'UPS is completely dead — no lights, no display, no sound', trigger_symptoms: ['ups dead', 'no display', 'ups off', 'no lights', 'ups band hai'] };
  const beep = { title: 'UPS beeping continuously', trigger_symptoms: ['continuous beep', 'ups beeping', 'buzzer'] };
  it('"UPS is overheating" matches neither UPS flow', () => {
    expect(scoreFlow('UPS is overheating', dead, ignore)).toBe(0);
    expect(scoreFlow('UPS is overheating', beep, ignore)).toBe(0);
  });
  it('filler words cannot carry a match', () => {
    const sockets = { title: 'UPS output sockets not powering the connected equipment', trigger_symptoms: ['output not working', 'no output', 'socket not working', 'ups on but load off'] };
    expect(scoreFlow('No..it is blinking but overheating', sockets, ignore)).toBe(0);
    expect(scoreFlow('no output from the ups', sockets, ignore)).toBeGreaterThan(0.34);
  });
  it('real symptoms still match', () => {
    expect(scoreFlow('UPS beeping', beep, ignore)).toBeGreaterThan(0.34);
    expect(scoreFlow('ups band hai', dead, ignore)).toBeGreaterThan(0.34);
  });
  it('issue matching likewise', () => {
    const issues = [{ id: 'a', sensor_category_id: 'ups', label: 'UPS completely dead', aliases: ['no display', 'ups off', 'ups band'] }, { id: 'b', sensor_category_id: 'ups', label: 'Red fault light / error code', aliases: ['red light', 'fault light', 'E06'] }];
    expect(matchIssueClient('UPS is overheating', issues, ignore)).toBeNull();
    expect(matchIssueClient('ups off hai', issues, ignore)?.id).toBe('a');
    expect(issuePlausible('it is blinking but overheating', issues[1], ignore)).toBe(false);
    expect(issuePlausible('red light on the ups', issues[1], ignore)).toBe(true);
  });
});

describe('namedCategory', () => {
  it('finds the device the message names, name over alias', () => {
    expect(namedCategory('my tds sensor is showing constant readings', cats)?.id).toBe('tds');
    expect(namedCategory('UPS is overheating.', cats)?.id).toBe('ups');
    expect(namedCategory('total dissolved solids probe drifting', cats)?.id).toBe('tds');
    expect(namedCategory('ocems values jumping', cats)?.id).toBe('wqa');
  });
  it('ignores two-letter aliases unless capitalised', () => {
    expect(namedCategory('wa is not working', cats)).toBeNull();
    expect(namedCategory('WA is not working', cats)?.id).toBe('wqa');
  });
  it('returns null when no device is named', () => {
    expect(namedCategory('reading is fluctuating', cats)).toBeNull();
  });
});

describe('only device categories can claim a message by name', () => {
  const list: CategoryRef[] = [
    { id: 'wqa', name: 'Water Quality Analyser', aliases: ['OCEMS'], isDevice: true },
    { id: 'st', name: 'Sensor Testing', aliases: ['Calibration', 'Verification'], isDevice: false },
    { id: 'io', name: 'I/O List', aliases: ['Modbus'], isDevice: false },
    { id: 'flow', name: 'Flow', aliases: ['Flowmeter', 'Magmeter'], isDevice: true },
  ];
  it('ignores document-type categories', () => {
    expect(namedCategory('OCEMS calibration procedure', list)?.id).toBe('wqa');
    expect(namedCategory('flowmeter modbus details', list)?.id).toBe('flow');
    expect(namedCategory('calibration procedure', list)).toBeNull();
  });
});

describe('symptom words in aliases are not device words', () => {
  const list: CategoryRef[] = [
    { id: 'dl', name: 'Datalogger', aliases: ['plant offline', 'data not coming', 'Raspberry Pi'], isDevice: true },
    { id: 'cam', name: 'Camera', aliases: ['EZVIZ'], isDevice: true },
    { id: 'disp', name: 'Indicator / Display', aliases: ['Panel Meter'], isDevice: false },
  ];
  const words = deviceWordsFrom(list, new Set(['offline', 'data', 'coming', 'blank', 'display']));
  it('keeps names and device aliases, drops symptom words and document types', () => {
    expect(words.has('datalogger')).toBe(true);
    expect(words.has('camera')).toBe(true);
    expect(words.has('raspberry')).toBe(true);
    expect(words.has('offline')).toBe(false);
    expect(words.has('data')).toBe(false);
    expect(words.has('display')).toBe(false);
  });
});

describe('issue matching prefers the phrase covering more of the message', () => {
  it('an alarm message goes to the alarm issue, not the blank-display one', () => {
    const issues = [
      { id: 'blank', sensor_category_id: 'flow', label: "Flowmeter's display blank or no power", aliases: ['no display', 'screen blank', 'display dead'] },
      { id: 'alarm', sensor_category_id: 'flow', label: 'Flow alarm displayed on converter', aliases: ['alarm message on display', 'empty pipe alarm'] },
    ];
    const ig = deviceWordsFrom([{ id: 'flow', name: 'Flow', aliases: ['Magmeter', 'Flow Meter'], isDevice: true }], new Set());
    expect(matchIssueClient('magmeter display pe FGP alarm aa raha hai', issues, ig)?.id).toBe('alarm');
    expect(matchIssueClient('display is blank', issues, ig)?.id).toBe('blank');
  });
});
