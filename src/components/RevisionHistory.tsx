import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { History, X, RotateCcw, Plus, Minus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { writeConsolidated, lineDiff } from '../lib/consolidatedWrite';
import { parseSections, SECTION_ORDER, SECTION_LABEL } from '../lib/consolidated';
import type { SubmissionSection } from '../lib/types';

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
  approval: 'Document approved',
  edit: 'Edited',
  revert: 'Restored an earlier version',
};

// Which sections differ between two markdown snapshots.
function changedSections(prevMd: string, curMd: string): SubmissionSection[] {
  const prev = parseSections(prevMd);
  const cur = parseSections(curMd);
  return SECTION_ORDER.filter((s) => (prev[s] || '').trim() !== (cur[s] || '').trim());
}

// Clean a markdown line into friendly display text.
function cleanLine(line: string): { text: string; kind: 'head' | 'bullet' | 'note' | 'plain' } {
  const l = line.trim();
  if (/^###\s+/.test(l)) return { text: l.replace(/^###\s+/, ''), kind: 'head' };
  if (/^[-*•]\s+/.test(l)) return { text: l.replace(/^[-*•]\s+/, ''), kind: 'bullet' };
  if (/^_(.+)_$/.test(l)) return { text: l.replace(/^_|_$/g, ''), kind: 'note' };
  if (/^---+$/.test(l)) return { text: '', kind: 'plain' };
  return { text: l, kind: 'plain' };
}

function LineList({ lines, tone }: { lines: string[]; tone: 'add' | 'del' }) {
  const visible = lines.map(cleanLine).filter((c) => c.text.length > 0);
  if (visible.length === 0) return null;
  const color = tone === 'add' ? 'text-emerald-900' : 'text-red-900 line-through decoration-red-300';
  return (
    <div className="space-y-1">
      {visible.map((c, i) => (
        <div key={i} className={`text-sm leading-relaxed ${color}`}>
          {c.kind === 'bullet' && <span className="text-slate-400 mr-1.5">•</span>}
          <span className={c.kind === 'head' ? 'font-semibold' : c.kind === 'note' ? 'italic text-xs opacity-80' : ''}>
            {c.text}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RevisionHistory({ docId, sensorModelId, onClose, onReverted }: {
  docId: string;
  sensorModelId: string;
  currentMarkdown?: string;
  onClose: () => void;
  onReverted: () => void;
}) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const selected = list.find((r) => r.id === selectedId) ?? list[0] ?? null;
  const isCurrent = selected && list[0]?.id === selected.id;

  function priorContent(rev: Revision): string {
    const idx = list.findIndex((r) => r.id === rev.id);
    const prior = list[idx + 1];
    return prior ? prior.content_markdown : '';
  }

  // Per-revision changed-section summary (compared to the one before it)
  const summaryFor = useMemo(() => {
    const map = new Map<string, SubmissionSection[]>();
    list.forEach((r, i) => {
      const prior = list[i + 1];
      map.set(r.id, changedSections(prior ? prior.content_markdown : '', r.content_markdown));
    });
    return map;
  }, [list]);

  async function restore(rev: Revision) {
    if (!confirm('Restore this version? The current content will be replaced. This is itself saved to history, so nothing is lost.')) return;
    await writeConsolidated({
      docId, sensorModelId,
      markdown: rev.content_markdown,
      changeKind: 'revert',
      note: `Restored the version from ${new Date(rev.changed_at).toLocaleString()}`,
    });
    qc.invalidateQueries({ queryKey: ['doc-revisions', docId] });
    qc.invalidateQueries({ queryKey: ['consolidated-doc', docId] });
    onReverted();
  }

  // Build per-section add/remove for the selected revision
  const sectionChanges = useMemo(() => {
    if (!selected) return [];
    const prev = parseSections(priorContent(selected));
    const cur = parseSections(selected.content_markdown);
    return SECTION_ORDER
      .map((s) => {
        const diff = lineDiff(prev[s] || '', cur[s] || '');
        const added = diff.filter((d) => d.t === 'add').map((d) => d.line);
        const removed = diff.filter((d) => d.t === 'del').map((d) => d.line);
        return { section: s, added, removed };
      })
      .filter((c) => c.added.some((l) => l.trim()) || c.removed.some((l) => l.trim()));
    // eslint-disable-next-line
  }, [selected?.id, list.length]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={18} className="text-brand-700" />
            <h3 className="text-lg font-bold tracking-tight">Change history</h3>
          </div>
          <button onClick={onClose} className="rounded-md hover:bg-slate-100 w-8 h-8 flex items-center justify-center"><X size={18} /></button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr] min-h-0">
          {/* Timeline */}
          <div className="border-r border-slate-100 overflow-y-auto">
            {revisions.isLoading && <div className="muted p-4 text-sm">Loading…</div>}
            {!revisions.isLoading && list.length === 0 && (
              <div className="muted p-4 text-sm">No changes recorded yet.</div>
            )}
            <ul>
              {list.map((r, i) => {
                const secs = summaryFor.get(r.id) ?? [];
                const active = (selected?.id ?? list[0]?.id) === r.id;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-50 transition ${active ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{KIND_LABEL[r.change_kind] ?? r.change_kind}</span>
                        {i === 0 && <span className="badge-green text-[10px]">current</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {timeAgo(r.changed_at)}{r.author_email ? ` · ${r.author_email.split('@')[0]}` : ''}
                      </div>
                      {secs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {secs.slice(0, 4).map((s) => (
                            <span key={s} className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{SECTION_LABEL[s]}</span>
                          ))}
                          {secs.length > 4 && <span className="text-[10px] text-slate-400">+{secs.length - 4}</span>}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Detail */}
          <div className="overflow-y-auto p-5">
            {!selected ? (
              <div className="muted text-sm h-full flex items-center justify-center text-center px-6">
                Select a version to see what changed.
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <div className="font-semibold text-slate-900">{KIND_LABEL[selected.change_kind]}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(selected.changed_at).toLocaleString()}{selected.author_email ? ` · ${selected.author_email}` : ''}
                    </div>
                    {selected.note && <div className="text-sm text-slate-600 mt-1.5">{selected.note}</div>}
                  </div>
                  {!isCurrent && (
                    <button onClick={() => restore(selected)} className="inline-flex items-center gap-1.5 btn-secondary btn-sm shrink-0">
                      <RotateCcw size={13} /> Restore this version
                    </button>
                  )}
                </div>

                {sectionChanges.length === 0 ? (
                  <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4 text-center">
                    This is the first recorded version — nothing to compare against yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                      What changed in this version
                    </div>
                    {sectionChanges.map((c) => (
                      <div key={c.section} className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-sm font-semibold text-brand-900">
                          {SECTION_LABEL[c.section]}
                        </div>
                        <div className="p-4 space-y-3">
                          {c.added.some((l) => l.trim()) && (
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1.5">
                                <Plus size={13} /> Added
                              </div>
                              <div className="border-l-2 border-emerald-300 pl-3">
                                <LineList lines={c.added} tone="add" />
                              </div>
                            </div>
                          )}
                          {c.removed.some((l) => l.trim()) && (
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-1.5">
                                <Minus size={13} /> Removed
                              </div>
                              <div className="border-l-2 border-red-300 pl-3">
                                <LineList lines={c.removed} tone="del" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
}
