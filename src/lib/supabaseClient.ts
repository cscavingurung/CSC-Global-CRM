import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars are missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env. Counselor student data will not load.');
}

// persistSession: false — the session lives in memory for this tab only, never written to
// localStorage. Closing the tab or refreshing the page signs the user out; nothing about their
// login is cached in the browser.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
  : null;
