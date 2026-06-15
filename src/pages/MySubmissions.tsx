import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import SegmentedFilter from '../components/SegmentedFilter';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import PageHeader from '../components/PageHeader';
import { useUpload } from '../components/UploadModal';
import { extractPdfText } from '../lib/pdf';
import type { SubmissionStatus } from '../lib/types';

function StatusBadge({ s }: { s: SubmissionStatus }) {
  if (s === 'pending')  return <span className="badge bg-amber-100 text-amber-800">Pending review</span>;
  if (s === 'approved') return <span className="badge bg-emerald-100 text-emerald-800">Approved</span>;
  if (s === 'changes_requested') return <span className="badge bg-orange-100 text-orange-800">Changes requested</span>;
  return <span className="badge bg-red-100 text-red-700">Rejected</span>;
}

export default function MySubmissions() {
  const { userId } = useAuth();
  const upload = useUpload();
  const [filter, setFilter] = useState<'all' | SubmissionStatus>('all');
  const [reviseId, setReviseId] = useState<any | null>(null);

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
      if (!userId) return { pending: 0, changes_requested: 0, approved: 0, rejected: 0 };
      const r: any = { pending: 0, changes_requested: 0, approved: 0, rejected: 0 };
      for (const s of ['pending', 'changes_requested', 'approved', 'rejected'] as const) {
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
        title="My uploads"
        subtitle="Documents you've uploaded for admin review."
        stats={[
          { label: 'Pending', value: counts.data?.pending ?? 0 },
          { label: 'Changes', value: counts.data?.changes_requested ?? 0 },
          { label: 'Approved', value: counts.data?.approved ?? 0 },
        ]}
        action={
          <button onClick={() => upload.open()} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-4 py-2 font-semibold text-sm shadow-sm">
            + New submission
          </button>
        }
      />

      <SegmentedFilter
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending', count: counts.data?.pending ?? 0, tone: 'amber' },
          { value: 'changes_requested', label: 'Changes', count: counts.data?.changes_requested ?? 0, tone: 'amber' },
          { value: 'approved', label: 'Approved', count: counts.data?.approved ?? 0, tone: 'emerald' },
          { value: 'rejected', label: 'Rejected', count: counts.data?.rejected ?? 0, tone: 'red' },
        ]}
      />

      <div className="space-y-3">
        {(submissions.data ?? []).map((s: any) => (
          <div key={s.id} className="card-tight">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="bg-brand-50 text-brand-700 rounded-md w-9 h-9 flex items-center justify-center shrink-0"><FileText size={16} strokeWidth={2} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-semibold text-slate-900 truncate">{s.title}</div>
                  <StatusBadge s={s.status} />
                  {s.document_types?.label && <span className="badge-blue">{s.document_types.label}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {s.sensor_models?.sensor_makes?.name && (
                    <>{s.sensor_models.sensor_makes.name} {s.sensor_models.model_no} · </>
                  )}
                  Submitted {new Date(s.uploaded_at).toLocaleString()}
                </div>
                {s.status === 'changes_requested' && (
                  <div className="mt-2 text-sm bg-orange-50 border border-orange-200 text-orange-900 rounded-md px-3 py-2">
                    <span className="font-semibold">Changes requested:</span> {s.reviewer_notes}
                    <div className="mt-2">
                      <button onClick={() => setReviseId(s)} className="btn-primary btn-sm">Revise &amp; resubmit</button>
                    </div>
                  </div>
                )}
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

      {reviseId && <ReviseModal submission={reviseId} onClose={() => setReviseId(null)} />}
    </div>
  );
}

/* Revise & resubmit — edit title, optionally replace the file, send back to review */
function ReviseModal({ submission, onClose }: { submission: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(submission.title ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) { setErr('Title is required.'); return; }
    setBusy(true); setErr(null);
    try {
      const update: any = {
        title: title.trim(),
        status: 'pending',
        decision: null,
        reviewer_notes: null,
        reviewed_at: null,
        reviewed_by: null,
        uploaded_at: new Date().toISOString(),
      };

      // Optional file replacement (uploader can't delete the old object; it's left harmless)
      if (file) {
        setStatus('Uploading new file…');
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
        const storagePath = `${Date.now()}_${safeName}`;
        const up = await supabase.storage.from('documents').upload(storagePath, file, {
          contentType: file.type || 'application/octet-stream', upsert: false,
        });
        if (up.error) throw up.error;
        update.storage_path = storagePath;
        update.size_bytes = file.size;
        if (/\.pdf$/i.test(file.name) || /pdf/i.test(file.type)) {
          setStatus('Extracting text…');
          try {
            const pages = await extractPdfText(file);
            update.page_count = pages.length;
            update.extracted_text = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');
          } catch { /* keep prior extracted_text */ }
        }
      }

      setStatus('Resubmitting…');
      const { error } = await supabase.from('document_submissions').update(update).eq('id', submission.id);
      if (error) throw error;

      // Notify admins of the resubmission
      try {
        const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
        if (admins?.length) {
          await supabase.from('notifications').insert(
            admins.map((a: any) => ({
              recipient_id: a.id,
              kind: 'submission_created',
              submission_id: submission.id,
              message: `Resubmitted after changes: "${title.trim()}"`,
            }))
          );
        }
      } catch (e) { console.warn('notify admins failed', e); }

      qc.invalidateQueries({ queryKey: ['my-submissions'] });
      qc.invalidateQueries({ queryKey: ['my-submissions-counts'] });
      qc.invalidateQueries({ queryKey: ['review-queue'] });
      qc.invalidateQueries({ queryKey: ['review-queue-counts'] });
      onClose();
    } catch (e: any) {
      setErr(e.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold">Revise &amp; resubmit</h3>
          <p className="text-sm text-slate-500">Address the reviewer&rsquo;s note, then resubmit for review.</p>
        </div>
        {submission.reviewer_notes && (
          <div className="text-sm bg-orange-50 border border-orange-200 text-orange-900 rounded-md px-3 py-2">
            <span className="font-semibold">Requested:</span> {submission.reviewer_notes}
          </div>
        )}
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Replace file (optional)</label>
          <input className="input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="text-xs text-slate-500 mt-1.5">Leave empty to keep the current file and just resubmit.</div>
        </div>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>}
        {status && <div className="text-sm text-slate-600">{status}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy ? 'Working…' : 'Resubmit for review'}</button>
        </div>
      </div>
    </div>
  );
}
