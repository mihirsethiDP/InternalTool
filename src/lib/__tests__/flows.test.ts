import { describe, it, expect } from 'vitest';
import { validateFlowDefinition, getNode, failTarget, scoreFlow, contactsForSkill, vagueSteps, type FlowDefinition, type EscalationContact } from '../flows';

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

describe('contactsForSkill', () => {
  const mk = (over: Partial<EscalationContact>): EscalationContact => ({
    id: Math.random().toString(36).slice(2), skill_key: 'electrical_engineer', label: 'Electrical engineer',
    person_name: 'X', contact: '99', notes: null, active: true, plant_id: null, make_id: null, sensor_model_id: null, ...over,
  });
  const contacts = [
    mk({ id: 'global' }),
    mk({ id: 'plantB', plant_id: 'pB', plant_name: 'B Plant' }),
    mk({ id: 'plantA', plant_id: 'pA', plant_name: 'A Plant' }),
    mk({ id: 'makeX', make_id: 'mX', make_name: 'MakeX' }),
    mk({ id: 'makeY', make_id: 'mY', make_name: 'MakeY' }),
    mk({ id: 'modelM1', sensor_model_id: 'sm1', model_label: 'MAG-110' }),
    mk({ id: 'modelM2', sensor_model_id: 'sm2', model_label: 'OCEMS' }),
    mk({ id: 'otherSkill', skill_key: 'supervisor' }),
  ];
  it('orders: matching MODEL → matching make → global → plants; drops other models/makes', () => {
    const r = contactsForSkill(contacts, 'electrical_engineer', { makeId: 'mX', modelId: 'sm1' });
    expect(r.map((c) => c.id)).toEqual(['modelM1', 'makeX', 'global', 'plantA', 'plantB']);
  });
  it('orders: matching make → global → plants (alphabetical); drops other makes', () => {
    const r = contactsForSkill(contacts, 'electrical_engineer', { makeId: 'mX' });
    expect(r.map((c) => c.id)).toEqual(['makeX', 'global', 'plantA', 'plantB']);
  });
  it('without a make/model in scope, drops all scoped rows', () => {
    const r = contactsForSkill(contacts, 'electrical_engineer', {});
    expect(r.map((c) => c.id)).toEqual(['global', 'plantA', 'plantB']);
  });
  it('a model contact never leaks to a different model', () => {
    const r = contactsForSkill(contacts, 'electrical_engineer', { makeId: 'mY', modelId: 'sm2' });
    expect(r.map((c) => c.id)).toEqual(['modelM2', 'makeY', 'global', 'plantA', 'plantB']);
    expect(r.some((c) => c.id === 'modelM1')).toBe(false);
  });
  it('filters by skill', () => {
    expect(contactsForSkill(contacts, 'supervisor', {}).map((c) => c.id)).toEqual(['otherSkill']);
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

describe('vagueSteps', () => {
  const def = (text: string): FlowDefinition => ({
    start: 'a',
    nodes: [{ id: 'a', kind: 'action', text, next: 'b' }, { id: 'b', kind: 'resolve', text: 'done' }],
  });

  it('flags bare interface jargon (the live field failure)', () => {
    // Real example a field tester hit: "Initiate manual cleaning cycle from the UI."
    const w = vagueSteps(def('Initiate manual cleaning cycle from the UI.'));
    expect(w).toHaveLength(1);
    expect(w[0].reason).toMatch(/UI/);
  });

  it('flags steps that point at another document', () => {
    expect(vagueSteps(def('Clean the electrode as per the manual.'))).toHaveLength(1);
    expect(vagueSteps(def('Refer to section 4 for the wiring detail.'))).toHaveLength(1);
  });

  it('flags steps too short to act on', () => {
    expect(vagueSteps(def('Clean it.'))).toHaveLength(1);
  });

  it('passes a self-contained step', () => {
    expect(vagueSteps(def('On the transmitter display, press MENU, choose Maintenance, then Manual Clean.'))).toHaveLength(0);
  });

  it('only checks action nodes', () => {
    const d: FlowDefinition = {
      start: 'a',
      nodes: [
        { id: 'a', kind: 'question', text: 'PLC ok?', options: [{ label: 'Y', next: 'b' }, { label: 'N', next: 'b' }] },
        { id: 'b', kind: 'resolve', text: 'ok' },
      ],
    };
    expect(vagueSteps(d)).toHaveLength(0);
  });
});
