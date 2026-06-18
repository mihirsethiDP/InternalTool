import { supabase } from './supabase';

// In-session dedupe so the same miss isn't logged repeatedly (search runs
// reactively as the user types; chat re-asks happen too).
const logged = new Set<string>();

/**
 * Record a query that returned no results. Best-effort and silent — never
 * blocks or surfaces errors to the user. Min length guard avoids logging
 * half-typed fragments.
 */
/**
 * Record a generic usage event (best-effort, silent). First use: counting
 * "Search the web" clicks. user_id is stamped server-side by a trigger.
 */
export async function logEvent(opts: { event: string; query?: string; source?: string }) {
  try {
    await supabase.from('usage_events').insert({
      event: opts.event,
      query: opts.query?.trim() || null,
      source: opts.source ?? null,
    });
  } catch (e) {
    console.warn('logEvent failed', e);
  }
}

export async function logUnanswered(opts: { query: string; source: 'search' | 'chat'; sensorModelId?: string | null }) {
  const q = opts.query.trim();
  if (q.length < 3) return;
  const key = `${opts.source}:${q.toLowerCase()}:${opts.sensorModelId ?? ''}`;
  if (logged.has(key)) return;
  logged.add(key);
  try {
    const { error } = await supabase.from('unanswered_queries').insert({
      query: q,
      source: opts.source,
      sensor_model_id: opts.sensorModelId ?? null,
    });
    if (error) { logged.delete(key); console.warn('logUnanswered failed', error.message); }
  } catch (e) {
    logged.delete(key);
    console.warn('logUnanswered failed', e);
  }
}
