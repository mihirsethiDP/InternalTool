import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SearchBar from '../components/SearchBar';
import { DocCard } from '../components/DocCard';
import { runSearch } from '../lib/search';
import { supabase } from '../lib/supabase';

// Miller's law: show only 5 example chips initially.
const EXAMPLES = [
  'Brotek UT-116 manual',
  'troubleshooting steps DO sensor',
  'warranty certificate',
  'I/O list',
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
        .select('id, title, uploaded_at, document_types(label), plants(name), sensor_models(model_no, sensor_makes(name))')
        .order('uploaded_at', { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-8">
      {/* Hero search — single dominant action, generous whitespace */}
      <section className="text-center max-w-3xl mx-auto pt-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
          Find any document in seconds.
        </h1>
        <p className="text-slate-500 mb-6">
          Manuals, datasheets, certificates, I/O lists, P&amp;IDs — searchable across PDF contents.
        </p>
        <SearchBar initial={q} onSubmit={setQ} placeholder="Search documents, sensors, plants…" />
        {!q && (
          <div className="mt-4 flex gap-2 flex-wrap justify-center">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => setQ(e)} className="btn-secondary btn-sm">
                {e}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Results */}
      {q && (
        <section className="space-y-3 max-w-4xl mx-auto">
          <div className="text-sm text-slate-500">
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
            <div className="card text-sm text-slate-500 text-center">
              No matches. Try fewer keywords, or <a href="#/browse" className="text-brand-700 underline">browse by filter</a>.
            </div>
          )}
        </section>
      )}

      {/* Recent uploads — visible only on landing */}
      {!q && (
        <section>
          <h2 className="section-title">Recently uploaded</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(recent.data ?? []).map((d: any) => (
              <div key={d.id} className="card-tight flex items-start gap-3">
                <div className="bg-brand-50 text-brand-700 rounded-lg w-10 h-10 flex items-center justify-center shrink-0">📄</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 truncate">{d.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {d.document_types?.label ?? '—'} · {d.plants?.name ?? d.sensor_models?.model_no ?? '—'}
                  </div>
                </div>
              </div>
            ))}
            {(recent.data ?? []).length === 0 && (
              <div className="card text-sm text-slate-500 col-span-full text-center">
                No documents yet. <a href="#/upload" className="text-brand-700 underline">Upload your first one</a>.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
