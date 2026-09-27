import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, History, X } from 'lucide-react';
import {
  AttendanceViewProps, DAY_LETTER, DAY_STATUS_STYLES, DayView, activeStaff, dayView, departmentOf, firstDayOf, formatMinutes, workedMinutes,
} from '../attendance';
import { timeOf } from '../branchOps';
import { dateKey } from '../dateTime';

// ─── HRM · Attendance · Employee Attendance ─────────────────────────────────
// One person's month: headline stats and a calendar where every day carries a status letter.
// Clicking a day shows that day's exact punches (and any correction) in a popover.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EmployeeAttendance({ staff, attendance, corrections, leave, holidays, intent, onNavigate }: AttendanceViewProps) {
  const now = useMemo(() => new Date(), []);
  const today = dateKey(now);
  const people = activeStaff(staff);
  const [name, setName] = useState(intent?.openStaffName && people.some((p) => p.name === intent.openStaffName) ? intent.openStaffName : people[0]?.name ?? '');
  const [month, setMonth] = useState((intent?.attendanceDate ?? today).slice(0, 7));
  const [openDay, setOpenDay] = useState<string | null>(intent?.attendanceDate ?? null);
  const member = people.find((p) => p.name === name);
  const started = firstDayOf(attendance, name);

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leadBlanks = new Date(y, m - 1, 1).getDay();

  const days: (DayView | null)[] = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    if (date > today || (started && date < started)) return null;
    return dayView(name, date, attendance, leave, now, holidays);
  }), [month, daysInMonth, name, attendance, leave, holidays, now, today, started]);

  const stats = useMemo(() => {
    const d = days.filter((x): x is DayView => !!x && x.status !== 'Not in yet');
    const present = d.filter((x) => x.status === 'Present').length;
    const late = d.filter((x) => x.status === 'Late' || x.status === 'Very Late').length;
    const absent = d.filter((x) => x.status === 'Absent').length;
    const onLeave = d.filter((x) => x.status === 'On Leave').length;
    const worked = present + late;
    const expected = worked + absent;
    return { present: worked, late, absent, onLeave, rate: expected ? Math.round((worked / expected) * 100) : null, missing: d.filter((x) => x.missingCheckOut).length };
  }, [days]);

  const shiftMonth = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setOpenDay(null);
  };
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <section className="rounded-xl border border-grey-border bg-white px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="relative inline-block">
              <select value={name} onChange={(e) => { setName(e.target.value); setOpenDay(null); }} aria-label="Employee" className="appearance-none bg-transparent pr-7 text-lg font-semibold text-navy focus:outline-none">
                {people.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            {member && <p className="text-sm text-gray-500">{member.role} · {departmentOf(member.role)} · {member.branch}</p>}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="rounded-lg border border-grey-border p-1.5 text-gray-500 hover:text-navy"><ChevronLeft size={16} /></button>
            <span className="w-36 text-center text-sm font-medium text-navy">{monthLabel}</span>
            <button type="button" onClick={() => shiftMonth(1)} disabled={month >= today.slice(0, 7)} aria-label="Next month" className="rounded-lg border border-grey-border p-1.5 text-gray-500 hover:text-navy disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Attendance rate', value: stats.rate === null ? '—' : `${stats.rate}%`, tone: stats.rate !== null && stats.rate < 90 ? 'text-amber-600' : 'text-navy' },
            { label: 'Total present', value: stats.present, tone: 'text-emerald-600' },
            { label: 'Late', value: stats.late, tone: 'text-amber-600' },
            { label: 'Absent', value: stats.absent, tone: 'text-red-600' },
            { label: 'On leave', value: stats.onLeave, tone: 'text-blue-600' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-grey-border px-3 py-2.5">
              <p className="text-[11px] text-gray-500">{s.label}</p>
              <p className={`text-xl font-semibold tabular-nums ${s.value === 0 ? 'text-gray-300' : s.tone}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Calendar */}
      <section className="rounded-xl border border-grey-border bg-white p-4">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => <p key={w} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">{w}</p>)}
          {Array.from({ length: leadBlanks }, (_, i) => <span key={`b${i}`} />)}
          {days.map((d, i) => {
            const date = `${month}-${String(i + 1).padStart(2, '0')}`;
            const isOpen = openDay === date && !!d;
            const col = (leadBlanks + i) % 7;
            return (
              <div key={date} className="relative">
                <button
                  type="button"
                  onClick={() => d && setOpenDay(isOpen ? null : date)}
                  disabled={!d}
                  aria-label={d ? `${date}: ${d.status}` : date}
                  className={`flex h-16 w-full flex-col items-start justify-between rounded-lg border p-1.5 text-left sm:h-20 sm:p-2 ${
                    isOpen ? 'border-navy' : date === today ? 'border-navy-light/50' : 'border-grey-border'
                  } ${d ? 'hover:border-navy-light' : 'cursor-default bg-grey-bg/40'}`}
                >
                  <span className={`text-xs tabular-nums ${date === today ? 'font-semibold text-navy' : d ? 'text-gray-600' : 'text-gray-300'}`}>{i + 1}</span>
                  {d && (
                    <span className="flex items-center gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${DAY_STATUS_STYLES[d.status]}`}>{DAY_LETTER[d.status]}</span>
                      {d.record?.amendments?.length ? <span className="h-1.5 w-1.5 rounded-full bg-violet-500" title="Corrected" /> : null}
                      {d.missingCheckOut && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Missing check-out" />}
                    </span>
                  )}
                </button>

                {isOpen && d && (
                  <div className={`dissolve-in absolute top-full z-20 mt-1 w-60 rounded-lg border border-grey-border bg-white p-3 ${col >= 4 ? 'right-0' : 'left-0'}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-navy">{new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                      <button type="button" onClick={() => setOpenDay(null)} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={14} /></button>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DAY_STATUS_STYLES[d.status]}`}>{d.status}{d.leave ? ` · ${d.leave.type}` : ''}{d.holiday ? ` · ${d.holiday.name}` : ''}</span>
                    <dl className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between"><dt className="text-gray-500">Check-in</dt><dd className="font-medium tabular-nums text-navy">{d.record?.checkIn ?? '—'}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Check-out</dt><dd className={`font-medium tabular-nums ${d.missingCheckOut ? 'text-amber-700' : 'text-navy'}`}>{d.record?.checkOut ?? (d.missingCheckOut ? 'Missing' : '—')}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Worked</dt><dd className="tabular-nums text-navy">{formatMinutes(workedMinutes(d.record, now))}</dd></div>
                    </dl>
                    {d.record?.amendments?.map((a) => (
                      <p key={a.id} className="mt-2 rounded bg-violet-50 px-2 py-1 text-[11px] text-violet-800">
                        {a.field === 'checkOut' ? 'Out' : 'In'} corrected {a.from ? <><s>{timeOf(a.from)}</s> → </> : ''}{timeOf(a.to)} · approved by {a.approvedBy}
                      </p>
                    ))}
                    {corrections.some((c) => c.staffName === name && c.date === date && c.status === 'Pending') && (
                      <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Correction pending approval</p>
                    )}
                    <button type="button" onClick={() => onNavigate('hr-att-history', { openStaffName: name, attendanceDate: date })} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-navy-light hover:text-navy">
                      <History size={11} /> Full audit trail
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 border-t border-grey-border pt-3 text-[11px] text-gray-500">
          {(['Present', 'Late', 'Absent', 'Off', 'On Leave', 'Holiday'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${DAY_STATUS_STYLES[s]}`}>{DAY_LETTER[s]}</span>{s}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" />Corrected</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Missing check-out</span>
        </div>
      </section>
    </div>
  );
}
