import { describe, it, expect } from 'vitest';
import { sanitizeText, stripCitationMarkers } from '../text';

// Control characters are built with fromCharCode so this file stays pure
// ASCII — the bug it guards was itself an encoding problem.
const NUL = String.fromCharCode(0);
const BELL = String.fromCharCode(7);
const DEL = String.fromCharCode(127);

describe('sanitizeText', () => {
  it('strips NUL — the byte that broke uploads in the field', () => {
    // "unsupported Unicode escape sequence" from Postgres on insert
    expect(sanitizeText(`Manual${NUL} MAG-110`)).toBe('Manual MAG-110');
    expect(sanitizeText(NUL + NUL + 'text')).toBe('text');
  });

  it('strips other control characters', () => {
    expect(sanitizeText(`a${BELL}b${DEL}c`)).toBe('abc');
  });

  it('keeps tab, newline and carriage return (they carry layout)', () => {
    expect(sanitizeText('a\tb\nc\r\nd')).toBe('a\tb\nc\r\nd');
  });

  it('keeps real content untouched', () => {
    const s = 'Clean the pH probe with 0.1M HCl — see table 4 (25 degC).';
    expect(sanitizeText(s)).toBe(s);
  });

  it('preserves non-Latin scripts and emoji (valid surrogate pairs)', () => {
    expect(sanitizeText('सेंसर खराब है')).toBe('सेंसर खराब है');
    expect(sanitizeText('ok 🔧 done')).toBe('ok 🔧 done');
  });

  it('drops unpaired surrogates that would break JSON encoding', () => {
    const lone = String.fromCharCode(0xd800);
    expect(sanitizeText(`a${lone}b`)).toBe('ab');
  });

  it('handles empty and null-ish input', () => {
    expect(sanitizeText('')).toBe('');
    expect(sanitizeText(undefined as unknown as string)).toBe('');
  });
});

describe('stripCitationMarkers', () => {
  it('removes the markers the field screenshot showed', () => {
    expect(stripCitationMarkers('Stop the analyzer and open the sensor chamber carefully [1].'))
      .toBe('Stop the analyzer and open the sensor chamber carefully.');
    // the model also emits fullwidth CJK brackets unprompted
    expect(stripCitationMarkers('Rinse the sensor with distilled water 【1】.'))
      .toBe('Rinse the sensor with distilled water.');
  });

  it('handles grouped and multiple markers', () => {
    expect(stripCitationMarkers('Check calibration [1][2].')).toBe('Check calibration.');
    expect(stripCitationMarkers('Log the action [1, 2].')).toBe('Log the action.');
  });

  it('keeps real bracketed content', () => {
    expect(stripCitationMarkers('See [Page 4] for wiring.')).toBe('See [Page 4] for wiring.');
    expect(stripCitationMarkers('Use ≤5 % H₂SO₄ (or the recommended solution).'))
      .toBe('Use ≤5 % H₂SO₄ (or the recommended solution).');
  });

  it('leaves markdown list structure intact', () => {
    expect(stripCitationMarkers('1. Stop the analyzer [1].\n2. Rinse it [2].'))
      .toBe('1. Stop the analyzer.\n2. Rinse it.');
  });

  it('does not mangle mid-sentence text', () => {
    expect(stripCitationMarkers('Clean the cell [1] and refit the probe [2] afterwards.'))
      .toBe('Clean the cell and refit the probe afterwards.');
  });
});

describe('stripCitationMarkers — non-breaking spaces', () => {
  const NBSP = '\u00A0';
  it('handles a marker separated by a non-breaking space', () => {
    expect(stripCitationMarkers(`before handling any acid${NBSP}【1】.`))
      .toBe('before handling any acid.');
  });
  it('closes a non-breaking gap left before punctuation', () => {
    expect(stripCitationMarkers(`Rinse the sensor${NBSP}.`)).toBe('Rinse the sensor.');
  });
});
