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

// Activity-based order: how a technician thinks about the sensor lifecycle.
export const SECTION_ORDER: SubmissionSection[] = [
  'install_commission', 'configure', 'inspect', 'clean', 'calibrate',
  'replace', 'troubleshoot_repair', 'maintenance_planning', 'other',
];

export const SECTION_LABEL: Record<SubmissionSection, string> = {
  install_commission: 'Install & Commission',
  configure: 'Configure',
  inspect: 'Inspect',
  clean: 'Clean',
  calibrate: 'Calibrate',
  replace: 'Replace',
  troubleshoot_repair: 'Troubleshoot & Repair',
  maintenance_planning: 'Maintenance Planning',
  other: 'Other',
};

// One-line description of each category (used as helper text in pickers).
export const SECTION_HINT: Record<SubmissionSection, string> = {
  install_commission: 'Location, mounting, wiring, first power-up, commissioning, sample conditioning',
  configure: 'Range, units, alarms, sampling, damping, compensation, firmware, parameter backup',
  inspect: 'Physical / cable / mounting / environmental checks, power, signal & comms verification',
  clean: 'Probe / housing / flow-cell cleaning, fouling & scaling removal, wiper & auto-clean checks',
  calibrate: 'Zero / span / multi-point calibration, drift, response & repeatability checks, records',
  replace: 'Membranes, electrolytes, reagents, filters, probes, cables, transmitters, batteries, pumps',
  troubleshoot_repair: 'Abnormal readings, no-data, fault codes, data gaps, root-cause analysis, repair, post-repair validation',
  maintenance_planning: 'PM schedules, calibration-due tracking, cleaning frequency, spare planning, maintenance history',
  other: 'Anything that does not fit the categories above',
};

// Categories that count toward "documentation completeness". A newly-added
// sensor has none, so it reads as incomplete until filled. All 8 activity
// categories count (Other is a catch-all and does not).
export const CHECKLIST_SECTIONS: SubmissionSection[] = [
  'install_commission', 'configure', 'inspect', 'clean', 'calibrate',
  'replace', 'troubleshoot_repair', 'maintenance_planning',
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
