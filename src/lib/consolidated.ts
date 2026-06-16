// Helpers for the consolidated-doc workflow.
//
// A consolidated reference is the OUTPUT: operator-facing content organised
// by WORK TYPE (the 14-category maintenance/diagnostic taxonomy below), NOT
// by the form of the source document. Raw uploads (manual, datasheet, install
// guide) are INPUTS — kept as source files — and their content is filed into
// these work-type sections at approval time.
//
// Stored as plain markdown with one "## <section-key>" header per section.

import type { SubmissionSection } from './types';

// Troubleshooting first (the tool's purpose), then operator work-types.
export const SECTION_ORDER: SubmissionSection[] = [
  'troubleshooting', 'cleaning', 'calibration', 'verification', 'inspection',
  'electrical', 'configuration', 'consumable', 'component', 'preventive',
  'corrective', 'data_quality', 'install_improve', 'software', 'other',
];

export const SECTION_LABEL: Record<SubmissionSection, string> = {
  troubleshooting: 'Troubleshooting',
  cleaning: 'Cleaning',
  calibration: 'Calibration',
  verification: 'Verification & Validation',
  inspection: 'Inspection',
  electrical: 'Electrical & Signal Checks',
  configuration: 'Configuration',
  consumable: 'Consumable Replacement',
  component: 'Component Replacement',
  preventive: 'Preventive Maintenance',
  corrective: 'Corrective Maintenance',
  data_quality: 'Data Quality Management',
  install_improve: 'Installation Improvement',
  software: 'Software & Firmware',
  other: 'Other',
};

// One-line description of each work type (used as helper text in pickers).
export const SECTION_HINT: Record<SubmissionSection, string> = {
  troubleshooting: 'Abnormal readings, no-data, fault codes, root-cause analysis',
  cleaning: 'Probe / housing / flow-cell cleaning, wiper & auto-clean checks',
  calibration: 'Zero, span, multi-point, field & lab calibration, records',
  verification: 'Cross-checks, drift / response / accuracy / repeatability checks',
  inspection: 'Physical, cable, mounting, sampling-point, environmental inspection',
  electrical: 'Power, signal output, noise, communication, data-mapping checks',
  configuration: 'Range, units, alarms, sampling rate, damping, compensation',
  consumable: 'Electrolyte, membrane, reagent, reference solution, filters',
  component: 'Probe, cable, transmitter, battery, wiper, pump/tubing replacement',
  preventive: 'PM schedule, calibration-due tracking, spare planning',
  corrective: 'Fault repair, reinstallation, bypass, post-repair validation',
  data_quality: 'Outlier detection, data gaps, validation rules, health scoring',
  install_improve: 'Relocation, protection, sample conditioning, flow correction',
  software: 'Firmware update, parameter backup, reset, diagnostic-log review',
  other: 'Anything that does not fit the categories above',
};

// Operator-critical work types that count toward "documentation completeness".
// A newly-added sensor has none of these, so it reads as incomplete until filled.
export const CHECKLIST_SECTIONS: SubmissionSection[] = [
  'troubleshooting', 'cleaning', 'calibration', 'verification',
  'inspection', 'electrical', 'configuration', 'preventive',
];

export interface Coverage {
  covered: number;
  total: number;
  missing: SubmissionSection[];
  complete: boolean;
}

/** Documentation coverage of a sensor's OWN consolidated content. */
export function coverageOf(markdown: string | null | undefined): Coverage {
  const s = parseSections(markdown);
  const missing = CHECKLIST_SECTIONS.filter((x) => !s[x]);
  const covered = CHECKLIST_SECTIONS.length - missing.length;
  return { covered, total: CHECKLIST_SECTIONS.length, missing, complete: missing.length === 0 };
}

export type Sections = Record<SubmissionSection, string>;

const EMPTY_SECTIONS = (): Sections =>
  Object.fromEntries(SECTION_ORDER.map((s) => [s, ''])) as unknown as Sections;

const SECTION_RE = new RegExp(`^##\\s+(${SECTION_ORDER.join('|')})\\b`, 'i');

export function parseSections(md: string | null | undefined): Sections {
  const out = EMPTY_SECTIONS();
  if (!md) return out;
  const lines = md.split('\n');
  let current: SubmissionSection | null = null;
  const buffers = Object.fromEntries(SECTION_ORDER.map((s) => [s, []])) as unknown as Record<SubmissionSection, string[]>;
  for (const line of lines) {
    const m = line.match(SECTION_RE);
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
