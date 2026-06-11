import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, PencilLine, FileText, BookOpen, Wrench, ClipboardList,
  FileSpreadsheet, Layers, ChevronUp, ChevronDown, ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import { SECTION_LABEL, SECTION_ORDER, parseSections } from '../lib/consolidated';
import type { SubmissionSection } from '../lib/types';

const SECTION_ICON: Record<SubmissionSection, React.ReactNode> = {
  manual: <BookOpen size={15} strokeWidth={2} />,
  install: <ClipboardList size={15} strokeWidth={2} />,
  troubleshooting: <Wrench size={15} strokeWidth={2} />,
  datasheet: <FileSpreadsheet size={15} strokeWidth={2} />,
  other: <Layers size={15} strokeWidth={2} />,
};

export default function ConsolidatedViewer() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { profile } = useAuth();
  const initialQuery = params.get('q') ?? '';
  const [highlight, setHighlight] = useState(initialQuery);
  const [activeSection, setActiveSection] = useState<SubmissionSection | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<SubmissionSection, HTMLElement | null>>>({});
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
  const presentSections = SECTION_ORDER.filter((s) => sections[s]);

  // Re-scan highlights whenever the term or content changes
  useEffect(() => {
    const t = setTimeout(() => {
      if (!containerRef.current) return;
      const marks = Array.from(containerRef.current.querySelectorAll('mark')) as HTMLElement[];
      marksRef.current = marks;
      setMatchCount(marks.length);
      if (marks.length === 0) { setMatchIdx(0); return; }
      setMatchIdx(0);
      applyActive(0);
      marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => clearTimeout(t);
  }, [highlight, cdoc.data?.content_markdown]);

  // Track which section is in view for the section-nav active state
  useEffect(() => {
    const els = presentSections
      .map((s) => sectionRefs.current[s])
      .filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => (e.target as HTMLElement).dataset.section as SubmissionSection);
        if (visible.length) setActiveSection(visible[0]);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [presentSections.join('|'), cdoc.data?.content_markdown]);

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

  function scrollToSection(s: SubmissionSection) {
    sectionRefs.current[s]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-brand-700 text-white rounded-xl px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/60 mb-1.5 font-medium">Consolidated reference</div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              {sm?.sensor_categories?.name && (
                <span className="bg-white/10 text-white/90 rounded-md px-2 py-0.5 text-xs font-medium">{sm.sensor_categories.name}</span>
              )}
              <span className="bg-white/10 text-white/90 rounded-md px-2 py-0.5 text-xs font-medium">
                {presentSections.length} section{presentSections.length === 1 ? '' : 's'}
              </span>
              <span className="bg-white/10 text-white/90 rounded-md px-2 py-0.5 text-xs font-medium">
                Updated {new Date(cdoc.data.last_updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => nav(-1)} className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md px-3 py-2 text-sm transition">
              <ArrowLeft size={15} /> Back
            </button>
            {isAdmin(profile) && (
              <button onClick={() => nav(`/consolidated/${id}/edit`)} className="inline-flex items-center gap-1.5 bg-white text-brand-700 hover:bg-slate-100 rounded-md px-3 py-2 text-sm font-medium transition">
                <PencilLine size={15} /> Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sticky toolbar: section tabs + highlight + match nav */}
      <div className="sticky top-0 z-30 -mx-5 px-5 py-2.5 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Section tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {presentSections.map((s) => (
              <button
                key={s}
                onClick={() => scrollToSection(s)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition ${
                  activeSection === s
                    ? 'bg-brand-700 text-white border-brand-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-brand-700 hover:text-brand-700'
                }`}
              >
                {SECTION_ICON[s]}
                {SECTION_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Highlight + match nav */}
          <div className="flex items-center gap-2">
            <input
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-52 focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15 outline-none"
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="Highlight in document…"
            />
            {highlight && (
              <>
                <span className="muted text-xs whitespace-nowrap">
                  {matchCount > 0 ? `${matchIdx + 1} / ${matchCount}` : '0'}
                </span>
                <button onClick={() => goTo(matchIdx - 1)} disabled={matchCount === 0} title="Previous match"
                  className="rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 w-7 h-7 flex items-center justify-center">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => goTo(matchIdx + 1)} disabled={matchCount === 0} title="Next match"
                  className="rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 w-7 h-7 flex items-center justify-center">
                  <ChevronDown size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Body */}
        <div ref={containerRef} className="space-y-5 min-w-0">
          {presentSections.length === 0 && (
            <div className="card text-sm text-slate-500 text-center py-10">
              No content yet. Approved submissions will be merged in here.
            </div>
          )}

          {presentSections.map((s) => (
            <section
              key={s}
              data-section={s}
              ref={(el) => { sectionRefs.current[s] = el; }}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden scroll-mt-20"
            >
              {/* Section header band */}
              <div className="flex items-center gap-2.5 px-6 py-3.5 bg-brand-50/60 border-b border-slate-200">
                <span className="bg-brand-700 text-white rounded-md w-7 h-7 flex items-center justify-center shrink-0">
                  {SECTION_ICON[s]}
                </span>
                <h2 className="text-sm font-semibold text-brand-900 tracking-tight">{SECTION_LABEL[s]}</h2>
              </div>
              <div
                className="doc-prose px-6 py-5"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(sections[s], highlight) }}
              />
            </section>
          ))}
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden lg:sticky lg:top-16">
            <div className="px-4 py-3 border-b border-slate-100 text-xs uppercase tracking-wide font-semibold text-slate-500">
              Original PDFs
            </div>
            <div className="p-2">
              {(sources.data ?? []).length === 0 && (
                <div className="muted text-sm px-2 py-3">No source files yet.</div>
              )}
              {(sources.data ?? []).map((s: any) => (
                <button key={s.id} onClick={() => openSource(s.storage_path)}
                        className="group flex items-start gap-2.5 w-full text-left rounded-lg p-2.5 hover:bg-slate-50 transition">
                  <span className="bg-brand-50 text-brand-700 rounded-md w-8 h-8 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText size={14} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900 truncate group-hover:text-brand-700 transition">{s.title}</span>
                    <span className="block muted text-xs mt-0.5">
                      {SECTION_LABEL[(s.target_section ?? 'other') as SubmissionSection]} · {new Date(s.reviewed_at).toLocaleDateString()}
                    </span>
                  </span>
                  <ExternalLink size={13} className="text-slate-300 group-hover:text-brand-700 transition shrink-0 mt-1.5" />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .doc-prose { color: #1f2937; font-size: 0.925rem; line-height: 1.7; }
        .doc-prose > * + * { margin-top: 0.65rem; }
        .doc-prose h2 { font-size: 1.05rem; font-weight: 600; color: #193458; margin-top: 1.4rem; padding-bottom: 0.3rem; border-bottom: 1px solid #e2e8f0; }
        .doc-prose h3 { font-size: 0.975rem; font-weight: 600; color: #2a4470; margin-top: 1.1rem; }
        .doc-prose ul { list-style: disc; padding-left: 1.5rem; }
        .doc-prose ol { list-style: decimal; padding-left: 1.5rem; }
        .doc-prose li { margin: 0.25rem 0; padding-left: 0.15rem; }
        .doc-prose li::marker { color: #193458; }
        .doc-prose blockquote { border-left: 3px solid #cbd5e1; padding: 0.2rem 0 0.2rem 0.9rem; color: #475569; }
        .doc-prose hr { border: none; border-top: 1px dashed #cbd5e1; margin: 1.2rem 0; }
        .doc-prose .doc-note { display: block; background: #eef2f7; color: #2a4470; border-left: 3px solid #193458; border-radius: 0 6px 6px 0; padding: 0.45rem 0.8rem; font-size: 0.8rem; font-style: italic; }
        .doc-prose strong { color: #0f2747; font-weight: 600; }
        .doc-prose mark {
          background: rgba(255, 213, 0, 0.45);
          padding: 0 1px; border-radius: 2px;
          transition: background 120ms;
        }
        .doc-prose mark.dp-mark-active {
          background: rgba(255, 132, 0, 0.7);
          outline: 2px solid #fb923c;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

/* ---------- Lightweight markdown -> HTML renderer ----------
   Handles what our editor + approval pipeline actually produce:
   headings (## ###), bullet/numbered lists, bold/italic, "_..._"
   appended-note lines, "---" separators, "Issue N -" patterns get
   bolded lead-ins. Everything is escaped first, so injection-safe. */
function renderMarkdown(body: string, q?: string): string {
  const lines = (body ?? '').split(/\r?\n/);
  const out: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let para: string[] = [];

  function closeList() { if (inList) { out.push(`</${inList}>`); inList = null; } }
  function flushPara() {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^\s*$/.test(line)) { flushPara(); closeList(); continue; }

    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) { flushPara(); closeList(); out.push(`<h3>${inline(h3[1])}</h3>`); continue; }
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) { flushPara(); closeList(); out.push(`<h2>${inline(h2[1])}</h2>`); continue; }

    if (/^---+\s*$/.test(line)) { flushPara(); closeList(); out.push('<hr/>'); continue; }

    // "_Appended from ..._" note lines → styled callout
    const note = line.match(/^_(.+)_$/);
    if (note) { flushPara(); closeList(); out.push(`<span class="doc-note">${inline(note[1])}</span>`); continue; }

    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${inline(ol[2])}</li>`);
      continue;
    }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const bq = line.match(/^>\s?(.*)$/);
    if (bq) { flushPara(); closeList(); out.push(`<blockquote>${inline(bq[1])}</blockquote>`); continue; }

    closeList();
    para.push(line);
  }
  flushPara();
  closeList();

  let html = out.join('\n');
  // Bold "Issue N -" lead-ins for scannability
  html = html.replace(/(Issue \d+)(\s*[—-])/g, '<strong>$1</strong>$2');
  if (q?.trim()) html = applyHighlight(html, q);
  return html;
}

function inline(s: string): string {
  let t = s
    .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  // bold / italic (escape-safe since input already escaped)
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(?<![\w*])\*([^*]+)\*(?![\w*])/g, '<em>$1</em>');
  return t;
}

// Highlight inside HTML text nodes only (skip tags)
function applyHighlight(html: string, q: string): string {
  const terms = q.split(/\s+/).map((t) => t.replace(/[^a-zA-Z0-9]/g, '')).filter((t) => t.length > 1);
  if (terms.length === 0) return html;
  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`\\b(?:${pattern})\\w*`, 'gi');
  // Split on tags; only transform text segments
  return html.split(/(<[^>]+>)/).map((seg) => {
    if (seg.startsWith('<')) return seg;
    return seg.replace(re, '<mark>$&</mark>');
  }).join('');
}
