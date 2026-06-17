import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Send, ArrowRight, ExternalLink, ChevronDown, Sparkles, Bot, Trash2, Wrench, Cpu, LifeBuoy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { runSearch } from '../lib/search';
import { logUnanswered } from '../lib/telemetry';
import { SECTION_LABEL, parseSections } from '../lib/consolidated';
import { renderMarkdown, normalizeAnswerSteps } from '../lib/markdown';
import { useAuth } from '../lib/auth';
import AnswerFeedback from './AnswerFeedback';
import TicketModal from './TicketModal';
import type { SubmissionSection } from '../lib/types';

interface Hit {
  document_id: string;
  document_title: string;
  section: SubmissionSection;
  snippet: string;
  rank: number;
  /** Full text of the matched work-type section, fetched lazily for inline display. */
  sectionBody?: string;
}
interface Citation {
  document_id: string;
  document_title: string;
  section: SubmissionSection;
}
type Turn =
  | { role: 'user'; text: string }
  | {
      role: 'bot';
      query: string;
      loading?: boolean;
      narrowedLabel?: string;
      // AI mode (Gemini RAG via the chat-answer Edge Function):
      answer?: string | null;
      citations?: Citation[];
      // Retrieval-fallback mode (used when the Edge Function isn't available):
      hits?: Hit[];
    };

// Result of one assistant turn: either a synthesized answer (+ citations) from
// the Edge Function, or — if that isn't deployed/available — retrieval hits.
interface AssistantResult {
  answer: string | null;
  citations: Citation[];
  hits: Hit[];
}

// Fetch the full matched work-type section for each hit so the assistant can
// show the relevant verified passage inline, rather than only a teaser snippet
// that forces the operator into the whole document.
async function enrichHits(hits: Hit[]): Promise<Hit[]> {
  const ids = [...new Set(hits.map((h) => h.document_id))];
  if (ids.length === 0) return hits;
  const { data } = await supabase
    .from('consolidated_docs')
    .select('id, content_markdown')
    .in('id', ids);
  const sectionsById = new Map<string, ReturnType<typeof parseSections>>();
  for (const d of (data ?? []) as any[]) sectionsById.set(d.id, parseSections(d.content_markdown));
  return hits.map((h) => ({ ...h, sectionBody: sectionsById.get(h.document_id)?.[h.section] || '' }));
}

// Ask the assistant. Prefers the Gemini RAG Edge Function (a synthesized,
// cited answer); if that isn't deployed or errors, degrades gracefully to
// retrieval-only hits so the chatbot keeps working. `fallback` supplies the
// retrieval results for the second path.
async function askAssistant(
  query: string,
  sensorModelId: string | null,
  fallback: () => Promise<Hit[]>,
): Promise<AssistantResult> {
  try {
    const { data, error } = await supabase.functions.invoke('chat-answer', {
      body: { query, sensor_model_id: sensorModelId },
    });
    if (!error && data && !(data as any).error) {
      const d = data as { answer: string | null; citations?: any[] };
      if (d.answer && d.answer.trim()) {
        return {
          answer: d.answer.trim(),
          citations: (d.citations ?? []).map((c) => ({
            document_id: c.document_id,
            document_title: (c.document_title ?? '').trim(),
            section: (c.section as SubmissionSection) ?? 'other',
          })),
          hits: [],
        };
      }
      // answer === null → the library genuinely has nothing; fall through to
      // the retrieval fallback (which will also come up empty and trigger the
      // "nothing found" card + unanswered logging).
    }
  } catch {
    // Edge Function not deployed / network error → retrieval-only.
  }
  const hits = await fallback();
  return { answer: null, citations: [], hits };
}

const SUGGESTIONS = [
  'UPCS-MAG-110 shows empty pipe error',
  'OCEMS pH reading is drifting',
  'How do I clean the EC probe?',
  'Flow meter shows zero despite flow',
];

export default function ChatDrawer({ open, onClose, seed, onSeedConsumed }: {
  open: boolean;
  onClose: () => void;
  seed?: string | null;
  onSeedConsumed?: () => void;
}) {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { email } = useAuth();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [ticket, setTicket] = useState<{ query?: string; description?: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusInput = () => inputRef.current?.focus();

  function openTicket(turn: Extract<Turn, { role: 'bot' }>) {
    const desc =
      `Question: ${turn.query}\n\n` +
      (turn.answer ? `Assistant answer:\n${turn.answer}\n\n` : '') +
      `This didn't resolve my issue.`;
    setTicket({ query: turn.query, description: desc });
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns]);

  // A seed question (from the homepage CTA etc.) fires once on open
  useEffect(() => {
    if (open && seed) {
      send(seed);
      onSeedConsumed?.();
    }
    // eslint-disable-next-line
  }, [open, seed]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock background scroll while the drawer is open so the page underneath
  // (and the fixed drawer) doesn't shift on mobile.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  async function send(query: string) {
    const q = query.trim();
    if (!q) return;
    setInput('');
    setTurns((t) => [
      ...t,
      { role: 'user', text: q },
      { role: 'bot', query: q, loading: true },
    ]);
    const result = await askAssistant(q, null, async () => {
      const { data } = await supabase.rpc('chat_search', { q, p_limit: 5 });
      return enrichHits((data as Hit[]) ?? []);
    });
    if (!result.answer && result.hits.length === 0) {
      logUnanswered({ query: q, source: 'chat' });
    }
    setTurns((t) => {
      const copy = [...t];
      for (let i = copy.length - 1; i >= 0; i--) {
        const turn = copy[i];
        if (turn.role === 'bot' && turn.loading) {
          copy[i] = { role: 'bot', query: q, loading: false, answer: result.answer, citations: result.citations, hits: result.hits };
          break;
        }
      }
      return copy;
    });
  }

  // Re-scope a bot turn to a specific sensor (+ its category general guidance)
  async function narrowTurn(turnIndex: number, query: string, modelId: string, generalModelId: string | null, label: string) {
    setTurns((t) => t.map((turn, i) => (i === turnIndex && turn.role === 'bot') ? { ...turn, loading: true } : turn));
    const result = await askAssistant(query, modelId, async () => {
      const [spec, gen] = await Promise.all([
        runSearch(query, { sensor_model_id: modelId }),
        generalModelId ? runSearch(query, { sensor_model_id: generalModelId }) : Promise.resolve({ hits: [] }),
      ]);
      const seen = new Set<string>();
      const merged: Hit[] = [...spec.hits, ...gen.hits]
        .filter((h) => { const k = h.document_id; if (seen.has(k)) return false; seen.add(k); return true; })
        .map((h) => ({
          document_id: h.document_id,
          document_title: (h.document_title ?? '').trim(),
          section: (h.type_label as SubmissionSection) ?? 'other',
          snippet: h.snippet,
          rank: h.rank,
        }));
      return enrichHits(merged);
    });
    setTurns((t) => t.map((turn, i) => (i === turnIndex && turn.role === 'bot')
      ? { ...turn, loading: false, narrowedLabel: label, answer: result.answer, citations: result.citations, hits: result.hits }
      : turn));
  }

  function openHit(query: string, hit: Hit) {
    onClose();
    const sec = hit.sectionBody ? `&section=${encodeURIComponent(hit.section)}` : '';
    nav(`/consolidated/${hit.document_id}?q=${encodeURIComponent(query)}${sec}`);
  }

  function openCitation(query: string, c: Citation, answer?: string) {
    onClose();
    nav(
      `/consolidated/${c.document_id}?q=${encodeURIComponent(query)}&section=${encodeURIComponent(c.section)}`,
      { state: answer ? { answer } : undefined },
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('chat.title')}
        className="relative bg-slate-50 w-full max-w-md h-[100dvh] flex flex-col overflow-hidden shadow-2xl animate-[slideIn_180ms_ease-out]"
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white px-4 sm:px-5 py-4">
          <div aria-hidden className="pointer-events-none absolute -top-12 -right-6 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="relative shrink-0">
              <span className="w-10 h-10 rounded-2xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
                <Bot size={20} strokeWidth={2} />
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-brand-800" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold tracking-tight leading-tight truncate">{t('chat.title')}</div>
              <div className="text-[11px] text-white/70 inline-flex items-center gap-1">
                <Sparkles size={11} /> {t('chat.assistant')}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close assistant" className="tap rounded-lg hover:bg-white/15 w-9 h-9 flex items-center justify-center transition shrink-0">
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} role="log" aria-live="polite" aria-label="Conversation" className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 space-y-4">
          {turns.length === 0 && (
            <div className="space-y-4">
              {/* Welcome bubble */}
              <div className="flex items-start gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot size={16} />
                </span>
                <div className="min-w-0 rounded-2xl rounded-tl-md bg-white border border-slate-200 shadow-sm px-3.5 py-3">
                  <div className="text-sm text-slate-700 leading-relaxed">{t('chat.intro')}</div>
                  <div className="text-xs text-slate-500 mt-1.5">{t('chat.note')}</div>
                </div>
              </div>
              {/* Suggestion chips */}
              <div className="pl-10">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-2">{t('chat.tryOne')}</div>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="tap group text-left text-sm bg-white border border-slate-200 hover:border-brand-700 rounded-xl px-3 py-2.5 transition shadow-sm flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0 group-hover:bg-brand-700 group-hover:text-white transition">
                        <Wrench size={14} />
                      </span>
                      <span className="flex-1 min-w-0 text-slate-700 group-hover:text-brand-800">{s}</span>
                      <ArrowRight size={14} className="text-slate-300 group-hover:text-brand-700 transition shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {turns.map((turn, i) => turn.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[82%] bg-gradient-to-br from-brand-600 to-brand-800 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm shadow-sm">{turn.text}</div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Bot size={16} />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
              {turn.loading ? (
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md bg-white border border-slate-200 shadow-sm px-3.5 py-3">
                  <span className="dp-typing"><span></span><span></span><span></span></span>
                  <span className="text-xs text-slate-400">{t('chat.title')} is thinking…</span>
                </div>
              ) : turn.answer ? (
                <AnswerCard
                  answer={turn.answer}
                  citations={turn.citations ?? []}
                  narrowedLabel={turn.narrowedLabel}
                  onOpenCitation={(c) => openCitation(turn.query, c, turn.answer ?? undefined)}
                />
              ) : (turn.hits && turn.hits.length > 0) ? (
                <>
                  <div className="card-tight bg-white text-sm text-slate-700">
                    {turn.narrowedLabel
                      ? <>Showing results for <strong>{turn.narrowedLabel}</strong>.</>
                      : t('chat.found', { count: turn.hits.length })}
                  </div>
                  {turn.hits.map((h) => (
                    <ChatHit key={h.document_id} hit={h} query={turn.query} onOpen={() => openHit(turn.query, h)} openLabel={t('chat.open')} />
                  ))}
                </>
              ) : (
                <div className="card-tight bg-white text-sm text-slate-600 space-y-2.5">
                  <div>{t('chat.nothing')}</div>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(turn.query + ' sensor troubleshooting')}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 hover:border-brand-700 hover:text-brand-700 px-3 py-1.5 text-xs font-medium text-slate-700 transition"
                  >
                    {t('chat.searchWeb')} <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {/* Did this help? — feedback + continue + log-a-ticket (tracked) */}
              {!turn.loading && (turn.answer || (turn.hits && turn.hits.length > 0)) && (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <AnswerFeedback
                    source="chat"
                    compact
                    query={turn.query}
                    consolidatedDocId={turn.answer ? (turn.citations?.[0]?.document_id ?? null) : (turn.hits?.[0]?.document_id ?? null)}
                    onContinue={focusInput}
                    onLogTicket={() => openTicket(turn)}
                  />
                </div>
              )}

              {/* Nothing found → still let them log a ticket */}
              {!turn.loading && !turn.answer && (!turn.hits || turn.hits.length === 0) && (
                <button
                  onClick={() => openTicket(turn)}
                  className="tap inline-flex items-center gap-1.5 rounded-md border border-slate-300 hover:border-brand-700 hover:text-brand-700 px-3 py-1.5 text-xs font-medium text-slate-700 transition"
                >
                  <LifeBuoy size={12} /> Log a support ticket
                </button>
              )}

              {/* Narrow-to-sensor probe, only under the most recent answered turn */}
              {!turn.loading && i === turns.length - 1 && !turn.narrowedLabel && (
                <NarrowRow onPick={(modelId, generalModelId, label) => narrowTurn(i, turn.query, modelId, generalModelId, label)} />
              )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 p-3 bg-white">
          {turns.length > 0 && (
            <div className="flex justify-end mb-2">
              <button onClick={() => setTurns([])} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700 transition">
                <Trash2 size={12} /> {t('chat.clearConversation')}
              </button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('chat.placeholder')}
                aria-label={t('chat.placeholder')}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 focus:bg-white pl-4 pr-3 py-3 text-sm focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20 outline-none transition"
              />
            </div>
            <button type="submit" disabled={!input.trim()} aria-label="Send message"
                    className="tap rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 hover:from-brand-700 hover:to-brand-900 text-white w-12 h-12 flex items-center justify-center disabled:opacity-40 disabled:grayscale transition shadow-sm shrink-0">
              <Send size={17} />
            </button>
          </form>
        </div>
      </div>

      {ticket && (
        <TicketModal
          onClose={() => setTicket(null)}
          query={ticket.query}
          defaultDescription={ticket.description}
          userEmail={email}
        />
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .dp-typing { display: inline-flex; gap: 3px; align-items: center; }
        .dp-typing span { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; animation: dpBounce 1.2s infinite ease-in-out; }
        .dp-typing span:nth-child(2) { animation-delay: 0.15s; }
        .dp-typing span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes dpBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
        .chat-prose { color: #334155; font-size: 0.8rem; line-height: 1.6; }
        .chat-prose > * + * { margin-top: 0.4rem; }
        .chat-prose h2 { font-size: 0.82rem; font-weight: 600; color: #193458; margin-top: 0.6rem; }
        .chat-prose h3 { font-size: 0.8rem; font-weight: 600; color: #2a4470; margin-top: 0.5rem; }
        .chat-prose ul { list-style: disc; padding-left: 1.1rem; }
        .chat-prose ol { list-style: decimal; padding-left: 1.1rem; }
        .chat-prose li { margin: 0.12rem 0; }
        .chat-prose li::marker { color: #193458; }
        .chat-prose blockquote { border-left: 3px solid #cbd5e1; padding-left: 0.6rem; color: #475569; }
        .chat-prose hr { border: none; border-top: 1px dashed #cbd5e1; margin: 0.6rem 0; }
        .chat-prose .doc-note { display: block; background: #eef2f7; color: #2a4470; border-left: 3px solid #193458; border-radius: 0 5px 5px 0; padding: 0.3rem 0.6rem; font-size: 0.74rem; font-style: italic; }
        .chat-prose strong { color: #0f2747; font-weight: 600; }
        .chat-prose mark { background: rgba(255, 213, 0, 0.45); padding: 0 1px; border-radius: 2px; }
      `}</style>
    </div>
  );
}

// "Know the sensor?" probe shown under the latest answer.
function NarrowRow({ onPick }: { onPick: (modelId: string, generalModelId: string | null, label: string) => void }) {
  const [makeId, setMakeId] = useState('');
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });
  const models = useQuery({
    queryKey: ['models-by-make', makeId],
    queryFn: async () => makeId
      ? (await supabase.from('sensor_models').select('id, model_no, name, category_id').eq('make_id', makeId).eq('is_general', false).order('model_no')).data ?? []
      : [],
    enabled: Boolean(makeId),
  });
  const generalModels = useQuery({
    queryKey: ['general-models'],
    queryFn: async () => (await supabase.from('sensor_models').select('id, category_id').eq('is_general', true)).data ?? [],
  });

  function pick(modelId: string) {
    const m = (models.data ?? []).find((x: any) => x.id === modelId);
    if (!m) return;
    const makeName = (makes.data ?? []).find((x: any) => x.id === makeId)?.name ?? '';
    const generalModelId = (generalModels.data ?? []).find((g: any) => g.category_id === m.category_id)?.id ?? null;
    onPick(modelId, generalModelId, `${makeName} ${m.model_no || m.name}`.trim());
  }

  return (
    <div className="bg-gradient-to-br from-brand-50 to-white border border-brand-100 rounded-xl px-3 py-3 space-y-2 shadow-sm">
      <div className="text-xs text-brand-800 font-semibold inline-flex items-center gap-1.5">
        <Cpu size={13} /> Know the sensor? Narrow to your make &amp; model
      </div>
      <div className="flex gap-2 flex-wrap">
        <select aria-label="Make" className="tap flex-1 min-w-[8rem] rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15"
          value={makeId} onChange={(e) => setMakeId(e.target.value)}>
          <option value="">Make…</option>
          {makes.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select aria-label="Model" className="tap flex-1 min-w-[8rem] rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15 disabled:opacity-50"
          value="" onChange={(e) => pick(e.target.value)} disabled={!makeId}>
          <option value="">{makeId ? 'Model…' : 'Pick a make first'}</option>
          {models.data?.map((m: any) => <option key={m.id} value={m.id}>{m.model_no || m.name}</option>)}
        </select>
      </div>
    </div>
  );
}

// Synthesized answer (Gemini RAG): the model's grounded answer rendered as
// markdown, with the verified source documents listed as clickable citations.
function AnswerCard({ answer, citations, narrowedLabel, onOpenCitation }: {
  answer: string;
  citations: Citation[];
  narrowedLabel?: string;
  onOpenCitation: (c: Citation) => void;
}) {
  const html = useMemo(() => renderMarkdown(normalizeAnswerSteps(answer)), [answer]);
  return (
    <div className="rounded-2xl rounded-tl-md overflow-hidden border border-brand-200 shadow-sm bg-white">
      {/* Gradient header makes the synthesized answer stand out */}
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-600 to-brand-800 px-3.5 py-2 flex items-center justify-between gap-2">
        <span aria-hidden className="pointer-events-none absolute -top-8 -right-4 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
        <span className="relative inline-flex items-center gap-1.5 text-white text-[11px] font-semibold uppercase tracking-wide">
          <Sparkles size={12} /> Answer
        </span>
        {narrowedLabel && (
          <span className="relative text-[10px] text-white/85 truncate max-w-[55%]" title={narrowedLabel}>{narrowedLabel}</span>
        )}
      </div>

      <div className="p-3.5 space-y-2.5">
        <div className="chat-prose" dangerouslySetInnerHTML={{ __html: html }} />

        {citations.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-1.5">Sources</div>
            <div className="flex flex-col gap-1">
              {citations.map((c, i) => (
                <button
                  key={`${c.document_id}-${c.section}-${i}`}
                  onClick={() => onOpenCitation(c)}
                  className="tap group flex items-center gap-2 text-left rounded-lg border border-slate-200 hover:border-brand-700 hover:bg-brand-50/40 px-2.5 py-1.5 transition"
                >
                  <span className="text-[10px] font-bold text-brand-700 bg-brand-50 rounded w-5 h-5 flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-xs text-slate-700 truncate group-hover:text-brand-700">{c.document_title}</span>
                  <span className="badge-blue shrink-0">{SECTION_LABEL[c.section]}</span>
                  <ArrowRight size={12} className="text-slate-300 group-hover:text-brand-700 transition shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-[10px] text-slate-400 inline-flex items-center gap-1">
          <Sparkles size={10} /> Generated from the sources below — verify before acting.
        </div>
      </div>
    </div>
  );
}

// A single answer card: shows the matched work-type section inline (the
// verified passage that actually answers the question), collapsed when long,
// with a deep-link straight to that section in the full document.
const COLLAPSE_CHARS = 360;

function ChatHit({ hit, query, onOpen, openLabel }: {
  hit: Hit;
  query: string;
  onOpen: () => void;
  openLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const body = (hit.sectionBody || hit.snippet || '').trim();
  const long = body.length > COLLAPSE_CHARS;
  const html = useMemo(() => renderMarkdown(body, query), [body, query]);

  return (
    <div className="card-tight bg-white">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span className="font-semibold text-slate-900 truncate text-sm">{hit.document_title.trim()}</span>
        <span className="badge-blue">{SECTION_LABEL[hit.section]}</span>
      </div>

      <div className="relative">
        <div
          className={`chat-prose ${long && !expanded ? 'max-h-32 overflow-hidden' : ''}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {long && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>

      {long && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700 mt-1.5 font-medium"
        >
          <ChevronDown size={13} className={`transition ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Show less' : 'Show full section'}
        </button>
      )}

      <div className="mt-2 pt-2 border-t border-slate-100">
        <button onClick={onOpen} className="inline-flex items-center gap-1 text-xs text-brand-700 font-medium hover:gap-1.5 transition-all">
          {openLabel} <ArrowRight size={12} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
