// Helpers for the consolidated-doc workflow.
// A consolidated doc is plain markdown organised into five fixed sections:
//   ## manual
//   ## install
//   ## troubleshooting
//   ## datasheet
//   ## other
// Each section's body is everything between its ## header and the next ##
// header. Sections in this fixed order are always present (possibly empty)
// so replace / append operations are predictable.

import type { SubmissionSection } from './types';

export const SECTION_ORDER: SubmissionSection[] = [
  'troubleshooting', 'manual', 'install', 'datasheet', 'calibration',
  'cleaning', 'spares', 'ppm', 'wiring', 'safety', 'other',
];

export const SECTION_LABEL: Record<SubmissionSection, string> = {
  manual: 'Sensor Manual',
  install: 'Installation Guide',
  troubleshooting: 'Troubleshooting Steps',
  datasheet: 'Technical Data Sheet',
  calibration: 'Calibration Procedure',
  cleaning: 'Cleaning & Maintenance',
  spares: 'Spares & Consumables',
  ppm: 'PPM Schedule',
  wiring: 'Wiring & Communication',
  safety: 'Safety & Handling',
  other: 'Other',
};

export type Sections = Record<SubmissionSection, string>;

const EMPTY_SECTIONS = (): Sections => ({
  manual: '', install: '', troubleshooting: '', datasheet: '', calibration: '',
  cleaning: '', spares: '', ppm: '', wiring: '', safety: '', other: '',
});

export function parseSections(md: string | null | undefined): Sections {
  const out = EMPTY_SECTIONS();
  if (!md) return out;
  const lines = md.split('\n');
  let current: SubmissionSection | null = null;
  const buffers = Object.fromEntries(SECTION_ORDER.map((s) => [s, []])) as unknown as Record<SubmissionSection, string[]>;
  for (const line of lines) {
    const m = line.match(/^##\s+(manual|install|troubleshooting|datasheet|calibration|cleaning|spares|ppm|wiring|safety|other)\b/i);
    if (m) {
      current = m[1].toLowerCase() as SubmissionSection;
      continue;
    }
    if (current) buffers[current].push(line);
  }
  for (const s of SECTION_ORDER) out[s] = buffers[s].join('\n').trim();
  return out;
}

export function renderSections(sections: Sections): string {
  return SECTION_ORDER.map((s) => `## ${s}\n\n${sections[s] || ''}\n`).join('\n').trim() + '\n';
}

export function replaceSection(md: string, section: SubmissionSection, body: string): string {
  const sections = parseSections(md);
  sections[section] = body.trim();
  return renderSections(sections);
}

export function appendSection(md: string, section: SubmissionSection, addition: string, headerNote = ''): string {
  const sections = parseSections(md);
  const existing = sections[section];
  const block = headerNote ? `_${headerNote}_\n\n${addition.trim()}` : addition.trim();
  sections[section] = existing ? `${existing}\n\n---\n\n${block}` : block;
  return renderSections(sections);
}

// Sentence-boundary chunking, target ~1000 chars, returns chunks per section
// for re-indexing into consolidated_doc_chunks.
export function chunkSections(sections: Sections, target = 1000): Array<{ section: SubmissionSection; text: string }> {
  const out: Array<{ section: SubmissionSection; text: string }> = [];
  for (const s of SECTION_ORDER) {
    const body = (sections[s] || '').trim();
    if (!body) continue;
    if (body.length <= target) { out.push({ section: s, text: body }); continue; }
    const sentences = body.split(/(?<=[.!?])\s+/);
    let cur = '';
    for (const sent of sentences) {
      if ((cur + ' ' + sent).length > target && cur) { out.push({ section: s, text: cur }); cur = sent; }
      else cur = cur ? cur + ' ' + sent : sent;
    }
    if (cur) out.push({ section: s, text: cur });
  }
  return out;
}
