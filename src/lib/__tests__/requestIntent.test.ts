import { describe, it, expect } from 'vitest';
import { isProcedureRequest, isContactRequest, contactSkillHint } from '../requestIntent';

describe('isProcedureRequest', () => {
  it('recognises requests for steps / procedures', () => {
    expect(isProcedureRequest('share camera connection procedure')).toBe(true);
    expect(isProcedureRequest('How to calibrate pH sensor')).toBe(true);
    expect(isProcedureRequest('cleaning steps for the COD sensor')).toBe(true);
    expect(isProcedureRequest('give me the wiring instructions for MAG-110')).toBe(true);
    expect(isProcedureRequest('UPS installation kaise kare')).toBe(true);
  });
  it('does NOT treat faults as procedure requests', () => {
    expect(isProcedureRequest('camera connection lost')).toBe(false);
    expect(isProcedureRequest('pH not calibrating')).toBe(false);
    expect(isProcedureRequest('how to fix camera not connecting')).toBe(false);
    expect(isProcedureRequest('MAG-110 shows empty pipe error')).toBe(false);
    expect(isProcedureRequest('UPS beeping')).toBe(false);
  });
});

describe('isContactRequest', () => {
  it('recognises requests for support contacts', () => {
    expect(isContactRequest('give me EZVIZ contact details')).toBe(true);
    expect(isContactRequest('Microtek support number')).toBe(true);
    expect(isContactRequest('whom do I call for the UPS')).toBe(true);
    expect(isContactRequest('escalation contact for datalogger')).toBe(true);
    expect(isContactRequest('customer care of BPE')).toBe(true);
  });
  it('ignores fault descriptions that mention contact', () => {
    expect(isContactRequest('electrode contact with liquid is poor')).toBe(false);
    expect(isContactRequest('contactor not pulling in')).toBe(false);
    expect(isContactRequest('UPS beeping')).toBe(false);
  });
  it('maps skill words to directory roles', () => {
    expect(contactSkillHint('DigitalPaani support number')).toBe('dp_support');
    expect(contactSkillHint('who is the electrical engineer to call')).toBe('electrical_engineer');
    expect(contactSkillHint('vendor contact for EZVIZ')).toBe('vendor_support');
    expect(contactSkillHint('EZVIZ contact details')).toBeNull();
  });
});
