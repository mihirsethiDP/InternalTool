import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { runSearch } from '../lib/search';
import { DocCard } from '../components/DocCard';
import { useAuth, canUpload } from '../lib/auth';

export default function PlantDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const plant = useQuery({
    queryKey: ['plant', id],
    queryFn: async () => (await supabase.from('plants').select('*').eq('id', id).maybeSingle()).data,
  });

  const sensors = useQuery({
    queryKey: ['plant-sensors', id],
    queryFn: async () =>
      (await supabase
        .from('plant_sensors')
        .select('id, tag_no, location_on_plant, sensor_models(id, model_no, sensor_makes(name), sensor_categories(name))')
        .eq('plant_id', id)).data ?? [],
  });

  const docs = useQuery({
    queryKey: ['plant-docs', id],
    queryFn: () => runSearch('', { plant_id: id }),
  });

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">🏭 {plant.data?.name ?? '…'}</h1>
          <p className="muted mt-1">{plant.data?.location || 'No location set'}</p>
        </div>
      </div>

      {/* Sensors section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title mb-0">Installed sensors ({sensors.data?.length ?? 0})</h2>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Category</th>
                <th>Make</th>
                <th>Model</th>
                <th>Location on plant</th>
                {canUpload(profile) && <th className="w-20"></th>}
              </tr>
            </thead>
            <tbody>
              {(sensors.data ?? []).map((s: any) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.tag_no ?? '—'}</td>
                  <td><span className="badge">{s.sensor_models?.sensor_categories?.name ?? '—'}</span></td>
                  <td>{s.sensor_models?.sensor_makes?.name ?? '—'}</td>
                  <td className="font-mono text-sm">{s.sensor_models?.model_no ?? '—'}</td>
                  <td className="text-slate-600">{s.location_on_plant ?? '—'}</td>
                  {canUpload(profile) && (
                    <td className="text-right">
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={async () => {
                          if (!confirm('Unlink this sensor from the plant?')) return;
                          await supabase.from('plant_sensors').delete().eq('id', s.id);
                          qc.invalidateQueries({ queryKey: ['plant-sensors', id] });
                        }}
                      >Remove</button>
                    </td>
                  )}
                </tr>
              ))}
              {(sensors.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={canUpload(profile) ? 6 : 5} className="py-8 text-center text-slate-500">
                    No sensors linked yet.{canUpload(profile) && ' Use the form below to add one.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canUpload(profile) && <LinkSensorForm plantId={id!} onLinked={() => qc.invalidateQueries({ queryKey: ['plant-sensors', id] })} />}
      </section>

      {/* Documents section */}
      <section className="space-y-3">
        <h2 className="section-title mb-0">Documents ({docs.data?.hits.length ?? 0})</h2>
        <div className="space-y-3">
          {(docs.data?.hits ?? []).map((h) => <DocCard key={h.document_id + (h.page_number ?? '')} hit={h} />)}
          {(docs.data?.hits ?? []).length === 0 && (
            <div className="card text-sm text-slate-500 text-center">
              No documents tagged with this plant yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function LinkSensorForm({ plantId, onLinked }: { plantId: string; onLinked: () => void }) {
  const [sensorModelId, setSensorModelId] = useState('');
  const [tagNo, setTagNo] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);

  const models = useQuery({
    queryKey: ['all-models-for-link'],
    queryFn: async () =>
      (await supabase.from('sensor_models').select('id, model_no, sensor_makes(name), sensor_categories(name)').order('model_no').limit(2000)).data ?? [],
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sensorModelId) return;
    setBusy(true);
    const { error } = await supabase.from('plant_sensors').insert({
      plant_id: plantId,
      sensor_model_id: sensorModelId,
      tag_no: tagNo || null,
      location_on_plant: location || null,
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setSensorModelId(''); setTagNo(''); setLocation('');
    onLinked();
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-3">Add sensor to plant</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="label">Sensor model</label>
          <select className="input" value={sensorModelId} onChange={(e) => setSensorModelId(e.target.value)} required>
            <option value="">— Select model —</option>
            {models.data?.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.sensor_makes?.name} {m.model_no} ({m.sensor_categories?.name})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tag no (optional)</label>
          <input className="input" value={tagNo} onChange={(e) => setTagNo(e.target.value)} placeholder="LT-101" />
        </div>
        <div>
          <label className="label">Location (optional)</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Aeration tank" />
        </div>
      </div>
      <div className="mt-3">
        <button className="btn-primary" disabled={busy}>{busy ? 'Linking…' : 'Link sensor'}</button>
      </div>
    </form>
  );
}
