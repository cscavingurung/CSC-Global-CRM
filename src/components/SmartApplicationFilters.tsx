import { useState } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown, AlertCircle, Undo2 } from 'lucide-react';
import CompactDateRangeFilter from './CompactDateRangeFilter';
import {
  EMPTY_SMART_FILTERS, MILESTONE_LABELS, MilestoneKey, QUICK_LABELS, QuickKey, STATUS_SHORT_LABELS, SmartFilters,
} from '../applicationFilters';
import { INTAKE_MONTHS } from '../mockData';

interface SmartApplicationFiltersProps {
  filters: SmartFilters;
  onChange: (next: SmartFilters) => void;
  /** Status chips with live counts (counted with every other filter applied). */
  statuses: { value: string; count: number }[];
  /** Total rows matching everything but the status chips — the "All" chip's count. */
  allCount: number;
  quick: { key: QuickKey; count: number }[];
  options: { counselors: string[]; countries: string[]; caseTypes: string[]; institutions: string[]; intakes: string[]; intakeYears: string[] };
  /** Pipeline scope (Branch Manager): Offer / Visa / Closed stage tabs that reveal their own
   * status chips, plus milestone, intake month/year and visa decision date in the panel. */
  statusGroups?: { label: string; values: string[] }[];
  /** Hide the counselor / institution selects where they don't apply. */
  showInstitution: boolean;
  /** Sort control, rendered at the end of the search row. */
  sortControl: React.ReactNode;
  onUseClassic: () => void;
}

const selectClass = 'w-full appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

function PanelSelect({ label, value, onChange, options, anyLabel, optionLabels }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; anyLabel: string; optionLabels?: Record<string, string>;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-navy mb-1.5">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
          <option value="">{anyLabel}</option>
          {options.map((o) => <option key={o} value={o}>{optionLabels?.[o] ?? o}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
      </div>
    </div>
  );
}

/**
 * V/A Officer / Branch Manager filter bar: search, status chips with counts, "needs attention" shortcuts, and a
 * collapsible panel for everything else. Active panel filters show as removable chips.
 */
export default function SmartApplicationFilters({
  filters, onChange, statuses, allCount, quick, options, showInstitution, sortControl, onUseClassic, statusGroups,
}: SmartApplicationFiltersProps) {
  const pipeline = !!statusGroups;
  const [panelOpen, setPanelOpen] = useState(false);
  const set = (patch: Partial<SmartFilters>) => onChange({ ...filters, ...patch });

  const toggleStatus = (value: string) =>
    set({ statuses: filters.statuses.includes(value) ? filters.statuses.filter((s) => s !== value) : [...filters.statuses, value] });
  // Pipeline scope: the stage tab whose statuses are selected (null = All).
  const openGroup = statusGroups?.find(
    (g) => filters.statuses.length > 0 && filters.statuses.every((v) => g.values.includes(v))
  ) ?? null;
  const wholeStage = !!openGroup && openGroup.values.every((v) => filters.statuses.includes(v));
  const countOf = (values: string[]) => statuses.filter((s) => values.includes(s.value)).reduce((n, s) => n + s.count, 0);
  // Picking a status inside a stage narrows to it; picking more adds them; clearing the last
  // one goes back to the whole stage.
  const pickStageStatus = (value: string) => {
    if (!openGroup) return;
    if (wholeStage) return set({ statuses: [value] });
    const next = filters.statuses.includes(value) ? filters.statuses.filter((v) => v !== value) : [...filters.statuses, value];
    set({ statuses: next.length > 0 ? next : openGroup.values });
  };
  const toggleQuick = (key: QuickKey) =>
    set({ quick: filters.quick.includes(key) ? filters.quick.filter((q) => q !== key) : [...filters.quick, key] });

  // Panel filters shown as removable chips under the bar.
  const activeChips: { label: string; clear: Partial<SmartFilters> }[] = [
    filters.counselor && { label: `Counselor: ${filters.counselor}`, clear: { counselor: '' } },
    filters.country && { label: `Country: ${filters.country}`, clear: { country: '' } },
    filters.caseType && { label: `Case: ${filters.caseType}`, clear: { caseType: '' } },
    filters.institution && { label: filters.institution, clear: { institution: '' } },
    filters.intake && { label: `Intake: ${filters.intake}`, clear: { intake: '' } },
    filters.universityClientId && { label: `University Client ID: ${filters.universityClientId}`, clear: { universityClientId: '' } },
    (filters.intakeMonth || filters.intakeYear) && {
      label: `Intake: ${[filters.intakeMonth || 'Any month', filters.intakeYear || 'any year'].join(' ')}`,
      clear: { intakeMonth: '', intakeYear: '' },
    },
    filters.milestone && { label: `Reached: ${MILESTONE_LABELS[filters.milestone]}`, clear: { milestone: '' } },
    (filters.decisionFrom || filters.decisionTo) && {
      label: `Visa decided: ${filters.decisionFrom || '…'} → ${filters.decisionTo || '…'}`,
      clear: { decisionFrom: '', decisionTo: '' },
    },
    (filters.dateFrom || filters.dateTo) && {
      label: `Submitted: ${filters.dateFrom || '…'} → ${filters.dateTo || '…'}`,
      clear: { dateFrom: '', dateTo: '' },
    },
  ].filter(Boolean) as { label: string; clear: Partial<SmartFilters> }[];

  const anyActive = activeChips.length > 0 || filters.statuses.length > 0 || filters.quick.length > 0 || !!filters.search;

  return (
    <div className="space-y-3">
      {/* Search row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search client, Client ID, University Client ID, phone, email or institution"
            className="w-full pl-10 pr-9 py-2.5 border border-grey-border rounded-lg text-sm bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light"
          />
          {filters.search && (
            <button onClick={() => set({ search: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy" aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${
            panelOpen || activeChips.length > 0 ? 'border-navy-light bg-navy/5 text-navy' : 'border-grey-border bg-white text-navy hover:bg-grey-bg'
          }`}
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeChips.length > 0 && (
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-navy text-white leading-none">{activeChips.length}</span>
          )}
        </button>
        {sortControl}
      </div>

      {/* Status chips — pipeline scope shows stage tabs first, then that stage's statuses */}
      {pipeline ? (
        <div className="space-y-2">
          <div className="inline-flex flex-wrap rounded-lg border border-grey-border bg-white p-0.5">
            {[{ label: 'All', values: [] as string[] }, ...statusGroups!].map((group) => {
              const active = group.values.length === 0 ? openGroup === null : openGroup?.label === group.label;
              const count = group.values.length === 0 ? allCount : countOf(group.values);
              return (
                <button
                  key={group.label}
                  type="button"
                  onClick={() => set({ statuses: group.values })}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    active ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'
                  }`}
                >
                  {group.label}
                  <span className={`text-xs ${active ? 'text-white/70' : 'text-gray-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          {openGroup && (
            <div key={openGroup.label} className="dissolve-in flex gap-2 overflow-x-auto pb-1 -mb-1">
              {statuses.filter((s) => openGroup.values.includes(s.value)).map((s) => {
                // With the whole stage selected, no single status chip is highlighted.
                const active = !wholeStage && filters.statuses.includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => pickStageStatus(s.value)}
                    aria-pressed={active}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${
                      active ? 'bg-navy/10 text-navy border-navy-light' : 'bg-white border-grey-border text-gray-600 hover:text-navy hover:border-navy-light'
                    } ${s.count === 0 && !active ? 'opacity-50' : ''}`}
                  >
                    {STATUS_SHORT_LABELS[s.value] ?? s.value}
                    <span className={active ? 'text-navy/60' : 'text-gray-400'}>{s.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
        <button
          type="button"
          onClick={() => set({ statuses: [] })}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${
            filters.statuses.length === 0 ? 'bg-navy text-white border-navy' : 'bg-white border-grey-border text-gray-600 hover:text-navy hover:border-navy-light'
          }`}
        >
          All <span className={filters.statuses.length === 0 ? 'text-white/70' : 'text-gray-400'}>{allCount}</span>
        </button>
        {statuses.map((s) => {
          const active = filters.statuses.includes(s.value);
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleStatus(s.value)}
              aria-pressed={active}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${
                active ? 'bg-navy/10 text-navy border-navy-light' : 'bg-white border-grey-border text-gray-600 hover:text-navy hover:border-navy-light'
              } ${s.count === 0 && !active ? 'opacity-50' : ''}`}
            >
              {STATUS_SHORT_LABELS[s.value] ?? s.value}
              <span className={active ? 'text-navy/60' : 'text-gray-400'}>{s.count}</span>
            </button>
          );
        })}
      </div>
      )}

      {/* Needs attention */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 mr-1">
          <AlertCircle size={13} /> Needs attention
        </span>
        {quick.map((q) => {
          const active = filters.quick.includes(q.key);
          return (
            <button
              key={q.key}
              type="button"
              onClick={() => toggleQuick(q.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                active ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-600 border-grey-border hover:text-navy hover:border-navy-light'
              }`}
            >
              {QUICK_LABELS[q.key]}
              <span className={`${active ? 'text-amber-600' : q.count > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{q.count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters panel */}
      {panelOpen && (
        <div className="dissolve-in bg-white rounded-xl border border-grey-border p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <PanelSelect label="Counselor" value={filters.counselor} onChange={(v) => set({ counselor: v })} options={options.counselors} anyLabel="Any counselor" />
            <PanelSelect label="Destination country" value={filters.country} onChange={(v) => set({ country: v })} options={options.countries} anyLabel="Any country" />
            <PanelSelect label="Case type" value={filters.caseType} onChange={(v) => set({ caseType: v })} options={options.caseTypes} anyLabel="Any case type" />
            {showInstitution && (
              <PanelSelect label="Institution" value={filters.institution} onChange={(v) => set({ institution: v })} options={options.institutions} anyLabel="Any institution" />
            )}
            {pipeline ? (
              <div className="grid grid-cols-2 gap-2">
                <PanelSelect label="Intake month" value={filters.intakeMonth} onChange={(v) => set({ intakeMonth: v })} options={INTAKE_MONTHS} anyLabel="Any month" />
                <PanelSelect label="Intake year" value={filters.intakeYear} onChange={(v) => set({ intakeYear: v })} options={options.intakeYears} anyLabel="Any year" />
              </div>
            ) : (
              <PanelSelect label="Intake" value={filters.intake} onChange={(v) => set({ intake: v })} options={options.intakes} anyLabel="Any intake" />
            )}
            <div>
              <label htmlFor="smart-university-id" className="block text-xs font-semibold text-navy mb-1.5">University Client ID <span className="font-normal text-gray-400">(from the institution)</span></label>
              <input
                id="smart-university-id"
                value={filters.universityClientId}
                onChange={(e) => set({ universityClientId: e.target.value })}
                placeholder="e.g. STU880012"
                className="w-full rounded-lg border border-grey-border bg-white px-3 py-2.5 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
              />
            </div>
            {pipeline && (
              <PanelSelect
                label="Has reached"
                value={filters.milestone}
                onChange={(v) => set({ milestone: v as MilestoneKey | '' })}
                options={Object.keys(MILESTONE_LABELS)}
                optionLabels={MILESTONE_LABELS}
                anyLabel="Any point in the pipeline"
              />
            )}
            <div>
              <p className="block text-xs font-semibold text-navy mb-1.5">Submitted date</p>
              <CompactDateRangeFilter
                from={filters.dateFrom}
                to={filters.dateTo}
                onFromChange={(v) => set({ dateFrom: v })}
                onToChange={(v) => set({ dateTo: v })}
              />
            </div>
            {pipeline && (
              <div>
                <p className="block text-xs font-semibold text-navy mb-1.5">Visa decision date</p>
                <CompactDateRangeFilter
                  from={filters.decisionFrom}
                  to={filters.decisionTo}
                  onFromChange={(v) => set({ decisionFrom: v })}
                  onToChange={(v) => set({ decisionTo: v })}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active chips + reset / revert */}
      <div className="flex flex-wrap items-center gap-2 min-h-[24px]">
        {activeChips.map((chip) => (
          <span key={chip.label} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-navy/10 text-navy text-xs font-medium">
            {chip.label}
            <button type="button" onClick={() => set(chip.clear)} className="rounded-full p-0.5 hover:bg-navy/10" aria-label={`Remove ${chip.label}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        {anyActive && (
          <button type="button" onClick={() => onChange(EMPTY_SMART_FILTERS)} className="text-xs font-medium text-navy-light hover:text-navy">
            Clear all
          </button>
        )}
        <button type="button" onClick={onUseClassic} className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400 hover:text-navy">
          <Undo2 size={12} /> Use classic filters
        </button>
      </div>
    </div>
  );
}
