import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Cpu } from 'lucide-react';
import { FilterBar, FilterSearch, FilterSelect, FilterClear } from '../components/FilterBar';
import { supabase } from '../lib/supabase';
import { useAuth, canUpload } from '../lib/auth';
import PageHeader from '../components/PageHeader';
import CategoryOptions from '../components/CategoryOptions';
import AddSensorModal from '../components/AddSensorModal';
import { coverageOf, coverageWithGeneral, SECTION_LABEL, sectionLabel } from '../lib/consolidated';
import type { DeviceDomain } from '../lib/types';

const PAGE_SIZE = 24;

// One page, two doors: /sensors and /electronics. Same catalogue table, split
// by the category's domain — a UPS never sits between two pH probes.
export default function SensorModelList({ domain = 'sensor' }: { domain?: DeviceDomain }) {
  const { profile } = useAuth();
  const isElectronics = domain === 'electronics';
  const noun = isElectronics ? 'device' : 'sensor';
  const showCoverage = canUpload(profile);
  const [params] = useSearchParams();
  const docsParam = params.get('docs'); // 'incomplete' arrives from the Insights "View all" link

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [sortMode, setSortMode] = useState<'category' | 'gap'>(docsParam === 'incomplete' ? 'gap' : 'category');
  const [incompleteOnly, setIncompleteOnly] = useState(docsParam === 'incomplete');

  const allCats = useQuery({ queryKey: ['cats-domain'], queryFn: async () => (await supabase.from('sensor_categories').select('id,name,domain').order('name')).data ?? [] });
  const cats = { ...allCats, data: (allCats.data ?? []).filter((c: any) => (c.domain ?? 'sensor') === domain) };
  const allMakes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });

  const models = useQuery({
    queryKey: ['sensor-models', domain, cat, makeId],
    queryFn: async () => {
      let qb = supabase
        .from('sensor_models')
        .select('id, model_no, name, category_id, sensor_makes(name), sensor_categories!inner(name, domain))')
        .eq('is_general', false)
        .eq('sensor_categories.domain', domain)
        .order('model_no')
        .limit(2000);
      if (cat) qb = qb.eq('category_id', cat);
      if (makeId) qb = qb.eq('make_id', makeId);
      return (await qb).data ?? [];
    },
  });

  // Coverage map (uploaders/admins only): sensor_model_id -> coverage
  const coverage = useQuery({
    queryKey: ['coverage-map'],
    enabled: showCoverage,
    queryFn: async () => {
      const { data } = await supabase.from('consolidated_docs').select('sensor_model_id, content_markdown, sensor_models(category_id, is_general, sensor_categories(domain))').is('deleted_at', null);
      const own: Record<string, string> = {}; const general: Record<string, string> = {}; const domOf: Record<string, string> = {};
      for (const d of (data ?? []) as any[]) {
        const sm = Array.isArray(d.sensor_models) ? d.sensor_models[0] : d.sensor_models;
        const cat = Array.isArray(sm?.sensor_categories) ? sm.sensor_categories[0] : sm?.sensor_categories;
        if (sm?.is_general) general[sm.category_id] = d.content_markdown; else { own[d.sensor_model_id] = d.content_markdown; domOf[d.sensor_model_id] = cat?.domain; }
      }
      return { own, general, domOf };
    },
  });
  // Coverage as the READER sees it (own + category-general), so a Microtek UPS
  // whose handbook lives on 'General — UPS' is not shown as 0/8.
  const covOf = (id: string, categoryId?: string | null) => {
    const c = coverage.data;
    if (!c) return { ...coverageOf(''), viaGeneral: false };
    return coverageWithGeneral(c.own[id], categoryId ? c.general[categoryId] : undefined, domain);
  };

  const makes = useMemo(() => {
    const present = new Set(((models.data ?? []) as any[]).map((m) => m.sensor_makes?.name));
    const list = (allMakes.data ?? []).filter((mk: any) => present.has(mk.name));
    return { data: makeId && !list.some((mk: any) => mk.id === makeId) ? allMakes.data ?? [] : list } as { data: any[] };
  }, [allMakes.data, models.data, makeId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = (models.data ?? []) as any[];
    if (modelId) list = list.filter((m) => m.id === modelId);
    if (needle) list = list.filter((m) => [m.model_no, m.name, m.sensor_makes?.name, m.sensor_categories?.name].filter(Boolean).some((s: string) => s.toLowerCase().includes(needle)));
    if (showCoverage && incompleteOnly) list = list.filter((m) => !covOf(m.id, m.category_id).complete);
    return list;
  }, [q, models.data, modelId, incompleteOnly, showCoverage, coverage.data]);

  // Gap view (uploaders/admins): one flat list ranked least-documented first.
  const ranked = useMemo(() => {
    if (!(showCoverage && sortMode === 'gap')) return [];
    return [...filtered].sort((a, b) => covOf(a.id, a.category_id).covered - covOf(b.id, b.category_id).covered);
  }, [filtered, sortMode, showCoverage, coverage.data]);

  const useGapView = showCoverage && sortMode === 'gap';
  const pageList = useGapView ? ranked : filtered;
  const pageCount = Math.max(1, Math.ceil(pageList.length / PAGE_SIZE));
  const visible = pageList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function reset() { setQ(''); setCat(''); setMakeId(''); setModelId(''); setIncompleteOnly(false); setSortMode('category'); setPage(0); }
  const hasFilter = q || cat || makeId || modelId || incompleteOnly || sortMode === 'gap';

  // Category-grouped view (default / everyone)
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    const e: Record<string, any[]> = {};
    for (const m of visible as any[]) {
      const k = m.sensor_categories?.name || 'Uncategorised';
      (g[k] ??= []).push(m);
    }
    void e;
    return g;
  }, [visible]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title={isElectronics ? 'Electronics catalog' : 'Sensor catalog'}
        subtitle={isElectronics ? `${models.data?.length ?? 0} devices — UPS, cameras, dataloggers and whatever comes next` : `${models.data?.length ?? 0} models across ${makes.data?.length ?? 0} makes`}
        stats={[
          { label: 'Total models', value: models.data?.length ?? 0 },
          { label: 'Showing', value: pageList.length },
          { label: 'Makes', value: makes.data?.length ?? 0 },
        ]}
        action={canUpload(profile) && (
          <button onClick={() => setShowAdd(true)} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-4 py-2 font-semibold text-sm shadow-sm">
            + New {noun}
          </button>
        )}
      />

      <FilterBar>
        <FilterSearch value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Search make, model, or description…" />
        <FilterSelect value={cat} active={Boolean(cat)} onChange={(v) => { setCat(v); setPage(0); }}>
          <option value="">All categories</option>
          <CategoryOptions categories={cats.data as any} />
        </FilterSelect>
        <FilterSelect value={makeId} active={Boolean(makeId)} onChange={(v) => { setMakeId(v); setModelId(''); setPage(0); }}>
          <option value="">All makes</option>
          {makes.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </FilterSelect>
        <FilterSelect value={modelId} active={Boolean(modelId)} disabled={!makeId} onChange={(v) => { setModelId(v); setPage(0); }}>
          <option value="">{makeId ? 'All models' : 'Model'}</option>
          {(models.data ?? []).map((m: any) => <option key={m.id} value={m.id}>{m.model_no || m.name}</option>)}
        </FilterSelect>

        {/* Documentation controls — uploaders / admins only */}
        {showCoverage && (
          <>
            <FilterSelect value={sortMode} active={sortMode === 'gap'} onChange={(v) => { setSortMode(v as any); setPage(0); }}>
              <option value="category">Sort: by category</option>
              <option value="gap">Sort: least documented</option>
            </FilterSelect>
            <button
              onClick={() => { setIncompleteOnly((v) => !v); setPage(0); }}
              className={`tap rounded-lg border px-3 py-2 text-sm transition ${incompleteOnly ? 'border-amber-400 bg-amber-50 text-amber-800 font-medium' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'}`}
            >
              Incomplete only
            </button>
          </>
        )}
        {hasFilter && <FilterClear onClick={reset} />}
      </FilterBar>

      {pageList.length === 0 && (
        <div className="card text-sm text-slate-500 text-center">No models match.</div>
      )}

      {/* GAP VIEW — flat, ranked least-documented first (uploaders/admins) */}
      {useGapView && pageList.length > 0 && (
        <div className="space-y-2">
          {visible.map((m: any) => {
            const c = covOf(m.id, m.category_id);
            return (
              <Link to={`/sensors/${m.id}`} key={m.id} className="card-tight flex items-center gap-3 hover:border-brand-700 transition group">
                <div className="bg-brand-50 text-brand-700 rounded-md w-9 h-9 flex items-center justify-center shrink-0"><Cpu size={16} strokeWidth={2} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 truncate group-hover:text-brand-700 transition">{m.sensor_makes?.name} {m.model_no || m.name}</span>
                    <span className="badge">{m.sensor_categories?.name ?? '—'}</span>
                    <CoverageChip cov={c} />
                  </div>
                  {!c.complete && c.missing.length > 0 && (
                    <div className="text-xs text-slate-500 mt-1">Missing: {c.missing.map((s) => sectionLabel(s)).join(' · ')}</div>
                  )}
                </div>
                <div className="hidden sm:block w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0">
                  <div className={`h-full ${c.complete ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${(c.covered / c.total) * 100}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* CATEGORY VIEW — grouped cards (default / everyone) */}
      {!useGapView && Object.entries(grouped).map(([category, items]) => (
        <section key={category}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-500">{category}</h2>
            <span className="muted text-xs">{items.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((m: any) => (
              <Link to={`/sensors/${m.id}`} key={m.id} className="card-tight hover:border-brand-700 hover:shadow-md transition group">
                <div className="flex items-start gap-3">
                  <div className="bg-brand-50 text-brand-700 rounded-md w-9 h-9 flex items-center justify-center shrink-0 group-hover:bg-brand-700 group-hover:text-white transition"><Cpu size={16} strokeWidth={2} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500">{m.sensor_makes?.name ?? '—'}</div>
                    <div className="font-semibold text-slate-900 truncate">{m.model_no || m.name || 'Untitled'}</div>
                    {m.name && m.model_no && <div className="text-xs text-slate-500 truncate mt-0.5">{m.name}</div>}
                    {showCoverage && <CoverageChip cov={covOf(m.id, m.category_id)} />}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="muted">Page {page + 1} of {pageCount}</div>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
            <button className="btn-secondary btn-sm" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        </div>
      )}

      {showAdd && <AddSensorModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function CoverageChip({ cov }: { cov?: { covered: number; total: number; complete: boolean; viaGeneral?: boolean } }) {
  const c = cov ?? { covered: 0, total: 8, complete: false };
  if (c.complete) {
    return <span className="inline-block mt-1.5 badge-green text-[10px]">Docs complete{c.viaGeneral ? ' · general guidance' : ''}</span>;
  }
  if (c.covered === 0) {
    return <span className="inline-block mt-1.5 rounded-full bg-red-50 text-red-700 text-[10px] font-medium px-2 py-0.5">No documentation</span>;
  }
  return (
    <span className="inline-block mt-1.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-medium px-2 py-0.5" title={c.viaGeneral ? 'From the category’s general reference' : undefined}>
      Docs {c.covered}/{c.total}{c.viaGeneral ? ' · general' : ''}
    </span>
  );
}
