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

/** Generates a fresh unique Client ID — used when a client record is first created. */
export function generateClientId(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `${PREFIX}-${year}-${random}`;
}

/** The Client ID to display: the stored one when present, otherwise a stable derived code. */
export function clientIdFor(record: { clientId?: string; id: string }): string {
  if (record.clientId) return record.clientId;
  return `${PREFIX}-${String(hash(record.id)).padStart(5, '0')}`;
}
