import { supabase } from './supabase';
import { queryTokens } from './routing';

// The words that name a DEVICE rather than a SYMPTOM.
//
// "UPS is overheating" once matched the flow "UPS is completely dead" — the
// only shared word was "ups". Symptom matchers (flows, issues) now score on
// what is left after the device words are removed, so a match needs at
// least one symptom word in common. The same catalogue answers "which
// device did they name?" when the router's guess disagrees with the text
// ("my tds sensor …" routed to the analyser because TDS has no documents).

export interface CategoryRef { id: string; name: string; aliases: string[] }

const GENERIC = ['sensor', 'sensors', 'probe', 'meter', 'device', 'instrument', 'transmitter', 'equipment', 'machine', 'unit', 'analyser', 'analyzer', 'system', 'controller',
  // negation / filler: "no", "but", "still" must never be the word a match
  // hangs on ("blinking but overheating" once matched "no output" on "no")
  'no', 'not', 'but', 'still', 'also', 'now', 'again', 'very', 'please', 'hai', 'ho', 'it', 'its', 'my', 'mera', 'meri', 'yes', 'ok', 'hmm', 'there', 'here', 'just', 'only', 'and', 'or'];

let cats: CategoryRef[] | null = null;
let loading: Promise<CategoryRef[]> | null = null;

export async function loadCategories(): Promise<CategoryRef[]> {
  if (cats) return cats;
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data } = await supabase.from('sensor_categories').select('id, name, aliases').limit(500);
      cats = ((data ?? []) as any[]).map((c) => ({ id: c.id, name: String(c.name), aliases: Array.isArray(c.aliases) ? c.aliases.map(String) : [] }));
    } catch {
      cats = [];
    }
    return cats;
  })();
  return loading;
}

export function deviceWordsFrom(list: CategoryRef[]): Set<string> {
  const s = new Set<string>(GENERIC);
  for (const c of list) {
    for (const w of queryTokens(c.name)) s.add(w);
    for (const a of c.aliases) for (const w of queryTokens(a)) s.add(w);
  }
  return s;
}

export async function loadDeviceWords(): Promise<Set<string>> {
  return deviceWordsFrom(await loadCategories());
}

// The category the message names outright — its name or an alias as a whole
// word ("tds", "ups", "ph probe", "magmeter"). A name beats an alias; a longer
// match beats a shorter one ("total dissolved solids" over "tds").
export function namedCategory(text: string, list: CategoryRef[]): CategoryRef | null {
  const q = ` ${(text ?? '').toLowerCase().replace(/[^a-z0-9ऀ-෿]+/g, ' ')} `;
  let best: { c: CategoryRef; len: number; isName: boolean } | null = null;
  for (const c of list) {
    const terms = [{ t: c.name, isName: true }, ...c.aliases.map((a) => ({ t: a, isName: false }))];
    for (const { t, isName } of terms) {
      const n = t.toLowerCase().replace(/[^a-z0-9ऀ-෿]+/g, ' ').trim();
      if (n.length < 2 || !q.includes(` ${n} `)) continue;
      // Two-letter aliases ("BS", "WA") only count when written in capitals.
      if (n.length <= 2 && !new RegExp(`\\b${t.toUpperCase()}\\b`).test(text)) continue;
      const cand = { c, len: n.length, isName };
      if (!best || (cand.isName && !best.isName) || (cand.isName === best.isName && cand.len > best.len)) best = cand;
    }
  }
  return best?.c ?? null;
}
