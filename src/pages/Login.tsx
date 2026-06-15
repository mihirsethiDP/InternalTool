import { useState } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [googleBusy, setGoogleBusy] = useState(false);

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

  async function signInWithGoogle() {
    setErr(null);
    setGoogleBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Return to the deployed app (HashRouter base). Supabase appends the
        // session to the URL; detectSessionInUrl (set in lib/supabase) consumes it.
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
        // Hint Google to restrict to the company domain (UX only — enforce
        // server-side too if you need a hard guarantee).
        queryParams: { hd: 'digitalpaani.com', prompt: 'select_account' },
      },
    });
    if (error) { setErr(error.message); setGoogleBusy(false); }
    // On success the browser redirects to Google; no further code runs here.
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="card w-full max-w-md">
        <div className="flex items-center gap-3 mb-2">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="DigitalPaani"
            className="h-12 w-auto object-contain bg-brand-700 rounded-lg p-1.5"
            onError={(e) => { (e.currentTarget.style.display = 'none'); }}
          />
          <div>
            <h1 className="text-xl font-bold text-brand-700 leading-tight">DigitalPaani</h1>
            <div className="text-xs text-slate-500">Internal Document Hub</div>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Sign in with your <strong>@digitalpaani.com</strong> account.
        </p>
        {!isConfigured && (
          <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">
            Supabase env not configured. See <code>.env.example</code>.
          </div>
        )}

        {/* Google sign-in */}
        <button
          onClick={signInWithGoogle}
          disabled={googleBusy}
          className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
        >
          <GoogleMark />
          {googleBusy ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-slate-200 flex-1" />
          <span className="text-xs text-slate-400">or</span>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

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
            <button className="btn-secondary w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a magic link'}
            </button>
          </form>
        )}
        <button onClick={() => nav('/')} className="btn-ghost mt-3 text-xs">Back</button>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
