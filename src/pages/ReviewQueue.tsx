import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, Search as SearchIcon, Check, Loader2 } from 'lucide-react';
import SegmentedFilter from '../components/SegmentedFilter';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import { softDeleteSubmission } from '../lib/recycleBin';
import PageHeader from '../components/PageHeader';
import type { SubmissionSection } from '../lib/types';
import { SECTION_LABEL, SECTION_ORDER, SECTION_HINT } from '../lib/consolidated';
import { classifyDoc, MISMATCH_CONFIDENCE } from '../lib/classify';
import { approveSubmission } from '../lib/approve';

/* =========================================================
   List page — /review
========================================================= */
export function ReviewQueueList() {
  const { profile, loading } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<'pending' | 'changes_requested' | 'approved' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');

  const subs = useQuery({
    queryKey: ['review-queue', status],
    queryFn: async () => {
      let q = supabase
        .from('document_submissions')
        .select('*, document_types(label), sensor_models(model_no, sensor_makes(name))')
        .is('deleted_at', null)
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
          .from('document_submissions').select('id', { count: 'exact', head: true }).eq('status', s).is('deleted_at', null);
        r[s] = count ?? 0;
      }
      return r;
    },
  });

  if (loading) return <div className="card text-sm text-slate-500">Loading…</div>;
  if (!isAdmin(profile)) {
    return <div className="card text-sm">Admins only.</div>;
  }

  // Client-side search across title, make, model, and type.
  const q = search.trim().toLowerCase();
  const rows = (subs.data ?? []).filter((s: any) => {
    if (!q) return true;
    const hay = `${s.title} ${s.sensor_models?.sensor_makes?.name ?? ''} ${s.sensor_models?.model_no ?? ''} ${s.document_types?.label ?? ''}`.toLowerCase();
    return hay.includes(q);
  });

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

      <div className="relative">
        <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, make, model, or type…"
          className="input w-full pl-9"
        />
      </div>

      <div className="space-y-3">
        {rows.map((s: any) => (
          <div key={s.id} className="card-tight flex items-start gap-3 hover:border-brand-700 transition">
            <Link to={`/review/${s.id}`} className="flex items-start gap-3 min-w-0 flex-1">
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
            </Link>
            {/* One-click approve for pending items — same routine as the full screen. */}
            {s.status === 'pending' && <QuickApprove submission={s} qc={qc} />}
          </div>
        ))}
        {!subs.isLoading && rows.length === 0 && (
          <div className="card text-sm text-slate-500 text-center">{q ? 'No matches.' : 'Nothing here.'}</div>
        )}
      </div>
    </div>
  );
}

// Inline one-click approve for the queue: pick a section, approve. Uses the
// exact same routine as the full review screen (via approveSubmission).
function QuickApprove({ submission, qc }: { submission: any; qc: ReturnType<typeof useQueryClient> }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SubmissionSection>(submission.target_section || 'troubleshoot_repair');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true); setErr(null);
    try {
      await approveSubmission({ submission, editedText: submission.extracted_text || '', section, mode: 'replace', qc });
      // list refreshes via invalidation
    } catch (e: any) { setErr(e.message || 'Failed'); setBusy(false); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="tap shrink-0 inline-flex items-center gap-1 rounded-lg border border-emerald-300 text-emerald-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-50 transition">
        <Check size={13} /> Quick approve
      </button>
    );
  }
  return (
    <div className="shrink-0 flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
      <select value={section} onChange={(e) => setSection(e.target.value as SubmissionSection)}
        className="rounded-lg border border-slate-300 text-xs px-2 py-1.5 max-w-[9rem]">
        {SECTION_ORDER.map((s) => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}
      </select>
      <button onClick={go} disabled={busy}
        className="tap inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
      </button>
      <button onClick={() => setOpen(false)} className="tap text-slate-400 hover:text-slate-600 text-xs px-1">✕</button>
      {err && <span className="text-[11px] text-red-600">{err}</span>}
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
  const { profile, loading } = useAuth();
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

  // AI association check: does the document content match the sensor it's filed
  // under? Advisory — surfaced as a banner; the checker still decides.
  const aiClass = useQuery({
    queryKey: ['classify', id],
    enabled: Boolean(sub.data?.extracted_text),
    staleTime: 60 * 60 * 1000,
    queryFn: () => classifyDoc(sub.data?.extracted_text ?? '', sub.data?.title ?? ''),
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
  if (loading) return <div className="card text-sm text-slate-500">Loading…</div>;
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
              <button onClick={() => setDeleteOpen(true)} className="text-xs text-red-600 hover:underline">Move to recycle bin</button>
            )}
          </div>
        )}
      </div>

      {/* AI association check */}
      {aiClass.data && aiClass.data.confidence >= MISMATCH_CONFIDENCE && (
        aiClass.data.model_id === s.sensor_model_id ? (
          <div className="card border-emerald-200 bg-emerald-50/60 flex items-start gap-2.5">
            <span className="text-emerald-700 text-sm shrink-0">✓</span>
            <div className="text-sm text-emerald-900">
              <strong>AI agrees</strong> this document matches{' '}
              <strong>{s.sensor_models?.sensor_makes?.name} {s.sensor_models?.model_no}</strong>{' '}
              <span className="text-emerald-700">({Math.round(aiClass.data.confidence * 100)}% confident)</span>.
            </div>
          </div>
        ) : (
          <div className="card border-red-200 bg-red-50/70 flex items-start gap-2.5">
            <span className="text-red-600 text-base shrink-0">⚠</span>
            <div className="text-sm text-red-900 space-y-1">
              <div>
                <strong>Possible misfiling.</strong> This document reads like{' '}
                <strong>{aiClass.data.model_label}</strong>
                {aiClass.data.category_label && <> ({aiClass.data.category_label})</>}, but it's filed under{' '}
                <strong>{s.sensor_models?.sensor_makes?.name} {s.sensor_models?.model_no}</strong>.
              </div>
              {aiClass.data.reason && <div className="text-xs text-red-800 italic">“{aiClass.data.reason}”</div>}
              <div className="text-xs text-red-700">{Math.round(aiClass.data.confidence * 100)}% confident · re-check the sensor association before approving.</div>
            </div>
          </div>
        )
      )}

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
  const [section, setSection] = useState<SubmissionSection>(submission.target_section || 'troubleshoot_repair');
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true); setErr(null);
    try {
      await approveSubmission({ submission, editedText, section, mode, note, qc });
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
          <h3 className="text-lg font-bold">Approve submission</h3>
          <p className="text-sm text-slate-500">Choose which section of the consolidated reference receives this content.</p>
        </div>
        <div>
          <label className="label">Work-type section</label>
          <select className="input" value={section} onChange={(e) => setSection(e.target.value as SubmissionSection)}>
            {SECTION_ORDER.map((s) => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}
          </select>
          <div className="text-xs text-slate-500 mt-1.5">{SECTION_HINT[section]}</div>
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
   Delete submission — soft delete into the 30-day recycle bin
========================================================= */
function DeleteFileModal({ submission, onClose, onDone }: any) {
  const qc = useQueryClient();
  const { userId } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true); setErr(null);
    try {
      await softDeleteSubmission(submission.id, userId);
      qc.invalidateQueries({ queryKey: ['review-queue'] });
      qc.invalidateQueries({ queryKey: ['review-queue-counts'] });
      qc.invalidateQueries({ queryKey: ['submission', submission.id] });
      qc.invalidateQueries({ queryKey: ['bin-subs'] });
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
          <h3 className="text-lg font-bold">Move to recycle bin?</h3>
          <p className="text-sm text-slate-500">The submission and its file move to Admin → Recycle bin, restorable for 30 days. After that they're removed for good. You can also delete forever from the bin.</p>
        </div>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={confirm} disabled={busy} className="btn bg-red-600 text-white hover:bg-red-700">{busy ? 'Moving…' : 'Move to recycle bin'}</button>
        </div>
      </div>
    </div>
  );
}
