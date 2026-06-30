import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Route, Sparkles, Check, X, Loader2, ChevronDown, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SECTION_LABEL } from '../lib/consolidated';
import type { SubmissionSection } from '../lib/types';

// Admin-only: the "router layer" management for one sensor. Generate AI-proposed
// problem→procedure rules, then approve/reject them. Approved rules are what the
// chatbot routes on (slice 3b).
export default function RoutingRulesPanel({ sensorModelId }: { sensorModelId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [gen, setGen] = useState(false);

  const rules = useQuery({
    queryKey: ['routing-rules', sensorModelId],
    enabled: open,
    queryFn: async () => (await supabase
      .from('routing_rules').select('*')
      .eq('sensor_model_id', sensorModelId)
      .order('status', { ascending: true })
      .order('created_at', { ascending: true })).data ?? [],
  });

  async function generate() {
    setGen(true);
    try { await supabase.functions.invoke('chat-answer', { body: { mode: 'generate-rules', sensor_model_id: sensorModelId } }); }
    catch (e) { console.warn('generate-rules failed', e); }
    setGen(false);
    qc.invalidateQueries({ queryKey: ['routing-rules', sensorModelId] });
  }
  async function setStatus(id: string, status: string) {
    await supabase.from('routing_rules').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['routing-rules', sensorModelId] });
  }
  async function remove(id: string) {
    await supabase.from('routing_rules').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['routing-rules', sensorModelId] });
  }

  const list = (rules.data ?? []) as any[];
  const proposed = list.filter((r) => r.status === 'proposed');
  const approved = list.filter((r) => r.status === 'approved');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2.5 px-4 sm:px-5 py-3 text-left hover:bg-slate-50 transition">
        <span className="bg-brand-700 text-white rounded-lg w-7 h-7 flex items-center justify-center shrink-0"><Route size={15} /></span>
        <span className="text-sm font-semibold text-slate-900">Diagnostic routing rules</span>
        <span className="badge-blue text-[10px]">{approved.length} live{proposed.length ? ` · ${proposed.length} to review` : ''}</span>
        <ChevronDown size={16} className={`ml-auto text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-500 max-w-md">Maps a stated problem → the procedure(s) that fix it. AI proposes from this sensor’s approved procedures; you approve what goes live.</p>
            <button onClick={generate} disabled={gen} className="tap inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-white px-3 py-1.5 text-xs font-semibold hover:from-brand-700 transition disabled:opacity-60">
              {gen ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {gen ? 'Generating…' : 'Generate with AI'}
            </button>
          </div>

          {rules.isLoading ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : list.length === 0 ? (
            <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3 text-center">No rules yet. Click <strong>Generate with AI</strong> to propose some from this sensor’s procedures.</div>
          ) : (
            <>
              {proposed.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-amber-700">Proposed — review</div>
                  {proposed.map((r) => <RuleRow key={r.id} r={r} onApprove={() => setStatus(r.id, 'approved')} onReject={() => setStatus(r.id, 'rejected')} />)}
                </div>
              )}
              {approved.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700">Live rules</div>
                  {approved.map((r) => <RuleRow key={r.id} r={r} approved onRemove={() => remove(r.id)} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RuleRow({ r, approved, onApprove, onReject, onRemove }: {
  r: any; approved?: boolean; onApprove?: () => void; onReject?: () => void; onRemove?: () => void;
}) {
  return (
    <div className={`rounded-lg border p-2.5 ${approved ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
      <div className="text-sm font-medium text-slate-900">{r.problem}</div>
      {r.aliases?.length > 0 && <div className="text-[11px] text-slate-500 mt-0.5">also: {r.aliases.join(' · ')}</div>}
      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
        <span className="text-[11px] text-slate-500">→</span>
        {(r.sections ?? []).map((s: SubmissionSection) => <span key={s} className="badge-blue text-[10px]">{SECTION_LABEL[s] ?? s}</span>)}
      </div>
      {r.clarifying_question && <div className="text-[11px] text-slate-500 italic mt-1">Ask first: “{r.clarifying_question}”</div>}
      <div className="flex gap-2 mt-2">
        {!approved && (
          <>
            <button onClick={onApprove} className="tap inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2.5 py-1 text-xs font-medium hover:bg-emerald-700"><Check size={12} /> Approve</button>
            <button onClick={onReject} className="tap inline-flex items-center gap-1 rounded-md border border-slate-300 text-slate-600 px-2.5 py-1 text-xs hover:border-red-300 hover:text-red-600"><X size={12} /> Reject</button>
          </>
        )}
        {approved && (
          <button onClick={onRemove} className="tap inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"><Trash2 size={12} /> Remove</button>
        )}
      </div>
    </div>
  );
}
