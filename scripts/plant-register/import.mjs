// Imports the plant device register (the "Sensors Installed (Plant Level)"
// workbook) into plants / sensor_makes / sensor_models / plant_sensors, then
// adds the site electronics every plant carries (UPS by site rule, one
// camera, one datalogger).
//
// Idempotent and re-runnable: plants match by name, makes by name, models by
// (make, model_no), register rows by (plant, model). Re-running after the
// analyst edits the sheet updates quantities/notes in place and never deletes
// rows added by hand in the UI (source = 'manual').
//
// Usage:
//   node scripts/plant-register/import.mjs                       # dry run: full report, no writes
//   node scripts/plant-register/import.mjs --apply               # write
//   node scripts/plant-register/import.mjs --xlsx "D:/path.xlsx" # a different workbook
//
// Needs .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// (service role: this bypasses RLS on purpose — it is an operator tool).

import fs from 'node:fs';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { parseRegister, resolveCategory, isAssumption, upsMakeFor, splitModels, norm } from './rules.mjs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const xlsxPath = args.includes('--xlsx') ? args[args.indexOf('--xlsx') + 1] : 'D:/Sensor Health/source_of_truth/Sensors Installed (Plant Level).xlsx';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ELECTRONICS = [
  { category: 'Camera',     make: 'EZVIZ (Hikvision)', model_no: 'CS-H6C',              note: 'Fleet standard: same camera at every plant (Mihir, 2026-09-23).' },
  { category: 'Datalogger', make: 'Raspberry Pi',      model_no: 'Pi 4 Model B (4 GB)', note: 'Fleet standard: the PLC-to-cloud bridge at every plant (Mihir, 2026-09-23).' },
];

function die(msg) { console.error('\n✗ ' + msg); process.exit(1); }
async function must(p, what) { const { data, error } = await p; if (error) die(`${what}: ${error.message}`); return data; }

// ---------- 1. parse the workbook ----------
const wb = XLSX.readFile(xlsxPath);
const sheets = Object.fromEntries(wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' })]));
const { plants, rows } = parseRegister(sheets);
console.log(`Workbook: ${plants.length} plants, ${rows.length} category rows, ${rows.reduce((a, r) => a + r.pairs.length, 0)} make/model entries`);

// ---------- 2. load the catalogue ----------
const [cats, makes, models, dbPlants, dbRows] = await Promise.all([
  must(sb.from('sensor_categories').select('id, name, aliases, domain'), 'categories'),
  must(sb.from('sensor_makes').select('id, name'), 'makes'),
  must(sb.from('sensor_models').select('id, make_id, category_id, model_no, name, is_general'), 'models'),
  must(sb.from('plants').select('id, name, code, client, status'), 'plants'),
  must(sb.from('plant_sensors').select('id, plant_id, sensor_model_id, source'), 'plant_sensors'),
]);
if (!cats.some((c) => c.domain === 'electronics')) die('Migration 051 has not been applied (no electronics categories). Run it first.');

// ---------- 3. resolve categories ----------
const catFor = new Map();
const unknownCats = new Set();
for (const r of rows) {
  const c = resolveCategory(r.category, cats);
  if (c) catFor.set(r.category, c); else unknownCats.add(r.category);
}
if (unknownCats.size) die(`Unmapped categories: ${[...unknownCats].join(', ')} — add them to CATEGORY_MAP or as aliases.`);

// ---------- 4. plan makes + models ----------
const makeByNorm = new Map(makes.map((m) => [norm(m.name), m]));
const newMakes = new Map(); // norm -> name
const modelKey = (makeId, modelNo) => `${makeId}::${norm(modelNo)}`;
const modelByKey = new Map(models.filter((m) => !m.is_general).map((m) => [modelKey(m.make_id, m.model_no), m]));
const newModels = new Map(); // key -> { make, model_no, category }

function planMake(name) {
  const k = norm(name);
  if (makeByNorm.has(k)) return { id: makeByNorm.get(k).id, name: makeByNorm.get(k).name, isNew: false };
  if (!newMakes.has(k)) newMakes.set(k, name);
  return { id: null, name, isNew: true, normKey: k };
}
function planModel(make, modelNo, category) {
  const mk = planMake(make);
  const k = mk.id ? modelKey(mk.id, modelNo) : `new:${mk.normKey}::${norm(modelNo)}`;
  if (mk.id && modelByKey.has(k)) return { ...modelByKey.get(k), isNew: false };
  if (!newModels.has(k)) newModels.set(k, { make, model_no: modelNo, category });
  return { id: null, isNew: true, key: k };
}
for (const r of rows) {
  const c = catFor.get(r.category);
  for (const [mk, mo] of r.pairs) for (const m of splitModels(mo)) planModel(mk, m, c);
}
// electronics
const upsCat = cats.find((c) => c.name === 'UPS'), camCat = cats.find((c) => c.name === 'Camera'), dlCat = cats.find((c) => c.name === 'Datalogger');
if (!upsCat || !camCat || !dlCat) die('UPS / Camera / Datalogger categories missing — apply migration 051.');
for (const e of ELECTRONICS) planModel(e.make, e.model_no, cats.find((c) => c.name === e.category));
for (const mk of ['Microtek', 'BPE', 'Emerson (Vertiv)']) planModel(mk, '1 kVA Online UPS', upsCat);

// ---------- 5. report ----------
const plantByName = new Map(dbPlants.map((p) => [norm(p.name), p]));
const plantsNew = plants.filter((p) => !plantByName.has(norm(p.name)));
const disc = plants.filter((p) => p.status === 'discontinued');
console.log(`\nPlants: ${plantsNew.length} new, ${plants.length - plantsNew.length} existing · ${disc.length} discontinued (${disc.map((p) => p.name).join(', ') || '—'})`);
console.log(`Makes: ${newMakes.size} new → ${[...newMakes.values()].join(' | ') || '—'}`);
console.log(`Models: ${newModels.size} new →`);
for (const m of newModels.values()) console.log(`   + ${m.make} ${m.model_no}  [${m.category.name}]`);
const assumed = rows.filter((r) => isAssumption(r.notes)).length;
console.log(`Register rows: ${rows.length} (${assumed} flagged as working assumptions) · electronics rows to add: ${plants.filter((p) => p.status === 'active').length * 3}`);

if (!APPLY) { console.log('\nDry run — nothing written. Re-run with --apply to import.'); process.exit(0); }

// ---------- 6. write ----------
// plants
for (const p of plants) {
  const ex = plantByName.get(norm(p.name));
  if (ex) {
    const patch = {};
    if (!ex.code && p.code) patch.code = p.code;
    if (!ex.client && p.client) patch.client = p.client;
    if (ex.status !== p.status) patch.status = p.status;
    if (Object.keys(patch).length) { await must(sb.from('plants').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', ex.id), `plant ${p.name}`); Object.assign(ex, patch); }
  } else {
    const ins = await must(sb.from('plants').insert({ name: p.name, code: p.code, client: p.client, status: p.status }).select('id, name, code, client, status').single(), `plant ${p.name}`);
    plantByName.set(norm(p.name), ins);
  }
}
// makes
for (const [k, name] of newMakes) {
  const ins = await must(sb.from('sensor_makes').insert({ name }).select('id, name').single(), `make ${name}`);
  makeByNorm.set(k, ins);
}
// models
for (const m of newModels.values()) {
  const mk = makeByNorm.get(norm(m.make));
  const ins = await must(sb.from('sensor_models').insert({ make_id: mk.id, category_id: m.category.id, model_no: m.model_no, name: `${mk.name} ${m.model_no}`, is_general: false })
    .select('id, make_id, category_id, model_no, name, is_general').single(), `model ${m.make} ${m.model_no}`);
  modelByKey.set(modelKey(mk.id, m.model_no), ins);
}
const findModel = (make, modelNo) => modelByKey.get(modelKey(makeByNorm.get(norm(make)).id, modelNo));

// register rows
const existing = new Map(dbRows.map((r) => [`${r.plant_id}::${r.sensor_model_id}`, r]));
let ins = 0, upd = 0;
async function upsertDevice(plant, model, fields) {
  const k = `${plant.id}::${model.id}`;
  const ex = existing.get(k);
  if (ex) { await must(sb.from('plant_sensors').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', ex.id), `row ${plant.name}/${model.model_no}`); upd++; }
  else { const row = await must(sb.from('plant_sensors').insert({ plant_id: plant.id, sensor_model_id: model.id, ...fields }).select('id, plant_id, sensor_model_id, source').single(), `row ${plant.name}/${model.model_no}`); existing.set(k, row); ins++; }
}
for (const r of rows) {
  const plant = plantByName.get(norm(r.plant));
  const c = catFor.get(r.category);
  for (const [mk, mo] of r.pairs) {
    const parts = splitModels(mo);
    for (const m of parts) {
      const model = findModel(mk, m);
      const splitNote = parts.length > 1 ? `Per-tag split with ${parts.filter((x) => x !== m).join(', ')} — quantity is the category total. ` : '';
      await upsertDevice(plant, model, {
        category_id: c.id, quantity: r.count, tags: r.tags,
        notes: (splitNote + r.notes).trim() || null,
        source: 'register', is_assumption: isAssumption(r.notes),
      });
    }
  }
}
// electronics by rule (active plants only)
for (const p of plants.filter((x) => x.status === 'active')) {
  const plant = plantByName.get(norm(p.name));
  const upsMake = upsMakeFor(p.name);
  await upsertDevice(plant, findModel(upsMake, '1 kVA Online UPS'), {
    category_id: upsCat.id, quantity: 1, tags: [], source: 'rule', is_assumption: false,
    notes: `UPS OEM by site rule (Mihir, 2026-09-23): ${upsMake}. Model number not on record — read it off the nameplate sticker.`,
  });
  for (const e of ELECTRONICS) {
    await upsertDevice(plant, findModel(e.make, e.model_no), { category_id: cats.find((c) => c.name === e.category).id, quantity: 1, tags: [], source: 'rule', is_assumption: false, notes: e.note });
  }
}
console.log(`\n✓ Imported: ${ins} device rows inserted, ${upd} updated · ${plants.length} plants · ${newMakes.size} makes · ${newModels.size} models`);
