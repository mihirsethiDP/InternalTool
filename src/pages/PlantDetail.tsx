import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { runSearch } from '../lib/search';
import { DocCard } from '../components/DocCard';

export default function PlantDetail() {
  const { id } = useParams();

  const plant = useQuery({
    queryKey: ['plant', id],
    queryFn: async () => (await supabase.from('plants').select('*').eq('id', id).maybeSingle()).data,
  });

  const sensors = useQuery({
    queryKey: ['plant-sensors', id],
    queryFn: async () =>
      (await supabase
        .from('plant_sensors')
        .select('tag_no, location_on_plant, sensor_models(id, model_no, sensor_makes(name), sensor_categories(name))')
        .eq('plant_id', id)).data ?? [],
  });

  const docs = useQuery({
    queryKey: ['plant-docs', id],
    queryFn: () => runSearch('', { plant_id: id }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">🏭 {plant.data?.name ?? '…'}</h1>
        <div className="text-sm text-slate-500">{plant.data?.location}</div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Installed sensors</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 text-xs uppercase">
              <tr><th className="py-2 pr-3">Tag</th><th className="pr-3">Category</th><th className="pr-3">Make</th><th className="pr-3">Model</th><th>Location</th></tr>
            </thead>
            <tbody>
              {(sensors.data ?? []).map((s: any, i: number) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-mono text-xs">{s.tag_no ?? '—'}</td>
                  <td className="pr-3">{s.sensor_models?.sensor_categories?.name ?? '—'}</td>
                  <td className="pr-3">{s.sensor_models?.sensor_makes?.name ?? '—'}</td>
                  <td className="pr-3">{s.sensor_models?.model_no ?? '—'}</td>
                  <td>{s.location_on_plant ?? '—'}</td>
                </tr>
              ))}
              {(sensors.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="py-4 text-slate-500 text-center">No sensors linked. Upload a Design Data Sheet to populate.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Documents for this plant</h2>
        <div className="space-y-3">
          {(docs.data?.hits ?? []).map((h) => <DocCard key={h.document_id + (h.page_number ?? '')} hit={h} />)}
          {(docs.data?.hits ?? []).length === 0 && (
            <div className="card text-sm text-slate-500">No documents linked to this plant yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
