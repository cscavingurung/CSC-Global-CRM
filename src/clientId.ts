// Portal-wide Client ID. New clients get one generated at creation time; records created
// before this existed (and demo seeds) fall back to a stable ID derived from their row id,
// so the same client always shows the same code on every screen.

const PREFIX = 'CSC';

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) % 100000;
  }
  return h;
}

/** Next Client ID in this year's sequence (CSC-2026-1017 after CSC-2026-1016). Replaces the old
 * random 4-digit code, which collided after ~100 clients a year — and the finance ledger groups
 * money by Client ID. `existing` = every Client ID already issued (all branches).
 * The database should also enforce uniqueness (supabase/migrations/2026-09-27-client-id-unique.sql);
 * two sessions creating a client at the same instant can still race until IDs come from the DB. */
export function generateClientId(existing: (string | undefined)[]): string {
  const year = new Date().getFullYear();
  const prefix = `${PREFIX}-${year}-`;
  const max = existing.reduce((m, id) => {
    if (!id?.startsWith(prefix)) return m;
    const n = Number(id.slice(prefix.length));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 1000);
  return `${prefix}${max + 1}`;
}

/** The Client ID to display: the stored one when present, otherwise a stable derived code. */
export function clientIdFor(record: { clientId?: string; id: string }): string {
  if (record.clientId) return record.clientId;
  return `${PREFIX}-${String(hash(record.id)).padStart(5, '0')}`;
}
