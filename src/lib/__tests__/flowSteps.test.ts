import { describe, it, expect } from 'vitest';
import { flowToSteps } from '../flowSteps';
import type { FlowDefinition } from '../flows';

describe('flowToSteps', () => {
  it('writes a straight-line flow as 1, 2, 3 with outcomes inline', () => {
    const def: FlowDefinition = {
      start: 'a',
      nodes: [
        { id: 'a', kind: 'action', text: 'Check the wall socket.', next: 'b' },
        { id: 'b', kind: 'action', text: 'Re-seat the power cord.', next: 'q' },
        { id: 'q', kind: 'question', text: 'Is the UPS on now?', options: [{ label: 'Yes', next: 'ok' }, { label: 'No', next: 'call' }] },
        { id: 'ok', kind: 'resolve', text: 'The UPS is powered again.' },
        { id: 'call', kind: 'escalate', text: 'Call the OEM.', skill: 'vendor_support' },
      ],
    };
    const s = flowToSteps(def);
    expect(s).toContain('1. Check the wall socket.');
    expect(s).toContain('2. Re-seat the power cord.');
    expect(s).toContain('3. Is the UPS on now?');
    expect(s).toContain('If “Yes”: Fixed: The UPS is powered again.');
    expect(s).toContain('If “No”: Get help: Call the OEM.');
    expect(s).not.toContain('go to step 2');
  });

  it('branches point at step numbers and each node appears once', () => {
    const def: FlowDefinition = {
      start: 'light',
      nodes: [
        { id: 'light', kind: 'question', text: 'What is the light doing?', options: [{ label: 'Blue', next: 'refresh' }, { label: 'Red', next: 'router' }, { label: 'Off', next: 'power' }] },
        { id: 'refresh', kind: 'action', text: 'Refresh the app.', next: 'ok' },
        { id: 'router', kind: 'action', text: 'Reboot the router.', next: 'online' },
        { id: 'power', kind: 'action', text: 'Check the adapter.', next: 'light' },
        { id: 'online', kind: 'question', text: 'Online now?', options: [{ label: 'Yes', next: 'ok' }, { label: 'No', next: 'help' }] },
        { id: 'ok', kind: 'resolve', text: 'Back online.' },
        { id: 'help', kind: 'escalate', text: 'Contact EZVIZ support.', skill: 'vendor_support' },
      ],
    };
    const s = flowToSteps(def);
    expect((s.match(/Reboot the router\./g) ?? []).length).toBe(1);
    expect(s).toMatch(/If “Red”: go to step \d/);
    expect(s).toMatch(/Check the adapter\.\n {3}- Go to step 1/);
    expect(s).toContain('If “No”: Get help: Contact EZVIZ support.');
  });

  it('keeps explicit "didn\'t work" paths', () => {
    const def: FlowDefinition = {
      start: 'a',
      nodes: [
        { id: 'a', kind: 'action', text: 'Clean the probe.', next: 'ok', fail_next: 'b' },
        { id: 'b', kind: 'action', text: 'Recalibrate.', next: 'ok' },
        { id: 'ok', kind: 'resolve', text: 'Reading is stable.' },
      ],
    };
    const s = flowToSteps(def);
    expect(s).toContain('1. Clean the probe.');
    expect(s).toContain('- Fixed: Reading is stable.');
    expect(s).toMatch(/If that didn’t work: (go to step 2)?/);
  });
});
