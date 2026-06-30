import { describe, it, expect } from 'vitest';
import {
  parseSections, renderSections, replaceSection, appendSection, chunkSections,
  coverageOf, CHECKLIST_SECTIONS, SECTION_ORDER,
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
