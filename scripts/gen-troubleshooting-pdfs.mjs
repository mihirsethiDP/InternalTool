// Generate branded PDFs for all troubleshooting documents that don't yet
// have a file attached, then upload them to Supabase Storage and link
// each PDF to its document row + re-chunk per page so search snippets
// carry the right page number.
//
// Usage (PowerShell, from project root):
//   $env:Path = 'C:\Program Files\nodejs;' + $env:Path
//   node --env-file=.env.local scripts/gen-troubleshooting-pdfs.mjs
//
// Required env (in .env.local):
//   VITE_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...

import { createClient } from '@supabase/supabase-js';
import { mdToPdf } from 'md-to-pdf';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

// ----- Branded CSS (matches the PRD style) -----
const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
:root { --brand: #193458; --brand-soft: #eef2f7; --text: #1f2937; --muted: #6b7280; --border: #e5e7eb; }
* { box-sizing: border-box; }
body { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 11pt; line-height: 1.55; color: var(--text); margin: 0; }
h1 { color: var(--brand); font-size: 22pt; margin: 0 0 4px; border-bottom: 3px solid var(--brand); padding-bottom: 6px; letter-spacing: -0.01em; }
h2 { color: var(--brand); font-size: 13pt; margin: 22px 0 6px; }
.subtitle { color: var(--muted); font-size: 11pt; margin-bottom: 18px; }
.meta { background: var(--brand-soft); border-left: 3px solid var(--brand); padding: 8px 12px; border-radius: 0 4px 4px 0; font-size: 9.5pt; color: var(--brand); margin-bottom: 20px; }
.issue { margin: 0 0 14px; }
.issue .title { color: var(--brand); font-weight: 600; font-size: 11.5pt; margin-bottom: 4px; }
.issue .body { color: var(--text); }
p { margin: 0 0 8px; }
strong { color: var(--brand); font-weight: 600; }
.note { color: var(--muted); font-size: 9.5pt; margin-top: 24px; border-top: 1px solid var(--border); padding-top: 10px; }
`;

const pdfOptions = {
  format: 'A4',
  margin: { top: '20mm', right: '18mm', bottom: '20mm', left: '18mm' },
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `
    <div style="font-size:8pt;color:#6b7280;width:100%;padding:0 18mm;display:flex;justify-content:space-between;">
      <span>DigitalPaani · Internal Document Hub</span>
      <span>Troubleshooting Steps</span>
    </div>`,
  footerTemplate: `
    <div style="font-size:8pt;color:#6b7280;width:100%;padding:0 18mm;display:flex;justify-content:space-between;">
      <span>Composed from public sources, cross-referenced with vendor datasheet</span>
      <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`,
};

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

// Turn a chunk like "VizSens-ORP Troubleshooting. Issue 1 — Title: body. Issue 2 — ..." into HTML
function toMarkdown(title, makeModel, body) {
  // Strip the leading "X Troubleshooting." preamble if present
  const cleaned = body.replace(/^[^.]*Troubleshooting\.\s*/, '');

  // Split on each "Issue N —" pattern (preserve the delimiter)
  const parts = cleaned.split(/(?=Issue \d+\s+[—-]\s+)/);

  let issueBlocks = [];
  let routineBlock = '';

  for (const raw of parts) {
    const m = raw.match(/^Issue (\d+)\s+[—-]\s+([^:.]+?):\s*([\s\S]*?)\s*(?=$|Issue \d+\s+[—-])/);
    if (m) {
      issueBlocks.push({ n: m[1], title: m[2].trim(), body: m[3].trim() });
    } else {
      // Likely "Routine maintenance: ..." or trailing notes
      if (raw.trim()) routineBlock += raw.trim() + '\n';
    }
  }

  let md = `# ${title}\n\n`;
  md += `<div class="subtitle">${makeModel}</div>\n\n`;
  md += `<div class="meta">Symptoms · Likely causes · Recommended action — for field engineers and the monitoring team.</div>\n\n`;

  for (const i of issueBlocks) {
    md += `<div class="issue"><div class="title">Issue ${i.n} — ${escapeHtml(i.title)}</div><div class="body">${escapeHtml(i.body)}</div></div>\n\n`;
  }
  if (routineBlock) {
    md += `<h2>Routine maintenance &amp; notes</h2>\n\n<p>${escapeHtml(routineBlock)}</p>\n`;
  }
  md += `\n<div class="note">This document is part of the DigitalPaani Internal Document Hub. Content composed from public technical sources and the vendor datasheet. If you find an inaccuracy, edit it in the source migration or open the document via the hub.</div>\n`;
  return md;
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// ----- Main -----
const { data: ttype, error: ttypeErr } = await sb.from('document_types').select('id').eq('key', 'troubleshooting').single();
if (ttypeErr || !ttype) { console.error('Could not find troubleshooting type:', ttypeErr); process.exit(1); }

const { data: docs, error: docsErr } = await sb
  .from('documents')
  .select('id, title, sensor_models(model_no, sensor_makes(name))')
  .eq('type_id', ttype.id)
  .is('storage_path', null);

if (docsErr) { console.error(docsErr); process.exit(1); }
console.log(`Found ${docs.length} troubleshooting docs needing PDFs.\n`);

let ok = 0, fail = 0;
for (const d of docs) {
  console.log('→', d.title);
  try {
    const { data: chunks } = await sb.from('document_chunks')
      .select('chunk_text').eq('document_id', d.id).order('page_number', { ascending: true });
    if (!chunks || chunks.length === 0) {
      console.warn('   no chunks, skipping');
      continue;
    }
    const body = chunks.map((c) => c.chunk_text).join(' ');
    const makeModel = `${d.sensor_models?.sensor_makes?.name ?? ''} ${d.sensor_models?.model_no ?? ''}`.trim();
    const md = toMarkdown(d.title, makeModel, body);

    const outPath = path.join(os.tmpdir(), `dp_${d.id}.pdf`);
    const pdf = await mdToPdf({ content: md }, { dest: outPath, css, pdf_options: pdfOptions, launch_options: { args: ['--no-sandbox'] } });
    if (!pdf) throw new Error('mdToPdf returned undefined');

    const buf = await fs.readFile(outPath);
    const safeName = (d.title || 'troubleshooting').replace(/[^a-zA-Z0-9._-]+/g, '_') + '.pdf';
    const storagePath = `${Date.now()}_${safeName}`;

    const up = await sb.storage.from('documents').upload(storagePath, buf, { contentType: 'application/pdf', upsert: false });
    if (up.error) throw new Error('upload: ' + up.error.message);

    // Extract per-page text for proper search page numbers
    const pdfDoc = await getDocument({ data: new Uint8Array(buf) }).promise;
    const pages = [];
    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const tc = await page.getTextContent();
      const text = tc.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
      pages.push({ page: p, text });
    }

    await sb.from('documents').update({
      storage_path: storagePath,
      size_bytes: buf.length,
      page_count: pdfDoc.numPages,
    }).eq('id', d.id);

    // Replace chunks with per-page chunks
    await sb.from('document_chunks').delete().eq('document_id', d.id);
    const newChunks = pages.flatMap((p) => chunkPage(p.text, p.page));
    for (let i = 0; i < newChunks.length; i += 50) {
      const batch = newChunks.slice(i, i + 50).map((c) => ({ document_id: d.id, page_number: c.page, chunk_text: c.text }));
      const { error } = await sb.from('document_chunks').insert(batch);
      if (error) console.warn('   chunk insert error:', error.message);
    }

    console.log(`   ✅ ${pdfDoc.numPages} pages, ${newChunks.length} chunks`);
    ok++;
  } catch (e) {
    console.error('   ❌', e.message);
    fail++;
  }
}

console.log(`\nDone. ok=${ok}  fail=${fail}`);
