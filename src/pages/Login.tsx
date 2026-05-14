import { useState } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-bold text-brand-700 mb-1">📘 DP Internal Document Hub</h1>
        <p className="text-sm text-slate-600 mb-4">
          Sign in with your <strong>@digitalpaani.com</strong> email. We&rsquo;ll send you a one-time link.
        </p>
        {!isConfigured && (
          <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">
            Supabase env not configured. See <code>.env.example</code>.
          </div>
        )}
        {sent ? (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm p-3">
            Check your inbox at <strong>{email}</strong> for the login link.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Work email</label>
              <input
                type="email"
                required
                placeholder="you@digitalpaani.com"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {err && <div className="text-sm text-red-600">{err}</div>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
        <button onClick={() => nav('/')} className="btn-ghost mt-3 text-xs">Back</button>
      </div>
    </div>
  );
}
