import { Calendar, X } from 'lucide-react';
import DateInput from './DateInput';

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

const MIN_DATE = '1990-01-01';
const MAX_DATE = '2099-12-31';

export default function DateRangeFilter({ from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  const active = Boolean(from || to);

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:border-navy-light focus-within:ring-1 focus-within:ring-navy-light ${
        active ? 'bg-navy/5 border-navy-light' : 'bg-white border-grey-border hover:border-navy-light/60'
      }`}
    >
      <Calendar className={`flex-shrink-0 ${active ? 'text-navy' : 'text-gray-400'}`} size={16} />
      <DateInput
        bare
        aria-label="From date"
        value={from}
        min={MIN_DATE}
        max={to || MAX_DATE}
        onChange={(value) => {
          onFromChange(value);
          if (value && to && value > to) onToChange('');
        }}
      />
      <span className="text-gray-300 flex-shrink-0">to</span>
      <DateInput
        bare
        aria-label="To date"
        value={to}
        min={from || MIN_DATE}
        max={MAX_DATE}
        onChange={(value) => {
          onToChange(value);
          if (value && from && value < from) onFromChange('');
        }}
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
