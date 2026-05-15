import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth, canUpload } from '../lib/auth';
import PageHeader from '../components/PageHeader';
import AddSensorModal from '../components/AddSensorModal';

const PAGE_SIZE = 24;

export default function SensorModelList() {
  const { profile } = useAuth();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);

  const cats = useQuery({ queryKey: ['cats'], queryFn: async () => (await supabase.from('sensor_categories').select('id,name').order('name')).data ?? [] });
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });

  const models = useQuery({
    queryKey: ['sensor-models', cat, makeId],
    queryFn: async () => {
      let qb = supabase
        .from('sensor_models')
        .select('id, model_no, name, sensor_makes(name), sensor_categories(name)')
        .order('model_no')
        .limit(2000);
      if (cat) qb = qb.eq('category_id', cat);
      if (makeId) qb = qb.eq('make_id', makeId);
      return (await qb).data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = models.data ?? [];
    if (modelId) list = list.filter((m: any) => m.id === modelId);
    if (needle) list = list.filter((m: any) => [m.model_no, m.name, m.sensor_makes?.name, m.sensor_categories?.name].filter(Boolean).some((s: string) => s.toLowerCase().includes(needle)));
    return list;
  }, [q, models.data, modelId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  function reset() { setQ(''); setCat(''); setMakeId(''); setModelId(''); setPage(0); }
  const hasFilter = q || cat || makeId || modelId;

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const m of visible as any[]) {
      const k = m.sensor_categories?.name || 'Uncategorised';
      (g[k] ??= []).push(m);
    }
    return g;
  }, [visible]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Sensor catalog"
        icon="🔧"
        subtitle={`${models.data?.length ?? 0} models across ${makes.data?.length ?? 0} makes`}
        stats={[
          { label: 'Total models', value: models.data?.length ?? 0 },
          { label: 'Filtered', value: filtered.length },
          { label: 'Makes', value: makes.data?.length ?? 0 },
        ]}
        action={canUpload(profile) && (
          <button onClick={() => setShowAdd(true)} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-4 py-2 font-semibold text-sm shadow-sm">
            + New sensor
          </button>
        )}
      />

      <div className="card space-y-4">
        <div>
          <label className="label">Search</label>
          <input className="input" placeholder="Make, model, or description…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}>
              <option value="">All categories</option>
              {cats.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Make</label>
            <select className="input" value={makeId} onChange={(e) => { setMakeId(e.target.value); setModelId(''); setPage(0); }}>
              <option value="">All makes</option>
              {makes.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Model</label>
            <select className="input" value={modelId} onChange={(e) => { setModelId(e.target.value); setPage(0); }} disabled={!makeId}>
              <option value="">{makeId ? 'All models' : 'Pick a make first'}</option>
              {(models.data ?? []).map((m: any) => (
                <option key={m.id} value={m.id}>{m.model_no || m.name}</option>
              ))}
            </select>
          </div>
        </div>
        {hasFilter && <button onClick={reset} className="btn-ghost btn-sm">Clear filters</button>}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="card text-sm text-slate-500 text-center">No models match.</div>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-500">{category}</h2>
            <span className="muted text-xs">{items.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((m: any) => (
              <Link to={`/sensors/${m.id}`} key={m.id} className="card-tight hover:border-brand-700 hover:shadow-md transition group">
                <div className="flex items-start gap-3">
                  <div className="bg-brand-50 text-brand-700 rounded-lg w-10 h-10 flex items-center justify-center shrink-0 group-hover:bg-brand-700 group-hover:text-white transition">🔧</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500">{m.sensor_makes?.name ?? '—'}</div>
                    <div className="font-semibold text-slate-900 truncate">{m.model_no || m.name || 'Untitled'}</div>
                    {m.name && m.model_no && <div className="text-xs text-slate-500 truncate mt-0.5">{m.name}</div>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="muted">Page {page + 1} of {pageCount}</div>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
            <button className="btn-secondary btn-sm" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        </div>
      )}

      {showAdd && <AddSensorModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
