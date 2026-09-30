import { useState } from 'react';
import { Calendar, X } from 'lucide-react';

interface CompactDateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

const MIN_DATE = '1990-01-01';
const MAX_DATE = '2099-12-31';

function sanitizeDate(value: string): string | null {
  if (value === '') return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (value < MIN_DATE || value > MAX_DATE) return null;
  return value;
}

function formatDateLabel(value: string): string {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CompactDateRangeFilter({ from, to, onFromChange, onToChange }: CompactDateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const active = Boolean(from || to);
  const label = from && to
    ? `${formatDateLabel(from)} → ${formatDateLabel(to)}`
    : from
      ? `From ${formatDateLabel(from)}`
      : to
        ? `To ${formatDateLabel(to)}`
        : 'Select Dates';

  const clearDates = () => {
    onFromChange('');
    onToChange('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-[42px] w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors sm:w-[220px] ${
          active ? 'border-navy-light bg-navy/5 text-navy' : 'border-grey-border bg-white text-gray-500 hover:border-navy-light/60 hover:text-navy'
        }`}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <Calendar size={16} className={active ? 'text-navy' : 'text-gray-400'} />
          <span className="truncate">{label}</span>
        </span>
        {active ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear dates"
            onClick={(event) => {
              event.stopPropagation();
              clearDates();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                clearDates();
              }
            }}
            className="text-gray-400 transition-colors hover:text-navy"
          >
            <X size={14} />
          </span>
        ) : null}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close date picker" className="fixed inset-0 z-20 cursor-default" onClick={() => setOpen(false)} />
          <div className="pointer-events-auto absolute right-0 z-30 mt-2 w-[280px] rounded-lg border border-grey-border bg-white p-3">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">From</span>
                <input
                  type="date"
                  value={from}
                  min={MIN_DATE}
                  max={MAX_DATE}
                  onChange={(event) => {
                    const value = sanitizeDate(event.target.value);
                    if (value === null) return;
                    onFromChange(value);
                    if (value && to && value > to) onToChange('');
                  }}
                  className="w-full rounded-lg border border-grey-border bg-white px-3 py-2 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">To</span>
                <input
                  type="date"
                  value={to}
                  min={MIN_DATE}
                  max={MAX_DATE}
                  onChange={(event) => {
                    const value = sanitizeDate(event.target.value);
                    if (value === null) return;
                    onToChange(value);
                    if (value && from && value < from) onFromChange('');
                  }}
                  className="w-full rounded-lg border border-grey-border bg-white px-3 py-2 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
                />
              </label>
              <div className="flex gap-2 border-t border-grey-border pt-3">
                <button type="button" onClick={clearDates} className="flex-1 rounded-lg border border-grey-border px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-grey-bg hover:text-navy">
                  Clear
                </button>
                <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-light">
                  Done
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}