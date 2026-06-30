import { supabase } from './supabase';
import type { SubmissionSection } from './types';

// Match a user's problem statement to an APPROVED routing rule for the sensor(s)
// in scope, then point at the exact procedure section(s). Client-side token
// overlap — robust enough for short symptom phrasings, no extra LLM call.

export interface RoutingRule {
  id: string;
  sensor_model_id: string;
  problem: string;
  aliases: string[];
  sections: SubmissionSection[];
  clarifying_question: string | null;
}
export interface RouteMatch {
  rule: RoutingRule;
  docId: string | null; // consolidated_docs.id to deep-link into
}

// Keep short domain terms (pH, EC, DO) and discriminating words like "reading"
// / "sensor" — only drop generic filler.
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'on', 'in', 'of', 'to', 'for', 'and', 'or', 'my', 'it', 'this', 'that', 'with', 'how', 'do', 'why', 'what', 'when', 'shows', 'showing', 'from', 'keeps', 'around']);
export function queryTokens(s: string): string[] {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 2 && !STOP.has(w));
}
// Overlap coefficient: shared tokens / size of the smaller token set. Symmetric,
// so a verbose query and a short rule phrase aren't unfairly penalised.
export function matchScore(qt: string[], phrase: string): number {
  if (qt.length === 0) return 0;
  const pt = new Set(queryTokens(phrase));
  if (pt.size === 0) return 0;
  let hit = 0;
  for (const w of new Set(qt)) if (pt.has(w)) hit++;
  return hit / Math.min(new Set(qt).size, pt.size);
}

const THRESHOLD = 0.34;

export async function matchRule(query: string, modelIds: string[]): Promise<RouteMatch | null> {
  try {
  const ids = [...new Set(modelIds.filter(Boolean))];
  if (ids.length === 0) return null;
  const { data } = await supabase
    .from('routing_rules')
    .select('id, sensor_model_id, problem, aliases, sections, clarifying_question')
    .in('sensor_model_id', ids)
    .eq('status', 'approved');
  const rules = (data ?? []) as RoutingRule[];
  if (rules.length === 0) return null;

  const qt = queryTokens(query);
  let best: RoutingRule | null = null;
  let bestScore = 0;
  for (const r of rules) {
    const s = Math.max(matchScore(qt, r.problem), ...(r.aliases ?? []).map((a) => matchScore(qt, a)), 0);
    if (s > bestScore) { bestScore = s; best = r; }
  }
  if (!best || bestScore < THRESHOLD) return null;

  const { data: cd } = await supabase.from('consolidated_docs').select('id').eq('sensor_model_id', best.sensor_model_id).maybeSingle();
  return { rule: best, docId: (cd as any)?.id ?? null };
  } catch (e) {
    console.warn('matchRule failed', e);
    return null;
  }
}
