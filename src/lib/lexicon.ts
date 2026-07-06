import { supabase } from './supabase';

// Spell-tolerant input normalization for Dr. Paani.
//
// Field users misspell domain words ("presure", "senser", "calibrat") and the
// client-side matchers (flow triggers, routing rules) do exact token overlap —
// so before matching, correct each unknown token to the nearest word in a
// domain lexicon built from live data (categories, makes, models, synonyms)
// plus a curated core vocabulary. DB-side FTS already has a trigram fallback
// (migration 016); this fixes the client-side layer.

const CORE_WORDS = [
  // domain nouns/verbs that appear in flows, rules and docs
  'sensor', 'probe', 'transmitter', 'display', 'screen', 'reading', 'signal',
  'pressure', 'level', 'flow', 'temperature', 'turbidity', 'chlorine', 'oxygen',
  'dissolved', 'conductivity', 'analyser', 'analyzer', 'ultrasonic', 'magnetic',
  'calibrate', 'calibration', 'clean', 'cleaning', 'install', 'installation',
  'replace', 'replacement', 'repair', 'troubleshoot', 'maintenance', 'inspect',
  'error', 'fault', 'alarm', 'blank', 'zero', 'drift', 'drifting', 'fluctuating',
  'unstable', 'stuck', 'frozen', 'leaking', 'cable', 'wiring', 'power', 'supply',
  'voltage', 'output', 'working', 'showing', 'wrong', 'broken', 'problem',
];

let lexicon: Set<string> | null = null;
let loading: Promise<Set<string>> | null = null;

function wordsFrom(s: string | null | undefined): string[] {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
}

// Build once per session from live data; cheap queries, all cached tables.
export async function loadLexicon(): Promise<Set<string>> {
  if (lexicon) return lexicon;
  if (loading) return loading;
  loading = (async () => {
    const lex = new Set<string>(CORE_WORDS);
    try {
      const [cats, makes, models, syns] = await Promise.all([
        supabase.from('sensor_categories').select('name'),
        supabase.from('sensor_makes').select('name'),
        supabase.from('sensor_models').select('model_no, name'),
        supabase.from('search_synonyms').select('terms'),
      ]);
      for (const r of (cats.data ?? []) as any[]) wordsFrom(r.name).forEach((w) => lex.add(w));
      for (const r of (makes.data ?? []) as any[]) wordsFrom(r.name).forEach((w) => lex.add(w));
      for (const r of (models.data ?? []) as any[]) { wordsFrom(r.model_no).forEach((w) => lex.add(w)); wordsFrom(r.name).forEach((w) => lex.add(w)); }
      for (const r of (syns.data ?? []) as any[]) for (const t of (r.terms ?? [])) wordsFrom(t).forEach((w) => lex.add(w));
    } catch (e) {
      console.warn('lexicon load failed (using core words only)', e);
    }
    lexicon = lex;
    return lex;
  })();
  return loading;
}

// Bounded Levenshtein — bails out early once distance exceeds max.
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

// Correct one token against the lexicon. Known/short/numeric tokens pass through.
export function correctToken(token: string, lex: Set<string>): string {
  const t = token.toLowerCase();
  if (t.length < 4 || /\d/.test(t) || lex.has(t)) return token;
  // distance budget scales with length: 1 for short words, 2 for 7+
  const budget = t.length >= 7 ? 2 : 1;
  let best: string | null = null;
  let bestDist = budget + 1;
  for (const w of lex) {
    if (Math.abs(w.length - t.length) > budget) continue;
    const d = editDistance(t, w, budget);
    if (d < bestDist) { bestDist = d; best = w; if (d === 1 && t.length < 7) break; }
  }
  return best ?? token;
}

// Correct a whole query. Returns the corrected string plus whether anything changed.
export async function correctSpelling(query: string): Promise<{ text: string; changed: boolean }> {
  const lex = await loadLexicon();
  const parts = query.split(/(\s+)/); // keep whitespace so the message stays readable
  let changed = false;
  const out = parts.map((p) => {
    if (/^\s+$/.test(p) || !p) return p;
    const clean = p.replace(/[^a-zA-Z0-9]/g, '');
    if (!clean) return p;
    const fixed = correctToken(clean, lex);
    if (fixed.toLowerCase() !== clean.toLowerCase()) { changed = true; return p.replace(clean, fixed); }
    return p;
  }).join('');
  return { text: out, changed };
}
