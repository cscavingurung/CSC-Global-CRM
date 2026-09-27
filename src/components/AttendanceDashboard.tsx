import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, ChevronDown, Clock, FileClock, LogOut, UserX } from 'lucide-react';
import {
  AttendanceViewProps, DEPARTMENTS, DayView, activeStaff, dayView, departmentOf, firstDayOf, monthDates,
} from '../attendance';
import { timeOf } from '../branchOps';
import { dateKey } from '../dateTime';
import { NavIntent } from '../types';

// ─── HRM · Attendance · Attendance Dashboard ────────────────────────────────
// Today in numbers, a feed of only the things that need a decision (each opens the exact
// record), and a month summary per employee.

const REPEAT_LATE = 3;

type FeedItem = { key: string; tone: 'red' | 'amber'; icon: React.ReactNode; text: React.ReactNode; to: string; intent?: NavIntent };

const shortDate = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="w-full appearance-none rounded-lg border border-grey-border bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-navy focus:border-navy-light focus:outline-none sm:w-auto">
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

export default function AttendanceDashboard({ staff, attendance, corrections, leave, holidays, onNavigate }: AttendanceViewProps) {
  const now = useMemo(() => new Date(), []);
  const today = dateKey(now);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [who, setWho] = useState('');
  const [dept, setDept] = useState('');

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) };
  });

  const people = activeStaff(staff).filter((p) => (!who || p.name === who) && (!dept || departmentOf(p.role) === dept));
  const names = new Set(people.map((p) => p.name));

  // Today
  const todayViews = people.map((p) => ({ member: p, day: dayView(p.name, today, attendance, leave, now, holidays) }));
  const present = todayViews.filter((x) => x.day.record?.checkIn);
  const late = todayViews.filter((x) => x.day.status === 'Late' || x.day.status === 'Very Late');
  const absent = todayViews.filter((x) => x.day.status === 'Absent');
  const onLeaveToday = todayViews.filter((x) => x.day.status === 'On Leave');

  // Selected month, per person
  const dates = monthDates(month, today);
  const monthRows = useMemo(() => people.map((p) => {
    const start = firstDayOf(attendance, p.name);
    const views: DayView[] = dates.filter((d) => !start || d >= start).map((d) => dayView(p.name, d, attendance, leave, now, holidays));
    const count = (f: (v: DayView) => boolean) => views.filter(f).length;
    const worked = count((v) => !!v.record?.checkIn);
    const absences = views.filter((v) => v.status === 'Absent' && v.date !== today);
    return {
      member: p,
      present: worked,
      late: count((v) => v.status === 'Late' || v.status === 'Very Late'),
      absent: absences.length,
      absences,
      leave: count((v) => v.status === 'On Leave'),
      missing: views.filter((v) => v.missingCheckOut),
      rate: worked + absences.length ? Math.round((worked / (worked + absences.length)) * 100) : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [people.map((p) => p.name).join('|'), month, attendance, leave, holidays]);

  const pending = corrections.filter((c) => c.status === 'Pending' && names.has(c.staffName));
  const missingAll = monthRows.flatMap((r) => r.missing.map((d) => ({ member: r.member, day: d })));
  const hasPendingFor = (name: string, date: string) => pending.some((c) => c.staffName === name && c.date === date);

  // Needs attention — each item opens the affected record
  const feed: FeedItem[] = [
    ...(absent.length ? [{
      key: 'absent', tone: 'red' as const, icon: <UserX size={15} />,
      text: <><b>{absent.length} employee{absent.length === 1 ? '' : 's'} absent today</b> — {absent.map((a) => a.member.name).join(', ')}</>,
      to: 'hr-att-today', intent: absent.length === 1 ? { openStaffName: absent[0].member.name } : undefined,
    }] : []),
    ...late.map((l) => ({
      key: `late-${l.member.id}`, tone: 'amber' as const, icon: <Clock size={15} />,
      text: <><b>{l.member.name}</b> {l.day.status.toLowerCase()} today — in at {timeOf(l.day.record?.checkIn)}</>,
      to: 'hr-att-today', intent: { openStaffName: l.member.name },
    })),
    ...(pending.length ? [{
      key: 'pending', tone: 'amber' as const, icon: <FileClock size={15} />,
      text: <><b>{pending.length} correction{pending.length === 1 ? '' : 's'} pending</b> — {pending.map((c) => c.staffName.split(' ')[0]).join(', ')}</>,
      to: 'hr-att-corrections',
    }] : []),
    ...missingAll.filter((x) => !hasPendingFor(x.member.name, x.day.date)).map((x) => ({
      key: `miss-${x.member.id}-${x.day.date}`, tone: 'amber' as const, icon: <LogOut size={15} />,
      text: <><b>{x.member.name}</b> missing check-out on {shortDate(x.day.date)} — no correction requested</>,
      to: 'hr-att-history', intent: { openStaffName: x.member.name, attendanceDate: x.day.date },
    })),
    ...monthRows.filter((r) => r.late >= REPEAT_LATE).map((r) => ({
      key: `rep-${r.member.id}`, tone: 'amber' as const, icon: <AlertTriangle size={15} />,
      text: <><b>{r.member.name}</b> late {r.late} times this month</>,
      to: 'hr-att-employee', intent: { openStaffName: r.member.name, attendanceDate: `${month}-01` },
    })),
    ...monthRows.filter((r) => r.absences.length >= 1).map((r) => ({
      key: `abs-${r.member.id}`, tone: 'red' as const, icon: <UserX size={15} />,
      text: <><b>{r.member.name}</b> {r.absences.length} unexplained absence{r.absences.length === 1 ? '' : 's'} this month ({r.absences.map((a) => shortDate(a.date)).join(', ')})</>,
      to: 'hr-att-employee', intent: { openStaffName: r.member.name, attendanceDate: r.absences[0].date },
    })),
  ];

  const cards = [
    { label: 'Total Staff', value: people.length, tone: 'text-navy', to: 'hr-att-today' },
    { label: 'Present', value: present.length, tone: 'text-emerald-600', to: 'hr-att-today' },
    { label: 'Late', value: late.length, tone: 'text-amber-600', to: 'hr-att-today' },
    { label: 'Absent', value: absent.length, tone: 'text-red-600', to: 'hr-att-today' },
    { label: 'On Leave', value: onLeaveToday.length, tone: 'text-blue-600', to: 'hr-att-today' },
    { label: 'Missing Check-out', value: missingAll.length, tone: 'text-amber-600', to: 'hr-att-history' },
    { label: 'Corrections Pending', value: pending.length, tone: 'text-amber-600', to: 'hr-att-corrections' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
        <Filter label="Month" value={month} onChange={setMonth}>
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </Filter>
        <Filter label="Staff" value={who} onChange={setWho}>
          <option value="">All staff</option>
          {activeStaff(staff).map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </Filter>
        <Filter label="Department" value={dept} onChange={setDept}>
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </Filter>
      </div>

      <section>
        <p className="mb-2 text-xs font-semibold text-gray-500">Today · {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {cards.map((c) => (
            <button key={c.label} type="button" onClick={() => onNavigate(c.to)} className="rounded-xl border border-grey-border bg-white px-4 py-3 text-left transition-colors hover:border-navy-light/40">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${c.value === 0 ? 'text-gray-300' : c.tone}`}>{c.value}</p>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400">Missing check-out counts days in {months.find((m) => m.value === month)?.label} without a check-out.</p>
      </section>

      <section className="rounded-xl border border-grey-border bg-white">
        <div className="flex items-center gap-2 border-b border-grey-border px-5 py-3">
          <AlertTriangle size={15} className="text-amber-600" />
          <h2 className="text-sm font-semibold text-navy">Needs Attention</h2>
          <span className="text-xs text-gray-400">{feed.length}</span>
        </div>
        {feed.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-gray-400">Nothing needs attention — attendance is clean.</p>
        ) : (
          <ul className="divide-y divide-grey-border">
            {feed.map((f) => (
              <li key={f.key}>
                <button type="button" onClick={() => onNavigate(f.to, f.intent)} className="group flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-grey-bg/50">
                  <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${f.tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>{f.icon}</span>
                  <span className="min-w-0 flex-1 text-sm text-gray-700">{f.text}</span>
                  <ArrowRight size={15} className="text-gray-300 group-hover:text-navy" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-grey-border bg-white">
        <h2 className="border-b border-grey-border px-5 py-3 text-sm font-semibold text-navy">{months.find((m) => m.value === month)?.label} by employee</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="bg-grey-bg text-left">
                {['Employee', 'Department', 'Present', 'Late', 'Absent', 'Leave', 'Missing out', 'Attendance rate'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthRows.map((r) => (
                <tr key={r.member.id} onClick={() => onNavigate('hr-att-employee', { openStaffName: r.member.name, attendanceDate: `${month}-01` })} className="cursor-pointer border-t border-grey-border hover:bg-grey-bg/50">
                  <td className="px-4 py-2.5 text-sm font-medium text-navy">{r.member.name}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{departmentOf(r.member.role)}</td>
                  <td className="px-4 py-2.5 text-sm tabular-nums text-gray-600">{r.present}</td>
                  <td className={`px-4 py-2.5 text-sm tabular-nums ${r.late >= REPEAT_LATE ? 'font-semibold text-amber-700' : 'text-gray-600'}`}>{r.late}</td>
                  <td className={`px-4 py-2.5 text-sm tabular-nums ${r.absent ? 'font-semibold text-red-700' : 'text-gray-600'}`}>{r.absent}</td>
                  <td className="px-4 py-2.5 text-sm tabular-nums text-gray-600">{r.leave}</td>
                  <td className="px-4 py-2.5 text-sm tabular-nums text-gray-600">{r.missing.length}</td>
                  <td className="w-40 px-4 py-2.5">
                    {r.rate === null ? <span className="text-sm text-gray-400">—</span> : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div className={`h-full rounded-full ${r.rate >= 95 ? 'bg-emerald-500' : r.rate >= 85 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${r.rate}%` }} />
                        </div>
                        <span className="w-9 text-right text-xs tabular-nums text-gray-600">{r.rate}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
