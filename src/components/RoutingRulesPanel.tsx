import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Route, Sparkles, Check, X, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SECTION_LABEL } from '../lib/consolidated';
import type { SubmissionSection } from '../lib/types';

// Admin-only "router layer" management for one sensor. Always visible (not
// hidden behind a dropdown) and framed as an action item: generate AI-proposed
// problem→procedure rules, then approve/reject. Approved rules drive the chatbot.
export default function RoutingRulesPanel({ sensorModelId }: { sensorModelId: string }) {
  const qc = useQueryClient();
  const [gen, setGen] = useState(false);

  const rules = useQuery({
    queryKey: ['routing-rules', sensorModelId],
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
  const needsAction = !rules.isLoading && (list.length === 0 || proposed.length > 0);

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm ${needsAction ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-200'}`}>
      {/* Header — always shows the primary action */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-900 text-white px-4 sm:px-5 py-3.5 flex items-center gap-3 flex-wrap">
        <span className="bg-white/15 ring-1 ring-white/20 rounded-lg w-8 h-8 flex items-center justify-center shrink-0"><Route size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold tracking-tight">Quick routing — problem → section shortcuts</div>
          <div className="text-[11px] text-white/70">
            {approved.length} live rule{approved.length === 1 ? '' : 's'}{proposed.length ? ` · ${proposed.length} awaiting review` : ''}
          </div>
        </div>
        <button onClick={generate} disabled={gen}
          className="tap inline-flex items-center gap-1.5 rounded-lg bg-white text-brand-800 px-3 py-2 text-sm font-semibold hover:bg-slate-100 transition disabled:opacity-60 shrink-0">
          {gen ? <Loader2 size={14} className="animate-spin" /> : list.length === 0 ? <Sparkles size={14} /> : <RefreshCw size={14} />}
          {gen ? 'Generating…' : list.length === 0 ? 'Generate with AI' : 'Regenerate'}
        </button>
      </div>

      <div className="bg-white px-4 sm:px-5 py-4 space-y-3">
        <p className="text-xs text-slate-500">
          One-tap shortcuts: a stated problem → the exact doc section that fixes it. AI proposes from this sensor’s
          approved procedures; you approve what goes live. Different from{' '}
          <Link to="/admin?tab=flows" className="font-semibold text-brand-700 hover:underline">Diagnostic flows</Link>,
          which walk the user through a step-by-step diagnosis — Dr. Paani tries flows first, then these shortcuts.
        </p>

        {rules.isLoading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : list.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-5 text-center">
            <Sparkles size={22} className="text-brand-600 mx-auto mb-2" />
            <div className="text-sm font-medium text-slate-800">No routing rules yet</div>
            <div className="text-xs text-slate-500 mt-1 mb-3 max-w-sm mx-auto">Generate problem→procedure rules from this sensor’s documented procedures, then approve the ones that look right.</div>
            <button onClick={generate} disabled={gen} className="tap inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-white px-4 py-2 text-sm font-semibold hover:from-brand-700 transition disabled:opacity-60">
              {gen ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {gen ? 'Generating…' : 'Generate routing rules'}
            </button>
          </div>
        ) : (
          <>
            {proposed.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-amber-700">Proposed — review &amp; approve</div>
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
