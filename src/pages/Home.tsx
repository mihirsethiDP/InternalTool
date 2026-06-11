import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon, MessageSquare, Wrench, Gauge, FlaskConical,
  ArrowRight, FileText,
} from 'lucide-react';
import { DocCard } from '../components/DocCard';
import { runSearch } from '../lib/search';
import { supabase } from '../lib/supabase';
import { openDocument } from '../lib/openDoc';

// Operator-phrased problems — clicking one asks the assistant directly.
const PROBLEM_PROMPTS = [
  'Flow meter shows zero despite flow',
  'Empty pipe error on UPCS-MAG-110',
  'OCEMS pH reading is drifting',
  'EC probe readings are unstable',
];

function askAssistant(q?: string) {
  window.dispatchEvent(new CustomEvent('dp:open-chat', { detail: q ? { q } : {} }));
}

export default function Home() {
  const [q, setQ] = useState('');
  const nav = useNavigate();

  const search = useQuery({
    queryKey: ['search', q],
    queryFn: () => runSearch(q),
    enabled: q.length > 0,
  });

  // Pilot sensors — fully documented, surfaced as quick entry points
  const pilots = useQuery({
    queryKey: ['pilot-sensors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sensor_models')
        .select('id, model_no, name, is_pilot, sensor_makes(name), sensor_categories(name), consolidated_docs(id)')
        .eq('is_pilot', true);
      if (error) return [];
      return data ?? [];
    },
  });

  const recent = useQuery({
    queryKey: ['recent-consolidated'],
    queryFn: async () => {
      const { data } = await supabase
        .from('consolidated_docs')
        .select('id, last_updated_at, sensor_models(model_no, sensor_makes(name))')
        .order('last_updated_at', { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  function openPilot(p: any) {
    const cid = Array.isArray(p.consolidated_docs) ? p.consolidated_docs[0]?.id : p.consolidated_docs?.id;
    if (cid) nav(`/consolidated/${cid}`);
    else nav(`/sensors/${p.id}`);
  }

  return (
    <div className="space-y-10">
      {/* Hero — troubleshooting first */}
      <section className="text-center max-w-3xl mx-auto pt-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-brand-700 font-semibold mb-4">
          Sensor troubleshooting hub
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 mb-3">
          Sensor acting up? <span className="text-brand-700">Start here.</span>
        </h1>
        <p className="text-slate-600 text-base mb-7">
          Describe the problem and get troubleshooting steps from verified vendor documentation — or search every manual, datasheet, and procedure we have.
        </p>

        {/* Assistant CTA — the primary action */}
        <div className="bg-brand-700 rounded-2xl p-6 text-left shadow-sm mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-white font-semibold tracking-tight">
                <MessageSquare size={18} />
                Ask the Assistant
              </div>
              <p className="text-white/70 text-sm mt-1 max-w-md">
                Describe the issue in your own words — it finds the matching troubleshooting steps.
              </p>
            </div>
            <button
              onClick={() => askAssistant()}
              className="inline-flex items-center gap-2 bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-4 py-2.5 text-sm font-semibold transition shrink-0"
            >
              Start a conversation <ArrowRight size={15} />
            </button>
          </div>
          <div className="flex gap-2 flex-wrap mt-4">
            {PROBLEM_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => askAssistant(p)}
                className="bg-white/10 hover:bg-white/20 text-white/90 hover:text-white rounded-md px-3 py-1.5 text-xs font-medium transition"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Search — secondary entry */}
        <form onSubmit={(e) => e.preventDefault()} className="relative max-w-2xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Or search the documentation directly…"
              className="w-full pl-12 pr-20 py-3.5 text-base rounded-xl border border-slate-300 bg-white shadow-sm focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15 outline-none transition"
            />
            <SearchIcon size={18} strokeWidth={2} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            {q && (
              <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 text-xs font-medium px-2 py-1 rounded hover:bg-slate-100">
                Clear
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Search results */}
      {q && (
        <section className="space-y-3 max-w-4xl mx-auto">
          <div className="muted">
            {search.isLoading ? 'Searching…' : `${search.data?.hits.length ?? 0} result(s) for "${q}"`}
          </div>
          {(search.data?.hits ?? []).map((h) => (
            <DocCard key={`${h.document_id}-${h.page_number}`} hit={h} query={q} />
          ))}
          {search.data && search.data.hits.length === 0 && !search.isLoading && (
            <div className="card text-sm text-slate-600 text-center space-y-2">
              <div>No matches in our documentation.</div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => askAssistant(q)} className="text-brand-700 font-medium hover:underline text-sm">
                  Ask the Assistant
                </button>
                <span className="text-slate-300">·</span>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(q + ' sensor troubleshooting')}`}
                  target="_blank" rel="noreferrer"
                  className="text-brand-700 font-medium hover:underline text-sm"
                >
                  Search the web
                </a>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Pilot sensors */}
      {!q && (pilots.data ?? []).length > 0 && (
        <section className="max-w-5xl mx-auto">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="section-title mb-0">Pilot sensors</h2>
            <span className="muted text-xs">Fully documented</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(pilots.data ?? []).map((p: any) => (
              <button
                key={p.id}
                onClick={() => openPilot(p)}
                className="group card text-left hover:border-brand-700 hover:shadow-sm transition"
              >
                <div className="flex items-start gap-3.5">
                  <div className="bg-brand-50 text-brand-700 rounded-md w-11 h-11 flex items-center justify-center shrink-0 group-hover:bg-brand-700 group-hover:text-white transition">
                    {p.sensor_categories?.name === 'Flow' ? <Gauge size={18} strokeWidth={2} /> : <FlaskConical size={18} strokeWidth={2} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500">{p.sensor_makes?.name}</div>
                    <div className="font-semibold text-slate-900">{p.model_no}</div>
                    {p.name && <div className="text-xs text-slate-500 mt-0.5 truncate">{p.name}</div>}
                  </div>
                  <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-700 transition shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recently updated */}
      {!q && (
        <section className="max-w-5xl mx-auto">
          <h2 className="section-title">Recently updated</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(recent.data ?? []).map((d: any) => (
              <button
                key={d.id}
                onClick={() => openDocument({ id: d.id, nav })}
                className="card-tight flex items-start gap-3 text-left hover:border-brand-700 hover:shadow-sm transition"
              >
                <div className="bg-brand-50 text-brand-700 rounded-md w-9 h-9 flex items-center justify-center shrink-0">
                  <FileText size={16} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 truncate">
                    {d.sensor_models?.sensor_makes?.name} {d.sensor_models?.model_no}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Updated {new Date(d.last_updated_at).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))}
            {(recent.data ?? []).length === 0 && (
              <div className="card text-sm text-slate-500 col-span-full text-center">
                No sensor references yet. Submissions approved in the Review queue will appear here.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Quiet footer hint */}
      {!q && (
        <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Wrench size={12} />
          Documentation incomplete for a sensor? See the
          <button onClick={() => nav('/docs-guide')} className="text-brand-700 hover:underline font-medium">procurement playbook</button>
        </div>
      )}
    </div>
  );
}
