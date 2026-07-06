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
}

export interface FlowDefinition {
  start: string;
  nodes: FlowNode[];
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
}

export interface EscalationContact {
  id: string;
  skill_key: string;
  label: string;
  person_name: string | null;
  contact: string | null;
  notes: string | null;
  active: boolean;
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
    .select('*')
    .eq('active', true)
    .order('sort_order');
  return (data ?? []) as EscalationContact[];
}
