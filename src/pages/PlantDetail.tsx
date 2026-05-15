import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { runSearch } from '../lib/search';
import { DocCard } from '../components/DocCard';
import { useAuth, canUpload } from '../lib/auth';
import { useUpload } from '../components/UploadModal';

export default function PlantDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const upload = useUpload();

  const plant = useQuery({
    queryKey: ['plant', id],
    queryFn: async () => (await supabase.from('plants').select('*').eq('id', id).maybeSingle()).data,
  });

  const equipment = useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => (await supabase.from('equipment').select('*').eq('plant_id', id).order('name')).data ?? [],
  });

  const sensors = useQuery({
    queryKey: ['plant-sensors', id],
    queryFn: async () =>
      (await supabase
        .from('plant_sensors')
        .select('id, equipment_id, sensor_models(id, model_no, name, sensor_makes(name), sensor_categories(name))')
        .eq('plant_id', id)).data ?? [],
  });

  return (
    <div className="space-y-8">
      {/* Page header — strong hierarchy */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-800 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/70 mb-1">Plant</div>
            <h1 className="text-3xl font-bold tracking-tight">{plant.data?.name ?? '…'}</h1>
            <div className="text-white/80 mt-1">{plant.data?.location || 'No location set'}</div>
          </div>
          {canUpload(profile) && (
            <button onClick={() => upload.open({ plant_id: id! })} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-4 py-2 font-semibold text-sm shadow-sm">
              + Upload document
            </button>
          )}
        </div>
        <div className="flex gap-6 mt-5 text-sm">
          <Stat label="Equipment" value={equipment.data?.length ?? 0} />
          <Stat label="Sensors installed" value={sensors.data?.length ?? 0} />
        </div>
      </div>

      {/* Equipment */}
      <EquipmentSection plantId={id!} equipment={equipment.data ?? []} canEdit={canUpload(profile)} onChanged={() => qc.invalidateQueries({ queryKey: ['equipment', id] })} />

      {/* Sensors grouped by equipment */}
      <SensorsSection
        plantId={id!}
        equipment={equipment.data ?? []}
        sensors={sensors.data ?? []}
        canEdit={canUpload(profile)}
        onChanged={() => qc.invalidateQueries({ queryKey: ['plant-sensors', id] })}
      />

      {/* Documents with type filter */}
      <DocumentsSection plantId={id!} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="text-xs uppercase tracking-wider text-white/70">{label}</div>
    </div>
  );
}

/* ============== Equipment ============== */
function EquipmentSection({ plantId, equipment, canEdit, onChanged }: any) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from('equipment').insert({ plant_id: plantId, name: name.trim() });
    if (error) { alert(error.message); return; }
    setName(''); setAdding(false); onChanged();
  }
  async function remove(eid: string) {
    if (!confirm('Remove this equipment? Any sensors linked to it will become "Unassigned".')) return;
    const { error } = await supabase.from('equipment').delete().eq('id', eid);
    if (error) { alert(error.message); return; }
    onChanged();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Equipment</h2>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="btn-secondary btn-sm">+ Add equipment</button>
        )}
      </div>
      {adding && (
        <form onSubmit={add} className="card flex gap-2 items-end">
          <div className="flex-1">
            <label className="label">Equipment name</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Air Blower 1 · Filter Feed Pump · Aeration Tank" />
          </div>
          <button className="btn-primary">Add</button>
          <button type="button" onClick={() => { setAdding(false); setName(''); }} className="btn-ghost">Cancel</button>
        </form>
      )}
      {equipment.length === 0 && !adding && (
        <div className="card text-sm text-slate-500 text-center">No equipment yet.{canEdit && ' Add equipment first, then link sensors to it.'}</div>
      )}
      {equipment.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {equipment.map((e: any) => (
            <div key={e.id} className="bg-white rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between text-sm">
              <span className="font-medium truncate">{e.name}</span>
              {canEdit && <button onClick={() => remove(e.id)} className="text-slate-400 hover:text-red-600 text-xs ml-2">×</button>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ============== Sensors ============== */
function SensorsSection({ plantId, equipment, sensors, canEdit, onChanged }: any) {
  const [filterEquipment, setFilterEquipment] = useState('');
  const [adding, setAdding] = useState(false);

  // Group sensors by equipment_id (or 'Unassigned')
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = { __unassigned: [] };
    for (const eq of equipment) groups[eq.id] = [];
    for (const s of sensors) {
      const k = s.equipment_id || '__unassigned';
      (groups[k] ??= []).push(s);
    }
    return groups;
  }, [equipment, sensors]);

  const visibleGroups = filterEquipment
    ? [{ id: filterEquipment, sensors: grouped[filterEquipment] ?? [] }]
    : equipment.map((e: any) => ({ id: e.id, sensors: grouped[e.id] ?? [] }))
        .concat(grouped['__unassigned'].length ? [{ id: '__unassigned', sensors: grouped['__unassigned'] }] : []);

  function equipmentName(eid: string) {
    if (eid === '__unassigned') return 'Unassigned';
    return equipment.find((e: any) => e.id === eid)?.name ?? '—';
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="section-title mb-0">Sensors installed</h2>
        <div className="flex items-center gap-2">
          <select className="input py-1.5 text-sm" value={filterEquipment} onChange={(e) => setFilterEquipment(e.target.value)}>
            <option value="">All equipment</option>
            {equipment.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          {canEdit && !adding && (
            <button onClick={() => setAdding(true)} className="btn-secondary btn-sm">+ Link sensor</button>
          )}
        </div>
      </div>

      {adding && <LinkSensorForm plantId={plantId} equipment={equipment} onDone={() => { setAdding(false); onChanged(); }} />}

      {visibleGroups.length === 0 || visibleGroups.every((g: any) => g.sensors.length === 0) ? (
        <div className="card text-sm text-slate-500 text-center">No sensors linked yet.</div>
      ) : (
        <div className="space-y-5">
          {visibleGroups.map((g: any) => g.sensors.length > 0 && (
            <div key={g.id}>
              <div className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">{equipmentName(g.id)}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.sensors.map((s: any) => (
                  <Link to={`/sensors/${s.sensor_models?.id}`} key={s.id} className="card-tight hover:border-brand-700 transition group">
                    <div className="flex items-start gap-3">
                      <div className="bg-brand-50 text-brand-700 rounded-lg w-10 h-10 flex items-center justify-center shrink-0">🔧</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-slate-500">{s.sensor_models?.sensor_makes?.name}</div>
                        <div className="font-semibold text-slate-900 truncate">{s.sensor_models?.model_no || s.sensor_models?.name || 'Unknown'}</div>
                        <div className="mt-1"><span className="badge">{s.sensor_models?.sensor_categories?.name ?? '—'}</span></div>
                      </div>
                      {canEdit && (
                        <button onClick={async (e) => {
                          e.preventDefault();
                          if (!confirm('Unlink this sensor?')) return;
                          await supabase.from('plant_sensors').delete().eq('id', s.id);
                          onChanged();
                        }} className="text-slate-300 hover:text-red-600 text-lg leading-none">×</button>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LinkSensorForm({ plantId, equipment, onDone }: any) {
  const [makeId, setMakeId] = useState('');
  const [sensorModelId, setSensorModelId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [busy, setBusy] = useState(false);

  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });
  const models = useQuery({
    queryKey: ['models-by-make-link', makeId],
    queryFn: async () => makeId ? ((await supabase.from('sensor_models').select('id, model_no, name').eq('make_id', makeId).order('model_no')).data ?? []) : [],
    enabled: Boolean(makeId),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sensorModelId) return;
    setBusy(true);
    const { error } = await supabase.from('plant_sensors').insert({
      plant_id: plantId,
      sensor_model_id: sensorModelId,
      equipment_id: equipmentId || null,
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div className="text-xs uppercase tracking-wide font-semibold text-slate-500">Link sensor to plant</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="label">Make</label>
          <select className="input" value={makeId} onChange={(e) => { setMakeId(e.target.value); setSensorModelId(''); }} required>
            <option value="">— Select make —</option>
            {makes.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Model</label>
          <select className="input" value={sensorModelId} onChange={(e) => setSensorModelId(e.target.value)} disabled={!makeId} required>
            <option value="">{makeId ? '— Select model —' : 'Pick a make first'}</option>
            {models.data?.map((m: any) => <option key={m.id} value={m.id}>{m.model_no || m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Equipment (optional)</label>
          <select className="input" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
            <option value="">— Unassigned —</option>
            {equipment.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? 'Linking…' : 'Link sensor'}</button>
        <button type="button" onClick={onDone} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

/* ============== Documents ============== */
function DocumentsSection({ plantId }: { plantId: string }) {
  const [typeKey, setTypeKey] = useState('');
  const types = useQuery({ queryKey: ['types'], queryFn: async () => (await supabase.from('document_types').select('id,key,label').order('sort_order')).data ?? [] });
  const docs = useQuery({
    queryKey: ['plant-docs', plantId, typeKey],
    queryFn: () => runSearch('', { plant_id: plantId, type_key: typeKey || undefined }),
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="section-title mb-0">Documents</h2>
        <select className="input py-1.5 text-sm md:w-64" value={typeKey} onChange={(e) => setTypeKey(e.target.value)}>
          <option value="">All document types</option>
          {types.data?.map((t: any) => <option key={t.id} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      <div className="space-y-3">
        {(docs.data?.hits ?? []).map((h) => <DocCard key={h.document_id + (h.page_number ?? '')} hit={h} />)}
        {(docs.data?.hits ?? []).length === 0 && (
          <div className="card text-sm text-slate-500 text-center">
            No {typeKey ? `${types.data?.find((t: any) => t.key === typeKey)?.label}` : ''} documents for this plant yet.
          </div>
        )}
      </div>
    </section>
  );
}
