import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { extractPdfText, chunkPage } from '../lib/pdf';
import type { DocumentScope } from '../lib/types';

interface UploadDefaults {
  plant_id?: string;
  equipment_id?: string;
  sensor_model_id?: string;
  type_key?: string;
}
interface Ctx {
  open: (defaults?: UploadDefaults) => void;
}
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

function UploadModalInner({ defaults, onClose }: { defaults: UploadDefaults; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [typeId, setTypeId] = useState('');
  const [plantId, setPlantId] = useState(defaults.plant_id ?? '');
  const [equipmentId, setEquipmentId] = useState(defaults.equipment_id ?? '');
  const [sensorModelId, setSensorModelId] = useState(defaults.sensor_model_id ?? '');
  const [makeId, setMakeId] = useState('');
  const [vendorUrl, setVendorUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const types = useQuery({ queryKey: ['types'], queryFn: async () => (await supabase.from('document_types').select('*').order('sort_order')).data ?? [] });
  const plants = useQuery({ queryKey: ['plants'], queryFn: async () => (await supabase.from('plants').select('id,name').order('name')).data ?? [] });
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });

  const models = useQuery({
    queryKey: ['models-by-make', makeId],
    queryFn: async () => {
      let q = supabase.from('sensor_models').select('id, model_no, name').order('model_no').limit(500);
      if (makeId) q = q.eq('make_id', makeId);
      return (await q).data ?? [];
    },
    enabled: true,
  });

  const equipment = useQuery({
    queryKey: ['equipment', plantId],
    queryFn: async () => plantId ? ((await supabase.from('equipment').select('id,name').eq('plant_id', plantId).order('name')).data ?? []) : [],
    enabled: Boolean(plantId),
  });

  const selectedType = types.data?.find((t: any) => t.id === typeId);
  const scope: DocumentScope = (selectedType?.scope ?? 'general') as DocumentScope;

  // Preselect type from defaults
  useEffect(() => {
    if (defaults.type_key && types.data) {
      const t = types.data.find((x: any) => x.key === defaults.type_key);
      if (t) setTypeId(t.id);
    }
  }, [defaults.type_key, types.data]);

  useEffect(() => {
    if (!title && file) setTitle(file.name.replace(/\.[^.]+$/, ''));
  }, [file]); // eslint-disable-line

  // When scope is plant-only, clear sensor selection. When scope is general, clear plant/equipment.
  useEffect(() => {
    if (scope === 'plant' || scope === 'plant_with_sensor_refs') {
      setMakeId(''); setSensorModelId('');
    }
    if (scope === 'general') {
      setPlantId(''); setEquipmentId('');
    }
  }, [scope]); // eslint-disable-line

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
    if (err) { setStatus(err); return; }
    if (!file) return;
    setBusy(true); setProgress(10); setStatus('Uploading file…');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `${Date.now()}_${safeName}`;
    const up = await supabase.storage.from('documents').upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (up.error) { setBusy(false); setStatus('Upload failed: ' + up.error.message); return; }
    setProgress(40); setStatus('Creating document record…');

    const insert = await supabase.from('documents').insert({
      title,
      type_id: typeId,
      plant_id: plantId || null,
      equipment_id: equipmentId || null,
      sensor_model_id: sensorModelId || null,
      vendor_url: vendorUrl || null,
      storage_path: storagePath,
      size_bytes: file.size,
    }).select('id').single();
    if (insert.error || !insert.data) {
      setBusy(false); setStatus('DB insert failed: ' + (insert.error?.message ?? '?')); return;
    }
    const documentId = insert.data.id;
    setProgress(55);

    // PDF text extraction (skip silently for non-PDFs)
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
      // For Word/Excel/images: index the title as a chunk so it's searchable.
      await supabase.from('document_chunks').insert({ document_id: documentId, page_number: null, chunk_text: title });
    }

    setProgress(100); setStatus('✅ Uploaded.');
    qc.invalidateQueries({ queryKey: ['recent-docs'] });
    qc.invalidateQueries({ queryKey: ['plant-docs'] });
    qc.invalidateQueries({ queryKey: ['browse'] });
    setBusy(false);
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <div className="text-lg font-bold">Upload document</div>
            <div className="text-xs text-slate-500">PDFs, Word, Excel, or images. PDF contents are full-text searchable.</div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-5">
          {/* Step 1: file + type */}
          <div className="space-y-4">
            <div>
              <label className="label">File</label>
              <input className="input" type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && <div className="text-xs text-slate-500 mt-1.5">{file.name} · {(file.size / 1024).toFixed(0)} KB</div>}
            </div>
            <div>
              <label className="label">Document type</label>
              <select className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)} required>
                <option value="">— Select type —</option>
                {types.data?.map((t: any) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {selectedType && <ScopeHint scope={scope} />}
            </div>
            <div>
              <label className="label">Title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brotek UT-116 Installation Manual" required />
            </div>
          </div>

          {/* Step 2: scope-driven linkage */}
          {typeId && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-4">
              <div className="text-xs uppercase tracking-wide font-semibold text-slate-500">Link this document</div>

              {(scope === 'plant' || scope === 'plant_sensor' || scope === 'plant_with_sensor_refs') && (
                <div>
                  <label className="label">Plant <span className="text-red-500">*</span></label>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Make {scope === 'general' && <span className="text-red-500">*</span>}</label>
                    <select className="input" value={makeId} onChange={(e) => { setMakeId(e.target.value); setSensorModelId(''); }}>
                      <option value="">— Select make —</option>
                      {makes.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Model {scope === 'general' && <span className="text-red-500">*</span>}</label>
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

          <div className="flex items-center justify-end gap-2 pt-2 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Working…' : 'Upload'}</button>
          </div>

          {status && (
            <div className="text-sm">
              <div className="h-2 bg-slate-100 rounded mb-1.5 overflow-hidden">
                <div className="h-full bg-brand-700 transition-all" style={{ width: `${progress}%` }} />
              </div>
              {status}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function ScopeHint({ scope }: { scope: DocumentScope }) {
  const text = {
    general: 'General document. Link a sensor model so it shows up in the catalog and any plant that installs it.',
    plant: 'Plant-specific document. Will be linked to one plant.',
    plant_sensor: 'Sensor-on-equipment document (e.g. calibration, test certificate). Pick the plant, the equipment it sits on, and the sensor model.',
    plant_with_sensor_refs: 'Plant document that references multiple sensors. Sensors will be discoverable via the document text.',
  }[scope];
  return <div className="text-xs text-slate-500 mt-1.5">{text}</div>;
}
