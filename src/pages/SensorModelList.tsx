import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function SensorModelList() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');

  const cats = useQuery({ queryKey: ['cats'], queryFn: async () => (await supabase.from('sensor_categories').select('id,name').order('name')).data ?? [] });

  const models = useQuery({
    queryKey: ['sensor-models', cat],
    queryFn: async () => {
      let q = supabase
        .from('sensor_models')
        .select('id, model_no, name, suitability, sensor_makes(name), sensor_categories(name)')
        .order('model_no')
        .limit(500);
      if (cat) q = q.eq('category_id', cat);
      return (await q).data ?? [];
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sensor catalog</h1>
      <div className="card grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Filter</label>
          <input className="input" placeholder="Search make/model/spec…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {cats.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr><th className="py-2 pr-3">Make</th><th className="pr-3">Model</th><th className="pr-3">Category</th><th>Suitability</th></tr>
          </thead>
          <tbody>
            {filtered.map((m: any) => (
              <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="py-2 pr-3">{m.sensor_makes?.name ?? '—'}</td>
                <td className="pr-3 font-mono">
                  <Link to={`/sensors/${m.id}`} className="text-brand-700 hover:underline">{m.model_no || m.name || m.id.slice(0, 8)}</Link>
                </td>
                <td className="pr-3">{m.sensor_categories?.name ?? '—'}</td>
                <td className="text-slate-600 text-xs">{(m.suitability ?? '').slice(0, 120)}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-500">No models match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
