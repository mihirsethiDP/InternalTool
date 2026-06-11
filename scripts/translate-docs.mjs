// Translate all consolidated docs into the supported Indian languages and
// cache the results in consolidated_doc_translations. Skips translations
// that are already up to date with the source document.
//
// Usage (PowerShell, project root):
//   $env:Path = 'C:\Program Files\nodejs;' + $env:Path
//   node --env-file=.env.local scripts/translate-docs.mjs
//
// Required env (.env.local):
//   VITE_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...
//   GOOGLE_TRANSLATE_API_KEY=...   <- Google Cloud Translation API key
//
// Cost: Google Translation v2 is $20 per million characters. The whole
// current corpus translated to 7 languages is well under one dollar.
// Re-runs only translate docs whose source changed (cache check).

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const gkey = process.env.GOOGLE_TRANSLATE_API_KEY;
if (!url || !key) { console.error('Missing Supabase env.'); process.exit(1); }
if (!gkey) {
  console.error('Missing GOOGLE_TRANSLATE_API_KEY in .env.local.');
  console.error('Create one: https://console.cloud.google.com -> APIs & Services -> Credentials');
  console.error('Enable: Cloud Translation API');
  process.exit(1);
}

const LANGS = ['hi', 'bn', 'mr', 'te', 'ta', 'gu', 'kn'];
const sb = createClient(url, key, { auth: { persistSession: false } });

// Lines that must NOT be translated (structure markers)
function isStructural(line) {
  return /^##\s+(manual|install|troubleshooting|datasheet|calibration|cleaning|spares|ppm|wiring|safety|other)\s*$/i.test(line)
    || /^---+\s*$/.test(line)
    || /^\s*$/.test(line);
}

async function translateBatch(texts, target) {
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${gkey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, source: 'en', target, format: 'text' }),
  });
  if (!res.ok) throw new Error(`Translate API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.translations.map((t) => t.translatedText);
}

async function translateMarkdown(md, target) {
  const lines = md.split('\n');
  const translatable = [];
  const positions = [];
  lines.forEach((line, i) => {
    if (!isStructural(line)) { translatable.push(line); positions.push(i); }
  });
  // Batch in groups of 100 segments (API limit 128)
  const out = [...lines];
  for (let i = 0; i < translatable.length; i += 100) {
    const batch = translatable.slice(i, i + 100);
    const translated = await translateBatch(batch, target);
    translated.forEach((t, j) => { out[positions[i + j]] = t; });
  }
  return out.join('\n');
}

const { data: docs, error } = await sb
  .from('consolidated_docs')
  .select('id, content_markdown, last_updated_at, sensor_models(model_no, sensor_makes(name))');
if (error) { console.error(error); process.exit(1); }

let done = 0, skipped = 0, failed = 0;
for (const doc of docs ?? []) {
  const label = `${doc.sensor_models?.sensor_makes?.name ?? ''} ${doc.sensor_models?.model_no ?? ''}`.trim();
  if (!doc.content_markdown?.trim()) { console.log(`- ${label}: empty, skip`); continue; }

  for (const lang of LANGS) {
    // Skip if cached translation is current
    const { data: existing } = await sb
      .from('consolidated_doc_translations')
      .select('id, source_updated_at')
      .eq('consolidated_doc_id', doc.id)
      .eq('lang', lang)
      .maybeSingle();
    if (existing && existing.source_updated_at === doc.last_updated_at) {
      skipped++;
      continue;
    }
    try {
      process.stdout.write(`* ${label} -> ${lang} ... `);
      const translated = await translateMarkdown(doc.content_markdown, lang);
      const { error: upErr } = await sb.from('consolidated_doc_translations').upsert({
        consolidated_doc_id: doc.id,
        lang,
        content_markdown: translated,
        source_updated_at: doc.last_updated_at,
        translated_at: new Date().toISOString(),
      }, { onConflict: 'consolidated_doc_id,lang' });
      if (upErr) throw upErr;
      console.log('ok');
      done++;
    } catch (e) {
      console.log('FAIL:', e.message);
      failed++;
    }
  }
}
console.log(`\nDone. translated=${done} cached=${skipped} failed=${failed}`);
