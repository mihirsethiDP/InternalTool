import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import { SECTION_ORDER, SECTION_LABEL } from '../lib/consolidated';
import PageHeader from '../components/PageHeader';
import { ReviewQueueList } from './ReviewQueue';
import InsightsPanel from '../components/InsightsPanel';
import DiagnosticFlowsPanel from '../components/DiagnosticFlowsPanel';
import RecycleBinPanel from '../components/RecycleBinPanel';
import AdminOnboarding from '../components/AdminOnboarding';
import { softDeleteConsolidated } from '../lib/recycleBin';

type AdminTab = 'insights' | 'review' | 'flows' | 'consolidated' | 'categories' | 'users' | 'types' | 'bin';
const ADMIN_TABS: AdminTab[] = ['insights', 'review', 'flows', 'consolidated', 'categories', 'users', 'types', 'bin'];

export default function Admin() {
  const { profile, loading } = useAuth();
  const qc = useQueryClient();
  // Tab lives in the URL (/admin?tab=flows) so notifications, onboarding cards,
  // and post-approval next-steps can deep-link straight to the right panel.
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab') as AdminTab | null;
  const tab: AdminTab = rawTab && ADMIN_TABS.includes(rawTab) ? rawTab : 'insights';
  const setTab = (t: AdminTab) => setParams(t === 'insights' ? {} : { tab: t });

  // Pending count for the tab badge (works for admins only, RLS allows it)
  const pending = useQuery({
    queryKey: ['admin-pending-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('document_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .is('deleted_at', null);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  // Draft diagnostic flows awaiting review (badge on the Flows tab)
  const draftFlows = useQuery({
    queryKey: ['admin-draft-flows-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('diagnostic_flows')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'draft');
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  if (loading) {
    return <div className="card text-sm text-slate-500">Loading…</div>;
  }
  if (!isAdmin(profile)) {
    return <div className="card text-sm">Admin only.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Admin"
        subtitle="Review submissions, manage consolidated references, users, and document taxonomy."
      />

      <AdminOnboarding />

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto">
        <Tab name="insights" active={tab} onClick={setTab}>Insights</Tab>
        <Tab name="review" active={tab} onClick={setTab} badge={pending.data ?? 0}>Review queue</Tab>
        <Tab name="flows" active={tab} onClick={setTab} badge={draftFlows.data ?? 0}>Diagnostic flows</Tab>
        <Tab name="consolidated" active={tab} onClick={setTab}>Consolidated references</Tab>
        <Tab name="categories" active={tab} onClick={setTab}>Categories</Tab>
        <Tab name="users" active={tab} onClick={setTab}>Users</Tab>
        <Tab name="types" active={tab} onClick={setTab}>Document types</Tab>
        <Tab name="bin" active={tab} onClick={setTab}>Recycle bin</Tab>
      </div>

      {tab === 'insights' && <InsightsPanel />}
      {tab === 'review' && <ReviewQueueList />}
      {tab === 'flows' && <DiagnosticFlowsPanel />}
      {tab === 'consolidated' && <ConsolidatedDocsPanel />}
      {tab === 'categories' && <CategoriesPanel />}
      {tab === 'users' && <UsersPanel onChanged={() => qc.invalidateQueries({ queryKey: ['admin-users'] })} />}
      {tab === 'types' && <TypesPanel />}
      {tab === 'bin' && <RecycleBinPanel />}
    </div>
  );
}

function Tab({ name, active, onClick, badge, children }: { name: AdminTab; active: AdminTab; onClick: (n: AdminTab) => void; badge?: number; children: React.ReactNode; }) {
  const isActive = active === name;
  return (
    <button
      onClick={() => onClick(name)}
      className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition flex items-center gap-2 ${
        isActive ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-600 hover:text-brand-700'
      }`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className={`rounded-full text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] flex items-center justify-center ${
          isActive ? 'bg-brand-700 text-white' : 'bg-amber-100 text-amber-800'
        }`}>{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  );
}

function ConsolidatedDocsPanel() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const docs = useQuery({
    queryKey: ['admin-consolidated-docs'],
    queryFn: async () => (await supabase
      .from('consolidated_docs')
      .select('id, last_updated_at, sensor_models(model_no, sensor_makes(name), sensor_categories(name))')
      .is('deleted_at', null)
      .order('last_updated_at', { ascending: false })).data ?? [],
  });

  // Soft delete: 30-day recycle bin, restorable with search index + flows.
  async function moveToBin(d: any) {
    if (!confirm('Move this reference to the recycle bin? It stays restorable for 30 days.')) return;
    setBusyId(d.id);
    try {
      await softDeleteConsolidated(d.id, userId);
      qc.invalidateQueries({ queryKey: ['admin-consolidated-docs'] });
      qc.invalidateQueries({ queryKey: ['recent-consolidated'] });
      qc.invalidateQueries({ queryKey: ['bin-docs'] });
    } catch (e: any) { alert('Could not delete: ' + (e.message || e)); }
    setBusyId(null);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        One reference per sensor model. Click to view; admins can edit the body inline.
        Deleted references sit in the <strong>Recycle bin</strong> for 30 days.
      </p>
      {(docs.data ?? []).length === 0 && (
        <div className="card text-sm text-slate-500 text-center">
          None yet. They&rsquo;re created automatically when you approve the first submission for a sensor.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {(docs.data ?? []).map((d: any) => (
          <div key={d.id} className="card-tight hover:border-brand-700 transition flex items-center gap-2">
            <Link to={`/consolidated/${d.id}`} className="min-w-0 flex-1">
              <div className="font-medium text-slate-900 truncate">
                {d.sensor_models?.sensor_makes?.name} {d.sensor_models?.model_no}
              </div>
              <div className="text-xs text-slate-500">
                {d.sensor_models?.sensor_categories?.name} · updated {new Date(d.last_updated_at).toLocaleDateString()}
              </div>
            </Link>
            <button
              onClick={() => moveToBin(d)}
              disabled={busyId === d.id}
              aria-label="Move to recycle bin"
              className="tap shrink-0 text-slate-300 hover:text-red-500 transition disabled:opacity-50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriesPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cats = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => (await supabase
      .from('sensor_categories')
      .select('id, name, sensor_models(count)')
      .order('name')).data ?? [],
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from('sensor_categories').insert({ name: n });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setName('');
    // A general entry is auto-created by the DB trigger.
    qc.invalidateQueries({ queryKey: ['admin-categories'] });
    qc.invalidateQueries({ queryKey: ['cats'] });
    qc.invalidateQueries({ queryKey: ['general-models'] });
  }

  return (
    <div className="card space-y-4">
      <p className="text-xs text-slate-500">
        Adding a category instantly creates its <strong>General {`{category}`} guidance</strong> entry, so you can
        start filing category-level content right away.
      </p>
      <form onSubmit={add} className="flex gap-2 flex-wrap">
        <input className="input flex-1 min-w-56" placeholder="New category (e.g. Gas Analysers)"
          value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add category'}</button>
      </form>
      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>}
      <ul className="divide-y divide-slate-100 text-sm">
        {(cats.data ?? []).map((c: any) => (
          <li key={c.id} className="py-2 flex items-center justify-between">
            <span className="font-medium text-slate-800">{c.name}</span>
            <span className="muted text-xs">{(c.sensor_models?.[0]?.count ?? 0)} model(s)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UsersPanel({ onChanged }: { onChanged: () => void }) {
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState('viewer');
  const [invName, setInvName] = useState('');
  const [invBusy, setInvBusy] = useState(false);
  const [invNote, setInvNote] = useState<{ ok: boolean; text: string } | null>(null);
  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await supabase.from('profiles').select('*').order('created_at', { ascending: false })).data ?? [],
  });

  // Invite a teammate: Supabase emails them a link; the app has them set a
  // password on arrival. Their role is pre-assigned here.
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const email = invEmail.trim().toLowerCase();
    if (!email) return;
    setInvBusy(true); setInvNote(null);
    try {
      const { data, error } = await supabase.functions.invoke('chat-answer', {
        body: { mode: 'invite-user', email, role: invRole, full_name: invName.trim() },
      });
      if (error) throw new Error((await (error as any)?.context?.json?.().then((j: any) => j?.error).catch(() => null)) || error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setInvNote({ ok: true, text: `Invite sent to ${email} as ${invRole}. They set their password from the email link.` });
      setInvEmail(''); setInvName('');
      onChanged();
    } catch (err: any) {
      setInvNote({ ok: false, text: err.message || 'Invite failed.' });
    }
    setInvBusy(false);
  }
  // Apply a role to EVERY profile sharing this email — a person can have more
  // than one identity (e.g. magic-link + Google sign-in create separate auth
  // users with the same email), and their access should be consistent.
  async function setRole(email: string, role: string) {
    await supabase.from('profiles').update({ role }).eq('email', email);
    onChanged();
  }

  // Group by email so one person = one row, even with multiple sign-ins.
  const rank: Record<string, number> = { viewer: 0, uploader: 1, admin: 2 };
  const byEmail = new Map<string, { email: string; roles: Set<string>; count: number }>();
  for (const u of (users.data ?? []) as any[]) {
    const key = (u.email ?? '').toLowerCase();
    const e = byEmail.get(key) ?? { email: u.email, roles: new Set<string>(), count: 0 };
    e.roles.add(u.role); e.count += 1;
    byEmail.set(key, e);
  }
  const rows = [...byEmail.values()].map((e) => {
    const effective = [...e.roles].sort((a, b) => rank[b] - rank[a])[0]; // highest role
    return { ...e, effective, mixed: e.roles.size > 1 };
  });

  return (
    <div className="card">
      {/* Invite — the way new people join the tool */}
      <form onSubmit={invite} className="rounded-xl border border-brand-200 bg-brand-50/50 p-3 mb-4 flex gap-2 flex-wrap items-center">
        <span className="text-xs font-semibold text-brand-800 w-full sm:w-auto">Invite a teammate</span>
        <input type="email" required value={invEmail} onChange={(e) => setInvEmail(e.target.value)}
          placeholder="name@digitalpaani.com" className="input text-sm flex-1 min-w-52" />
        <input value={invName} onChange={(e) => setInvName(e.target.value)}
          placeholder="Full name (optional)" className="input text-sm w-40" />
        <select value={invRole} onChange={(e) => setInvRole(e.target.value)} className="input text-sm w-28">
          <option value="viewer">viewer</option>
          <option value="uploader">uploader</option>
          <option value="admin">admin</option>
        </select>
        <button className="btn-primary text-sm" disabled={invBusy}>{invBusy ? 'Sending…' : 'Send invite'}</button>
        {invNote && (
          <div role="status" className={`w-full text-xs rounded-lg px-3 py-2 ${invNote.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {invNote.text}
          </div>
        )}
      </form>
      <p className="text-xs text-slate-500 mb-3">Anyone who has signed in appears here. Change a user&rsquo;s role to grant upload or admin rights. Role changes apply to all of a person&rsquo;s sign-ins.</p>
      <div className="overflow-x-auto -mx-4 px-4 sm:-mx-5 sm:px-5">
        <table className="w-full text-sm min-w-[34rem]">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.email} className="border-t border-slate-100">
                <td className="py-2 pr-2">
                  {u.email}
                  {u.count > 1 && <span className="ml-2 text-[10px] text-slate-400">{u.count} sign-ins</span>}
                </td>
                <td className="pr-2">
                  <span className="badge">{u.effective}</span>
                  {u.mixed && <span className="ml-1.5 text-[10px] text-amber-600">was inconsistent — fixed on next change</span>}
                </td>
                <td className="text-right space-x-1 whitespace-nowrap">
                  <button className="btn-ghost text-xs" onClick={() => setRole(u.email, 'viewer')}>viewer</button>
                  <button className="btn-ghost text-xs" onClick={() => setRole(u.email, 'uploader')}>uploader</button>
                  <button className="btn-ghost text-xs" onClick={() => setRole(u.email, 'admin')}>admin</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TypesPanel() {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  // Only the 'general' scope exists now — the same list uploaders pick from,
  // so this panel always matches the upload form.
  const types = useQuery({
    queryKey: ['admin-types'],
    queryFn: async () => (await supabase.from('document_types').select('*').eq('scope', 'general').order('sort_order')).data ?? [],
  });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label || !key) return;
    const nextOrder = (types.data?.length ?? 0) + 1;
    await supabase.from('document_types').insert({ key, label, scope: 'general', sort_order: nextOrder });
    setLabel(''); setKey('');
    qc.invalidateQueries({ queryKey: ['admin-types'] });
    qc.invalidateQueries({ queryKey: ['types'] });
    qc.invalidateQueries({ queryKey: ['types-general'] });
  }
  async function remove(t: any) {
    if (!confirm(`Remove the "${t.label}" type? Types already used by documents can't be removed.`)) return;
    const { error } = await supabase.from('document_types').delete().eq('id', t.id);
    if (error) { alert('In use by existing documents — cannot remove.'); return; }
    qc.invalidateQueries({ queryKey: ['admin-types'] });
    qc.invalidateQueries({ queryKey: ['types'] });
    qc.invalidateQueries({ queryKey: ['types-general'] });
  }
  async function setDefault(t: any, section: string) {
    const { error } = await supabase.from('document_types').update({ default_section: section || null }).eq('id', t.id);
    if (error) { alert('Could not save the default — make sure migration 039 has been run.'); return; }
    qc.invalidateQueries({ queryKey: ['admin-types'] });
    qc.invalidateQueries({ queryKey: ['type-default-sections'] });
  }
  return (
    <div className="card">
      {/* How the two taxonomies relate — the #1 admin confusion */}
      <div className="rounded-xl bg-brand-50/60 border border-brand-100 px-4 py-3 mb-4 text-xs text-slate-600 leading-relaxed">
        <b className="text-slate-800">How this fits together:</b> a document <b>type</b> describes the file an uploader
        submits (manual, datasheet…). When you <b>approve</b> it, its content is filed into an <b>activity section</b> of
        the sensor's reference (Install, Clean, Troubleshoot &amp; Repair…) — that's what Dr. Paani and search use.
        The <b>default section</b> below pre-fills that choice at approval; you can always override it.
      </div>
      <form onSubmit={add} className="flex gap-2 mb-3 flex-wrap">
        <input className="input flex-1 min-w-48" placeholder='Label (e.g. "Commissioning Report")' value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="input md:w-48" placeholder="key (snake_case)" value={key} onChange={(e) => setKey(e.target.value.replace(/[^a-z0-9_]/g, ''))} />
        <button className="btn-primary">Add</button>
      </form>
      <div className="divide-y divide-slate-100">
        <div className="hidden sm:grid grid-cols-[1fr_220px_32px] gap-2 pb-1.5 text-[10px] uppercase tracking-wide font-semibold text-slate-400">
          <span>Type (what the file is)</span><span>Default section at approval</span><span />
        </div>
        {(types.data ?? []).map((t: any) => (
          <div key={t.id} className="py-2 grid grid-cols-1 sm:grid-cols-[1fr_220px_32px] gap-2 items-center">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="badge-blue">{t.label}</span>
              <span className="text-xs text-slate-400 truncate">{t.key}</span>
            </div>
            <select
              value={t.default_section ?? ''}
              onChange={(e) => setDefault(t, e.target.value)}
              className="rounded-lg border border-slate-300 text-xs px-2 py-1.5"
              aria-label={`Default section for ${t.label}`}
            >
              <option value="">— admin picks at approval —</option>
              {SECTION_ORDER.map((s) => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}
            </select>
            <button onClick={() => remove(t)} aria-label={`Remove ${t.label}`} className="tap text-slate-300 hover:text-red-500 transition justify-self-end"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
