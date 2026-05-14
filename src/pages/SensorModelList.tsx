import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 25; // Miller's law: small, scannable chunks

export default function SensorModelList() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [make, setMake] = useState('');
  const [page, setPage] = useState(0);

  const cats = useQuery({
    queryKey: ['cats'],
    queryFn: async () => (await supabase.from('sensor_categories').select('id,name').order('name')).data ?? [],
  });
  const makes = useQuery({
    queryKey: ['makes'],
    queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [],
  });

  const models = useQuery({
    queryKey: ['sensor-models', cat, make],
    queryFn: async () => {
      let qb = supabase
        .from('sensor_models')
        .select('id, model_no, name, sensor_makes(name), sensor_categories(name)')
        .order('model_no')
        .limit(2000);
      if (cat) qb = qb.eq('category_id', cat);
      if (make) qb = qb.eq('make_id', make);
      return (await qb).data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return models.data ?? [];
    return (models.data ?? []).filter((m: any) =>
      [m.model_no, m.name, m.sensor_makes?.name, m.sensor_categories?.name]
        .filter(Boolean)
        .some((s: string) => s.toLowerCase().includes(needle))
    );
  }, [q, models.data]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function reset() { setQ(''); setCat(''); setMake(''); setPage(0); }
  const hasFilter = q || cat || make;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Sensor catalog</h1>
          <p className="muted mt-1">{filtered.length} model{filtered.length === 1 ? '' : 's'}{hasFilter && ' (filtered)'}</p>
        </div>
      </div>

      {/* Single grouped filter card — proximity & similarity */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Search</label>
            <input
              className="input"
              placeholder="Make, model, or name…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}>
              <option value="">All categories</option>
              {cats.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Make</label>
            <select className="input" value={make} onChange={(e) => { setMake(e.target.value); setPage(0); }}>
              <option value="">All makes</option>
              {makes.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        {hasFilter && (
          <div className="mt-3">
            <button onClick={reset} className="btn-ghost btn-sm">Clear filters</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Make</th>
              <th>Model</th>
              <th>Category</th>
              <th>Description</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m: any) => (
              <tr key={m.id}>
                <td className="font-medium text-slate-900">{m.sensor_makes?.name ?? '—'}</td>
                <td className="font-mono text-sm">{m.model_no || '—'}</td>
                <td><span className="badge">{m.sensor_categories?.name ?? '—'}</span></td>
                <td className="text-slate-600 max-w-md truncate">{m.name || '—'}</td>
                <td className="text-right">
                  <Link to={`/sensors/${m.id}`} className="text-brand-700 hover:underline text-sm font-medium">View →</Link>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-slate-500">No models match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="muted">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
            <span className="px-2 py-1.5 text-slate-600">Page {page + 1} / {pageCount}</span>
            <button className="btn-secondary btn-sm" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
