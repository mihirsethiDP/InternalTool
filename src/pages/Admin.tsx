import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';

export default function Admin() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  if (!isAdmin(profile)) {
    return <div className="card text-sm">Admin only.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>
      <UsersPanel onChanged={() => qc.invalidateQueries({ queryKey: ['admin-users'] })} />
      <PlantsPanel />
      <TypesPanel />
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
