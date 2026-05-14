import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth, isAdmin } from '../lib/auth';

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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Plants</h1>
          <p className="muted mt-1">{data?.length ?? 0} plant{data?.length === 1 ? '' : 's'}</p>
        </div>
        {isAdmin(profile) && (
          <button className="btn-primary" onClick={() => setAdding(true)}>+ New plant</button>
        )}
      </div>

      {adding && (
        <NewPlantForm onClose={() => setAdding(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['plant-list'] })} />
      )}

      {isLoading && <div className="muted">Loading…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data ?? []).map((p: any) => (
          <Link to={`/plants/${p.id}`} key={p.id} className="card hover:border-brand-700 hover:shadow-sm transition">
            <div className="flex items-start gap-3">
              <div className="bg-brand-50 text-brand-700 rounded-lg w-10 h-10 flex items-center justify-center shrink-0 text-lg">🏭</div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                <div className="muted truncate">{p.location || 'No location'}</div>
              </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Plant name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="STP Aurangabad" />
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
