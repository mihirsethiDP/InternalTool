import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth, canUpload } from '../lib/auth';
import { extractPdfText, chunkPage } from '../lib/pdf';

export default function Upload() {
  const { profile } = useAuth();
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

  const types = useQuery({ queryKey: ['types'], queryFn: async () => (await supabase.from('document_types').select('*').order('sort_order')).data ?? [] });
  const plants = useQuery({ queryKey: ['plants'], queryFn: async () => (await supabase.from('plants').select('id,name').order('name')).data ?? [] });
  const models = useQuery({ queryKey: ['models'], queryFn: async () => (await supabase.from('sensor_models').select('id, model_no, sensor_makes(name)').order('model_no').limit(2000)).data ?? [] });
  const plcs = useQuery({ queryKey: ['plcs'], queryFn: async () => (await supabase.from('plcs').select('id, make, model_no').order('model_no')).data ?? [] });

  useEffect(() => {
    if (!title && file) setTitle(file.name.replace(/\.[^.]+$/, ''));
  }, [file]); // eslint-disable-line

  if (!canUpload(profile)) {
    return (
      <div className="card text-sm">
        <h1 className="text-xl font-bold mb-2">Upload</h1>
        Your account does not have upload permission. Ask an admin to grant access.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !typeId) {
      setStatus('Pick a file and a document type.');
      return;
    }
    setBusy(true);
    setStatus('Uploading file…');
    setProgress(10);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `${Date.now()}_${safeName}`;
    const up = await supabase.storage.from('documents').upload(storagePath, file, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    });
    if (up.error) {
      setBusy(false);
      setStatus('Upload failed: ' + up.error.message);
      return;
    }
    setProgress(40);
    setStatus('Creating document record…');

    const insert = await supabase
      .from('documents')
      .insert({
        title,
        type_id: typeId,
        plant_id: plantId || null,
        sensor_model_id: sensorModelId || null,
        plc_id: plcId || null,
        vendor_url: vendorUrl || null,
        storage_path: storagePath,
        size_bytes: file.size,
      })
      .select('id')
      .single();

    if (insert.error || !insert.data) {
      setBusy(false);
      setStatus('DB insert failed: ' + (insert.error?.message ?? '?'));
      return;
    }
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
        // batch insert in groups of 50
        for (let i = 0; i < chunks.length; i += 50) {
          const batch = chunks.slice(i, i + 50).map((c) => ({
            document_id: documentId,
            page_number: c.page,
            chunk_text: c.text,
          }));
          const { error } = await supabase.from('document_chunks').insert(batch);
          if (error) {
            console.warn('chunk insert error', error);
            break;
          }
          setProgress(75 + Math.floor((i / chunks.length) * 20));
        }
      } catch (err: any) {
        console.warn('PDF extract failed', err);
        setStatus('PDF text extraction failed; document saved without search index.');
      }
    }

    setProgress(100);
    setStatus('✅ Uploaded! You can upload another or view it from Search/Browse.');
    setFile(null);
    setTitle('');
    setVendorUrl('');
    setBusy(false);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">Upload document</h1>
      <form onSubmit={submit} className="card space-y-3">
        <div>
          <label className="label">File (PDF preferred)</label>
          <input className="input" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brotek UT-116 Installation Manual" required />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Document type *</label>
            <select className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)} required>
              <option value="">— Select —</option>
              {types.data?.map((t: any) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Plant (optional)</label>
            <select className="input" value={plantId} onChange={(e) => setPlantId(e.target.value)}>
              <option value="">—</option>
              {plants.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sensor model (optional)</label>
            <select className="input" value={sensorModelId} onChange={(e) => setSensorModelId(e.target.value)}>
              <option value="">—</option>
              {models.data?.map((m: any) => <option key={m.id} value={m.id}>{m.sensor_makes?.name} {m.model_no}</option>)}
            </select>
          </div>
          <div>
            <label className="label">PLC (optional)</label>
            <select className="input" value={plcId} onChange={(e) => setPlcId(e.target.value)}>
              <option value="">—</option>
              {plcs.data?.map((p: any) => <option key={p.id} value={p.id}>{p.make} {p.model_no}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Vendor URL (optional — link to manufacturer's source page)</label>
          <input className="input" placeholder="https://www.siemens.com/…" value={vendorUrl} onChange={(e) => setVendorUrl(e.target.value)} />
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? 'Working…' : 'Upload'}</button>
        {status && (
          <div className="text-sm">
            <div className="h-2 bg-slate-100 rounded mb-1 overflow-hidden">
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            {status}
          </div>
        )}
      </form>
    </div>
  );
}
