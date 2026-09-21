// submittedAt is stored as "YYYY-MM-DD hh:mm AM/PM" (see mockData.ts) — parsed explicitly
// rather than handed to `new Date(...)` since that format isn't reliably parsed across engines.
export function parseSubmittedAt(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!match) return null;
  const [, y, mo, d, hRaw, mi, ampm] = match;
  let hour = parseInt(hRaw, 10) % 12;
  if (ampm === 'PM') hour += 12;
  return new Date(Number(y), Number(mo) - 1, Number(d), hour, Number(mi));
}

// Inverse of parseSubmittedAt — used when a new IntakeStudent is created (real New Intake
// submissions) so the string it's stored with is guaranteed parseable. Built from explicit
// date parts rather than `toLocaleString`, whose output shape varies by locale/engine (e.g.
// "en-AU" produces "DD/MM/YYYY, hh:mm am/pm", which parseSubmittedAt can't read at all).
export function formatSubmittedAt(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
  const hour = date.getHours() % 12 || 12;
  return `${y}-${mo}-${d} ${hour}:${mi} ${ampm}`;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Formats elapsed minutes as "12 min", "3h 5m", or "2d 4h" depending on magnitude.
export function formatWait(minutes: number): string {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const totalHours = Math.floor(minutes / 60);
  if (totalHours < 24) {
    const remMin = Math.round(minutes - totalHours * 60);
    return remMin > 0 ? `${totalHours}h ${remMin}m` : `${totalHours}h`;
  }
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours - days * 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}
