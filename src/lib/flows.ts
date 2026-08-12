import { supabase } from './supabase';
import { queryTokens, matchScore } from './routing';

// Diagnostic Flow Engine — shared types, validation, matching, and walking.
//
// A flow is an AI-drafted, admin-approved decision tree stored in
// diagnostic_flows.definition (jsonb). The assistant runs APPROVED flows
// turn-by-turn: question nodes show option chips, action nodes show a step
// with "Done / Didn't work", resolve and escalate nodes are terminal.

export type FlowNodeKind = 'question' | 'action' | 'resolve' | 'escalate';

export interface FlowOption {
  label: string;
  next: string;
}

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  text: string;
  options?: FlowOption[]; // question only
  next?: string; // action only (where "Done" goes; "Didn't work" is handled by the runner)
  fail_next?: string; // action only, optional (where "Didn't work" goes; default: next escalate/resolve)
  source_section?: string; // action provenance — consolidated doc section key
  skill?: string; // escalate only — escalation_contacts.skill_key
  // Classification matrix, action nodes (AI-proposed, admin-editable):
  visit?: 'no_visit' | 'visit_required';
  // action nodes reuse `skill` semantics differently: for actions it is
  // 'anyone' | 'specialist' (who can perform the step).
}

export interface FlowDefinition {
  start: string;
  nodes: FlowNode[];
  // AI's proposed flow-level 2×2 — pre-fills the admin's confirmation chips.
  proposed_classification?: { visit_required: boolean; skill_required: 'anyone' | 'specialist' };
}

export interface DiagnosticFlow {
  id: string;
  sensor_category_id: string;
  sensor_model_id: string | null;
  title: string;
  trigger_symptoms: string[];
  definition: FlowDefinition;
  status: 'draft' | 'approved' | 'archived';
  source_doc_id: string | null;
  created_at: string;
  approved_at: string | null;
  // Human-confirmed classification (NULL until approved — approval requires both).
  visit_required: boolean | null;
  skill_required: 'anyone' | 'specialist' | null;
}

// Steps must be followable with NOTHING but the chat text — a technician in
// the field has no manual open. Flags the three ways a generated step fails
// that test, so the admin sees them before approving (live example that
// prompted this: "Initiate manual cleaning cycle from the UI").
const JARGON = /\b(UI|HMI|PLC|SCADA|DCS|GUI)\b/;
const POINTS_ELSEWHERE = /\b(as per the manual|refer to|see section|see chapter|per the datasheet|follow the .{0,30}procedure|as described in)\b/i;

export function vagueSteps(def: FlowDefinition | null | undefined): { id: string; text: string; reason: string }[] {
  const out: { id: string; text: string; reason: string }[] = [];
  for (const n of def?.nodes ?? []) {
    if (n.kind !== 'action') continue;
    const text = (n.text ?? '').trim();
    const jargon = text.match(JARGON)?.[0];
    if (jargon) out.push({ id: n.id, text, reason: `“${jargon}” won't mean anything in the field — say which screen or device` });
    else if (POINTS_ELSEWHERE.test(text)) out.push({ id: n.id, text, reason: 'points at another document instead of giving the steps' });
    else if (text.length < 20) out.push({ id: n.id, text, reason: 'too short to act on — say where and what' });
  }
  return out;
}

export interface EscalationContact {
  id: string;
  skill_key: string;
  label: string;
  person_name: string | null;
  contact: string | null;
  notes: string | null;
  active: boolean;
  // Scope: all null = global default; plant_id = that plant's person;
  // make_id = that manufacturer's support line; sensor_model_id = the support
  // contact for one specific model (vendor numbers differ per model).
  plant_id: string | null;
  make_id: string | null;
  sensor_model_id: string | null;
  plant_name?: string | null; // joined for display
  make_name?: string | null;
  model_label?: string | null;
}

export const MAX_NODES = 24;

// Validate a definition well enough to guarantee the runner can't crash or
// loop forever: ids unique, all edges resolve, start exists, terminals are
// terminal, questions always offer a way forward.
export function validateFlowDefinition(def: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const d = def as FlowDefinition;
  if (!d || typeof d !== 'object') return { ok: false, errors: ['definition is not an object'] };
  if (!Array.isArray(d.nodes) || d.nodes.length === 0) return { ok: false, errors: ['definition has no nodes'] };
  if (d.nodes.length > MAX_NODES) errors.push(`too many nodes (${d.nodes.length} > ${MAX_NODES})`);

  const ids = new Set<string>();
  for (const n of d.nodes) {
    if (!n.id || typeof n.id !== 'string') { errors.push('node missing id'); continue; }
    if (ids.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
    ids.add(n.id);
  }
  if (!d.start || !ids.has(d.start)) errors.push(`start "${d.start}" is not a node`);

  for (const n of d.nodes) {
    if (!n.text || !String(n.text).trim()) errors.push(`node "${n.id}" has no text`);
    switch (n.kind) {
      case 'question': {
        const opts = n.options ?? [];
        if (opts.length < 2) errors.push(`question "${n.id}" needs at least 2 options`);
        for (const o of opts) {
          if (!o.label?.trim()) errors.push(`question "${n.id}" has an option without a label`);
          if (!o.next || !ids.has(o.next)) errors.push(`question "${n.id}" option "${o.label}" points to missing node "${o.next}"`);
        }
        break;
      }
      case 'action':
        if (!n.next || !ids.has(n.next)) errors.push(`action "${n.id}" points to missing node "${n.next}"`);
        if (n.fail_next && !ids.has(n.fail_next)) errors.push(`action "${n.id}" fail_next points to missing node "${n.fail_next}"`);
        break;
      case 'resolve':
        break;
      case 'escalate':
        if (!n.skill?.trim()) errors.push(`escalate "${n.id}" has no skill`);
        break;
      default:
        errors.push(`node "${(n as FlowNode).id}" has unknown kind "${(n as FlowNode).kind}"`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function getNode(def: FlowDefinition, id: string): FlowNode | null {
  return def.nodes.find((n) => n.id === id) ?? null;
}

// Where an action's "Didn't work" goes: explicit fail_next, else the first
// escalate node, else the first resolve node (so the runner always terminates).
export function failTarget(def: FlowDefinition, node: FlowNode): string | null {
  if (node.fail_next) return node.fail_next;
  const esc = def.nodes.find((n) => n.kind === 'escalate');
  if (esc) return esc.id;
  const res = def.nodes.find((n) => n.kind === 'resolve');
  return res?.id ?? null;
}

const FLOW_THRESHOLD = 0.34;

// Match a user's message against approved flows' title + trigger symptoms.
// Scoped: prefer flows for the model in scope, then its category, then any.
export function scoreFlow(query: string, flow: Pick<DiagnosticFlow, 'title' | 'trigger_symptoms'>): number {
  const qt = queryTokens(query);
  return Math.max(
    matchScore(qt, flow.title),
    ...(flow.trigger_symptoms ?? []).map((s) => matchScore(qt, s)),
    0,
  );
}

export async function matchFlow(
  query: string,
  scope: { categoryId?: string | null; modelId?: string | null },
): Promise<DiagnosticFlow | null> {
  try {
    let q = supabase
      .from('diagnostic_flows')
      .select('id, sensor_category_id, sensor_model_id, title, trigger_symptoms, definition, status, source_doc_id, created_at, approved_at')
      .eq('status', 'approved');
    // Scope filter: with a category in play, only that category's flows compete.
    if (scope.categoryId) q = q.eq('sensor_category_id', scope.categoryId);
    const { data } = await q.limit(200);
    const flows = (data ?? []) as DiagnosticFlow[];
    if (flows.length === 0) return null;

    let best: DiagnosticFlow | null = null;
    let bestScore = 0;
    for (const f of flows) {
      let s = scoreFlow(query, f);
      if (s < FLOW_THRESHOLD) continue;
      // Model-specific flow for the model in scope beats a category-general one.
      if (scope.modelId && f.sensor_model_id === scope.modelId) s += 0.25;
      else if (f.sensor_model_id && scope.modelId && f.sensor_model_id !== scope.modelId) continue; // other model's flow: skip
      if (s > bestScore) { bestScore = s; best = f; }
    }
    if (!best) return null;
    // Never run a definition the validator rejects — fall back to RAG instead.
    if (!validateFlowDefinition(best.definition).ok) return null;
    return best;
  } catch (e) {
    console.warn('matchFlow failed', e);
    return null;
  }
}

export async function fetchContacts(): Promise<EscalationContact[]> {
  const { data } = await supabase
    .from('escalation_contacts')
    .select('*, plants(name), sensor_makes(name), sensor_models(model_no, name)')
    .eq('active', true)
    .order('sort_order');
  return ((data ?? []) as any[]).map((c) => {
    const sm = Array.isArray(c.sensor_models) ? c.sensor_models[0] : c.sensor_models;
    return {
      ...c,
      plant_name: (Array.isArray(c.plants) ? c.plants[0] : c.plants)?.name ?? null,
      make_name: (Array.isArray(c.sensor_makes) ? c.sensor_makes[0] : c.sensor_makes)?.name ?? null,
      model_label: sm ? (sm.model_no || sm.name) : null,
    };
  }) as EscalationContact[];
}

// Resolve who to show for a skill, given what we know about the situation.
// Order: the exact MODEL's support contact first (vendor numbers differ per
// model), then the MAKE's line, then the GLOBAL default, then per-PLANT
// people (the technician spots their plant). Contacts scoped to OTHER
// models/makes are dropped; plant rows are always shown because we don't
// know which plant the user is standing in.
export function contactsForSkill(
  contacts: EscalationContact[],
  skill: string,
  opts?: { makeId?: string | null; modelId?: string | null },
): EscalationContact[] {
  const pool = contacts.filter((c) => c.skill_key === skill && c.active !== false);
  const rank = (c: EscalationContact) => {
    if (c.sensor_model_id) return c.sensor_model_id === opts?.modelId ? 0 : 99; // other models: drop
    if (c.make_id) return c.make_id === opts?.makeId ? 1 : 99; // other makes: drop
    if (!c.plant_id) return 2; // global default
    return 3; // plant-specific
  };
  return pool
    .filter((c) => rank(c) < 99)
    .sort((a, b) => rank(a) - rank(b) || (a.plant_name ?? '').localeCompare(b.plant_name ?? ''));
}
