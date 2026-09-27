import { useMemo } from 'react';
import { ArrowRight, CalendarCheck, Clock, UserMinus, UserPlus, Users } from 'lucide-react';
import {
  AttendanceCorrection, AttendanceExplanation, AttendanceRecord, Holiday, LeaveRecord, NavIntent, OffboardingCase, OnboardingCase, PayrollRun,
  StaffMember,
} from '../types';
import { DAY_STATUS_STYLES, DayStatus, dayView } from '../attendance';
import { CLEARANCE_DEPTS, WorkloadSources, overdueOnboardingTasks, workloadOf, workloadTotal } from '../hrCases';
import { monthKey, monthLabel } from '../payroll';
import { dateKey } from '../dateTime';

// ─── HRM · HR Dashboard ─────────────────────────────────────────────────────
// The Branch Manager's HR landing page. It only aggregates — every figure comes live from
// Attendance, Leave, Onboarding & Offboarding and Payroll Inputs, scoped to this branch — and
// every item links to the page where it's handled.

interface HrDashboardPageProps {
  /** Branch staff (all statuses). */
  staff: StaffMember[];
  attendance: AttendanceRecord[];
  corrections: AttendanceCorrection[];
  explanations: AttendanceExplanation[];
  leave: LeaveRecord[];
  holidays: Holiday[];
  onboarding: OnboardingCase[];
  offboarding: OffboardingCase[];
  runs: PayrollRun[];
  sources: WorkloadSources;
  onNavigate: (key: string, intent?: NavIntent) => void;
}

type Severity = 'red' | 'orange' | 'amber';
interface Attention { key: string; severity: Severity; text: React.ReactNode; detail?: string; to: string; intent?: NavIntent }

const SEVERITY: Record<Severity, { dot: string; label: string }> = {
  red: { dot: 'bg-red-500', label: 'Urgent' },
  orange: { dot: 'bg-orange-500', label: 'Overdue' },
  amber: { dot: 'bg-amber-400', label: 'Waiting on you' },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const shortDate = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function Panel({ title, icon, link, onLink, children }: { title: string; icon: React.ReactNode; link?: string; onLink?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-grey-border bg-white">
      <div className="flex items-center gap-2 border-b border-grey-border px-5 py-3">
        <span className="text-gray-400">{icon}</span>
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        {link && onLink && (
          <button type="button" onClick={onLink} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-navy-light hover:text-navy">
            {link} <ArrowRight size={12} />
          </button>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, tone = 'text-navy', onClick }: { label: string; value: number; tone?: string; onClick?: () => void }) {
  const body = (
    <>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${value === 0 ? 'text-gray-300' : tone}`}>{value}</p>
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className="rounded-lg border border-grey-border px-3 py-2 text-left hover:border-navy-light/50">{body}</button>
    : <div className="rounded-lg border border-grey-border px-3 py-2">{body}</div>;
}

export default function HrDashboardPage({
  staff, attendance, corrections, explanations, leave, holidays, onboarding, offboarding, runs, sources, onNavigate,
}: HrDashboardPageProps) {
  const now = useMemo(() => new Date(), []);
  const today = dateKey(now);
  const in7 = dateKey(new Date(now.getTime() + 7 * 86_400_000));
  const active = staff.filter((s) => s.status === 'Active' && s.role !== 'Super Admin');

  // ── Today ──
  const views = active.map((m) => ({ m, v: dayView(m.name, today, attendance, leave, now, holidays) }));
  const count = (...s: DayStatus[]) => views.filter((x) => s.includes(x.v.status)).length;
  const present = views.filter((x) => x.v.record?.checkIn).length;
  const late = count('Late', 'Very Late');
  const absent = views.filter((x) => x.v.status === 'Absent');
  const onLeaveToday = views.filter((x) => x.v.status === 'On Leave');
  const notIn = views.filter((x) => x.v.status === 'Not in yet');
  const holidayToday = views.find((x) => x.v.holiday)?.v.holiday;

  // ── Leave ──
  const pendingLeave = leave.filter((l) => l.status === 'Pending');
  const upcoming = leave.filter((l) => l.status === 'Approved' && l.from > today && l.from <= in7);

  // ── Requests ──
  const pendingCorrections = corrections.filter((c) => c.status === 'Pending');
  const explanationsToReview = explanations.filter((e) => e.status === 'Submitted');

  // ── Employee status ──
  const openOnboarding = onboarding.filter((c) => !c.completedAt);
  const newEmployees = onboarding.filter((c) => c.startDate <= today && (now.getTime() - new Date(`${c.startDate}T00:00:00`).getTime()) / 86_400_000 <= 30);
  const leaving = offboarding.filter((c) => !c.finalizedAt);
  const inactive = staff.filter((s) => s.status !== 'Active');

  // ── Onboarding / offboarding ──
  const pendingOnbTasks = openOnboarding.reduce((n, c) => n + c.tasks.filter((t) => !t.doneAt).length, 0);
  const overdueOnb = openOnboarding.flatMap((c) => overdueOnboardingTasks(c, today).map((t) => ({ c, t })));
  const handovers = leaving.map((c) => ({ c, n: workloadTotal(workloadOf(c.employeeName, sources)) }));
  const pendingHandover = handovers.reduce((n, h) => n + h.n, 0);
  const clearancePending = leaving.map((c) => ({ c, missing: CLEARANCE_DEPTS.filter((d) => !c.clearance[d]) })).filter((x) => x.missing.length);
  const accessOpen = leaving.filter((c) => c.tasks.some((t) => t.kind === 'access' && !t.doneAt));

  // ── Payroll ──
  const thisMonth = monthKey(now);
  const run = runs.find((r) => r.month === thisMonth);
  const monthEndSoon = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() <= 5;

  // ── Attention required ──
  const attention: Attention[] = [
    ...(absent.length ? [{
      key: 'absent', severity: 'red' as const, to: 'hr-att-today', intent: absent.length === 1 ? { openStaffName: absent[0].m.name } : undefined,
      text: <><b>{plural(absent.length, 'employee has', 'employees have')}</b> not checked in today</>,
      detail: `${absent.map((x) => x.m.name).join(', ')} · no leave recorded`,
    }] : []),
    ...(pendingLeave.length ? [{
      key: 'leave', severity: 'amber' as const, to: 'hr-leave',
      text: <><b>{plural(pendingLeave.length, 'leave request')}</b> pending approval</>,
      detail: pendingLeave.map((l) => `${l.staffName.split(' ')[0]} (${l.type}, ${shortDate(l.from)})`).join(', '),
    }] : []),
    ...(pendingCorrections.length ? [{
      key: 'corr', severity: 'amber' as const, to: 'hr-att-corrections',
      text: <><b>{plural(pendingCorrections.length, 'attendance correction')}</b> awaiting approval</>,
      detail: pendingCorrections.map((c) => `${c.staffName.split(' ')[0]} — ${c.field === 'checkOut' ? 'check-out' : 'check-in'} ${shortDate(c.date)}`).join(', '),
    }] : []),
    ...(explanationsToReview.length ? [{
      key: 'expl', severity: 'amber' as const, to: 'hr-att-late',
      text: <><b>{plural(explanationsToReview.length, 'absence/late explanation')}</b> to review</>,
      detail: explanationsToReview.map((e) => `${e.staffName.split(' ')[0]} (${e.kind.toLowerCase()}, ${shortDate(e.date)})`).join(', '),
    }] : []),
    ...(overdueOnb.length ? [{
      key: 'onb', severity: 'orange' as const, to: 'hr-onboarding',
      text: <><b>{plural(overdueOnb.length, 'onboarding task')}</b> overdue</>,
      detail: overdueOnb.map(({ c, t }) => `${c.employeeName.split(' ')[0]}: “${t.label}” (${t.stage})`).join(' · '),
    }] : []),
    ...(clearancePending.length ? [{
      key: 'clear', severity: 'orange' as const, to: 'hr-onboarding',
      text: <><b>{plural(clearancePending.length, 'employee')}</b> offboarding clearance pending</>,
      detail: clearancePending.map((x) => `${x.c.employeeName.split(' ')[0]} — waiting on ${x.missing.join(', ')}`).join(' · '),
    }] : []),
    ...handovers.filter((h) => h.n > 0).map((h) => ({
      key: `ho-${h.c.id}`, severity: (h.c.lastWorkingDay <= in7 ? 'orange' : 'amber') as Severity, to: 'hr-onboarding',
      text: <><b>{plural(h.n, 'client/work item')}</b> still to hand over from {h.c.employeeName}</>,
      detail: `Last working day ${shortDate(h.c.lastWorkingDay)}`,
    })),
    ...(monthEndSoon && run?.status !== 'Submitted' && run?.status !== 'Processed' ? [{
      key: 'pay', severity: 'amber' as const, to: 'hr-payroll',
      text: <><b>{monthLabel(thisMonth)} payroll inputs</b> not yet submitted to Finance</>,
      detail: 'Month end is within 5 days',
    }] : []),
  ];
  const ORDER: Severity[] = ['red', 'orange', 'amber'];
  attention.sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));

  const topCards = [
    { label: 'Total Staff', value: active.length, icon: <Users size={14} />, tone: 'text-navy', to: 'staff' },
    { label: 'Present Today', value: present, icon: <Clock size={14} />, tone: 'text-emerald-600', to: 'hr-att-today', hint: `of ${active.length}` },
    { label: 'On Leave', value: onLeaveToday.length, icon: <CalendarCheck size={14} />, tone: 'text-blue-600', to: 'hr-leave' },
    {
      label: 'Pending Requests', value: pendingLeave.length + pendingCorrections.length, icon: <ArrowRight size={14} />, tone: 'text-amber-600', to: 'hr-leave',
      hint: `${plural(pendingLeave.length, 'leave')} · ${plural(pendingCorrections.length, 'correction')}`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* 1 — Staff overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {topCards.map((c) => (
          <button key={c.label} type="button" onClick={() => onNavigate(c.to)} className="rounded-xl border border-grey-border bg-white px-4 py-3 text-left transition-colors hover:border-navy-light/40">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">{c.icon}{c.label}</p>
            <p className={`mt-0.5 text-3xl font-semibold tabular-nums ${c.value === 0 ? 'text-gray-300' : c.tone}`}>{c.value}</p>
            {c.hint && <p className="text-[11px] text-gray-400">{c.hint}</p>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-grey-border bg-white px-5 py-3 text-sm">
        <span className="text-xs font-semibold text-gray-500">Employee status</span>
        {[
          { label: 'Active', value: active.length, cls: 'bg-emerald-50 text-emerald-700' },
          { label: 'New', value: newEmployees.length, cls: 'bg-blue-50 text-blue-700', title: 'Started in the last 30 days' },
          { label: 'Leaving', value: leaving.length, cls: 'bg-amber-50 text-amber-700', title: 'Open offboarding cases' },
          { label: 'Inactive', value: inactive.length, cls: 'bg-gray-100 text-gray-600', title: 'Former employees — records kept' },
        ].map((s) => (
          <span key={s.label} title={s.title} className="inline-flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
            <span className="font-semibold tabular-nums text-navy">{s.value}</span>
          </span>
        ))}
      </div>

      {/* 5 — Attention required (most prominent) */}
      <section className={`rounded-xl border bg-white ${attention.some((a) => a.severity === 'red') ? 'border-red-200' : 'border-grey-border'}`}>
        <div className="flex items-center gap-2 border-b border-grey-border px-5 py-3">
          <span className={`h-2.5 w-2.5 rounded-full ${attention.length ? 'bg-red-500' : 'bg-emerald-500'}`} aria-hidden="true" />
          <h2 className="text-base font-semibold text-navy">Attention Required</h2>
          <span className="rounded-full bg-grey-bg px-2 py-0.5 text-xs font-medium text-gray-600">{attention.length}</span>
          <span className="ml-auto hidden gap-3 text-[11px] text-gray-400 sm:flex">
            {ORDER.map((s) => <span key={s} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${SEVERITY[s].dot}`} />{SEVERITY[s].label}</span>)}
          </span>
        </div>
        {attention.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Nothing needs your attention — HR is in order.</p>
        ) : (
          <ul className="divide-y divide-grey-border">
            {attention.map((a) => (
              <li key={a.key}>
                <button type="button" onClick={() => onNavigate(a.to, a.intent)} className="group flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-grey-bg/50">
                  <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${SEVERITY[a.severity].dot}`} aria-label={SEVERITY[a.severity].label} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-navy">{a.text}</span>
                    {a.detail && <span className="block truncate text-xs text-gray-500">{a.detail}</span>}
                  </span>
                  <span className="mt-0.5 inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-navy-light opacity-70 group-hover:opacity-100">Open <ArrowRight size={12} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2 — Main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 3 — Today's attendance & leave */}
        <Panel title="Today’s Attendance & Leave" icon={<Clock size={16} />} link="View details" onLink={() => onNavigate('hr-att-today')}>
          {holidayToday && <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">Today is a holiday — {holidayToday.name}.</p>}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Staff', value: active.length, cls: 'bg-grey-bg text-navy' },
              { label: 'Present', value: present, cls: DAY_STATUS_STYLES.Present },
              { label: 'Late', value: late, cls: DAY_STATUS_STYLES.Late },
              { label: 'Absent', value: absent.length, cls: DAY_STATUS_STYLES.Absent },
              { label: 'On Leave', value: onLeaveToday.length, cls: DAY_STATUS_STYLES['On Leave'] },
              { label: 'Not Checked In', value: notIn.length, cls: DAY_STATUS_STYLES['Not in yet'] },
            ].map((s) => (
              <span key={s.label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${s.value === 0 && s.label !== 'Staff' ? 'bg-gray-50 text-gray-400' : s.cls}`}>
                {s.label} <b className="tabular-nums">{s.value}</b>
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">Present includes late arrivals.</p>

          <div className="mt-4 divide-y divide-grey-border border-t border-grey-border">
            {[
              { label: 'Pending leave requests', list: pendingLeave.map((l) => `${l.staffName} · ${l.type} ${shortDate(l.from)}`), tone: 'text-amber-700' },
              { label: 'On leave today', list: onLeaveToday.map((x) => `${x.m.name}${x.v.leave ? ` · ${x.v.leave.type}` : ''}`), tone: 'text-blue-700' },
              { label: 'Upcoming leave (7 days)', list: upcoming.map((l) => `${l.staffName} · ${l.type} ${shortDate(l.from)}`), tone: 'text-navy' },
            ].map((row) => (
              <div key={row.label} className="flex gap-3 py-2.5">
                <span className={`w-6 flex-shrink-0 text-right text-sm font-semibold tabular-nums ${row.list.length ? row.tone : 'text-gray-300'}`}>{row.list.length}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-navy">{row.label}</span>
                  {row.list.length > 0 && <span className="block text-xs text-gray-500">{row.list.join(' · ')}</span>}
                </span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onNavigate('hr-leave')} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-navy-light hover:text-navy">
            View details in Leave Management <ArrowRight size={12} />
          </button>
        </Panel>

        {/* 4 — Onboarding & offboarding */}
        <Panel title="Onboarding & Offboarding" icon={<UserPlus size={16} />} link="View details" onLink={() => onNavigate('hr-onboarding')}>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-500"><UserPlus size={13} /> Onboarding</p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="New employees onboarding" value={openOnboarding.length} />
            <Stat label="Pending onboarding tasks" value={pendingOnbTasks} tone="text-amber-600" />
            <Stat label="Overdue onboarding tasks" value={overdueOnb.length} tone="text-orange-600" />
          </div>
          <p className="mb-2 mt-4 flex items-center gap-1.5 text-xs font-semibold text-gray-500"><UserMinus size={13} /> Offboarding</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Currently leaving" value={leaving.length} tone="text-amber-600" />
            <Stat label="Pending client handovers" value={pendingHandover} tone="text-amber-600" />
            <Stat label="Pending clearances" value={clearancePending.reduce((n, x) => n + x.missing.length, 0)} tone="text-orange-600" />
            <Stat label="Access not yet disabled" value={accessOpen.length} tone="text-red-600" />
          </div>
          {leaving.length > 0 && (
            <ul className="mt-3 space-y-1">
              {leaving.map((c) => (
                <li key={c.id} className="text-xs text-gray-500">
                  <span className="font-medium text-navy">{c.employeeName}</span> · {c.code} · last day {shortDate(c.lastWorkingDay)}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
