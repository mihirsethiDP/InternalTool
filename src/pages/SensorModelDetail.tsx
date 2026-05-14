import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { runSearch } from '../lib/search';
import { DocCard } from '../components/DocCard';

export default function SensorModelDetail() {
  const { id } = useParams();

  const model = useQuery({
    queryKey: ['sensor-model', id],
    queryFn: async () =>
      (
        await supabase
          .from('sensor_models')
          .select('*, sensor_makes(name), sensor_categories(name)')
          .eq('id', id)
          .maybeSingle()
      ).data,
  });

  const docs = useQuery({
    queryKey: ['sensor-docs', id],
    queryFn: () => runSearch('', { sensor_model_id: id }),
  });

  const m = model.data;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">🔧 {m?.sensor_makes?.name} {m?.model_no}</h1>
        <div className="text-sm text-slate-500">{m?.sensor_categories?.name}{m?.name ? ` · ${m.name}` : ''}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {m?.specs && <div className="card"><div className="text-xs uppercase font-semibold text-slate-500 mb-1">Key specs</div><pre className="text-sm whitespace-pre-wrap font-sans">{m.specs}</pre></div>}
        {m?.suitability && <div className="card"><div className="text-xs uppercase font-semibold text-slate-500 mb-1">Suitability</div><pre className="text-sm whitespace-pre-wrap font-sans">{m.suitability}</pre></div>}
        {m?.technical_details && <div className="card"><div className="text-xs uppercase font-semibold text-slate-500 mb-1">Technical details</div><pre className="text-sm whitespace-pre-wrap font-sans">{m.technical_details}</pre></div>}
        {m?.vendor_url && (
          <div className="card">
            <div className="text-xs uppercase font-semibold text-slate-500 mb-1">Vendor</div>
            <a href={m.vendor_url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline text-sm break-all">{m.vendor_url}</a>
          </div>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Documents</h2>
        <div className="space-y-3">
          {(docs.data?.hits ?? []).map((h) => <DocCard key={h.document_id + (h.page_number ?? '')} hit={h} />)}
          {(docs.data?.hits ?? []).length === 0 && (
            <div className="card text-sm text-slate-500">
              No documents linked yet. Upload a manual, datasheet, or installation guide and tag this model.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
