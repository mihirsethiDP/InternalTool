import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { runSearch } from '../lib/search';
import { DocCard } from '../components/DocCard';

export default function Browse() {
  const [plant, setPlant] = useState('');
  const [category, setCategory] = useState('');
  const [make, setMake] = useState('');
  const [type, setType] = useState('');

  const plants = useQuery({ queryKey: ['plants'], queryFn: async () => (await supabase.from('plants').select('id,name').order('name')).data ?? [] });
  const cats = useQuery({ queryKey: ['cats'], queryFn: async () => (await supabase.from('sensor_categories').select('id,name').order('name')).data ?? [] });
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });
  const types = useQuery({ queryKey: ['types'], queryFn: async () => (await supabase.from('document_types').select('id,key,label').order('sort_order')).data ?? [] });

  const results = useQuery({
    queryKey: ['browse', plant, category, make, type],
    queryFn: () =>
      runSearch('', {
        plant_id: plant || undefined,
        category_id: category || undefined,
        make_id: make || undefined,
        type_key: type || undefined,
      }),
    enabled: Boolean(plant || category || make || type),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Browse documents</h1>
      <div className="card grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="label">Plant</label>
          <select className="input" value={plant} onChange={(e) => setPlant(e.target.value)}>
            <option value="">All</option>
            {plants.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Sensor category</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            {cats.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Make</label>
          <select className="input" value={make} onChange={(e) => setMake(e.target.value)}>
            <option value="">All</option>
            {makes.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Document type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            {types.data?.map((t: any) => <option key={t.id} value={t.key}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {results.data && (
        <div className="space-y-3">
          <div className="text-sm text-slate-600">{results.data.hits.length} result(s)</div>
          {results.data.hits.map((h) => <DocCard key={h.document_id + (h.page_number ?? '')} hit={h} />)}
        </div>
      )}
      {!plant && !category && !make && !type && (
        <div className="card text-sm text-slate-500">Pick at least one filter to see documents.</div>
      )}
    </div>
  );
}
