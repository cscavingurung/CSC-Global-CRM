import { ChevronDown, RotateCcw, X } from 'lucide-react';
import { DEFAULT_FILTERS, DEPARTMENTS, Dim, GlobalFilters, PERIODS, Period, periodLabel } from '../../superAdmin';
import { CommandSources } from '../../superAdmin';
import { clampDateInput } from '../../dateTime';

// Compact global filter bar. Filters that don't apply to the current view stay visible but are
// disabled, with the reason as a tooltip — so the manager always sees what shapes the numbers.

interface GlobalFilterBarProps {
  filters: GlobalFilters;
  onChange: (f: GlobalFilters) => void;
  sources: CommandSources;
  /** Which filters apply on this view. */
  dims: Dim[];
  notes?: Partial<Record<Dim, string>>;
}

const selectCls = 'h-9 w-full appearance-none rounded-lg border border-grey-border bg-white pl-3 pr-8 text-sm font-medium text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light disabled:cursor-not-allowed disabled:bg-grey-bg disabled:text-gray-400';

/** "Jan 2027" → sortable number. */
const intakeOrder = (s: string) => {
  const d = new Date(`1 ${s}`);
  return Number.isNaN(d.getTime()) ? Infinity : d.getTime();
};

function Select({ label, value, onChange, all, options, disabled, note }: {
  label: string; value: string; onChange: (v: string) => void; all?: string; options: readonly string[]; disabled?: boolean; note?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1" title={disabled ? note ?? 'Not used on this view' : undefined}>
      <span className={`text-[11px] font-medium uppercase tracking-wide ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>{label}{disabled && ' · n/a'}</span>
      <div className="relative">
        <select value={disabled ? '' : value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={selectCls}>
          {all !== undefined && <option value="">{all}</option>}
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
    </label>
  );
}

export default function GlobalFilterBar({ filters: f, onChange, sources, dims, notes }: GlobalFilterBarProps) {
  const on = (d: Dim) => dims.includes(d);
  const set = (patch: Partial<GlobalFilters>) => onChange({ ...f, ...patch });

  const branches = sources.branches.map((b) => b.name);
  // Counselors narrow to the chosen branch.
  const counselors = sources.staff
    .filter((s) => s.role === 'Counselor' && (!f.branch || s.branch === f.branch))
    .map((s) => s.name).sort();
  const countries = [...new Set([...sources.intakes.map((s) => s.country), ...sources.applications.map((a) => a.country)].filter(Boolean))].sort();
  const intakes = [...new Set([
    ...sources.applications.flatMap((a) => a.offerApplications.map((o) => o.intake ?? '')),
    ...sources.marketingLeads.map((l) => l.intake ?? ''),
  ].filter(Boolean))].sort((a, b) => intakeOrder(a) - intakeOrder(b));

  const setBranch = (branch: string) => {
    const keepCounselor = !f.counselor || sources.staff.some((s) => s.name === f.counselor && (!branch || s.branch === branch));
    set({ branch, counselor: keepCounselor ? f.counselor : '' });
  };

  // Chips for what's actually narrowing this view.
  const chips: { label: string; clear: Partial<GlobalFilters> }[] = [
    ...(on('branch') && f.branch ? [{ label: `Branch: ${f.branch}`, clear: { branch: '' } }] : []),
    ...(on('country') && f.country ? [{ label: `Country: ${f.country}`, clear: { country: '' } }] : []),
    ...(on('counselor') && f.counselor ? [{ label: `Counselor: ${f.counselor}`, clear: { counselor: '' } }] : []),
    ...(on('department') && f.department ? [{ label: `Department: ${f.department}`, clear: { department: '' } }] : []),
    ...(on('intake') && f.intake ? [{ label: `Intake: ${f.intake}`, clear: { intake: '' } }] : []),
  ];
  const changed = JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <section aria-label="Global filters" className="rounded-xl border border-grey-border bg-white p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Select label="Date Range" value={f.period} onChange={(v) => set({ period: v as Period })} options={PERIODS} disabled={!on('date')} note={notes?.date} />
        <Select label="Branch" value={f.branch} onChange={setBranch} all="All Branches" options={branches} disabled={!on('branch')} note={notes?.branch} />
        <Select label="Country" value={f.country} onChange={(v) => set({ country: v })} all="All Countries" options={countries} disabled={!on('country')} note={notes?.country} />
        <Select label="Counselor" value={f.counselor} onChange={(v) => set({ counselor: v })} all={f.branch ? `All in ${f.branch}` : 'All Counselors'} options={counselors} disabled={!on('counselor')} note={notes?.counselor} />
        <Select label="Department" value={f.department} onChange={(v) => set({ department: v })} all="All Departments" options={DEPARTMENTS} disabled={!on('department')} note={notes?.department} />
        <Select label="Intake" value={f.intake} onChange={(v) => set({ intake: v })} all="All Intakes" options={intakes} disabled={!on('intake')} note={notes?.intake} />
      </div>
      {on('date') && f.period === 'Custom' && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1"><span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">From</span>
            <input type="date" value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} onBlur={(e) => { const c = clampDateInput(e.target.value, { max: f.to || undefined }); if (c) set({ from: c }); }} className="h-9 rounded-lg border border-grey-border px-3 text-sm text-navy focus:border-navy-light focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">To</span>
            <input type="date" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} onBlur={(e) => { const c = clampDateInput(e.target.value, { min: f.from || undefined }); if (c) set({ to: c }); }} className="h-9 rounded-lg border border-grey-border px-3 text-sm text-navy focus:border-navy-light focus:outline-none" /></label>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full bg-navy/5 px-2.5 py-0.5 font-medium text-navy">{on('date') ? periodLabel(f) : notes?.date ?? 'Not limited by date'}</span>
        {chips.map((c) => (
          <button key={c.label} type="button" onClick={() => set(c.clear)} className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 font-medium text-sky-800 transition-colors hover:bg-sky-200">
            {c.label} <X size={11} />
          </button>
        ))}
        {changed && (
          <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="ml-auto inline-flex items-center gap-1 font-medium text-navy transition-colors hover:text-navy-light">
            <RotateCcw size={12} /> Reset to This Month · All Branches
          </button>
        )}
      </div>
    </section>
  );
}
