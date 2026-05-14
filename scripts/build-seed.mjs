// Parses the master costing xlsx and emits 002_seed.sql with INSERTs
// for sensor_categories, sensor_makes, sensor_models, and plcs.
//
// Usage: node scripts/build-seed.mjs "D:/Downloads/Master Costing Database.xlsx"

import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const inputPath = process.argv[2] || 'D:/Downloads/Master Costing Database.xlsx';
const outPath = path.resolve('supabase/migrations/002_seed.sql');

const SKIP_SHEETS = new Set([
  'Categories', 'Electrical Accessories', 'Valves', 'Dosing System Accessories', 'R&D', 'Screw Press',
]);

// Map sheet → category-group label used on sensor_categories.group
const SHEET_GROUP = {
  'Flow Measuring Device': 'Flow',
  'Level Measuring Device': 'Level',
  'Pressure Measuring Device': 'Pressure',
  'Water Quality Sensors': 'Water Quality',
  'Water Quality Sensors ': 'Water Quality',
  'Maintenance & Safety Sensors': 'Maintenance & Safety',
};

const wb = XLSX.readFile(inputPath);
console.log('Sheets:', wb.SheetNames);

const sql = [];
sql.push('-- AUTO-GENERATED from master costing xlsx by scripts/build-seed.mjs');
sql.push('-- Run AFTER 001_init.sql.');
sql.push('begin;');
sql.push('');

const escSql = (s) => `'${String(s).replace(/'/g, "''")}'`;
const nullable = (s) => (s == null || String(s).trim() === '' ? 'NULL' : escSql(String(s).trim()));

// Track unique categories & makes per group so we can pre-insert.
const categories = new Set();   // "Flow:Electromagnetic Flow Meter"
const makes = new Set();
const sensorRows = [];          // {group, category, make, model, name, specs, suitability, remarks, listPrice}
const plcRows = [];             // {make, model, name, specs, suitability, listPrice}

// ----------------- Sensor sheets -----------------
for (const sheetName of wb.SheetNames) {
  if (SKIP_SHEETS.has(sheetName)) continue;
  if (sheetName === 'PLCDriveHMI') continue; // handled separately
  if (!SHEET_GROUP[sheetName]) continue;

  const group = SHEET_GROUP[sheetName];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

  // The sheet has product-family blocks: a "header-like" row gives the category name
  // (e.g. "Electromagnetic Flow Meter - (Rubber Lining)") and the following rows are variants.
  // Heuristic: a row is a "category header" if cell B is a non-empty string AND most other cells are empty.
  // A row is a "variant" if it has a numeric cost or a Make value.
  let currentCategory = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const itemName = String(r[1] ?? '').trim();
    const cost = r[3];
    const make = String(r[4] ?? '').trim();
    const specs = String(r[5] ?? '').trim();
    const modelNo = String(r[6] ?? '').trim();
    const technical = String(r[7] ?? '').trim();
    const suitability = String(r[8] ?? '').trim();
    const remarks = String(r[9] ?? '').trim();

    // Detect category header rows: itemName present, almost everything else empty,
    // and itemName does not look like a sub-variant ("- 40MM", etc.) when at column position.
    const otherFilled = [cost, make, specs, modelNo, technical, suitability, remarks].filter(
      (v) => String(v ?? '').trim() !== ''
    ).length;
    if (itemName && otherFilled <= 1 && !/^\d+(\.\d+)?$/.test(itemName)) {
      currentCategory = itemName;
      categories.add(`${group}::${currentCategory}`);
      continue;
    }

    // variant row
    if (!currentCategory) continue;
    if (!make && !modelNo && !specs && !suitability) continue;

    if (make) makes.add(make);
    sensorRows.push({
      group,
      category: currentCategory,
      make: make || null,
      model: modelNo || null,
      name: itemName || null,
      specs: specs || null,
      technical: technical || null,
      suitability: suitability || null,
      remarks: remarks || null,
      listPrice: typeof cost === 'number' ? cost : null,
    });
  }
}

// ----------------- PLC sheet -----------------
{
  const sheetName = 'PLCDriveHMI';
  if (wb.Sheets[sheetName]) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
    let currentFamily = null;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const itemName = String(r[1] ?? '').trim();
      const cost = r[3];
      const suitability = String(r[4] ?? '').trim();
      const technical = String(r[5] ?? '').trim();

      // family header: itemName non-empty, most others empty
      const otherFilled = [cost, suitability, technical, r[6], r[7]].filter((v) => String(v ?? '').trim() !== '').length;
      if (itemName && otherFilled <= 1) {
        currentFamily = itemName; // e.g. "PLC-Fuji"
        continue;
      }
      if (!currentFamily) continue;
      if (!itemName && !suitability && !technical) continue;

      // family looks like "PLC-Fuji" → make = "Fuji"; itemName like "NA0PB60R-34C - (36DI 24DO)" → model
      const make = currentFamily.replace(/^PLC[-\s]*|^DRIVE[-\s]*|^HMI[-\s]*/i, '').trim() || currentFamily;
      plcRows.push({
        make,
        model: itemName.split(' - ')[0] || itemName,
        name: itemName,
        specs: null,
        technical: technical || null,
        suitability: suitability || null,
        listPrice: typeof cost === 'number' ? cost : null,
      });
    }
  }
}

console.log(`Parsed: ${sensorRows.length} sensor variants, ${plcRows.length} PLC variants, ${categories.size} categories, ${makes.size} makes`);

// ---------- Emit SQL ----------
sql.push('-- Categories');
for (const c of categories) {
  const [group, name] = c.split('::');
  sql.push(`insert into public.sensor_categories (name, "group") values (${escSql(name)}, ${escSql(group)}) on conflict (name) do nothing;`);
}
sql.push('');

sql.push('-- Makes');
for (const m of makes) {
  if (!m) continue;
  sql.push(`insert into public.sensor_makes (name) values (${escSql(m)}) on conflict (name) do nothing;`);
}
sql.push('');

sql.push('-- Sensor models');
for (const r of sensorRows) {
  const pieces = [
    nullable(r.model),
    nullable(r.name),
    nullable(r.specs),
    nullable(r.technical),
    nullable(r.suitability),
    r.listPrice == null ? 'NULL' : r.listPrice,
  ];
  // resolve make_id and category_id by names
  const makeExpr = r.make ? `(select id from public.sensor_makes where name = ${escSql(r.make)})` : 'NULL';
  const catExpr = `(select id from public.sensor_categories where name = ${escSql(r.category)})`;
  sql.push(
    `insert into public.sensor_models (make_id, category_id, model_no, name, specs, technical_details, suitability, list_price) values (${makeExpr}, ${catExpr}, ${pieces[0]}, ${pieces[1]}, ${pieces[2]}, ${pieces[3]}, ${pieces[4]}, ${pieces[5]});`
  );
}
sql.push('');

sql.push('-- PLCs');
for (const r of plcRows) {
  sql.push(
    `insert into public.plcs (make, model_no, name, technical_details, suitability, list_price) values (${nullable(r.make)}, ${nullable(r.model)}, ${nullable(r.name)}, ${nullable(r.technical)}, ${nullable(r.suitability)}, ${r.listPrice == null ? 'NULL' : r.listPrice});`
  );
}

sql.push('');
sql.push('commit;');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, sql.join('\n'));
console.log('Wrote', outPath, '(' + sql.length + ' lines)');
