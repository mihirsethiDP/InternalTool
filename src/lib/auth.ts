import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Profile } from './types';

export interface AuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, userId: null, email: null, profile: null });

  useEffect(() => {
    let active = true;
    async function load(uid: string | null, email: string | null) {
      if (!uid) {
        if (active) setState({ loading: false, userId: null, email: null, profile: null });
        return;
      }
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

  return state;
}

export function canUpload(p: Profile | null) {
  return p?.role === 'uploader' || p?.role === 'admin';
}
export function isAdmin(p: Profile | null) {
  return p?.role === 'admin';
}
