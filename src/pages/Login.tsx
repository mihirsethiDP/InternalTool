import { useState } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, KeyRound, ArrowLeft, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

type Mode = 'password' | 'otp' | 'forgot';

const REDIRECT = window.location.origin + import.meta.env.BASE_URL;

export default function Login() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function reset(next: Mode) {
    setMode(next); setErr(null); setInfo(null); setOtpSent(false); setCode(''); setPassword('');
  }

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
    else nav('/');
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setInfo(null); setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: REDIRECT } });
    setBusy(false);
    if (error) setErr(error.message);
    else { setOtpSent(true); setInfo(`We sent a 6-digit code to ${email}.`); }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setErr(error.message);
    else nav('/');
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setInfo(null); setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT });
    setBusy(false);
    if (error) setErr(error.message);
    else setInfo(`If ${email} has an account, a password-reset link is on its way.`);
  }

  async function google() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: REDIRECT } });
    if (error) setErr(error.message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900">
      {/* decorative glows */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 w-[28rem] h-[28rem] rounded-full bg-brand-400/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '22px 22px' }} />

      <div className="relative w-full max-w-md">
        {/* Brand — light logo sits directly on the gradient, no frame */}
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="DigitalPaani"
            className="h-12 w-auto object-contain mb-4"
            onError={(e) => { (e.currentTarget.style.display = 'none'); }}
          />
          <h1 className="text-white text-xl font-bold tracking-tight">Sensor Troubleshooting Hub</h1>
          <p className="text-white/70 text-sm mt-1">DigitalPaani · internal access</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7">
          {!isConfigured && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">
              Supabase env not configured. See <code>.env.example</code>.
            </div>
          )}

          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            {mode === 'password' && 'Sign in'}
            {mode === 'otp' && 'Sign in with a code'}
            {mode === 'forgot' && 'Reset your password'}
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            {mode === 'password' && 'Use your @digitalpaani.com work email.'}
            {mode === 'otp' && (otpSent ? 'Enter the 6-digit code from your email.' : 'We’ll email you a one-time code.')}
            {mode === 'forgot' && 'We’ll email you a link to set a new password.'}
          </p>

          {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{err}</div>}
          {info && <div role="status" className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-3">{info}</div>}

          {/* PASSWORD MODE */}
          {mode === 'password' && (
            <form onSubmit={signInPassword} className="space-y-3">
              <Field label="Work email">
                <input type="email" required autoComplete="email" placeholder="you@digitalpaani.com"
                  className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password">
                <input type="password" required autoComplete="current-password" placeholder="Your password"
                  className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <div className="flex justify-end -mt-1">
                <button type="button" onClick={() => reset('forgot')} className="text-xs text-brand-700 hover:underline">Forgot password?</button>
              </div>
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <>Sign in <ArrowRight size={15} /></>}
              </button>
            </form>
          )}

          {/* OTP MODE */}
          {mode === 'otp' && !otpSent && (
            <form onSubmit={sendCode} className="space-y-3">
              <Field label="Work email">
                <input type="email" required autoComplete="email" placeholder="you@digitalpaani.com"
                  className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <>Email me a code <KeyRound size={15} /></>}
              </button>
            </form>
          )}
          {mode === 'otp' && otpSent && (
            <form onSubmit={verifyCode} className="space-y-3">
              <Field label="6-digit code">
                <input inputMode="numeric" autoComplete="one-time-code" required placeholder="123456" maxLength={6}
                  className="input tracking-[0.4em] font-semibold" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </Field>
              <button className="btn-primary w-full" disabled={busy || code.length < 6}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <>Verify &amp; sign in <ArrowRight size={15} /></>}
              </button>
              <button type="button" onClick={sendCode} disabled={busy} className="text-xs text-slate-500 hover:text-brand-700 w-full text-center">
                Didn&rsquo;t get it? Resend code
              </button>
            </form>
          )}

          {/* FORGOT MODE */}
          {mode === 'forgot' && (
            <form onSubmit={sendReset} className="space-y-3">
              <Field label="Work email">
                <input type="email" required autoComplete="email" placeholder="you@digitalpaani.com"
                  className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : 'Send reset link'}
              </button>
            </form>
          )}

          {/* Alternate methods */}
          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="space-y-2">
                <button onClick={google} className="tap w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition">
                  <GoogleIcon /> Continue with Google
                </button>
                {mode === 'password' ? (
                  <button onClick={() => reset('otp')} className="tap w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition">
                    <KeyRound size={16} /> Email me a one-time code
                  </button>
                ) : (
                  <button onClick={() => reset('password')} className="tap w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition">
                    <Lock size={16} /> Use email &amp; password
                  </button>
                )}
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <button onClick={() => reset('password')} className="mt-4 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700">
              <ArrowLeft size={15} /> Back to sign in
            </button>
          )}
        </div>

        <div className="text-center text-xs text-white/60 mt-5 flex items-center justify-center gap-1.5">
          <ShieldCheck size={13} />
          By signing in you agree to our{' '}
          <button onClick={() => nav('/privacy')} className="text-white/90 hover:text-white underline">Privacy Notice</button>.
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C40.9 35.7 44 30.4 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}
