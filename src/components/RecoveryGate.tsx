import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle2 } from 'lucide-react';

// When a user follows a password-reset email, Supabase fires a
// PASSWORD_RECOVERY auth event and establishes a temporary session. This gate
// catches that event and overlays a "set a new password" form — without it,
// the recovery session would just drop the user into the app with no way to
// actually set their password. Mounted once at the app root.
export default function RecoveryGate() {
  const [active, setActive] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery token is parsed from the URL hash by supabase-js on init,
    // which can emit PASSWORD_RECOVERY before this listener attaches. Catch that
    // case by also checking the URL hash on mount.
    if (/[#&]type=recovery/.test(window.location.hash)) setActive(true);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setActive(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!active) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (password !== confirm) { setErr('Passwords don’t match.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-7">
        {done ? (
          <div className="text-center py-4">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-slate-900">Password updated</h2>
            <p className="text-sm text-slate-500 mt-1 mb-5">You can use it to sign in from now on.</p>
            <button onClick={() => { setActive(false); window.location.reload(); }} className="btn-primary w-full">Continue</button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Set a new password</h2>
            <p className="text-sm text-slate-500 mt-1 mb-5">Choose a password for your account.</p>
            {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{err}</div>}
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="label">New password</span>
                <input type="password" required autoComplete="new-password" placeholder="At least 8 characters"
                  className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Confirm password</span>
                <input type="password" required autoComplete="new-password" placeholder="Re-enter password"
                  className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </label>
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
