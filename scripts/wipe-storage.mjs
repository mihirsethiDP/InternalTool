// One-shot cleanup: removes every object from the `documents` bucket
// via the Supabase Storage API. Run AFTER (or instead of) migration 012.
//
// Usage (PowerShell, project root):
//   $env:Path = 'C:\Program Files\nodejs;' + $env:Path
//   node --env-file=.env.local scripts/wipe-storage.mjs
//
// Required env (.env.local):
//   VITE_SUPABASE_URL=https://YOUR.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const bucket = 'documents';

const { data: objects, error } = await sb.storage.from(bucket).list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
if (error) { console.error('list failed:', error); process.exit(1); }
if (!objects?.length) { console.log('Bucket is already empty.'); process.exit(0); }

const names = objects.map((o) => o.name);
console.log(`Deleting ${names.length} object(s) from "${bucket}"…`);

// remove() takes an array of full paths
const { error: rmErr } = await sb.storage.from(bucket).remove(names);
if (rmErr) { console.error('remove failed:', rmErr); process.exit(1); }

console.log('✅ Done.');
