import { describe, it, expect } from 'vitest';
import { validateFlowDefinition, getNode, failTarget, scoreFlow, type FlowDefinition } from '../flows';

const GOOD: FlowDefinition = {
  start: 'n1',
  nodes: [
    { id: 'n1', kind: 'question', text: 'Is the display blank?', options: [{ label: 'Yes', next: 'n2' }, { label: 'No', next: 'n3' }] },
    { id: 'n2', kind: 'action', text: 'Check the 24V supply.', source_section: 'troubleshoot_repair', next: 'n3' },
    { id: 'n3', kind: 'question', text: 'Working now?', options: [{ label: 'Yes', next: 'n4' }, { label: 'No', next: 'n5' }] },
    { id: 'n4', kind: 'resolve', text: 'Reading restored.' },
    { id: 'n5', kind: 'escalate', skill: 'electrical_engineer', text: 'Needs panel check.' },
  ],
};

describe('validateFlowDefinition', () => {
  it('accepts a well-formed flow', () => {
    expect(validateFlowDefinition(GOOD).ok).toBe(true);
  });
  it('rejects a missing start node', () => {
    const r = validateFlowDefinition({ ...GOOD, start: 'nope' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/start/);
  });
  it('rejects dangling option targets', () => {
    const bad = { ...GOOD, nodes: GOOD.nodes.map((n) => n.id === 'n1' ? { ...n, options: [{ label: 'Yes', next: 'missing' }, { label: 'No', next: 'n3' }] } : n) };
    expect(validateFlowDefinition(bad).ok).toBe(false);
  });
  it('rejects a question with fewer than 2 options', () => {
    const bad = { ...GOOD, nodes: GOOD.nodes.map((n) => n.id === 'n3' ? { ...n, options: [{ label: 'Yes', next: 'n4' }] } : n) };
    expect(validateFlowDefinition(bad).ok).toBe(false);
  });
  it('rejects duplicate ids and empty text', () => {
    expect(validateFlowDefinition({ start: 'a', nodes: [{ id: 'a', kind: 'resolve', text: 'x' }, { id: 'a', kind: 'resolve', text: 'y' }] }).ok).toBe(false);
    expect(validateFlowDefinition({ start: 'a', nodes: [{ id: 'a', kind: 'resolve', text: '  ' }] }).ok).toBe(false);
  });
  it('rejects an escalate without a skill', () => {
    const bad = { ...GOOD, nodes: GOOD.nodes.map((n) => n.id === 'n5' ? { ...n, skill: '' } : n) };
    expect(validateFlowDefinition(bad as FlowDefinition).ok).toBe(false);
  });
  it('rejects non-objects and empty node lists', () => {
    expect(validateFlowDefinition(null).ok).toBe(false);
    expect(validateFlowDefinition({ start: 'a', nodes: [] }).ok).toBe(false);
  });
});

describe('walk helpers', () => {
  it('getNode finds by id', () => {
    expect(getNode(GOOD, 'n4')?.kind).toBe('resolve');
    expect(getNode(GOOD, 'zz')).toBeNull();
  });
  it('failTarget prefers explicit fail_next, else first escalate', () => {
    const action = getNode(GOOD, 'n2')!;
    expect(failTarget(GOOD, action)).toBe('n5'); // no fail_next → first escalate
    expect(failTarget(GOOD, { ...action, fail_next: 'n3' })).toBe('n3');
  });
});

describe('scoreFlow', () => {
  const flow = { title: 'Flow sensor reads zero', trigger_symptoms: ['no flow reading', 'flowmeter shows 0', 'display stuck at zero'] };
  it('matches close phrasings', () => {
    expect(scoreFlow('my flow sensor is reading zero', flow)).toBeGreaterThan(0.34);
    expect(scoreFlow('flowmeter shows 0', flow)).toBeGreaterThan(0.34);
  });
  it('ignores unrelated queries', () => {
    expect(scoreFlow('how do I calibrate the pH probe', flow)).toBeLessThan(0.34);
  });
});
