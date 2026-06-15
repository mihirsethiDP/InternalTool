import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import SegmentedFilter from '../components/SegmentedFilter';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import PageHeader from '../components/PageHeader';
import type { SubmissionSection } from '../lib/types';
import {
  SECTION_LABEL, SECTION_ORDER, replaceSection, appendSection,
} from '../lib/consolidated';
import { writeConsolidated } from '../lib/consolidatedWrite';

/* =========================================================
   List page — /review
========================================================= */
export function ReviewQueueList() {
  const { profile } = useAuth();
  const [status, setStatus] = useState<'pending' | 'changes_requested' | 'approved' | 'rejected' | 'all'>('pending');

  const subs = useQuery({
    queryKey: ['review-queue', status],
    queryFn: async () => {
      let q = supabase
        .from('document_submissions')
        .select('*, document_types(label), sensor_models(model_no, sensor_makes(name))')
        .order('uploaded_at', { ascending: false });
      if (status !== 'all') q = q.eq('status', status);
      const { data } = await q;
      return data ?? [];
    },
  });

  const counts = useQuery({
    queryKey: ['review-queue-counts'],
    queryFn: async () => {
      const r: any = {};
      for (const s of ['pending', 'changes_requested', 'approved', 'rejected'] as const) {
        const { count } = await supabase
          .from('document_submissions').select('id', { count: 'exact', head: true }).eq('status', s);
        r[s] = count ?? 0;
      }
      return r;
    },
  });

  if (!isAdmin(profile)) {
    return <div className="card text-sm">Admins only.</div>;
  }

  return (
    <div className="space-y-4">
      <SegmentedFilter
        value={status}
        onChange={setStatus}
        options={[
          { value: 'pending', label: 'Pending', count: counts.data?.pending ?? 0, tone: 'amber' },
          { value: 'changes_requested', label: 'Changes', count: counts.data?.changes_requested ?? 0, tone: 'amber' },
          { value: 'approved', label: 'Approved', count: counts.data?.approved ?? 0, tone: 'emerald' },
          { value: 'rejected', label: 'Rejected', count: counts.data?.rejected ?? 0, tone: 'red' },
          { value: 'all', label: 'All' },
        ]}
      />

      <div className="space-y-3">
        {(subs.data ?? []).map((s: any) => (
          <Link key={s.id} to={`/review/${s.id}`} className="card-tight flex items-start gap-3 hover:border-brand-700 transition">
            <div className="bg-brand-50 text-brand-700 rounded-md w-9 h-9 flex items-center justify-center shrink-0"><FileText size={16} strokeWidth={2} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold text-slate-900 truncate">{s.title}</div>
                <StatusPill s={s.status} />
                {s.document_types?.label && <span className="badge-blue">{s.document_types.label}</span>}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {s.sensor_models?.sensor_makes?.name && (
                  <>{s.sensor_models.sensor_makes.name} {s.sensor_models.model_no} · </>
                )}
                {new Date(s.uploaded_at).toLocaleString()}
              </div>
            </div>
            <div className="text-slate-300">→</div>
          </Link>
        ))}
        {!subs.isLoading && (subs.data ?? []).length === 0 && (
          <div className="card text-sm text-slate-500 text-center">Nothing here.</div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  if (s === 'pending') return <span className="badge bg-amber-100 text-amber-800">Pending</span>;
  if (s === 'approved') return <span className="badge bg-emerald-100 text-emerald-800">Approved</span>;
  if (s === 'changes_requested') return <span className="badge bg-orange-100 text-orange-800">Changes requested</span>;
  return <span className="badge bg-red-100 text-red-700">Rejected</span>;
}

/* =========================================================
   Detail page — /review/:id
========================================================= */
export function ReviewQueueDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [editedText, setEditedText] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const sub = useQuery({
    queryKey: ['submission', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('document_submissions')
        .select('*, document_types(label, key), sensor_models(id, model_no, sensor_makes(name))')
        .eq('id', id)
        .maybeSingle();
      return data;
    },
  });

  const dupes = useQuery({
    queryKey: ['dupes', id],
    queryFn: async () => {
      const { data } = await supabase.rpc('flag_duplicates', { p_submission_id: id });
      return data ?? [];
    },
    enabled: Boolean(sub.data?.extracted_text),
  });

  useEffect(() => {
    if (sub.data?.extracted_text != null) setEditedText(sub.data.extracted_text);
  }, [sub.data?.extracted_text]);

  useEffect(() => {
    (async () => {
      if (!sub.data?.storage_path) return;
      const { data } = await supabase.storage.from('documents').createSignedUrl(sub.data.storage_path, 600);
      if (data?.signedUrl) setPdfUrl(data.signedUrl);
    })();
  }, [sub.data?.storage_path]);

  async function saveEdits() {
    await supabase.from('document_submissions').update({ extracted_text: editedText }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['submission', id] });
    qc.invalidateQueries({ queryKey: ['dupes', id] });
    alert('Edits saved.');
  }

  const s = sub.data;
  if (!isAdmin(profile)) return <div className="card text-sm">Admins only.</div>;
  if (sub.isLoading) return <div className="muted">Loading…</div>;
  if (!s) return <div className="card text-sm">Submission not found.</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Review"
        icon="🔍"
        title={s.title}
        subtitle={`${s.sensor_models?.sensor_makes?.name ?? ''} ${s.sensor_models?.model_no ?? ''} · ${s.document_types?.label ?? ''}`}
        action={
          <div className="flex gap-2">
            <button onClick={() => nav('/review')} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-3 py-2 text-sm shadow-sm">← Back to queue</button>
          </div>
        }
      />

      {/* Status + actions */}
      <div className="card flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <StatusPill s={s.status} />
          <span className="muted text-xs">
            Submitted {new Date(s.uploaded_at).toLocaleString()}
          </span>
        </div>
        {s.status === 'pending' && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={saveEdits} className="btn-secondary btn-sm">Save edits</button>
            <button onClick={() => setChangesOpen(true)} className="btn btn-sm bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100">Request changes</button>
            <button onClick={() => setRejectOpen(true)} className="btn btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">Reject</button>
            <button onClick={() => setApproveOpen(true)} className="btn-primary btn-sm">Approve…</button>
          </div>
        )}
        {s.status !== 'pending' && (
          <div className="flex items-center gap-3 flex-wrap">
            {s.reviewer_notes && <div className="text-xs text-slate-600"><strong>Note:</strong> {s.reviewer_notes}</div>}
            {(s.status === 'rejected' || s.status === 'changes_requested') && s.storage_path && (
              <button onClick={() => setDeleteOpen(true)} className="text-xs text-red-600 hover:underline">Delete file permanently</button>
            )}
          </div>
        )}
      </div>

      {/* Duplicates */}
      {(dupes.data ?? []).length > 0 && (
        <div className="card border-amber-200 bg-amber-50/60">
          <div className="text-xs uppercase font-semibold text-amber-800 mb-2">
            ⚠ Possible duplicates ({dupes.data!.length})
          </div>
          <div className="space-y-2 text-sm">
            {(dupes.data ?? []).map((d: any) => (
              <div key={d.chunk_id} className="bg-white/60 border border-amber-200 rounded p-2">
                <div className="text-xs text-amber-900 mb-1">
                  <strong>{Math.round(d.similarity * 100)}%</strong> similar to {SECTION_LABEL[d.section as SubmissionSection]}
                </div>
                <div className="text-slate-700 text-xs italic">{d.chunk_preview}…</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PDF preview */}
        <div className="card-tight">
          <div className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">Source PDF</div>
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-[70vh] border border-slate-200 rounded-md" />
          ) : (
            <div className="muted text-sm">No file attached.</div>
          )}
        </div>

        {/* Extracted text editor */}
        <div className="card-tight">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide font-semibold text-slate-500">Extracted text (editable)</div>
            <span className="muted text-xs">{editedText.length.toLocaleString()} chars</span>
          </div>
          <textarea
            className="w-full h-[70vh] rounded-md border border-slate-300 p-3 text-sm font-mono leading-relaxed focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20 outline-none"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            placeholder="(empty)"
          />
        </div>
      </div>

      {approveOpen && (
        <ApproveModal submission={s} editedText={editedText} onClose={() => setApproveOpen(false)} onDone={() => nav('/review')} />
      )}
      {changesOpen && (
        <RequestChangesModal submission={s} editedText={editedText} onClose={() => setChangesOpen(false)} onDone={() => nav('/review')} />
      )}
      {rejectOpen && (
        <RejectModal submission={s} onClose={() => setRejectOpen(false)} onDone={() => nav('/review')} />
      )}
      {deleteOpen && (
        <DeleteFileModal submission={s} onClose={() => setDeleteOpen(false)} onDone={() => nav('/review')} />
      )}
    </div>
  );
}

/* =========================================================
   Approve modal: pick section + replace/append
========================================================= */
function ApproveModal({ submission, editedText, onClose, onDone }: any) {
  const qc = useQueryClient();
  const [section, setSection] = useState<SubmissionSection>(submission.target_section || 'manual');
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true); setErr(null);
    try {
      const sensorModelId = submission.sensor_model_id;
      if (!sensorModelId) throw new Error('Submission has no sensor model.');

      // 1. Get or create consolidated doc
      let { data: cdoc } = await supabase
        .from('consolidated_docs').select('*').eq('sensor_model_id', sensorModelId).maybeSingle();
      if (!cdoc) {
        const ins = await supabase.from('consolidated_docs')
          .insert({ sensor_model_id: sensorModelId, content_markdown: '' })
          .select('*').single();
        if (ins.error) throw ins.error;
        cdoc = ins.data;
      }

      // 2. Merge submission text into target section
      const merged = mode === 'replace'
        ? replaceSection(cdoc.content_markdown, section, editedText)
        : appendSection(cdoc.content_markdown, section, editedText,
            `Appended from "${submission.title}" on ${new Date().toLocaleDateString()}`);

      // 3. Save markdown + rebuild chunks + record a revision snapshot
      await writeConsolidated({
        docId: cdoc.id,
        sensorModelId,
        markdown: merged,
        changeKind: 'approval',
        note: `Approved "${submission.title}" into ${SECTION_LABEL[section]} (${mode})${note ? ` — ${note}` : ''}`,
      });

      // 5. Mark submission approved
      const decision = mode === 'replace' ? 'replace_section' : 'append_section';
      const updSub = await supabase.from('document_submissions').update({
        status: 'approved',
        decision,
        target_section: section,
        reviewer_notes: note || null,
        reviewed_at: new Date().toISOString(),
        extracted_text: editedText, // persist any final edits
      }).eq('id', submission.id);
      if (updSub.error) throw updSub.error;

      // Notify the maker
      try {
        if (submission.uploaded_by) {
          await supabase.from('notifications').insert({
            recipient_id: submission.uploaded_by,
            kind: 'submission_approved',
            submission_id: submission.id,
            message: `Your submission "${submission.title}" was approved${note ? ` — ${note}` : ''}.`,
          });
        }
      } catch (e) { console.warn('notify maker failed', e); }

      qc.invalidateQueries({ queryKey: ['review-queue'] });
      qc.invalidateQueries({ queryKey: ['review-queue-counts'] });
      qc.invalidateQueries({ queryKey: ['my-submissions'] });
      onDone();
    } catch (e: any) {
      setErr(e.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold">Approve submission</h3>
          <p className="text-sm text-slate-500">Choose which section of the consolidated reference receives this content.</p>
        </div>
        <div>
          <label className="label">Target section</label>
          <select className="input" value={section} onChange={(e) => setSection(e.target.value as SubmissionSection)}>
            {SECTION_ORDER.map((s) => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Merge mode</label>
          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-0.5" />
              <span><strong>Replace</strong> the existing {SECTION_LABEL[section]} content. <span className="muted">Recommended for new manuals / datasheet updates.</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} className="mt-0.5" />
              <span><strong>Append</strong> to the existing {SECTION_LABEL[section]} content. <span className="muted">Use for service bulletins, addenda, or genuinely new information.</span></span>
            </label>
          </div>
        </div>
        <div>
          <label className="label">Reviewer note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cleaned up Issue 4 wording" />
        </div>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={confirm} disabled={busy} className="btn-primary">{busy ? 'Approving…' : 'Approve & merge'}</button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Request changes modal — sends back to the maker; keeps the file
========================================================= */
function RequestChangesModal({ submission, editedText, onClose, onDone }: any) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    if (!note.trim()) { setErr('Tell the maker what needs to change.'); return; }
    setBusy(true); setErr(null);
    try {
      // Keep the file; persist any edits the checker already made; send back.
      const upd = await supabase.from('document_submissions').update({
        status: 'changes_requested',
        decision: 'changes_requested',
        reviewer_notes: note.trim(),
        reviewed_at: new Date().toISOString(),
        extracted_text: editedText,
      }).eq('id', submission.id);
      if (upd.error) throw upd.error;

      try {
        if (submission.uploaded_by) {
          await supabase.from('notifications').insert({
            recipient_id: submission.uploaded_by,
            kind: 'submission_changes_requested',
            submission_id: submission.id,
            message: `Changes requested on "${submission.title}" — ${note.trim()}`,
          });
        }
      } catch (e) { console.warn('notify maker failed', e); }

      qc.invalidateQueries({ queryKey: ['review-queue'] });
      qc.invalidateQueries({ queryKey: ['review-queue-counts'] });
      qc.invalidateQueries({ queryKey: ['my-submissions'] });
      onDone();
    } catch (e: any) {
      setErr(e.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold">Request changes</h3>
          <p className="text-sm text-slate-500">The submission goes back to the maker to revise and resubmit. Nothing is deleted.</p>
        </div>
        <div>
          <label className="label">What needs to change? <span className="text-red-500">*</span></label>
          <textarea className="input min-h-24" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. This is the wrong revision of the manual — please upload Rev 3, and the troubleshooting table on p.4 is cut off." />
        </div>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={confirm} disabled={busy} className="btn bg-amber-600 text-white hover:bg-amber-700">{busy ? 'Sending…' : 'Send back for changes'}</button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Reject modal — soft archive; the file is RETAINED
========================================================= */
function RejectModal({ submission, onClose, onDone }: any) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true); setErr(null);
    try {
      // Soft archive — keep the file and the record; no storage deletion.
      const upd = await supabase.from('document_submissions').update({
        status: 'rejected',
        decision: 'rejected',
        reviewer_notes: note || null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', submission.id);
      if (upd.error) throw upd.error;

      try {
        if (submission.uploaded_by) {
          await supabase.from('notifications').insert({
            recipient_id: submission.uploaded_by,
            kind: 'submission_rejected',
            submission_id: submission.id,
            message: `Your submission "${submission.title}" was rejected${note ? ` — ${note}` : ''}.`,
          });
        }
      } catch (e) { console.warn('notify maker failed', e); }

      qc.invalidateQueries({ queryKey: ['review-queue'] });
      qc.invalidateQueries({ queryKey: ['review-queue-counts'] });
      qc.invalidateQueries({ queryKey: ['my-submissions'] });
      onDone();
    } catch (e: any) {
      setErr(e.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold">Reject submission</h3>
          <p className="text-sm text-slate-500">Archives the submission as rejected. The file is retained — you can still delete it permanently later if needed. If the maker just needs to fix something, use <strong>Request changes</strong> instead.</p>
        </div>
        <div>
          <label className="label">Reason (optional)</label>
          <textarea className="input min-h-24" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Not relevant to this sensor / superseded by another document." />
        </div>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={confirm} disabled={busy} className="btn bg-red-600 text-white hover:bg-red-700">{busy ? 'Rejecting…' : 'Reject'}</button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Delete file permanently — explicit purge of a non-pending submission
========================================================= */
function DeleteFileModal({ submission, onClose, onDone }: any) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true); setErr(null);
    try {
      if (submission.storage_path) {
        const { error: storageErr } = await supabase.storage.from('documents').remove([submission.storage_path]);
        if (storageErr) console.warn('storage delete:', storageErr);
      }
      const upd = await supabase.from('document_submissions').update({ storage_path: null }).eq('id', submission.id);
      if (upd.error) throw upd.error;
      qc.invalidateQueries({ queryKey: ['review-queue'] });
      qc.invalidateQueries({ queryKey: ['submission', submission.id] });
      onDone();
    } catch (e: any) {
      setErr(e.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold">Delete file permanently?</h3>
          <p className="text-sm text-slate-500">This removes the uploaded file from storage for good. The submission record and its notes are kept for audit. Use this only for junk or sensitive uploads.</p>
        </div>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={confirm} disabled={busy} className="btn bg-red-600 text-white hover:bg-red-700">{busy ? 'Deleting…' : 'Delete permanently'}</button>
        </div>
      </div>
    </div>
  );
}
