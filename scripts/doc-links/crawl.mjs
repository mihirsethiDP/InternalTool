// Backfills sensor documentation from vendor links.
//
// For every (make, model, kind, url) in links.json:
//   1. resolve the catalogue model (register spellings map onto catalogue ones),
//   2. fetch the URL — a PDF is stored; a web page has its text kept and its
//      datasheet/manual/catalogue PDFs followed one level down,
//   3. extract the text, file it as an APPROVED source document (Documents
//      tab, same shape the review queue produces),
//   4. route its paragraphs into the reference sections with the same
//      prompt the edge function's "split-sections" uses (Groq, JSON mode),
//   5. append the parts into the model's consolidated reference with a
//      provenance line, and rebuild that model's search index.
//
// Idempotent: a URL already recorded as a submission's vendor_url is skipped,
// so re-running after adding links to links.json only does the new ones.
// Vendor sites that block scripts are recorded as link-only documents.
//
// Usage:
//   node scripts/doc-links/crawl.mjs                          # dry run: resolve + plan
//   node scripts/doc-links/crawl.mjs --apply                  # do it
//   node scripts/doc-links/crawl.mjs --apply --only "Danfoss" # one make/model (substring)
//   node scripts/doc-links/crawl.mjs --apply --limit 10
//
// Needs .env.local: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { canonicalMake, canonicalModel, norm } from '../plant-register/rules.mjs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const ONLY = (flag('--only') ?? '').toLowerCase();
const LIMIT = Number(flag('--limit') ?? 0) || Infinity;
const LINKS = flag('--links') ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'links.json');
const APPROVER_EMAIL = 'mihir.sethi@digitalpaani.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 DigitalPaani-DocBot/1.0';
const MAX_BYTES = 30 * 1024 * 1024;
const MAX_PAGES = 150;
const KIND_SECTION = { datasheet: 'tds', catalog: 'tds', manual: 'install_commission' };

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const GROQ = env.GROQ_API_KEY;
const die = (m) => { console.error('\n✗ ' + m); process.exit(1); };
const must = async (p, what) => { const { data, error } = await p; if (error) die(`${what}: ${error.message}`); return data; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- reference data ----------
const [types, makes, models, approver, existingSubs] = await Promise.all([
  must(sb.from('document_types').select('id, key, label, hint, sort_order').eq('scope', 'general').order('sort_order'), 'types'),
  must(sb.from('sensor_makes').select('id, name'), 'makes'),
  must(sb.from('sensor_models').select('id, make_id, category_id, model_no, name, is_general'), 'models'),
  must(sb.from('profiles').select('id').eq('email', APPROVER_EMAIL).single(), 'approver'),
  must(sb.from('document_submissions').select('vendor_url, title').is('deleted_at', null), 'submissions'),
]);
const ORDER = types.map((t) => t.key);
const typeId = (k) => types.find((t) => t.key === k)?.id ?? null;
const doneUrls = new Set(existingSubs.map((s) => (s.vendor_url ?? '').trim()).filter(Boolean));
const makeByNorm = new Map(makes.map((m) => [norm(m.name), m]));
function resolveModel(make, model) {
  const mk = makeByNorm.get(norm(canonicalMake(make)));
  if (!mk) return null;
  const mo = norm(canonicalModel(make, model));
  return models.find((m) => m.make_id === mk.id && !m.is_general && norm(m.model_no) === mo) ?? null;
}

// ---------- plan ----------
const links = JSON.parse(fs.readFileSync(LINKS, 'utf8'));
const plan = [];
const unresolved = new Set();
for (const l of links) {
  const label = `${l.make} ${l.model}`;
  if (ONLY && !label.toLowerCase().includes(ONLY)) continue;
  const m = resolveModel(l.make, l.model);
  if (!m) { unresolved.add(label); continue; }
  plan.push({ ...l, model_id: m.id, model_no: m.model_no, label: `${makes.find((x) => x.id === m.make_id)?.name} ${m.model_no}`, done: doneUrls.has(l.url.trim()) });
}
const todo = plan.filter((p) => !p.done).slice(0, LIMIT);
console.log(`Links: ${links.length} · resolved: ${plan.length} · already imported: ${plan.filter((p) => p.done).length} · to fetch: ${todo.length}`);
if (unresolved.size) console.log(`Unresolved make/model (add aliases or the model): ${[...unresolved].join(' | ')}`);
if (!APPLY) { for (const p of todo) console.log(`  ${p.label}  [${p.kind}]  ${p.url}`); console.log('\nDry run — nothing fetched. Re-run with --apply.'); process.exit(0); }
if (!GROQ) die('GROQ_API_KEY missing in .env.local — needed to route paragraphs into sections');

// ---------- fetching ----------
async function fetchUrl(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45_000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/pdf,text/html;q=0.9,*/*;q=0.8', 'Referer': new URL(url).origin + '/' }, redirect: 'follow', signal: ctl.signal });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) return { error: `too large (${len} bytes)` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return { error: 'too large' };
    const ctype = (res.headers.get('content-type') ?? '').toLowerCase();
    const isPdf = buf.subarray(0, 5).toString() === '%PDF-' || ctype.includes('application/pdf');
    return { buf, isPdf, ctype, finalUrl: res.url || url };
  } catch (e) { return { error: e.name === 'AbortError' ? 'timeout' : (e.message || String(e)) }; }
  finally { clearTimeout(t); }
}

async function pdfText(buf) {
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, disableFontFace: true }).promise;
  const pages = [];
  for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let last = null, line = [], lines = [];
    for (const it of tc.items) {
      const y = Math.round(it.transform?.[5] ?? 0);
      if (last !== null && Math.abs(y - last) > 3) { lines.push(line.join(' ')); line = []; }
      line.push(it.str); last = y;
    }
    lines.push(line.join(' '));
    pages.push(lines.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim());
  }
  return { text: pages.map((t, i) => `[Page ${i + 1}]\n${t}`).join('\n\n'), pageCount: doc.numPages };
}

function htmlToText(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  t = t.replace(/<(br|p|div|li|tr|h[1-6]|section|article|table|ul|ol)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ');
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  // Navigation, footers and cookie banners are hundreds of short lines; the
  // readable content is the long ones. Keep lines with substance (or numbers
  // with units — spec tables), and cap the result so a marketing site cannot
  // bury the reference.
  const lines = t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const kept = lines.filter((l) => l.length >= 40 || /\d\s?(mA|V|bar|mm|°C|%|m\/s|mg\/L|NTU|pH|kg|Hz|W|kW|MLD|KLD|inch)\b/i.test(l));
  return { title, text: kept.join('\n').replace(/\n{3,}/g, '\n\n').slice(0, 40_000) };
}
function pdfLinksIn(html, base) {
  const out = new Set();
  const re = /href\s*=\s*["']([^"']+)["']/gi; let m;
  while ((m = re.exec(html))) {
    let href = m[1].trim(); if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
    let abs; try { abs = new URL(href, base).href; } catch { continue; }
    const looksPdf = /\.pdf(\?|#|$)/i.test(abs) || /datasheet|data-sheet|manual|catalog|catalogue|brochure|download/i.test(abs);
    if (!looksPdf) continue;
    if (/\.(jpg|jpeg|png|gif|svg|zip|exe|mp4)(\?|$)/i.test(abs)) continue;
    out.add(abs);
  }
  return [...out].slice(0, 4);
}

// ---------- routing paragraphs into sections (mirrors the edge function) ----------
function toParagraphs(text, budget = 30_000) {
  const clean = text.replace(/\[Page \d+\]\n?/g, '');
  let raw = clean.includes('\n\n') ? clean.split(/\n\s*\n/) : [];
  if (raw.length < 4) { // no blank lines: glue lines into ~600-char blocks
    raw = []; let cur = '';
    for (const l of clean.split('\n')) { if ((cur + '\n' + l).length > 600 && cur) { raw.push(cur); cur = l; } else cur = cur ? cur + '\n' + l : l; }
    if (cur) raw.push(cur);
  }
  const paras = []; let carry = '';
  for (const p0 of raw.map((p) => p.trim()).filter(Boolean)) {
    if (p0.length < 60) { carry = carry ? carry + '\n\n' + p0 : p0; continue; }
    paras.push(carry ? carry + '\n\n' + p0 : p0); carry = '';
  }
  if (carry) { if (paras.length) paras[paras.length - 1] += '\n\n' + carry; else paras.push(carry); }
  let used = 0, cut = paras.length;
  for (let i = 0; i < paras.length; i++) { used += paras[i].length; if (used > budget) { cut = i; break; } }
  return paras.slice(0, cut);
}
const HINTS = { install_commission: 'mounting, wiring, first start-up, commissioning', configure: 'settings, parameters, menus, communication setup', inspect: 'visual checks, routine inspection', clean: 'cleaning the sensor/probe', calibrate: 'calibration, zero/span, buffers, verification', replace: 'replacing the sensor or its parts/consumables', troubleshoot_repair: 'faults, error codes, symptoms and fixes, repair', maintenance_planning: 'maintenance schedules, intervals, planning', tds: 'specifications, measuring range, accuracy, outputs, ratings, dimensions, ordering codes', other: 'anything that genuinely fits no other section' };
const SECTION_DEFS = types.map((r) => `${r.key} — ${r.label}: ${r.hint || HINTS[r.key] || r.label}`);
async function groqJson(system, user) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ}` },
        body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, max_tokens: 1200, response_format: { type: 'json_object' } }) });
      if (res.status === 429) { await sleep(4000 * (attempt + 1)); continue; }
      if (!res.ok) { console.log(`    groq ${res.status}: ${(await res.text()).slice(0, 160)}`); return null; }
      const body = await res.json(); const raw = body?.choices?.[0]?.message?.content ?? '';
      const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null;
    } catch (e) { await sleep(2000); }
  }
  return null;
}
async function splitIntoSections(title, text, budget = 30_000) {
  const paras = toParagraphs(text, budget);
  if (paras.join('').length < 300) return [];
  const sys = ['You ROUTE paragraphs of a sensor document to activity sections. You never rewrite content.', 'Assign CONTIGUOUS paragraph ranges to exactly one section each. Ranges must not overlap.', 'Skip paragraphs that are pure noise (page headers, tables of contents, legal boilerplate, navigation menus, cookie notices, marketing slogans) by not assigning them.', 'Match content to the section whose description fits it best. Use "other" ONLY when no other section applies — a section named for the content (specifications, datasheet) beats "other" every time.', 'Respond with strict JSON only.'].join('\n');
  const user = [`Document title: ${title}`, `Sections (use ONLY these keys): ${SECTION_DEFS.join('; ')}`, '', 'Paragraphs (indexed):', paras.map((p, i) => `[${i}] ${p.slice(0, 700)}`).join('\n'), '', 'Return strict JSON: {"assignments":[{"section":"<key>","from":<first paragraph index>,"to":<last paragraph index>}]}'].join('\n');
  const parsed = await groqJson(sys, user);
  // Too big for the provider's per-request limit → try again on the first third.
  if (!parsed && budget > 12_000) return splitIntoSections(title, text, 12_000);
  const seen = new Set(); const by = new Map();
  for (const a of (Array.isArray(parsed?.assignments) ? parsed.assignments : [])) {
    if (!ORDER.includes(a?.section)) continue;
    const from = Math.max(0, Math.floor(a.from ?? -1)), to = Math.min(paras.length - 1, Math.floor(a.to ?? -1));
    if (from > to) continue;
    const chunk = []; for (let i = from; i <= to; i++) if (!seen.has(i)) { seen.add(i); chunk.push(paras[i]); }
    if (chunk.length) (by.get(a.section) ?? by.set(a.section, []).get(a.section)).push(chunk.join('\n\n'));
  }
  return [...by.entries()].map(([section, chunks]) => ({ section, content: chunks.join('\n\n') })).filter((p) => p.content.length >= 200);
}

// ---------- consolidated reference helpers (same effect as src/lib/consolidated.ts) ----------
function parseSections(md) {
  const out = Object.fromEntries(ORDER.map((k) => [k, ''])); if (!md) return out;
  let cur = null; const buf = {};
  for (const line of md.split('\n')) { const m = line.match(/^##\s+([a-z0-9_]+)\s*$/i); if (m) { cur = m[1].toLowerCase(); buf[cur] ??= []; continue; } if (cur) (buf[cur] ??= []).push(line); }
  for (const [k, v] of Object.entries(buf)) out[k] = v.join('\n').trim();
  return out;
}
function renderSections(s) { const extras = Object.keys(s).filter((k) => !ORDER.includes(k)); return [...ORDER, ...extras].map((k) => `## ${k}\n\n${s[k] || ''}\n`).join('\n').trim() + '\n'; }
function appendSection(md, section, addition, note) { const s = parseSections(md); const block = `_${note}_\n\n${addition.trim()}`; s[section] = s[section] ? `${s[section]}\n\n---\n\n${block}` : block; return renderSections(s); }
function chunkSections(s, target = 1000) {
  const out = [];
  for (const k of [...ORDER, ...Object.keys(s).filter((x) => !ORDER.includes(x))]) {
    const body = (s[k] || '').trim(); if (!body) continue;
    if (body.length <= target) { out.push({ section: k, text: body }); continue; }
    let cur = ''; for (const sent of body.split(/(?<=[.!?])\s+/)) { if ((cur + ' ' + sent).length > target && cur) { out.push({ section: k, text: cur }); cur = sent; } else cur = cur ? cur + ' ' + sent : sent; }
    if (cur) out.push({ section: k, text: cur });
  }
  return out;
}

// ---------- record one document ----------
const now = () => new Date().toISOString();
const merged = new Map(); // model_id -> [{ section, content, note }]
const stats = { pdf: 0, page: 0, linkOnly: 0, failed: 0, parts: 0, followed: 0 };
async function recordDocument({ modelId, label, kind, url, title, buf, isPdf, text, pageCount, note }) {
  let storage_path = null, size_bytes = null;
  if (buf && isPdf) {
    const safe = (title || url.split('/').pop() || 'document').replace(/[^\w.-]+/g, '_').slice(0, 80).replace(/\.pdf$/i, '');
    storage_path = `${Date.now()}_${safe}.pdf`;
    const up = await sb.storage.from('documents').upload(storage_path, buf, { contentType: 'application/pdf', upsert: false });
    if (up.error) { console.log(`    upload failed: ${up.error.message}`); storage_path = null; } else size_bytes = buf.length;
  }
  let parts = text && text.length >= 300 ? await splitIntoSections(title, text) : [];
  // A web page's leftover prose is not reference material; only sections a
  // reader would look for (specs, install, troubleshooting…) are kept.
  if (!isPdf) parts = parts.filter((p) => p.section !== 'other');
  const primary = parts.length ? [...parts].sort((a, b) => b.content.length - a.content.length)[0].section : (KIND_SECTION[kind] ?? 'other');
  await must(sb.from('document_submissions').insert({
    title, type_id: typeId(primary), sensor_model_id: modelId, storage_path, vendor_url: url, size_bytes, page_count: pageCount ?? null,
    extracted_text: (text ?? note ?? '').slice(0, 300_000) || null, uploaded_by: approver.id, uploaded_at: now(), status: 'approved', reviewed_by: approver.id, reviewed_at: now(),
    reviewer_notes: `Imported from vendor link (scripts/doc-links)${parts.length ? ` · split across: ${parts.map((p) => p.section).join(', ')}` : ''}${note ? ` · ${note}` : ''}`,
    decision: 'append_section', target_section: primary,
  }), `submission ${title}`);
  doneUrls.add(url);
  for (const p of parts) (merged.get(modelId) ?? merged.set(modelId, []).get(modelId)).push({ ...p, note: `Appended from "${title}" (${url}) on ${new Date().toLocaleDateString('en-GB')}` });
  stats.parts += parts.length;
  console.log(`    ✓ ${isPdf ? 'PDF' : 'page'}${storage_path ? ' stored' : ''}${text ? ` · ${text.length.toLocaleString()} chars` : ' · no text'} · ${parts.length ? parts.map((p) => p.section).join(', ') : 'no sections'}`);
}

// ---------- main loop ----------
const fetchedUrls = new Set();
for (const item of todo) {
  console.log(`\n→ ${item.label} [${item.kind}] ${item.url}`);
  if (fetchedUrls.has(item.url) || doneUrls.has(item.url)) { console.log('    (already handled)'); continue; }
  fetchedUrls.add(item.url);
  const r = await fetchUrl(item.url);
  if (r.error) {
    console.log(`    ✗ ${r.error} — recorded as a link`);
    stats.failed++;
    await recordDocument({ modelId: item.model_id, label: item.label, kind: item.kind, url: item.url, title: `${item.label} — ${item.kind} (vendor link)`, note: `Could not be fetched automatically (${r.error}); open the link in a browser.` });
    continue;
  }
  if (r.isPdf) {
    let text = '', pageCount = null;
    try { ({ text, pageCount } = await pdfText(r.buf)); } catch (e) { console.log(`    pdf parse failed: ${e.message}`); }
    const fname = decodeURIComponent(item.url.split('/').pop().split('?')[0]).replace(/\.pdf$/i, '');
    await recordDocument({ modelId: item.model_id, label: item.label, kind: item.kind, url: item.url, title: `${item.label} — ${fname || item.kind}`, buf: r.buf, isPdf: true, text: text.trim().length >= 300 ? text : '', pageCount, note: text.trim().length < 300 ? 'image-only PDF — text could not be extracted' : null });
    stats.pdf++;
  } else {
    const html = r.buf.toString('utf8');
    const { title, text } = htmlToText(html);
    await recordDocument({ modelId: item.model_id, label: item.label, kind: item.kind, url: item.url, title: `${item.label} — ${title || item.kind + ' page'}`.slice(0, 200), text: text.length >= 500 ? text : '', note: text.length < 500 ? 'page has little readable text' : null });
    stats.page++;
    // follow the page's own datasheet / manual PDFs, one level down
    for (const pdfUrl of pdfLinksIn(html, r.finalUrl)) {
      if (fetchedUrls.has(pdfUrl) || doneUrls.has(pdfUrl)) continue;
      fetchedUrls.add(pdfUrl);
      await sleep(400);
      const rr = await fetchUrl(pdfUrl);
      if (rr.error || !rr.isPdf) continue;
      let text2 = '', pc = null; try { ({ text: text2, pageCount: pc } = await pdfText(rr.buf)); } catch { /* skip */ }
      const fname = decodeURIComponent(pdfUrl.split('/').pop().split('?')[0]).replace(/\.pdf$/i, '');
      console.log(`    ↳ followed ${pdfUrl}`);
      await recordDocument({ modelId: item.model_id, label: item.label, kind: item.kind, url: pdfUrl, title: `${item.label} — ${fname || 'linked PDF'}`, buf: rr.buf, isPdf: true, text: text2.trim().length >= 300 ? text2 : '', pageCount: pc, note: text2.trim().length < 300 ? 'image-only PDF — text could not be extracted' : null });
      stats.followed++;
    }
  }
  await sleep(500);
}

// ---------- merge into the references ----------
console.log(`\nMerging into ${merged.size} references…`);
for (const [modelId, parts] of merged) {
  let cdoc = await must(sb.from('consolidated_docs').select('id, content_markdown').eq('sensor_model_id', modelId).maybeSingle(), 'cdoc');
  if (!cdoc) cdoc = await must(sb.from('consolidated_docs').insert({ sensor_model_id: modelId, content_markdown: '' }).select('id, content_markdown').single(), 'cdoc insert');
  let md = cdoc.content_markdown ?? '';
  for (const p of parts) md = appendSection(md, p.section, p.content, p.note);
  await must(sb.from('consolidated_docs').update({ content_markdown: md, last_updated_at: now(), last_updated_by: approver.id, deleted_at: null }).eq('id', cdoc.id), 'cdoc update');
  const old = await must(sb.from('consolidated_doc_chunks').select('id').eq('consolidated_doc_id', cdoc.id), 'old chunks');
  const chunks = chunkSections(parseSections(md));
  for (let i = 0; i < chunks.length; i += 50) await must(sb.from('consolidated_doc_chunks').insert(chunks.slice(i, i + 50).map((c) => ({ consolidated_doc_id: cdoc.id, sensor_model_id: modelId, section: c.section, chunk_text: c.text }))), 'chunks');
  if (old.length) await must(sb.from('consolidated_doc_chunks').delete().in('id', old.map((r) => r.id)), 'drop old');
  await sb.from('consolidated_doc_revisions').insert({ consolidated_doc_id: cdoc.id, content_markdown: md, change_kind: 'approval', note: `Vendor-link import: ${parts.length} part(s) appended (scripts/doc-links)`, changed_by: approver.id });
  const m = models.find((x) => x.id === modelId);
  console.log(`  ✓ ${makes.find((x) => x.id === m.make_id)?.name} ${m.model_no}: +${parts.length} parts, ${chunks.length} chunks`);
}
console.log(`\n✓ Done. PDFs: ${stats.pdf} (+${stats.followed} followed from pages) · pages: ${stats.page} · unreachable: ${stats.failed} · sections appended: ${stats.parts}`);
