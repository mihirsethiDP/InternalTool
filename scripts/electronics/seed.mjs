// Seeds the site-electronics knowledge: consolidated references, search
// chunks, diagnostic flows, curated issues, OEM contacts and the source
// documents for the UPS, camera and datalogger. Content lives in ./content.
//
// Writes through the same shapes the app uses (consolidated_docs +
// insert-then-swap chunks + revision; approved document_submissions; approved
// flows with confirmed classification), so everything shows up in the viewer,
// the Documents tab, the chat and Admin exactly as if it had gone through the
// review queue — with the superadmin recorded as approver.
//
// Idempotent: references are rewritten from content, flows/issues/contacts
// are matched by title/label/scope and updated, sources are skipped when a
// submission with the same title exists.
//
// Usage:
//   node scripts/electronics/seed.mjs                 # dry run
//   node scripts/electronics/seed.mjs --apply
//   node scripts/electronics/seed.mjs --apply --sources "D:/path/with/files"

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as ups from './content/ups.mjs';
import * as camera from './content/camera.mjs';
import * as datalogger from './content/datalogger.mjs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SRC = args.includes('--sources') ? args[args.indexOf('--sources') + 1] : null;
const APPROVER_EMAIL = 'mihir.sethi@digitalpaani.com';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const die = (m) => { console.error('\n✗ ' + m); process.exit(1); };
const must = async (p, what) => { const { data, error } = await p; if (error) die(`${what}: ${error.message}`); return data; };

// Which catalogue entry each device's content attaches to.
const DEVICES = [
  { key: 'ups', content: ups, category: 'UPS', general: true },                                   // shared by all three makes
  { key: 'camera', content: camera, category: 'Camera', make: 'EZVIZ (Hikvision)', model_no: 'CS-H6C' },
  { key: 'datalogger', content: datalogger, category: 'Datalogger', make: 'Raspberry Pi', model_no: 'Pi 4 Model B (4 GB)' },
];

// ---- helpers mirroring src/lib/consolidated.ts (kept tiny and identical in effect) ----
function renderSections(order, sections) {
  const extras = Object.keys(sections).filter((k) => !order.includes(k));
  return [...order, ...extras].map((s) => `## ${s}\n\n${sections[s] || ''}\n`).join('\n').trim() + '\n';
}
function chunkSections(order, sections, target = 1000) {
  const out = [];
  for (const s of [...order, ...Object.keys(sections).filter((k) => !order.includes(k))]) {
    const body = (sections[s] || '').trim();
    if (!body) continue;
    if (body.length <= target) { out.push({ section: s, text: body }); continue; }
    let cur = '';
    for (const sent of body.split(/(?<=[.!?])\s+/)) {
      if ((cur + ' ' + sent).length > target && cur) { out.push({ section: s, text: cur }); cur = sent; }
      else cur = cur ? cur + ' ' + sent : sent;
    }
    if (cur) out.push({ section: s, text: cur });
  }
  return out;
}
function validateFlow(def) {
  const errors = [];
  const ids = new Set(def.nodes.map((n) => n.id));
  if (def.nodes.length > 24) errors.push(`too many nodes (${def.nodes.length})`);
  if (!ids.has(def.start)) errors.push(`start ${def.start} missing`);
  for (const n of def.nodes) {
    if (!n.text?.trim()) errors.push(`${n.id}: no text`);
    if (n.kind === 'question') { if ((n.options ?? []).length < 2) errors.push(`${n.id}: <2 options`); for (const o of n.options ?? []) if (!ids.has(o.next)) errors.push(`${n.id} → ${o.next} missing`); }
    if (n.kind === 'action') { if (!ids.has(n.next)) errors.push(`${n.id} → ${n.next} missing`); if (n.fail_next && !ids.has(n.fail_next)) errors.push(`${n.id} fail_next missing`); }
    if (n.kind === 'escalate' && !n.skill) errors.push(`${n.id}: no skill`);
  }
  return errors;
}

// ---- load reference data ----
const [types, cats, makes, models, approver] = await Promise.all([
  must(sb.from('document_types').select('id, key, sort_order').eq('scope', 'general').order('sort_order'), 'document_types'),
  must(sb.from('sensor_categories').select('id, name, domain'), 'categories'),
  must(sb.from('sensor_makes').select('id, name'), 'makes'),
  must(sb.from('sensor_models').select('id, make_id, category_id, model_no, is_general'), 'models'),
  must(sb.from('profiles').select('id, email, is_super').eq('email', APPROVER_EMAIL).single(), 'approver'),
]);
const ORDER = types.map((t) => t.key);
const typeId = (key) => types.find((t) => t.key === key)?.id ?? types.find((t) => t.key === 'other')?.id ?? null;
const catByName = (n) => cats.find((c) => c.name === n) ?? die(`category ${n} missing — apply 051`);
const makeByName = (n) => makes.find((m) => m.name === n) ?? die(`make ${n} missing — apply 051`);

// validate all content first — nothing is written if anything is wrong
let problems = 0;
for (const d of DEVICES) {
  for (const k of Object.keys(d.content.sections)) if (!ORDER.includes(k)) { console.log(`  ✗ ${d.key}: section "${k}" is not a document_types key`); problems++; }
  for (const f of d.content.flows) { const e = validateFlow(f.definition); if (e.length) { console.log(`  ✗ ${d.key} flow "${f.title}": ${e.join('; ')}`); problems++; } }
  for (const i of d.content.issues) for (const t of i.flows) if (!d.content.flows.some((f) => f.title === t)) { console.log(`  ✗ ${d.key} issue "${i.label}" → unknown flow "${t}"`); problems++; }
  for (const s of d.content.sources) {
    if (s.file && SRC && !fs.existsSync(path.join(SRC, s.file))) { console.log(`  ✗ ${d.key} source file missing: ${s.file}`); problems++; }
    if (s.text && SRC && !fs.existsSync(path.join(SRC, s.text))) { console.log(`  ✗ ${d.key} source text missing: ${s.text}`); problems++; }
  }
}
if (problems) die(`${problems} content problem(s) — fix before seeding`);

for (const d of DEVICES) {
  const cat = catByName(d.category);
  const model = d.general
    ? models.find((m) => m.category_id === cat.id && m.is_general)
    : models.find((m) => m.category_id === cat.id && m.model_no === d.model_no && m.make_id === makeByName(d.make).id);
  if (!model) die(`${d.key}: catalogue entry missing`);
  d.model = model; d.cat = cat;
  const md = renderSections(ORDER, d.content.sections);
  const chunks = chunkSections(ORDER, d.content.sections);
  console.log(`\n${d.key.toUpperCase()} → ${d.general ? 'General — ' + d.category : d.make + ' ' + d.model_no}: ${Object.keys(d.content.sections).length} sections, ${md.length} chars, ${chunks.length} chunks · ${d.content.flows.length} flows · ${d.content.issues.length} issues · ${d.content.contacts.length} contacts · ${d.content.sources.length} sources`);
  d.md = md; d.chunks = chunks;
}
if (!APPLY) { console.log('\nDry run — nothing written. Re-run with --apply' + (SRC ? '' : ' (add --sources <dir> to upload the files)') + '.'); process.exit(0); }

const now = () => new Date().toISOString();

for (const d of DEVICES) {
  // ---- 1. consolidated reference + chunks + revision ----
  let cdoc = (await must(sb.from('consolidated_docs').select('id').eq('sensor_model_id', d.model.id).maybeSingle(), 'cdoc'));
  if (!cdoc) cdoc = await must(sb.from('consolidated_docs').insert({ sensor_model_id: d.model.id, content_markdown: '' }).select('id').single(), 'cdoc insert');
  await must(sb.from('consolidated_docs').update({ content_markdown: d.md, last_updated_at: now(), last_updated_by: approver.id, deleted_at: null }).eq('id', cdoc.id), 'cdoc update');
  const old = await must(sb.from('consolidated_doc_chunks').select('id').eq('consolidated_doc_id', cdoc.id), 'old chunks');
  const inserted = [];
  for (let i = 0; i < d.chunks.length; i += 50) {
    const rows = await must(sb.from('consolidated_doc_chunks').insert(d.chunks.slice(i, i + 50).map((c) => ({ consolidated_doc_id: cdoc.id, sensor_model_id: d.model.id, section: c.section, chunk_text: c.text }))).select('id'), 'chunks');
    inserted.push(...rows.map((r) => r.id));
  }
  if (old.length) await must(sb.from('consolidated_doc_chunks').delete().in('id', old.map((r) => r.id)), 'drop old chunks');
  await sb.from('consolidated_doc_revisions').insert({ consolidated_doc_id: cdoc.id, content_markdown: d.md, change_kind: 'approval', note: `Seeded from the ${d.key} handbook (scripts/electronics)`, changed_by: approver.id });
  console.log(`  ✓ ${d.key}: reference written (${inserted.length} chunks, ${old.length} replaced)`);

  // ---- 2. flows (approved, classified) ----
  const existingFlows = await must(sb.from('diagnostic_flows').select('id, title').eq('sensor_category_id', d.cat.id), 'flows');
  const flowIdByTitle = new Map();
  for (const f of d.content.flows) {
    const row = {
      sensor_category_id: d.cat.id, sensor_model_id: d.general ? null : d.model.id, title: f.title, trigger_symptoms: f.trigger_symptoms,
      definition: f.definition, status: 'approved', source_doc_id: cdoc.id, created_by: approver.id, approved_by: approver.id, approved_at: now(), updated_at: now(),
      visit_required: f.definition.proposed_classification?.visit_required ?? false, skill_required: f.definition.proposed_classification?.skill_required ?? 'anyone',
    };
    const ex = existingFlows.find((x) => x.title === f.title);
    if (ex) { await must(sb.from('diagnostic_flows').update(row).eq('id', ex.id), `flow ${f.title}`); flowIdByTitle.set(f.title, ex.id); }
    else { const ins = await must(sb.from('diagnostic_flows').insert(row).select('id').single(), `flow ${f.title}`); flowIdByTitle.set(f.title, ins.id); }
  }
  console.log(`  ✓ ${d.key}: ${d.content.flows.length} flows approved`);

  // ---- 3. issues + ordered flow links ----
  for (const i of d.content.issues) {
    const iss = await must(sb.from('issues').upsert({ sensor_category_id: d.cat.id, label: i.label, aliases: i.aliases, created_by: approver.id, updated_at: now() }, { onConflict: 'sensor_category_id,label' }).select('id').single(), `issue ${i.label}`);
    await must(sb.from('issue_flows').delete().eq('issue_id', iss.id), 'issue links');
    await must(sb.from('issue_flows').insert(i.flows.map((t, rank) => ({ issue_id: iss.id, flow_id: flowIdByTitle.get(t), rank: rank + 1 }))), 'issue links insert');
  }
  console.log(`  ✓ ${d.key}: ${d.content.issues.length} issues linked`);

  // ---- 4. escalation contacts ----
  for (const c of d.content.contacts) {
    const skill = c.skill_key ?? 'vendor_support';
    const makeId = c.make ? makeByName(c.make).id : null;
    let q = sb.from('escalation_contacts').select('id').eq('skill_key', skill);
    q = makeId ? q.eq('make_id', makeId) : q.is('make_id', null).is('plant_id', null).is('sensor_model_id', null);
    const ex = await must(q.maybeSingle(), 'contact lookup');
    const row = { skill_key: skill, label: c.label ?? (makeId ? `${c.make} customer care` : skill), person_name: c.person_name ?? null, contact: c.contact ?? null, notes: c.notes ?? null, active: true, make_id: makeId, sort_order: c.skill_key ? 60 : 50 };
    if (ex) await must(sb.from('escalation_contacts').update(row).eq('id', ex.id), 'contact update');
    else await must(sb.from('escalation_contacts').insert(row), 'contact insert');
  }
  console.log(`  ✓ ${d.key}: ${d.content.contacts.length} contacts`);

  // ---- 5. source documents (Documents tab) ----
  let added = 0;
  for (const s of d.content.sources) {
    const ex = await must(sb.from('document_submissions').select('id').eq('title', s.title).maybeSingle(), 'source lookup');
    if (ex) continue;
    let storage_path = null, size_bytes = null;
    if (s.file && SRC) {
      const buf = fs.readFileSync(path.join(SRC, s.file));
      storage_path = `${Date.now()}_${s.file}`;
      const ext = s.file.split('.').pop().toLowerCase();
      const contentType = ext === 'pdf' ? 'application/pdf' : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream';
      const up = await sb.storage.from('documents').upload(storage_path, buf, { contentType, upsert: false });
      if (up.error) die(`upload ${s.file}: ${up.error.message}`);
      size_bytes = buf.length;
    }
    let text = s.textInline ?? null;
    if (!text && s.text && SRC) text = fs.readFileSync(path.join(SRC, s.text), 'utf8').replace(/^######.*$/m, '').replace(/\u0000/g, '').trim().slice(0, 200000);
    if (!text && s.note) text = s.note;
    // A source that names a make attaches to that make's model, not the general entry.
    let modelId = d.model.id;
    if (s.make) modelId = models.find((m) => m.category_id === d.cat.id && m.make_id === makeByName(s.make).id && !m.is_general)?.id ?? d.model.id;
    await must(sb.from('document_submissions').insert({
      title: s.title, type_id: typeId(s.type), sensor_model_id: modelId, storage_path, vendor_url: s.url ?? null, size_bytes,
      extracted_text: text, uploaded_by: approver.id, uploaded_at: now(), status: 'approved', reviewed_by: approver.id, reviewed_at: now(),
      reviewer_notes: 'Seeded source document (scripts/electronics)', decision: 'append_section', target_section: s.type,
    }), `source ${s.title}`);
    added++;
  }
  console.log(`  ✓ ${d.key}: ${added} source documents added (${d.content.sources.length - added} already present)`);
}
console.log('\n✓ Electronics knowledge seeded.');
