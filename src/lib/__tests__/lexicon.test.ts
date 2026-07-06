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
