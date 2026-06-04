// Ingest local PDFs into Supabase Storage and link them to seeded documents.
//
// One-time use: takes the PDFs you have on disk, uploads them to the
// `documents` storage bucket, updates the matching seeded document row's
// storage_path (so the Open button works + deep-links to the right page),
// and re-chunks the document with per-page text (so search snippets show
// the actual page number).
//
// Usage (Windows PowerShell from project root):
//   $env:Path = 'C:\Program Files\nodejs;' + $env:Path
//   node --env-file=.env.local scripts/ingest-pdfs.mjs "D:\Downloads"
//
// Required env (in .env.local, gitignored):
//   VITE_SUPABASE_URL=https://YOUR.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...    <-- from Supabase → Settings → API
//
// The service-role key bypasses RLS, which is required to upload + update
// docs without an interactive auth session. Keep it secret. Never commit it.

import { createClient } from '@supabase/supabase-js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';

// ----- Configuration -----
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('   Add them to .env.local and run with `node --env-file=.env.local …`');
  process.exit(1);
}

const PDF_DIR = process.argv[2] || 'D:/Downloads';
console.log('Reading PDFs from:', PDF_DIR);

// File-on-disk → seeded document title
const MAP = [
  { file: 'VizSens-ODO Data Sheet.pdf',
    docTitle: 'VizSens-ODO — Technical Data Sheet' },
  { file: 'VizSens-PH(Analog) Data Sheet.pdf',
    docTitle: 'VizSens-pH (Analog) — Technical Data Sheet' },
  { file: 'VizSens-ORP(Analog) Data Sheet.pdf',
    docTitle: 'VizSens-ORP (Analog) — Technical Data Sheet' },
  { file: 'VizSens-EC(Analog)  Data Sheet.pdf',
    docTitle: 'VizSens-EC (Analog) — Technical Data Sheet' },
  { file: 'VizSens-TDS(Analog)  Data Sheet.pdf',
    docTitle: 'VizSens-TDS (Analog) — Technical Data Sheet' },
  { file: '01K3WR11ZQS7R9WD1S4HN2NXJG (1).pdf',
    docTitle: 'UPCS-MAG-110 — Technical Data Sheet' },
  { file: '01K3WSRY3ZCWXB94NT30XCSSSD.pdf',
    docTitle: 'UPC-WA-202 — Technical Data Sheet' },
];

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function chunkPage(text, page, target = 1000) {
  if (!text) return [];
  if (text.length <= target) return [{ page, text }];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + ' ' + s).length > target && cur) { chunks.push({ page, text: cur }); cur = s; }
    else cur = cur ? cur + ' ' + s : s;
  }
  if (cur) chunks.push({ page, text: cur });
  return chunks;
}

let okCount = 0, skipCount = 0, failCount = 0;

for (const m of MAP) {
  const filepath = path.join(PDF_DIR, m.file);
  console.log('\n→', m.docTitle);

  if (!fs.existsSync(filepath)) {
    console.warn('   SKIP — file not found:', filepath);
    skipCount++;
    continue;
  }

  // Find the document row
  const { data: doc, error: docErr } = await sb.from('documents').select('id').eq('title', m.docTitle).maybeSingle();
  if (docErr) {
    console.warn('   FAIL — DB lookup error:', docErr.message);
    failCount++; continue;
  }
  if (!doc) {
    console.warn('   SKIP — no seeded document with that title.');
    skipCount++; continue;
  }

  // Upload to Storage
  const buf = fs.readFileSync(filepath);
  const safeName = m.file.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const storagePath = `${Date.now()}_${safeName}`;
  const up = await sb.storage.from('documents').upload(storagePath, buf, {
    contentType: 'application/pdf', upsert: false,
  });
  if (up.error) {
    console.warn('   FAIL — upload error:', up.error.message);
    failCount++; continue;
  }
  console.log('   uploaded to', storagePath, `(${(buf.length / 1024).toFixed(0)} KB)`);

  // Extract text per page
  const pdf = await getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const text = tc.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
    pages.push({ page: p, text });
  }

  // Update document row
  const upd = await sb.from('documents').update({
    storage_path: storagePath,
    size_bytes: buf.length,
    page_count: pdf.numPages,
  }).eq('id', doc.id);
  if (upd.error) {
    console.warn('   FAIL — update error:', upd.error.message);
    failCount++; continue;
  }

  // Replace chunks with per-page chunks (better page deep-links in search)
  const del = await sb.from('document_chunks').delete().eq('document_id', doc.id);
  if (del.error) {
    console.warn('   warn — chunk delete error:', del.error.message);
  }
  const chunks = pages.flatMap((p) => chunkPage(p.text, p.page));
  for (let i = 0; i < chunks.length; i += 50) {
    const batch = chunks.slice(i, i + 50).map((c) => ({
      document_id: doc.id, page_number: c.page, chunk_text: c.text,
    }));
    const { error } = await sb.from('document_chunks').insert(batch);
    if (error) {
      console.warn('   warn — chunk insert error:', error.message);
      break;
    }
  }
  console.log(`   ✅ ${pdf.numPages} pages, ${chunks.length} chunks indexed`);
  okCount++;
}

console.log(`\nDone. ok=${okCount}  skip=${skipCount}  fail=${failCount}`);
