import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DocCard } from '../components/DocCard';
import { runSearch } from '../lib/search';
import { supabase } from '../lib/supabase';

const EXAMPLES = [
  'Brotek UT-116 manual',
  'troubleshooting DO sensor',
  'warranty certificate',
  'P&ID',
  'calibration',
];

export default function Home() {
  const [q, setQ] = useState('');

  const search = useQuery({
    queryKey: ['search', q],
    queryFn: () => runSearch(q),
    enabled: q.length > 0,
  });

  const recent = useQuery({
    queryKey: ['recent-docs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('documents')
        .select('id, title, uploaded_at, document_types(label), plants(name)')
        .order('uploaded_at', { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-10">
      {/* Hero — bold typography, gradient backdrop on the input */}
      <section className="text-center max-w-3xl mx-auto pt-4">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 rounded-full px-3 py-1 text-xs font-semibold tracking-wide mb-4">
          ⚡ Searching across all PDF contents
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-3">
          Find any document <span className="text-brand-700">in seconds.</span>
        </h1>
        <p className="text-slate-600 text-lg mb-8">
          Manuals, datasheets, certificates, I/O lists, P&amp;IDs — full-text search across every page.
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
              className="w-full pl-14 pr-32 py-5 text-lg rounded-2xl border border-slate-200 bg-white shadow-lg shadow-brand-900/5 focus:border-brand-700 focus:ring-4 focus:ring-brand-700/10 outline-none transition"
            />
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-2xl">🔍</div>
            {q && (
              <button type="button" onClick={() => setQ('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm">
                Clear
              </button>
            )}
          </div>
        </form>

        {!q && (
          <div className="mt-5 flex gap-2 flex-wrap justify-center">
            <span className="muted self-center text-xs">Try:</span>
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => setQ(e)} className="bg-white border border-slate-200 hover:border-brand-700 hover:text-brand-700 rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 transition">
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
          <h2 className="section-title">Recently uploaded</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(recent.data ?? []).map((d: any) => (
              <div key={d.id} className="card-tight flex items-start gap-3">
                <div className="bg-brand-50 text-brand-700 rounded-lg w-10 h-10 flex items-center justify-center shrink-0">📄</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 truncate">{d.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {d.document_types?.label ?? '—'}{d.plants?.name ? ` · ${d.plants.name}` : ''}
                  </div>
                </div>
              </div>
            ))}
            {(recent.data ?? []).length === 0 && (
              <div className="card text-sm text-slate-500 col-span-full text-center">
                No documents yet. Use <strong>+ Upload</strong> in the top-right to add the first one.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
