import { supabase } from './supabaseClient';

export interface RealtimeChange<Row> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  // Full new row for INSERT/UPDATE, null for DELETE.
  new: Row | null;
  // Only the replica identity (primary key `id`) is guaranteed here — that's all
  // applyRealtimeChange needs to remove the right item on DELETE.
  old: (Partial<Row> & { id: string }) | null;
}

// Subscribes to every INSERT/UPDATE/DELETE on a table and calls `onChange` with the
// changed row — including changes made by other browser sessions, not just this one.
// Returns an unsubscribe function for cleanup.
export function subscribeToTable<Row = Record<string, unknown>>(
  table: string,
  onChange: (change: RealtimeChange<Row>) => void
): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel(`realtime:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      onChange({
        eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        new: (payload.new && Object.keys(payload.new).length > 0 ? payload.new : null) as Row | null,
        old: (payload.old && Object.keys(payload.old).length > 0 ? payload.old : null) as (Partial<Row> & { id: string }) | null,
      });
    })
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

// Applies one realtime change to a locally-held list without refetching the whole table —
// the fan-out cost of a full refetch on every write, multiplied across every connected
// staff member's open tab, is what made the portal slow as more people used it at once.
// `fromRow` re-uses the same row->record normalization as the table's own fetch function,
// so an incrementally-applied row is identical to what a full refetch would have produced.
// `sortBy`, when given, re-applies the list's original ordering after the change (inserts
// otherwise land wherever they're pushed, not where a fresh fetch would have sorted them).
export function applyRealtimeChange<Row, T extends { id: string }>(
  prev: T[],
  change: RealtimeChange<Row>,
  fromRow: (row: Row) => T,
  sortBy?: (a: T, b: T) => number
): T[] {
  if (change.eventType === 'DELETE') {
    const id = change.old?.id;
    if (!id) return prev;
    return prev.filter((item) => item.id !== id);
  }

  if (!change.new) return prev;
  const record = fromRow(change.new);
  const next = prev.some((item) => item.id === record.id)
    ? prev.map((item) => (item.id === record.id ? record : item))
    : [record, ...prev];
  return sortBy ? [...next].sort(sortBy) : next;
}
