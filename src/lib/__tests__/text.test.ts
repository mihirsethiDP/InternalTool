import { describe, it, expect } from 'vitest';
import { sanitizeText } from '../text';

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
