// Read-only logical backup of ALL table data to a local JSON file.
// Schema/functions/RLS live in supabase/migrations, so this data dump + the
// migrations = a full restore path (re-run migrations, re-insert this JSON).
//
// Usage (project root):
//   node --env-file=.env.local scripts/backup-data.mjs
//
// Writes ./data-backup-<timestamp>.json (git-ignored). Keep it somewhere safe —
// it contains all app data.

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const TABLES = [
  'profiles', 'sensor_categories', 'sensor_makes', 'sensor_models',
  'document_types', 'search_synonyms',
  'consolidated_docs', 'consolidated_doc_chunks', 'consolidated_doc_revisions',
  'document_submissions', 'documents', 'document_chunks',
  'routing_rules', 'answer_feedback', 'unanswered_queries', 'support_tickets',
  'usage_events', 'notifications',
  'plants', 'plant_sensors', 'plant_plcs', 'equipment',
];

const dump = {};
let total = 0;
for (const t of TABLES) {
  const rows = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await sb.from(t).select('*').range(from, from + page - 1);
    if (error) { console.warn(`  ${t}: skipped (${error.message})`); break; }
    rows.push(...(data ?? []));
    if (!data || data.length < page) break;
    from += page;
  }
  dump[t] = rows;
  total += rows.length;
  console.log(`  ${t.padEnd(28)} ${rows.length}`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = `data-backup-${stamp}.json`;
writeFileSync(file, JSON.stringify({ exported_at: new Date().toISOString(), tables: dump }, null, 2));
console.log(`\n✅ ${total} rows across ${TABLES.length} tables → ${file}`);
