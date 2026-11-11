import { describe, it, expect } from 'vitest';
import { docxXmlToText, extractionKind } from '../extract';

describe('docxXmlToText', () => {
  it('keeps paragraphs, tabs, breaks and table cells readable', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>EZVIZ H6c</w:t></w:r><w:r><w:tab/><w:t>Manual</w:t></w:r></w:p>'
      + '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Light</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Meaning</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
      + '<w:p><w:r><w:t>Press &amp; hold</w:t></w:r><w:br/><w:r><w:t>Done</w:t></w:r></w:p></w:body></w:document>';
    const t = docxXmlToText(xml);
    expect(t).toContain('EZVIZ H6c\tManual');
    expect(t).toContain('Light | Meaning |');
    expect(t).toContain('Press & hold\nDone');
  });
});

describe('extractionKind', () => {
  const f = (name: string, type = '') => ({ name, type } as File);
  it('maps extensions and mime types', () => {
    expect(extractionKind(f('a.pdf'))).toBe('pdf');
    expect(extractionKind(f('a.docx'))).toBe('docx');
    expect(extractionKind(f('x', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe('docx');
    expect(extractionKind(f('a.xlsx'))).toBe('sheet');
    expect(extractionKind(f('a.csv'))).toBe('sheet');
    expect(extractionKind(f('a.doc'))).toBe('unsupported');
    expect(extractionKind(f('a.png'))).toBe('unsupported');
  });
});
