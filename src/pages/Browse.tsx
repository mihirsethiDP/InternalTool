import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { runSearch } from '../lib/search';
import { DocCard } from '../components/DocCard';

// Doc types that imply "this is about a sensor" — make/model filters become useful.
const SENSOR_DOC_KEYS = new Set([
  'sensor_manual', 'installation_guide', 'troubleshooting', 'datasheet',
  'test_certificate', 'calibration_certificate', 'warranty_certificate',
]);

export default function Browse() {
  const [q, setQ] = useState('');
  const [plant, setPlant] = useState('');
  const [type, setType] = useState('');         // selected document_type.key
  const [category, setCategory] = useState(''); // sensor_category.id
  const [make, setMake] = useState('');         // sensor_makes.id
  const [model, setModel] = useState('');       // sensor_models.id

  // Independent reference data — each loaded once, no cascading dependencies.
  const plants = useQuery({ queryKey: ['plants'], queryFn: async () => (await supabase.from('plants').select('id,name').order('name')).data ?? [] });
  const cats = useQuery({ queryKey: ['cats'], queryFn: async () => (await supabase.from('sensor_categories').select('id,name').order('name')).data ?? [] });
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });
  const types = useQuery({ queryKey: ['types'], queryFn: async () => (await supabase.from('document_types').select('id,key,label,scope').order('sort_order')).data ?? [] });

  // Models list is only fetched when a make is picked (progressive disclosure).
  const models = useQuery({
    queryKey: ['models-by-make', make],
    queryFn: async () => make
      ? (await supabase.from('sensor_models').select('id, model_no, name').eq('make_id', make).order('model_no')).data ?? []
      : [],
    enabled: Boolean(make),
  });

  // Only show make/model when doc type implies sensors. (Progressive disclosure / Hick's law.)
  const showSensorFilters = useMemo(() => {
    if (!type) return true;            // no type chosen → show everything
    return SENSOR_DOC_KEYS.has(type);   // sensor-relevant types
  }, [type]);

  // Always fetch results (no enabled gate) — empty filters means "all documents".
  const results = useQuery({
    queryKey: ['browse', q, plant, type, category, make, model],
    queryFn: () => runSearch(q, {
      plant_id: plant || undefined,
      type_key: type || undefined,
      category_id: category || undefined,
      make_id: make || undefined,
      sensor_model_id: model || undefined,
    }),
  });

  function reset() { setQ(''); setPlant(''); setType(''); setCategory(''); setMake(''); setModel(''); }
  const hasFilter = q || plant || type || category || make || model;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Browse documents</h1>
        <p className="muted mt-1">Search and filter — every field is independent.</p>
      </div>

      {/* Search + filters card */}
      <div className="card space-y-4">
        <div>
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="Search across all document contents…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Document type</label>
            <select className="input" value={type} onChange={(e) => { setType(e.target.value); if (!SENSOR_DOC_KEYS.has(e.target.value)) { setMake(''); setModel(''); setCategory(''); } }}>
              <option value="">All types</option>
              {types.data?.map((t: any) => <option key={t.id} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Plant</label>
            <select className="input" value={plant} onChange={(e) => setPlant(e.target.value)}>
              <option value="">All plants</option>
              {plants.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {showSensorFilters && (
            <>
              <div>
                <label className="label">Sensor category</label>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {cats.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Make</label>
                <select className="input" value={make} onChange={(e) => { setMake(e.target.value); setModel(''); }}>
                  <option value="">All makes</option>
                  {makes.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              {make && (
                <div className="md:col-span-2">
                  <label className="label">Model</label>
                  <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
                    <option value="">All models from this make</option>
                    {models.data?.map((m: any) => <option key={m.id} value={m.id}>{m.model_no || m.name}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
        {hasFilter && <button onClick={reset} className="btn-ghost btn-sm">Clear all</button>}
      </div>

      {/* Results */}
      <div className="space-y-3">
        <div className="muted">
          {results.isLoading ? 'Loading…' : `${results.data?.hits.length ?? 0} document(s)`}
        </div>
        {(results.data?.hits ?? []).map((h) => <DocCard key={h.document_id + (h.page_number ?? '')} hit={h} query={q} />)}
        {!results.isLoading && (results.data?.hits ?? []).length === 0 && (
          <div className="card text-sm text-slate-500 text-center">No documents found.</div>
        )}
      </div>
    </div>
  );
}
