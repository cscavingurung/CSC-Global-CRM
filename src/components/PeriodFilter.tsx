import { PERIOD_OPTIONS, PeriodKey } from '../reportPeriod';

interface PeriodFilterProps {
  value: PeriodKey;
  onChange: (value: PeriodKey) => void;
}

export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-grey-border bg-white p-1">
      {PERIOD_OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              active ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy hover:bg-navy/5'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
