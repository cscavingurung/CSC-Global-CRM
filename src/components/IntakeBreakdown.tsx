import { useState } from 'react';
import { ChevronDown, CalendarRange } from 'lucide-react';
import { IntakeBreakdownRow, SmartFilters } from '../applicationFilters';

interface IntakeBreakdownProps {
  rows: IntakeBreakdownRow[];
  filters: SmartFilters;
  onChange: (next: SmartFilters) => void;
}

type Column = {
  key: keyof Omit<IntakeBreakdownRow, 'intake'>;
  label: string;
  /** What clicking a count in this column filters the list to. */
  apply: Pick<SmartFilters, 'statuses' | 'milestone'>;
};

const COLUMNS: Column[] = [
  { key: 'clients', label: 'Clients', apply: { statuses: [], milestone: '' } },
  { key: 'offerLetters', label: 'Offer letters', apply: { statuses: [], milestone: 'offer-letter' } },
  { key: 'feePaid', label: 'Fee paid', apply: { statuses: [], milestone: 'fee-paid' } },
  { key: 'visaLodged', label: 'Visa lodged', apply: { statuses: [], milestone: 'visa-lodged' } },
  { key: 'approved', label: 'Visa approved', apply: { statuses: ['Visa Approved'], milestone: '' } },
  { key: 'refused', label: 'Visa refused', apply: { statuses: ['Visa Refused'], milestone: '' } },
];

/**
 * Branch Manager: per-intake funnel (offer letters → fee paid → visa lodged → decision).
 * Every count is a shortcut — clicking it filters the list below to exactly those clients.
 */
export default function IntakeBreakdown({ rows, filters, onChange }: IntakeBreakdownProps) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  const isSelected = (intake: string, col: Column) => {
    const [m, y] = intake.split(' ');
    return (
      filters.intakeMonth === m && filters.intakeYear === y &&
      filters.milestone === col.apply.milestone &&
      filters.statuses.join('|') === col.apply.statuses.join('|')
    );
  };

  const pick = (intake: string, col: Column) => {
    const [m, y] = intake.split(' ');
    if (isSelected(intake, col)) {
      onChange({ ...filters, intakeMonth: '', intakeYear: '', milestone: '', statuses: [] });
      return;
    }
    onChange({ ...filters, intake: '', intakeMonth: m, intakeYear: y, ...col.apply });
  };

  const approvalRate = (r: IntakeBreakdownRow) => {
    const decided = r.approved + r.refused;
    return decided === 0 ? '—' : `${Math.round((r.approved / decided) * 100)}%`;
  };

  return (
    <div className="bg-white rounded-xl border border-grey-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <CalendarRange size={16} className="text-navy-light" />
        <span className="text-sm font-semibold text-navy">Intake-wise breakdown</span>
        <span className="text-xs text-gray-400">{rows.length} intake{rows.length === 1 ? '' : 's'} · click any number to see those clients</span>
        <ChevronDown size={16} className={`ml-auto text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="dissolve-in overflow-x-auto border-t border-grey-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-grey-bg">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Intake</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">{c.label}</th>
                ))}
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 whitespace-nowrap" title="Approved ÷ (approved + refused)">
                  Approval rate
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.intake} className="border-t border-grey-border">
                  <td className="px-4 py-2 font-medium text-navy whitespace-nowrap">{r.intake}</td>
                  {COLUMNS.map((c) => {
                    const value = r[c.key];
                    const selected = isSelected(r.intake, c);
                    return (
                      <td key={c.key} className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          disabled={value === 0}
                          onClick={() => pick(r.intake, c)}
                          aria-pressed={selected}
                          className={`min-w-[2.25rem] rounded-md px-2 py-1 tabular-nums ${
                            selected ? 'bg-navy text-white'
                            : value === 0 ? 'text-gray-300 cursor-default'
                            : c.key === 'approved' ? 'text-emerald-700 hover:bg-emerald-50'
                            : c.key === 'refused' ? 'text-red-600 hover:bg-red-50'
                            : 'text-navy hover:bg-navy/5'
                          }`}
                        >
                          {value}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right text-gray-500 tabular-nums">{approvalRate(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
