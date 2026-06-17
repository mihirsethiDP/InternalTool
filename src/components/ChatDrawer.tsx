import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Send, ArrowRight, ExternalLink, ChevronDown, Sparkles, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { runSearch } from '../lib/search';
import { logUnanswered } from '../lib/telemetry';
import { SECTION_LABEL, parseSections } from '../lib/consolidated';
import { renderMarkdown } from '../lib/markdown';
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
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-slate-200 animate-[slideIn_180ms_ease-out]">
        {/* Header */}
        <div className="bg-brand-700 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/60 font-medium">{t('chat.assistant')}</div>
            <div className="text-base font-semibold tracking-tight mt-0.5">{t('chat.title')}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md hover:bg-white/10 w-8 h-8 flex items-center justify-center transition">
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {turns.length === 0 && (
            <div className="space-y-3">
              <div className="card-tight bg-white">
                <div className="text-sm text-slate-700 leading-relaxed">
                  {t('chat.intro')}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {t('chat.note')}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-3 mb-1">{t('chat.tryOne')}</div>
              <div className="flex flex-col gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="text-left text-sm bg-white border border-slate-200 hover:border-brand-700 hover:text-brand-700 rounded-lg px-3 py-2 transition">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn, i) => turn.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] bg-brand-700 text-white rounded-2xl rounded-tr-md px-4 py-2 text-sm">{turn.text}</div>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <div className="text-xs text-slate-500 px-1">{t('chat.assistant')}</div>
              {turn.loading ? (
                <div className="card-tight bg-white text-sm text-slate-500"><span className="animate-pulse">Thinking…</span></div>
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

              {/* Narrow-to-sensor probe, only under the most recent answered turn */}
              {!turn.loading && i === turns.length - 1 && !turn.narrowedLabel && (
                <NarrowRow onPick={(modelId, generalModelId, label) => narrowTurn(i, turn.query, modelId, generalModelId, label)} />
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 p-3 bg-white">
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chat.placeholder')}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20 outline-none"
            />
            <button type="submit" disabled={!input.trim()} aria-label="Send"
                    className="rounded-xl bg-brand-700 hover:bg-brand-800 text-white w-10 h-10 flex items-center justify-center disabled:opacity-50 transition">
              <Send size={16} />
            </button>
          </form>
          {turns.length > 0 && (
            <button onClick={() => setTurns([])} className="text-xs text-slate-500 hover:text-brand-700 mt-2">
              {t('chat.clearConversation')}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
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
    <div className="bg-brand-50/70 border border-brand-100 rounded-lg px-3 py-2.5 space-y-2">
      <div className="text-xs text-slate-600 font-medium">Know the sensor? Narrow to your make &amp; model:</div>
      <div className="flex gap-2 flex-wrap">
        <select className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-700"
          value={makeId} onChange={(e) => setMakeId(e.target.value)}>
          <option value="">Make…</option>
          {makes.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-700 disabled:opacity-50"
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
  const html = useMemo(() => renderMarkdown(answer), [answer]);
  return (
    <div className="card-tight bg-white space-y-2.5">
      {narrowedLabel && (
        <div className="text-[11px] text-slate-500">Scoped to <strong className="text-slate-700">{narrowedLabel}</strong></div>
      )}
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-brand-700">
        <Sparkles size={12} /> Answer
      </div>
      <div className="chat-prose" dangerouslySetInnerHTML={{ __html: html }} />

      {citations.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-1.5">Sources</div>
          <div className="flex flex-col gap-1">
            {citations.map((c, i) => (
              <button
                key={`${c.document_id}-${c.section}-${i}`}
                onClick={() => onOpenCitation(c)}
                className="group flex items-center gap-2 text-left rounded-md border border-slate-200 hover:border-brand-700 px-2.5 py-1.5 transition"
              >
                <span className="text-[10px] font-semibold text-slate-400 group-hover:text-brand-700 w-4 shrink-0">[{i + 1}]</span>
                <FileText size={12} className="text-slate-400 group-hover:text-brand-700 shrink-0" />
                <span className="min-w-0 flex-1 text-xs text-slate-700 truncate group-hover:text-brand-700">{c.document_title}</span>
                <span className="badge-blue shrink-0">{SECTION_LABEL[c.section]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-slate-400 pt-0.5">
        Generated from the documents above. Verify against the source before acting.
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
