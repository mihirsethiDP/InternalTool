import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabase';
import type { Profile } from './types';

export interface AuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
}

const initial: AuthState = { loading: true, userId: null, email: null, profile: null };

// Single app-wide auth state. Previously useAuth() ran its own getSession() +
// profiles fetch in EVERY component that called it (Layout, ChatDrawer,
// NotificationBell, each page, each Admin sub-panel…), so a single page load
// fired the same `profiles?id=eq.<uid>` query 5–10× in parallel. On free-tier
// Supabase that pile-up is the loading lag, and profile-gated views rendered
// their "denied/empty" branch until their own instance resolved (the
// "revisit the tab to load it" symptom). Now: one session load, one profile
// fetch, shared through context.
const AuthContext = createContext<AuthState>(initial);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initial);
  // De-dupe repeat loads for the same user (auth events can fire more than once).
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load(uid: string | null, email: string | null) {
      if (!uid) {
        loadedFor.current = null;
        if (active) setState({ loading: false, userId: null, email: null, profile: null });
        return;
      }
      if (loadedFor.current === uid) return; // already have this user's profile
      loadedFor.current = uid;
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (active) setState({ loading: false, userId: uid, email, profile: (data as Profile) ?? null });
    }
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      load(s?.user?.id ?? null, s?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      load(session?.user?.id ?? null, session?.user?.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function canUpload(p: Profile | null) {
  return p?.role === 'uploader' || p?.role === 'admin';
}
export function isAdmin(p: Profile | null) {
  return p?.role === 'admin';
}
