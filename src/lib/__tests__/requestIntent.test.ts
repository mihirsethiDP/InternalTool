import { describe, it, expect } from 'vitest';
import { isProcedureRequest, isContactRequest, contactSkillHint, isDocumentRequest } from '../requestIntent';

describe('isDocumentRequest', () => {
  it('recognises requests for the document itself', () => {
    for (const t of ['manual of ups', 'router docs', 'do you have any document about camera?', 'ups docx of microtek', 'user manual', 'datasheet for MAG-110'])
      expect(isDocumentRequest(t)).toBe(true);
  });
  it('ignores ordinary questions', () => {
    for (const t of ['camera showing offline', 'how to on ups', 'pH drifting', 'ups me ENA show kar rha hai'])
      expect(isDocumentRequest(t)).toBe(false);
  });
});

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

import { normalizeFieldPhrasing } from '../requestIntent';
describe('normalizeFieldPhrasing', () => {
  it('turns on/off verbs into searchable phrases', () => {
    expect(normalizeFieldPhrasing('how to on ups')).toBe('how to turn on ups');
    expect(normalizeFieldPhrasing('camera on kaise kare')).toBe('camera turn on kaise kare');
    expect(normalizeFieldPhrasing('ups off karna hai')).toBe('ups turn off hai');
  });
  it('leaves ordinary sentences alone', () => {
    expect(normalizeFieldPhrasing('error on display')).toBe('error on display');
    expect(normalizeFieldPhrasing('UPS is on battery')).toBe('UPS is on battery');
  });
});
