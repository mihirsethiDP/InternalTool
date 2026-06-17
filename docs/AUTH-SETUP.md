# Auth setup — password, OTP code, Google

The login screen offers three ways in: **email + password**, a **one-time
6-digit code** (replaces the magic link), and **Continue with Google**. There is
no self-signup — first-time users get in via the code, then set a password via
**Forgot password**. The code already calls the right Supabase methods; this
doc is the dashboard config that makes them work.

App URL (use everywhere a redirect/allow-list is asked for):
`https://mihirsethidp.github.io/InternalTool/`

## 1. Allow-list the app URL (required for code, reset, Google)
Supabase → **Authentication → URL Configuration**
- **Site URL:** `https://mihirsethidp.github.io/InternalTool/`
- **Redirect URLs:** add `https://mihirsethidp.github.io/InternalTool/`
  (and `http://localhost:5173/InternalTool/` if you ever test locally)

## 2. Email + password
Supabase → **Authentication → Providers → Email**
- **Enable Email provider:** ON.
- **Confirm email:** your choice. With no self-signup it matters little; leaving
  it ON is fine.
- Users get a password through **Forgot password** (uses the Reset Password
  email → app shows a "set new password" screen via `RecoveryGate`).

## 3. One-time code (instead of magic link)
`signInWithOtp` sends Supabase's **Magic Link** email. By default that email
shows a *link*, not a code. To show the 6-digit code the screen asks for:

Supabase → **Authentication → Email Templates → Magic Link** → edit the body to
include the token, e.g.:

```
<h2>Your sign-in code</h2>
<p>Enter this code to sign in:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>This code expires shortly. If you didn't request it, ignore this email.</p>
```

(The code verifies via `verifyOtp({ type: 'email' })`, already wired.)

## 4. Continue with Google
Two halves — Google Cloud, then Supabase.

**Google Cloud Console** (the paid project your admin holds):
1. APIs & Services → **OAuth consent screen** → configure (Internal if it's a
   Workspace, else External), add app name + support email.
2. APIs & Services → **Credentials → Create credentials → OAuth client ID** →
   type **Web application**.
3. **Authorized redirect URI:**
   `https://hdbkmctvkpbfaaoojdud.supabase.co/auth/v1/callback`
4. Save → copy the **Client ID** and **Client secret**.

**Supabase** → **Authentication → Providers → Google**:
1. Enable it.
2. Paste the Client ID and Client secret → Save.

That's it — the "Continue with Google" button then works end-to-end. Until this
is configured, the button returns a provider error (harmless).

## Notes
- Existing passwordless users: they can keep using the code, or set a password
  via Forgot password — both work.
- The reset/recovery flow is handled in-app by `src/components/RecoveryGate.tsx`.
