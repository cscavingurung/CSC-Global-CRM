import { useMemo, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import {
  AttendanceViewProps, DAY_STATUS_STYLES, DEPARTMENTS, DayStatus, activeStaff, datesBetween, dayView, departmentOf, firstDayOf,
  formatMinutes, managerCorrection, workedMinutes,
} from '../attendance';
import { timeOf } from '../branchOps';
import { dateKey } from '../dateTime';
import CompactDateRangeFilter from './CompactDateRangeFilter';
import AttendanceRecordPanel from './AttendanceRecordPanel';

// ─── HRM · Attendance · Attendance History ──────────────────────────────────
// Every employee-day in a range, searchable, with a full audit panel per record.

const PAGE = 25;
const STATUS_FILTERS: (DayStatus | 'Corrected' | 'Missing check-out')[] = ['Present', 'Late', 'Very Late', 'Absent', 'On Leave', 'Missing check-out', 'Corrected'];

const shortDate = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export default function AttendanceHistory({ currentUser, staff, attendance, corrections, leave, holidays, intent, onAddCorrection, onNavigate }: AttendanceViewProps) {
  const now = useMemo(() => new Date(), []);
  const today = dateKey(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [from, setFrom] = useState(intent?.attendanceDate ?? monthStart);
  const [to, setTo] = useState(intent?.attendanceDate ?? today);
  const [employee, setEmployee] = useState(intent?.openStaffName ?? '');
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ name: string; date: string } | null>(
    intent?.openStaffName && intent.attendanceDate ? { name: intent.openStaffName, date: intent.attendanceDate } : null
  );

  const people = activeStaff(staff);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const dates = datesBetween(from || monthStart, to || today).filter((d) => d <= today).reverse();
    return dates.flatMap((date) =>
      people
        .filter((p) => (!employee || p.name === employee) && (!dept || departmentOf(p.role) === dept))
        .filter((p) => !term || `${p.name} ${p.role}`.toLowerCase().includes(term))
        .filter((p) => (firstDayOf(attendance, p.name) ?? date) <= date)
        .map((p) => ({ member: p, day: dayView(p.name, date, attendance, leave, now, holidays) }))
        .filter(({ day }) => day.status !== 'Off' && day.status !== 'Not in yet' && day.status !== 'Holiday')
        .filter(({ day }) =>
          !status ? true
          : status === 'Corrected' ? !!day.record?.amendments?.length
          : status === 'Missing check-out' ? day.missingCheckOut
          : day.status === status
        )
    );
  }, [from, to, employee, dept, status, search, attendance, leave, holidays, people, now, today, monthStart]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * PAGE, current * PAGE);
  const sel = selected && rows.find((r) => r.member.name === selected.name && r.day.date === selected.date);
  const selDay = sel?.day ?? (selected ? dayView(selected.name, selected.date, attendance, leave, now, holidays) : null);
  const anyFilter = employee || dept || status || search || from !== monthStart || to !== today;

  const selectClass = 'appearance-none rounded-lg border border-grey-border bg-white py-2.5 pl-3 pr-8 text-sm text-navy focus:border-navy-light focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
        <div className="relative min-w-[200px] flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search employee or role" className="w-full rounded-lg border border-grey-border bg-white py-2.5 pl-10 pr-3 text-sm focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light" />
        </div>
        <CompactDateRangeFilter from={from} to={to} onFromChange={(v) => { setFrom(v); setPage(1); }} onToChange={(v) => { setTo(v); setPage(1); }} />
        <select value={employee} onChange={(e) => { setEmployee(e.target.value); setPage(1); }} aria-label="Employee" className={selectClass}>
          <option value="">All employees</option>
          {people.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <select value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }} aria-label="Department" className={selectClass}>
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className={selectClass}>
          <option value="">All statuses</option>
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{rows.length} record{rows.length === 1 ? '' : 's'} · {from ? shortDate(from) : ''} – {to ? shortDate(to) : ''}</span>
        {anyFilter && (
          <button type="button" onClick={() => { setEmployee(''); setDept(''); setStatus(''); setSearch(''); setFrom(monthStart); setTo(today); }} className="inline-flex items-center gap-1 font-medium text-navy-light hover:text-navy">
            <X size={12} /> Reset filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="bg-grey-bg text-left">
              {['Date', 'Employee', 'Department', 'Check-in', 'Check-out', 'Hours', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ member, day }) => (
              <tr key={`${day.date}-${member.id}`} onClick={() => setSelected({ name: member.name, date: day.date })} className="cursor-pointer border-t border-grey-border hover:bg-grey-bg/50">
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-navy">{day.date === today ? 'Today' : shortDate(day.date)}</td>
                <td className="px-4 py-2.5 text-sm font-medium text-navy">{member.name}</td>
                <td className="px-4 py-2.5 text-sm text-gray-600">{departmentOf(member.role)}</td>
                <td className="px-4 py-2.5 text-sm tabular-nums text-gray-600">{timeOf(day.record?.checkIn) || '—'}</td>
                <td className={`px-4 py-2.5 text-sm tabular-nums ${day.missingCheckOut ? 'font-medium text-amber-700' : 'text-gray-600'}`}>
                  {timeOf(day.record?.checkOut) || (day.missingCheckOut ? 'Missing' : '—')}
                </td>
                <td className="px-4 py-2.5 text-sm tabular-nums text-gray-500">{day.record?.checkOut ? formatMinutes(workedMinutes(day.record, now)) : '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DAY_STATUS_STYLES[day.status]}`}>{day.status}</span>
                  {day.record?.amendments?.length ? <span className="ml-1.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">corrected</span> : null}
                </td>
                <td className="px-3 py-2.5 text-gray-300"><ChevronRight size={16} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No records match these filters.</p>}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Page {current} of {pages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className="rounded-lg border border-grey-border bg-white px-3 py-1.5 text-sm text-navy disabled:opacity-40">Prev</button>
            <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)} className="rounded-lg border border-grey-border bg-white px-3 py-1.5 text-sm text-navy disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {selDay && selected && (
        <AttendanceRecordPanel
          day={selDay}
          member={people.find((p) => p.name === selected.name)}
          corrections={corrections.filter((c) => c.staffName === selected.name && c.date === selected.date)}
          now={now}
          onClose={() => setSelected(null)}
          onRequestCorrection={selDay.status === 'Off' || selDay.status === 'On Leave' ? undefined
            : (field, time, reason) => onAddCorrection(managerCorrection(currentUser, selected.name, selected.date, field, time, reason))}
          onOpenEmployee={() => onNavigate('hr-att-employee', { openStaffName: selected.name, attendanceDate: selected.date })}
        />
      )}
    </div>
  );
}
