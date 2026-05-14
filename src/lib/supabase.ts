import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // Keep the app loadable so we can show a clear configuration error.
  console.warn('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in env');
}

export const supabase = createClient(url ?? '', anon ?? '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const isConfigured = Boolean(url && anon);
