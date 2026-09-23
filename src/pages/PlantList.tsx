import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Factory, MapPin, Check, Cpu, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import { usePlant } from '../lib/plant';
import PageHeader from '../components/PageHeader';
import QueryError from '../components/QueryError';
import { FilterBar, FilterSearch, FilterSelect, FilterClear } from '../components/FilterBar';
import type { Plant } from '../lib/types';

// Every site, grouped by client. A plant card is a doorway to its device
// register; the pin sets it as "where I am" for the assistant.
export default function PlantList() {
  const { profile } = useAuth();
  const { plant: current, setPlant } = usePlant();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [client, setClient] = useState('');
  const [showDiscontinued, setShowDiscontinued] = useState(false);

  const plants = useQuery({
    queryKey: ['plant-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plants').select('id, name, code, client, status, location, notes, created_at').order('name');
      if (error) throw error;
      return (data ?? []) as Plant[];
    },
  });
  // Device totals per plant, split by domain, in one round trip.
  const totals = useQuery({
    queryKey: ['plant-device-totals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plant_sensors').select('plant_id, quantity, sensor_categories(domain)');
      if (error) throw error;
      const m: Record<string, { rows: number; sensors: number; electronics: number }> = {};
      for (const r of (data ?? []) as any[]) {
        const dom = (Array.isArray(r.sensor_categories) ? r.sensor_categories[0] : r.sensor_categories)?.domain === 'electronics' ? 'electronics' : 'sensors';
        const e = (m[r.plant_id] ??= { rows: 0, sensors: 0, electronics: 0 });
        e.rows += 1; e[dom] += r.quantity ?? 1;
      }
      return m;
    },
  });

  const clients = useMemo(() => [...new Set((plants.data ?? []).map((p) => p.client).filter(Boolean) as string[])].sort(), [plants.data]);

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (plants.data ?? []).filter((p) =>
      (showDiscontinued || p.status !== 'discontinued') &&
      (!client || p.client === client) &&
      (!n || p.name.toLowerCase().includes(n) || (p.code ?? '').toLowerCase().includes(n) || (p.client ?? '').toLowerCase().includes(n)));
  }, [plants.data, q, client, showDiscontinued]);

  // Group by client, biggest accounts first, singletons together at the end.
  const groups = useMemo(() => {
    const g = new Map<string, Plant[]>();
    for (const p of visible) { const k = p.client || p.name; (g.get(k) ?? g.set(k, []).get(k)!).push(p); }
    const multi = [...g.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    const single = [...g.entries()].filter(([, v]) => v.length === 1).flatMap(([, v]) => v).sort((a, b) => a.name.localeCompare(b.name));
    return { multi, single };
  }, [visible]);

  const active = (plants.data ?? []).filter((p) => p.status !== 'discontinued');
  const totalDevices = Object.values(totals.data ?? {}).reduce((a, t) => a + t.sensors + t.electronics, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sites"
        title="Plants"
        subtitle="Every site we operate, with the devices installed there. Pin the one you're at and the assistant answers for its exact make & model."
        stats={[
          { label: 'Active plants', value: active.length },
          { label: 'Clients', value: clients.length },
          { label: 'Devices on record', value: totalDevices.toLocaleString() },
        ]}
        action={isAdmin(profile) && !adding && (
          <button onClick={() => setAdding(true)} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-4 py-2 font-semibold text-sm shadow-sm">+ New plant</button>
        )}
      />

      {adding && <NewPlantForm onClose={() => setAdding(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ['plant-list'] }); qc.invalidateQueries({ queryKey: ['plants-active'] }); }} />}

      <FilterBar>
        <FilterSearch value={q} onChange={setQ} placeholder="Search plant, client or site code…" />
        <FilterSelect value={client} active={Boolean(client)} onChange={setClient}>
          <option value="">All clients</option>
          {clients.map((c) => <option key={c} value={c}>{c}</option>)}
        </FilterSelect>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 px-1">
          <input type="checkbox" checked={showDiscontinued} onChange={(e) => setShowDiscontinued(e.target.checked)} className="rounded border-slate-300" />
          Show discontinued
        </label>
        {(q || client || showDiscontinued) && <FilterClear onClick={() => { setQ(''); setClient(''); setShowDiscontinued(false); }} />}
      </FilterBar>

      {plants.error && <QueryError what="plants" error={plants.error} onRetry={() => plants.refetch()} />}
      {plants.isLoading && <div className="muted">Loading…</div>}

      {plants.isSuccess && visible.length === 0 && (
        <div className="card text-sm text-slate-500 text-center">
          {plants.data.length === 0
            ? <>No plants yet.{isAdmin(profile) && ' Import the plant register (scripts/plant-register) or click "New plant".'}</>
            : 'No plant matches those filters.'}
        </div>
      )}

      {groups.multi.map(([name, list]) => (
        <section key={name}>
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-500">{name}</h2>
            <span className="muted text-xs">{list.length} plants</span>
          </div>
          <PlantGrid list={list} totals={totals.data} currentId={current?.id} onPin={setPlant} />
        </section>
      ))}
      {groups.single.length > 0 && (
        <section>
          {groups.multi.length > 0 && (
            <div className="flex items-baseline justify-between mb-2.5">
              <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-500">Other sites</h2>
              <span className="muted text-xs">{groups.single.length}</span>
            </div>
          )}
          <PlantGrid list={groups.single} totals={totals.data} currentId={current?.id} onPin={setPlant} />
        </section>
      )}
    </div>
  );
}

function PlantGrid({ list, totals, currentId, onPin }: { list: Plant[]; totals?: Record<string, { rows: number; sensors: number; electronics: number }>; currentId?: string; onPin: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {list.map((p) => {
        const t = totals?.[p.id];
        const mine = p.id === currentId;
        return (
          <div key={p.id} className={`card-tight relative group transition ${mine ? 'border-brand-700 ring-1 ring-brand-700/20' : 'hover:border-brand-700'}`}>
            <Link to={`/plants/${p.id}`} className="flex items-start gap-3">
              <div className={`rounded-md w-10 h-10 flex items-center justify-center shrink-0 transition ${mine ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-700 group-hover:bg-brand-700 group-hover:text-white'}`}><Factory size={16} strokeWidth={2} /></div>
              <div className="min-w-0 flex-1 pr-8">
                <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                  {p.code && <span className="font-mono text-[11px] bg-slate-100 rounded px-1 py-0.5 mr-1.5">{p.code}</span>}
                  {p.status === 'discontinued' ? <span className="text-red-600 font-medium">Discontinued</span> : (p.location || p.client || '')}
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><Cpu size={11} /> {t ? t.sensors.toLocaleString() : '—'} sensors</span>
                  <span className="inline-flex items-center gap-1"><Zap size={11} /> {t ? t.electronics : '—'} electronics</span>
                </div>
              </div>
            </Link>
            <button
              onClick={() => onPin(p.id)}
              title={mine ? 'This is your current plant' : 'Set as my plant'}
              aria-label={mine ? 'Current plant' : `Set ${p.name} as my plant`}
              className={`absolute top-2.5 right-2.5 tap rounded-md w-8 h-8 inline-flex items-center justify-center transition ${mine ? 'text-brand-700 bg-brand-50' : 'text-slate-300 hover:text-brand-700 hover:bg-brand-50'}`}
            >
              {mine ? <Check size={15} /> : <MapPin size={15} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function NewPlantForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [client, setClient] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.from('plants').insert({ name: name.trim(), code: code.trim().toUpperCase() || null, client: client.trim() || null, location: location.trim() || null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onCreated(); onClose();
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-3">New plant</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="label">Plant name</label>
          <input className="input" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Amazon DEL-4" />
        </div>
        <div>
          <label className="label">Site code</label>
          <input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AMAD" maxLength={12} />
        </div>
        <div>
          <label className="label">Client</label>
          <input className="input" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Amazon" />
        </div>
        <div className="md:col-span-4">
          <label className="label">Location (optional)</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City / address" />
        </div>
      </div>
      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2 mt-3">{err}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        <button className="btn-primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Create plant'}</button>
      </div>
    </form>
  );
}
