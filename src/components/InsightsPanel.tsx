import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, SearchX, ShieldCheck, FileWarning, ArrowRight, Globe2, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { coverageOf } from '../lib/consolidated';
import { fetchLeaderboard } from '../lib/contributions';

type Range = '30' | '90' | 'all';
const RANGE_DAYS: Record<Range, number> = { '30': 30, '90': 90, all: 0 };

function within(iso: string, range: Range) {
  if (range === 'all') return true;
  return new Date(iso).getTime() >= Date.now() - RANGE_DAYS[range] * 86400000;
}
function docTitle(row: any): string {
  const cd = Array.isArray(row.consolidated_docs) ? row.consolidated_docs[0] : row.consolidated_docs;
  const sm = cd ? (Array.isArray(cd.sensor_models) ? cd.sensor_models[0] : cd.sensor_models) : null;
  const mk = sm ? (Array.isArray(sm.sensor_makes) ? sm.sensor_makes[0] : sm.sensor_makes) : null;
  return `${mk?.name ?? ''} ${sm?.model_no ?? ''}`.trim() || 'Unknown';
}

export default function InsightsPanel() {
  const nav = useNavigate();
  const [range, setRange] = useState<Range>('30');

  const feedback = useQuery({
    queryKey: ['insights-feedback'],
    queryFn: async () => (await supabase
      .from('answer_feedback')
      .select('id, helpful, reason, query, consolidated_doc_id, source, created_at, consolidated_docs(sensor_models(model_no, sensor_makes(name)))')
      .order('created_at', { ascending: false })
      .limit(5000)).data ?? [],
  });

  const unanswered = useQuery({
    queryKey: ['insights-unanswered'],
    queryFn: async () => (await supabase
      .from('unanswered_queries')
      .select('id, query, source, created_at')
      .order('created_at', { ascending: false })
      .limit(5000)).data ?? [],
  });

  const coverage = useQuery({
    queryKey: ['insights-coverage'],
    queryFn: async () => (await supabase
      .from('sensor_models')
      .select('id, consolidated_docs(content_markdown)').is('consolidated_docs.deleted_at', null)
      .eq('is_general', false)).data ?? [],
  });

  const leaderboard = useQuery({
    queryKey: ['contribution-leaderboard'],
    queryFn: fetchLeaderboard,
  });

  const events = useQuery({
    queryKey: ['insights-events'],
    queryFn: async () => (await supabase
      .from('usage_events')
      .select('id, event, created_at')
      .order('created_at', { ascending: false })
      .limit(5000)).data ?? [],
  });

  const fb = useMemo(() => (feedback.data ?? []).filter((r: any) => within(r.created_at, range)), [feedback.data, range]);
  const ua = useMemo(() => (unanswered.data ?? []).filter((r: any) => within(r.created_at, range)), [unanswered.data, range]);
  const webSearches = useMemo(
    () => (events.data ?? []).filter((r: any) => r.event === 'web_search' && within(r.created_at, range)).length,
    [events.data, range],
  );

  const solved = fb.filter((r: any) => r.helpful).length;
  const notHelpful = fb.filter((r: any) => !r.helpful).length;
  const total = fb.length;
  const solveRate = total > 0 ? Math.round((solved / total) * 100) : null;

  // Content that didn't help — grouped by document
  const unhelpfulByDoc = useMemo(() => {
    const g: Record<string, { title: string; docId: string | null; count: number; reasons: string[] }> = {};
    for (const r of fb as any[]) {
      if (r.helpful) continue;
      const key = r.consolidated_doc_id || 'unknown';
      g[key] ??= { title: docTitle(r), docId: r.consolidated_doc_id ?? null, count: 0, reasons: [] };
      g[key].count++;
      if (r.reason) g[key].reasons.push(r.reason);
    }
    return Object.values(g).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [fb]);

  // Most-requested-but-missing — grouped by normalized query
  const topMissing = useMemo(() => {
    const g: Record<string, { query: string; count: number; sources: Set<string> }> = {};
    for (const r of ua as any[]) {
      const key = r.query.trim().toLowerCase();
      g[key] ??= { query: r.query.trim(), count: 0, sources: new Set() };
      g[key].count++;
      g[key].sources.add(r.source);
    }
    return Object.values(g).sort((a, b) => b.count - a.count).slice(0, 15);
  }, [ua]);

  // Documentation coverage (sensors in the tool)
  const cov = useMemo(() => {
    const rows = (coverage.data ?? []).map((m: any) => {
      const cd = Array.isArray(m.consolidated_docs) ? m.consolidated_docs[0] : m.consolidated_docs;
      return coverageOf(cd?.content_markdown);
    });
    const complete = rows.filter((c) => c.complete).length;
    return { complete, total: rows.length };
  }, [coverage.data]);

  return (
    <div className="space-y-5">
      {/* Range toggle */}
      <div className="inline-flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
        {(['30', '90', 'all'] as Range[]).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${range === r ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {r === 'all' ? 'All time' : `Last ${r} days`}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={<ShieldCheck size={16} />} tone="emerald"
          label="Solve rate" value={solveRate === null ? '—' : `${solveRate}%`}
          sub={total > 0 ? `${total} responses` : 'no feedback yet'} />
        <Stat icon={<ThumbsUp size={16} />} tone="emerald"
          label="Solved (tickets avoided)" value={solved} sub="marked solved" />
        <Stat icon={<ThumbsDown size={16} />} tone="red"
          label="Didn't help" value={notHelpful} sub="content existed, didn't solve" />
        <Stat icon={<SearchX size={16} />} tone="amber"
          label="Came up empty" value={ua.length} sub="searches with no result" />
        <Stat icon={<Globe2 size={16} />} tone="slate"
          label="Web searches" value={webSearches} sub="escalated to the web" />
      </div>

      {/* Most requested but missing */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <SearchX size={15} className="text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-900">Most requested, not found</h3>
          <span className="muted text-xs ml-auto">what to document next</span>
        </div>
        {topMissing.length === 0 ? (
          <div className="muted text-sm p-5 text-center">No unanswered searches in this period.</div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {topMissing.map((m, i) => (
              <li key={i} className="px-5 py-2.5 flex items-center gap-3">
                <span className="text-sm text-slate-800 flex-1 truncate">{m.query}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">{[...m.sources].join(', ')}</span>
                <span className="rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 min-w-[28px] text-center">{m.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Content that didn't help */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <FileWarning size={15} className="text-red-600" />
          <h3 className="text-sm font-semibold text-slate-900">Content that didn't help</h3>
          <span className="muted text-xs ml-auto">existed but didn't solve the problem</span>
        </div>
        {unhelpfulByDoc.length === 0 ? (
          <div className="muted text-sm p-5 text-center">No "didn't help" feedback in this period.</div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {unhelpfulByDoc.map((d, i) => (
              <li key={i} className="px-5 py-3">
                <button
                  onClick={() => d.docId && nav(`/consolidated/${d.docId}`)}
                  className="w-full text-left flex items-start gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate group-hover:text-brand-700 transition">{d.title}</span>
                      <span className="rounded-full bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5">{d.count}</span>
                    </div>
                    {d.reasons.length > 0 && (
                      <div className="text-xs text-slate-500 mt-1 line-clamp-2 italic">“{d.reasons[0]}”{d.reasons.length > 1 && ` +${d.reasons.length - 1} more`}</div>
                    )}
                  </div>
                  {d.docId && <ArrowRight size={14} className="text-slate-300 group-hover:text-brand-700 transition shrink-0 mt-1" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Documentation coverage summary */}
      <section className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Documentation coverage</div>
          <div className="muted text-xs mt-0.5">
            {cov.complete} of {cov.total} sensors in the tool are fully documented
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-40 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-brand-600" style={{ width: `${cov.total ? (cov.complete / cov.total) * 100 : 0}%` }} />
          </div>
          <button onClick={() => nav('/sensors?docs=incomplete')} className="text-sm text-brand-700 font-medium hover:underline inline-flex items-center gap-1">
            View all <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* Top contributors — who's building the knowledge base */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Award size={15} className="text-brand-600" />
          <h3 className="text-sm font-semibold text-slate-900">Top contributors</h3>
          <span className="muted text-xs ml-auto">+10 per approved upload · +5 when it powers a flow</span>
        </div>
        {(leaderboard.data ?? []).length === 0 ? (
          <div className="muted text-sm p-5 text-center">No approved contributions yet.</div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {(leaderboard.data ?? []).slice(0, 10).map((r, i) => (
              <li key={r.user_id} className="px-5 py-2.5 flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                  i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                }`}>{i + 1}</span>
                <span className="text-sm text-slate-800 flex-1 truncate">{r.full_name || 'Contributor'}</span>
                <span className="text-xs text-slate-400">{r.approvals} approved</span>
                <span className="rounded-full bg-brand-50 text-brand-700 text-xs font-bold px-2.5 py-0.5">{r.total_points} pts</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-400">
        Coverage counts sensors already in the tool. Sensors deployed in the field but not yet entered are not
        counted until a master sensor list is connected.
      </p>
    </div>
  );
}

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone: 'emerald' | 'red' | 'amber' | 'slate'; }) {
  const toneCls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-md mb-2 ${toneCls[tone]}`}>{icon}</div>
      <div className="text-2xl font-semibold text-slate-900 leading-tight">{value}</div>
      <div className="text-xs font-medium text-slate-700 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
