import { describe, it, expect } from 'vitest';
import { modelKeys, namedModel, type ModelRef } from '../modelNames';

const m = (id: string, modelNo: string, name?: string): ModelRef => ({ id, categoryId: 'c', generalModelId: null, label: modelNo, keys: modelKeys(modelNo, name) });

describe('namedModel', () => {
  const list = [m('hach', 'DPC1R1A'), m('selec', 'EM306'), m('upc', 'UPCS-MAG-110'), m('lisa', 'Trios LISA - UV'), m('bpe', '1 kVA Online UPS')];
  it('finds model numbers however they are written', () => {
    expect(namedModel('how to do 2 point calibration on HACH DPC1R1A', list)?.id).toBe('hach');
    expect(namedModel('selec em306 me CT ratio kaise set kare', list)?.id).toBe('selec');
    expect(namedModel('MAG-110 shows empty pipe error', list)?.id).toBe('upc');
    expect(namedModel('upcs mag 110 display blank', list)?.id).toBe('upc');
  });
  it('matches distinctive names, and a name shared by several makes matches none', () => {
    expect(namedModel('Trios LISA UV COD sensor power supply', list)?.id).toBe('lisa');
    const ups = [m('a', '1 kVA Online UPS'), m('b', '1 kVA Online UPS')];
    expect(namedModel('1 kva online ups beeping', ups)).toBeNull();
  });
  it('ignores names without a model number', () => {
    expect(namedModel('ups beeping', list)).toBeNull();
    expect(namedModel('4-20mA 3.2', list)).toBeNull();
  });
});
