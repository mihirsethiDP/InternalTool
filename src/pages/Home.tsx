import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SearchBar, { EXAMPLE_QUERIES } from '../components/SearchBar';
import { DocCard } from '../components/DocCard';
import { runSearch } from '../lib/search';
import { supabase } from '../lib/supabase';

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
        .select(
          'id, title, uploaded_at, document_types(label), plants(name), sensor_models(model_no, sensor_makes(name))'
        )
        .order('uploaded_at', { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Search the document hub</h1>
        <p className="text-slate-600 text-sm">
          One stop shop for manuals, datasheets, certificates, I/O lists, P&IDs, and more.
        </p>
      </div>
      <SearchBar initial={q} onSubmit={setQ} placeholder="e.g. troubleshooting steps Brotek UT-116" />

      {!q && (
        <div className="card">
          <div className="text-sm font-semibold mb-2">Try a search</div>
          <div className="flex gap-2 flex-wrap">
            {EXAMPLE_QUERIES.map((e) => (
              <button key={e} onClick={() => setQ(e)} className="btn-secondary text-xs">
                {e}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500 mt-3">
            Search currently uses Postgres full-text search across PDF contents (keyword + ranking).
            When AI search is enabled, the same queries will also return a synthesized answer with
            citations — no UI changes required.
          </div>
        </div>
      )}

      {q && (
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            {search.isLoading ? 'Searching…' : `${search.data?.hits.length ?? 0} result(s) for "${q}"`}
          </div>
          {search.data?.answer && (
            <div className="card bg-brand-50 border-brand-200">
              <div className="text-xs font-semibold text-brand-700 mb-1">AI ANSWER</div>
              <div className="text-sm whitespace-pre-wrap">{search.data.answer}</div>
            </div>
          )}
          {(search.data?.hits ?? []).map((h) => (
            <DocCard key={`${h.document_id}-${h.page_number}`} hit={h} query={q} />
          ))}
          {search.data && search.data.hits.length === 0 && !search.isLoading && (
            <div className="card text-sm text-slate-500">
              No matches. Try fewer keywords, or browse by plant/sensor instead.
            </div>
          )}
        </div>
      )}

      {!q && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Recently uploaded</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(recent.data ?? []).map((d: any) => (
              <div key={d.id} className="card">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📄</span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.title}</div>
                    <div className="text-xs text-slate-500">
                      {d.document_types?.label} · {d.plants?.name ?? d.sensor_models?.model_no ?? '—'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(recent.data ?? []).length === 0 && (
              <div className="card text-sm text-slate-500">No documents yet. Be the first to upload!</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
