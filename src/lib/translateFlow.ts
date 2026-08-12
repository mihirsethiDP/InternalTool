import { supabase } from './supabase';
import type { DiagnosticFlow, FlowDefinition } from './flows';

// Diagnostic flow steps are stored in English (extracted from English
// manuals). When the app language isn't English, translate the WHOLE flow
// once when it starts and cache the result on the device — so a Hindi
// speaker reads (and hears, via TTS) Hindi steps, at a once-per-flow cost.
//
// Failure of any kind returns the original definition: a missed translation
// must never block a diagnosis.

// Collect every user-visible string of a definition in a stable order:
// each node's text, then each of its option labels.
export function collectFlowStrings(def: FlowDefinition): string[] {
  const out: string[] = [];
  for (const n of def.nodes) {
    out.push(n.text ?? '');
    for (const o of n.options ?? []) out.push(o.label ?? '');
  }
  return out;
}

// Rebuild a definition with translated strings (same order as collect).
// Returns null if the count doesn't line up — caller keeps the original.
export function applyFlowStrings(def: FlowDefinition, items: string[]): FlowDefinition | null {
  let i = 0;
  const nodes = def.nodes.map((n) => {
    const text = items[i++];
    const options = (n.options ?? []).map((o) => ({ ...o, label: items[i++] ?? o.label }));
    if (text == null) return null;
    return { ...n, text, ...(n.options ? { options } : {}) };
  });
  if (nodes.some((n) => n == null) || i !== items.length) return null;
  return { ...def, nodes: nodes as FlowDefinition['nodes'] };
}

const cacheKey = (flow: DiagnosticFlow, lang: string) =>
  `dp-flow-t1:${flow.id}:${lang}:${(flow as { updated_at?: string }).updated_at ?? ''}`;

export async function translateFlowDefinition(flow: DiagnosticFlow, lang: string): Promise<FlowDefinition> {
  if (!lang || lang.startsWith('en')) return flow.definition;
  const key = cacheKey(flow, lang);
  try {
    const hit = localStorage.getItem(key);
    if (hit) return JSON.parse(hit) as FlowDefinition;
  } catch { /* cache is best-effort */ }
  try {
    const items = collectFlowStrings(flow.definition);
    const { data, error } = await supabase.functions.invoke('chat-answer', {
      body: { mode: 'translate', items, lang },
    });
    const translated: unknown = (data as { items?: unknown })?.items;
    if (error || !Array.isArray(translated) || translated.length !== items.length) return flow.definition;
    // The edge fn echoes originals when it can't translate — don't cache that,
    // so the next run retries.
    if (translated.every((t, idx) => t === items[idx])) return flow.definition;
    const def = applyFlowStrings(flow.definition, translated as string[]);
    if (!def) return flow.definition;
    try { localStorage.setItem(key, JSON.stringify(def)); } catch { /* storage full — fine */ }
    return def;
  } catch {
    return flow.definition;
  }
}
