import { ChevronDown, RotateCcw, Search } from 'lucide-react';
import { DateRange, RANGE_PRESETS, RangePreset } from '../../managerWorkspace';
import DateInput from '../DateInput';

// Filter bar pieces and the responsive list used by every Branch Manager Workspace page — white
// surfaces, thin grey borders, no shadows, soft-tinted pills.

const controlCls = 'h-10 rounded-lg border border-grey-border bg-white text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light';

/** One row of filters above a table or view, with a reset link once anything is set. */
export function FilterBar({ children, active, onReset }: { children: React.ReactNode; active: boolean; onReset: () => void }) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-grey-border bg-white p-3">
      {children}
      <button
        type="button"
        onClick={onReset}
        disabled={!active}
        className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-navy transition-colors hover:text-navy-light disabled:invisible"
      >
        <RotateCcw size={13} /> Reset filters
      </button>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      {children}
    </label>
  );
}

/** Dropdown filter — "All …" first, per the app's filter convention. */
export function FilterSelect({ label, value, onChange, all, options }: {
  label: string; value: string; onChange: (v: string) => void; all: string; options: readonly string[];
}) {
  return (
    <Labelled label={label}>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${controlCls} w-full min-w-[150px] appearance-none pl-3 pr-9 font-medium`}>
          <option value="">{all}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
    </Labelled>
  );
}

/** Today / This Week / This Month / Custom — Custom reveals a from/to pair. */
export function DateRangeControl({ value, onChange, label = 'Date Range' }: { value: DateRange; onChange: (v: DateRange) => void; label?: string }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Labelled label={label}>
        <div className="relative">
          <select
            value={value.preset}
            onChange={(e) => onChange({ ...value, preset: e.target.value as RangePreset })}
            className={`${controlCls} min-w-[140px] appearance-none pl-3 pr-9 font-medium`}
          >
            {RANGE_PRESETS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </Labelled>
      {value.preset === 'Custom' && (
        <>
          <Labelled label="From">
            <DateInput value={value.from} max={value.to || undefined} onChange={(from) => onChange({ ...value, from })} className={controlCls} />
          </Labelled>
          <Labelled label="To">
            <DateInput value={value.to} min={value.from || undefined} onChange={(to) => onChange({ ...value, to })} className={controlCls} />
          </Labelled>
        </>
      )}
    </div>
  );
}

export function SearchFilter({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Labelled label="Search">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${controlCls} w-full min-w-[200px] pl-9 pr-3`} />
      </div>
    </Labelled>
  );
}

export function ToggleFilter({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${checked ? 'border-red-200 bg-red-50 text-red-700' : 'border-grey-border bg-white text-navy hover:border-navy-light'}`}
    >
      <span className={`relative h-4 w-7 rounded-full transition-colors ${checked ? 'bg-red-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${checked ? 'left-3.5' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  right?: boolean;
}

/** Table on desktop, cards on mobile — the app's list convention. */
export function DataList<T>({ rows, columns, rowKey, card, empty, rowClass, onRowClick }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  card: (row: T) => React.ReactNode;
  empty: string;
  rowClass?: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-grey-border bg-white lg:block">
        <table className="w-full text-sm">
          <thead className="bg-grey-bg">
            <tr>
              {columns.map((c) => (
                <th key={c.header} className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-gray-500 ${c.right ? 'text-right' : 'text-left'}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} className="py-12 text-center text-sm text-gray-400">{empty}</td></tr>
            )}
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`border-b border-grey-border transition-colors last:border-0 ${rowClass?.(r) || 'hover:bg-grey-bg/50'} ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((c) => (
                  <td key={c.header} className={`px-4 py-3 align-top ${c.right ? 'text-right' : ''}`}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 lg:hidden">
        {rows.length === 0 && <p className="rounded-xl border border-grey-border bg-white py-12 text-center text-sm text-gray-400">{empty}</p>}
        {rows.map((r) => (
          <div
            key={rowKey(r)}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            className={`rounded-xl border border-grey-border p-4 ${rowClass?.(r) || 'bg-white'} ${onRowClick ? 'cursor-pointer' : ''}`}
          >
            {card(r)}
          </div>
        ))}
      </div>
    </>
  );
}

/** Soft-tinted pill badge. */
export function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
}

/** Compact step tracker for a status pipeline (e.g. Requested → … → Delivered). */
export function StepTrack({ steps, current }: { steps: readonly string[]; current: string }) {
  const at = steps.indexOf(current);
  return (
    <div className="flex items-center gap-1" aria-label={`${current} — step ${at + 1} of ${steps.length}`} title={steps.join(' → ')}>
      {steps.map((s, i) => (
        <span key={s} className={`h-1.5 w-6 rounded-full ${i <= at ? 'bg-navy' : 'bg-grey-border'}`} />
      ))}
    </div>
  );
}

export function SectionHeading({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 className="text-base font-semibold text-navy">{title}</h3>
        {hint && <p className="text-sm text-gray-500">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
