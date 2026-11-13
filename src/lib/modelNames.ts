import { supabase } from './supabase';

// A model number in the message decides the device outright.
//
// "how to do 2 point calibration on HACH DPC1R1A" went to the water quality
// analyser and "selec em306 me CT ratio kaise set kare" to Flow: the router
// guesses the TYPE from words and only sometimes returns the model it saw.
// And a multi-parameter analyser (Trios LISA UV) is filed under ONE category,
// so a COD-scoped question never saw its manual (agent QA 2026-11-13).
// Matching the catalogue's model numbers first fixes both: the answer is
// scoped to that model, whatever category it is filed under.

export interface ModelRef { id: string; categoryId: string; generalModelId: string | null; label: string; keys: string[] }

let models: ModelRef[] | null = null;
let loading: Promise<ModelRef[]> | null = null;

const norm = (s: string) => ` ${(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
const squash = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Model numbers worth matching: at least 4 characters and either a digit
// ("EM306", "MAG-110", "DPC1R1A") or a distinctive multi-word name ("LISA UV").
export function modelKeys(modelNo: string, name?: string | null): string[] {
  const keys = new Set<string>();
  for (const raw of [modelNo, name ?? '']) {
    const sq = squash(raw);
    if (sq.length >= 4 && /\d/.test(sq) && !/^\d+$/.test(sq)) keys.add(sq);
    // Distinctive names without a number ("Trios LISA - UV" -> "lisauv").
    else if (sq.length >= 6 && !/\d/.test(sq) && norm(raw).trim().split(' ').length >= 2) keys.add(sq);
  }
  // Without the vendor prefix: "UPCS-MAG-110" also matches "MAG-110".
  const parts = norm(modelNo).trim().split(' ');
  if (parts.length >= 2) {
    const tail = squash(parts.slice(1).join(''));
    if (tail.length >= 4 && /\d/.test(tail)) keys.add(tail);
  }
  return [...keys];
}

export async function loadModels(): Promise<ModelRef[]> {
  if (models) return models;
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data } = await supabase.from('sensor_models').select('id, model_no, name, is_general, category_id, sensor_makes(name)').limit(1000);
      const rows = (data ?? []) as any[];
      const general = new Map<string, string>();
      for (const r of rows) if (r.is_general) general.set(r.category_id, r.id);
      models = rows.filter((r) => !r.is_general).map((r) => {
        const mk = Array.isArray(r.sensor_makes) ? r.sensor_makes[0] : r.sensor_makes;
        return { id: r.id, categoryId: r.category_id, generalModelId: general.get(r.category_id) ?? null, label: `${mk?.name ?? ''} ${r.model_no || r.name}`.trim(), keys: modelKeys(r.model_no ?? '', r.name) };
      }).filter((m) => m.keys.length > 0);
    } catch { models = []; }
    return models!;
  })();
  return loading;
}

// The single model the message names, if exactly one matches.
export function namedModel(text: string, list: ModelRef[]): ModelRef | null {
  const sq = squash(text);
  const hits = list.filter((m) => m.keys.some((k) => sq.includes(k)));
  if (hits.length === 1) return hits[0];
  // Prefer the longest key when several match ("UPCS-MAG-110" vs "MAG-110").
  if (hits.length > 1) {
    const best = hits.map((m) => ({ m, k: Math.max(...m.keys.filter((k) => sq.includes(k)).map((k) => k.length)) })).sort((a, b) => b.k - a.k);
    if (best[0].k > best[1].k) return best[0].m;
  }
  return null;
}
