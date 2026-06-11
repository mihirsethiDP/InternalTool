import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, ArrowRight, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SECTION_LABEL } from '../lib/consolidated';
import type { SubmissionSection } from '../lib/types';

interface Hit {
  document_id: string;
  document_title: string;
  section: SubmissionSection;
  snippet: string;
  rank: number;
}
type Turn =
  | { role: 'user'; text: string }
  | { role: 'bot'; query: string; hits: Hit[]; loading?: boolean };

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
      { role: 'bot', query: q, hits: [], loading: true },
    ]);
    const { data, error } = await supabase.rpc('chat_search', { q, p_limit: 5 });
    setTurns((t) => {
      const copy = [...t];
      // replace the last loading bot turn
      for (let i = copy.length - 1; i >= 0; i--) {
        const turn = copy[i];
        if (turn.role === 'bot' && turn.loading) {
          copy[i] = { role: 'bot', query: q, hits: (data as Hit[]) ?? [], loading: false };
          break;
        }
      }
      if (error) console.warn('chat_search error', error);
      return copy;
    });
  }

  function openHitWith(query: string, id: string) {
    onClose();
    nav(`/consolidated/${id}?q=${encodeURIComponent(query)}`);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-slate-200 animate-[slideIn_180ms_ease-out]">
        {/* Header */}
        <div className="bg-brand-700 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/60 font-medium">Assistant</div>
            <div className="text-base font-semibold tracking-tight mt-0.5">Ask the document hub</div>
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
                  Ask anything about your sensor docs. I&rsquo;ll search the consolidated references and surface the most relevant sections.
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Currently using keyword search. A synthesised AI answer is coming once your team enables it.
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-3 mb-1">Try one:</div>
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

          {turns.map((t, i) => t.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] bg-brand-700 text-white rounded-2xl rounded-tr-md px-4 py-2 text-sm">{t.text}</div>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <div className="text-xs text-slate-500 px-1">Assistant</div>
              {t.loading ? (
                <div className="card-tight bg-white text-sm text-slate-500"><span className="animate-pulse">Searching…</span></div>
              ) : t.hits.length === 0 ? (
                <div className="card-tight bg-white text-sm text-slate-600 space-y-2.5">
                  <div>Nothing in our documentation matches that. Try rephrasing with the sensor&rsquo;s make or model — or check the web:</div>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(t.query + ' sensor troubleshooting')}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 hover:border-brand-700 hover:text-brand-700 px-3 py-1.5 text-xs font-medium text-slate-700 transition"
                  >
                    Search the web for this <ExternalLink size={12} />
                  </a>
                </div>
              ) : (
                <>
                  <div className="card-tight bg-white text-sm text-slate-700">
                    I found <strong>{t.hits.length}</strong> reference{t.hits.length === 1 ? '' : 's'} that might help:
                  </div>
                  {t.hits.map((h) => (
                    <button key={h.document_id} onClick={() => openHitWith(t.query, h.document_id)}
                            className="card-tight bg-white hover:border-brand-700 transition text-left w-full">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-slate-900 truncate">{h.document_title.trim()}</span>
                        <span className="badge-blue">{SECTION_LABEL[h.section]}</span>
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed line-clamp-3"
                           dangerouslySetInnerHTML={{ __html: hl(h.snippet, t.query) }} />
                      <div className="inline-flex items-center gap-1 text-xs text-brand-700 font-medium mt-1.5">
                        Open <ArrowRight size={12} strokeWidth={2.25} />
                      </div>
                    </button>
                  ))}
                </>
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
              placeholder="Ask a question about a sensor…"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20 outline-none"
            />
            <button type="submit" disabled={!input.trim()} aria-label="Send"
                    className="rounded-xl bg-brand-700 hover:bg-brand-800 text-white w-10 h-10 flex items-center justify-center disabled:opacity-50 transition">
              <Send size={16} />
            </button>
          </form>
          {turns.length > 0 && (
            <button onClick={() => setTurns([])} className="text-xs text-slate-500 hover:text-brand-700 mt-2">
              Clear conversation
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

function hl(text: string, q?: string) {
  const escaped = (text ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  if (!q?.trim()) return escaped;
  const terms = q.split(/\s+/).map((t) => t.replace(/[^a-zA-Z0-9]/g, '')).filter((t) => t.length > 2);
  if (terms.length === 0) return escaped;
  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`\\b(?:${pattern})\\w*`, 'gi');
  return escaped.replace(re, '<mark>$&</mark>');
}
