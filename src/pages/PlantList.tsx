import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';
import PageHeader from '../components/PageHeader';

export default function PlantList() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['plant-list'],
    queryFn: async () => (await supabase.from('plants').select('*').order('name')).data ?? [],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sites"
        title="Plants"
        icon="🏭"
        subtitle="All operational sites — open one to see its equipment, sensors, and documents."
        stats={[{ label: 'Plants', value: data?.length ?? 0 }]}
        action={isAdmin(profile) && !adding && (
          <button onClick={() => setAdding(true)} className="bg-white text-brand-700 hover:bg-slate-100 rounded-lg px-4 py-2 font-semibold text-sm shadow-sm">+ New plant</button>
        )}
      />

      {adding && (
        <NewPlantForm onClose={() => setAdding(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['plant-list'] })} />
      )}

      {isLoading && <div className="muted">Loading…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data ?? []).map((p: any) => (
          <Link to={`/plants/${p.id}`} key={p.id} className="card hover:border-brand-700 hover:shadow-md transition group">
            <div className="flex items-start gap-3">
              <div className="bg-brand-50 text-brand-700 group-hover:bg-brand-700 group-hover:text-white transition rounded-lg w-11 h-11 flex items-center justify-center shrink-0 text-lg">🏭</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                <div className="muted truncate">{p.location || 'No location'}</div>
              </div>
              <div className="text-slate-300 group-hover:text-brand-700 transition">→</div>
            </div>
          </Link>
        ))}
        {(data ?? []).length === 0 && !isLoading && (
          <div className="card text-sm text-slate-500 col-span-full text-center">
            No plants yet.{isAdmin(profile) && ' Click "New plant" above to add one.'}
          </div>
        )}
      </div>
    </div>
  );
}

function NewPlantForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('plants').insert({ name, location: location || null });
    setBusy(false);
    if (error) { alert(error.message); return; }
    onCreated(); onClose();
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-3">New plant</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Plant name</label>
          <input className="input" required value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="STP Aurangabad" />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Aurangabad, MH" />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}
