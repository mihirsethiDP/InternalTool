import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, FileText } from 'lucide-react';
import { DocCard } from '../components/DocCard';
import { runSearch } from '../lib/search';
import { supabase } from '../lib/supabase';
import { openDocument } from '../lib/openDoc';

const EXAMPLES = [
  'troubleshooting DO sensor',
  'Advance Analytik OCEMS',
  'calibration procedure',
  'level transmitter manual',
  'flow meter datasheet',
];

export default function Home() {
  const [q, setQ] = useState('');
  const nav = useNavigate();

  const search = useQuery({
    queryKey: ['search', q],
    queryFn: () => runSearch(q),
    enabled: q.length > 0,
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

  return (
    <div className="space-y-10">
      {/* Hero — bold typography, gradient backdrop on the input */}
      <section className="text-center max-w-3xl mx-auto pt-4">
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-brand-700 font-semibold mb-4">
          Full-text search across PDF contents
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 mb-3">
          Find any document <span className="text-brand-700">in seconds.</span>
        </h1>
        <p className="text-slate-600 text-base mb-8">
          Sensor manuals, troubleshooting steps, technical data sheets — searchable across every page.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); }}
          className="relative max-w-2xl mx-auto"
        >
          <div className="relative">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder="e.g. troubleshooting steps for DO sensor"
              className="w-full pl-12 pr-20 py-4 text-base rounded-xl border border-slate-300 bg-white shadow-sm focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15 outline-none transition"
            />
            <SearchIcon size={18} strokeWidth={2} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            {q && (
              <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 text-xs font-medium px-2 py-1 rounded hover:bg-slate-100">
                Clear
              </button>
            )}
          </div>
        </form>

        {!q && (
          <div className="mt-5 flex gap-2 flex-wrap justify-center">
            <span className="muted self-center text-xs">Try:</span>
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => setQ(e)} className="bg-white border border-slate-200 hover:border-brand-700 hover:text-brand-700 rounded-md px-3 py-1.5 text-xs font-medium text-slate-700 transition">
                {e}
              </button>
            ))}
          </div>
        )}
      </section>

      {q && (
        <section className="space-y-3 max-w-4xl mx-auto">
          <div className="muted">
            {search.isLoading ? 'Searching…' : `${search.data?.hits.length ?? 0} result(s) for "${q}"`}
          </div>
          {(search.data?.hits ?? []).map((h) => (
            <DocCard key={`${h.document_id}-${h.page_number}`} hit={h} query={q} />
          ))}
          {search.data && search.data.hits.length === 0 && !search.isLoading && (
            <div className="card text-sm text-slate-500 text-center">
              No matches. Try fewer keywords or <a href="#/browse" className="text-brand-700 underline">browse all documents</a>.
            </div>
          )}
        </section>
      )}

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
                    Consolidated reference · updated {new Date(d.last_updated_at).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))}
            {(recent.data ?? []).length === 0 && (
              <div className="card text-sm text-slate-500 col-span-full text-center">
                No consolidated references yet. Submissions approved in the Review queue will appear here.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
