import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  'How do I troubleshoot H2S poisoning on the ORP sensor?',
  'What does the VizSens-ODO datasheet say about cleaning?',
  'BT-UL echo loss',
  'Calibration procedure for pH sensor',
];

export default function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns]);

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
        <div className="bg-gradient-to-br from-brand-700 to-brand-900 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/70">Assistant</div>
            <div className="text-lg font-bold">Ask the document hub</div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {turns.length === 0 && (
            <div className="space-y-3">
              <div className="card-tight bg-white">
                <div className="text-sm text-slate-700 leading-relaxed">
                  👋 Ask anything about your sensor docs. I'll search the consolidated references and surface the most relevant sections.
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Right now I'm running keyword search. A smarter, AI-synthesised answer is coming once your team enables it.
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
                <div className="card-tight bg-white text-sm text-slate-600">
                  I couldn't find anything for that question. Try rephrasing with the sensor's make or model.
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
                        <span className="text-base">📘</span>
                        <span className="font-semibold text-slate-900 truncate">{h.document_title.trim()}</span>
                        <span className="badge-blue">{SECTION_LABEL[h.section]}</span>
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed line-clamp-3"
                           dangerouslySetInnerHTML={{ __html: hl(h.snippet, t.query) }} />
                      <div className="text-xs text-brand-700 font-medium mt-1.5">Open →</div>
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
            <button type="submit" disabled={!input.trim()}
                    className="rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              Send
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
