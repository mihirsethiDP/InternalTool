import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, X, Rocket, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

// A short "get the tool going" checklist for a fresh admin. Reads live counts,
// so each step ticks itself off as it's done. Auto-hides once everything is
// complete, and can be dismissed early (remembered per device).
export default function AdminOnboarding() {
  const [hidden, setHidden] = useState(() => localStorage.getItem('dp-admin-onboard-dismissed') === '1');

  const state = useQuery({
    queryKey: ['admin-onboarding'],
    queryFn: async () => {
      // Only presence matters — fetch one id, not a full COUNT(*) aggregate.
      const has = (t: string, f: (b: any) => any) => f(supabase.from(t).select('id').limit(1));
      const [sensors, docs, flows, contacts] = await Promise.all([
        has('sensor_models', (b) => b.eq('is_general', false)),
        has('consolidated_docs', (b) => b.is('deleted_at', null)),
        has('diagnostic_flows', (b) => b.eq('status', 'approved')),
        supabase.from('escalation_contacts').select('id').or('person_name.not.is.null,contact.not.is.null').limit(1),
      ]);
      return {
        sensors: (sensors.data ?? []).length,
        docs: (docs.data ?? []).length,
        flows: (flows.data ?? []).length,
        contacts: (contacts.data ?? []).length,
      };
    },
  });

  if (hidden || !state.data) return null;
  const d = state.data;
  const steps = [
    { done: d.sensors > 0, label: 'Add your sensors', hint: 'Make · model · category in the catalog.', to: '/sensors' },
    { done: d.docs > 0, label: 'Approve a document', hint: 'Uploads land in the Review queue for approval.', to: '/admin?tab=review' },
    { done: d.flows > 0, label: 'Approve a diagnostic flow', hint: 'AI drafts them on approval — review & approve.', to: '/admin?tab=flows' },
    { done: d.contacts > 0, label: 'Fill the escalation directory', hint: 'Who Dr. Paani points to when docs run out.', to: '/admin?tab=flows' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // fully set up — nothing to show

  function dismiss() { localStorage.setItem('dp-admin-onboard-dismissed', '1'); setHidden(true); }

  return (
    <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-brand-700 text-white flex items-center justify-center shrink-0 shadow-sm"><Rocket size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Get Dr. Paani ready — {doneCount}/{steps.length} done</h3>
            <button onClick={dismiss} aria-label="Dismiss checklist" className="ml-auto text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {steps.map((s) => (
              <Link key={s.label} to={s.to}
                className={`group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${s.done ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-brand-300'}`}>
                {s.done ? <CheckCircle2 size={17} className="text-emerald-500 shrink-0 mt-0.5" /> : <Circle size={17} className="text-slate-300 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${s.done ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{s.label}</div>
                  {!s.done && <div className="text-[11px] text-slate-500 mt-0.5">{s.hint}</div>}
                </div>
                {!s.done && <ArrowRight size={13} className="text-slate-300 group-hover:text-brand-700 shrink-0 mt-1" />}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
