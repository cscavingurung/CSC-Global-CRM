import { supabase } from './supabaseClient';

// Subscribes to every INSERT/UPDATE/DELETE on a table and calls `onChange` (which should
// re-fetch that table's data) whenever one happens — including changes made by other
// browser sessions, not just this one. Returns an unsubscribe function for cleanup.
export function subscribeToTable(table: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel(`realtime:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange())
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
