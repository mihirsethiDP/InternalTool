import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Send, ArrowRight, ExternalLink, ChevronDown, Sparkles, Bot, Trash2, Wrench, Cpu, Globe, Compass, CheckCircle2, PhoneCall, GitBranch } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { runSearch } from '../lib/search';
import { logUnanswered, logEvent } from '../lib/telemetry';
import { SECTION_LABEL, parseSections } from '../lib/consolidated';
import { renderMarkdown, normalizeAnswerSteps } from '../lib/markdown';
import { conversationalReply } from '../lib/chatIntent';
import { matchRule, type RouteMatch } from '../lib/routing';
import { matchFlow, getNode, failTarget, fetchContacts, contactsForSkill, type DiagnosticFlow, type FlowNode, type EscalationContact } from '../lib/flows';
import { correctSpelling } from '../lib/lexicon';
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
      // Plain conversational reply (greeting / thanks / "move on" etc.) — no
      // doc search, no answer card, no feedback/sources.
      note?: string;
      // AI mode (Gemini RAG via the chat-answer Edge Function):
      answer?: string | null;
      citations?: Citation[];
      // Retrieval-fallback mode (used when the Edge Function isn't available):
      hits?: Hit[];
      // Web fallback (Tavily + Groq), fetched on demand from the not-found card:
      webLoading?: boolean;
      webAnswer?: { answer: string; sources: { title: string; url: string }[] } | null;
      // Router layer: an approved problem→procedure rule matched this question.
      routed?: RouteMatch | null;
      // Diagnostic flow runner: this turn shows one node of an approved flow.
      flowNode?: FlowNode;
      flowTitle?: string; // set on the first node so the user sees which flow started
      flowTerminal?: boolean; // resolve/escalate — end of the run (feedback shows here)
      escalateContacts?: EscalationContact[]; // resolved directory entries (make/global/per-plant)
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

// Replace the most-recent loading bot turn with a finished one.
function fillLoadingTurn(turns: Turn[], replacement: Turn): Turn[] {
  const copy = [...turns];
  for (let i = copy.length - 1; i >= 0; i--) {
    const t = copy[i];
    if (t.role === 'bot' && t.loading) { copy[i] = replacement; break; }
  }
  return copy;
}

// Retrieval scoped to a specific model (+ its category's general guidance),
// deduped — used for the make/model scope, both for the retrieval fallback and
// the narrow-this-turn action.
async function scopedRetrieve(query: string, modelId: string, generalModelId: string | null): Promise<Hit[]> {
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
}

// Retrieval scoped to a whole sensor TYPE (category) — for type-level answers
// before a specific model is known.
async function categoryRetrieve(query: string, categoryId: string): Promise<Hit[]> {
  const res = await runSearch(query, { category_id: categoryId });
  const merged: Hit[] = res.hits.map((h) => ({
    document_id: h.document_id,
    document_title: (h.document_title ?? '').trim(),
    section: (h.type_label as SubmissionSection) ?? 'other',
    snippet: h.snippet,
    rank: h.rank,
  }));
  return enrichHits(merged);
}

// Interpret a free-text message (elicitation/router level 1): sensor TYPE(s)
// ranked most-likely-first, the user's intent, a normalized restatement of a
// vague/misspelled problem, and any make/model the message itself mentions.
async function routeQuery(query: string): Promise<{
  categories: { id: string; name: string }[];
  top: { id: string; name: string; confidence: number } | null;
  intent?: 'troubleshoot' | 'howto' | 'info' | 'other';
  normalized?: string | null;
  slots?: { make: string | null; model: string | null };
} | null> {
  try {
    const { data, error } = await supabase.functions.invoke('chat-answer', { body: { mode: 'route', query } });
    if (error || !data || (data as any).error) return null;
    return data as any;
  } catch {
    return null;
  }
}

// Ask the assistant. Prefers the Groq RAG Edge Function (a synthesized, cited
// answer); if that isn't deployed or errors, degrades to retrieval-only hits.
// `scopeArg` carries the active sensor-model or category scope.
async function askAssistant(
  query: string,
  scopeArg: { sensorModelId?: string | null; categoryId?: string | null },
  fallback: () => Promise<Hit[]>,
): Promise<AssistantResult> {
  // Never let the retrieval fallback throw — a thrown fallback during narrowTurn
  // (which has no outer guard) would hang that turn's spinner forever.
  const runFallback = async (): Promise<Hit[]> => {
    try { return await fallback(); } catch (e) { console.warn('chat retrieval fallback failed', e); return []; }
  };
  try {
    const { data, error } = await supabase.functions.invoke('chat-answer', {
      body: { query, sensor_model_id: scopeArg.sensorModelId ?? null, category_id: scopeArg.categoryId ?? null },
    });
    if (!error && data && !(data as any).error) {
      // The Edge Function responded — trust it; do NOT fall back to raw
      // retrieval (that's only for when the function is unreachable).
      const d = data as { answer: string | null; citations?: any[] };
      // If the model produced the "not documented" refusal, treat it as a
      // genuine not-found: no answer text, no (misleading) sources — the UI
      // then shows the web-search + log-a-ticket options instead.
      const refused = !!d.answer && /isn.?t\s+documented\s+yet/i.test(d.answer);
      if (d.answer && d.answer.trim() && !refused) {
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
      // null answer or refusal → not-found (no fallback, no sources).
      return { answer: null, citations: [], hits: [] };
    }
  } catch {
    // Edge Function not deployed / network error → retrieval-only fallback.
    return { answer: null, citations: [], hits: await runFallback() };
  }
  // Non-throw error shape from invoke → retrieval fallback.
  return { answer: null, citations: [], hits: await runFallback() };
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
  // Active sensor scope: once the operator picks a make & model, all following
  // questions are scoped to it (and shown as a persistent chip) until cleared.
  const [scope, setScope] = useState<{ modelId?: string | null; generalModelId?: string | null; categoryId?: string | null; label: string } | null>(null);
  // Ordered sensor-type ids from the last AI route call, used to order the
  // guided picker's type chips (most-likely first).
  const [routeOrder, setRouteOrder] = useState<string[]>([]);
  // Active diagnostic flow run — while set, chips drive the conversation and
  // the doc-RAG path is bypassed. Typing a new message cancels the run.
  const [flowRun, setFlowRun] = useState<{ flow: DiagnosticFlow } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastUserRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);
  const sendingRef = useRef(false);
  const focusInput = () => inputRef.current?.focus();
  const isBusy = turns.some((tn) => tn.role === 'bot' && tn.loading);
  // Index of the most recent user message — anchored to the top on a new
  // exchange so the answer's beginning is visible (rather than scrolling past
  // it to the feedback row / sensor selector).
  let lastUserIndex = -1;
  for (let i = turns.length - 1; i >= 0; i--) { if (turns[i].role === 'user') { lastUserIndex = i; break; } }

  function openTicket(turn: Extract<Turn, { role: 'bot' }>) {
    const desc =
      `Question: ${turn.query}\n\n` +
      (turn.answer ? `Assistant answer:\n${turn.answer}\n\n` : '') +
      `This didn't resolve my issue.`;
    setTicket({ query: turn.query, description: desc });
  }

  // Explicit web fallback: search the web (Tavily) + synthesize (Groq) for a
  // turn whose docs came up empty. Clearly labelled as unverified, and tracked.
  async function fetchWebAnswer(turnIndex: number, query: string) {
    logEvent({ event: 'web_answer', query, source: 'chat' });
    setTurns((t) => t.map((turn, i) => (i === turnIndex && turn.role === 'bot') ? { ...turn, webLoading: true } : turn));
    let result: { answer: string; sources: { title: string; url: string }[] } | null = null;
    try {
      const { data, error } = await supabase.functions.invoke('chat-answer', { body: { query, mode: 'web' } });
      const d = data as { answer?: string | null; sources?: { title: string; url: string }[] } | null;
      if (!error && d && d.answer && d.answer.trim()) {
        result = { answer: d.answer.trim(), sources: (d.sources ?? []).filter((s) => s?.url) };
      }
    } catch { /* leave result null → show a gentle failure note */ }
    setTurns((t) => t.map((turn, i) => (i === turnIndex && turn.role === 'bot')
      ? { ...turn, webLoading: false, webAnswer: result ?? { answer: 'I couldn’t find a clear answer on the web either. Consider logging a ticket.', sources: [] } }
      : turn));
  }

  useEffect(() => {
    // On a NEW exchange (turns grew), pin the latest question to the top so the
    // answer reads from its start. On in-place updates (loading → answer) leave
    // the scroll position alone so the beginning of the answer stays in view.
    if (turns.length > prevLen.current) {
      lastUserRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevLen.current = turns.length;
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
    // Move focus into the dialog (the close button, not the input — focusing the
    // input would pop the mobile keyboard and shove the header out of view).
    closeRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  async function send(query: string) {
    const q = query.trim();
    if (!q) return;
    if (sendingRef.current) return; // ignore concurrent sends (would swap answers under questions)

    // Small-talk / meta → reply conversationally, skip the doc search entirely.
    const chat = conversationalReply(q);
    if (chat) {
      setInput('');
      setTurns((t) => [...t, { role: 'user', text: q }, { role: 'bot', query: q, loading: false, note: chat }]);
      return;
    }

    sendingRef.current = true;
    setInput('');
    // Typing a fresh message abandons any in-progress diagnostic flow.
    setFlowRun(null);
    let activeScope = scope;

    // Echo the user's message + a loading placeholder IMMEDIATELY — before any
    // network work (routing/retrieval) — so the typed message never lags behind
    // the ~1s routing call. The label is filled in once routing resolves.
    setTurns((t) => [
      ...t,
      { role: 'user', text: q },
      { role: 'bot', query: q, loading: true, narrowedLabel: activeScope?.label },
    ]);
    try {
      // Spell-tolerance: the ECHO shows exactly what they typed, but matching
      // (flows, rules, routing, retrieval) runs on the corrected text.
      let mq = q;
      try { mq = (await correctSpelling(q)).text; } catch { /* raw query still works */ }

      // If we have no scope yet, interpret the message: sensor TYPE + intent +
      // any make/model actually mentioned (handles vague/misspelled phrasing).
      if (!activeScope) {
        const r = await routeQuery(mq);
        if (r?.categories?.length) setRouteOrder(r.categories.map((c) => c.id));
        // A normalized restatement beats our token-level correction for matching.
        if (r?.normalized) mq = r.normalized;
        // If the message itself names a model we have, scope straight to it —
        // no need to make the user tap through the picker.
        if (r?.slots?.model) {
          const { data: m } = await supabase
            .from('sensor_models')
            .select('id, model_no, name, category_id, sensor_makes(name)')
            .eq('is_general', false)
            .ilike('model_no', `%${r.slots.model}%`)
            .limit(2);
          if (m && m.length === 1) {
            const mk = Array.isArray((m[0] as any).sensor_makes) ? (m[0] as any).sensor_makes[0] : (m[0] as any).sensor_makes;
            const { data: gm } = await supabase.from('sensor_models').select('id').eq('is_general', true).eq('category_id', (m[0] as any).category_id).maybeSingle();
            activeScope = {
              modelId: (m[0] as any).id,
              generalModelId: (gm as any)?.id ?? null,
              categoryId: (m[0] as any).category_id,
              label: `${mk?.name ?? ''} ${(m[0] as any).model_no || (m[0] as any).name}`.trim(),
            };
            setScope(activeScope);
          }
        }
        if (!activeScope && r?.top && r.top.confidence >= 0.6) {
          // Resolve the category's general model so type-level routing rules apply.
          const { data: gm } = await supabase.from('sensor_models').select('id').eq('is_general', true).eq('category_id', r.top.id).maybeSingle();
          activeScope = { categoryId: r.top.id, generalModelId: (gm as any)?.id ?? null, label: `${r.top.name} sensors` };
          setScope(activeScope);
        }
      }

      // ---- Priority 1: an approved diagnostic flow matches → run it instead of RAG.
      const flow = await matchFlow(mq, { categoryId: activeScope?.categoryId ?? null, modelId: activeScope?.modelId ?? null });
      if (flow) {
        await startFlow(flow, activeScope?.label);
        return;
      }

      const fallback = activeScope?.modelId
        ? () => scopedRetrieve(mq, activeScope!.modelId!, activeScope!.generalModelId ?? null)
        : activeScope?.categoryId
          ? () => categoryRetrieve(mq, activeScope!.categoryId!)
          : async () => {
              const { data } = await supabase.rpc('chat_search', { q: mq, p_limit: 5 });
              return enrichHits((data as Hit[]) ?? []);
            };
      // ---- Priority 2+3: routed rule + grounded RAG answer (in parallel).
      const candidateIds = [activeScope?.modelId, activeScope?.generalModelId].filter(Boolean) as string[];
      const [result, routed] = await Promise.all([
        askAssistant(mq, { sensorModelId: activeScope?.modelId ?? null, categoryId: activeScope?.categoryId ?? null }, fallback),
        candidateIds.length ? matchRule(mq, candidateIds) : Promise.resolve(null),
      ]);
      if (!result.answer && result.hits.length === 0) {
        logUnanswered({ query: q, source: 'chat', sensorModelId: activeScope?.modelId ?? null });
      }
      setTurns((t) => fillLoadingTurn(t, { role: 'bot', query: q, loading: false, narrowedLabel: activeScope?.label, answer: result.answer, citations: result.citations, hits: result.hits, routed }));
    } catch (e) {
      // Never leave the chat frozen — surface a recoverable not-found turn.
      console.warn('chat send failed', e);
      setTurns((t) => fillLoadingTurn(t, { role: 'bot', query: q, loading: false, narrowedLabel: activeScope?.label, answer: null, citations: [], hits: [] }));
    } finally {
      sendingRef.current = false;
    }
  }

  // ---------- Diagnostic flow runner ----------
  // Present one node per bot turn; option chips (or Done / Didn't work) drive
  // the walk. Terminal nodes (resolve/escalate) end the run and show feedback.

  async function nodeTurn(flow: DiagnosticFlow, node: FlowNode, opts?: { first?: boolean; scopeLabel?: string }): Promise<Extract<Turn, { role: 'bot' }>> {
    const terminal = node.kind === 'resolve' || node.kind === 'escalate';
    let contacts: EscalationContact[] = [];
    if (node.kind === 'escalate' && node.skill) {
      try {
        // The right person differs by plant and (for vendor support) by make —
        // resolve against the scoped sensor's make; plant rows are all shown.
        let makeId: string | null = null;
        if (scope?.modelId) {
          const { data: m } = await supabase.from('sensor_models').select('make_id').eq('id', scope.modelId).maybeSingle();
          makeId = (m as any)?.make_id ?? null;
        }
        contacts = contactsForSkill(await fetchContacts(), node.skill, { makeId });
      } catch { contacts = []; }
    }
    return {
      role: 'bot',
      query: flow.title,
      loading: false,
      narrowedLabel: opts?.scopeLabel,
      flowNode: node,
      flowTitle: opts?.first ? flow.title : undefined,
      flowTerminal: terminal,
      escalateContacts: contacts,
    };
  }

  async function startFlow(flow: DiagnosticFlow, scopeLabel?: string) {
    const start = getNode(flow.definition, flow.definition.start);
    if (!start) return; // validator should prevent this; RAG path already skipped, show not-found
    setFlowRun({ flow });
    const turn = await nodeTurn(flow, start, { first: true, scopeLabel });
    const terminal = start.kind === 'resolve' || start.kind === 'escalate';
    if (terminal) setFlowRun(null);
    setTurns((t) => fillLoadingTurn(t, turn));
  }

  // Advance from the node shown in the LAST bot turn via a chip tap.
  async function advanceFlow(choiceLabel: string, nextId: string | null) {
    if (!flowRun) return;
    const { flow } = flowRun;
    const next = nextId ? getNode(flow.definition, nextId) : null;
    if (!next) { setFlowRun(null); return; }
    const terminal = next.kind === 'resolve' || next.kind === 'escalate';
    // Echo the choice as a user bubble, then show the next node.
    setTurns((t) => [...t, { role: 'user', text: choiceLabel }, { role: 'bot', query: flow.title, loading: true }]);
    const turn = await nodeTurn(flow, next);
    if (terminal) setFlowRun(null);
    setTurns((t) => fillLoadingTurn(t, turn));
  }

  // Re-scope a bot turn to a specific sensor (+ its category general guidance),
  // and remember the scope so following questions stay scoped too.
  async function narrowTurn(turnIndex: number, query: string, modelId: string, generalModelId: string | null, label: string) {
    setScope((prev) => ({ modelId, generalModelId, label, categoryId: prev?.categoryId ?? null }));
    setTurns((t) => t.map((turn, i) => (i === turnIndex && turn.role === 'bot') ? { ...turn, loading: true } : turn));
    try {
      const [result, routed] = await Promise.all([
        askAssistant(query, { sensorModelId: modelId }, () => scopedRetrieve(query, modelId, generalModelId)),
        matchRule(query, [modelId, generalModelId].filter(Boolean) as string[]),
      ]);
      setTurns((t) => t.map((turn, i) => (i === turnIndex && turn.role === 'bot')
        ? { ...turn, loading: false, narrowedLabel: label, answer: result.answer, citations: result.citations, hits: result.hits, routed }
        : turn));
    } catch (e) {
      console.warn('narrowTurn failed', e);
      setTurns((t) => t.map((turn, i) => (i === turnIndex && turn.role === 'bot')
        ? { ...turn, loading: false, narrowedLabel: label, answer: null, citations: [], hits: [] }
        : turn));
    }
  }

  function openSection(query: string, docId: string, section: string) {
    onClose();
    nav(`/consolidated/${docId}?q=${encodeURIComponent(query)}&section=${encodeURIComponent(section)}`);
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
            <button ref={closeRef} onClick={onClose} aria-label="Close assistant" className="tap rounded-lg hover:bg-white/15 w-9 h-9 flex items-center justify-center transition shrink-0">
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Active sensor scope — persistent indicator + clear */}
        {scope && (
          <div className="bg-brand-50 border-b border-brand-100 px-4 py-2 flex items-center gap-2">
            <Cpu size={14} className="text-brand-700 shrink-0" />
            <span className="text-xs text-brand-800 min-w-0 truncate">
              Answering for <strong className="font-semibold">{scope.label}</strong>
            </span>
            <button
              onClick={() => setScope(null)}
              className="ml-auto tap inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 transition shrink-0"
            >
              Clear <X size={12} />
            </button>
          </div>
        )}

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
            <div key={i} ref={i === lastUserIndex ? lastUserRef : undefined} className="flex justify-end scroll-mt-3">
              <div className="max-w-[82%] bg-gradient-to-br from-brand-600 to-brand-800 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm shadow-sm">{turn.text}</div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Bot size={16} />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
              {/* Router: an approved rule matched — point at the exact procedure */}
              {!turn.loading && turn.routed && (
                <RoutedCard routed={turn.routed} onOpen={(docId, section) => openSection(turn.query, docId, section)} />
              )}

              {turn.loading ? (
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md bg-white border border-slate-200 shadow-sm px-3.5 py-3">
                  <span className="dp-typing"><span></span><span></span><span></span></span>
                  <span className="text-xs text-slate-400">{t('chat.title')} is thinking…</span>
                </div>
              ) : turn.note ? (
                <div className="rounded-2xl rounded-tl-md bg-white border border-slate-200 shadow-sm px-3.5 py-3 text-sm text-slate-700 leading-relaxed">
                  {turn.note}
                </div>
              ) : turn.flowNode ? (
                <FlowNodeCard
                  turn={turn}
                  active={i === turns.length - 1 && !!flowRun}
                  onChoose={advanceFlow}
                  failNext={flowRun ? failTarget(flowRun.flow.definition, turn.flowNode) : null}
                  onTicket={() => openTicket(turn)}
                />
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
              ) : turn.webAnswer ? (
                <WebAnswerCard data={turn.webAnswer} />
              ) : turn.webLoading ? (
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md bg-white border border-slate-200 shadow-sm px-3.5 py-3">
                  <span className="dp-typing"><span></span><span></span><span></span></span>
                  <span className="text-xs text-slate-400">Searching the web…</span>
                </div>
              ) : turn.routed ? null : (
                <div className="card-tight bg-white text-sm text-slate-600 space-y-2.5">
                  <div>{t('chat.nothing')}</div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => fetchWebAnswer(i, turn.query)}
                      className="tap inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-white px-3 py-2 text-xs font-semibold hover:from-brand-700 hover:to-brand-900 transition"
                    >
                      <Globe size={13} /> Get an answer from the web
                    </button>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(turn.query + ' sensor troubleshooting')}`}
                      target="_blank" rel="noreferrer"
                      onClick={() => logEvent({ event: 'web_search', query: turn.query, source: 'chat' })}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-700 transition"
                    >
                      {t('chat.searchWeb')} <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              )}

              {/* Did this help? — feedback + continue + log-a-ticket (tracked).
                  Shown on every real attempt, including no-result (they may have
                  resolved it via the web / a ticket). Mid-flow nodes skip it —
                  feedback belongs at the end of a diagnostic run. */}
              {!turn.loading && !turn.note && (!turn.flowNode || turn.flowTerminal) && (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <AnswerFeedback
                    key={`${turn.narrowedLabel ?? ''}|${turn.answer ? turn.answer.slice(0, 24) : (turn.hits?.[0]?.document_id ?? '')}`}
                    source="chat"
                    compact
                    query={turn.query}
                    consolidatedDocId={turn.answer ? (turn.citations?.[0]?.document_id ?? null) : (turn.hits?.[0]?.document_id ?? null)}
                    onContinue={focusInput}
                    onLogTicket={() => openTicket(turn)}
                  />
                </div>
              )}

              {/* Guided sensor picker — shown until narrowed to a specific model.
                  When a TYPE is already inferred/scoped it jumps to the make step.
                  Hidden during a flow run — the flow's own chips drive the turn. */}
              {!turn.loading && !turn.note && !turn.flowNode && !flowRun && i === turns.length - 1 && !scope?.modelId && (
                <GuidedNarrow
                  key={`gn-${i}-${scope?.categoryId ?? 'none'}`}
                  initialCategoryId={scope?.categoryId ?? undefined}
                  orderedCategoryIds={routeOrder}
                  onPick={(modelId, generalModelId, label) => narrowTurn(i, turn.query, modelId, generalModelId, label)}
                />
              )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 p-3 bg-white">
          {turns.length > 0 && (
            <div className="flex justify-end mb-2">
              <button onClick={() => { setTurns([]); setScope(null); setFlowRun(null); }} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700 transition">
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
            <button type="submit" disabled={!input.trim() || isBusy} aria-label="Send message"
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

// Guided sensor picker — walks the user type → make → model with quick-reply
// chips, so they don't need to know (or type) the make/model. Picking a model
// re-runs their question scoped to that sensor (+ its category guidance).
function GuidedNarrow({ onPick, initialCategoryId, orderedCategoryIds }: {
  onPick: (modelId: string, generalModelId: string | null, label: string) => void;
  initialCategoryId?: string;
  orderedCategoryIds?: string[];
}) {
  const [step, setStep] = useState<'category' | 'make' | 'model'>(initialCategoryId ? 'make' : 'category');
  const [catId, setCatId] = useState(initialCategoryId ?? '');
  const [makeId, setMakeId] = useState('');

  const cats = useQuery({ queryKey: ['cats'], queryFn: async () => (await supabase.from('sensor_categories').select('id,name').order('name')).data ?? [] });
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });
  const models = useQuery({
    queryKey: ['models-all-guided'],
    queryFn: async () => (await supabase.from('sensor_models').select('id, model_no, name, category_id, make_id').eq('is_general', false).order('model_no')).data ?? [],
  });
  const generalModels = useQuery({
    queryKey: ['general-models'],
    queryFn: async () => (await supabase.from('sensor_models').select('id, category_id').eq('is_general', true)).data ?? [],
  });

  const allModels = (models.data ?? []) as any[];
  // Only show categories/makes that actually have models.
  const catsWithModels = (cats.data ?? [])
    .filter((c: any) => allModels.some((m) => m.category_id === c.id))
    .sort((a: any, b: any) => {
      // Order by the AI's type ranking when available, else by name.
      const ia = orderedCategoryIds?.indexOf(a.id) ?? -1;
      const ib = orderedCategoryIds?.indexOf(b.id) ?? -1;
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return 0;
    });
  const makesInCat = (makes.data ?? []).filter((mk: any) => allModels.some((m) => m.category_id === catId && m.make_id === mk.id));
  const modelsInCatMake = allModels.filter((m) => m.category_id === catId && m.make_id === makeId);

  const catName = (id: string) => (cats.data ?? []).find((c: any) => c.id === id)?.name ?? '';
  const makeName = (id: string) => (makes.data ?? []).find((mk: any) => mk.id === id)?.name ?? '';

  function pickModel(m: any) {
    const generalModelId = (generalModels.data ?? []).find((g: any) => g.category_id === m.category_id)?.id ?? null;
    onPick(m.id, generalModelId, `${makeName(makeId)} ${m.model_no || m.name}`.trim());
  }

  const chip = 'tap text-left rounded-lg border border-slate-200 bg-white hover:border-brand-700 hover:text-brand-700 px-3 py-2 text-xs font-medium transition';

  return (
    <div className="bg-gradient-to-br from-brand-50 to-white border border-brand-100 rounded-xl px-3 py-3 space-y-2.5 shadow-sm">
      <div className="text-xs text-brand-800 font-semibold inline-flex items-center gap-1.5">
        <Cpu size={13} />
        {step === 'category' && 'Which kind of sensor is this?'}
        {step === 'make' && `Which make? (${catName(catId)})`}
        {step === 'model' && `Which model? (${makeName(makeId)})`}
      </div>

      {(step === 'make' || step === 'model') && (
        <button
          onClick={() => { if (step === 'model') { setStep('make'); setMakeId(''); } else { setStep('category'); setCatId(''); } }}
          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-brand-700"
        >
          <ArrowRight size={11} className="rotate-180" /> Back
        </button>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {step === 'category' && catsWithModels.map((c: any) => (
          <button key={c.id} className={chip} onClick={() => { setCatId(c.id); setStep('make'); }}>{c.name}</button>
        ))}
        {step === 'make' && makesInCat.map((mk: any) => (
          <button key={mk.id} className={chip} onClick={() => { setMakeId(mk.id); setStep('model'); }}>{mk.name}</button>
        ))}
        {step === 'model' && modelsInCatMake.map((m: any) => (
          <button key={m.id} className={chip} onClick={() => pickModel(m)}>{m.model_no || m.name}</button>
        ))}
      </div>
      {step === 'make' && makesInCat.length === 0 && <div className="text-xs text-slate-500">No makes catalogued for that type yet.</div>}
      {step === 'model' && modelsInCatMake.length === 0 && <div className="text-xs text-slate-500">No models catalogued for that make yet.</div>}
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

// Router result — an approved problem→procedure rule matched the question.
// Points the technician straight to the exact section(s), with the rule's
// clarifying question shown first when present.
function RoutedCard({ routed, onOpen }: { routed: RouteMatch; onOpen: (docId: string, section: string) => void }) {
  const { rule, docId } = routed;
  return (
    <div className="rounded-2xl rounded-tl-md overflow-hidden border border-emerald-200 shadow-sm bg-white">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-3.5 py-2 inline-flex items-center gap-1.5 w-full">
        <Compass size={13} className="text-white" />
        <span className="text-white text-[11px] font-semibold uppercase tracking-wide">Recommended procedure</span>
      </div>
      <div className="p-3.5 space-y-2.5">
        <div className="text-sm text-slate-700">For <strong>“{rule.problem}”</strong>, go to:</div>
        {rule.clarifying_question && (
          <div className="text-xs text-slate-600 bg-emerald-50 border border-emerald-100 rounded-md px-2.5 py-1.5">
            First check: <span className="italic">{rule.clarifying_question}</span>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {rule.sections.map((s) => (
            docId ? (
              <button key={s} onClick={() => onOpen(docId, s)}
                className="tap group flex items-center gap-2 text-left rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 px-2.5 py-2 transition">
                <Compass size={14} className="text-emerald-700 shrink-0" />
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 group-hover:text-emerald-700">{SECTION_LABEL[s] ?? s}</span>
                <ArrowRight size={13} className="text-slate-300 group-hover:text-emerald-600 shrink-0" />
              </button>
            ) : (
              <div key={s} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2">
                <Compass size={14} className="text-slate-400 shrink-0" />
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-600">{SECTION_LABEL[s] ?? s}</span>
                <span className="text-[10px] text-slate-400 shrink-0">not consolidated yet</span>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

// One node of a diagnostic flow run. Question nodes show tappable option
// chips, action nodes a step with Done / Didn't-work, resolve and escalate
// nodes are terminal (escalate resolves the contact from the directory).
function FlowNodeCard({ turn, active, failNext, onChoose, onTicket }: {
  turn: Extract<Turn, { role: 'bot' }>;
  active: boolean;
  failNext: string | null;
  onChoose: (label: string, nextId: string | null) => void;
  onTicket: () => void;
}) {
  const n = turn.flowNode!;
  const chip = 'tap text-left rounded-lg border border-slate-200 bg-white hover:border-brand-700 hover:text-brand-700 px-3 py-2 text-xs font-medium transition';

  if (n.kind === 'resolve') {
    return (
      <div className="rounded-2xl rounded-tl-md border border-emerald-200 bg-emerald-50/60 shadow-sm px-3.5 py-3 space-y-1.5">
        <div className="inline-flex items-center gap-1.5 text-emerald-800 text-[11px] font-semibold uppercase tracking-wide">
          <CheckCircle2 size={13} /> Should be fixed
        </div>
        <div className="text-sm text-slate-700 leading-relaxed">{n.text}</div>
        <div className="text-[11px] text-slate-500">Still not right? Use “Didn’t help” below to log it.</div>
      </div>
    );
  }

  if (n.kind === 'escalate') {
    const list = turn.escalateContacts ?? [];
    const withInfo = list.filter((c) => c.person_name || c.contact);
    return (
      <div className="rounded-2xl rounded-tl-md border border-red-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-3.5 py-2 inline-flex items-center gap-1.5 w-full">
          <PhoneCall size={12} className="text-white" />
          <span className="text-white text-[11px] font-semibold uppercase tracking-wide">Needs outside help</span>
        </div>
        <div className="p-3.5 space-y-2.5">
          <div className="text-sm text-slate-700 leading-relaxed">{n.text}</div>
          <div className="text-xs font-semibold text-slate-800">{list[0]?.label ?? n.skill}</div>
          {withInfo.length > 0 ? (
            <div className="space-y-1.5">
              {withInfo.slice(0, 5).map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    {c.person_name && <div className="text-xs text-slate-700 font-medium">{c.person_name}</div>}
                    {c.contact && <div className="text-xs text-brand-700 font-medium">{c.contact}</div>}
                  </div>
                  <span className={`shrink-0 text-[10px] rounded-full px-2 py-0.5 font-medium ${
                    c.make_name ? 'bg-violet-100 text-violet-700' : c.plant_name ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {c.make_name ?? c.plant_name ?? 'Default'}
                  </span>
                </div>
              ))}
              {withInfo.length > 5 && <div className="text-[11px] text-slate-400">+{withInfo.length - 5} more in the directory</div>}
              {withInfo.some((c) => c.plant_name) && (
                <div className="text-[10px] text-slate-400">Pick the person for your plant.</div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
              No contact on file yet — ask your supervisor who covers this.
            </div>
          )}
          <button onClick={onTicket}
            className="tap w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-white px-3 py-2 text-xs font-semibold hover:from-brand-700 transition">
            Log a support ticket
          </button>
        </div>
      </div>
    );
  }

  // question / action
  return (
    <div className="rounded-2xl rounded-tl-md bg-white border border-slate-200 shadow-sm px-3.5 py-3 space-y-2.5">
      {turn.flowTitle && (
        <div className="inline-flex items-center gap-1.5 text-brand-700 text-[11px] font-semibold uppercase tracking-wide">
          <GitBranch size={12} /> Diagnosing: {turn.flowTitle}
        </div>
      )}
      <div className="text-sm text-slate-700 leading-relaxed">{n.text}</div>
      {n.kind === 'action' && n.source_section && (
        <div className="text-[10px] text-slate-400">From: {SECTION_LABEL[n.source_section as SubmissionSection] ?? n.source_section}</div>
      )}
      {active ? (
        <div className="flex flex-col gap-1.5">
          {n.kind === 'question' && (n.options ?? []).map((o, idx) => (
            <button key={idx} onClick={() => onChoose(o.label, o.next)} className={chip}>{o.label}</button>
          ))}
          {n.kind === 'action' && (
            <>
              <button onClick={() => onChoose('Done — what’s next?', n.next ?? null)} className={chip}>✓ Done — what’s next?</button>
              <button onClick={() => onChoose('That didn’t work', failNext)} className={`${chip} hover:border-red-400 hover:text-red-600`}>✗ That didn’t work</button>
            </>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-slate-400 italic">Answered above ↑</div>
      )}
    </div>
  );
}

// Web fallback answer — deliberately distinct from the verified-doc answer:
// amber framing, an "unverified" tag, web source links, and a disclaimer.
function WebAnswerCard({ data }: { data: { answer: string; sources: { title: string; url: string }[] } }) {
  const html = useMemo(() => renderMarkdown(normalizeAnswerSteps(data.answer)), [data.answer]);
  return (
    <div className="rounded-2xl rounded-tl-md overflow-hidden border border-amber-200 shadow-sm bg-white">
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-2 inline-flex items-center gap-1.5 w-full">
        <Globe size={12} className="text-white" />
        <span className="text-white text-[11px] font-semibold uppercase tracking-wide">From the web · unverified</span>
      </div>
      <div className="p-3.5 space-y-2.5">
        <div className="chat-prose" dangerouslySetInnerHTML={{ __html: html }} />
        {data.sources.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-1.5">Web sources</div>
            <div className="flex flex-col gap-1">
              {data.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer"
                   className="tap group flex items-center gap-2 rounded-lg border border-slate-200 hover:border-amber-400 px-2.5 py-1.5 transition">
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 rounded w-5 h-5 flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-xs text-slate-700 truncate group-hover:text-amber-700">{s.title}</span>
                  <ExternalLink size={12} className="text-slate-300 group-hover:text-amber-600 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="text-[10px] text-amber-800 bg-amber-50 rounded-md px-2 py-1.5 flex items-start gap-1.5">
          <Globe size={11} className="mt-0.5 shrink-0" />
          <span>General web information — <strong>not</strong> from your verified documentation. Confirm before acting.</span>
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
