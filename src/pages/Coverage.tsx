import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, canUpload } from '../lib/auth';
import PageHeader from '../components/PageHeader';
import { coverageOf, CHECKLIST_SECTIONS, SECTION_LABEL } from '../lib/consolidated';

/**
 * Documentation coverage across every sensor in the tool (uploaders + admins).
 * Surfaces under-documented sensors so the team knows what to chase.
 */
export default function Coverage() {
  const { profile } = useAuth();
  const nav = useNavigate();

  const models = useQuery({
    queryKey: ['coverage-models'],
    enabled: canUpload(profile),
    queryFn: async () => (await supabase
      .from('sensor_models')
      .select('id, model_no, name, sensor_makes(name), sensor_categories(name), consolidated_docs(id, content_markdown)')
      .eq('is_general', false)
      .order('model_no')).data ?? [],
  });

  const rows = useMemo(() => {
    return (models.data ?? []).map((m: any) => {
      const cd = Array.isArray(m.consolidated_docs) ? m.consolidated_docs[0] : m.consolidated_docs;
      const cov = coverageOf(cd?.content_markdown);
      return {
        id: m.id,
        consolidatedId: cd?.id ?? null,
        make: m.sensor_makes?.name ?? '',
        model: m.model_no || m.name || 'Untitled',
        category: m.sensor_categories?.name ?? '—',
        cov,
      };
    }).sort((a, b) => a.cov.covered - b.cov.covered); // most incomplete first
  }, [models.data]);

  const complete = rows.filter((r) => r.cov.complete).length;

  if (!canUpload(profile)) {
    return <div className="card text-sm">Uploaders and admins only.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documentation"
        title="Documentation coverage"
        subtitle="Every sensor in the tool, ranked by how much documentation is still missing."
        stats={[
          { label: 'Sensors', value: rows.length },
          { label: 'Fully documented', value: complete },
          { label: 'Need work', value: rows.length - complete },
        ]}
      />

      <div className="space-y-2">
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => nav(r.consolidatedId ? `/consolidated/${r.consolidatedId}` : `/sensors/${r.id}`)}
            className="w-full card-tight text-left hover:border-brand-700 transition flex items-center gap-3"
          >
            <div className="bg-brand-50 text-brand-700 rounded-md w-9 h-9 flex items-center justify-center shrink-0"><Cpu size={16} strokeWidth={2} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 truncate">{r.make} {r.model}</span>
                <span className="badge">{r.category}</span>
                {r.cov.complete
                  ? <span className="badge-green text-[10px]">Complete</span>
                  : <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-medium px-2 py-0.5">{r.cov.covered}/{r.cov.total}</span>}
              </div>
              {!r.cov.complete && r.cov.missing.length > 0 && (
                <div className="text-xs text-slate-500 mt-1">
                  Missing: {r.cov.missing.map((s) => SECTION_LABEL[s]).join(' · ')}
                </div>
              )}
            </div>
            {/* coverage bar */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full ${r.cov.complete ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${(r.cov.covered / r.cov.total) * 100}%` }} />
              </div>
              <ArrowRight size={15} className="text-slate-300" />
            </div>
          </button>
        ))}
        {!models.isLoading && rows.length === 0 && (
          <div className="card text-sm text-slate-500 text-center">No sensors in the catalog yet.</div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        “Missing” is measured against {CHECKLIST_SECTIONS.length} operator-critical work types. A newly-added sensor
        starts at 0/{CHECKLIST_SECTIONS.length} until content is approved into it.
      </p>
    </div>
  );
}
