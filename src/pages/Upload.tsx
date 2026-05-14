import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth, canUpload } from '../lib/auth';
import { extractPdfText, chunkPage } from '../lib/pdf';

export default function Upload() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [typeId, setTypeId] = useState('');
  const [plantId, setPlantId] = useState('');
  const [sensorModelId, setSensorModelId] = useState('');
  const [plcId, setPlcId] = useState('');
  const [vendorUrl, setVendorUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showNewModel, setShowNewModel] = useState(false);
  const [showNewPlc, setShowNewPlc] = useState(false);

  const types = useQuery({ queryKey: ['types'], queryFn: async () => (await supabase.from('document_types').select('*').order('sort_order')).data ?? [] });
  const plants = useQuery({ queryKey: ['plants'], queryFn: async () => (await supabase.from('plants').select('id,name').order('name')).data ?? [] });
  const models = useQuery({ queryKey: ['models'], queryFn: async () => (await supabase.from('sensor_models').select('id, model_no, sensor_makes(name), sensor_categories(name)').order('model_no').limit(2000)).data ?? [] });
  const plcs = useQuery({ queryKey: ['plcs'], queryFn: async () => (await supabase.from('plcs').select('id, make, model_no').order('model_no')).data ?? [] });

  useEffect(() => { if (!title && file) setTitle(file.name.replace(/\.[^.]+$/, '')); }, [file]); // eslint-disable-line

  if (!canUpload(profile)) {
    return (
      <div className="card text-sm">
        <h1 className="page-title mb-2">Upload</h1>
        Your account doesn&rsquo;t have upload permission. Ask an admin to grant access.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !typeId) { setStatus('Pick a file and a document type.'); return; }
    setBusy(true);
    setStatus('Uploading file…');
    setProgress(10);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `${Date.now()}_${safeName}`;
    const up = await supabase.storage.from('documents').upload(storagePath, file, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    });
    if (up.error) { setBusy(false); setStatus('Upload failed: ' + up.error.message); return; }
    setProgress(40);
    setStatus('Creating document record…');

    const insert = await supabase
      .from('documents')
      .insert({
        title, type_id: typeId,
        plant_id: plantId || null,
        sensor_model_id: sensorModelId || null,
        plc_id: plcId || null,
        vendor_url: vendorUrl || null,
        storage_path: storagePath,
        size_bytes: file.size,
      })
      .select('id').single();
    if (insert.error || !insert.data) { setBusy(false); setStatus('DB insert failed: ' + (insert.error?.message ?? '?')); return; }
    const documentId = insert.data.id;
    setProgress(55);

    if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) {
      setStatus('Extracting PDF text…');
      try {
        const pages = await extractPdfText(file);
        await supabase.from('documents').update({ page_count: pages.length }).eq('id', documentId);
        setProgress(75);
        setStatus('Indexing chunks for search…');
        const chunks = pages.flatMap((p) => chunkPage(p.text, p.page));
        for (let i = 0; i < chunks.length; i += 50) {
          const batch = chunks.slice(i, i + 50).map((c) => ({
            document_id: documentId, page_number: c.page, chunk_text: c.text,
          }));
          const { error } = await supabase.from('document_chunks').insert(batch);
          if (error) { console.warn('chunk insert error', error); break; }
          setProgress(75 + Math.floor((i / chunks.length) * 20));
        }
      } catch (err: any) {
        console.warn('PDF extract failed', err);
        setStatus('PDF text extraction failed; document saved without search index.');
      }
    }

    setProgress(100);
    setStatus('✅ Uploaded! Search and Browse will now find it.');
    setFile(null); setTitle(''); setVendorUrl('');
    setBusy(false);
    qc.invalidateQueries({ queryKey: ['recent-docs'] });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Upload document</h1>
        <p className="muted mt-1">PDFs get their text extracted and indexed for full-text search.</p>
      </div>

      <form onSubmit={submit} className="card space-y-5">
        {/* File + title group */}
        <div className="space-y-4">
          <div>
            <label className="label">File (PDF preferred)</label>
            <input className="input" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brotek UT-116 Installation Manual" required />
          </div>
          <div>
            <label className="label">Document type</label>
            <select className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)} required>
              <option value="">— Select —</option>
              {types.data?.map((t: any) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <hr className="border-slate-200" />

        {/* Linkage group — proximity: all "what is this about" fields together */}
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-wide font-semibold text-slate-500">What is this document about?</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Plant (optional)</label>
              <select className="input" value={plantId} onChange={(e) => setPlantId(e.target.value)}>
                <option value="">—</option>
                {plants.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Sensor model (optional)</label>
                <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => setShowNewModel(!showNewModel)}>
                  {showNewModel ? 'Cancel' : '+ New'}
                </button>
              </div>
              <select className="input" value={sensorModelId} onChange={(e) => setSensorModelId(e.target.value)} disabled={showNewModel}>
                <option value="">—</option>
                {models.data?.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.sensor_makes?.name} {m.model_no} {m.sensor_categories?.name && `· ${m.sensor_categories.name}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">PLC (optional)</label>
                <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => setShowNewPlc(!showNewPlc)}>
                  {showNewPlc ? 'Cancel' : '+ New'}
                </button>
              </div>
              <select className="input" value={plcId} onChange={(e) => setPlcId(e.target.value)} disabled={showNewPlc}>
                <option value="">—</option>
                {plcs.data?.map((p: any) => <option key={p.id} value={p.id}>{p.make} {p.model_no}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Vendor URL (optional)</label>
              <input className="input" placeholder="https://www.siemens.com/…" value={vendorUrl} onChange={(e) => setVendorUrl(e.target.value)} />
            </div>
          </div>

          {showNewModel && (
            <NewSensorModelInline onCreated={(id) => { setSensorModelId(id); setShowNewModel(false); qc.invalidateQueries({ queryKey: ['models'] }); }} />
          )}
          {showNewPlc && (
            <NewPlcInline onCreated={(id) => { setPlcId(id); setShowNewPlc(false); qc.invalidateQueries({ queryKey: ['plcs'] }); }} />
          )}
        </div>

        <hr className="border-slate-200" />

        <div>
          <button className="btn-primary" disabled={busy}>{busy ? 'Working…' : 'Upload'}</button>
          {status && (
            <div className="text-sm mt-3">
              <div className="h-2 bg-slate-100 rounded mb-1.5 overflow-hidden">
                <div className="h-full bg-brand-700 transition-all" style={{ width: `${progress}%` }} />
              </div>
              {status}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function NewSensorModelInline({ onCreated }: { onCreated: (id: string) => void }) {
  const [makeName, setMakeName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [modelNo, setModelNo] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const cats = useQuery({ queryKey: ['cats'], queryFn: async () => (await supabase.from('sensor_categories').select('id,name').order('name')).data ?? [] });
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });

  async function create() {
    if (!makeName || !categoryId || !modelNo) {
      alert('Make, category and model number are required.');
      return;
    }
    setBusy(true);
    // Find or create make
    let { data: existingMake } = await supabase.from('sensor_makes').select('id').ilike('name', makeName.trim()).maybeSingle();
    let makeId = existingMake?.id;
    if (!makeId) {
      const { data: newMake, error } = await supabase.from('sensor_makes').insert({ name: makeName.trim() }).select('id').single();
      if (error) { setBusy(false); alert(error.message); return; }
      makeId = newMake.id;
    }
    const { data, error } = await supabase
      .from('sensor_models')
      .insert({ make_id: makeId, category_id: categoryId, model_no: modelNo.trim(), name: name.trim() || null })
      .select('id').single();
    setBusy(false);
    if (error) { alert(error.message); return; }
    onCreated(data.id);
  }

  return (
    <div className="rounded-lg bg-brand-50/40 border border-brand-100 p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide font-semibold text-brand-700">Create new sensor model</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Make</label>
          <input className="input" list="make-list" value={makeName} onChange={(e) => setMakeName(e.target.value)} placeholder="Brotek" />
          <datalist id="make-list">
            {makes.data?.map((m: any) => <option key={m.id} value={m.name} />)}
          </datalist>
          <div className="text-xs text-slate-500 mt-1">Pick from list or type a new one.</div>
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">—</option>
            {cats.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Model number</label>
          <input className="input" value={modelNo} onChange={(e) => setModelNo(e.target.value)} placeholder="UT-116" />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ultrasonic level transmitter" />
        </div>
      </div>
      <button type="button" onClick={create} className="btn-primary btn-sm" disabled={busy}>
        {busy ? 'Creating…' : 'Create model'}
      </button>
    </div>
  );
}

function NewPlcInline({ onCreated }: { onCreated: (id: string) => void }) {
  const [make, setMake] = useState('');
  const [modelNo, setModelNo] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!make || !modelNo) { alert('Make and model number are required.'); return; }
    setBusy(true);
    const { data, error } = await supabase.from('plcs').insert({ make: make.trim(), model_no: modelNo.trim() }).select('id').single();
    setBusy(false);
    if (error) { alert(error.message); return; }
    onCreated(data.id);
  }

  return (
    <div className="rounded-lg bg-brand-50/40 border border-brand-100 p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide font-semibold text-brand-700">Create new PLC</div>
      <div className="grid grid-cols-2 gap-3">
        <input className="input" placeholder="Make (Siemens)" value={make} onChange={(e) => setMake(e.target.value)} />
        <input className="input" placeholder="Model (S7-1200)" value={modelNo} onChange={(e) => setModelNo(e.target.value)} />
      </div>
      <button type="button" onClick={create} className="btn-primary btn-sm" disabled={busy}>
        {busy ? 'Creating…' : 'Create PLC'}
      </button>
    </div>
  );
}
