import { describe, it, expect, afterEach } from 'vitest';
import {
  parseSections, renderSections, replaceSection, appendSection, chunkSections,
  coverageOf, CHECKLIST_SECTIONS, SECTION_ORDER, SECTION_LABEL, setSectionRegistry, sectionLabel, checklistSections,
} from '../consolidated';

const sampleMd = `## troubleshoot_repair

Check power and signal.

## clean

Wipe the probe with DI water.`;

describe('parseSections', () => {
  it('returns all sections empty for null/empty input', () => {
    const s = parseSections('');
    for (const key of SECTION_ORDER) expect(s[key]).toBe('');
    expect(parseSections(null)).toBeTruthy();
  });

  it('extracts content under each work-type header', () => {
    const s = parseSections(sampleMd);
    expect(s.troubleshoot_repair).toBe('Check power and signal.');
    expect(s.clean).toBe('Wipe the probe with DI water.');
    expect(s.calibrate).toBe('');
  });
});

describe('renderSections / round-trip', () => {
  it('round-trips section content', () => {
    const parsed = parseSections(sampleMd);
    const reparsed = parseSections(renderSections(parsed));
    expect(reparsed.troubleshoot_repair).toBe('Check power and signal.');
    expect(reparsed.clean).toBe('Wipe the probe with DI water.');
  });
});

describe('replaceSection', () => {
  it('replaces a single section, leaving others intact', () => {
    const updated = replaceSection(sampleMd, 'troubleshoot_repair', 'New steps.');
    const s = parseSections(updated);
    expect(s.troubleshoot_repair).toBe('New steps.');
    expect(s.clean).toBe('Wipe the probe with DI water.');
  });
});

describe('appendSection', () => {
  it('appends to an existing section with a separator', () => {
    const updated = appendSection(sampleMd, 'troubleshoot_repair', 'Extra note.');
    const s = parseSections(updated);
    expect(s.troubleshoot_repair).toContain('Check power and signal.');
    expect(s.troubleshoot_repair).toContain('Extra note.');
    expect(s.troubleshoot_repair).toContain('---');
  });
  it('fills an empty section without a leading separator', () => {
    const updated = appendSection(sampleMd, 'calibrate', 'Two-point cal.');
    expect(parseSections(updated).calibrate).toBe('Two-point cal.');
  });
});

describe('coverageOf', () => {
  it('reports zero coverage for empty content', () => {
    const c = coverageOf('');
    expect(c.covered).toBe(0);
    expect(c.total).toBe(CHECKLIST_SECTIONS.length);
    expect(c.complete).toBe(false);
    expect(c.missing.length).toBe(CHECKLIST_SECTIONS.length);
  });

  it('reports partial coverage', () => {
    const c = coverageOf(sampleMd); // troubleshoot_repair + clean = 2 of the checklist
    expect(c.covered).toBe(2);
    expect(c.complete).toBe(false);
  });

  it('reports complete when all checklist sections have content', () => {
    const md = CHECKLIST_SECTIONS.map((s) => `## ${s}\n\nContent for ${s}.`).join('\n\n');
    const c = coverageOf(md);
    expect(c.covered).toBe(CHECKLIST_SECTIONS.length);
    expect(c.complete).toBe(true);
    expect(c.missing.length).toBe(0);
  });
});

describe('chunkSections', () => {
  it('keeps a short section as a single chunk', () => {
    const chunks = chunkSections(parseSections(sampleMd));
    const tChunks = chunks.filter((c) => c.section === 'troubleshoot_repair');
    expect(tChunks.length).toBe(1);
  });

  it('splits a long section into multiple chunks', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} about the sensor.`).join(' ');
    const sections = parseSections(`## troubleshoot_repair\n\n${long}`);
    const chunks = chunkSections(sections, 200);
    const tChunks = chunks.filter((c) => c.section === 'troubleshoot_repair');
    expect(tChunks.length).toBeGreaterThan(1);
  });

  it('omits empty sections', () => {
    const chunks = chunkSections(parseSections(sampleMd));
    expect(chunks.every((c) => c.text.trim().length > 0)).toBe(true);
  });
});

describe('custom sections (types added in Admin)', () => {
  afterEach(() => setSectionRegistry(SECTION_ORDER.map((k) => ({ key: k, label: SECTION_LABEL[k] }))));

  it('round-trips a section the registry knows about', () => {
    setSectionRegistry([
      ...SECTION_ORDER.map((k) => ({ key: k, label: SECTION_LABEL[k] })),
      { key: 'tds', label: 'Technical Data Sheet' },
    ]);
    const md = renderSections({ ...parseSections(''), tds: 'Supply voltage 12 V DC' });
    expect(md).toContain('## tds');
    expect(parseSections(md).tds).toBe('Supply voltage 12 V DC');
  });

  it('NEVER drops content stored under an unknown section', () => {
    // registry is the built-in nine; the document already has a 'tds' block
    const stored = '## clean\n\nWipe the probe.\n\n## tds\n\nSupply voltage 12 V DC\n';
    const parsed = parseSections(stored);
    expect(parsed.tds).toBe('Supply voltage 12 V DC');
    // re-saving must preserve it rather than silently deleting it
    expect(renderSections(parsed)).toContain('Supply voltage 12 V DC');
  });

  it('labels an unknown key readably instead of showing blank', () => {
    expect(sectionLabel('tds')).toBe('Tds');           // prettified fallback
    setSectionRegistry([{ key: 'tds', label: 'Technical Data Sheet' }]);
    expect(sectionLabel('tds')).toBe('Technical Data Sheet');
  });
});

describe('completeness is registry-driven (048)', () => {
  afterEach(() => setSectionRegistry(SECTION_ORDER.map((k) => ({ key: k, label: SECTION_LABEL[k], counts: k !== 'other' }))));

  it('counts the built-in eight, never the catch-all', () => {
    setSectionRegistry(SECTION_ORDER.map((k) => ({ key: k, label: SECTION_LABEL[k], counts: k !== 'other' })));
    expect(checklistSections()).toHaveLength(8);
    expect(checklistSections()).not.toContain('other');
  });

  it('an admin-added section that counts raises the denominator', () => {
    setSectionRegistry([
      ...SECTION_ORDER.map((k) => ({ key: k, label: SECTION_LABEL[k], counts: k !== 'other' })),
      { key: 'tds', label: 'Technical Data Sheet', counts: true },
    ]);
    const cov = coverageOf('## clean\n\nWipe the probe.\n');
    expect(cov.total).toBe(9);          // 8 activities + Technical Data Sheet
    expect(cov.covered).toBe(1);
    expect(cov.missing).toContain('tds');
    expect(cov.complete).toBe(false);
  });

  it('a filled datasheet section now counts as documented', () => {
    setSectionRegistry([
      { key: 'clean', label: 'Clean', counts: true },
      { key: 'tds', label: 'Technical Data Sheet', counts: true },
    ]);
    const cov = coverageOf('## clean\n\nWipe the probe.\n\n## tds\n\nSupply voltage 12 V DC\n');
    expect(cov.covered).toBe(2);
    expect(cov.complete).toBe(true);
  });

  it('a section opted OUT stays out of the score', () => {
    setSectionRegistry([
      { key: 'clean', label: 'Clean', counts: true },
      { key: 'tds', label: 'Technical Data Sheet', counts: false },
    ]);
    const cov = coverageOf('## clean\n\nWipe the probe.\n');
    expect(cov.total).toBe(1);
    expect(cov.complete).toBe(true);
  });
});

describe('indexing an admin-added section (049)', () => {
  afterEach(() => setSectionRegistry(SECTION_ORDER.map((k) => ({ key: k, label: SECTION_LABEL[k], counts: k !== 'other' }))));

  it('chunks content in a custom section so it becomes searchable', () => {
    setSectionRegistry([
      ...SECTION_ORDER.map((k) => ({ key: k, label: SECTION_LABEL[k] })),
      { key: 'tds', label: 'Technical Data Sheet' },
    ]);
    const chunks = chunkSections(parseSections('## tds\n\nSupply voltage 12 V DC. IP rating IP65.\n'));
    expect(chunks.map((c) => c.section)).toContain('tds');
  });

  it('still chunks a section the registry has NOT loaded — approved content is never left unindexed', () => {
    // registry = built-in nine only, document already carries 'tds'
    const chunks = chunkSections(parseSections('## clean\n\nWipe it.\n\n## tds\n\nSupply voltage 12 V DC.\n'));
    expect(chunks.map((c) => c.section).sort()).toEqual(['clean', 'tds']);
  });
});
