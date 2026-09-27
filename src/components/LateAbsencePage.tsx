import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarX, ChevronDown, Clock, MessageSquareText, Repeat, Send, X } from 'lucide-react';
import { AttendanceExplanation, ExplanationReason, LeaveRecord, StaffMember } from '../types';
import {
  AttendanceViewProps, DEPARTMENTS, EXCEPTION_STYLES, EXPLANATION_REASONS, ExceptionState, activeStaff, datesBetween, dayView, delayMinutes,
  departmentOf, exceptionState, firstDayOf, formatMinutes,
} from '../attendance';
import { LATE_LIMIT, SHIFT_START_MINUTES, timeOf } from '../branchOps';
import { dateKey, formatSubmittedAt } from '../dateTime';

// ─── HRM · Attendance · Late & Absence ──────────────────────────────────────
// Exception monitoring, computed from check-ins and approved leave. The manager never types
// attendance here — they request explanations, review them, and watch the patterns.

interface LateAbsencePageProps extends AttendanceViewProps {
  explanations: AttendanceExplanation[];
  onSaveExplanation: (e: AttendanceExplanation) => void;
}

const REPEAT_LATE = 3;
const SCHEDULED = `${Math.floor(SHIFT_START_MINUTES / 60) % 12 || 12}:${String(SHIFT_START_MINUTES % 60).padStart(2, '0')} AM`;
// Chart colours: categorical slots 1–2 of the reference palette (validated, light surface).
const SERIES = { late: '#2a78d6', absence: '#eb6834' };

type Row = {
  key: string;
  kind: 'Late' | 'Absence';
  date: string;
  member: StaffMember;
  checkIn?: string;
  delay: number;
  leave?: LeaveRecord;
  explanation?: AttendanceExplanation;
  state: ExceptionState;
};

const shortDate = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="w-full appearance-none rounded-lg border border-grey-border bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-navy focus:border-navy-light focus:outline-none sm:w-auto">
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

/** Grouped columns, one pair per week. Values on the caps; hover for the exact figures. */
function WeeklyTrend({ weeks }: { weeks: { label: string; range: string; late: number; absence: number }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...weeks.flatMap((w) => [w.late, w.absence]));
  const H = 96;
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.late }} /> Late</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.absence }} /> Absence</span>
      </div>
      <div
        className="relative flex items-end gap-3 border-b border-grey-border"
        style={{ height: H + 18 }}
        role="img"
        aria-label={weeks.map((w) => `${w.label}: ${w.late} late, ${w.absence} absent`).join('; ')}
      >
        {weeks.map((w) => (
          <div key={w.label} className="flex flex-1 items-end justify-center gap-0.5">
            {(['late', 'absence'] as const).map((k) => {
              const id = `${w.label}-${k}`;
              const v = w[k];
              return (
                <div
                  key={k}
                  className="relative flex w-full max-w-[24px] flex-col items-center justify-end"
                  style={{ height: H + 18 }}
                  onMouseEnter={() => setHover(id)}
                  onMouseLeave={() => setHover(null)}
                >
                  <span className="mb-0.5 text-[10px] tabular-nums text-gray-500">{v || ''}</span>
                  <div
                    className="w-full rounded-t"
                    style={{ height: v ? Math.max(3, (v / max) * H) : 0, background: SERIES[k], opacity: hover && hover !== id ? 0.45 : 1 }}
                  />
                  {hover === id && (
                    <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border border-grey-border bg-white px-2 py-1 text-[11px] text-navy">
                      <b>{w.label}</b> · {w.range}<br />{v} {k === 'late' ? 'late arrival' : 'absence'}{v === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-3">
        {weeks.map((w) => <p key={w.label} className="flex-1 text-center text-[11px] text-gray-500">{w.label}</p>)}
      </div>
    </div>
  );
}

export default function LateAbsencePage(props: LateAbsencePageProps) {
  const { currentUser, staff, attendance, leave, holidays, explanations, onSaveExplanation, onNavigate } = props;
  const now = useMemo(() => new Date(), []);
  const today = dateKey(now);
  const [period, setPeriod] = useState('month');
  const [who, setWho] = useState('');
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<'Late' | 'Absence'>('Late');
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Period → date range
  const monthStart = `${today.slice(0, 7)}-01`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const range = period === 'month' ? { from: monthStart, to: today, label: now.toLocaleDateString('en-GB', { month: 'long' }) }
    : period === 'prev' ? { from: `${prevKey}-01`, to: dateKey(new Date(now.getFullYear(), now.getMonth(), 0)), label: prev.toLocaleDateString('en-GB', { month: 'long' }) }
      : { from: dateKey(new Date(now.getTime() - 29 * 86_400_000)), to: today, label: 'last 30 days' };

  const everyone = activeStaff(staff).filter((p) => p.role !== 'Super Admin');
  const people = everyone.filter((p) => (!who || p.name === who) && (!dept || departmentOf(p.role) === dept));
  const explanationFor = (name: string, date: string, kind: 'Late' | 'Absence') =>
    explanations.find((e) => e.staffName === name && e.date === date && e.kind === kind);

  // Every late arrival and every non-working weekday, derived from records + leave.
  const allRows = useMemo(() => {
    const out: Row[] = [];
    datesBetween(range.from, range.to).forEach((date) => {
      people.forEach((member) => {
        const start = firstDayOf(attendance, member.name);
        if (start && date < start) return;
        const v = dayView(member.name, date, attendance, leave, now, holidays);
        if (v.status === 'Late' || v.status === 'Very Late') {
          const explanation = explanationFor(member.name, date, 'Late');
          out.push({ key: `L-${member.name}-${date}`, kind: 'Late', date, member, checkIn: v.record?.checkIn, delay: delayMinutes(v.record), explanation, state: exceptionState('Late', explanation) });
        } else if (v.status === 'Absent' || v.status === 'On Leave') {
          const explanation = explanationFor(member.name, date, 'Absence');
          out.push({ key: `A-${member.name}-${date}`, kind: 'Absence', date, member, delay: 0, leave: v.leave, explanation, state: exceptionState('Absence', explanation, v.leave) });
        }
      });
    });
    return out.sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, people.map((p) => p.name).join('|'), attendance, leave, holidays, explanations]);

  const lates = allRows.filter((r) => r.kind === 'Late');
  const absences = allRows.filter((r) => r.kind === 'Absence');
  const unplanned = absences.filter((r) => !r.leave);
  const unexcused = unplanned.filter((r) => r.state !== 'Excused');
  const pendingExpl = allRows.filter((r) => r.state === 'Awaiting employee' || r.state === 'Needs review');

  // Repeated lateness
  const patterns = useMemo(() => {
    const by = new Map<string, Row[]>();
    lates.forEach((r) => by.set(r.member.name, [...(by.get(r.member.name) ?? []), r]));
    return [...by.entries()]
      .map(([name, rs]) => ({
        member: rs[0].member,
        days: rs.length,
        total: rs.reduce((n, r) => n + r.delay, 0),
        last: rs.map((r) => r.date).sort().pop()!,
        excused: rs.filter((r) => r.state === 'Excused').length,
        name,
      }))
      .filter((p) => p.days >= REPEAT_LATE)
      .sort((a, b) => b.days - a.days || b.total - a.total);
  }, [lates]);

  // Coverage today: a department at half strength or less is flagged. "Not in yet" doesn't
  // count — only confirmed absences and leave.
  const coverage = DEPARTMENTS.map((d) => {
    const team = everyone.filter((p) => departmentOf(p.role) === d);
    const out = team.filter((p) => {
      const v = dayView(p.name, today, attendance, leave, now, holidays);
      return v.status === 'Absent' || v.status === 'On Leave';
    });
    return { dept: d, total: team.length, available: team.length - out.length, out };
  }).filter((c) => c.total >= 2 && c.available / c.total <= 0.5);

  // Trends
  const byRole = (['Counselor', 'V/A Officer', 'Front Desk Officer'] as const).map((role) => ({
    role,
    staff: people.filter((p) => p.role === role).length,
    late: lates.filter((r) => r.member.role === role).length,
    absent: unplanned.filter((r) => r.member.role === role).length,
    leave: absences.filter((r) => r.leave && r.member.role === role).length,
  }));
  const weeks = useMemo(() => {
    const dates = datesBetween(range.from, range.to);
    const chunks: string[][] = [];
    for (let i = 0; i < dates.length; i += 7) chunks.push(dates.slice(i, i + 7));
    return chunks.map((c, i) => ({
      label: `W${i + 1}`,
      range: `${shortDate(c[0])} – ${shortDate(c[c.length - 1])}`,
      late: lates.filter((r) => c.includes(r.date)).length,
      absence: unplanned.filter((r) => c.includes(r.date)).length,
    }));
  }, [range.from, range.to, lates, unplanned]);

  // Table rows after the status filter
  const statusMatch = (r: Row) => !status || r.state === status;
  const shown = (tab === 'Late' ? lates : absences).filter(statusMatch);
  const open = allRows.find((r) => r.key === openKey) ?? null;

  // ── Explanation actions ────────────────────────────────────────────────
  const stampNow = () => formatSubmittedAt(new Date());
  const requestExplanation = (r: Row) =>
    onSaveExplanation({
      id: r.explanation?.id ?? `exp-${Date.now()}`, staffName: r.member.name, branch: currentUser.branch, date: r.date, kind: r.kind,
      status: 'Requested', requestedBy: currentUser.name, requestedAt: stampNow(),
    });
  const [draft, setDraft] = useState<{ reason: ExplanationReason; note: string; reviewNote: string }>({ reason: 'Traffic', note: '', reviewNote: '' });
  const recordAndDecide = (r: Row, accept: boolean) => {
    const base: AttendanceExplanation = r.explanation ?? { id: `exp-${Date.now()}`, staffName: r.member.name, branch: currentUser.branch, date: r.date, kind: r.kind, status: 'Submitted' };
    const needsRecording = !r.explanation || r.explanation.status === 'Requested';
    onSaveExplanation({
      ...base,
      ...(needsRecording ? { reason: draft.reason, note: draft.note.trim() || undefined, submittedBy: `${currentUser.name} (on behalf of ${r.member.name.split(' ')[0]})`, submittedAt: stampNow() } : {}),
      status: accept ? 'Accepted' : 'Rejected',
      reviewedBy: currentUser.name,
      reviewedAt: stampNow(),
      reviewNote: draft.reviewNote.trim() || undefined,
    });
  };
  const openRow = (r: Row) => {
    setOpenKey(r.key);
    setDraft({ reason: r.explanation?.reason ?? (r.kind === 'Late' ? 'Traffic' : 'Medical'), note: '', reviewNote: '' });
  };

  const cards: { label: string; value: number; hint: string; tone: string; icon: React.ReactNode; onClick: () => void }[] = [
    { label: 'Late Arrivals', value: lates.length, hint: `in ${range.label}`, tone: 'text-amber-600', icon: <Clock size={14} />, onClick: () => { setTab('Late'); setStatus(''); } },
    { label: 'Absent', value: unplanned.length, hint: 'days without approved leave', tone: 'text-red-600', icon: <CalendarX size={14} />, onClick: () => { setTab('Absence'); setStatus(''); } },
    { label: 'Unexcused', value: unexcused.length, hint: 'absences not yet excused', tone: 'text-red-600', icon: <AlertTriangle size={14} />, onClick: () => { setTab('Absence'); setStatus('Unconfirmed'); } },
    { label: 'Repeated Late Employees', value: patterns.length, hint: `${REPEAT_LATE}+ late days`, tone: 'text-amber-600', icon: <Repeat size={14} />, onClick: () => { setTab('Late'); setStatus(''); document.getElementById('late-patterns')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
    { label: 'Pending Explanations', value: pendingExpl.length, hint: 'awaiting employee or review', tone: 'text-blue-600', icon: <MessageSquareText size={14} />, onClick: () => { setStatus('Needs review'); setTab(pendingExpl[0]?.kind ?? 'Absence'); } },
  ];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
        <Select label="Period" value={period} onChange={setPeriod}>
          <option value="month">Current month</option>
          <option value="prev">Previous month</option>
          <option value="30">Last 30 days</option>
        </Select>
        <Select label="Employee" value={who} onChange={setWho}>
          <option value="">All employees</option>
          {everyone.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </Select>
        <Select label="Department" value={dept} onChange={setDept}>
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        <Select label="Status" value={status} onChange={setStatus}>
          <option value="">All statuses</option>
          {(Object.keys(EXCEPTION_STYLES) as ExceptionState[]).map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <button key={c.label} type="button" onClick={c.onClick} className="rounded-xl border border-grey-border bg-white px-4 py-3 text-left transition-colors hover:border-navy-light/40">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">{c.icon}{c.label}</p>
            <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${c.value === 0 ? 'text-gray-300' : c.tone}`}>{c.value}</p>
            <p className="text-[11px] text-gray-400">{c.hint}</p>
          </button>
        ))}
      </div>

      {/* Coverage alert */}
      {coverage.map((c) => (
        <div key={c.dept} className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center ${c.available === 0 ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
          <AlertTriangle size={18} className={c.available === 0 ? 'text-red-600' : 'text-amber-600'} />
          <p className="flex-1 text-sm text-navy">
            <b>Coverage Alert: {c.dept} capacity reduced ({c.available}/{c.total} available)</b>
            <span className="block text-xs text-gray-600">
              Out today: {c.out.map((p) => {
                const v = dayView(p.name, today, attendance, leave, now, holidays);
                return `${p.name} (${v.status === 'On Leave' ? 'on leave' : 'absent'})`;
              }).join(', ')}
            </span>
          </p>
          <button type="button" onClick={() => onNavigate('hr-att-today')} className="self-start text-xs font-semibold text-navy-light hover:text-navy sm:self-auto">Today’s attendance →</button>
        </div>
      ))}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main: tabs */}
        <div className="space-y-5">
          <section className="rounded-xl border border-grey-border bg-white">
            <div className="flex items-center gap-1 border-b border-grey-border px-3 pt-2">
              {(['Late', 'Absence'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-navy'}`}
                >
                  {t === 'Late' ? 'Late Arrivals' : 'Absence Records'} <span className="text-xs text-gray-400">{t === 'Late' ? lates.length : absences.length}</span>
                </button>
              ))}
              {status && (
                <button type="button" onClick={() => setStatus('')} className="ml-auto inline-flex items-center gap-1 rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-medium text-navy">
                  {status} <X size={12} />
                </button>
              )}
            </div>

            <div key={tab} className="dissolve-in overflow-x-auto">
              {tab === 'Late' ? (
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="bg-grey-bg text-left">
                      {['Date', 'Employee', 'Scheduled', 'Actual check-in', 'Delay', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.key} onClick={() => openRow(r)} className="cursor-pointer border-t border-grey-border hover:bg-grey-bg/50">
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-navy">{r.date === today ? 'Today' : shortDate(r.date)}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-navy">{r.member.name}<p className="text-[11px] font-normal text-gray-400">{r.member.role}</p></td>
                        <td className="px-4 py-2.5 text-sm tabular-nums text-gray-500">{SCHEDULED}</td>
                        <td className="px-4 py-2.5 text-sm tabular-nums text-gray-600">{timeOf(r.checkIn)}</td>
                        <td className={`px-4 py-2.5 text-sm font-semibold tabular-nums ${r.delay > LATE_LIMIT ? 'text-red-700' : 'text-amber-700'}`}>{r.delay} min</td>
                        <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EXCEPTION_STYLES[r.state]}`}>{r.state}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="bg-grey-bg text-left">
                      {['Date', 'Employee', 'Type', 'Leave status', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => {
                      const action = r.state === 'Unconfirmed' ? 'request' : r.state === 'Needs review' || r.state === 'Awaiting employee' ? 'review' : 'view';
                      return (
                        <tr key={r.key} className={`border-t border-grey-border ${r.leave ? '' : r.state === 'Unconfirmed' ? 'bg-red-50/30' : ''}`}>
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm text-navy">{r.date === today ? 'Today' : shortDate(r.date)}</td>
                          <td className="px-4 py-2.5 text-sm font-medium text-navy">{r.member.name}<p className="text-[11px] font-normal text-gray-400">{r.member.role}</p></td>
                          <td className="px-4 py-2.5 text-sm text-gray-600">
                            {r.leave ? `${r.leave.type === 'Sick' ? 'Sick' : r.leave.type} Leave` : r.explanation?.reason ? `Unapproved · ${r.explanation.reason}` : 'Unapproved'}
                          </td>
                          <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EXCEPTION_STYLES[r.state]}`}>{r.state}</span></td>
                          <td className="px-4 py-2.5 text-right">
                            {action === 'request' ? (
                              <button type="button" onClick={() => requestExplanation(r)} className="inline-flex items-center gap-1 rounded-lg bg-navy px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-light">
                                <Send size={12} /> Request Explanation
                              </button>
                            ) : (
                              <button type="button" onClick={() => openRow(r)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${action === 'review' ? 'border-navy text-navy hover:bg-navy hover:text-white' : 'border-grey-border text-gray-600 hover:border-navy-light hover:text-navy'}`}>
                                {action === 'review' ? 'Review' : 'View'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {shown.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nothing here for these filters.</p>}
            </div>
          </section>

          {/* Repeated patterns */}
          {tab === 'Late' && (
            <section id="late-patterns" className="rounded-xl border border-grey-border bg-white">
              <div className="border-b border-grey-border px-5 py-3">
                <h3 className="text-sm font-semibold text-navy">Repeated Patterns</h3>
                <p className="text-xs text-gray-500">Employees late {REPEAT_LATE} or more times in {range.label}.</p>
              </div>
              {patterns.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-400">No repeated lateness.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr className="bg-grey-bg text-left">
                        {['Employee', 'Late days', 'Total delay', 'Average delay', 'Last late'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {patterns.map((p) => (
                        <tr key={p.name} onClick={() => onNavigate('hr-att-employee', { openStaffName: p.name, attendanceDate: p.last })} className="cursor-pointer border-t border-grey-border hover:bg-grey-bg/50">
                          <td className="px-4 py-2.5 text-sm font-medium text-navy">
                            {p.name}
                            {p.days > REPEAT_LATE && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Pattern</span>}
                            <p className="text-[11px] font-normal text-gray-400">{p.member.role}{p.excused ? ` · ${p.excused} excused` : ''}</p>
                          </td>
                          <td className="px-4 py-2.5 text-sm font-semibold tabular-nums text-amber-700">{p.days}</td>
                          <td className="px-4 py-2.5 text-sm tabular-nums text-gray-600">{formatMinutes(p.total)}</td>
                          <td className="px-4 py-2.5 text-sm tabular-nums text-gray-600">{Math.round(p.total / p.days)} min</td>
                          <td className="px-4 py-2.5 text-sm text-gray-600">{p.last === today ? 'Today' : shortDate(p.last)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Trends */}
        <aside className="space-y-5">
          <section className="rounded-xl border border-grey-border bg-white">
            <h3 className="border-b border-grey-border px-4 py-3 text-sm font-semibold text-navy">By role</h3>
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  {['Role', 'Late', 'Absent', 'Leave'].map((h) => <th key={h} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {byRole.map((r) => {
                  const worst = Math.max(...byRole.map((x) => x.late + x.absent));
                  return (
                    <tr key={r.role} className="border-t border-grey-border">
                      <td className="px-4 py-2 text-sm text-navy">
                        {r.role === 'Front Desk Officer' ? 'Front Desk' : r.role}
                        <span className="ml-1 text-[11px] text-gray-400">({r.staff})</span>
                        {worst > 0 && r.late + r.absent === worst && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Most</span>}
                      </td>
                      <td className="px-4 py-2 text-sm tabular-nums text-gray-600">{r.late}</td>
                      <td className="px-4 py-2 text-sm tabular-nums text-gray-600">{r.absent}</td>
                      <td className="px-4 py-2 text-sm tabular-nums text-gray-600">{r.leave}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          <section className="rounded-xl border border-grey-border bg-white px-4 py-3">
            <h3 className="mb-3 text-sm font-semibold text-navy">Weekly trend · {range.label}</h3>
            <WeeklyTrend weeks={weeks} />
          </section>
        </aside>
      </div>

      {/* Detail panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-navy-dark/30" onClick={() => setOpenKey(null)} />
          <aside className="dissolve-in relative flex h-full w-full max-w-md flex-col border-l border-grey-border bg-white">
            <div className="flex items-start gap-3 border-b border-grey-border px-5 py-4">
              <div className="flex-1">
                <p className="text-base font-semibold text-navy">{open.member.name}</p>
                <p className="text-xs text-gray-500">{open.member.role} · {shortDate(open.date)} · {open.kind === 'Late' ? 'Late arrival' : 'Absence'}</p>
              </div>
              <button type="button" onClick={() => setOpenKey(null)} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${EXCEPTION_STYLES[open.state]}`}>{open.state}</span>

              {open.kind === 'Late' ? (
                <dl className="grid grid-cols-3 gap-3 rounded-lg border border-grey-border px-4 py-3">
                  <div><dt className="text-[11px] text-gray-400">Scheduled</dt><dd className="text-sm font-semibold tabular-nums text-navy">{SCHEDULED}</dd></div>
                  <div><dt className="text-[11px] text-gray-400">Checked in</dt><dd className="text-sm font-semibold tabular-nums text-navy">{timeOf(open.checkIn)}</dd></div>
                  <div><dt className="text-[11px] text-gray-400">Delay</dt><dd className={`text-sm font-semibold tabular-nums ${open.delay > LATE_LIMIT ? 'text-red-700' : 'text-amber-700'}`}>{open.delay} min</dd></div>
                </dl>
              ) : open.leave ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
                  Approved {open.leave.type.toLowerCase()} leave, {shortDate(open.leave.from)}{open.leave.to !== open.leave.from ? ` – ${shortDate(open.leave.to)}` : ''}. No action needed.
                </p>
              ) : (
                <p className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 text-sm text-red-800">No check-in and no approved leave on this working day.</p>
              )}

              {/* Explanation */}
              {!open.leave && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Explanation</p>
                  {open.explanation?.requestedAt && (
                    <p className="text-xs text-gray-500">Requested by {open.explanation.requestedBy} · {open.explanation.requestedAt}</p>
                  )}
                  {open.explanation?.reason && (
                    <div className="rounded-lg border border-grey-border px-4 py-3">
                      <p className="text-sm font-medium text-navy">{open.explanation.reason}</p>
                      {open.explanation.note && <p className="mt-0.5 text-sm text-gray-700">“{open.explanation.note}”</p>}
                      <p className="mt-1 text-[11px] text-gray-400">Submitted by {open.explanation.submittedBy} · {open.explanation.submittedAt}</p>
                    </div>
                  )}
                  {open.explanation?.reviewedBy && (
                    <p className={`text-xs ${open.state === 'Excused' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {open.state} by {open.explanation.reviewedBy} · {open.explanation.reviewedAt}{open.explanation.reviewNote ? ` — “${open.explanation.reviewNote}”` : ''}
                    </p>
                  )}

                  {(open.state === 'Unexplained' || open.state === 'Unconfirmed' || open.state === 'Awaiting employee' || open.state === 'Needs review') && (
                    <div className="space-y-2">
                      {open.state !== 'Needs review' && (
                        <>
                          <p className="text-xs text-gray-500">
                            {open.state === 'Awaiting employee' ? `Waiting on ${open.member.name.split(' ')[0]}. If they told you in person, record it here:` : 'Record the reason, or ask the employee to submit it:'}
                          </p>
                          <select value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value as ExplanationReason })} className="w-full rounded-lg border border-grey-border px-3 py-2 text-sm text-navy" aria-label="Reason">
                            {EXPLANATION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} rows={2} placeholder="Details (optional)" className="w-full resize-y rounded-lg border border-grey-border px-3 py-2 text-sm text-navy" />
                        </>
                      )}
                      <input value={draft.reviewNote} onChange={(e) => setDraft({ ...draft, reviewNote: e.target.value })} placeholder="Decision note (optional)" className="w-full rounded-lg border border-grey-border px-3 py-2 text-sm text-navy" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => recordAndDecide(open, false)} className="flex-1 rounded-lg border border-grey-border py-2 text-sm font-medium text-gray-600 hover:border-red-300 hover:text-red-700">Not excused</button>
                        <button type="button" onClick={() => recordAndDecide(open, true)} className="flex-1 rounded-lg bg-navy py-2 text-sm font-semibold text-white hover:bg-navy-light">Excuse</button>
                      </div>
                      {!open.explanation && (
                        <button type="button" onClick={() => requestExplanation(open)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-navy py-2 text-sm font-semibold text-navy hover:bg-navy hover:text-white">
                          <Send size={14} /> Request Explanation from {open.member.name.split(' ')[0]}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="border-t border-grey-border px-5 py-3">
              <button type="button" onClick={() => onNavigate('hr-att-history', { openStaffName: open.member.name, attendanceDate: open.date })} className="text-xs font-semibold text-navy-light hover:text-navy">
                Open this day’s audit trail →
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
