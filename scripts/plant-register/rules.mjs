// Pure rules for importing the plant device register. No I/O, no database —
// everything here is unit-tested (src/lib/__tests__/plantRules.test.ts) and
// shared by the importer, so a rule change is one edit and one test.

// Register category (the fill sheet's wording) → master-list category name
// (migration 045 + 051). Aliases on sensor_categories are the fallback for
// anything not listed here.
export const CATEGORY_MAP = {
  'Flow Meters': 'Flow',
  'Level Transmitters': 'Level',
  'Pressure Transmitters': 'Pressure',
  'Energy Meters': 'Energy Meter',
  'Turbidity': 'Turbidity',
  'Biomass Health': 'Biomass Health',
  'PH': 'pH',
  'Bar Screen Level': 'Bar Screen Level',
  'DO': 'Dissolved Oxygen (DO)',
  'Level Switch': 'Switches (Float / Level / Pressure / Flow)',
  'TSS': 'TSS / MLSS',
  'MLSS': 'TSS / MLSS',
  'BOD': 'BOD',
  'COD': 'COD',
  'Temperature': 'Temperature',
  'ORP': 'ORP',
  'TDS': 'TDS',
  'Chlorine': 'Chlorine',
  'Proximity': 'Proximity',
  'Airflow Meter': 'Air Flow',
};

// The fill sheet and the catalogue sometimes name the same thing differently.
// Map register spelling → catalogue spelling so the plant links to the model
// that already carries the documentation (UPC MAG-110 has a full reference).
export const MAKE_ALIASES = {
  'UPC (Universal Process Controls)': 'UPC',
  'Universal Process Controls': 'UPC',
};
export const MODEL_ALIASES = {
  'UPC::UPCS-MAG-110': 'MAG-110',
};
export function canonicalMake(make) {
  return MAKE_ALIASES[String(make ?? '').trim()] ?? String(make ?? '').trim();
}
export function canonicalModel(make, model) {
  const mk = canonicalMake(make);
  return MODEL_ALIASES[mk + '::' + String(model ?? '').trim()] ?? String(model ?? '').trim();
}

export function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Resolve a register category to a catalogue category row {id, name, aliases}.
export function resolveCategory(sheetName, categories) {
  const want = CATEGORY_MAP[String(sheetName).trim()] ?? String(sheetName).trim();
  const w = norm(want);
  const byName = categories.find((c) => norm(c.name) === w);
  if (byName) return byName;
  const byAlias = categories.find((c) => (c.aliases ?? []).some((a) => norm(a) === w || norm(a) === norm(sheetName)));
  return byAlias ?? null;
}

// "Working assumption, not a nameplate reading" — the analyst's phrasing for
// rows filled from the fleet-commonest make because DP didn't install it.
export function isAssumption(notes) {
  return /working assumption|not installed by digital paani|client-owned|fleet-commonest|not a nameplate/i.test(String(notes ?? ''));
}

// The client (account) a plant belongs to, from its name. Used for grouping
// the plant list and for site rules like "all Amazon sites".
const CLIENT_PREFIXES = [
  'Amazon', 'Adani', 'Amity', 'Tata Steel', 'Tata', 'Vedanta', 'Lodha', 'KIMS', 'Kims', 'Leela', 'Ireo',
  'Vatika', 'Parx', 'BIL', 'METL', 'Manohar International Airport', 'Plaksha', 'Welspun', 'Hindalco',
  'GMR', 'Medanta', 'Honda', 'Merino', 'Taj', 'Lalit', 'Nirlon', 'Sun Pharma', 'Veeba', 'Essentia',
  'Gitam', 'DJB', 'Silicon Valley',
];
export function deriveClient(plantName) {
  const n = String(plantName ?? '').trim();
  for (const p of CLIENT_PREFIXES) {
    if (n.toLowerCase().startsWith(p.toLowerCase())) return p === 'Kims' ? 'KIMS' : p;
  }
  // Municipal STPs ("1.25 MLD STP - Pragnapur Bypass") and one-offs stand alone.
  if (/\bMLD\b|Municipal|Municipality|Nagar|Corporation/i.test(n)) return 'Municipal';
  return n.split(/[-(]/)[0].trim();
}

// UPS OEM per site (Mihir, 2026-09-23): EMS runs Emerson; every Amazon site
// except NCRU, MDEA, MAMA and MSTA runs BPE; everyone else runs Microtek.
const AMAZON_MICROTEK = new Set(['NCRU', 'MDEA', 'MAMA', 'MSTA']);
export function upsMakeFor(plantName) {
  const n = String(plantName ?? '').trim();
  if (/^EMS$/i.test(n)) return 'Emerson (Vertiv)';
  const amazon = n.match(/^Amazon\s+(.+)$/i);
  if (amazon) {
    const site = amazon[1].trim().toUpperCase();
    return AMAZON_MICROTEK.has(site) ? 'Microtek' : 'BPE';
  }
  return 'Microtek';
}

// Every tag ends in ":<plant code>" (sometimes ":<code>_<code>"). The most
// frequent suffix across a plant's example tags is its code.
export function plantCodeFromTags(tagCells) {
  const counts = new Map();
  for (const cell of tagCells) {
    for (const t of String(cell ?? '').split(/,\s*/)) {
      const m = t.trim().replace(/\s*\.\.\.$/, '').match(/:([A-Za-z0-9_]+)\s*$/);
      if (!m) continue;
      const code = m[1].split('_').pop().toUpperCase();
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function parseTags(cell) {
  return String(cell ?? '')
    .replace(/\s*\.\.\.\s*$/, '')
    .split(/,\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// "LFT1 + LFT2 (per tag)" means two models split tag by tag. Anything else
// with a "+" is one product ("FM 8312 + Aqua2Trans" is a probe + transmitter).
export function splitModels(model) {
  const m = String(model ?? '').trim();
  const perTag = m.match(/^(.+?)\s*\(per tag\)$/i);
  if (perTag) return perTag[1].split(/\s*\+\s*/).map((x) => x.trim()).filter(Boolean);
  return [m];
}

// A plant is discontinued when every one of its rows says so.
export function plantStatus(rows) {
  const st = rows.map((r) => String(r.status ?? ''));
  return st.length > 0 && st.every((s) => /discontinued/i.test(s)) ? 'discontinued' : 'active';
}

// Turn the workbook's sheets (as header:1 row arrays) into plants + device rows.
export function parseRegister(sheets /* { [sheetName]: any[][] } */) {
  const plants = [];
  const rows = [];
  for (const [sheetName, r] of Object.entries(sheets)) {
    if (sheetName === 'Index' || sheetName === 'Models') continue;
    const plant = String(r[0]?.[0] || sheetName).trim();
    const hdrIdx = r.findIndex((x) => String(x?.[0] ?? '').trim() === 'Category');
    if (hdrIdx < 0) continue;
    const plantRows = [];
    for (const x of r.slice(hdrIdx + 1)) {
      const category = String(x?.[0] ?? '').trim();
      if (!category) continue;
      const row = {
        plant, category,
        count: Number(x[1]) || 0,
        tags: parseTags(x[2]),
        pairs: [[x[3], x[4]], [x[5], x[6]], [x[7], x[8]]]
          .map(([mk, mo]) => [String(mk ?? '').trim(), String(mo ?? '').trim()])
          .filter(([mk, mo]) => mk && mo),
        status: String(x[9] ?? '').trim(),
        notes: String(x[10] ?? '').trim(),
      };
      plantRows.push(row);
      rows.push(row);
    }
    plants.push({
      name: plant,
      code: plantCodeFromTags(plantRows.flatMap((pr) => pr.tags.join(', '))),
      client: deriveClient(plant),
      status: plantStatus(plantRows),
    });
  }
  return { plants, rows };
}
