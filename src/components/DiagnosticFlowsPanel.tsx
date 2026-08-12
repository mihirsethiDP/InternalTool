import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, Sparkles, Check, X, Loader2, Trash2, Pencil, Archive, HelpCircle, Wrench, CheckCircle2, PhoneCall, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Link2, Home, MapPin, GraduationCap, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { validateFlowDefinition, vagueSteps, type DiagnosticFlow, type FlowDefinition, type FlowNode, type EscalationContact } from '../lib/flows';
import { createIssue, updateIssue, deleteIssue, linkFlow, unlinkFlow, swapRanks, type Issue, type IssueFlowLink } from '../lib/issues';

// Admin tab: ISSUE-centric view of the diagnostic knowledge base. Issues are
// the user-side problem statements ("Reading fluctuating"); each maps to an
// ordered queue of flows the chat tries in turn. Drafts demand review (with
// mandatory classification); only approved flows reach Dr. Paani.

interface DocOption { id: string; label: string }

export type FlowClassification = { visit_required: boolean; skill_required: 'anyone' | 'specialist' };

export default function DiagnosticFlowsPanel() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  const [genDoc, setGenDoc] = useState('');
  const [gen, setGen] = useState(false);
  const [genNote, setGenNote] = useState<string | null>(null);

  const flows = useQuery({
    queryKey: ['diagnostic-flows'],
    queryFn: async () => (await supabase
      .from('diagnostic_flows')
      .select('*, sensor_categories(name), sensor_models(model_no, name, sensor_makes(name))')
      .order('created_at', { ascending: false })).data ?? [],
  });

  // Docs the generator can draft from (needs enough content to be useful).
  const docs = useQuery({
    queryKey: ['flows-doc-options'],
    queryFn: async () => {
      const { data } = await supabase
        .from('consolidated_docs')
        .select('id, content_markdown, sensor_models(model_no, name, is_general, sensor_makes(name), sensor_categories(name))').is('deleted_at', null);
      return ((data ?? []) as any[])
        .filter((d) => (d.content_markdown ?? '').trim().length >= 200)
        .map((d): DocOption => {
          const sm = Array.isArray(d.sensor_models) ? d.sensor_models[0] : d.sensor_models;
          const mk = sm ? (Array.isArray(sm.sensor_makes) ? sm.sensor_makes[0] : sm.sensor_makes) : null;
          const cat = sm ? (Array.isArray(sm.sensor_categories) ? sm.sensor_categories[0] : sm.sensor_categories) : null;
          const label = sm?.is_general
            ? `${cat?.name ?? '?'} — category guidance`
            : `${mk?.name ?? ''} ${sm?.model_no || sm?.name || ''}`.trim();
          return { id: d.id, label };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    },
  });

  async function generate() {
    if (!genDoc) return;
    setGen(true); setGenNote(null);
    try {
      const { data, error } = await supabase.functions.invoke('chat-answer', {
        body: { mode: 'generate-flow', consolidated_doc_id: genDoc },
      });
      if (error) throw error;
      const n = Array.isArray(data?.flows) ? data.flows.length : 0;
      setGenNote(n > 0 ? `${n} draft flow${n === 1 ? '' : 's'} generated — review below.` : (data?.note ?? 'Nothing generated.'));
    } catch (e: any) {
      console.warn('generate-flow failed', e);
      setGenNote('Generation failed — check that the edge function is deployed.');
    }
    setGen(false);
    qc.invalidateQueries({ queryKey: ['diagnostic-flows'] });
  }

  // Issues + ordered flow links (the queue each issue walks).
  const issues = useQuery({
    queryKey: ['issues'],
    queryFn: async () => (await supabase.from('issues')
      .select('id, sensor_category_id, label, aliases, sensor_categories(name)')
      .order('label')).data ?? [],
  });
  const links = useQuery({
    queryKey: ['issue-flows'],
    queryFn: async () => (await supabase.from('issue_flows')
      .select('id, issue_id, flow_id, rank').order('rank')).data ?? [],
  });
  const cats = useQuery({
    queryKey: ['cats'],
    queryFn: async () => (await supabase.from('sensor_categories').select('id,name').order('name')).data ?? [],
  });

  const [suggestCat, setSuggestCat] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);

  async function suggestIssues() {
    if (!suggestCat) return;
    setSuggesting(true); setSuggestNote(null);
    try {
      const { data, error } = await supabase.functions.invoke('chat-answer', {
        body: { mode: 'suggest-issues', category_id: suggestCat },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const n = ((data as any).created ?? []).length;
      setSuggestNote(n > 0 ? `${n} issue${n === 1 ? '' : 's'} suggested — review and edit below.` : ((data as any).note ?? 'Nothing new proposed.'));
    } catch (e: any) {
      setSuggestNote(`Suggestion failed (${e.message}). Is the edge function redeployed?`);
    }
    setSuggesting(false);
    qc.invalidateQueries({ queryKey: ['issues'] });
  }

  const refreshIssues = () => {
    qc.invalidateQueries({ queryKey: ['issues'] });
    qc.invalidateQueries({ queryKey: ['issue-flows'] });
  };

  // Approval REQUIRES the confirmed 2×2 — the supervisor's "mandatory" gate.
  async function setStatus(f: any, status: 'approved' | 'archived' | 'draft', cls?: FlowClassification) {
    if (status === 'approved') {
      const v = validateFlowDefinition(f.definition);
      if (!v.ok) { alert('Cannot approve — the flow structure is invalid:\n' + v.errors.join('\n')); return; }
      if (!cls) { alert('Confirm the classification (visit + skill) before approving.'); return; }
    }
    await supabase.from('diagnostic_flows').update({
      status,
      visit_required: status === 'approved' ? cls!.visit_required : f.visit_required,
      skill_required: status === 'approved' ? cls!.skill_required : f.skill_required,
      approved_by: status === 'approved' ? userId : null,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', f.id);
    qc.invalidateQueries({ queryKey: ['diagnostic-flows'] });
  }
  async function remove(id: string) {
    if (!confirm('Delete this flow permanently?')) return;
    await supabase.from('diagnostic_flows').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['diagnostic-flows'] });
  }
  async function saveEdits(id: string, patch: { title: string; trigger_symptoms: string[]; definition: FlowDefinition }) {
    await supabase.from('diagnostic_flows').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['diagnostic-flows'] });
  }

  // Category filter — flows and issues both carry a sensor category, and once
  // several categories have content the mixed list stops being scannable.
  const [catFilter, setCatFilter] = useState('');
  const allList = (flows.data ?? []) as any[];
  const list = catFilter ? allList.filter((f) => f.sensor_category_id === catFilter) : allList;
  const issueList = ((issues.data ?? []) as any[]).filter((i) => !catFilter || i.sensor_category_id === catFilter);
  // Only offer categories that actually have flows or issues.
  const catsWithContent = useMemo(() => {
    const ids = new Set([...allList.map((f) => f.sensor_category_id), ...((issues.data ?? []) as any[]).map((i) => i.sensor_category_id)]);
    return ((cats.data ?? []) as { id: string; name: string }[]).filter((c) => ids.has(c.id));
  }, [allList, issues.data, cats.data]);
  const drafts = list.filter((f) => f.status === 'draft');
  const approved = list.filter((f) => f.status === 'approved');
  const archived = list.filter((f) => f.status === 'archived');
  const needsAction = !flows.isLoading && drafts.length > 0;

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${needsAction ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-200'}`}>
        {/* Header — always shows the primary action */}
        <div className="bg-gradient-to-r from-brand-700 to-brand-900 text-white px-4 sm:px-5 py-3.5 flex items-center gap-3 flex-wrap">
          <span className="bg-white/15 ring-1 ring-white/20 rounded-lg w-8 h-8 flex items-center justify-center shrink-0"><GitBranch size={16} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold tracking-tight">Diagnostic flows</div>
            <div className="text-[11px] text-white/70">
              {approved.length} live flow{approved.length === 1 ? '' : 's'}{drafts.length ? ` · ${drafts.length} awaiting review` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select value={genDoc} onChange={(e) => setGenDoc(e.target.value)}
              className="rounded-lg bg-white/10 ring-1 ring-white/25 text-white text-xs px-2 py-2 max-w-[190px] [&>option]:text-slate-900">
              <option value="">Pick a document…</option>
              {(docs.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <button onClick={generate} disabled={gen || !genDoc}
              className="tap inline-flex items-center gap-1.5 rounded-lg bg-white text-brand-800 px-3 py-2 text-sm font-semibold hover:bg-slate-100 transition disabled:opacity-60">
              {gen ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {gen ? 'Generating…' : 'Generate with AI'}
            </button>
          </div>
        </div>

        <div className="bg-white px-4 sm:px-5 py-4 space-y-4">
          <p className="text-xs text-slate-500">
            Step-by-step diagnostic trees Dr. Paani walks users through — drafted by AI from approved documentation
            (also auto-drafted whenever you approve a submission), then reviewed here. Only approved flows go live.
          </p>

          {catsWithContent.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500 mr-1">Category:</span>
              <button type="button" onClick={() => setCatFilter('')}
                className={`tap rounded-full px-3 py-1 text-xs font-medium border transition ${!catFilter ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-200 hover:border-brand-700 hover:text-brand-700'}`}>
                All
              </button>
              {catsWithContent.map((c) => (
                <button type="button" key={c.id} onClick={() => setCatFilter(c.id === catFilter ? '' : c.id)}
                  className={`tap rounded-full px-3 py-1 text-xs font-medium border transition ${catFilter === c.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-200 hover:border-brand-700 hover:text-brand-700'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {genNote && <div className="text-xs rounded-lg bg-brand-50 border border-brand-200 text-brand-800 px-3 py-2">{genNote}</div>}

          {flows.isLoading ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : list.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-5 text-center">
              <GitBranch size={22} className="text-brand-600 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-800">No diagnostic flows yet</div>
              <div className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Pick a documented sensor above and generate its first flows — or approve a submission and drafts will appear here automatically.</div>
            </div>
          ) : (
            <>
              {drafts.length > 0 && (
                <div className="space-y-3">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-amber-700">Drafts — review, classify &amp; approve</div>
                  {drafts.map((f) => <FlowCard key={f.id} flow={f} onApprove={(cls) => setStatus(f, 'approved', cls)} onDelete={() => remove(f.id)} onSave={saveEdits} />)}
                </div>
              )}

              {/* Issues — the user vocabulary, each with its ordered flow queue */}
              <IssuesBoard
                issues={issueList}
                links={(links.data ?? []) as IssueFlowLink[]}
                flows={list}
                cats={(cats.data ?? []) as { id: string; name: string }[]}
                onChanged={refreshIssues}
                onArchive={(f) => setStatus(f, 'archived')}
                onSave={saveEdits}
                suggest={{
                  cat: suggestCat, setCat: setSuggestCat,
                  run: suggestIssues, busy: suggesting, note: suggestNote,
                }}
              />

              {archived.length > 0 && (
                <details>
                  <summary className="text-xs text-slate-500 cursor-pointer">Archived ({archived.length})</summary>
                  <div className="space-y-3 mt-2">
                    {archived.map((f) => <FlowCard key={f.id} flow={f} onRestore={() => setStatus(f, 'draft')} onDelete={() => remove(f.id)} onSave={saveEdits} />)}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>

      <EscalationContactsCard />
    </div>
  );
}

// ---------- issues board: user vocabulary → ordered flow queues ----------
function IssuesBoard({ issues, links, flows, cats, onChanged, onArchive, onSave, suggest }: {
  issues: any[]; links: IssueFlowLink[]; flows: any[]; cats: { id: string; name: string }[];
  onChanged: () => void;
  onArchive: (f: any) => void;
  onSave: (id: string, patch: { title: string; trigger_symptoms: string[]; definition: FlowDefinition }) => Promise<void>;
  suggest: { cat: string; setCat: (v: string) => void; run: () => void; busy: boolean; note: string | null };
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newCat, setNewCat] = useState('');
  const flowById = new Map(flows.map((f: any) => [f.id, f]));
  const linksByIssue = new Map<string, IssueFlowLink[]>();
  for (const l of links) {
    if (!linksByIssue.has(l.issue_id)) linksByIssue.set(l.issue_id, []);
    linksByIssue.get(l.issue_id)!.push(l);
  }
  const mappedFlowIds = new Set(links.map((l) => l.flow_id));
  const unmapped = flows.filter((f: any) => f.status === 'approved' && !mappedFlowIds.has(f.id));

  async function addIssue() {
    const label = newLabel.trim();
    if (!label) return;
    await createIssue(newCat || null, label, []);
    setNewLabel('');
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-[11px] uppercase tracking-wide font-semibold text-brand-700">Issues — what users report</div>
        <div className="ml-auto flex items-center gap-1.5">
          <select value={suggest.cat} onChange={(e) => suggest.setCat(e.target.value)} className="rounded-lg border border-slate-300 text-xs px-2 py-1.5">
            <option value="">Suggest for category…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={suggest.run} disabled={suggest.busy || !suggest.cat}
            className="tap inline-flex items-center gap-1 rounded-lg border border-brand-300 text-brand-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-brand-50 disabled:opacity-50">
            {suggest.busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Suggest issues with AI
          </button>
        </div>
      </div>
      {suggest.note && <div className="text-xs rounded-lg bg-brand-50 border border-brand-200 text-brand-800 px-3 py-2">{suggest.note}</div>}

      {issues.length === 0 && (
        <div className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-300 px-3 py-3">
          No issues defined yet. Issues are the problems users report ("Reading fluctuating"). Add one below or let the AI suggest a starter set per category.
        </div>
      )}

      {issues.map((iss) => (
        <IssueGroup key={iss.id} issue={iss}
          links={(linksByIssue.get(iss.id) ?? []).sort((a, b) => a.rank - b.rank)}
          flowById={flowById} unmappedApproved={unmapped}
          onChanged={onChanged} onArchive={onArchive} onSave={onSave} />
      ))}

      {unmapped.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-3.5 py-3 space-y-2">
          <div className="text-xs font-semibold text-amber-800">Live flows not linked to any issue ({unmapped.length}) — users can still reach them by phrasing, but they won't chain</div>
          {unmapped.map((f: any) => (
            <MapFlowRow key={f.id} flow={f} issues={issues} onChanged={onChanged} />
          ))}
        </div>
      )}

      {/* add issue */}
      <div className="flex items-center gap-2 flex-wrap rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
          placeholder='New issue — as a user would say it ("Reading fluctuating")' className="input text-xs flex-1 min-w-56" />
        <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className="rounded-lg border border-slate-300 text-xs px-2 py-1.5">
          <option value="">All sensor types</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={addIssue} disabled={!newLabel.trim()}
          className="tap rounded-lg bg-brand-700 text-white px-3 py-1.5 text-xs font-semibold hover:bg-brand-800 disabled:opacity-50">Add issue</button>
      </div>
    </div>
  );
}

function IssueGroup({ issue, links, flowById, unmappedApproved, onChanged, onArchive, onSave }: {
  issue: any; links: IssueFlowLink[]; flowById: Map<string, any>; unmappedApproved: any[];
  onChanged: () => void; onArchive: (f: any) => void;
  onSave: (id: string, patch: { title: string; trigger_symptoms: string[]; definition: FlowDefinition }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(issue.label as string);
  const [aliases, setAliases] = useState((issue.aliases ?? []).join(', '));
  const [viewFlow, setViewFlow] = useState<string | null>(null);
  const catName = (Array.isArray(issue.sensor_categories) ? issue.sensor_categories[0] : issue.sensor_categories)?.name;
  const liveCount = links.filter((l) => flowById.get(l.flow_id)?.status === 'approved').length;

  async function saveIssue() {
    await updateIssue(issue.id, { label: label.trim() || issue.label, aliases: aliases.split(',').map((a: string) => a.trim()).filter(Boolean) });
    setEditing(false);
    onChanged();
  }
  async function removeIssue() {
    if (!confirm(`Delete issue "${issue.label}"? Its flows stay — only the grouping is removed.`)) return;
    await deleteIssue(issue.id);
    onChanged();
  }
  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= links.length) return;
    await swapRanks(links[i], links[j]);
    onChanged();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button onClick={() => setOpen((v) => !v)} className="tap w-full px-3.5 py-3 flex items-center gap-2.5 text-left hover:bg-slate-50 transition rounded-xl">
        {open ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-900">{issue.label}</div>
          <div className="text-[11px] text-slate-500 truncate">
            {catName ?? 'All sensor types'}{(issue.aliases ?? []).length > 0 && <> · “{(issue.aliases as string[]).slice(0, 3).join('” · “')}”</>}
          </div>
        </div>
        <span className={`shrink-0 text-[11px] rounded-full px-2 py-0.5 font-medium ${liveCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {liveCount > 0 ? `${liveCount} flow${liveCount === 1 ? '' : 's'}, ordered` : 'no live flows'}
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-2">
          {editing ? (
            <div className="space-y-1.5">
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="input w-full text-sm" />
              <input value={aliases} onChange={(e) => setAliases(e.target.value)} className="input w-full text-xs" placeholder="Aliases, comma-separated (incl. Hinglish)" />
              <div className="flex gap-2">
                <button onClick={saveIssue} className="tap rounded-md bg-brand-700 text-white px-2.5 py-1 text-xs font-medium">Save</button>
                <button onClick={() => { setEditing(false); setLabel(issue.label); setAliases((issue.aliases ?? []).join(', ')); }} className="tap text-xs text-slate-500">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => setEditing(true)} className="tap inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700"><Pencil size={11} /> Edit label / aliases</button>
              <button onClick={removeIssue} className="tap inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"><Trash2 size={11} /> Delete issue</button>
            </div>
          )}

          {links.length === 0 && <div className="text-xs text-slate-400">No flows linked yet — map one below.</div>}
          {links.map((l, i) => {
            const f = flowById.get(l.flow_id);
            if (!f) return null;
            return (
              <div key={l.id} className="rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="px-2.5 py-2 flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400 w-4 text-center shrink-0">{i + 1}</span>
                  <span className="text-xs font-medium text-slate-800 flex-1 min-w-0 truncate">{f.title}</span>
                  {f.status !== 'approved' && <span className="badge bg-amber-100 text-amber-800 text-[10px] shrink-0">{f.status}</span>}
                  {f.sensor_model_id
                    ? <span className="text-[10px] rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 shrink-0">model-specific</span>
                    : <span className="text-[10px] rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 shrink-0">all makes</span>}
                  {f.visit_required != null && (
                    <span className="text-[10px] rounded-full border border-slate-300 text-slate-600 px-2 py-0.5 shrink-0 inline-flex items-center gap-0.5">
                      {f.visit_required ? <MapPin size={9} /> : <Home size={9} />}{f.visit_required ? 'visit' : 'no visit'} · {f.skill_required ?? '—'}
                    </span>
                  )}
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Try earlier" className="tap text-slate-400 hover:text-brand-700 disabled:opacity-30"><ArrowUp size={13} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === links.length - 1} aria-label="Try later" className="tap text-slate-400 hover:text-brand-700 disabled:opacity-30"><ArrowDown size={13} /></button>
                  <button onClick={() => setViewFlow(viewFlow === f.id ? null : f.id)} aria-label="View flow" className="tap text-slate-400 hover:text-brand-700"><Eye size={13} /></button>
                  <button onClick={async () => { await unlinkFlow(issue.id, f.id); onChanged(); }} aria-label="Unlink from issue" className="tap text-slate-400 hover:text-red-500"><X size={13} /></button>
                </div>
                {viewFlow === f.id && (
                  <div className="px-2.5 pb-2.5">
                    <FlowCard flow={f} live={f.status === 'approved'} onArchive={() => onArchive(f)} onSave={onSave} />
                  </div>
                )}
              </div>
            );
          })}

          {unmappedApproved.length > 0 && (
            <LinkFlowSelect issueId={issue.id} candidates={unmappedApproved} onChanged={onChanged} />
          )}
        </div>
      )}
    </div>
  );
}

function LinkFlowSelect({ issueId, candidates, onChanged }: { issueId: string; candidates: any[]; onChanged: () => void }) {
  const [sel, setSel] = useState('');
  return (
    <div className="flex items-center gap-2">
      <Link2 size={12} className="text-slate-400 shrink-0" />
      <select value={sel} onChange={(e) => setSel(e.target.value)} className="rounded-lg border border-slate-300 text-xs px-2 py-1.5 flex-1 min-w-0">
        <option value="">Link an existing flow…</option>
        {candidates.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
      </select>
      <button onClick={async () => { if (!sel) return; await linkFlow(issueId, sel); setSel(''); onChanged(); }} disabled={!sel}
        className="tap rounded-md border border-slate-300 text-slate-600 px-2.5 py-1 text-xs hover:border-brand-300 hover:text-brand-700 disabled:opacity-40">Link</button>
    </div>
  );
}

function MapFlowRow({ flow, issues, onChanged }: { flow: any; issues: any[]; onChanged: () => void }) {
  const [sel, setSel] = useState('');
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-700 flex-1 min-w-0 truncate">{flow.title}</span>
      <select value={sel} onChange={(e) => setSel(e.target.value)} className="rounded-lg border border-slate-300 text-xs px-2 py-1.5">
        <option value="">Map to issue…</option>
        {issues.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
      </select>
      <button onClick={async () => { if (!sel) return; await linkFlow(sel, flow.id); setSel(''); onChanged(); }} disabled={!sel}
        className="tap rounded-md bg-brand-700 text-white px-2.5 py-1 text-xs font-medium hover:bg-brand-800 disabled:opacity-40">Map</button>
    </div>
  );
}

// ---------- one flow: header, symptoms, tree, classification, actions ----------
function FlowCard({ flow, live, onApprove, onArchive, onDelete, onRestore, onSave }: {
  flow: any; live?: boolean;
  onApprove?: (cls: FlowClassification) => void; onArchive?: () => void; onDelete?: () => void; onRestore?: () => void;
  onSave: (id: string, patch: { title: string; trigger_symptoms: string[]; definition: FlowDefinition }) => Promise<void>;
}) {
  const qcCard = useQueryClient();
  const [open, setOpen] = useState(!live);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(flow.title as string);
  const [symptoms, setSymptoms] = useState((flow.trigger_symptoms ?? []).join(', '));
  const [def, setDef] = useState<FlowDefinition>(flow.definition as FlowDefinition);
  const [saving, setSaving] = useState(false);
  // Classification confirm — pre-filled from the AI proposal (or saved values);
  // approval is blocked until BOTH are explicitly set (the mandatory gate).
  const proposal = (flow.definition?.proposed_classification ?? null) as FlowClassification | null;
  const [visitCls, setVisitCls] = useState<boolean | null>(flow.visit_required ?? proposal?.visit_required ?? null);
  const [skillCls, setSkillCls] = useState<'anyone' | 'specialist' | null>(flow.skill_required ?? proposal?.skill_required ?? null);

  const sm = Array.isArray(flow.sensor_models) ? flow.sensor_models[0] : flow.sensor_models;
  const mk = sm ? (Array.isArray(sm.sensor_makes) ? sm.sensor_makes[0] : sm.sensor_makes) : null;
  const cat = Array.isArray(flow.sensor_categories) ? flow.sensor_categories[0] : flow.sensor_categories;
  const scopeLabel = flow.sensor_model_id
    ? `${mk?.name ?? ''} ${sm?.model_no || sm?.name || ''}`.trim()
    : `All ${cat?.name ?? '?'} sensors`;

  const validation = useMemo(() => validateFlowDefinition(def), [def]);
  // Steps a technician couldn't follow without the manual in hand.
  const vague = useMemo(() => vagueSteps(flow.definition as FlowDefinition), [flow.definition]);
  const [improving, setImproving] = useState(false);
  const [improveNote, setImproveNote] = useState<string | null>(null);

  async function improveSteps() {
    setImproving(true); setImproveNote(null);
    try {
      const { data, error } = await supabase.functions.invoke('chat-answer', { body: { mode: 'improve-flow', flow_id: flow.id } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const { changed, total } = data as any;
      setImproveNote(changed > 0 ? `Rewrote ${changed} of ${total} steps — review them below.` : 'No changes needed.');
      // The edge function already saved the new definition — refetch it.
      // (Never re-save `flow.definition` here: it's the stale pre-rewrite copy.)
      qcCard.invalidateQueries({ queryKey: ['diagnostic-flows'] });
    } catch (e: any) {
      setImproveNote(`Couldn't rewrite (${e.message}). Is the edge function redeployed?`);
    }
    setImproving(false);
  }

  function setNodeText(id: string, text: string) {
    setDef((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, text } : n)) }));
  }
  async function save() {
    setSaving(true);
    await onSave(flow.id, {
      title: title.trim() || flow.title,
      trigger_symptoms: symptoms.split(',').map((s: string) => s.trim()).filter(Boolean),
      definition: def,
    });
    setSaving(false);
    setEditing(false);
  }

  const border = live ? 'border-emerald-200 bg-emerald-50/30' : flow.status === 'archived' ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50/30';
  return (
    <div className={`rounded-xl border ${border}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left px-3.5 py-3 flex items-start gap-2">
        {open ? <ChevronDown size={15} className="mt-0.5 text-slate-400 shrink-0" /> : <ChevronRight size={15} className="mt-0.5 text-slate-400 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-900">{flow.title}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{scopeLabel} · {(flow.definition?.nodes ?? []).length} steps</div>
        </div>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3">
          {editing ? (
            <div className="space-y-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="input w-full text-sm" placeholder="Flow title (the symptom)" />
              <input value={symptoms} onChange={(e) => setSymptoms(e.target.value)} className="input w-full text-xs" placeholder="Trigger phrasings, comma-separated" />
            </div>
          ) : (
            (flow.trigger_symptoms ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(flow.trigger_symptoms as string[]).map((s, i) => (
                  <span key={i} className="text-[10px] rounded-full bg-white border border-slate-200 text-slate-600 px-2 py-0.5">“{s}”</span>
                ))}
              </div>
            )
          )}

          <FlowTree def={editing ? def : (flow.definition as FlowDefinition)} editing={editing} onNodeText={setNodeText} />

          {editing && !validation.ok && (
            <div className="text-[11px] text-red-600 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5">
              {validation.errors.slice(0, 3).join(' · ')}
            </div>
          )}

          {/* Field-readability lint — steps a technician couldn't follow with
              only the chat in front of them. */}
          {vague.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1.5">
              <div className="text-[11px] font-semibold text-amber-900">
                {vague.length} step{vague.length === 1 ? '' : 's'} may be hard to follow in the field
              </div>
              {vague.slice(0, 3).map((v) => (
                <div key={v.id} className="text-[11px] text-amber-800">
                  <span className="font-mono text-amber-600">{v.id}</span> “{v.text.slice(0, 60)}{v.text.length > 60 ? '…' : ''}” — {v.reason}
                </div>
              ))}
              <button onClick={improveSteps} disabled={improving}
                className="tap inline-flex items-center gap-1 rounded-md bg-amber-600 text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-amber-700 disabled:opacity-60">
                {improving ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {improving ? 'Rewriting…' : 'Rewrite steps with AI'}
              </button>
            </div>
          )}
          {improveNote && <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">{improveNote}</div>}

          {/* Classification confirm — the supervisor's 2×2, mandatory to approve.
              Pre-selected from the AI's proposal; live flows show it read-only. */}
          {onApprove && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 space-y-2">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">Classify to approve — confirm both</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-600 w-24">Visit needed?</span>
                <button onClick={() => setVisitCls(false)} aria-pressed={visitCls === false}
                  className={`tap inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition ${visitCls === false ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'}`}>
                  <Home size={11} /> No visit — plant staff can do it
                </button>
                <button onClick={() => setVisitCls(true)} aria-pressed={visitCls === true}
                  className={`tap inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition ${visitCls === true ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-300 hover:border-red-400'}`}>
                  <MapPin size={11} /> Visit required
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-600 w-24">Skill needed?</span>
                <button onClick={() => setSkillCls('anyone')} aria-pressed={skillCls === 'anyone'}
                  className={`tap inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition ${skillCls === 'anyone' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'}`}>
                  <Wrench size={11} /> Anyone
                </button>
                <button onClick={() => setSkillCls('specialist')} aria-pressed={skillCls === 'specialist'}
                  className={`tap inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition ${skillCls === 'specialist' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300 hover:border-violet-400'}`}>
                  <GraduationCap size={11} /> Specialist
                </button>
              </div>
              {proposal && (visitCls === null || skillCls === null) && (
                <div className="text-[10px] text-slate-400">AI suggests: {proposal.visit_required ? 'visit required' : 'no visit'} · {proposal.skill_required}</div>
              )}
            </div>
          )}
          {live && flow.visit_required != null && (
            <div className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
              Classified: {flow.visit_required ? <><MapPin size={11} /> visit required</> : <><Home size={11} /> no visit</>} · {flow.skill_required}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {editing ? (
              <>
                <button onClick={save} disabled={saving || !validation.ok} className="tap inline-flex items-center gap-1 rounded-md bg-brand-700 text-white px-2.5 py-1 text-xs font-medium hover:bg-brand-800 disabled:opacity-50">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                </button>
                <button onClick={() => { setEditing(false); setDef(flow.definition); setTitle(flow.title); setSymptoms((flow.trigger_symptoms ?? []).join(', ')); }} className="tap inline-flex items-center gap-1 rounded-md border border-slate-300 text-slate-600 px-2.5 py-1 text-xs">
                  <X size={12} /> Cancel
                </button>
              </>
            ) : (
              <>
                {onApprove && (
                  <button
                    onClick={() => onApprove({ visit_required: visitCls!, skill_required: skillCls! })}
                    disabled={visitCls === null || skillCls === null}
                    title={visitCls === null || skillCls === null ? 'Confirm the classification first' : undefined}
                    className="tap inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2.5 py-1 text-xs font-medium hover:bg-emerald-700 disabled:opacity-40">
                    <Check size={12} /> Approve
                  </button>
                )}
                <button onClick={() => setEditing(true)} className="tap inline-flex items-center gap-1 rounded-md border border-slate-300 text-slate-600 px-2.5 py-1 text-xs hover:border-brand-300 hover:text-brand-700"><Pencil size={12} /> Edit</button>
                {onArchive && <button onClick={onArchive} className="tap inline-flex items-center gap-1 text-xs text-slate-500 hover:text-amber-700"><Archive size={12} /> Archive</button>}
                {onRestore && <button onClick={onRestore} className="tap inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700">Restore to drafts</button>}
                {onDelete && <button onClick={onDelete} className="tap inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"><Trash2 size={12} /> Delete</button>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- tree view: BFS depth indentation ----------
const KIND_META: Record<string, { icon: any; cls: string; label: string }> = {
  question: { icon: HelpCircle, cls: 'bg-sky-100 text-sky-800', label: 'Ask' },
  action: { icon: Wrench, cls: 'bg-slate-100 text-slate-700', label: 'Do' },
  resolve: { icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-800', label: 'Fixed' },
  escalate: { icon: PhoneCall, cls: 'bg-red-100 text-red-700', label: 'Escalate' },
};

function FlowTree({ def, editing, onNodeText }: { def: FlowDefinition; editing?: boolean; onNodeText: (id: string, text: string) => void }) {
  // Order + indent nodes by BFS depth from start so branches read top-down.
  const rows = useMemo(() => {
    const depth = new Map<string, number>();
    const queue: string[] = def?.start ? [def.start] : [];
    depth.set(def?.start, 0);
    while (queue.length) {
      const id = queue.shift()!;
      const n = def.nodes.find((x) => x.id === id);
      if (!n) continue;
      const d = depth.get(id) ?? 0;
      const nexts = n.kind === 'question' ? (n.options ?? []).map((o) => o.next)
        : n.kind === 'action' ? [n.next, n.fail_next].filter(Boolean) as string[] : [];
      for (const nx of nexts) if (!depth.has(nx)) { depth.set(nx, d + 1); queue.push(nx); }
    }
    return [...(def?.nodes ?? [])]
      .sort((a, b) => (depth.get(a.id) ?? 99) - (depth.get(b.id) ?? 99))
      .map((n) => ({ n, d: Math.min(depth.get(n.id) ?? 0, 6) }));
  }, [def]);

  return (
    <div className="space-y-1.5">
      {rows.map(({ n, d }) => <NodeRow key={n.id} n={n} depth={d} editing={editing} onText={(t) => onNodeText(n.id, t)} />)}
    </div>
  );
}

function NodeRow({ n, depth, editing, onText }: { n: FlowNode; depth: number; editing?: boolean; onText: (t: string) => void }) {
  const meta = KIND_META[n.kind] ?? KIND_META.action;
  const Icon = meta.icon;
  return (
    <div className="flex items-start gap-2" style={{ marginLeft: depth * 14 }}>
      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold shrink-0 mt-0.5 ${meta.cls}`}>
        <Icon size={10} /> {meta.label}
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea value={n.text} onChange={(e) => onText(e.target.value)} rows={2}
            className="w-full text-xs rounded-md border border-slate-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400" />
        ) : (
          <div className="text-xs text-slate-800 bg-white/70 rounded-md border border-slate-200/70 px-2 py-1">{n.text}</div>
        )}
        <div className="flex flex-wrap gap-1 mt-0.5 items-center">
          {n.kind === 'question' && (n.options ?? []).map((o, i) => (
            <span key={i} className="text-[10px] text-slate-500">{o.label} → <span className="font-mono">{o.next}</span></span>
          ))}
          {n.kind === 'action' && n.next && <span className="text-[10px] text-slate-500">done → <span className="font-mono">{n.next}</span>{n.fail_next ? <> · didn’t work → <span className="font-mono">{n.fail_next}</span></> : null}</span>}
          {n.kind === 'action' && (n as any).visit && (
            <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-medium ${(n as any).visit === 'visit_required' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
              {(n as any).visit === 'visit_required' ? 'visit' : 'no visit'}{(n as any).skill ? ` · ${(n as any).skill}` : ''}
            </span>
          )}
          {n.kind === 'escalate' && n.skill && <span className="text-[10px] text-red-500">needs: {n.skill}</span>}
        </div>
      </div>
      <span className="font-mono text-[9px] text-slate-300 shrink-0 mt-1">{n.id}</span>
    </div>
  );
}

// ---------- escalation directory ----------
// The right person differs per plant (electrician, equipment access) and per
// sensor make (vendor support), so a skill can have many entries: a global
// default, per-plant people, and per-make vendor contacts.
function EscalationContactsCard() {
  const qc = useQueryClient();
  const contacts = useQuery({
    queryKey: ['escalation-contacts'],
    queryFn: async () => (await supabase
      .from('escalation_contacts')
      .select('*, plants(name), sensor_makes(name), sensor_models(model_no, name)')
      .order('sort_order')).data ?? [],
  });
  const plants = useQuery({ queryKey: ['plant-options'], queryFn: async () => (await supabase.from('plants').select('id,name').order('name')).data ?? [] });
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });
  const models = useQuery({ queryKey: ['contact-model-options'], queryFn: async () => (await supabase.from('sensor_models').select('id, model_no, name, sensor_makes(name)').eq('is_general', false).order('model_no')).data ?? [] });

  const refresh = () => qc.invalidateQueries({ queryKey: ['escalation-contacts'] });
  async function patch(id: string, fields: Partial<EscalationContact>) {
    await supabase.from('escalation_contacts').update(fields).eq('id', id);
    refresh();
  }
  async function remove(id: string) {
    await supabase.from('escalation_contacts').delete().eq('id', id);
    refresh();
  }

  const list = (contacts.data ?? []) as any[];
  // Group entries by skill; keep the seed sort_order for group order.
  const groups = new Map<string, any[]>();
  for (const c of list) { if (!groups.has(c.skill_key)) groups.set(c.skill_key, []); groups.get(c.skill_key)!.push(c); }

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="bg-slate-50 px-4 sm:px-5 py-3 border-b border-slate-200">
        <div className="text-sm font-semibold text-slate-800 flex items-center gap-2"><PhoneCall size={14} className="text-slate-500" /> Escalation directory</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          Who Dr. Paani points to when a diagnosis needs outside help. Tap a skill to manage its people.
        </div>
      </div>
      {/* Progressive disclosure: one calm summary row per skill; details on demand. */}
      <div className="bg-white divide-y divide-slate-100">
        {[...groups.entries()].map(([skill, rows]) => (
          <SkillGroup key={skill} skill={skill} rows={rows}
            plants={(plants.data ?? []) as any[]} makes={(makes.data ?? []) as any[]}
            models={(models.data ?? []) as any[]}
            onPatch={patch} onRemove={remove} onAdded={refresh} />
        ))}
        {!contacts.isLoading && list.length === 0 && (
          <div className="px-4 py-4 text-sm text-slate-400">No entries yet. If the seeded skills aren’t showing, make sure migrations 034–036 have been run.</div>
        )}
        <AddContactRow
          skills={[]}
          plants={(plants.data ?? []) as any[]}
          makes={(makes.data ?? []) as any[]}
          models={(models.data ?? []) as any[]}
          onAdded={refresh}
        />
      </div>
    </div>
  );
}

// One collapsed row per skill: name + whether anyone is reachable. Expanding
// reveals the entries and a scoped add form for THAT skill.
function SkillGroup({ skill, rows, plants, makes, models, onPatch, onRemove, onAdded }: {
  skill: string; rows: any[]; plants: { id: string; name: string }[]; makes: { id: string; name: string }[];
  models: any[];
  onPatch: (id: string, f: Partial<EscalationContact>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const reachable = rows.filter((c) => c.active && (c.person_name || c.contact)).length;
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="tap w-full px-4 sm:px-5 py-3 flex items-center gap-2.5 text-left hover:bg-slate-50 transition">
        {open ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
        <span className="text-sm font-medium text-slate-800 flex-1 min-w-0 truncate">{rows[0]?.label ?? skill}</span>
        <span className={`shrink-0 text-[11px] rounded-full px-2 py-0.5 font-medium ${
          reachable > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
        }`}>
          {reachable > 0 ? `${reachable} contact${reachable === 1 ? '' : 's'}` : 'no contact yet'}
        </span>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-3 pl-11 space-y-1.5">
          {rows.map((c) => <ContactRow key={c.id} c={c} onPatch={onPatch} onRemove={() => onRemove(c.id)} />)}
          {/* The everywhere-default lives in the row above; this form only adds
              extra scoped contacts once a default already exists. */}
          <AddContactRow skills={[{ key: skill, label: rows[0]?.label ?? skill }]}
            plants={plants} makes={makes} models={models} onAdded={onAdded} fixedSkill={skill}
            hasDefault={rows.some((c) => !c.plant_id && !c.make_id && !c.sensor_model_id)} />
        </div>
      )}
    </div>
  );
}

function ContactRow({ c, onPatch, onRemove }: { c: any; onPatch: (id: string, f: Partial<EscalationContact>) => Promise<void>; onRemove: () => void }) {
  const [name, setName] = useState(c.person_name ?? '');
  const [contact, setContact] = useState(c.contact ?? '');
  const dirty = name !== (c.person_name ?? '') || contact !== (c.contact ?? '');
  const plantName = (Array.isArray(c.plants) ? c.plants[0] : c.plants)?.name;
  const makeName = (Array.isArray(c.sensor_makes) ? c.sensor_makes[0] : c.sensor_makes)?.name;
  const modelRow = Array.isArray(c.sensor_models) ? c.sensor_models[0] : c.sensor_models;
  const modelLabel = c.sensor_model_id ? (modelRow?.model_no || modelRow?.name) : null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`shrink-0 text-[10px] rounded-full px-2 py-0.5 font-medium ${
        modelLabel ? 'bg-indigo-100 text-indigo-700' : makeName ? 'bg-violet-100 text-violet-700' : plantName ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
      }`}>
        {modelLabel ? `${makeName ? makeName + ' ' : ''}${modelLabel}` : makeName ?? plantName ?? 'Default'}
      </span>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Person" className="input text-xs w-32" />
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone / how to reach" className="input text-xs w-44" />
      <label className="flex items-center gap-1 text-[11px] text-slate-500">
        <input type="checkbox" checked={c.active} onChange={(e) => onPatch(c.id, { active: e.target.checked })} /> active
      </label>
      {dirty && (
        <button onClick={() => onPatch(c.id, { person_name: name || null, contact: contact || null })}
          className="tap rounded-md bg-brand-700 text-white px-2.5 py-1 text-xs font-medium hover:bg-brand-800">Save</button>
      )}
      <button onClick={onRemove} aria-label="Delete entry" className="tap text-slate-300 hover:text-red-500 transition"><Trash2 size={13} /></button>
    </div>
  );
}

// Add an entry. With fixedSkill (inside an expanded group) it adds people to
// that skill; without, it only creates a brand-new skill. When hasDefault is
// true the skill already has an everywhere-default (the row above), so this
// form drops "Everywhere (default)" and requires a plant/vendor scope — you
// can't create a duplicate default from here.
function AddContactRow({ skills, plants, makes, models, onAdded, fixedSkill, hasDefault }: {
  skills: { key: string; label: string }[];
  plants: { id: string; name: string }[];
  makes: { id: string; name: string }[];
  models: any[];
  onAdded: () => void;
  fixedSkill?: string;
  hasDefault?: boolean;
}) {
  const [skill, setSkill] = useState(fixedSkill ?? '');
  const [newLabel, setNewLabel] = useState('');
  const [scope, setScope] = useState(''); // '', 'plant:<id>', 'make:<id>'
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    const isNew = skill === '__new__';
    const key = isNew ? newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : skill;
    const label = isNew ? newLabel.trim() : (skills.find((s) => s.key === skill)?.label ?? key);
    if (!key || !label) return;
    setBusy(true);
    await supabase.from('escalation_contacts').insert({
      skill_key: key,
      label,
      person_name: name.trim() || null,
      contact: contact.trim() || null,
      plant_id: scope.startsWith('plant:') ? scope.slice(6) : null,
      make_id: scope.startsWith('make:') ? scope.slice(5) : null,
      sensor_model_id: scope.startsWith('model:') ? scope.slice(6) : null,
      sort_order: 100,
    });
    setBusy(false);
    setSkill(fixedSkill ?? ''); setNewLabel(''); setScope(''); setName(''); setContact('');
    onAdded();
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${fixedSkill ? 'pt-1' : 'px-4 sm:px-5 py-3 bg-slate-50/60'}`}>
      {!fixedSkill && (
        <select value={skill} onChange={(e) => setSkill(e.target.value)} className="input text-xs w-44" aria-label="New skill">
          <option value="">Add a new skill…</option>
          <option value="__new__">+ New skill…</option>
        </select>
      )}
      {fixedSkill && <span className="text-[11px] text-slate-400 shrink-0">Add person:</span>}
      {skill === '__new__' && (
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Skill name (e.g. Pump vendor)" className="input text-xs w-40" />
      )}
      {skill && (
        <>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="input text-xs w-44"
            aria-label="Where this contact applies">
            {hasDefault
              ? <option value="" disabled>Choose a plant or vendor…</option>
              : <option value="">Everywhere (default)</option>}
            {plants.length > 0 && <optgroup label="Only at plant">
              {plants.map((p) => <option key={p.id} value={`plant:${p.id}`}>{p.name}</option>)}
            </optgroup>}
            {makes.length > 0 && <optgroup label="Only for make (vendor)">
              {makes.map((m) => <option key={m.id} value={`make:${m.id}`}>{m.name}</option>)}
            </optgroup>}
            {models.length > 0 && <optgroup label="Only for one model (vendor support line)">
              {models.map((m: any) => {
                const mk = Array.isArray(m.sensor_makes) ? m.sensor_makes[0] : m.sensor_makes;
                return <option key={m.id} value={`model:${m.id}`}>{`${mk?.name ?? ''} ${m.model_no || m.name}`.trim()}</option>;
              })}
            </optgroup>}
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Person" className="input text-xs w-32" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone / how to reach" className="input text-xs w-44" />
          <button onClick={add} disabled={busy || (skill === '__new__' && !newLabel.trim()) || (hasDefault && !scope)}
            className="tap rounded-md bg-brand-700 text-white px-2.5 py-1 text-xs font-medium hover:bg-brand-800 disabled:opacity-50">
            {busy ? 'Adding…' : 'Add'}
          </button>
        </>
      )}
    </div>
  );
}
