import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { extractPdfText, chunkPage } from '../lib/pdf';
import type { DocumentScope } from '../lib/types';
import AddSensorModal from './AddSensorModal';

interface UploadDefaults {
  plant_id?: string;
  equipment_id?: string;
  sensor_model_id?: string;
  type_key?: string;
}
interface Ctx { open: (defaults?: UploadDefaults) => void; }
const UploadCtx = createContext<Ctx | null>(null);

export function useUpload() {
  const c = useContext(UploadCtx);
  if (!c) throw new Error('UploadProvider missing');
  return c;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState<UploadDefaults>({});
  return (
    <UploadCtx.Provider value={{ open: (d) => { setDefaults(d ?? {}); setOpen(true); } }}>
      {children}
      {open && <UploadModalInner defaults={defaults} onClose={() => setOpen(false)} />}
    </UploadCtx.Provider>
  );
}

// --- File icon helper ---
function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return '📕';
  if (['doc', 'docx'].includes(ext ?? '')) return '📘';
  if (['xls', 'xlsx', 'csv'].includes(ext ?? '')) return '📊';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext ?? '')) return '🖼️';
  return '📎';
}

function UploadModalInner({ defaults, onClose }: { defaults: UploadDefaults; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [typeId, setTypeId] = useState('');
  const [plantId, setPlantId] = useState(defaults.plant_id ?? '');
  const [equipmentId, setEquipmentId] = useState(defaults.equipment_id ?? '');
  const [sensorModelId, setSensorModelId] = useState(defaults.sensor_model_id ?? '');
  const [makeId, setMakeId] = useState('');
  const [vendorUrl, setVendorUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showAddSensor, setShowAddSensor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const types = useQuery({ queryKey: ['types'], queryFn: async () => (await supabase.from('document_types').select('*').order('sort_order')).data ?? [] });
  const plants = useQuery({ queryKey: ['plants'], queryFn: async () => (await supabase.from('plants').select('id,name').order('name')).data ?? [] });
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });
  const models = useQuery({
    queryKey: ['models-by-make', makeId],
    queryFn: async () => makeId ? ((await supabase.from('sensor_models').select('id, model_no, name').eq('make_id', makeId).order('model_no')).data ?? []) : [],
    enabled: Boolean(makeId),
  });
  const equipment = useQuery({
    queryKey: ['equipment', plantId],
    queryFn: async () => plantId ? ((await supabase.from('equipment').select('id,name').eq('plant_id', plantId).order('name')).data ?? []) : [],
    enabled: Boolean(plantId),
  });

  // "Recently used" — distinct top-3 doc types / plants / makes from the latest 30 uploads.
  const recent = useQuery({
    queryKey: ['recent-meta'],
    queryFn: async () => {
      const { data } = await supabase
        .from('documents')
        .select('type_id, plant_id, sensor_models(make_id), uploaded_at')
        .order('uploaded_at', { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const recentTypeIds = useMemo(() => distinct((recent.data ?? []).map((d: any) => d.type_id)).slice(0, 3), [recent.data]);
  const recentPlantIds = useMemo(() => distinct((recent.data ?? []).map((d: any) => d.plant_id)).slice(0, 3), [recent.data]);
  const recentMakeIds = useMemo(() => distinct((recent.data ?? []).map((d: any) => d.sensor_models?.make_id)).slice(0, 3), [recent.data]);

  const selectedType = types.data?.find((t: any) => t.id === typeId);
  const scope: DocumentScope = (selectedType?.scope ?? 'general') as DocumentScope;

  // Preselect type from defaults
  useEffect(() => {
    if (defaults.type_key && types.data) {
      const t = types.data.find((x: any) => x.key === defaults.type_key);
      if (t) setTypeId(t.id);
    }
  }, [defaults.type_key, types.data]);

  // Title auto-fills from filename until the user edits it
  useEffect(() => {
    if (!titleTouched && file) setTitle(file.name.replace(/\.[^.]+$/, ''));
  }, [file, titleTouched]);

  // Clear sensor/plant fields when scope changes
  useEffect(() => {
    if (scope === 'plant' || scope === 'plant_with_sensor_refs') { setMakeId(''); setSensorModelId(''); }
    if (scope === 'general') { setPlantId(''); setEquipmentId(''); }
  }, [scope]); // eslint-disable-line

  function pickFile(f: File | null) { setFile(f); setError(null); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }

  function valid(): string | null {
    if (!file) return 'Choose a file.';
    if (!typeId) return 'Pick a document type.';
    if (scope === 'plant' || scope === 'plant_sensor' || scope === 'plant_with_sensor_refs') {
      if (!plantId) return 'Pick a plant for this document type.';
    }
    if (scope === 'plant_sensor') {
      if (!equipmentId) return 'Pick the equipment.';
      if (!sensorModelId) return 'Pick the sensor model.';
    }
    if (scope === 'general' && !sensorModelId) return 'Pick the sensor model this document is for.';
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = valid();
    if (err) { setError(err); return; }
    if (!file) return;
    setError(null); setBusy(true); setProgress(10); setStatus('Uploading file…');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `${Date.now()}_${safeName}`;
    const up = await supabase.storage.from('documents').upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (up.error) { setBusy(false); setError('Upload failed: ' + up.error.message); return; }
    setProgress(40); setStatus('Creating document record…');

    const insert = await supabase.from('documents').insert({
      title, type_id: typeId,
      plant_id: plantId || null,
      equipment_id: equipmentId || null,
      sensor_model_id: sensorModelId || null,
      vendor_url: vendorUrl || null,
      storage_path: storagePath, size_bytes: file.size,
    }).select('id').single();
    if (insert.error || !insert.data) { setBusy(false); setError('DB insert failed: ' + (insert.error?.message ?? '?')); return; }
    const documentId = insert.data.id;
    setProgress(55);

    if (/\.pdf$/i.test(file.name) || /pdf/i.test(file.type)) {
      try {
        setStatus('Extracting PDF text…');
        const pages = await extractPdfText(file);
        await supabase.from('documents').update({ page_count: pages.length }).eq('id', documentId);
        setProgress(75); setStatus('Indexing for search…');
        const chunks = pages.flatMap((p) => chunkPage(p.text, p.page));
        for (let i = 0; i < chunks.length; i += 50) {
          const batch = chunks.slice(i, i + 50).map((c) => ({ document_id: documentId, page_number: c.page, chunk_text: c.text }));
          const { error } = await supabase.from('document_chunks').insert(batch);
          if (error) { console.warn(error); break; }
          setProgress(75 + Math.floor((i / chunks.length) * 20));
        }
      } catch (e: any) {
        console.warn('pdf extract failed', e);
        setStatus('Saved, but PDF text extraction failed; document is still findable by metadata.');
      }
    } else {
      await supabase.from('document_chunks').insert({ document_id: documentId, page_number: null, chunk_text: title });
    }

    setProgress(100); setStatus('✅ Uploaded.');
    qc.invalidateQueries({ queryKey: ['recent-docs'] });
    qc.invalidateQueries({ queryKey: ['recent-meta'] });
    qc.invalidateQueries({ queryKey: ['plant-docs'] });
    qc.invalidateQueries({ queryKey: ['browse'] });
    setBusy(false);
    setTimeout(onClose, 700);
  }

  function labelOf(coll: any[] | undefined, id: string) {
    return coll?.find((x: any) => x.id === id);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide mb-2">
              ⬆ New document
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Upload a document</h2>
            <p className="text-sm text-slate-500 mt-1">PDFs are fully text-indexed. Word, Excel, and images are indexed by metadata.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none -mt-1">×</button>
        </div>

        <form onSubmit={submit} className="px-7 py-6 space-y-6">
          {/* Drag-drop / file picker */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`block rounded-2xl border-2 border-dashed transition cursor-pointer text-center px-6 py-8 ${
              dragOver ? 'border-brand-700 bg-brand-50' : file ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <input type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
              className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <div>
                <div className="text-4xl mb-2">{fileIcon(file.name)}</div>
                <div className="font-semibold text-slate-900 break-all">{file.name}</div>
                <div className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(0)} KB · Click to choose a different file</div>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-2">⬆</div>
                <div className="font-semibold text-slate-700">Drop your file here, or <span className="text-brand-700 underline">browse</span></div>
                <div className="text-xs text-slate-500 mt-1">PDF, Word, Excel, or images</div>
              </div>
            )}
          </label>

          {/* Title */}
          <div>
            <label className="label">Title</label>
            <input
              className="input text-base"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
              placeholder="Will be filled from the file name"
              required
            />
            {file && !titleTouched && <div className="text-xs text-slate-500 mt-1.5">Auto-filled from the file name — feel free to edit.</div>}
          </div>

          {/* Document type with recent suggestions */}
          <div>
            <label className="label">Document type</label>
            {recentTypeIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-xs text-slate-500 self-center mr-1">Recent:</span>
                {recentTypeIds.map((tid) => {
                  const t = labelOf(types.data, tid);
                  if (!t) return null;
                  const active = typeId === tid;
                  return (
                    <button type="button" key={tid} onClick={() => setTypeId(tid)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition ${active ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-200 hover:border-brand-700 hover:text-brand-700'}`}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
            <select className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)} required>
              <option value="">— Select type —</option>
              {types.data?.map((t: any) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {selectedType && <ScopeHint scope={scope} />}
          </div>

          {/* Linkage — scope-driven */}
          {typeId && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-4">
              <div className="text-xs uppercase tracking-wide font-semibold text-slate-500">Link this document</div>

              {(scope === 'plant' || scope === 'plant_sensor' || scope === 'plant_with_sensor_refs') && (
                <div>
                  <label className="label">Plant <span className="text-red-500">*</span></label>
                  {recentPlantIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {recentPlantIds.map((pid) => {
                        const p = labelOf(plants.data, pid);
                        if (!p) return null;
                        const active = plantId === pid;
                        return (
                          <button type="button" key={pid} onClick={() => { setPlantId(pid); setEquipmentId(''); }}
                            className={`rounded-full px-3 py-1 text-xs font-medium border transition ${active ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-200 hover:border-brand-700 hover:text-brand-700'}`}>
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <select className="input" value={plantId} onChange={(e) => { setPlantId(e.target.value); setEquipmentId(''); }} required>
                    <option value="">— Select plant —</option>
                    {plants.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {scope === 'plant_sensor' && plantId && (
                <div>
                  <label className="label">Equipment <span className="text-red-500">*</span></label>
                  <select className="input" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} required>
                    <option value="">— Select equipment —</option>
                    {equipment.data?.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  {(equipment.data ?? []).length === 0 && (
                    <div className="text-xs text-amber-700 mt-1.5">No equipment on this plant yet — add some from the plant page first.</div>
                  )}
                </div>
              )}

              {(scope === 'general' || scope === 'plant_sensor') && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="label mb-0">Sensor</span>
                    <button type="button" className="text-xs text-brand-700 font-medium hover:underline" onClick={() => setShowAddSensor(true)}>
                      + Can't find it? Add new sensor
                    </button>
                  </div>
                  {recentMakeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="text-xs text-slate-500 self-center mr-1">Recent makes:</span>
                      {recentMakeIds.map((mid) => {
                        const m = labelOf(makes.data, mid);
                        if (!m) return null;
                        const active = makeId === mid;
                        return (
                          <button type="button" key={mid} onClick={() => { setMakeId(mid); setSensorModelId(''); }}
                            className={`rounded-full px-3 py-1 text-xs font-medium border transition ${active ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-200 hover:border-brand-700 hover:text-brand-700'}`}>
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select className="input" value={makeId} onChange={(e) => { setMakeId(e.target.value); setSensorModelId(''); }}>
                      <option value="">— Select make —</option>
                      {makes.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select className="input" value={sensorModelId} onChange={(e) => setSensorModelId(e.target.value)} disabled={!makeId}>
                      <option value="">{makeId ? '— Select model —' : 'Pick a make first'}</option>
                      {models.data?.map((m: any) => <option key={m.id} value={m.id}>{m.model_no || m.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Vendor URL (optional)</label>
                <input className="input" value={vendorUrl} onChange={(e) => setVendorUrl(e.target.value)} placeholder="https://www.siemens.com/…" />
              </div>
            </div>
          )}

          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">{error}</div>}

          {/* Sticky footer */}
          <div className="flex items-center justify-end gap-3 pt-2 sticky bottom-0 bg-white -mx-7 px-7 -mb-6 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button
              type="submit"
              disabled={busy}
              className="group relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 text-white px-5 py-2.5 text-sm font-semibold shadow-sm hover:shadow-md hover:from-brand-600 transition disabled:opacity-60"
            >
              {busy ? (<><span className="animate-spin">⟳</span> Uploading…</>) : (<>⬆ Upload document</>)}
            </button>
          </div>

          {status && (
            <div className="text-sm">
              <div className="h-1.5 bg-slate-100 rounded-full mb-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all" style={{ width: `${progress}%` }} />
              </div>
              {status}
            </div>
          )}
        </form>
      </div>

      {showAddSensor && (
        <AddSensorModal
          onClose={() => setShowAddSensor(false)}
          defaultMakeName={makes.data?.find((m: any) => m.id === makeId)?.name}
          onCreated={(newId) => {
            // we don't know the make_id directly; refetch and pick the new model
            qc.invalidateQueries({ queryKey: ['makes'] });
            qc.invalidateQueries({ queryKey: ['models-by-make'] });
            setSensorModelId(newId);
          }}
        />
      )}
    </div>
  );
}

function ScopeHint({ scope }: { scope: DocumentScope }) {
  const text = {
    general: 'General document. Link a sensor model — it will show up under that sensor and any plant that installs it.',
    plant: 'Plant-specific document. Will be linked to a single plant.',
    plant_sensor: 'Sensor-on-equipment document (e.g. calibration / test certificate). Pick plant, equipment, and sensor model.',
    plant_with_sensor_refs: 'Plant document that references sensors. Sensors are discoverable via the document text.',
  }[scope];
  return <div className="text-xs text-slate-500 mt-2">{text}</div>;
}

function distinct<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of arr) { if (v && !seen.has(v)) { seen.add(v); out.push(v); } }
  return out;
}
