import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import PageHeader from '../components/PageHeader';
import { SECTION_LABEL, SECTION_ORDER, parseSections } from '../lib/consolidated';
import type { SubmissionSection } from '../lib/types';

export default function ConsolidatedViewer() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { profile } = useAuth();
  const initialQuery = params.get('q') ?? '';
  const [highlight, setHighlight] = useState(initialQuery);

  const containerRef = useRef<HTMLDivElement>(null);
  const marksRef = useRef<HTMLElement[]>([]);
  const [matchIdx, setMatchIdx] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  const cdoc = useQuery({
    queryKey: ['consolidated-doc', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('consolidated_docs')
        .select('*, sensor_models(model_no, sensor_makes(name), sensor_categories(name))')
        .eq('id', id)
        .maybeSingle();
      return data;
    },
  });

  const sources = useQuery({
    queryKey: ['consolidated-sources', cdoc.data?.sensor_model_id],
    queryFn: async () => {
      if (!cdoc.data?.sensor_model_id) return [];
      const { data } = await supabase
        .from('document_submissions')
        .select('id, title, storage_path, target_section, reviewed_at')
        .eq('sensor_model_id', cdoc.data.sensor_model_id)
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false });
      return data ?? [];
    },
    enabled: Boolean(cdoc.data?.sensor_model_id),
  });

  const sections = useMemo(() => parseSections(cdoc.data?.content_markdown), [cdoc.data?.content_markdown]);

  // Re-scan for highlighted matches whenever highlight text or content changes
  useEffect(() => {
    const t = setTimeout(() => {
      if (!containerRef.current) return;
      const marks = Array.from(containerRef.current.querySelectorAll('mark')) as HTMLElement[];
      marksRef.current = marks;
      setMatchCount(marks.length);
      if (marks.length === 0) { setMatchIdx(0); return; }
      const start = 0;
      setMatchIdx(start);
      applyActive(start);
      marks[start].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => clearTimeout(t);
  }, [highlight, cdoc.data?.content_markdown]);

  function applyActive(idx: number) {
    marksRef.current.forEach((m, i) => {
      if (i === idx) m.classList.add('dp-mark-active');
      else m.classList.remove('dp-mark-active');
    });
  }
  function goTo(idx: number) {
    if (matchCount === 0) return;
    const safe = ((idx % matchCount) + matchCount) % matchCount;
    setMatchIdx(safe);
    applyActive(safe);
    marksRef.current[safe]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function openSource(storagePath: string | null) {
    if (!storagePath) return;
    const { data } = await supabase.storage.from('documents').createSignedUrl(storagePath, 600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  if (cdoc.isLoading) return <div className="muted p-6">Loading…</div>;
  if (!cdoc.data) return <div className="card text-sm">Consolidated document not found.</div>;

  const sm = cdoc.data.sensor_models;
  const title = `${sm?.sensor_makes?.name ?? ''} ${sm?.model_no ?? ''}`.trim();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Consolidated reference"
        icon="📘"
        title={title}
        subtitle={sm?.sensor_categories?.name}
        stats={[{ label: 'Sections', value: SECTION_ORDER.filter((s) => sections[s]).length }]}
        action={
          <div className="flex gap-2">
            <button onClick={() => nav(-1)} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-3 py-2 text-sm shadow-sm">← Back</button>
            {isAdmin(profile) && (
              <button onClick={() => nav(`/consolidated/${id}/edit`)} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-3 py-2 text-sm shadow-sm">✎ Edit</button>
            )}
          </div>
        }
      />

      {/* Highlight bar + match navigation */}
      <div className="card-tight flex items-center gap-3 flex-wrap">
        <div className="muted text-xs whitespace-nowrap">Highlight in document:</div>
        <input
          className="input flex-1 min-w-48"
          value={highlight}
          onChange={(e) => setHighlight(e.target.value)}
          placeholder="word or phrase…"
        />
        {highlight && (
          <div className="flex items-center gap-2 text-sm shrink-0">
            <span className="muted whitespace-nowrap">
              {matchCount > 0 ? `${matchIdx + 1} / ${matchCount}` : '0 matches'}
            </span>
            <button
              onClick={() => goTo(matchIdx - 1)}
              disabled={matchCount === 0}
              title="Previous match"
              className="rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 px-2 py-1 text-sm"
            >↑</button>
            <button
              onClick={() => goTo(matchIdx + 1)}
              disabled={matchCount === 0}
              title="Next match"
              className="rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 px-2 py-1 text-sm"
            >↓</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Body */}
        <div ref={containerRef} className="space-y-5">
          {/* Section nav */}
          <nav className="card-tight flex items-center gap-2 flex-wrap text-sm">
            {SECTION_ORDER.filter((s) => sections[s]).map((s) => (
              <a key={s} href={`#${s}`}
                 className="rounded-full px-3 py-1 text-xs font-medium border border-slate-200 hover:border-brand-700 hover:text-brand-700 transition">
                {SECTION_LABEL[s]}
              </a>
            ))}
            {SECTION_ORDER.every((s) => !sections[s]) && (
              <div className="muted text-sm">No content yet. Approved submissions will be merged in here.</div>
            )}
          </nav>

          {SECTION_ORDER.map((s) => sections[s] && (
            <section key={s} id={s} className="card scroll-mt-20">
              <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">
                {SECTION_LABEL[s]}
              </h2>
              <div
                className="prose-doc text-slate-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderText(sections[s], highlight) }}
              />
            </section>
          ))}
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          <div className="card-tight">
            <div className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">📄 Original PDFs</div>
            {(sources.data ?? []).length === 0 && <div className="muted text-sm">No source files yet.</div>}
            {(sources.data ?? []).map((s: any) => (
              <button key={s.id} onClick={() => openSource(s.storage_path)}
                      className="block w-full text-left rounded-md p-2 hover:bg-slate-50 transition">
                <div className="text-sm font-medium text-slate-900 truncate">{s.title}</div>
                <div className="muted text-xs">{SECTION_LABEL[(s.target_section ?? 'other') as SubmissionSection]} · {new Date(s.reviewed_at).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <style>{`
        .prose-doc { white-space: pre-wrap; }
        .prose-doc mark {
          background: rgba(255, 213, 0, 0.45);
          padding: 0 1px; border-radius: 2px;
          transition: background 120ms;
        }
        .prose-doc mark.dp-mark-active {
          background: rgba(255, 132, 0, 0.7);
          outline: 2px solid #fb923c;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function renderText(text: string, q?: string) {
  const escaped = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  if (!q?.trim()) return escaped;
  const terms = q.split(/\s+/).map((t) => t.replace(/[^a-zA-Z0-9]/g, '')).filter((t) => t.length > 1);
  if (terms.length === 0) return escaped;
  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`\\b(?:${pattern})\\w*`, 'gi');
  return escaped.replace(re, '<mark>$&</mark>');
}
