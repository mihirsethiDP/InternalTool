import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { History, X, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { writeConsolidated, lineDiff } from '../lib/consolidatedWrite';

interface Revision {
  id: string;
  content_markdown: string;
  change_kind: 'approval' | 'edit' | 'revert';
  note: string | null;
  changed_at: string;
  changed_by: string | null;
  author_email?: string | null;
}

const KIND_LABEL: Record<string, string> = {
  approval: 'Approved submission',
  edit: 'Manual edit',
  revert: 'Restored version',
};

export default function RevisionHistory({ docId, sensorModelId, currentMarkdown, onClose, onReverted }: {
  docId: string;
  sensorModelId: string;
  currentMarkdown: string;
  onClose: () => void;
  onReverted: () => void;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Revision | null>(null);

  const revisions = useQuery({
    queryKey: ['doc-revisions', docId],
    queryFn: async () => {
      const { data } = await supabase
        .from('consolidated_doc_revisions')
        .select('*, author:profiles(email)')
        .eq('consolidated_doc_id', docId)
        .order('changed_at', { ascending: false });
      return (data ?? []).map((r: any) => ({ ...r, author_email: r.author?.email })) as Revision[];
    },
  });

  const list = revisions.data ?? [];

  // Diff a chosen revision against the revision immediately AFTER it in time
  // (i.e. what the chosen one changed FROM → its own content). For the diff we
  // compare the selected revision to the one chronologically before it.
  function priorContent(rev: Revision): string {
    const idx = list.findIndex((r) => r.id === rev.id);
    // list is newest-first; the "prior" snapshot is the next index
    const prior = list[idx + 1];
    return prior ? prior.content_markdown : '';
  }

  async function restore(rev: Revision) {
    if (!confirm('Restore this version? The current content will be replaced (and saved as a new history entry).')) return;
    await writeConsolidated({
      docId,
      sensorModelId,
      markdown: rev.content_markdown,
      changeKind: 'revert',
      note: `Restored version from ${new Date(rev.changed_at).toLocaleString()}`,
    });
    qc.invalidateQueries({ queryKey: ['doc-revisions', docId] });
    qc.invalidateQueries({ queryKey: ['consolidated-doc', docId] });
    setSelected(null);
    onReverted();
  }

  const diff = selected ? lineDiff(priorContent(selected), selected.content_markdown) : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={18} className="text-brand-700" />
            <h3 className="text-lg font-bold tracking-tight">Version history</h3>
          </div>
          <button onClick={onClose} className="rounded-md hover:bg-slate-100 w-8 h-8 flex items-center justify-center"><X size={18} /></button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-0">
          {/* Timeline */}
          <div className="border-r border-slate-100 overflow-y-auto">
            {revisions.isLoading && <div className="muted p-4 text-sm">Loading…</div>}
            {!revisions.isLoading && list.length === 0 && (
              <div className="muted p-4 text-sm">No history yet.</div>
            )}
            <ul>
              {list.map((r, i) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelected(r)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 transition ${
                      selected?.id === r.id ? 'bg-brand-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900">{KIND_LABEL[r.change_kind] ?? r.change_kind}</span>
                      {i === 0 && <span className="badge-green text-[10px]">current</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{new Date(r.changed_at).toLocaleString()}</div>
                    {r.author_email && <div className="text-xs text-slate-400 truncate">{r.author_email}</div>}
                    {r.note && <div className="text-xs text-slate-600 mt-1 line-clamp-2">{r.note}</div>}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Diff panel */}
          <div className="overflow-y-auto p-4">
            {!selected ? (
              <div className="muted text-sm h-full flex items-center justify-center text-center px-6">
                Select a version to see what changed and restore it.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{KIND_LABEL[selected.change_kind]}</div>
                    <div className="text-xs text-slate-500">{new Date(selected.changed_at).toLocaleString()}{selected.author_email ? ` · ${selected.author_email}` : ''}</div>
                  </div>
                  {list[0]?.id !== selected.id && (
                    <button onClick={() => restore(selected)} className="inline-flex items-center gap-1.5 btn-secondary btn-sm">
                      <RotateCcw size={13} /> Restore this version
                    </button>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 overflow-hidden font-mono text-xs leading-relaxed">
                  {diff.length === 0 && <div className="p-3 text-slate-400">No earlier version to compare against — this is the first snapshot.</div>}
                  {diff.map((d, i) => (
                    <div key={i} className={
                      d.t === 'add' ? 'bg-emerald-50 text-emerald-900 px-3 py-0.5' :
                      d.t === 'del' ? 'bg-red-50 text-red-900 px-3 py-0.5' :
                      'text-slate-600 px-3 py-0.5'
                    }>
                      <span className="select-none text-slate-400 mr-2">{d.t === 'add' ? '+' : d.t === 'del' ? '−' : ' '}</span>
                      {d.line || ' '}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { History as HistoryIcon };
