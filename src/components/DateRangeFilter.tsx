import { Calendar, X } from 'lucide-react';

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

const MIN_DATE = '1990-01-01';
const MAX_DATE = '2099-12-31';

// The picker is the only way to set a date — reject anything that isn't a clean in-range
// YYYY-MM-DD before it reaches state, since filtering elsewhere assumes that exact shape.
function sanitizeDate(value: string): string | null {
  if (value === '') return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (value < MIN_DATE || value > MAX_DATE) return null;
  return value;
}

// Typing is disabled (see className below hiding the native icon + this blocking edits) so the
// calendar popup is the only way to set a value — but Tab must still move focus normally.
function blockTyping(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Tab') e.preventDefault();
}

function openPicker(e: React.SyntheticEvent<HTMLInputElement>) {
  e.currentTarget.showPicker?.();
}

const dateInputClass =
  'text-navy focus:outline-none bg-transparent w-[104px] cursor-pointer caret-transparent [&::-webkit-calendar-picker-indicator]:hidden';

export default function DateRangeFilter({ from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  const active = Boolean(from || to);

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:border-navy-light focus-within:ring-1 focus-within:ring-navy-light ${
        active ? 'bg-navy/5 border-navy-light' : 'bg-white border-grey-border hover:border-navy-light/60'
      }`}
    >
      <Calendar className={`flex-shrink-0 ${active ? 'text-navy' : 'text-gray-400'}`} size={16} />
      <input
        type="date"
        aria-label="From date"
        value={from}
        min={MIN_DATE}
        max={MAX_DATE}
        onKeyDown={blockTyping}
        onClick={openPicker}
        onChange={(e) => {
          const sanitized = sanitizeDate(e.target.value);
          if (sanitized === null) return;
          onFromChange(sanitized);
          if (sanitized && to && sanitized > to) onToChange('');
        }}
        className={dateInputClass}
      />
      <span className="text-gray-300 flex-shrink-0">to</span>
      <input
        type="date"
        aria-label="To date"
        value={to}
        min={MIN_DATE}
        max={MAX_DATE}
        onKeyDown={blockTyping}
        onClick={openPicker}
        onChange={(e) => {
          const sanitized = sanitizeDate(e.target.value);
          if (sanitized === null) return;
          onToChange(sanitized);
          if (sanitized && from && sanitized < from) onFromChange('');
        }}
        className={dateInputClass}
      />
      {active ? (
        <button
          type="button"
          onClick={() => {
            onFromChange('');
            onToChange('');
          }}
          className="text-gray-400 hover:text-navy transition-colors flex-shrink-0 -mr-0.5"
          title="Clear dates"
        >
          <X size={14} />
        </button>
      ) : (
        <span className="w-[14px] flex-shrink-0" />
      )}
    </div>
  );
}
