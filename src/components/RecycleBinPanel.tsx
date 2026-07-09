import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, RotateCcw, Loader2, FileText, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  RETENTION_DAYS, daysLeft, purgeExpired,
  restoreConsolidated, hardDeleteConsolidated,
  restoreSubmission, hardDeleteSubmission,
} from '../lib/recycleBin';

// Admin → Recycle bin. Everything soft-deleted sits here for 30 days:
// restore brings a reference back complete (search chunks rebuilt, its
// diagnostic flows returned as drafts); Delete forever is immediate.
// Items past 30 days are purged lazily whenever this panel is opened.

export default function RecycleBinPanel() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const docs = useQuery({
    queryKey: ['bin-docs'],
    queryFn: async () => (await supabase
      .from('consolidated_docs')
      .select('id, sensor_model_id, content_markdown, deleted_at, sensor_models(model_no, name, is_general, sensor_makes(name), sensor_categories(name))')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })).data ?? [],
  });
  const subs = useQuery({
    queryKey: ['bin-subs'],
    queryFn: async () => (await supabase
      .from('document_submissions')
      .select('id, title, status, storage_path, deleted_at, document_types(label)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })).data ?? [],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['bin-docs'] });
    qc.invalidateQueries({ queryKey: ['bin-subs'] });
    qc.invalidateQueries({ queryKey: ['admin-consolidated-docs'] });
    qc.invalidateQueries({ queryKey: ['recent-consolidated'] });
    qc.invalidateQueries({ queryKey: ['review-queue'] });
    qc.invalidateQueries({ queryKey: ['review-queue-counts'] });
  };

  // Lazy 30-day purge — free-tier friendly (no cron needed).
  useEffect(() => {
    purgeExpired().then((n) => { if (n > 0) { setNote(`${n} item(s) past ${RETENTION_DAYS} days were permanently removed.`); refresh(); } });
    // eslint-disable-next-line
  }, []);

  async function run(id: string, fn: () => Promise<unknown>, okNote: string) {
    setBusyId(id); setNote(null);
    try { await fn(); setNote(okNote); refresh(); }
    catch (e: any) { setNote(`Failed: ${e.message || e}`); }
    setBusyId(null);
  }

  const docLabel = (d: any) => {
    const sm = Array.isArray(d.sensor_models) ? d.sensor_models[0] : d.sensor_models;
    const mk = sm ? (Array.isArray(sm.sensor_makes) ? sm.sensor_makes[0] : sm.sensor_makes) : null;
    const cat = sm ? (Array.isArray(sm.sensor_categories) ? sm.sensor_categories[0] : sm.sensor_categories) : null;
    return sm?.is_general ? `${cat?.name ?? '?'} — category guidance` : `${mk?.name ?? ''} ${sm?.model_no || sm?.name || ''}`.trim();
  };

  const empty = !docs.isLoading && !subs.isLoading && (docs.data ?? []).length === 0 && (subs.data ?? []).length === 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Deleted items stay here for <strong>{RETENTION_DAYS} days</strong>, then are removed automatically.
        Restoring a reference brings back its search index and returns its diagnostic flows as drafts.
      </p>
      {note && <div className="text-xs rounded-lg bg-brand-50 border border-brand-200 text-brand-800 px-3 py-2">{note}</div>}

      {empty && (
        <div className="card text-sm text-slate-500 text-center py-8">
          <Trash2 size={22} className="mx-auto mb-2 text-slate-300" />
          The recycle bin is empty.
        </div>
      )}

      {(docs.data ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Consolidated references</div>
          {(docs.data ?? []).map((d: any) => (
            <BinRow key={d.id} icon={<BookOpen size={15} />} title={docLabel(d)}
              meta={`deleted ${new Date(d.deleted_at).toLocaleDateString()} · ${daysLeft(d.deleted_at)} day(s) left`}
              busy={busyId === d.id}
              onRestore={() => run(d.id, () => restoreConsolidated(d), 'Reference restored — flows are back as drafts for re-approval.')}
              onPurge={() => { if (confirm('Delete this reference forever? This cannot be undone.')) run(d.id, () => hardDeleteConsolidated(d.id), 'Deleted forever.'); }}
            />
          ))}
        </div>
      )}

      {(subs.data ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Document submissions</div>
          {(subs.data ?? []).map((s: any) => (
            <BinRow key={s.id} icon={<FileText size={15} />} title={s.title || '(untitled)'}
              meta={`${(Array.isArray(s.document_types) ? s.document_types[0] : s.document_types)?.label ?? ''} · ${s.status} · deleted ${new Date(s.deleted_at).toLocaleDateString()} · ${daysLeft(s.deleted_at)} day(s) left`}
              busy={busyId === s.id}
              onRestore={() => run(s.id, () => restoreSubmission(s.id), 'Submission restored.')}
              onPurge={() => { if (confirm('Delete this file forever? This cannot be undone.')) run(s.id, () => hardDeleteSubmission(s), 'Deleted forever.'); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BinRow({ icon, title, meta, busy, onRestore, onPurge }: {
  icon: React.ReactNode; title: string; meta: string; busy: boolean;
  onRestore: () => void; onPurge: () => void;
}) {
  return (
    <div className="card-tight flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-900 truncate">{title}</div>
        <div className="text-[11px] text-slate-500">{meta}</div>
      </div>
      {busy ? (
        <Loader2 size={16} className="animate-spin text-slate-400 shrink-0" />
      ) : (
        <div className="flex gap-1.5 shrink-0">
          <button onClick={onRestore} className="tap inline-flex items-center gap-1 rounded-md bg-brand-700 text-white px-2.5 py-1.5 text-xs font-medium hover:bg-brand-800">
            <RotateCcw size={12} /> Restore
          </button>
          <button onClick={onPurge} className="tap inline-flex items-center gap-1 rounded-md border border-slate-300 text-slate-600 px-2.5 py-1.5 text-xs hover:border-red-300 hover:text-red-600">
            <Trash2 size={12} /> Delete forever
          </button>
        </div>
      )}
    </div>
  );
}
