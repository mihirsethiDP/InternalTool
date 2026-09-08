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

// ---------------------------------------------------------------------------
// Runtime section registry.
//
// Migration 040 made the upload type and the approval section ONE taxonomy,
// stored in document_types — but the lists above stayed hard-coded, so a type
// added in Admin (e.g. "Technical Data Sheet") never became a section: missing
// from the approve dropdowns, invisible to the AI splitter, and renderSections
// would have DROPPED its content on the next save.
//
// Filled from document_types at boot (see useSectionDefs); falls back to the
// built-in nine so nothing depends on that fetch succeeding.
export interface SectionDef { key: string; label: string; hint?: string; counts?: boolean }

const BUILTIN_DEFS: SectionDef[] = SECTION_ORDER.map((k) => ({
  key: k, label: SECTION_LABEL[k], hint: SECTION_HINT[k], counts: k !== 'other',
}));

let REGISTRY: SectionDef[] = BUILTIN_DEFS;

export function setSectionRegistry(defs: SectionDef[]) {
  if (defs.length) REGISTRY = defs;
}
export function sectionDefs(): SectionDef[] { return REGISTRY; }
export function sectionKeys(): string[] { return REGISTRY.map((d) => d.key); }

/** Human label for a section key — DB label, else built-in, else prettified. */
export function sectionLabel(key: string): string {
  return REGISTRY.find((d) => d.key === key)?.label
    ?? SECTION_LABEL[key as SubmissionSection]
    ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
export function sectionHint(key: string): string {
  return REGISTRY.find((d) => d.key === key)?.hint ?? SECTION_HINT[key as SubmissionSection] ?? '';
}

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
  missing: string[];
  complete: boolean;
}

/** Documentation coverage of a sensor's OWN consolidated content. */
/** Sections that count as "documented". The DB flag decides (migration 048),
 *  so a section an admin adds opts in or out without a code change. */
export function checklistSections(): string[] {
  return REGISTRY.filter((d) => d.counts !== false).map((d) => d.key);
}

/** Documentation coverage of a sensor's OWN consolidated content. */
export function coverageOf(markdown: string | null | undefined): Coverage {
  const s = parseSections(markdown);
  const checklist = checklistSections();
  const missing = checklist.filter((x) => !s[x]);
  return { covered: checklist.length - missing.length, total: checklist.length, missing, complete: missing.length === 0 };
}

// Keyed by string, not the built-in union: sections are data now, so a
// document can legitimately carry a key added in Admin.
export type Sections = Record<string, string>;

const EMPTY_SECTIONS = (): Sections =>
  Object.fromEntries(sectionKeys().map((s) => [s, ''])) as unknown as Sections;

// ANY "## some_key" header is a section, not only the ones we know about, so a
// document written under a key the registry hasn't loaded (or that was later
// removed) still round-trips instead of being silently dropped.
const SECTION_RE = /^##\s+([a-z0-9_]+)\s*$/i;

export function parseSections(md: string | null | undefined): Sections {
  const out = EMPTY_SECTIONS();
  if (!md) return out;
  const lines = md.split('\n');
  let current: string | null = null;
  const buffers: Record<string, string[]> = {};
  for (const key of sectionKeys()) buffers[key] = [];
  for (const line of lines) {
    const m = line.match(SECTION_RE);
    if (m) {
      current = m[1].toLowerCase();
      if (!buffers[current]) buffers[current] = [];
      continue;
    }
    if (current) buffers[current].push(line);
  }
  for (const key of Object.keys(buffers)) (out as Record<string, string>)[key] = buffers[key].join('\n').trim();
  return out;
}

export function renderSections(sections: Sections): string {
  // Registry order first, then any other key the document already carries —
  // writing only the known list would delete content on the next save.
  const known = sectionKeys();
  const extras = Object.keys(sections).filter((k) => !known.includes(k));
  return [...known, ...extras]
    .map((s) => `## ${s}\n\n${(sections as Record<string, string>)[s] || ''}\n`)
    .join('\n').trim() + '\n';
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
export function chunkSections(sections: Sections, target = 1000): Array<{ section: string; text: string }> {
  const out: Array<{ section: string; text: string }> = [];
  // Iterate what the DOCUMENT actually has, not the built-in list: content
  // filed into an admin-added section would otherwise never be indexed, so it
  // would approve cleanly and then be invisible to search and to Dr. Paani.
  const known = sectionKeys();
  const order = [...known, ...Object.keys(sections).filter((k) => !known.includes(k))];
  for (const s of order) {
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
