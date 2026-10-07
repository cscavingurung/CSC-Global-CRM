import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars are missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env. Counselor student data will not load.');
}

// The session is kept in sessionStorage: it survives a refresh of this tab, but closing the tab
// or browser signs the user out. Nothing about a login is written to localStorage.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, storage: window.sessionStorage } })
  : null;
