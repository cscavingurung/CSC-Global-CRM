import { Fragment, useEffect, useMemo, useState } from 'react';
import { CalendarDays, History, LogIn, LogOut, X } from 'lucide-react';
import { AttendanceCorrection, AttendanceExplanation, AttendanceRecord, AttendanceStatus, ExplanationReason, Holiday, LeaveRecord, MockUser } from '../types';
import { holidayOn } from '../holidays';
import { EXPLANATION_REASONS, onLeave } from '../attendance';
import { ATTENDANCE_STYLES, SHIFT_LABEL, attendanceStatus, isWorkingDay, timeOf } from '../branchOps';
import { dateKey, formatSubmittedAt, parseSubmittedAt } from '../dateTime';

// ─── Branch Hub · Time & Attendance ─────────────────────────────────────────
// The employee side of Branch Operations Control: punch in/out, this month at a glance, and
// a history where missed punches are fixed by requesting a correction (never a direct edit).

interface TimeAttendancePageProps {
  currentUser: MockUser;
  /** This user's own records. */
  records: AttendanceRecord[];
  /** This user's own correction requests. */
  corrections: AttendanceCorrection[];
  onSaveAttendance: (record: AttendanceRecord) => void;
  onAddCorrection: (correction: AttendanceCorrection) => void;
  /** This user's approved leave — those days aren't absences. */
  leave: LeaveRecord[];
  /** Explanations the manager asked this user for. */
  explanations: AttendanceExplanation[];
  onSaveExplanation: (e: AttendanceExplanation) => void;
  /** Branch holidays — shown as Holiday, never Absent. */
  holidays: Holiday[];
}

type DayRow = {
  date: string;
  record?: AttendanceRecord;
  status: AttendanceStatus | 'Absent' | 'In progress' | 'Day off' | 'On Leave' | 'Holiday';
  /** Which punch is missing, if any. */
  missing?: AttendanceCorrection['field'];
};

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

const STATUS_PILL: Record<DayRow['status'], string> = {
  ...ATTENDANCE_STYLES,
  Absent: 'bg-red-50 text-red-700',
  'In progress': 'bg-blue-50 text-blue-700',
  'Day off': 'bg-gray-100 text-gray-500',
  'On Leave': 'bg-blue-50 text-blue-700',
  Holiday: 'bg-sky-50 text-sky-700',
};

// <input type="time"> "18:10" → "6:10 PM"
const formatTime = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return Number.isNaN(h) ? value : `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const hoursBetween = (a?: string, b?: string) => {
  const x = a ? parseSubmittedAt(a) : null;
  const y = b ? parseSubmittedAt(b) : null;
  if (!x || !y) return '';
  const mins = Math.max(0, (y.getTime() - x.getTime()) / 60000);
  return `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, '0')}m`;
};

const longDate = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export default function TimeAttendancePage({ currentUser, records, corrections, onSaveAttendance, onAddCorrection, leave, explanations, onSaveExplanation, holidays }: TimeAttendancePageProps) {
  const requested = explanations.filter((e) => e.status === 'Requested');
  const [answers, setAnswers] = useState<Record<string, { reason: ExplanationReason; note: string }>>({});
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const today = dateKey(now);
  const mine = records.find((r) => r.date === today);
  const myStatus = mine?.checkIn ? attendanceStatus(mine.checkIn) : null;

  const checkIn = () =>
    onSaveAttendance({ id: `att-${Date.now()}`, staffName: currentUser.name, branch: currentUser.branch, date: today, checkIn: formatSubmittedAt(new Date()) });
  const checkOut = () => mine && onSaveAttendance({ ...mine, checkOut: formatSubmittedAt(new Date()) });

  // Every day of this month so far, newest first.
  const rows: DayRow[] = useMemo(() => {
    const list: DayRow[] = [];
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    while (d.getMonth() === now.getMonth()) {
      const key = dateKey(d);
      const record = records.find((r) => r.date === key);
      const isToday = key === today;
      let status: DayRow['status'];
      let missing: DayRow['missing'];
      if (record?.checkIn) {
        status = attendanceStatus(record.checkIn) ?? 'On Time';
        if (!record.checkOut) {
          if (isToday) status = 'In progress';
          else missing = 'checkOut';
        }
      } else if (holidayOn(holidays, key)) {
        status = 'Holiday';
      } else if (onLeave(leave, currentUser.name, key)) {
        status = 'On Leave';
      } else if (!isWorkingDay(d) && !isToday) {
        status = 'Day off';
      } else {
        status = isToday ? 'In progress' : 'Absent';
        if (!isToday) missing = 'checkIn';
      }
      if (!(isToday && !record)) list.push({ date: key, record, status, missing });
      d.setDate(d.getDate() - 1);
    }
    return list;
  }, [records, now, today, leave, holidays, currentUser.name]);

  const stats = useMemo(() => {
    const worked = rows.filter((r) => r.record?.checkIn);
    return {
      present: worked.length,
      onTime: worked.filter((r) => r.status === 'On Time').length,
      late: worked.filter((r) => r.status === 'Late' || r.status === 'Very Late').length,
      absent: rows.filter((r) => r.status === 'Absent').length,
      missed: rows.filter((r) => r.missing === 'checkOut').length,
    };
  }, [rows]);

  const [correctingDate, setCorrectingDate] = useState<string | null>(null);
  const [form, setForm] = useState({ field: 'checkOut' as AttendanceCorrection['field'], time: '18:00', reason: '' });
  const correctionFor = (date: string) => corrections.filter((c) => c.date === date).pop();

  const startCorrection = (row: DayRow) => {
    setCorrectingDate(row.date);
    setForm({ field: row.missing ?? 'checkOut', time: row.missing === 'checkIn' ? '09:00' : '18:00', reason: '' });
  };

  const submit = () => {
    if (!correctingDate || !form.reason.trim()) return;
    onAddCorrection({
      id: `corr-${Date.now()}`, staffName: currentUser.name, branch: currentUser.branch, date: correctingDate, field: form.field,
      requestedTime: formatTime(form.time), reason: form.reason.trim(), requestedAt: formatSubmittedAt(new Date()), status: 'Pending',
    });
    setCorrectingDate(null);
  };

  const clock = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-4xl space-y-5">
      {/* Punch */}
      <section className="rounded-xl border border-grey-border bg-white px-5 py-6 text-center">
        <p className="text-4xl font-semibold tabular-nums tracking-tight text-navy">{clock}</p>
        <p className="mt-1 text-sm text-gray-500">
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · Shift {SHIFT_LABEL} · {currentUser.branch}
        </p>

        <div className="mx-auto mt-5 max-w-sm">
          {!mine?.checkIn ? (
            <button type="button" onClick={checkIn} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-6 py-4 text-lg font-semibold text-white hover:bg-navy-light">
              <LogIn size={22} /> CHECK IN
            </button>
          ) : !mine.checkOut ? (
            <button type="button" onClick={checkOut} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-6 py-4 text-lg font-semibold text-white hover:bg-navy-light">
              <LogOut size={22} /> CHECK OUT
            </button>
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-base font-semibold text-emerald-700">Day complete — see you tomorrow</p>
          )}
        </div>
        {mine?.checkIn && (
          <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-600">
            Checked in at <span className="font-semibold tabular-nums text-navy">{timeOf(mine.checkIn)}</span>
            {myStatus && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ATTENDANCE_STYLES[myStatus]}`}>{myStatus}</span>}
            {mine.checkOut && <>· out at <span className="font-semibold tabular-nums text-navy">{timeOf(mine.checkOut)}</span> · {hoursBetween(mine.checkIn, mine.checkOut)}</>}
          </p>
        )}
      </section>

      {/* Explanations the manager asked for */}
      {requested.map((e) => {
        const a = answers[e.id] ?? { reason: e.kind === 'Late' ? 'Traffic' : 'Medical', note: '' };
        return (
          <section key={e.id} className="dissolve-in space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 px-5 py-4">
            <p className="text-sm font-semibold text-navy">
              Explanation requested — {e.kind === 'Late' ? 'late arrival' : 'absence'} on {longDate(e.date)}
            </p>
            <p className="text-xs text-gray-600">Asked by {e.requestedBy}. Your manager reviews it and marks the day excused or not.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select value={a.reason} onChange={(ev) => setAnswers({ ...answers, [e.id]: { ...a, reason: ev.target.value as ExplanationReason } })} className={`${inputClass} sm:w-48`} aria-label="Reason">
                {EXPLANATION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input value={a.note} onChange={(ev) => setAnswers({ ...answers, [e.id]: { ...a, note: ev.target.value } })} placeholder="What happened?" className={`${inputClass} flex-1`} />
              <button
                type="button"
                disabled={!a.note.trim()}
                onClick={() => onSaveExplanation({ ...e, status: 'Submitted', reason: a.reason, note: a.note.trim(), submittedBy: currentUser.name, submittedAt: formatSubmittedAt(new Date()) })}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                Submit
              </button>
            </div>
          </section>
        );
      })}

      {/* My stats */}
      <section>
        <p className="mb-2 text-xs font-semibold text-gray-500">My stats · {monthName}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Present', value: stats.present, tone: 'text-navy' },
            { label: 'On time', value: stats.onTime, tone: 'text-emerald-600' },
            { label: 'Late', value: stats.late, tone: 'text-amber-600' },
            { label: 'Absent', value: stats.absent, tone: 'text-red-600' },
            { label: 'Missed check-outs', value: stats.missed, tone: 'text-amber-600' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-grey-border bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${s.value === 0 ? 'text-gray-300' : s.tone}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* History */}
      <section className="rounded-xl border border-grey-border bg-white">
        <div className="flex items-center gap-2 border-b border-grey-border px-5 py-3">
          <CalendarDays size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-navy">History</h2>
          <span className="ml-auto text-xs text-gray-400">Missed a punch? Request a correction — your manager approves it.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-grey-bg text-left">
                {['Date', 'Check in', 'Check out', 'Hours', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const correction = correctionFor(row.date);
                const open = correctingDate === row.date;
                return (
                  <Fragment key={row.date}>
                    <tr className={`border-t border-grey-border ${row.status === 'Day off' ? 'text-gray-400' : ''}`}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-sm text-navy">{row.date === today ? 'Today' : longDate(row.date)}</td>
                      <td className="px-4 py-2.5 text-sm tabular-nums text-gray-600">{timeOf(row.record?.checkIn) || '—'}</td>
                      <td className={`px-4 py-2.5 text-sm tabular-nums ${row.missing === 'checkOut' ? 'font-medium text-amber-700' : 'text-gray-600'}`}>
                        {timeOf(row.record?.checkOut) || (row.missing === 'checkOut' ? 'Missing' : '—')}
                      </td>
                      <td className="px-4 py-2.5 text-sm tabular-nums text-gray-500">{hoursBetween(row.record?.checkIn, row.record?.checkOut) || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL[row.status]}`}>{row.status}</span>
                        {row.record?.amendments?.length ? <span className="ml-1.5 text-[11px] text-gray-400" title={`Approved by ${row.record.amendments[row.record.amendments.length - 1].approvedBy}`}>corrected</span> : null}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {correction?.status === 'Pending' ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">Correction pending</span>
                        ) : correction?.status === 'Rejected' && row.missing ? (
                          <span className="text-xs text-red-700">Correction rejected</span>
                        ) : row.missing && !open ? (
                          <button type="button" onClick={() => startCorrection(row)} className="inline-flex items-center gap-1 rounded-lg border border-grey-border px-2.5 py-1 text-xs font-semibold text-navy hover:border-navy-light hover:bg-grey-bg">
                            <History size={12} /> Request Correction
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-grey-bg/50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="dissolve-in flex flex-col gap-2 sm:flex-row sm:items-center">
                            <select value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value as AttendanceCorrection['field'] })} className={`${inputClass} sm:w-36`} aria-label="Which punch">
                              <option value="checkIn">Check-in</option>
                              <option value="checkOut">Check-out</option>
                            </select>
                            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={`${inputClass} sm:w-32`} aria-label="Correct time" />
                            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason (required)" className={`${inputClass} flex-1`} />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setCorrectingDate(null)} aria-label="Cancel" className="rounded-lg border border-grey-border p-2 text-gray-400 hover:text-navy"><X size={16} /></button>
                              <button type="button" onClick={submit} disabled={!form.reason.trim()} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40">
                                Send request
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No attendance yet this month.</p>}
        </div>
      </section>
    </div>
  );
}
