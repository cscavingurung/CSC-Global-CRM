import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle, ChevronLeft, ChevronRight, Info, LayoutGrid, List, Pencil, Plus, Repeat, Trash2, X } from 'lucide-react';
import { Holiday, HolidayType, MockUser } from '../types';
import { HOLIDAY_TYPES, HOLIDAY_TYPE_STYLES, appliesToBranch, dayCount, occurrenceIn } from '../holidays';
import { clampDateInput, dateKey } from '../dateTime';

// ─── HRM · Holidays ─────────────────────────────────────────────────────────
// Two views only: a read-only Holiday Calendar (everyone) and Manage Holidays (manager).
//
// Integration: holidays live in one list that Attendance and Leave both read.
//  • Attendance — `dayView` returns "Holiday" for these dates, so nobody is marked Absent,
//    and Branch Operations Control doesn't flag anyone for not checking in.
//  • Leave — `workingDaysBetween` / `leaveDays` skip these dates, so leave overlapping a
//    holiday is never deducted, including requests approved before the holiday was added.
// Saving here is all it takes; nothing else has to be updated.

type Tab = 'Holiday Calendar' | 'Manage Holidays';
type CalendarView = 'list' | 'calendar';

/** Remembers List vs Calendar per browser — a convenience only, so failures are ignored. */
const VIEW_KEY = 'csc:holidayView';
const readView = (): CalendarView => {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list';
  } catch {
    return 'list';
  }
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface HolidaysPageProps {
  currentUser: MockUser;
  /** Every holiday (all branches) — the calendar shows only the viewer's branch. */
  holidays: Holiday[];
  branches: string[];
  mode: 'manager' | 'employee';
  onSave: (h: Holiday) => void;
  onRemove: (id: string) => void;
}

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

const fmt = (key: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', opts);
const rangeText = (from: string, to: string) => (from === to ? fmt(from, { weekday: 'short', day: 'numeric', month: 'short' }) : `${fmt(from)} – ${fmt(to)}`);
const appliesText = (h: Holiday) => (h.appliesTo === 'All' ? 'All CSC branches' : h.appliesTo.join(', '));

function TypePill({ type }: { type: HolidayType }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${HOLIDAY_TYPE_STYLES[type]}`}>{type}</span>;
}

interface Draft {
  id?: string;
  name: string;
  type: HolidayType;
  from: string;
  to: string;
  multi: boolean;
  repeatsAnnually: boolean;
  scope: 'All' | 'Selected';
  branches: string[];
}

export default function HolidaysPage({ currentUser, holidays, branches, mode, onSave, onRemove }: HolidaysPageProps) {
  const today = dateKey(new Date());
  const [year, setYear] = useState(new Date().getFullYear());
  const isManager = mode === 'manager';
  const tabs: Tab[] = isManager ? ['Holiday Calendar', 'Manage Holidays'] : ['Holiday Calendar'];
  const [tab, setTab] = useState<Tab>('Holiday Calendar');
  const [toast, setToast] = useState('');
  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 4500);
  };

  // ── Calendar: this branch's holidays in the chosen year, in date order ──
  const occurrences = useMemo(() => holidays
    .filter((h) => appliesToBranch(h, currentUser.branch))
    .map((h) => ({ h, at: occurrenceIn(h, year) }))
    .filter((x): x is { h: Holiday; at: { from: string; to: string } } => !!x.at)
    .sort((a, b) => a.at.from.localeCompare(b.at.from)), [holidays, currentUser.branch, year]);
  const next = occurrences.find((o) => o.at.to >= today);
  const daysUntil = next ? Math.round((new Date(`${next.at.from}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000) : null;
  const byMonth = occurrences.reduce<Record<string, typeof occurrences>>((m, o) => {
    const k = o.at.from.slice(0, 7);
    (m[k] ??= []).push(o);
    return m;
  }, {});
  const totalDays = occurrences.reduce((n, o) => n + dayCount(o.at.from, o.at.to), 0);

  // ── Calendar view: every holiday date this year → its holiday ──
  const [view, setView] = useState<CalendarView>(readView);
  const chooseView = (v: CalendarView) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage unavailable — the choice still applies for this visit */
    }
  };
  const byDate = useMemo(() => {
    const map = new Map<string, (typeof occurrences)[number]>();
    occurrences.forEach((o) => {
      const d = new Date(`${o.at.from}T00:00:00`);
      const end = new Date(`${o.at.to}T00:00:00`);
      while (d <= end) {
        map.set(dateKey(d), o);
        d.setDate(d.getDate() + 1);
      }
    });
    return map;
  }, [occurrences]);
  const [picked, setPicked] = useState<string | null>(null);
  // Detail strip: the clicked holiday, else the next upcoming one.
  const shown = (picked && byDate.get(picked)) || (year === new Date().getFullYear() ? next : occurrences[0]);

  // ── Manage ──
  const blank: Draft = { name: '', type: 'National', from: today, to: today, multi: false, repeatsAnnually: false, scope: 'All', branches: [currentUser.branch] };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const edit = (h: Holiday) => setDraft({
    id: h.id, name: h.name, type: h.type, from: h.from, to: h.to, multi: h.from !== h.to, repeatsAnnually: h.repeatsAnnually,
    scope: h.appliesTo === 'All' ? 'All' : 'Selected', branches: h.appliesTo === 'All' ? [currentUser.branch] : h.appliesTo,
  });
  const draftTo = draft ? (draft.multi ? draft.to : draft.from) : '';
  const draftError = !draft ? null
    : !draft.name.trim() ? 'Give the holiday a name.'
      : !draft.from || draftTo < draft.from ? 'Check the dates — the end is before the start.'
        : draft.scope === 'Selected' && draft.branches.length === 0 ? 'Choose at least one branch.' : null;
  const save = () => {
    if (!draft || draftError) return;
    const h: Holiday = {
      id: draft.id ?? `hol-${Date.now()}`, name: draft.name.trim(), type: draft.type, from: draft.from, to: draftTo,
      repeatsAnnually: draft.repeatsAnnually, appliesTo: draft.scope === 'All' ? 'All' : draft.branches, createdBy: currentUser.name,
    };
    onSave(h);
    setDraft(null);
    flash(`${h.name} saved — Attendance now shows ${rangeText(h.from, h.to)} as Holiday (no one marked Absent), and leave on ${h.from === h.to ? 'that day' : 'those days'} isn’t deducted.`);
  };
  const manageRows = [...holidays].sort((a, b) => a.from.localeCompare(b.from));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 border-b border-grey-border">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-navy'}`}>
              {t}
            </button>
          ))}
        </div>
        {tab === 'Holiday Calendar' && (
          <div className="mb-1 ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setYear(year - 1)} aria-label="Previous year" className="rounded-lg border border-grey-border p-1.5 text-gray-500 hover:text-navy"><ChevronLeft size={15} /></button>
            <span className="w-14 text-center text-sm font-semibold tabular-nums text-navy">{year}</span>
            <button type="button" onClick={() => setYear(year + 1)} aria-label="Next year" className="rounded-lg border border-grey-border p-1.5 text-gray-500 hover:text-navy"><ChevronRight size={15} /></button>
          </div>
        )}
      </div>

      <div key={tab} className="dissolve-in">
        {tab === 'Holiday Calendar' ? (
          <div className="max-w-6xl space-y-4">
            {/* Same width in both views, so the List / Calendar switch never moves. */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-gray-500">{occurrences.length} holidays · {totalDays} days off in {year} for the {currentUser.branch} branch</p>
              {next && year === new Date().getFullYear() && (
                <p className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                  Next: {next.h.name} {daysUntil! <= 0 ? '— today' : `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`}
                </p>
              )}
              <div className="inline-flex self-start rounded-lg border border-grey-border bg-white p-0.5" role="group" aria-label="Holiday view">
                {([['list', 'List', <List key="l" size={14} />], ['calendar', 'Calendar', <LayoutGrid key="c" size={14} />]] as const).map(([v, label, icon]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => chooseView(v)}
                    aria-pressed={view === v}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${view === v ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
            {occurrences.length === 0 && <p className="rounded-xl border border-grey-border bg-white py-12 text-center text-sm text-gray-400">No holidays set for {year}.</p>}

            {view === 'calendar' && (
              <div key={`cal-${year}`} className="dissolve-in space-y-4">
                {/* Selected (or next) holiday */}
                {shown && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-grey-border bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-navy">{shown.h.name}</span>
                    <span className="text-sm text-gray-500">
                      {rangeText(shown.at.from, shown.at.to)}{shown.at.from !== shown.at.to && ` · ${dayCount(shown.at.from, shown.at.to)} days`}
                    </span>
                    {shown.h.repeatsAnnually && <span className="inline-flex items-center gap-0.5 text-xs text-gray-400"><Repeat size={11} /> every year</span>}
                    <TypePill type={shown.h.type} />
                    {!picked && <span className="text-xs text-gray-400">{year === new Date().getFullYear() ? 'Next up — click any highlighted day for details' : 'Click any highlighted day for details'}</span>}
                    {picked && <button type="button" onClick={() => setPicked(null)} aria-label="Clear selection" className="ml-auto text-gray-400 hover:text-navy"><X size={15} /></button>}
                  </div>
                )}

                {/* Year at a glance */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 12 }, (_, m) => {
                    const first = new Date(year, m, 1);
                    const days = new Date(year, m + 1, 0).getDate();
                    const monthHolidays = new Set(Array.from({ length: days }, (_, i) => byDate.get(dateKey(new Date(year, m, i + 1)))?.h.id).filter(Boolean));
                    return (
                      <section key={m} className="rounded-xl border border-grey-border bg-white p-3">
                        <div className="mb-2 flex items-baseline justify-between">
                          <p className="text-sm font-semibold text-navy">{first.toLocaleDateString('en-GB', { month: 'long' })}</p>
                          {monthHolidays.size > 0 && <p className="text-[11px] text-gray-400">{monthHolidays.size} holiday{monthHolidays.size === 1 ? '' : 's'}</p>}
                        </div>
                        <div className="grid grid-cols-7 gap-0.5 text-center">
                          {WEEKDAYS.map((w, i) => <span key={i} className="pb-1 text-[10px] font-semibold text-gray-400">{w}</span>)}
                          {Array.from({ length: first.getDay() }, (_, i) => <span key={`b${i}`} />)}
                          {Array.from({ length: days }, (_, i) => {
                            const d = new Date(year, m, i + 1);
                            const key = dateKey(d);
                            const occ = byDate.get(key);
                            const isToday = key === today;
                            const sel = picked && occ && byDate.get(picked)?.h.id === occ.h.id;
                            if (!occ) {
                              return (
                                <span
                                  key={key}
                                  className={`flex h-7 items-center justify-center rounded text-xs tabular-nums ${isToday ? 'font-semibold text-navy ring-1 ring-navy' : d.getDay() === 6 ? 'text-gray-300' : 'text-gray-600'}`}
                                >
                                  {i + 1}
                                </span>
                              );
                            }
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setPicked(key)}
                                title={`${occ.h.name} · ${occ.h.type}`}
                                aria-label={`${fmt(key, { day: 'numeric', month: 'long' })}: ${occ.h.name}`}
                                aria-pressed={!!sel}
                                className={`flex h-7 items-center justify-center rounded text-xs font-semibold tabular-nums ${HOLIDAY_TYPE_STYLES[occ.h.type]} ${sel ? 'ring-2 ring-navy' : isToday ? 'ring-1 ring-navy' : 'hover:ring-1 hover:ring-navy-light'}`}
                              >
                                {i + 1}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                  {HOLIDAY_TYPES.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm ${HOLIDAY_TYPE_STYLES[t]}`} />{t}</span>
                  ))}
                  <span className="inline-flex items-center gap-1.5"><span className="text-gray-300">31</span> Saturday — weekly day off</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm ring-1 ring-navy" /> Today</span>
                </div>
              </div>
            )}

            {view === 'list' && Object.entries(byMonth).map(([month, list]) => (
              <section key={month} className="rounded-xl border border-grey-border bg-white">
                <p className="border-b border-grey-border px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{fmt(`${month}-01`, { month: 'long', year: 'numeric' })}</p>
                <ul className="divide-y divide-grey-border">
                  {list.map(({ h, at }) => {
                    const past = at.to < today;
                    const now = at.from <= today && today <= at.to;
                    return (
                      <li key={h.id} className={`flex items-center gap-4 px-5 py-3 ${past ? 'opacity-50' : ''}`}>
                        <div className={`flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-lg border ${now ? 'border-navy bg-navy text-white' : 'border-grey-border text-navy'}`}>
                          <span className="text-lg font-semibold leading-none tabular-nums">{Number(at.from.slice(8))}</span>
                          <span className={`text-[10px] uppercase ${now ? 'text-white/70' : 'text-gray-400'}`}>{fmt(at.from, { weekday: 'short' })}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-navy">{h.name}</p>
                          <p className="text-xs text-gray-500">
                            {rangeText(at.from, at.to)}{at.from !== at.to && ` · ${dayCount(at.from, at.to)} days`}
                            {h.repeatsAnnually && <span className="ml-1.5 inline-flex items-center gap-0.5 text-gray-400"><Repeat size={10} /> every year</span>}
                          </p>
                        </div>
                        {now && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">Today</span>}
                        <TypePill type={h.type} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <Info size={18} className="mt-0.5 flex-shrink-0 text-blue-700" />
              <div>
                <p className="font-semibold">Saving a holiday updates Attendance and Leave automatically.</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-blue-800">
                  <li>Attendance shows those dates as <b>Holiday</b> for the branches it applies to — nobody is marked Absent.</li>
                  <li>Leave that overlaps a holiday isn’t deducted from anyone’s balance, including leave already approved.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{holidays.length} holidays across all branches</p>
              <button type="button" onClick={() => setDraft(blank)} className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">
                <Plus size={16} /> Add Holiday
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="bg-grey-bg text-left">
                    {['Holiday', 'Date', 'Days', 'Type', 'Repeats', 'Applies to', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {manageRows.map((h) => (
                    <tr key={h.id} className="border-t border-grey-border">
                      <td className="px-4 py-2.5 text-sm font-medium text-navy">{h.name}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">{rangeText(h.from, h.to)} {h.from.slice(0, 4)}</td>
                      <td className="px-4 py-2.5 text-sm tabular-nums text-gray-600">{dayCount(h.from, h.to)}</td>
                      <td className="px-4 py-2.5"><TypePill type={h.type} /></td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{h.repeatsAnnually ? 'Every year' : '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">
                        {appliesText(h)}
                        {!appliesToBranch(h, currentUser.branch) && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">not {currentUser.branch}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        {confirmRemove === h.id ? (
                          <span className="inline-flex items-center gap-2 text-xs">
                            <span className="text-gray-500">Remove?</span>
                            <button type="button" onClick={() => setConfirmRemove(null)} className="rounded-md border border-grey-border px-2 py-1 text-navy">Cancel</button>
                            <button type="button" onClick={() => { onRemove(h.id); setConfirmRemove(null); flash(`${h.name} removed — those dates count as working days again.`); }} className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700">Remove</button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-1">
                            <button type="button" onClick={() => edit(h)} aria-label={`Edit ${h.name}`} className="rounded-md p-1.5 text-gray-400 hover:bg-grey-bg hover:text-navy"><Pencil size={15} /></button>
                            <button type="button" onClick={() => setConfirmRemove(h.id)} aria-label={`Remove ${h.name}`} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / edit */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setDraft(null)} />
          <div className="dissolve-in relative w-full max-w-md rounded-2xl border border-grey-border bg-white">
            <div className="flex items-center justify-between border-b border-grey-border px-6 py-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-navy"><CalendarDays size={18} /> {draft.id ? 'Edit Holiday' : 'Add Holiday'}</h3>
              <button type="button" onClick={() => setDraft(null)} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="hol-name" className="mb-1.5 block text-xs font-semibold text-navy">Holiday name</label>
                <input id="hol-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} placeholder="e.g. Dashain" />
              </div>
              <div>
                <label htmlFor="hol-type" className="mb-1.5 block text-xs font-semibold text-navy">Type</label>
                <select id="hol-type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as HolidayType })} className={inputClass}>
                  {HOLIDAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-navy">Date</span>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" checked={draft.multi} onChange={(e) => setDraft({ ...draft, multi: e.target.checked, to: e.target.checked && draft.to < draft.from ? draft.from : draft.to })} className="h-3.5 w-3.5 accent-navy" />
                    Several days
                  </label>
                </div>
                <div className={`grid gap-2 ${draft.multi ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value, to: draft.to < e.target.value ? e.target.value : draft.to })} className={inputClass} aria-label="From" />
                  {draft.multi && <input type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft({ ...draft, to: e.target.value })} onBlur={(e) => { const c = clampDateInput(e.target.value, { min: draft.from }); if (c) setDraft({ ...draft, to: c }); }} className={inputClass} aria-label="To" />}
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={draft.repeatsAnnually} onChange={(e) => setDraft({ ...draft, repeatsAnnually: e.target.checked })} className="mt-0.5 h-4 w-4 accent-navy" />
                <span>
                  <span className="block text-sm text-navy">Repeat annually</span>
                  <span className="block text-xs text-gray-400">Same date every year. Leave off for festivals that move, like Dashain and Tihar.</span>
                </span>
              </label>
              <div>
                <label htmlFor="hol-scope" className="mb-1.5 block text-xs font-semibold text-navy">Applies to</label>
                <select id="hol-scope" value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as Draft['scope'] })} className={inputClass}>
                  <option value="All">All CSC Branches</option>
                  <option value="Selected">Selected Branches</option>
                </select>
                {draft.scope === 'Selected' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {branches.map((b) => {
                      const on = draft.branches.includes(b);
                      return (
                        <label key={b} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm ${on ? 'border-navy-light bg-navy/5 text-navy' : 'border-grey-border text-gray-600'}`}>
                          <input type="checkbox" checked={on} onChange={() => setDraft({ ...draft, branches: on ? draft.branches.filter((x) => x !== b) : [...draft.branches, b] })} className="h-3.5 w-3.5 accent-navy" />
                          {b}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {draftError && draft.name && <p className="text-xs text-red-600">{draftError}</p>}
            </div>
            <div className="flex gap-3 border-t border-grey-border px-6 py-4">
              <button type="button" onClick={() => setDraft(null)} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
              <button type="button" onClick={save} disabled={!!draftError} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40">Save holiday</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} aria-label="Dismiss" className="ml-1 text-white/80 hover:text-white"><X size={15} /></button>
        </div>
      )}
    </div>
  );
}
