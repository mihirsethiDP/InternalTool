import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { runSearch } from '../lib/search';
import { DocCard } from '../components/DocCard';
import PageHeader from '../components/PageHeader';
import { useAuth, canUpload } from '../lib/auth';
import { useUpload } from '../components/UploadModal';

export default function SensorModelDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const upload = useUpload();

  const model = useQuery({
    queryKey: ['sensor-model', id],
    queryFn: async () =>
      (await supabase.from('sensor_models').select('*, sensor_makes(name), sensor_categories(name)').eq('id', id).maybeSingle()).data,
  });

  const docs = useQuery({
    queryKey: ['sensor-docs', id],
    queryFn: () => runSearch('', { sensor_model_id: id }),
  });

  const m: any = model.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={m?.sensor_categories?.name ?? 'Sensor'}
        title={`${m?.sensor_makes?.name ?? ''} ${m?.model_no ?? ''}`.trim() || '…'}
        icon="🔧"
        subtitle={m?.name ?? undefined}
        action={canUpload(profile) && (
          <button onClick={() => upload.open({ sensor_model_id: id! })} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-4 py-2 font-semibold text-sm shadow-sm">
            + Upload document
          </button>
        )}
        stats={[{ label: 'Documents', value: docs.data?.hits.length ?? 0 }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {m?.specs && <InfoCard title="Key specs" body={m.specs} />}
        {m?.suitability && <InfoCard title="Suitability" body={m.suitability} />}
        {m?.technical_details && <InfoCard title="Technical details" body={m.technical_details} />}
        {m?.vendor_url && (
          <div className="card">
            <div className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Vendor</div>
            <a href={m.vendor_url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline text-sm break-all">{m.vendor_url}</a>
          </div>
        )}
      </div>

      <section>
        <h2 className="section-title">Documents</h2>
        <div className="space-y-3">
          {(docs.data?.hits ?? []).map((h) => <DocCard key={h.document_id + (h.page_number ?? '')} hit={h} />)}
          {(docs.data?.hits ?? []).length === 0 && (
            <div className="card text-sm text-slate-500 text-center">
              No documents for this model yet.{canUpload(profile) && ' Click "+ Upload document" above.'}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-1.5">{title}</div>
      <pre className="text-sm whitespace-pre-wrap font-sans text-slate-700">{body}</pre>
    </div>
  );
}
