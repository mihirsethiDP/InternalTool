import { describe, it, expect } from 'vitest';
import { interpretFlowReplyLocal, flowReplyNext, flowReplyLabel } from '../flowReply';

const action = { kind: 'action' as const, next: 'n2' };
const question = { kind: 'question' as const, options: [{ label: 'Yes — red light is on', next: 'a' }, { label: 'No red light', next: 'b' }, { label: 'Red light flickering', next: 'c' }] };

describe('interpretFlowReplyLocal — action steps', () => {
  it('done-style replies advance', () => {
    for (const t of ['done', 'yes', 'ok', 'haan ho gaya', 'tightened the wires', 'kar diya'])
      expect(interpretFlowReplyLocal(t, action)).toEqual({ action: 'option', option: 1 });
  });
  it('no-change replies fail the step', () => {
    for (const t of ['no', 'still same', 'no change', 'nahi hua', "that didn't work", 'still blank'])
      expect(interpretFlowReplyLocal(t, action)).toEqual({ action: 'option', option: 2 });
  });
  it('questions about the step are asides', () => {
    expect(interpretFlowReplyLocal('where is the boom cover?', action)).toEqual({ action: 'question' });
    expect(interpretFlowReplyLocal('which terminal is IOUT', action)).toEqual({ action: 'question' });
    expect(interpretFlowReplyLocal('what does FGP mean', action)).toEqual({ action: 'question' });
  });
  it('leaving the flow', () => {
    expect(interpretFlowReplyLocal('stop this', action)).toEqual({ action: 'leave' });
    expect(interpretFlowReplyLocal('never mind', action)).toEqual({ action: 'leave' });
  });
  it('unknown text is left to the model', () => {
    expect(interpretFlowReplyLocal('the pump near it is also off', action)).toBeNull();
  });
});

describe('interpretFlowReplyLocal — question steps', () => {
  it('picks an option by words, ordinal or yes/no', () => {
    expect(interpretFlowReplyLocal('red light is on', question)).toEqual({ action: 'option', option: 1 });
    expect(interpretFlowReplyLocal('flickering', question)).toEqual({ action: 'option', option: 3 });
    expect(interpretFlowReplyLocal('2', question)).toEqual({ action: 'option', option: 2 });
    expect(interpretFlowReplyLocal('the second one', question)).toEqual({ action: 'option', option: 2 });
    expect(interpretFlowReplyLocal('yes', question)).toEqual({ action: 'option', option: 1 });
    expect(interpretFlowReplyLocal('nahi', question)).toEqual({ action: 'option', option: 2 });
  });
  it('ambiguous text is left to the model', () => {
    expect(interpretFlowReplyLocal('light', question)).toBeNull();
  });
  it('resolves label and next', () => {
    const r = interpretFlowReplyLocal('flickering', question)!;
    expect(flowReplyLabel(r, question, 'Done', 'Failed')).toBe('Red light flickering');
    expect(flowReplyNext(r, question, null)).toBe('c');
    expect(flowReplyNext({ action: 'option', option: 2 }, action, 'esc')).toBe('esc');
    expect(flowReplyLabel({ action: 'option', option: 1 }, action, 'Done', 'Failed')).toBe('Done');
  });
});
