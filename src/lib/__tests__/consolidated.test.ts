import { describe, it, expect } from 'vitest';
import {
  parseSections, renderSections, replaceSection, appendSection, chunkSections,
  coverageOf, CHECKLIST_SECTIONS, SECTION_ORDER,
} from '../consolidated';

const sampleMd = `## troubleshooting

Check power and signal.

## cleaning

Wipe the probe with DI water.`;

describe('parseSections', () => {
  it('returns all sections empty for null/empty input', () => {
    const s = parseSections('');
    for (const key of SECTION_ORDER) expect(s[key]).toBe('');
    expect(parseSections(null)).toBeTruthy();
  });

  it('extracts content under each work-type header', () => {
    const s = parseSections(sampleMd);
    expect(s.troubleshooting).toBe('Check power and signal.');
    expect(s.cleaning).toBe('Wipe the probe with DI water.');
    expect(s.calibration).toBe('');
  });
});

describe('renderSections / round-trip', () => {
  it('round-trips section content', () => {
    const parsed = parseSections(sampleMd);
    const reparsed = parseSections(renderSections(parsed));
    expect(reparsed.troubleshooting).toBe('Check power and signal.');
    expect(reparsed.cleaning).toBe('Wipe the probe with DI water.');
  });
});

describe('replaceSection', () => {
  it('replaces a single section, leaving others intact', () => {
    const updated = replaceSection(sampleMd, 'troubleshooting', 'New steps.');
    const s = parseSections(updated);
    expect(s.troubleshooting).toBe('New steps.');
    expect(s.cleaning).toBe('Wipe the probe with DI water.');
  });
});

describe('appendSection', () => {
  it('appends to an existing section with a separator', () => {
    const updated = appendSection(sampleMd, 'troubleshooting', 'Extra note.');
    const s = parseSections(updated);
    expect(s.troubleshooting).toContain('Check power and signal.');
    expect(s.troubleshooting).toContain('Extra note.');
    expect(s.troubleshooting).toContain('---');
  });
  it('fills an empty section without a leading separator', () => {
    const updated = appendSection(sampleMd, 'calibration', 'Two-point cal.');
    expect(parseSections(updated).calibration).toBe('Two-point cal.');
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
    const c = coverageOf(sampleMd); // troubleshooting + cleaning = 2 of the checklist
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
    const tChunks = chunks.filter((c) => c.section === 'troubleshooting');
    expect(tChunks.length).toBe(1);
  });

  it('splits a long section into multiple chunks', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} about the sensor.`).join(' ');
    const sections = parseSections(`## troubleshooting\n\n${long}`);
    const chunks = chunkSections(sections, 200);
    const tChunks = chunks.filter((c) => c.section === 'troubleshooting');
    expect(tChunks.length).toBeGreaterThan(1);
  });

  it('omits empty sections', () => {
    const chunks = chunkSections(parseSections(sampleMd));
    expect(chunks.every((c) => c.text.trim().length > 0)).toBe(true);
  });
});
