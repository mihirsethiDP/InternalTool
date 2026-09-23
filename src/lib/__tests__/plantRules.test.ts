import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain ESM shared with the node importer (no types on purpose)
import { canonicalMake, canonicalModel, resolveCategory, isAssumption, deriveClient, upsMakeFor, plantCodeFromTags, splitModels, plantStatus, parseRegister, parseTags } from '../../../scripts/plant-register/rules.mjs';

const cats = [
  { id: 'flow', name: 'Flow', aliases: ['Electromagnetic Flow Meter', 'Magmeter'] },
  { id: 'do', name: 'Dissolved Oxygen (DO)', aliases: ['DO Sensor', 'DO probe'] },
  { id: 'sw', name: 'Switches (Float / Level / Pressure / Flow)', aliases: ['Float Switch', 'Level Switch'] },
  { id: 'tss', name: 'TSS / MLSS', aliases: ['MLSS Sensor'] },
  { id: 'ph', name: 'pH', aliases: [] },
  { id: 'ups', name: 'UPS', aliases: ['Battery Backup'] },
];

describe('plant register rules', () => {
  it('maps the fill sheet wording onto the master list', () => {
    expect(resolveCategory('Flow Meters', cats)?.id).toBe('flow');
    expect(resolveCategory('DO', cats)?.id).toBe('do');
    expect(resolveCategory('PH', cats)?.id).toBe('ph');
    expect(resolveCategory('Level Switch', cats)?.id).toBe('sw');
    expect(resolveCategory('MLSS', cats)?.id).toBe('tss');
    expect(resolveCategory('TSS', cats)?.id).toBe('tss');
  });
  it('falls back to aliases and reports the unknown', () => {
    expect(resolveCategory('Battery Backup', cats)?.id).toBe('ups');
    expect(resolveCategory('Vibration', cats)).toBeNull();
  });
  it('recognises the analyst\'s "working assumption" phrasing', () => {
    expect(isAssumption('NOT INSTALLED BY DIGITAL PAANI. Per Mihir 16 Sep: fleet-commonest Flow Meters')).toBe(true);
    expect(isAssumption('Working assumption, not a nameplate reading.')).toBe(true);
    expect(isAssumption('MLSS probe INSIDE the Digital Paani Bio Health Tracker')).toBe(false);
    expect(isAssumption('')).toBe(false);
  });
  it('derives the client from the plant name', () => {
    expect(deriveClient('Amazon DEL-4')).toBe('Amazon');
    expect(deriveClient('Adani Navi Mumbai 4.5 MLD')).toBe('Adani');
    expect(deriveClient('Tata Steel UISL 150 KLD')).toBe('Tata Steel');
    expect(deriveClient('Kims (200 KLD)')).toBe('KIMS');
    expect(deriveClient('1.25 MLD STP - Pragnapur Bypass')).toBe('Municipal');
    expect(deriveClient('Park view spa')).toBe('Park view spa');
  });
  it('applies the UPS site rule exactly as stated', () => {
    expect(upsMakeFor('EMS')).toBe('Emerson (Vertiv)');
    expect(upsMakeFor('Amazon DEL-4')).toBe('BPE');
    expect(upsMakeFor('Amazon Lucknow')).toBe('BPE');
    expect(upsMakeFor('Amazon NCRU')).toBe('Microtek');
    expect(upsMakeFor('Amazon MDEA')).toBe('Microtek');
    expect(upsMakeFor('Amazon MAMA')).toBe('Microtek');
    expect(upsMakeFor('Amazon MSTA')).toBe('Microtek');
    expect(upsMakeFor('GMR Delhi')).toBe('Microtek');
  });
  it('reads the plant code off the tag suffix', () => {
    expect(plantCodeFromTags(['DO_OS_TANK_AT_1:GD, DO_OS_TANK_AT_2:GD ...', 'BOD_Pipe_SITJ_1:GD'])).toBe('GD');
    expect(plantCodeFromTags(['EMKWH_UGT5Pdd1_1:METL_METL, LT_ATdd1_1:METL_METL'])).toBe('METL');
    expect(plantCodeFromTags(['nothing here'])).toBeNull();
  });
  it('maps register spellings onto the catalogue spelling', () => {
    expect(canonicalMake('UPC (Universal Process Controls)')).toBe('UPC');
    expect(canonicalModel('UPC (Universal Process Controls)', 'UPCS-MAG-110')).toBe('MAG-110');
    expect(canonicalModel('UPC (Universal Process Controls)', 'UPC-WA-202')).toBe('UPC-WA-202');
    expect(canonicalMake('Danfoss')).toBe('Danfoss');
  });
  it('splits per-tag model pairs and nothing else', () => {
    expect(splitModels('LFT1 + LFT2 (per tag)')).toEqual(['LFT1', 'LFT2']);
    expect(splitModels('FM 8312 + Aqua2Trans')).toEqual(['FM 8312 + Aqua2Trans']);
    expect(splitModels('MBS3000')).toEqual(['MBS3000']);
  });
  it('marks a plant discontinued only when every row says so', () => {
    expect(plantStatus([{ status: 'SITE DISCONTINUED' }, { status: 'SITE DISCONTINUED' }])).toBe('discontinued');
    expect(plantStatus([{ status: 'SITE DISCONTINUED' }, { status: 'complete' }])).toBe('active');
    expect(plantStatus([])).toBe('active');
  });
  it('parses example tags and drops the ellipsis', () => {
    expect(parseTags('A_1:GD, B_2:GD ...')).toEqual(['A_1:GD', 'B_2:GD']);
    expect(parseTags('')).toEqual([]);
  });
  it('turns a workbook into plants and device rows', () => {
    const sheets = {
      Index: [['ignored']],
      'GMR Delhi': [
        ['GMR Delhi'],
        ['instructions…'],
        ['Category', '# Sensors', 'Example tags', 'Make 1 (installed)', 'Model 1', 'Make 2', 'Model 2', 'Make 3', 'Model 3', 'Status', 'Notes'],
        ['DO', 5, 'DO_OS_TANK_AT_1:GD, DO_OS_TANK_AT_2:GD ...', 'Aquadax', 'ODO 20S', '', '', '', '', 'complete', ''],
        ['Level Transmitters', 3, 'LT_1:GD', 'Brotek', 'BT-UL', 'LFIA', 'LFT2', '', '', 'complete - tag-wise rule applied', 'split by tag'],
      ],
    };
    const { plants, rows } = parseRegister(sheets);
    expect(plants).toEqual([{ name: 'GMR Delhi', code: 'GD', client: 'GMR', status: 'active' }]);
    expect(rows).toHaveLength(2);
    expect(rows[1].pairs).toEqual([['Brotek', 'BT-UL'], ['LFIA', 'LFT2']]);
    expect(rows[0].tags).toEqual(['DO_OS_TANK_AT_1:GD', 'DO_OS_TANK_AT_2:GD']);
  });
});
