import { describe, it, expect } from 'vitest';
import { queryTokens, matchScore } from '../routing';

describe('queryTokens', () => {
  it('keeps short domain terms (pH, EC)', () => {
    expect(queryTokens('pH drifting')).toContain('ph');
    expect(queryTokens('EC probe')).toContain('ec');
  });
  it('keeps discriminating words like "reading" and "sensor"', () => {
    const t = queryTokens('no reading from the sensor');
    expect(t).toContain('reading');
    expect(t).toContain('sensor');
  });
  it('drops generic filler', () => {
    const t = queryTokens('how do I fix this');
    expect(t).not.toContain('how');
    expect(t).not.toContain('this');
  });
});

describe('matchScore (overlap coefficient)', () => {
  it('scores a clear match high', () => {
    expect(matchScore(queryTokens('pH reading drifting'), 'pH reading is drifting')).toBeGreaterThan(0.6);
  });
  it('is not diluted by a verbose query', () => {
    // a wordy query that still clearly references the rule should clear the 0.34 threshold
    expect(matchScore(queryTokens('the pH reading keeps drifting around noon'), 'pH drift')).toBeGreaterThanOrEqual(0.34);
  });
  it('scores unrelated phrases low', () => {
    expect(matchScore(queryTokens('replace the membrane'), 'pH reading drifting')).toBeLessThan(0.34);
  });
  it('returns 0 for empty query tokens', () => {
    expect(matchScore(queryTokens('how do I'), 'pH drift')).toBe(0);
  });
});
