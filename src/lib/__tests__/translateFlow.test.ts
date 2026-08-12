import { describe, it, expect } from 'vitest';
import { collectFlowStrings, applyFlowStrings } from '../translateFlow';
import type { FlowDefinition } from '../flows';

const def: FlowDefinition = {
  start: 'n1',
  nodes: [
    { id: 'n1', kind: 'question', text: 'Is the display on?', options: [
      { label: 'Yes', next: 'n2' },
      { label: 'No', next: 'n3' },
    ] },
    { id: 'n2', kind: 'action', text: 'Wipe the probe with a soft cloth.', next: 'n3' },
    { id: 'n3', kind: 'resolve', text: 'Issue resolved.' },
  ],
} as FlowDefinition;

describe('flow translation mapping', () => {
  it('collects node texts and option labels in stable order', () => {
    expect(collectFlowStrings(def)).toEqual([
      'Is the display on?', 'Yes', 'No',
      'Wipe the probe with a soft cloth.',
      'Issue resolved.',
    ]);
  });

  it('round-trips: apply(collect) reproduces the definition', () => {
    const back = applyFlowStrings(def, collectFlowStrings(def));
    expect(back).toEqual(def);
  });

  it('applies translated strings without touching structure (ids, edges, kinds)', () => {
    const hi = ['क्या डिस्प्ले चालू है?', 'हाँ', 'नहीं', 'प्रोब को मुलायम कपड़े से पोंछें।', 'समस्या हल हो गई।'];
    const out = applyFlowStrings(def, hi)!;
    expect(out.nodes[0].text).toBe('क्या डिस्प्ले चालू है?');
    expect(out.nodes[0].options?.map((o) => o.label)).toEqual(['हाँ', 'नहीं']);
    expect(out.nodes[0].options?.map((o) => o.next)).toEqual(['n2', 'n3']); // edges untouched
    expect(out.nodes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
    expect(out.start).toBe('n1');
  });

  it('rejects a count mismatch instead of mangling the flow', () => {
    expect(applyFlowStrings(def, ['only', 'three', 'items'])).toBeNull();
    expect(applyFlowStrings(def, [...collectFlowStrings(def), 'extra'])).toBeNull();
  });
});
