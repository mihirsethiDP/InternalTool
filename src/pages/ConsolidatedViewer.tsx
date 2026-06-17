import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, PencilLine, FileText, Wrench, Layers, ChevronUp, ChevronDown,
  ExternalLink, FlaskConical, Droplets, CalendarClock, CheckCircle2, Circle,
  FileStack, BookOpenText, History, CheckCheck, ScanSearch, Zap, Settings,
  Beaker, Cog, Hammer, Activity, MapPin, Terminal, Globe2, Sparkles, ChevronRight,
  BookOpen, Cpu, Search as SearchIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import { SECTION_LABEL, SECTION_ORDER, parseSections, CHECKLIST_SECTIONS } from '../lib/consolidated';
import { renderMarkdown, normalizeAnswerSteps } from '../lib/markdown';
import RevisionHistory from '../components/RevisionHistory';
import AnswerFeedback from '../components/AnswerFeedback';
import type { SubmissionSection } from '../lib/types';

export const SECTION_ICON: Record<SubmissionSection, React.ReactNode> = {
  troubleshooting: <Wrench size={15} strokeWidth={2} />,
  cleaning: <Droplets size={15} strokeWidth={2} />,
  calibration: <FlaskConical size={15} strokeWidth={2} />,
  verification: <CheckCheck size={15} strokeWidth={2} />,
  inspection: <ScanSearch size={15} strokeWidth={2} />,
  electrical: <Zap size={15} strokeWidth={2} />,
  configuration: <Settings size={15} strokeWidth={2} />,
  consumable: <Beaker size={15} strokeWidth={2} />,
  component: <Cog size={15} strokeWidth={2} />,
  preventive: <CalendarClock size={15} strokeWidth={2} />,
  corrective: <Hammer size={15} strokeWidth={2} />,
  data_quality: <Activity size={15} strokeWidth={2} />,
  install_improve: <MapPin size={15} strokeWidth={2} />,
  software: <Terminal size={15} strokeWidth={2} />,
  other: <Layers size={15} strokeWidth={2} />,
};

type ViewMode = 'docs' | 'consolidated';

export default function ConsolidatedViewer() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const initialQuery = params.get('q') ?? '';
  // The chat assistant deep-links to a specific work-type section.
  const initialSection = (params.get('section') as SubmissionSection | null) ?? null;
  // The chat assistant also passes its synthesized answer via router state, so
  // the document can show it "in focus" above the full reference.
  const chatAnswer: string | null = (location.state as any)?.answer ?? null;
  // If the user arrived from search with a query or a target section, open the
  // consolidated view directly so the highlight / scroll lands. Otherwise
  // default to the documents view.
  const [mode, setMode] = useState<ViewMode>(initialQuery || initialSection ? 'consolidated' : 'docs');
  const [highlight, setHighlight] = useState(initialQuery);
  const [activeSection, setActiveSection] = useState<SubmissionSection | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Focus mode: when arriving from chat with an answer, lead with the answer +
  // the matched section, and collapse the rest of the document (still one tap
  // away). Toggled off to read the whole reference.
  const [focusMode, setFocusMode] = useState<boolean>(Boolean(chatAnswer));
  const [expanded, setExpanded] = useState<Set<SubmissionSection>>(new Set());
  const toggleExpand = (s: SubmissionSection) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<SubmissionSection, HTMLElement | null>>>({});
  const marksRef = useRef<HTMLElement[]>([]);
  const didInitialScroll = useRef(false);
  const [matchIdx, setMatchIdx] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  const cdoc = useQuery({
    queryKey: ['consolidated-doc', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('consolidated_docs')
        .select('*, sensor_models(model_no, category_id, is_general, sensor_makes(name), sensor_categories(name))')
        .eq('id', id)
        .maybeSingle();
      return data;
    },
  });

  // General (category-level) guidance to layer under a specific model.
  const isGeneralDoc = Boolean(cdoc.data?.sensor_models?.is_general);
  const categoryId = cdoc.data?.sensor_models?.category_id ?? null;
  const generalDoc = useQuery({
    queryKey: ['general-doc', categoryId],
    queryFn: async () => {
      if (!categoryId) return null;
      const { data } = await supabase
        .from('consolidated_docs')
        .select('content_markdown, sensor_models!inner(category_id, is_general)')
        .eq('sensor_models.category_id', categoryId)
        .eq('sensor_models.is_general', true)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(categoryId) && !isGeneralDoc,
  });

  const sources = useQuery({
    queryKey: ['consolidated-sources', cdoc.data?.sensor_model_id],
    queryFn: async () => {
      if (!cdoc.data?.sensor_model_id) return [];
      const { data } = await supabase
        .from('document_submissions')
        .select('id, title, storage_path, reviewed_at, page_count, document_types(label)')
        .eq('sensor_model_id', cdoc.data.sensor_model_id)
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false });
      return data ?? [];
    },
    enabled: Boolean(cdoc.data?.sensor_model_id),
  });

  // NOTE: document-content translation (Layer 2) is scaffolded but dormant:
  // migration 018 + scripts/translate-docs.mjs. When enabled, this is where
  // the cached translation would be loaded based on a language picker.
  const sections = useMemo(() => parseSections(cdoc.data?.content_markdown), [cdoc.data?.content_markdown]);
  const generalSections = useMemo(() => parseSections(generalDoc.data?.content_markdown), [generalDoc.data?.content_markdown]);
  const [showGeneral, setShowGeneral] = useState(true);
  const hasGeneral = SECTION_ORDER.some((s) => generalSections[s]);
  // A section is shown if the model has content, or (when general is on) general has content.
  const presentSections = SECTION_ORDER.filter((s) => sections[s] || (showGeneral && !isGeneralDoc && generalSections[s]));

  // Focus mode only "engages" when the chat actually pointed us at a section
  // that exists here — otherwise collapsing every section would hide everything.
  const matchPresent = Boolean(initialSection && presentSections.includes(initialSection));
  const focusActive = focusMode && matchPresent;
  const sectionOpen = (s: SubmissionSection) => !focusActive || s === initialSection || expanded.has(s);

  // Source files (inputs) grouped by their document TYPE — manuals, datasheets, etc.
  const sourcesByDocType = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const s of (sources.data ?? []) as any[]) {
      const dt = Array.isArray(s.document_types) ? s.document_types[0] : s.document_types;
      const k = dt?.label || 'Other document';
      (g[k] ??= []).push(s);
    }
    return g;
  }, [sources.data]);
  const docTypeGroups = Object.keys(sourcesByDocType);

  // Completeness is measured on OUTPUT work-type content only.
  const covered = (s: SubmissionSection) => Boolean(sections[s]);
  const coveredCount = CHECKLIST_SECTIONS.filter(covered).length;

  // Re-scan highlights (consolidated mode only)
  useEffect(() => {
    if (mode !== 'consolidated') return;
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
  }, [highlight, cdoc.data?.content_markdown, generalDoc.data?.content_markdown, showGeneral, mode]);

  // Deep-link from the chat assistant: scroll to the requested work-type
  // section once, on first load. Fires just before the highlight effect, so a
  // query match (if any) refines the position; otherwise the section stands.
  useEffect(() => {
    if (mode !== 'consolidated' || !initialSection || didInitialScroll.current) return;
    if (!presentSections.includes(initialSection)) return;
    const tm = setTimeout(() => {
      sectionRefs.current[initialSection]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(initialSection);
      didInitialScroll.current = true;
    }, 60);
    return () => clearTimeout(tm);
  }, [mode, initialSection, presentSections.join('|'), cdoc.data?.content_markdown]);

  // Track in-view section (consolidated mode only)
  useEffect(() => {
    if (mode !== 'consolidated') return;
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
  }, [presentSections.join('|'), cdoc.data?.content_markdown, mode]);

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
  if (!cdoc.data) return <div className="card text-sm">Document not found.</div>;

  const sm = cdoc.data.sensor_models;
  const title = `${sm?.sensor_makes?.name ?? ''} ${sm?.model_no ?? ''}`.trim();

  return (
    <div className="space-y-5">
      {/* Page-wide tinted backdrop */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-gradient-to-b from-brand-50 via-slate-50 to-white" />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl px-5 py-5 sm:px-7 sm:py-6 shadow-md bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
        {/* decorative glow */}
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-8 w-48 h-48 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/70 mb-2 font-semibold">
              <Cpu size={13} /> {t('viewer.eyebrow')}
            </div>
            {sm?.sensor_categories?.name && (
              <div className="mb-2">
                <span className="inline-flex items-center gap-1.5 bg-white text-brand-800 rounded-full pl-2.5 pr-3 py-1 text-xs font-bold shadow-sm ring-1 ring-white/50 uppercase tracking-wide">
                  <Layers size={13} strokeWidth={2.5} /> {sm.sensor_categories.name}
                </span>
              </div>
            )}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-tight">{title}</h1>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-white/15 ring-1 ring-white/10 text-white rounded-full px-2.5 py-1 text-xs font-medium">
                <FileStack size={12} /> {(sources.data ?? []).length} document{(sources.data ?? []).length === 1 ? '' : 's'}
              </span>
              <span className="inline-flex items-center gap-1 bg-white/15 ring-1 ring-white/10 text-white rounded-full px-2.5 py-1 text-xs font-medium">
                <CalendarClock size={12} /> {new Date(cdoc.data.last_updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => nav(-1)} aria-label={t('viewer.back')} className="tap inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-2 text-sm transition">
              <ArrowLeft size={15} /> <span className="hidden sm:inline">{t('viewer.back')}</span>
            </button>
            {isAdmin(profile) && (
              <button onClick={() => setHistoryOpen(true)} aria-label="History" className="tap inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-2 text-sm transition">
                <History size={15} /> <span className="hidden sm:inline">History</span>
              </button>
            )}
            {isAdmin(profile) && (
              <button onClick={() => nav(`/consolidated/${id}/edit`)} aria-label={t('viewer.edit')} className="tap inline-flex items-center gap-1.5 bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-3 py-2 text-sm font-semibold transition shadow-sm">
                <PencilLine size={15} /> <span className="hidden sm:inline">{t('viewer.edit')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ANSWER IN FOCUS — the chat assistant's synthesized answer, led prominently */}
      {chatAnswer && mode === 'consolidated' && (
        <AnswerFocusCard
          answer={chatAnswer}
          focusMode={focusActive}
          canFocus={matchPresent}
          onToggleFocus={() => setFocusMode((v) => !v)}
        />
      )}

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-5 sm:px-5 py-2.5 bg-white/90 backdrop-blur-md border-b border-slate-200 space-y-2">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shrink-0 shadow-sm">
            <button
              onClick={() => setMode('docs')}
              aria-pressed={mode === 'docs'}
              aria-label={t('viewer.documents')}
              className={`tap inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition ${
                mode === 'docs' ? 'bg-brand-700 text-white' : 'bg-white text-slate-700 hover:text-brand-700'
              }`}
            >
              <FileStack size={14} /> <span className="hidden sm:inline">{t('viewer.documents')}</span>
            </button>
            <button
              onClick={() => setMode('consolidated')}
              aria-pressed={mode === 'consolidated'}
              aria-label={t('viewer.consolidated')}
              className={`tap inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition border-l border-slate-200 ${
                mode === 'consolidated' ? 'bg-brand-700 text-white' : 'bg-white text-slate-700 hover:text-brand-700'
              }`}
            >
              <BookOpenText size={14} /> <span className="hidden sm:inline">{t('viewer.consolidated')}</span>
            </button>
          </div>

          <div className="flex-1" />

          {mode === 'consolidated' && (
            <div className="flex items-center gap-2">
              {!isGeneralDoc && hasGeneral && (
                <button
                  onClick={() => setShowGeneral((v) => !v)}
                  aria-pressed={showGeneral}
                  className={`tap inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    showGeneral ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-700'
                  }`}
                  title="Show general category-level guidance alongside this model"
                >
                  <Globe2 size={13} /> <span className="hidden sm:inline">General guidance</span>
                </button>
              )}
              {/* Find-in-page */}
              <div className="relative">
                <SearchIcon size={14} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  aria-label={t('viewer.highlight')}
                  className="rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-sm w-32 sm:w-48 focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15 outline-none"
                  value={highlight}
                  onChange={(e) => setHighlight(e.target.value)}
                  placeholder={t('viewer.highlight')}
                />
              </div>
              {highlight && (
                <>
                  <span className="muted text-xs whitespace-nowrap hidden sm:inline">{matchCount > 0 ? `${matchIdx + 1} / ${matchCount}` : '0'}</span>
                  <button onClick={() => goTo(matchIdx - 1)} disabled={matchCount === 0} aria-label="Previous match"
                    className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 w-8 h-8 flex items-center justify-center">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => goTo(matchIdx + 1)} disabled={matchCount === 0} aria-label="Next match"
                    className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 w-8 h-8 flex items-center justify-center">
                    <ChevronDown size={14} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Section quick-nav — horizontally scrollable on mobile */}
        {mode === 'consolidated' && presentSections.length > 0 && (
          <nav aria-label="Jump to section" className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1 scrollbar-thin">
            {presentSections.map((s) => (
              <button
                key={s}
                onClick={() => scrollToSection(s)}
                aria-current={activeSection === s ? 'true' : undefined}
                className={`tap inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition whitespace-nowrap shrink-0 ${
                  activeSection === s
                    ? 'bg-brand-700 text-white border-brand-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-brand-700 hover:text-brand-700'
                }`}
              >
                {SECTION_ICON[s]}
                {SECTION_LABEL[s]}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Main column */}
        <div ref={containerRef} className="space-y-5 min-w-0">

          {/* DOCUMENTS MODE: originals grouped by category */}
          {mode === 'docs' && (
            <>
              {docTypeGroups.length === 0 && (
                <div className="card text-sm text-slate-500 text-center py-10">
                  {t('viewer.noDocs')}
                </div>
              )}
              {docTypeGroups.map((label) => (
                <section key={label} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-3 bg-brand-50/60 border-b border-slate-200">
                    <span className="bg-brand-700 text-white rounded-md w-7 h-7 flex items-center justify-center shrink-0">
                      <FileText size={15} strokeWidth={2} />
                    </span>
                    <h2 className="text-sm font-semibold text-brand-900 tracking-tight">{label}</h2>
                    <span className="muted text-xs ml-auto">{sourcesByDocType[label].length}</span>
                  </div>
                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {sourcesByDocType[label].map((doc: any) => (
                      <button key={doc.id} onClick={() => openSource(doc.storage_path)}
                              className="group flex items-start gap-2.5 text-left rounded-lg border border-slate-200 hover:border-brand-700 p-3 transition">
                        <span className="bg-brand-50 text-brand-700 rounded-md w-9 h-9 flex items-center justify-center shrink-0">
                          <FileText size={15} strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-900 truncate group-hover:text-brand-700 transition">{doc.title}</span>
                          <span className="block muted text-xs mt-0.5">
                            {doc.page_count ? `${doc.page_count} pages · ` : ''}approved {new Date(doc.reviewed_at).toLocaleDateString()}
                          </span>
                        </span>
                        <ExternalLink size={13} className="text-slate-300 group-hover:text-brand-700 transition shrink-0 mt-1" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}

              {presentSections.length > 0 && (
                <button
                  onClick={() => setMode('consolidated')}
                  className="w-full bg-white rounded-xl border border-dashed border-slate-300 hover:border-brand-700 text-slate-600 hover:text-brand-700 px-5 py-4 text-sm font-medium inline-flex items-center justify-center gap-2 transition"
                >
                  <BookOpenText size={16} />
                  {t('viewer.preferConsolidated')}
                </button>
              )}
            </>
          )}

          {/* CONSOLIDATED MODE */}
          {mode === 'consolidated' && (
            <>
              {presentSections.length === 0 && (
                <div className="card text-sm text-slate-500 text-center py-10">
                  {t('viewer.noConsolidated')}
                </div>
              )}
              {focusActive && (
                <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                  <span className="inline-flex items-center gap-1 font-medium text-brand-700"><Sparkles size={13} /> Most relevant section shown</span>
                  <span className="text-slate-300 hidden sm:inline">·</span>
                  <span className="hidden sm:inline">others collapsed below — tap to open</span>
                </div>
              )}
              {presentSections.map((s) => {
                const isMatch = s === initialSection;
                const open = sectionOpen(s);
                const collapsible = focusActive && !isMatch;
                return (
                <section
                  key={s}
                  data-section={s}
                  ref={(el) => { sectionRefs.current[s] = el; }}
                  className={`bg-white rounded-2xl border overflow-hidden scroll-mt-24 transition ${
                    isMatch && chatAnswer ? 'border-brand-300 ring-2 ring-brand-200 shadow-md' : 'border-slate-200 shadow-sm'
                  }`}
                >
                  <button
                    type="button"
                    onClick={collapsible ? () => toggleExpand(s) : undefined}
                    aria-expanded={collapsible ? open : undefined}
                    className={`w-full flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-200 text-left ${
                      isMatch && chatAnswer ? 'bg-gradient-to-r from-brand-50 to-white' : 'bg-slate-50/80'
                    } ${collapsible ? 'cursor-pointer hover:bg-slate-100/80 transition' : 'cursor-default'}`}
                  >
                    <span className="bg-brand-700 text-white rounded-lg w-8 h-8 flex items-center justify-center shrink-0 shadow-sm">
                      {SECTION_ICON[s]}
                    </span>
                    <h2 className="text-sm font-semibold text-brand-900 tracking-tight flex-1">{SECTION_LABEL[s]}</h2>
                    {isMatch && chatAnswer && (
                      <span className="badge-blue text-[10px] shrink-0">Relevant</span>
                    )}
                    {collapsible && (
                      <ChevronRight size={18} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                    )}
                  </button>

                  {open && (
                    <>
                      {/* Model-specific content */}
                      {sections[s] && (
                        <div
                          className="doc-prose px-4 sm:px-6 py-5"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(sections[s], highlight) }}
                        />
                      )}

                      {/* General (category-level) guidance, layered below */}
                      {showGeneral && !isGeneralDoc && generalSections[s] && (
                        <div className={`px-4 sm:px-6 py-5 bg-slate-50/70 ${sections[s] ? 'border-t border-slate-200' : ''}`}>
                          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-2">
                            <Globe2 size={12} />
                            General {cdoc.data?.sensor_models?.sensor_categories?.name} guidance
                          </div>
                          <div
                            className="doc-prose"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(generalSections[s], highlight) }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </section>
                );
              })}
            </>
          )}

          {/* Answer feedback — did this actually solve the operator's problem? */}
          {((mode === 'consolidated' && presentSections.length > 0) || (mode === 'docs' && docTypeGroups.length > 0)) && (
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <AnswerFeedback
                query={highlight || undefined}
                consolidatedDocId={id}
                sensorModelId={cdoc.data?.sensor_model_id}
                source="viewer"
              />
            </div>
          )}
        </div>

        {/* Sidebar: documentation completeness */}
        <aside className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden lg:sticky lg:top-16">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide font-semibold text-slate-500">{t('viewer.docStatus')}</span>
              <span className={`text-xs font-semibold ${coveredCount === CHECKLIST_SECTIONS.length ? 'text-emerald-600' : 'text-amber-600'}`}>
                {coveredCount}/{CHECKLIST_SECTIONS.length}
              </span>
            </div>
            <div className="p-2">
              {CHECKLIST_SECTIONS.map((s) => (
                <div key={s} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
                  {covered(s)
                    ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    : <Circle size={15} className="text-slate-300 shrink-0" />}
                  <span className={`text-sm ${covered(s) ? 'text-slate-800' : 'text-slate-400'}`}>{SECTION_LABEL[s]}</span>
                </div>
              ))}
            </div>
            {coveredCount < CHECKLIST_SECTIONS.length && (
              <div className="px-4 py-3 border-t border-slate-100 bg-amber-50/50">
                <div className="text-xs text-amber-900 leading-relaxed">
                  {t('viewer.incomplete')}{' '}
                  <Link to="/docs-guide" className="font-semibold underline hover:text-amber-700">
                    {t('viewer.howToProcure')}
                  </Link>
                </div>
              </div>
            )}
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

      {historyOpen && cdoc.data && (
        <RevisionHistory
          docId={id!}
          sensorModelId={cdoc.data.sensor_model_id}
          currentMarkdown={cdoc.data.content_markdown ?? ''}
          onClose={() => setHistoryOpen(false)}
          onReverted={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}

// The chat assistant's synthesized answer, surfaced prominently at the top of
// the document ("in focus"), with a toggle to fold/unfold the rest of the page.
function AnswerFocusCard({ answer, focusMode, canFocus, onToggleFocus }: {
  answer: string;
  focusMode: boolean;
  canFocus: boolean;
  onToggleFocus: () => void;
}) {
  const html = useMemo(() => renderMarkdown(normalizeAnswerSteps(answer)), [answer]);
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white">
      {/* decorative glow */}
      <div aria-hidden className="pointer-events-none absolute -top-14 -right-8 w-44 h-44 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-6 w-40 h-40 rounded-full bg-brand-400/25 blur-3xl" />
      <div className="relative p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="inline-flex items-center gap-2.5 min-w-0">
            <span className="bg-white/15 ring-1 ring-white/20 text-white rounded-xl w-9 h-9 flex items-center justify-center shrink-0">
              <Sparkles size={17} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight">Answer</div>
              <div className="text-[11px] text-white/70 mt-0.5">Summarized from this document</div>
            </div>
          </div>
          {canFocus && (
            <button
              onClick={onToggleFocus}
              aria-pressed={focusMode}
              className="tap inline-flex items-center gap-1.5 rounded-lg bg-white/15 ring-1 ring-white/20 hover:bg-white/25 px-3 py-1.5 text-xs font-medium text-white transition shrink-0"
            >
              {focusMode ? <><BookOpen size={13} /> <span className="hidden sm:inline">Read</span> full document</> : <><Sparkles size={13} /> Focus answer</>}
            </button>
          )}
        </div>
        {/* Answer text in a white panel so the gradient frames it without hurting readability */}
        <div className="rounded-xl bg-white shadow-sm p-4">
          <div className="doc-prose text-slate-800" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <div className="mt-3 text-[11px] text-white/75 inline-flex items-center gap-1.5">
          <Sparkles size={11} /> AI summary of the verified content below — confirm against the source before acting.
        </div>
      </div>
    </div>
  );
}
