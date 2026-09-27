import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import {
  AttendanceViewProps, DAY_STATUS_STYLES, DEPARTMENTS, activeStaff, dayView, departmentOf, formatMinutes, managerCorrection, workedMinutes,
} from '../attendance';
import { ON_TIME_GRACE, SHIFT_LABEL, timeOf } from '../branchOps';
import { dateKey } from '../dateTime';
import AttendanceRecordPanel from './AttendanceRecordPanel';

// ─── HRM · Attendance · Today's Attendance ──────────────────────────────────
// Live view of today. Status is automatic: on time within the grace period after the shift
// start, Late after it. Rows open a read-only panel — changes only via correction requests.

export default function TodaysAttendance({ currentUser, staff, attendance, corrections, leave, holidays, intent, onAddCorrection, onNavigate }: AttendanceViewProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const today = dateKey(now);
  const [dept, setDept] = useState('');
  const [selected, setSelected] = useState<string | null>(intent?.openStaffName ?? null);

  const rows = useMemo(
    () => activeStaff(staff)
      .filter((s) => !dept || departmentOf(s.role) === dept)
      .map((member) => ({ member, day: dayView(member.name, today, attendance, leave, now, holidays) }))
      // Exceptions first, then by check-in time.
      .sort((a, b) => {
        const rank = (s: string) => ['Absent', 'Very Late', 'Late', 'Not in yet', 'On Leave', 'Present', 'Off'].indexOf(s);
        return rank(a.day.status) - rank(b.day.status) || (a.day.record?.checkIn ?? '~').localeCompare(b.day.record?.checkIn ?? '~');
      }),
    [staff, dept, attendance, leave, holidays, today, now]
  );

  const counts = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.day.status]: (m[r.day.status] ?? 0) + 1 }), {});
  const selectedRow = rows.find((r) => r.member.name === selected);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-gray-500">
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · shift {SHIFT_LABEL}
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-400"><Info size={12} /> On time until {ON_TIME_GRACE} min after start, then Late</span>
        </p>
        <div className="relative">
          <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department" className="appearance-none rounded-lg border border-grey-border bg-white py-2 pl-3 pr-8 text-sm text-navy">
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['Present', 'Late', 'Very Late', 'Absent', 'Not in yet', 'On Leave'] as const).filter((s) => counts[s]).map((s) => (
          <span key={s} className={`rounded-full px-3 py-1 text-xs font-medium ${DAY_STATUS_STYLES[s]}`}>{s} <b className="tabular-nums">{counts[s]}</b></span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="bg-grey-bg text-left">
              {['Employee', 'Role', 'Check-in', 'Check-out', 'Status', 'Working time', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, day }) => {
              const inNow = !!day.record?.checkIn && !day.record.checkOut;
              return (
                <tr key={member.id} onClick={() => setSelected(member.name)} className="cursor-pointer border-t border-grey-border hover:bg-grey-bg/50">
                  <td className="px-4 py-3 text-sm font-medium text-navy">
                    {member.name}
                    {day.record?.amendments?.length ? <span className="ml-1.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">corrected</span> : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{member.role}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-600">{timeOf(day.record?.checkIn) || '—'}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-600">{timeOf(day.record?.checkOut) || (inNow ? <span className="text-blue-700">In office</span> : '—')}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${DAY_STATUS_STYLES[day.status]}`}>{day.status}</span></td>
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-600">
                    {formatMinutes(workedMinutes(day.record, now))}
                    {inNow && <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 align-middle" aria-label="counting" />}
                  </td>
                  <td className="px-3 py-3 text-gray-300"><ChevronRight size={16} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No staff in this department.</p>}
      </div>

      {selectedRow && (
        <AttendanceRecordPanel
          day={selectedRow.day}
          member={selectedRow.member}
          corrections={corrections.filter((c) => c.staffName === selectedRow.member.name && c.date === today)}
          now={now}
          onClose={() => setSelected(null)}
          onRequestCorrection={(field, time, reason) => onAddCorrection(managerCorrection(currentUser, selectedRow.member.name, today, field, time, reason))}
          onOpenEmployee={() => onNavigate('hr-att-employee', { openStaffName: selectedRow.member.name, attendanceDate: today })}
        />
      )}
    </div>
  );
}
