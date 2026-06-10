import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import PageHeader from '../components/PageHeader';
import { SECTION_LABEL, SECTION_ORDER, parseSections } from '../lib/consolidated';
import type { SubmissionSection } from '../lib/types';

export default function ConsolidatedViewer() {
  const { id } = useParams();           // consolidated_doc_id
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { profile } = useAuth();
  const initialQuery = params.get('q') ?? '';
  const [highlight, setHighlight] = useState(initialQuery);

  const cdoc = useQuery({
    queryKey: ['consolidated-doc', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('consolidated_docs')
        .select('*, sensor_models(model_no, sensor_makes(name), sensor_categories(name))')
        .eq('id', id)
        .maybeSingle();
      return data;
    },
  });

  // Source PDFs for this sensor (from approved submissions, for the "Original PDFs" sidebar)
  const sources = useQuery({
    queryKey: ['consolidated-sources', cdoc.data?.sensor_model_id],
    queryFn: async () => {
      if (!cdoc.data?.sensor_model_id) return [];
      const { data } = await supabase
        .from('document_submissions')
        .select('id, title, storage_path, target_section, reviewed_at')
        .eq('sensor_model_id', cdoc.data.sensor_model_id)
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false });
      return data ?? [];
    },
    enabled: Boolean(cdoc.data?.sensor_model_id),
  });

  const sections = useMemo(() => parseSections(cdoc.data?.content_markdown), [cdoc.data?.content_markdown]);

  async function openSource(storagePath: string | null) {
    if (!storagePath) return;
    const { data } = await supabase.storage.from('documents').createSignedUrl(storagePath, 600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  if (cdoc.isLoading) return <div className="muted p-6">Loading…</div>;
  if (!cdoc.data) return <div className="card text-sm">Consolidated document not found.</div>;

  const sm = cdoc.data.sensor_models;
  const title = `${sm?.sensor_makes?.name ?? ''} ${sm?.model_no ?? ''}`.trim();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Consolidated reference"
        icon="📘"
        title={title}
        subtitle={sm?.sensor_categories?.name}
        stats={[{ label: 'Sections', value: SECTION_ORDER.filter((s) => sections[s]).length }]}
        action={
          <div className="flex gap-2">
            <button onClick={() => nav(-1)} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-3 py-2 text-sm shadow-sm">← Back</button>
            {isAdmin(profile) && (
              <button onClick={() => nav(`/consolidated/${id}/edit`)} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-3 py-2 text-sm shadow-sm">✎ Edit</button>
            )}
          </div>
        }
      />

      {/* Highlight bar */}
      <div className="card-tight flex items-center gap-3">
        <div className="muted text-xs whitespace-nowrap">Highlight in document:</div>
        <input
          className="input"
          value={highlight}
          onChange={(e) => setHighlight(e.target.value)}
          placeholder="word or phrase…"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Body */}
        <div className="space-y-5">
          {/* Section nav */}
          <nav className="card-tight flex items-center gap-2 flex-wrap text-sm">
            {SECTION_ORDER.filter((s) => sections[s]).map((s) => (
              <a key={s} href={`#${s}`}
                 className="rounded-full px-3 py-1 text-xs font-medium border border-slate-200 hover:border-brand-700 hover:text-brand-700 transition">
                {SECTION_LABEL[s]}
              </a>
            ))}
            {SECTION_ORDER.every((s) => !sections[s]) && (
              <div className="muted text-sm">No content yet. Approved submissions will be merged in here.</div>
            )}
          </nav>

          {SECTION_ORDER.map((s) => sections[s] && (
            <section key={s} id={s} className="card">
              <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">
                {SECTION_LABEL[s]}
              </h2>
              <div
                className="prose-doc text-slate-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderText(sections[s], highlight) }}
              />
            </section>
          ))}
        </div>

        {/* Sidebar: source PDFs */}
        <aside className="space-y-3">
          <div className="card-tight">
            <div className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">📄 Original PDFs</div>
            {(sources.data ?? []).length === 0 && <div className="muted text-sm">No source files yet.</div>}
            {(sources.data ?? []).map((s: any) => (
              <button key={s.id} onClick={() => openSource(s.storage_path)}
                      className="block w-full text-left rounded-md p-2 hover:bg-slate-50 transition">
                <div className="text-sm font-medium text-slate-900 truncate">{s.title}</div>
                <div className="muted text-xs">{SECTION_LABEL[(s.target_section ?? 'other') as SubmissionSection]} · {new Date(s.reviewed_at).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <style>{`
        .prose-doc { white-space: pre-wrap; }
        .prose-doc mark { background: rgba(255, 213, 0, 0.45); padding: 0; border-radius: 2px; }
      `}</style>
    </div>
  );
}

function renderText(text: string, q?: string) {
  const escaped = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  if (!q?.trim()) return escaped;
  const terms = q.split(/\s+/).map((t) => t.replace(/[^a-zA-Z0-9]/g, '')).filter((t) => t.length > 1);
  if (terms.length === 0) return escaped;
  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`\\b(?:${pattern})\\w*`, 'gi');
  return escaped.replace(re, '<mark>$&</mark>');
}
