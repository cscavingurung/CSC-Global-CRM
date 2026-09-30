import { useEffect, useRef, useState } from 'react';

// Text-only replacement for `<input type="date">` — three plain digit boxes (Day / Month /
// Year) instead of the browser's native date widget. The native year segment has no `maxLength`
// (Chrome lets you type up to 6 digits before `min`/`max` catch it on blur); a real text input
// can enforce the 4-digit cap while you're still typing, not just after. Trade-off: no native
// calendar popup or mobile date wheel — this is typing-only, by design (see the conversation
// that led here). `value`/`onChange` still use the same 'YYYY-MM-DD' string every other date
// field in the app already stores, so this drops into existing state untouched.

export interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  /** Extra classes on the outer box — widths, margins, etc. */
  className?: string;
  /** Skip the built-in border/padding/background, for embedding inside a filter pill or other
   * container that already provides its own box (see DateRangeFilter, GlobalFilterBar). */
  bare?: boolean;
}

interface Segments { day: string; month: string; year: string }

function parseIso(value: string): Segments {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? { year: m[1], month: m[2], day: m[3] } : { day: '', month: '', year: '' };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Builds a real calendar date from the three segments — clamps an out-of-range day to the
 * last real day of that month/year (e.g. 31 Feb → 28/29 Feb) rather than rejecting it outright.
 * Returns null while any segment is still incomplete. */
function toIso({ day, month, year }: Segments): string | null {
  if (!day || !month || year.length !== 4) return null;
  const mo = Math.min(12, Math.max(1, Number(month)));
  const y = Number(year);
  const lastDayOfMonth = new Date(y, mo, 0).getDate();
  const d = Math.min(lastDayOfMonth, Math.max(1, Number(day)));
  return `${year}-${pad2(mo)}-${pad2(d)}`;
}

function clampToRange(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/** Lenient paste parsing — "15/08/2026", "15-08-2026" and "2026-08-15" all resolve the same way,
 * since that covers both what people copy from documents and what they copy from this app's own
 * ISO-formatted exports. Anything else is left for the individual segment to absorb digit-by-digit. */
function parsePasted(text: string): Segments | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim());
  if (iso) return { year: iso[1], month: iso[2].padStart(2, '0'), day: iso[3].padStart(2, '0') };
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text.trim());
  if (dmy) return { day: dmy[1].padStart(2, '0'), month: dmy[2].padStart(2, '0'), year: dmy[3] };
  return null;
}

const digitsOnly = (raw: string) => raw.replace(/\D/g, '');

export default function DateInput({
  value, onChange, min, max, required, disabled, id, className, bare, ...rest
}: DateInputProps) {
  const initial = parseIso(value);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // Resync when `value` changes from outside (reset, "Clear" button, another field's effect) —
  // but not from our own commit() calls, which already match what the segments hold.
  useEffect(() => {
    if (value === (toIso({ day, month, year }) ?? '')) return;
    const next = parseIso(value);
    setDay(next.day);
    setMonth(next.month);
    setYear(next.year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next: Segments) => {
    if (!next.day && !next.month && !next.year) { onChange(''); return; }
    const iso = toIso(next);
    if (iso) onChange(clampToRange(iso, min, max));
  };

  const clampSegment = (raw: string, lo: number, hi: number) =>
    raw ? String(Math.min(hi, Math.max(lo, Number(raw)))) : raw;

  const ariaLabel = rest['aria-label'];

  const segmentCls = `bg-transparent text-navy text-center focus:outline-none placeholder:text-gray-300 disabled:text-gray-400 ${disabled ? 'cursor-not-allowed' : ''}`;
  const wrapCls = bare
    ? `inline-flex items-center gap-1 ${className ?? ''}`
    : `inline-flex items-center gap-1 rounded-lg border border-grey-border bg-white px-3 py-2.5 text-sm transition-colors focus-within:border-navy-light focus-within:ring-1 focus-within:ring-navy-light ${disabled ? 'bg-grey-bg' : ''} ${className ?? ''}`;

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const parsed = parsePasted(e.clipboardData.getData('text'));
    if (!parsed) return;
    e.preventDefault();
    setDay(parsed.day);
    setMonth(parsed.month);
    setYear(parsed.year);
    commit(parsed);
    yearRef.current?.focus();
  };

  return (
    <div className={wrapCls} role="group" aria-label={ariaLabel}>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD"
        maxLength={2}
        required={required}
        disabled={disabled}
        id={id}
        value={day}
        onChange={(e) => {
          const v = digitsOnly(e.target.value).slice(0, 2);
          setDay(v);
          commit({ day: v, month, year });
          if (v.length === 2) monthRef.current?.focus();
        }}
        onBlur={() => { const c = clampSegment(day, 1, 31); setDay(c); commit({ day: c, month, year }); }}
        onPaste={handlePaste}
        className={`w-5 ${segmentCls}`}
      />
      <span className="text-gray-300">/</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="MM"
        maxLength={2}
        disabled={disabled}
        value={month}
        onChange={(e) => {
          const v = digitsOnly(e.target.value).slice(0, 2);
          setMonth(v);
          commit({ day, month: v, year });
          if (v.length === 2) yearRef.current?.focus();
        }}
        onKeyDown={(e) => { if (e.key === 'Backspace' && month === '') dayRef.current?.focus(); }}
        onBlur={() => { const c = clampSegment(month, 1, 12); setMonth(c); commit({ day, month: c, year }); }}
        onPaste={handlePaste}
        className={`w-5 ${segmentCls}`}
      />
      <span className="text-gray-300">/</span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="YYYY"
        maxLength={4}
        disabled={disabled}
        value={year}
        onChange={(e) => {
          const v = digitsOnly(e.target.value).slice(0, 4);
          setYear(v);
          commit({ day, month, year: v });
        }}
        onKeyDown={(e) => { if (e.key === 'Backspace' && year === '') monthRef.current?.focus(); }}
        onPaste={handlePaste}
        className={`w-10 ${segmentCls}`}
      />
    </div>
  );
}
