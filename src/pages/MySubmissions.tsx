import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import PageHeader from '../components/PageHeader';
import { useUpload } from '../components/UploadModal';
import type { SubmissionStatus } from '../lib/types';

function StatusBadge({ s }: { s: SubmissionStatus }) {
  if (s === 'pending')  return <span className="badge bg-amber-100 text-amber-800">⏳ Pending review</span>;
  if (s === 'approved') return <span className="badge bg-emerald-100 text-emerald-800">✓ Approved</span>;
  return <span className="badge bg-red-100 text-red-700">✕ Rejected</span>;
}

export default function MySubmissions() {
  const { userId } = useAuth();
  const upload = useUpload();
  const [filter, setFilter] = useState<'all' | SubmissionStatus>('all');

  const submissions = useQuery({
    queryKey: ['my-submissions', userId, filter],
    queryFn: async () => {
      if (!userId) return [];
      let q = supabase
        .from('document_submissions')
        .select('*, document_types(label), sensor_models(model_no, sensor_makes(name))')
        .eq('uploaded_by', userId)
        .order('uploaded_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const counts = useQuery({
    queryKey: ['my-submissions-counts', userId],
    queryFn: async () => {
      if (!userId) return { pending: 0, approved: 0, rejected: 0 };
      const r: any = { pending: 0, approved: 0, rejected: 0 };
      for (const s of ['pending', 'approved', 'rejected'] as const) {
        const { count } = await supabase
          .from('document_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('uploaded_by', userId)
          .eq('status', s);
        r[s] = count ?? 0;
      }
      return r;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Uploads"
        icon="📝"
        title="My uploads"
        subtitle="Documents you've uploaded for admin review."
        stats={[
          { label: 'Pending', value: counts.data?.pending ?? 0 },
          { label: 'Approved', value: counts.data?.approved ?? 0 },
          { label: 'Rejected', value: counts.data?.rejected ?? 0 },
        ]}
        action={
          <button onClick={() => upload.open()} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-4 py-2 font-semibold text-sm shadow-sm">
            + New submission
          </button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <span className="muted text-xs mr-1 self-center">Show:</span>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
              filter === s ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-200 hover:border-brand-700 hover:text-brand-700'
            }`}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {(submissions.data ?? []).map((s: any) => (
          <div key={s.id} className="card-tight">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="bg-brand-50 text-brand-700 rounded-lg w-10 h-10 flex items-center justify-center shrink-0">📄</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-semibold text-slate-900 truncate">{s.title}</div>
                  <StatusBadge s={s.status} />
                  {s.document_types?.label && <span className="badge-blue">{s.document_types.label}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {s.sensor_models?.sensor_makes?.name && (
                    <>🔧 {s.sensor_models.sensor_makes.name} {s.sensor_models.model_no} · </>
                  )}
                  Submitted {new Date(s.uploaded_at).toLocaleString()}
                </div>
                {s.status === 'rejected' && s.reviewer_notes && (
                  <div className="mt-2 text-sm bg-red-50 border border-red-100 text-red-800 rounded-md px-3 py-2">
                    <span className="font-semibold">Reviewer note:</span> {s.reviewer_notes}
                  </div>
                )}
                {s.status === 'approved' && s.reviewer_notes && (
                  <div className="mt-2 text-sm bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-md px-3 py-2">
                    <span className="font-semibold">Reviewer note:</span> {s.reviewer_notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {!submissions.isLoading && (submissions.data ?? []).length === 0 && (
          <div className="card text-sm text-slate-500 text-center">
            No submissions {filter !== 'all' && `in "${filter}"`} yet.
            {filter === 'all' && ' Use "+ New submission" to upload your first document.'}
          </div>
        )}
      </div>
    </div>
  );
}
