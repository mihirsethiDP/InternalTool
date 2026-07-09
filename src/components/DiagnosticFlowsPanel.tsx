import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, Sparkles, Check, X, Loader2, Trash2, Pencil, Archive, HelpCircle, Wrench, CheckCircle2, PhoneCall, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { validateFlowDefinition, type DiagnosticFlow, type FlowDefinition, type FlowNode, type EscalationContact } from '../lib/flows';

// Admin tab: review AI-drafted diagnostic flows and manage the escalation
// directory. Framed as an action item (like the routing-rules panel): drafts
// demand review; only approved flows reach Dr. Paani.

interface DocOption { id: string; label: string }

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

  async function setStatus(f: any, status: 'approved' | 'archived' | 'draft') {
    if (status === 'approved') {
      const v = validateFlowDefinition(f.definition);
      if (!v.ok) { alert('Cannot approve — the flow structure is invalid:\n' + v.errors.join('\n')); return; }
    }
    await supabase.from('diagnostic_flows').update({
      status,
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

  const list = (flows.data ?? []) as any[];
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
            Step-by-step diagnostic trees Dr. Paani walks users through — drafted by AI from approved documentation (also auto-drafted whenever you approve a submission), then reviewed here. Only approved flows go live.
          </p>
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
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-amber-700">Drafts — review &amp; approve</div>
                  {drafts.map((f) => <FlowCard key={f.id} flow={f} onApprove={() => setStatus(f, 'approved')} onDelete={() => remove(f.id)} onSave={saveEdits} />)}
                </div>
              )}
              {approved.length > 0 && (
                <div className="space-y-3">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700">Live — used by Dr. Paani</div>
                  {approved.map((f) => <FlowCard key={f.id} flow={f} live onArchive={() => setStatus(f, 'archived')} onSave={saveEdits} />)}
                </div>
              )}
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

// ---------- one flow: header, symptoms, tree, actions ----------
function FlowCard({ flow, live, onApprove, onArchive, onDelete, onRestore, onSave }: {
  flow: any; live?: boolean;
  onApprove?: () => void; onArchive?: () => void; onDelete?: () => void; onRestore?: () => void;
  onSave: (id: string, patch: { title: string; trigger_symptoms: string[]; definition: FlowDefinition }) => Promise<void>;
}) {
  const [open, setOpen] = useState(!live);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(flow.title as string);
  const [symptoms, setSymptoms] = useState((flow.trigger_symptoms ?? []).join(', '));
  const [def, setDef] = useState<FlowDefinition>(flow.definition as FlowDefinition);
  const [saving, setSaving] = useState(false);

  const sm = Array.isArray(flow.sensor_models) ? flow.sensor_models[0] : flow.sensor_models;
  const mk = sm ? (Array.isArray(sm.sensor_makes) ? sm.sensor_makes[0] : sm.sensor_makes) : null;
  const cat = Array.isArray(flow.sensor_categories) ? flow.sensor_categories[0] : flow.sensor_categories;
  const scopeLabel = flow.sensor_model_id
    ? `${mk?.name ?? ''} ${sm?.model_no || sm?.name || ''}`.trim()
    : `All ${cat?.name ?? '?'} sensors`;

  const validation = useMemo(() => validateFlowDefinition(def), [def]);

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
                {onApprove && <button onClick={onApprove} className="tap inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2.5 py-1 text-xs font-medium hover:bg-emerald-700"><Check size={12} /> Approve</button>}
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
        <div className="flex flex-wrap gap-1 mt-0.5">
          {n.kind === 'question' && (n.options ?? []).map((o, i) => (
            <span key={i} className="text-[10px] text-slate-500">{o.label} → <span className="font-mono">{o.next}</span></span>
          ))}
          {n.kind === 'action' && n.next && <span className="text-[10px] text-slate-500">done → <span className="font-mono">{n.next}</span>{n.fail_next ? <> · didn’t work → <span className="font-mono">{n.fail_next}</span></> : null}</span>}
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
      .select('*, plants(name), sensor_makes(name)')
      .order('sort_order')).data ?? [],
  });
  const plants = useQuery({ queryKey: ['plant-options'], queryFn: async () => (await supabase.from('plants').select('id,name').order('name')).data ?? [] });
  const makes = useQuery({ queryKey: ['makes'], queryFn: async () => (await supabase.from('sensor_makes').select('id,name').order('name')).data ?? [] });

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
            onPatch={patch} onRemove={remove} onAdded={refresh} />
        ))}
        {!contacts.isLoading && list.length === 0 && (
          <div className="px-4 py-4 text-sm text-slate-400">No entries yet. If the seeded skills aren’t showing, make sure migrations 034–036 have been run.</div>
        )}
        <AddContactRow
          skills={[]}
          plants={(plants.data ?? []) as any[]}
          makes={(makes.data ?? []) as any[]}
          onAdded={refresh}
        />
      </div>
    </div>
  );
}

// One collapsed row per skill: name + whether anyone is reachable. Expanding
// reveals the entries and a scoped add form for THAT skill.
function SkillGroup({ skill, rows, plants, makes, onPatch, onRemove, onAdded }: {
  skill: string; rows: any[]; plants: { id: string; name: string }[]; makes: { id: string; name: string }[];
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
          <AddContactRow skills={[{ key: skill, label: rows[0]?.label ?? skill }]}
            plants={plants} makes={makes} onAdded={onAdded} fixedSkill={skill} />
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
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`shrink-0 text-[10px] rounded-full px-2 py-0.5 font-medium ${
        makeName ? 'bg-violet-100 text-violet-700' : plantName ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
      }`}>
        {makeName ?? plantName ?? 'Default'}
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
// that skill; without, it only creates a brand-new skill.
function AddContactRow({ skills, plants, makes, onAdded, fixedSkill }: {
  skills: { key: string; label: string }[];
  plants: { id: string; name: string }[];
  makes: { id: string; name: string }[];
  onAdded: () => void;
  fixedSkill?: string;
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
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="input text-xs w-40">
            <option value="">Everywhere (default)</option>
            {plants.length > 0 && <optgroup label="Only at plant">
              {plants.map((p) => <option key={p.id} value={`plant:${p.id}`}>{p.name}</option>)}
            </optgroup>}
            {makes.length > 0 && <optgroup label="Only for make (vendor)">
              {makes.map((m) => <option key={m.id} value={`make:${m.id}`}>{m.name}</option>)}
            </optgroup>}
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Person" className="input text-xs w-32" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone / how to reach" className="input text-xs w-44" />
          <button onClick={add} disabled={busy || (skill === '__new__' && !newLabel.trim())}
            className="tap rounded-md bg-brand-700 text-white px-2.5 py-1 text-xs font-medium hover:bg-brand-800 disabled:opacity-50">
            {busy ? 'Adding…' : 'Add'}
          </button>
        </>
      )}
    </div>
  );
}
