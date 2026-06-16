import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import PageHeader from '../components/PageHeader';
import { ReviewQueueList } from './ReviewQueue';
import InsightsPanel from '../components/InsightsPanel';

type AdminTab = 'insights' | 'review' | 'consolidated' | 'categories' | 'users' | 'types';

export default function Admin() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('insights');

  // Pending count for the tab badge (works for admins only, RLS allows it)
  const pending = useQuery({
    queryKey: ['admin-pending-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('document_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  if (!isAdmin(profile)) {
    return <div className="card text-sm">Admin only.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        icon="⚙️"
        title="Admin"
        subtitle="Review submissions, manage consolidated references, users, and document taxonomy."
      />

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto">
        <Tab name="insights" active={tab} onClick={setTab}>Insights</Tab>
        <Tab name="review" active={tab} onClick={setTab} badge={pending.data ?? 0}>Review queue</Tab>
        <Tab name="consolidated" active={tab} onClick={setTab}>Consolidated references</Tab>
        <Tab name="categories" active={tab} onClick={setTab}>Categories</Tab>
        <Tab name="users" active={tab} onClick={setTab}>Users</Tab>
        <Tab name="types" active={tab} onClick={setTab}>Document types</Tab>
      </div>

      {tab === 'insights' && <InsightsPanel />}
      {tab === 'review' && <ReviewQueueList />}
      {tab === 'consolidated' && <ConsolidatedDocsPanel />}
      {tab === 'categories' && <CategoriesPanel />}
      {tab === 'users' && <UsersPanel onChanged={() => qc.invalidateQueries({ queryKey: ['admin-users'] })} />}
      {tab === 'types' && <TypesPanel />}
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
  const docs = useQuery({
    queryKey: ['admin-consolidated-docs'],
    queryFn: async () => (await supabase
      .from('consolidated_docs')
      .select('id, last_updated_at, sensor_models(model_no, sensor_makes(name), sensor_categories(name))')
      .order('last_updated_at', { ascending: false })).data ?? [],
  });
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        One reference per sensor model. Click to view; admins can edit the body inline.
      </p>
      {(docs.data ?? []).length === 0 && (
        <div className="card text-sm text-slate-500 text-center">
          None yet. They&rsquo;re created automatically when you approve the first submission for a sensor.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {(docs.data ?? []).map((d: any) => (
          <Link key={d.id} to={`/consolidated/${d.id}`} className="card-tight hover:border-brand-700 transition flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-medium text-slate-900 truncate">
                {d.sensor_models?.sensor_makes?.name} {d.sensor_models?.model_no}
              </div>
              <div className="text-xs text-slate-500">
                {d.sensor_models?.sensor_categories?.name} · updated {new Date(d.last_updated_at).toLocaleDateString()}
              </div>
            </div>
            <span className="text-slate-300">→</span>
          </Link>
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
  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await supabase.from('profiles').select('*').order('created_at', { ascending: false })).data ?? [],
  });
  async function setRole(id: string, role: string) {
    await supabase.from('profiles').update({ role }).eq('id', id);
    onChanged();
  }
  return (
    <div className="card">
      <p className="text-xs text-slate-500 mb-3">Anyone who has signed in appears here. Change a user&rsquo;s role to grant upload or admin rights.</p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500"><tr><th>Email</th><th>Role</th><th></th></tr></thead>
        <tbody>
          {(users.data ?? []).map((u: any) => (
            <tr key={u.id} className="border-t border-slate-100">
              <td className="py-2">{u.email}</td>
              <td><span className="badge">{u.role}</span></td>
              <td className="text-right space-x-1">
                <button className="btn-ghost text-xs" onClick={() => setRole(u.id, 'viewer')}>viewer</button>
                <button className="btn-ghost text-xs" onClick={() => setRole(u.id, 'uploader')}>uploader</button>
                <button className="btn-ghost text-xs" onClick={() => setRole(u.id, 'admin')}>admin</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TypesPanel() {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const types = useQuery({
    queryKey: ['admin-types'],
    queryFn: async () => (await supabase.from('document_types').select('*').order('sort_order')).data ?? [],
  });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label || !key) return;
    const nextOrder = (types.data?.length ?? 0) + 1;
    await supabase.from('document_types').insert({ key, label, sort_order: nextOrder });
    setLabel(''); setKey('');
    qc.invalidateQueries({ queryKey: ['admin-types'] });
    qc.invalidateQueries({ queryKey: ['types'] });
  }
  return (
    <div className="card">
      <form onSubmit={add} className="flex gap-2 mb-3 flex-wrap">
        <input className="input flex-1 min-w-48" placeholder='Label (e.g. "Commissioning Report")' value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="input md:w-48" placeholder="key (snake_case)" value={key} onChange={(e) => setKey(e.target.value.replace(/[^a-z0-9_]/g, ''))} />
        <button className="btn-primary">Add</button>
      </form>
      <ul className="text-sm grid grid-cols-2 md:grid-cols-3 gap-1">
        {(types.data ?? []).map((t: any) => (
          <li key={t.id} className="py-1"><span className="badge-blue">{t.label}</span> <span className="text-xs text-slate-400">{t.key}</span></li>
        ))}
      </ul>
    </div>
  );
}
