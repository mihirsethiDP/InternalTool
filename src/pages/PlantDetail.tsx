import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Zap, MapPin, Check, MessageSquare, AlertTriangle, ChevronDown, ChevronUp, Pencil, X, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, canUpload, isAdmin } from '../lib/auth';
import { usePlant, usePlantDevices, deviceLabel } from '../lib/plant';
import { coverageOf } from '../lib/consolidated';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import QueryError from '../components/QueryError';
import CategoryOptions from '../components/CategoryOptions';
import type { Plant, PlantDevice } from '../lib/types';

// One plant's device register: what is installed, how many, and whether we
// are sure. Every row can open the assistant already scoped to that device.
export default function PlantDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { plant: current, setPlant } = usePlant();
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const plant = useQuery({
    queryKey: ['plant', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('plants').select('id, name, code, client, status, location, notes, created_at').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as Plant | null;
    },
  });
  const devices = usePlantDevices(id);

  // Documentation coverage for the models on this plant (one query).
  const modelIds = useMemo(() => [...new Set((devices.data ?? []).map((d) => d.sensor_model_id))], [devices.data]);
  const coverage = useQuery({
    queryKey: ['plant-coverage', modelIds.join(',')],
    enabled: modelIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('consolidated_docs').select('id, sensor_model_id, content_markdown').in('sensor_model_id', modelIds).is('deleted_at', null);
      const m: Record<string, { docId: string; covered: number; total: number }> = {};
      for (const d of (data ?? []) as any[]) {
        const dom = (devices.data ?? []).find((x) => x.sensor_model_id === d.sensor_model_id)?.domain;
        const c = coverageOf(d.content_markdown, dom);
        m[d.sensor_model_id] = { docId: d.id, covered: c.covered, total: c.total };
      }
      return m;
    },
  });

  const grouped = useMemo(() => {
    const byDomain: Record<'sensor' | 'electronics', Map<string, PlantDevice[]>> = { sensor: new Map(), electronics: new Map() };
    for (const d of devices.data ?? []) {
      const g = byDomain[d.domain];
      (g.get(d.category_name) ?? g.set(d.category_name, []).get(d.category_name)!).push(d);
    }
    const sort = (m: Map<string, PlantDevice[]>) => [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return { sensor: sort(byDomain.sensor), electronics: sort(byDomain.electronics) };
  }, [devices.data]);

  const sensorCount = (devices.data ?? []).filter((d) => d.domain === 'sensor').reduce((a, d) => a + d.quantity, 0);
  const electronicsCount = (devices.data ?? []).filter((d) => d.domain === 'electronics').reduce((a, d) => a + d.quantity, 0);
  const assumed = (devices.data ?? []).filter((d) => d.is_assumption).length;
  const mine = current?.id === id;
  const p = plant.data;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['plant-devices', id] });
    qc.invalidateQueries({ queryKey: ['plant-device-totals'] });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[p?.client, p?.code].filter(Boolean).join(' · ') || 'Plant'}
        title={p?.name ?? '…'}
        subtitle={p?.status === 'discontinued' ? 'Site discontinued — kept for history.' : (p?.location || 'Device register for this site')}
        stats={[
          { label: 'Sensors', value: sensorCount.toLocaleString() },
          { label: 'Electronics', value: electronicsCount },
          { label: 'Make/model rows', value: devices.data?.length ?? 0 },
        ]}
        action={(
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isAdmin(profile) && p && (
              <button onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg px-3 py-2 text-sm font-medium transition"><Pencil size={14} /> Edit</button>
            )}
            {canUpload(profile) && (
              <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg px-3 py-2 text-sm font-medium transition">+ Add device</button>
            )}
            {id && (
              <button
                onClick={() => setPlant(mine ? null : id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm transition ${mine ? 'bg-emerald-400 text-emerald-950' : 'bg-white text-brand-700 hover:bg-slate-100'}`}
              >
                {mine ? <><Check size={15} /> Your plant</> : <><MapPin size={15} /> I'm at this plant</>}
              </button>
            )}
          </div>
        )}
      />

      {plant.error && <QueryError what="this plant" error={plant.error} onRetry={() => plant.refetch()} />}
      {plant.isSuccess && !p && <div className="card text-sm text-slate-500">Plant not found.</div>}

      {editing && p && <EditPlantForm plant={p} onClose={() => setEditing(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['plant', id] }); qc.invalidateQueries({ queryKey: ['plant-list'] }); qc.invalidateQueries({ queryKey: ['plants-active'] }); setEditing(false); }} />}
      {adding && id && <AddDeviceForm plantId={id} onClose={() => setAdding(false)} onSaved={() => { invalidate(); setAdding(false); toast.success('Device added to the register'); }} />}

      {assumed > 0 && (
        <div className="flex items-start gap-2.5 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div><strong>{assumed}</strong> {assumed === 1 ? 'entry is' : 'entries are'} a working assumption (fleet-commonest make, not read off the nameplate). The assistant says so when it uses them. Confirm on site and untick the flag.</div>
        </div>
      )}

      {devices.error && <QueryError what="the device register" error={devices.error} onRetry={() => devices.refetch()} />}
      {devices.isLoading && <div className="muted">Loading register…</div>}
      {devices.isSuccess && devices.data.length === 0 && (
        <div className="card text-sm text-slate-500 text-center">No devices on record for this plant yet.{canUpload(profile) && ' Use "Add device" to start the register.'}</div>
      )}

      {(['sensor', 'electronics'] as const).map((dom) => grouped[dom].length > 0 && (
        <section key={dom} className="space-y-4">
          <div className="flex items-center gap-2">
            {dom === 'sensor' ? <Cpu size={16} className="text-brand-700" /> : <Zap size={16} className="text-brand-700" />}
            <h2 className="section-title mb-0">{dom === 'sensor' ? 'Sensors' : 'Electronics'}</h2>
          </div>
          {grouped[dom].map(([category, rows]) => (
            <div key={category}>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500">{category}</h3>
                <span className="muted text-xs">{rows.length > 1 ? `${rows.length} makes` : ''}</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {rows.map((d) => (
                  <DeviceRow key={d.id} d={d} plant={p} cov={coverage.data?.[d.sensor_model_id]} canEdit={canUpload(profile)} onChanged={invalidate} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function DeviceRow({ d, plant, cov, canEdit, onChanged }: { d: PlantDevice; plant: Plant | null | undefined; cov?: { docId: string; covered: number; total: number }; canEdit: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [more, setMore] = useState(false);
  const [edit, setEdit] = useState(false);
  const [qty, setQty] = useState(String(d.quantity));
  const [notes, setNotes] = useState(d.notes ?? '');
  const [assumed, setAssumed] = useState(d.is_assumption);
  const [busy, setBusy] = useState(false);

  function ask() {
    window.dispatchEvent(new CustomEvent('dp:open-chat', {
      detail: { scope: { modelId: d.sensor_model_id, categoryId: d.category_id, label: deviceLabel(d), note: plant ? `${plant.name} · ${d.category_name}: ${deviceLabel(d)}${d.is_assumption ? ' (working assumption — check the nameplate)' : ''}` : undefined } },
    }));
  }
  async function save() {
    setBusy(true);
    const { error } = await supabase.from('plant_sensors').update({ quantity: Math.max(0, Number(qty) || 0), notes: notes.trim() || null, is_assumption: assumed, updated_at: new Date().toISOString() }).eq('id', d.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Register updated'); setEdit(false); onChanged();
  }
  async function remove() {
    if (!confirm(`Remove ${deviceLabel(d)} from ${plant?.name ?? 'this plant'}?`)) return;
    const { error } = await supabase.from('plant_sensors').delete().eq('id', d.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Removed from the register'); onChanged();
  }

  return (
    <div className="card-tight">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/sensors/${d.sensor_model_id}`} className="font-semibold text-slate-900 hover:text-brand-700 transition truncate">{deviceLabel(d)}</Link>
            <span className="badge">× {d.quantity}</span>
            {d.is_assumption && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"><AlertTriangle size={11} /> Assumed</span>}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
            {cov
              ? <Link to={`/consolidated/${cov.docId}`} className={`inline-flex items-center gap-1 hover:underline ${cov.covered === cov.total ? 'text-emerald-700' : 'text-amber-700'}`}><FileText size={12} /> Docs {cov.covered}/{cov.total}</Link>
              : <span className="inline-flex items-center gap-1 text-slate-400"><FileText size={12} /> No documentation yet</span>}
            {d.tags.length > 0 && <span className="font-mono text-[11px] truncate max-w-[18rem]" title={d.tags.join(', ')}>{d.tags.slice(0, 2).join(', ')}{d.tags.length > 2 ? ` +${d.tags.length - 2}` : ''}</span>}
            <span className="text-slate-400">{d.source === 'register' ? 'from register' : d.source === 'rule' ? 'by site rule' : 'added by hand'}</span>
          </div>
          {d.notes && (
            <button onClick={() => setMore((v) => !v)} className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
              {more ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Notes
            </button>
          )}
          {more && d.notes && <p className="mt-1.5 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-md px-2.5 py-2">{d.notes}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={ask} className="tap inline-flex items-center gap-1.5 rounded-md bg-brand-700 hover:bg-brand-800 text-white px-2.5 py-1.5 text-xs font-medium transition" title="Ask Dr. Paani about this device">
            <MessageSquare size={13} /> Ask
          </button>
          {canEdit && (
            <button onClick={() => setEdit((v) => !v)} aria-label="Edit" className="tap rounded-md w-8 h-8 inline-flex items-center justify-center text-slate-400 hover:text-brand-700 hover:bg-brand-50 transition"><Pencil size={14} /></button>
          )}
        </div>
      </div>
      {edit && (
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-[6rem_1fr] gap-3">
          <div>
            <label className="label">Quantity</label>
            <input className="input" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[4.5rem]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Location on plant, exceptions, who confirmed it…" />
          </div>
          <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={assumed} onChange={(e) => setAssumed(e.target.checked)} className="rounded border-slate-300" />
            Working assumption (not confirmed on the nameplate)
          </label>
          <div className="sm:col-span-2 flex items-center justify-between">
            <button onClick={remove} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"><X size={12} /> Remove from plant</button>
            <div className="flex gap-2">
              <button onClick={() => setEdit(false)} className="btn-ghost btn-sm">Cancel</button>
              <button onClick={save} disabled={busy} className="btn-primary btn-sm">{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddDeviceForm({ plantId, onClose, onSaved }: { plantId: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [categoryId, setCategoryId] = useState('');
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [assumed, setAssumed] = useState(false);
  const [busy, setBusy] = useState(false);

  const cats = useQuery({ queryKey: ['cats-domain'], queryFn: async () => (await supabase.from('sensor_categories').select('id,name,domain').order('name')).data ?? [] });
  const models = useQuery({
    queryKey: ['models-in-category', categoryId],
    enabled: Boolean(categoryId),
    queryFn: async () => (await supabase.from('sensor_models').select('id, model_no, name, make_id, sensor_makes(id, name)').eq('category_id', categoryId).eq('is_general', false).order('model_no')).data ?? [],
  });
  const makes = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of (models.data ?? []) as any[]) { const mk = Array.isArray(r.sensor_makes) ? r.sensor_makes[0] : r.sensor_makes; if (mk) m.set(mk.id, mk.name); }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [models.data]);
  const modelsForMake = ((models.data ?? []) as any[]).filter((r) => !makeId || r.make_id === makeId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) return;
    setBusy(true);
    const { error } = await supabase.from('plant_sensors').insert({ plant_id: plantId, sensor_model_id: modelId, category_id: categoryId, quantity: Math.max(0, Number(qty) || 0), notes: notes.trim() || null, source: 'manual', is_assumption: assumed });
    setBusy(false);
    if (error) { toast.error(error.code === '23505' ? 'That make/model is already on this plant — edit its quantity instead.' : error.message); return; }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide font-semibold text-slate-500">Add a device to this plant</div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="label">Category</label>
          <select className="input" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setMakeId(''); setModelId(''); }} required>
            <option value="">— Select —</option>
            <CategoryOptions categories={cats.data as any} />
          </select>
        </div>
        <div>
          <label className="label">Make</label>
          <select className="input" value={makeId} onChange={(e) => { setMakeId(e.target.value); setModelId(''); }} disabled={!categoryId}>
            <option value="">{categoryId ? (makes.length ? 'Any make' : 'No models in this category yet') : 'Pick a category first'}</option>
            {makes.map(([mid, name]) => <option key={mid} value={mid}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Model</label>
          <select className="input" value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={!categoryId} required>
            <option value="">— Select —</option>
            {modelsForMake.map((r: any) => { const mk = Array.isArray(r.sensor_makes) ? r.sensor_makes[0] : r.sensor_makes; return <option key={r.id} value={r.id}>{makeId ? '' : `${mk?.name ?? ''} `}{r.model_no || r.name}</option>; })}
          </select>
          <div className="text-xs text-slate-500 mt-1">Not listed? Add the make/model under <Link to="/sensors" className="text-brand-700 hover:underline">Devices</Link> first.</div>
        </div>
        <div>
          <label className="label">Quantity</label>
          <input className="input" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Notes (optional)</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Location on plant, tag numbers, who confirmed it…" />
        </div>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={assumed} onChange={(e) => setAssumed(e.target.checked)} className="rounded border-slate-300" />
        Working assumption — not yet confirmed on the nameplate
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        <button className="btn-primary" disabled={busy || !modelId}>{busy ? 'Adding…' : 'Add to register'}</button>
      </div>
    </form>
  );
}

function EditPlantForm({ plant, onClose, onSaved }: { plant: Plant; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(plant.name);
  const [code, setCode] = useState(plant.code ?? '');
  const [client, setClient] = useState(plant.client ?? '');
  const [location, setLocation] = useState(plant.location ?? '');
  const [status, setStatus] = useState<'active' | 'discontinued'>(plant.status ?? 'active');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('plants').update({ name: name.trim(), code: code.trim().toUpperCase() || null, client: client.trim() || null, location: location.trim() || null, status, updated_at: new Date().toISOString() }).eq('id', plant.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Plant updated'); onSaved();
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-3">Edit plant</div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-2"><label className="label">Name</label><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Site code</label><input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} /></div>
        <div><label className="label">Client</label><input className="input" value={client} onChange={(e) => setClient(e.target.value)} /></div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="active">Active</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>
        <div className="md:col-span-5"><label className="label">Location</label><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        <button className="btn-primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}
