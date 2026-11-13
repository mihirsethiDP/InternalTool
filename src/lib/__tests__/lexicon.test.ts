import { describe, it, expect } from 'vitest';
import { editDistance, correctToken } from '../lexicon';

const LEX = new Set(['sensor', 'pressure', 'calibrate', 'reading', 'display', 'flowmeter', 'chlorine']);

describe('editDistance', () => {
  it('computes small distances', () => {
    expect(editDistance('senser', 'sensor')).toBe(1);
    expect(editDistance('presure', 'pressure')).toBe(1);
    expect(editDistance('sensor', 'sensor')).toBe(0);
  });
  it('bails out beyond the max', () => {
    expect(editDistance('abc', 'wxyz', 2)).toBeGreaterThan(2);
  });
});

describe('correctToken', () => {
  it('does not change a real word the lexicon lacks into a neighbour with another first letter', () => {
    const lex = new Set(['wipe', 'sensor', 'pressure']);
    expect(correctToken('pipe', lex)).toBe('pipe');
    expect(correctToken('presure', lex)).toBe('pressure');
  });
  it('fixes common misspellings', () => {
    expect(correctToken('senser', LEX)).toBe('sensor');
    expect(correctToken('presure', LEX)).toBe('pressure');
    expect(correctToken('calibrat', LEX)).toBe('calibrate');
    expect(correctToken('displey', LEX)).toBe('display');
  });
  it('leaves known words, short words, and model numbers alone', () => {
    expect(correctToken('sensor', LEX)).toBe('sensor');
    expect(correctToken('ph', LEX)).toBe('ph'); // too short to touch
    expect(correctToken('UPCS110', LEX)).toBe('UPCS110'); // contains digits
  });
  it('leaves genuinely unknown words alone', () => {
    expect(correctToken('unrelatedword', LEX)).toBe('unrelatedword');
  });
});

describe('fault words survive the corrector', () => {
  it('does not turn real words into neighbours', async () => {
    const { correctToken } = await import('../lexicon');
    const lex = new Set(['jamming', 'sharing', 'jumping', 'shaking', 'pressure']);
    expect(correctToken('jumping', lex)).toBe('jumping');
    expect(correctToken('jumpng', new Set(['jumping']))).toBe('jumping');
    expect(correctToken('shakin', new Set(['sharing']))).toBe('shakin');
  });
});

describe('corrections only land on device vocabulary', () => {
  it('known manual words protect, but are never targets', async () => {
    const { correctToken } = await import('../lexicon');
    const known = new Set(['cracked', 'scope', 'pressure', 'present', 'doct']);
    const targets = new Set(['pressure']);
    expect(correctToken('cricket', known, targets)).toBe('cricket');
    expect(correctToken('pretend', known, targets)).toBe('pretend');
    expect(correctToken('presure', known, targets)).toBe('pressure');
  });
});
