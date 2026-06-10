import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import PageHeader from '../components/PageHeader';

export default function Admin() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  if (!isAdmin(profile)) {
    return <div className="card text-sm">Admin only.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" icon="⚙️" title="Admin" subtitle="Manage users, consolidated docs, and document types." />
      <ConsolidatedDocsPanel />
      <UsersPanel onChanged={() => qc.invalidateQueries({ queryKey: ['admin-users'] })} />
      <TypesPanel />
    </div>
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
    <section className="card">
      <h2 className="font-semibold mb-2">Consolidated references</h2>
      <p className="text-xs text-slate-500 mb-3">
        One reference per sensor model. Click to view; admins can edit the body inline.
      </p>
      {(docs.data ?? []).length === 0 && (
        <div className="text-sm text-slate-500">None yet. They&rsquo;re created automatically when you approve the first submission for a sensor.</div>
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
    </section>
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
    <section className="card">
      <h2 className="font-semibold mb-2">Users & permissions</h2>
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
    </section>
  );
}

function PlantsPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const plants = useQuery({ queryKey: ['admin-plants'], queryFn: async () => (await supabase.from('plants').select('*').order('name')).data ?? [] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    await supabase.from('plants').insert({ name, location: location || null });
    setName(''); setLocation('');
    qc.invalidateQueries({ queryKey: ['admin-plants'] });
    qc.invalidateQueries({ queryKey: ['plants'] });
    qc.invalidateQueries({ queryKey: ['plant-list'] });
  }

  return (
    <section className="card">
      <h2 className="font-semibold mb-2">Plants</h2>
      <form onSubmit={add} className="flex gap-2 mb-3">
        <input className="input" placeholder="Plant name (e.g. STP Aurangabad)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        <button className="btn-primary">Add</button>
      </form>
      <ul className="text-sm divide-y divide-slate-100">
        {(plants.data ?? []).map((p: any) => (
          <li key={p.id} className="py-2 flex justify-between"><span>{p.name}</span><span className="text-slate-500 text-xs">{p.location}</span></li>
        ))}
      </ul>
    </section>
  );
}

function TypesPanel() {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const types = useQuery({ queryKey: ['admin-types'], queryFn: async () => (await supabase.from('document_types').select('*').order('sort_order')).data ?? [] });

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
    <section className="card">
      <h2 className="font-semibold mb-2">Document types</h2>
      <form onSubmit={add} className="flex gap-2 mb-3">
        <input className="input" placeholder='Label (e.g. "Commissioning Report")' value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="input md:w-48" placeholder="key (snake_case)" value={key} onChange={(e) => setKey(e.target.value.replace(/[^a-z0-9_]/g, ''))} />
        <button className="btn-primary">Add</button>
      </form>
      <ul className="text-sm grid grid-cols-2 md:grid-cols-3 gap-1">
        {(types.data ?? []).map((t: any) => (
          <li key={t.id} className="py-1"><span className="badge-blue">{t.label}</span> <span className="text-xs text-slate-400">{t.key}</span></li>
        ))}
      </ul>
    </section>
  );
}
