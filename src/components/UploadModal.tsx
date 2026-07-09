import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { extractPdfText, chunkPage } from '../lib/pdf';
import { classifyDoc, MISMATCH_CONFIDENCE } from '../lib/classify';
import AddSensorModal from './AddSensorModal';

interface UploadDefaults {
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
  const [sensorModelId, setSensorModelId] = useState(defaults.sensor_model_id ?? '');
  const [makeId, setMakeId] = useState('');
  const [scope, setScope] = useState<'model' | 'general'>('model');
  const [categoryId, setCategoryId] = useState('');
  const [vendorUrl, setVendorUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showAddSensor, setShowAddSensor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // AI association advisory: set when the doc content looks like a different
  // sensor than the one selected. ackRef lets "Submit anyway" bypass the recheck.
  const [mismatch, setMismatch] = useState<{ label: string; category: string | null; reason: string; confidence: number } | null>(null);
  const ackRef = useRef(false);
  // Extract on pick so the uploader can confirm the PDF was read (catches
  // scanned/image-only PDFs before they waste a review round), and so submit
  // reuses the text instead of extracting twice.
  const [extracted, setExtracted] = useState<{ text: string; pages: number } | null>(null);
  const [reading, setReading] = useState(false);

  // Only show "general" scope types in the dropdown (the sensor-tied ones):
  // Sensor Manual, Installation Guide, Troubleshooting Steps, Technical Data Sheet.
  const types = useQuery({
    queryKey: ['types-general'],
    queryFn: async () => (await supabase.from('document_types').select('*').eq('scope', 'general').order('sort_order')).data ?? [],
  });
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });
  const models = useQuery({
    queryKey: ['models-by-make', makeId],
    queryFn: async () => makeId ? ((await supabase.from('sensor_models').select('id, model_no, name').eq('make_id', makeId).eq('is_general', false).order('model_no')).data ?? []) : [],
    enabled: Boolean(makeId),
  });
  const categories = useQuery({ queryKey: ['cats'], queryFn: async () => (await supabase.from('sensor_categories').select('id,name').order('name')).data ?? [] });
  // Map category -> its synthetic "general" sensor_model id
  const generalModels = useQuery({
    queryKey: ['general-models'],
    queryFn: async () => (await supabase.from('sensor_models').select('id, category_id').eq('is_general', true)).data ?? [],
  });

  // Recent picks (type & make only — plants gone)
  const recent = useQuery({
    queryKey: ['recent-meta'],
    queryFn: async () => {
      const { data } = await supabase
        .from('documents')
        .select('type_id, sensor_models(make_id), uploaded_at')
        .order('uploaded_at', { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const recentTypeIds = useMemo(() => distinct((recent.data ?? []).map((d: any) => d.type_id)).slice(0, 3), [recent.data]);
  const recentMakeIds = useMemo(() => distinct((recent.data ?? []).map((d: any) => d.sensor_models?.make_id)).slice(0, 3), [recent.data]);
  const selectedType = types.data?.find((t: any) => t.id === typeId);

  useEffect(() => {
    if (defaults.type_key && types.data) {
      const t = types.data.find((x: any) => x.key === defaults.type_key);
      if (t) setTypeId(t.id);
    }
  }, [defaults.type_key, types.data]);

  useEffect(() => {
    if (!titleTouched && file) setTitle(file.name.replace(/\.[^.]+$/, ''));
  }, [file, titleTouched]);

  // If a default sensor_model_id is provided (from sensor detail page), preload its make
  useEffect(() => {
    if (defaults.sensor_model_id && !makeId) {
      (async () => {
        const { data } = await supabase.from('sensor_models').select('make_id').eq('id', defaults.sensor_model_id!).maybeSingle();
        if (data?.make_id) setMakeId(data.make_id);
      })();
    }
  }, [defaults.sensor_model_id]); // eslint-disable-line

  function pickFile(f: File | null) {
    setFile(f); setError(null); setExtracted(null);
    if (f && (/\.pdf$/i.test(f.name) || /pdf/i.test(f.type))) {
      setReading(true);
      extractPdfText(f)
        .then((pages) => setExtracted({ text: pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n'), pages: pages.length }))
        // On a hard failure leave `extracted` null so submit() retries fresh —
        // never store empty text from a transient parse error.
        .catch((e) => { console.warn('pdf extract failed', e); setExtracted(null); })
        .finally(() => setReading(false));
    }
  }
  function onDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f); }

  // Resolve the sensor_model_id the submission attaches to.
  const generalModelId = scope === 'general'
    ? (generalModels.data ?? []).find((g: any) => g.category_id === categoryId)?.id
    : null;
  const resolvedModelId = scope === 'general' ? generalModelId : sensorModelId;

  // Duplicate hint: is there already a submission of this type for this sensor?
  const dupHint = useQuery({
    queryKey: ['dup-hint', resolvedModelId, typeId],
    enabled: Boolean(resolvedModelId && typeId),
    queryFn: async () => {
      const { data } = await supabase
        .from('document_submissions')
        .select('id, title, status')
        .eq('sensor_model_id', resolvedModelId)
        .eq('type_id', typeId)
        .is('deleted_at', null)
        .in('status', ['pending', 'approved'])
        .limit(1);
      return (data ?? [])[0] ?? null;
    },
  });

  // Plain-text length of the extracted PDF (page markers stripped) — used to
  // warn when almost nothing was read (scanned/image-only PDF).
  const extractedChars = extracted ? extracted.text.replace(/\[Page \d+\]/g, '').replace(/\s+/g, ' ').trim().length : 0;

  function valid(): string | null {
    if (!file) return 'Choose a file.';
    if (!typeId) return 'Pick a document type.';
    if (scope === 'general') {
      if (!categoryId) return 'Pick the sensor category this general guidance applies to.';
      if (!generalModelId) return 'No general entry exists for that category yet — run migration 022.';
    } else if (!sensorModelId) {
      return 'Pick the sensor (make + model) this document is for.';
    }
    return null;
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const err = valid();
    if (err) { setError(err); return; }
    if (!file) return;
    setError(null); setMismatch(null); setBusy(true);

    // Extract PDF text up front — needed both for the AI association check and
    // to store on the submission for the checker.
    let extractedText = '';
    let pageCount: number | null = null;
    if (extracted) {
      // Already read when the file was picked — reuse it.
      extractedText = extracted.text; pageCount = extracted.pages || null;
    } else if (/\.pdf$/i.test(file.name) || /pdf/i.test(file.type)) {
      try {
        setStatus('Extracting PDF text…');
        const pages = await extractPdfText(file);
        pageCount = pages.length;
        extractedText = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');
      } catch (e: any) {
        console.warn('pdf extract failed', e);
      }
    }

    // AI association check (advisory): does the content match the chosen sensor?
    if (scope === 'model' && sensorModelId && extractedText && !ackRef.current) {
      setStatus('Checking the sensor match…');
      const c = await classifyDoc(extractedText, title);
      if (c && c.model_id !== sensorModelId && c.confidence >= MISMATCH_CONFIDENCE) {
        setMismatch({ label: c.model_label, category: c.category_label, reason: c.reason, confidence: c.confidence });
        setBusy(false); setStatus(null);
        return;
      }
    }

    setProgress(10); setStatus('Uploading file…');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `${Date.now()}_${safeName}`;
    const up = await supabase.storage.from('documents').upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (up.error) { setBusy(false); setError('Upload failed: ' + up.error.message); return; }
    setProgress(55); setStatus('Creating document record…');

    // Output work-type section is decided by the checker at approval — the
    // upload form no longer asks the maker to pre-suggest it (removed as a
    // redundant "document type"-like field).
    setStatus('Submitting for review…');
    const insert = await supabase.from('document_submissions').insert({
      title,
      type_id: typeId,
      sensor_model_id: resolvedModelId,
      storage_path: storagePath,
      vendor_url: vendorUrl || null,
      size_bytes: file.size,
      page_count: pageCount,
      extracted_text: extractedText || null,
      target_section: null,
    }).select('id').single();
    if (insert.error || !insert.data) {
      setBusy(false);
      setError('Submission failed: ' + (insert.error?.message ?? '?'));
      return;
    }
    // Notify all admins that a new submission has landed (best-effort, non-blocking)
    try {
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
      if (admins?.length) {
        await supabase.from('notifications').insert(
          admins.map((a: any) => ({
            recipient_id: a.id,
            kind: 'submission_created',
            submission_id: insert.data!.id,
            message: `New submission "${title}" awaiting review.`,
          }))
        );
      }
    } catch (e) { console.warn('notify admins failed', e); }

    setProgress(100);
    setStatus('✅ Submitted for review. You\'ll be notified when an admin approves or rejects it.');
    qc.invalidateQueries({ queryKey: ['my-submissions'] });
    qc.invalidateQueries({ queryKey: ['pending-submissions'] });
    setBusy(false);
    setTimeout(onClose, 1200);
  }

  function labelOf(coll: any[] | undefined, id: string) { return coll?.find((x: any) => x.id === id); }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[100dvh] sm:max-h-[92dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-7 pt-7 pb-5 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide mb-2">
              ⬆ New submission
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Submit a document for review</h2>
            <p className="text-sm text-slate-500 mt-1">Your submission goes to an admin for review. Once approved, it&rsquo;s merged into the sensor&rsquo;s consolidated reference.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="tap shrink-0 text-slate-400 hover:text-slate-700 text-2xl leading-none w-9 h-9 inline-flex items-center justify-center -mt-1 -mr-1">×</button>
        </div>

        <form onSubmit={submit} className="px-7 py-6 space-y-6">
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

          {/* Extraction preview — reassure the PDF was read, warn on scans */}
          {reading && (
            <div className="text-xs text-slate-500 animate-pulse">Reading the document…</div>
          )}
          {!reading && extracted && extractedChars >= 120 && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              ✓ Read {extractedChars.toLocaleString()} characters from {extracted.pages} page{extracted.pages === 1 ? '' : 's'} — looks good.
            </div>
          )}
          {!reading && extracted && extractedChars < 120 && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠ Barely any text could be read — this looks like a <b>scanned / image-only PDF</b>. Dr. Paani reads text, not pictures; a text-based PDF gives far better answers. You can still submit it.
            </div>
          )}

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
            {dupHint.data && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                ⚠ A <b>{selectedType?.label ?? 'document'}</b> for this sensor already exists ({dupHint.data.status}). Make sure this isn't a duplicate — or pick a different type.
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs uppercase tracking-wide font-semibold text-slate-500">What does this apply to?</div>
              {scope === 'model' && (
                <button type="button" className="text-xs text-brand-700 font-medium hover:underline" onClick={() => setShowAddSensor(true)}>
                  + Can't find it? Add new sensor
                </button>
              )}
            </div>

            {/* Scope toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white">
              <button type="button" onClick={() => setScope('model')}
                className={`px-3 py-1.5 text-xs font-medium transition ${scope === 'model' ? 'bg-brand-700 text-white' : 'text-slate-600 hover:text-brand-700'}`}>
                A specific model
              </button>
              <button type="button" onClick={() => setScope('general')}
                className={`px-3 py-1.5 text-xs font-medium transition border-l border-slate-200 ${scope === 'general' ? 'bg-brand-700 text-white' : 'text-slate-600 hover:text-brand-700'}`}>
                All sensors of a category (general)
              </button>
            </div>

            {scope === 'general' ? (
              <div>
                <label className="label">Sensor category <span className="text-red-500">*</span></label>
                <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                  <option value="">— Select category —</option>
                  {categories.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="text-xs text-slate-500 mt-1.5">This guidance will show on every sensor in the category, alongside model-specific content.</div>
              </div>
            ) : (
              <>
                {recentMakeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
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
                  <div>
                    <label className="label">Make <span className="text-red-500">*</span></label>
                    <select className="input" value={makeId} onChange={(e) => { setMakeId(e.target.value); setSensorModelId(''); }}>
                      <option value="">— Select make —</option>
                      {makes.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Model <span className="text-red-500">*</span></label>
                    <select className="input" value={sensorModelId} onChange={(e) => setSensorModelId(e.target.value)} disabled={!makeId}>
                      <option value="">{makeId ? '— Select model —' : 'Pick a make first'}</option>
                      {models.data?.map((m: any) => <option key={m.id} value={m.id}>{m.model_no || m.name}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="label">Vendor URL (optional)</label>
              <input className="input" value={vendorUrl} onChange={(e) => setVendorUrl(e.target.value)} placeholder="https://www.vendor.com/sensor-model" />
            </div>
          </div>

          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">{error}</div>}

          {mismatch && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3 space-y-2">
              <div className="font-medium">⚠ This document looks like a different sensor</div>
              <div>
                The content reads like <strong>{mismatch.label}</strong>
                {mismatch.category && <> ({mismatch.category})</>}, not the sensor you selected.
              </div>
              {mismatch.reason && <div className="text-xs italic">“{mismatch.reason}”</div>}
              <div className="text-xs">Pick the correct make &amp; model above — or submit anyway if you’re sure.</div>
              <div className="flex gap-2 pt-0.5">
                <button type="button" onClick={() => setMismatch(null)} className="btn-secondary btn-sm">Let me fix it</button>
                <button type="button" onClick={() => { ackRef.current = true; setMismatch(null); submit(); }} className="btn btn-sm bg-amber-600 text-white hover:bg-amber-700">Submit anyway</button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 sticky bottom-0 bg-white -mx-7 px-7 -mb-6 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button
              type="submit"
              disabled={busy || reading}
              className="group relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 text-white px-5 py-2.5 text-sm font-semibold shadow-sm hover:shadow-md hover:from-brand-600 transition disabled:opacity-60"
            >
              {busy ? (<><span className="animate-spin">⟳</span> Submitting…</>) : reading ? (<>Reading document…</>) : (<>⬆ Submit for review</>)}
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
            qc.invalidateQueries({ queryKey: ['makes'] });
            qc.invalidateQueries({ queryKey: ['models-by-make'] });
            setSensorModelId(newId);
          }}
        />
      )}
    </div>
  );
}

function distinct<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of arr) { if (v && !seen.has(v)) { seen.add(v); out.push(v); } }
  return out;
}
