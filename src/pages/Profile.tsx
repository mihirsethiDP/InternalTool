import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import PageHeader from '../components/PageHeader';

export default function Profile() {
  const { profile, email, userId } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true); setErr(null);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null })
      .eq('id', userId);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSavedAt(new Date().toLocaleTimeString());
    qc.invalidateQueries({ queryKey: ['admin-users'] });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="Account"
        title="Edit profile"
        subtitle="Manage how you appear inside the tool."
        action={
          <button onClick={() => nav(-1)} className="bg-white text-brand-700 hover:bg-slate-100 rounded-md px-3 py-2 text-sm">
            ← Back
          </button>
        }
      />

      <form onSubmit={save} className="card space-y-5">
        <div>
          <label className="label">Display name</label>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name as it appears in the tool"
            maxLength={120}
          />
          <div className="text-xs text-slate-500 mt-1.5">Shown on the user menu and (if applicable) in the Admin users list.</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Email</label>
            <input className="input bg-slate-50 cursor-not-allowed" value={email ?? ''} readOnly />
            <div className="text-xs text-slate-500 mt-1.5">Sign-in email — read-only.</div>
          </div>
          <div>
            <label className="label">Role</label>
            <input className="input bg-slate-50 cursor-not-allowed" value={profile?.role ?? 'viewer'} readOnly />
            <div className="text-xs text-slate-500 mt-1.5">An admin can change this from the Admin → Users tab.</div>
          </div>
        </div>

        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">{err}</div>}
        {savedAt && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">Saved at {savedAt}</div>}

        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}
