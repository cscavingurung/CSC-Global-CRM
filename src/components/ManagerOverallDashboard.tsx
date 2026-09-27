import { useMemo, useState } from 'react';
import {
  GraduationCap, FileText, CheckCircle, ListChecks, ChevronRight,
  UserX, FileClock, RotateCcw, AlertTriangle, UserMinus, type LucideIcon,
} from 'lucide-react';
import GreetingBanner from './GreetingBanner';
import PeriodFilter from './PeriodFilter';
import {
  ApplicationRecord, CommissionRecord, Counselor, CounselorAvailability, CounselorStudent,
  DailyTask, IntakeStudent, NavIntent, StaffMember, StaffRole,
} from '../types';
import { dateKey, parseSubmittedAt } from '../dateTime';
import {
  daysInCurrentStatus, getClientStage, isClientInProgress, isVisaApproved, isVisaRefused,
  latestActivityDateForApp,
} from '../clientPipeline';
import { AVAILABILITY_STYLES } from '../counselorStatus';
import { PeriodKey, periodStart, periodSuffix } from '../reportPeriod';
import { CLICKABLE_CARD, CLICKABLE_ROW } from './clickable';

interface ManagerOverallDashboardProps {
  branch: string;
  /** All inputs below are already scoped to the manager's branch. */
  students: IntakeStudent[];
  counselorStudents: CounselorStudent[];
  applications: ApplicationRecord[];
  counselors: Counselor[];
  staff: StaffMember[];
  tasks: DailyTask[];
  commissions: CommissionRecord[];
  onNavigate?: (key: string, intent?: NavIntent) => void;
}

const STALE_CLIENT_HOURS = 24;
const STALE_APPLICATION_DAYS = 7;
const BRANCH_ROLES: StaffRole[] = ['Branch Manager', 'Front Desk Officer', 'Counselor', 'V/A Officer'];
const AVAILABILITIES: CounselorAvailability[] = ['Available', 'In Session', 'Away'];

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const commissionOf = (c: CommissionRecord) => (c.fullFee * c.commissionRate) / 100;

function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-navy">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && (
          <button type="button" onClick={action.onClick} className="inline-flex items-center gap-1 text-xs font-medium text-navy-light hover:text-navy flex-shrink-0">
            {action.label} <ChevronRight size={14} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Branch Manager's overall dashboard — one screen summarising every area of the new menu:
 * operations (client pipeline), daily tasks, the team (HRM), finances and what needs the
 * manager's attention. Every tile links through to the sub-tab that owns the detail.
 */
export default function ManagerOverallDashboard({
  branch, students, counselorStudents, applications, counselors, staff, tasks, commissions, onNavigate,
}: ManagerOverallDashboardProps) {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const go = (key: string, intent?: NavIntent) => onNavigate?.(key, intent);

  const now = useMemo(() => new Date(), []);
  const start = useMemo(() => periodStart(period, now), [period, now]);
  const suffix = periodSuffix(period);
  const inPeriod = (d: Date | null) => !start || (!!d && d >= start);

  // ── Operations: client pipeline for the period ──────────────────────────────
  const periodStudents = useMemo(
    () => students.filter((s) => inPeriod(parseSubmittedAt(s.submittedAt))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, start]
  );
  const periodApplications = useMemo(
    () => applications.filter((a) => inPeriod(latestActivityDateForApp(a))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applications, start]
  );

  const pipeline = useMemo(() => {
    const periodIds = new Set(periodStudents.map((s) => s.id));
    const proceeding = counselorStudents.filter((cs) => periodIds.has(cs.id) && cs.outcome === 'Proceeding').length;
    const active = periodApplications.filter(isClientInProgress);
    const steps: { label: string; value: number; navKey: string; intent?: NavIntent }[] = [
      { label: 'New leads', value: periodStudents.length, navKey: 'students' },
      { label: 'Assigned to a counselor', value: periodStudents.filter((s) => s.status === 'Assigned').length, navKey: 'students', intent: { clientStage: 'Assigned' } },
      { label: 'Proceeding after consultation', value: proceeding, navKey: 'students', intent: { clientStage: 'Enrolled' } },
      { label: 'In offer stage', value: active.filter((a) => getClientStage(a) === 'Offer').length, navKey: 'applications', intent: { appStage: 'Offer' } },
      { label: 'In visa stage', value: active.filter((a) => getClientStage(a) === 'Visa').length, navKey: 'applications', intent: { appStage: 'Visa' } },
      { label: 'Visa approved', value: periodApplications.filter(isVisaApproved).length, navKey: 'applications', intent: { appStage: 'Visa' } },
    ];
    return steps;
  }, [periodStudents, periodApplications, counselorStudents]);

  const approved = periodApplications.filter(isVisaApproved).length;
  const refused = periodApplications.filter(isVisaRefused).length;
  const successRate = approved + refused > 0 ? Math.round((approved / (approved + refused)) * 100) : null;
  const inProgress = periodApplications.filter(isClientInProgress).length;

  // ── Daily tasks (always today) ──────────────────────────────────────────────
  const todayTasks = useMemo(() => tasks.filter((t) => t.date === dateKey(now)), [tasks, now]);
  const tasksDone = todayTasks.filter((t) => t.status === 'Done').length;
  const tasksByRole = useMemo(() => {
    const roles = Array.from(new Set(todayTasks.map((t) => t.assignee ?? t.assignedRole)));
    return roles.map((role) => {
      const mine = todayTasks.filter((t) => (t.assignee ?? t.assignedRole) === role);
      return { role, total: mine.length, done: mine.filter((t) => t.status === 'Done').length };
    }).sort((a, b) => b.total - a.total);
  }, [todayTasks]);

  // ── Team (HRM) ─────────────────────────────────────────────────────────────
  const activeStaff = staff.filter((s) => s.status === 'Active');
  const inactiveStaff = staff.filter((s) => s.status !== 'Active');
  const workload = useMemo(
    () => [...counselors].sort((a, b) => b.activeAssignments - a.activeAssignments).slice(0, 5),
    [counselors]
  );
  const maxLoad = Math.max(1, ...workload.map((c) => c.activeAssignments));

  // ── Finance (commission records carry no date, so these are all-time) ──────
  const finance = useMemo(() => {
    const totalFees = commissions.reduce((sum, c) => sum + c.fullFee, 0);
    const earned = commissions.filter((c) => c.commissionStatus === 'Paid').reduce((sum, c) => sum + commissionOf(c), 0);
    const pending = commissions.filter((c) => c.commissionStatus === 'Pending').reduce((sum, c) => sum + commissionOf(c), 0);
    const byCounselor = new Map<string, number>();
    commissions.forEach((c) => byCounselor.set(c.consultant, (byCounselor.get(c.consultant) ?? 0) + c.fullFee));
    const topCounselors = [...byCounselor].map(([name, fees]) => ({ name, fees })).sort((a, b) => b.fees - a.fees).slice(0, 4);
    return { totalFees, earned, pending, topCounselors };
  }, [commissions]);
  const maxFees = Math.max(1, ...finance.topCounselors.map((c) => c.fees));

  // ── Needs your attention ────────────────────────────────────────────────────
  const attention = useMemo(() => {
    const staleClients = students.filter((s) => {
      if (s.status !== 'New') return false;
      const submitted = parseSubmittedAt(s.submittedAt);
      return !!submitted && (now.getTime() - submitted.getTime()) / 3_600_000 > STALE_CLIENT_HOURS;
    }).length;
    const stuckApps = applications.filter((a) => isClientInProgress(a) && daysInCurrentStatus(a, now) >= STALE_APPLICATION_DAYS).length;
    const refunds = applications.filter((a) => a.visaApplication?.refundRequested).length;
    const urgentTasks = todayTasks.filter((t) => t.priority === 'High' && t.status !== 'Done').length;
    const rows: { key: string; icon: LucideIcon; tone: string; label: string; count: number; navKey: string; intent?: NavIntent }[] = [
      { key: 'clients', icon: UserX, tone: 'bg-orange-50 text-orange-600', label: `Clients unassigned over ${STALE_CLIENT_HOURS} hrs`, count: staleClients, navKey: 'students', intent: { clientStage: 'New' } },
      { key: 'apps', icon: FileClock, tone: 'bg-navy/5 text-navy', label: `Applications stuck ${STALE_APPLICATION_DAYS}+ days`, count: stuckApps, navKey: 'applications' },
      { key: 'refunds', icon: RotateCcw, tone: 'bg-purple-50 text-purple-600', label: 'Refund requests awaiting approval', count: refunds, navKey: 'approvals' },
      { key: 'tasks', icon: AlertTriangle, tone: 'bg-red-50 text-red-600', label: 'High-priority tasks not done today', count: urgentTasks, navKey: 'daily-tasks' },
      { key: 'staff', icon: UserMinus, tone: 'bg-gray-100 text-gray-500', label: 'Inactive staff accounts', count: inactiveStaff.length, navKey: 'staff' },
    ];
    return rows;
  }, [students, applications, todayTasks, inactiveStaff.length, now]);
  const attentionTotal = attention.reduce((sum, r) => sum + r.count, 0);

  const kpis: { key: string; icon: LucideIcon; value: string; label: string; hint: string; navKey: string; intent?: NavIntent }[] = [
    { key: 'clients', icon: GraduationCap, value: String(periodStudents.length), label: `Clients · ${suffix}`, hint: `${periodStudents.filter((s) => s.status === 'New').length} still unassigned`, navKey: 'students' },
    { key: 'apps', icon: FileText, value: String(inProgress), label: 'Applications In Progress', hint: `${pipeline[3].value} offer · ${pipeline[4].value} visa`, navKey: 'applications' },
    { key: 'visa', icon: CheckCircle, value: successRate === null ? '—' : `${successRate}%`, label: 'Visa Success Rate', hint: `${approved} approved · ${refused} refused`, navKey: 'applications', intent: { appStage: 'Visa' } },
    { key: 'tasks', icon: ListChecks, value: `${tasksDone}/${todayTasks.length}`, label: "Today's Tasks Done", hint: todayTasks.length === 0 ? 'No tasks set for today' : `${todayTasks.length - tasksDone} remaining`, navKey: 'daily-tasks' },
  ];

  const leads = Math.max(1, pipeline[0].value);

  return (
    <div className="space-y-6">
      <GreetingBanner />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">{branch} branch</p>
          <p className="text-xs text-gray-400">Client and application figures for {suffix.toLowerCase()}</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button key={k.key} type="button" onClick={() => go(k.navKey, k.intent)} className={`stat-card ${CLICKABLE_CARD}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-lg bg-navy/5 flex items-center justify-center">
                  <Icon className="text-navy" size={22} />
                </div>
                <ChevronRight size={18} className="text-gray-300 transition-colors group-hover:text-navy" />
              </div>
              <p className="text-3xl font-bold text-navy">{k.value}</p>
              <p className="text-sm text-gray-500 mt-1">{k.label}</p>
              <p className="text-xs mt-2 text-gray-400">{k.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Pipeline + attention */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <SectionCard title="Client Pipeline" subtitle={`From new lead to visa approval · ${suffix}`} action={{ label: 'Operations', onClick: () => go('overview') }}>
            <div className="space-y-1">
              {pipeline.map((step) => (
                <button key={step.label} type="button" onClick={() => go(step.navKey, step.intent)} className={`block py-2 ${CLICKABLE_ROW}`}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-navy">{step.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-navy">{step.value}</span>
                      <span className="text-xs text-gray-400 w-10 text-right">{Math.round((step.value / leads) * 100)}%</span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-grey-bg overflow-hidden">
                    <div className="h-full rounded-full bg-navy transition-all" style={{ width: `${Math.min(100, (step.value / leads) * 100)}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <SectionCard
            title="Needs Your Attention"
            subtitle={attentionTotal === 0 ? 'All clear' : `${attentionTotal} item${attentionTotal === 1 ? '' : 's'} across the branch`}
            action={{ label: 'Approval Center', onClick: () => go('approvals') }}
          >
            <div>
              {attention.map((row) => {
                const Icon = row.icon;
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => go(row.navKey, row.intent)}
                    className={`flex items-center gap-3 py-2.5 border-b border-grey-border last:border-0 ${CLICKABLE_ROW}`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${row.tone}`}><Icon size={15} /></span>
                    <span className={`flex-1 text-sm ${row.count > 0 ? 'text-navy' : 'text-gray-400'}`}>{row.label}</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${row.count > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                      {row.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Team + tasks + finance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Team Snapshot" subtitle={`${activeStaff.length} active staff`} action={{ label: 'HRM', onClick: () => go('staff') }}>
          <div className="flex flex-wrap gap-2 mb-4">
            {BRANCH_ROLES.map((role) => (
              <span key={role} className="text-xs font-medium px-2.5 py-1 rounded-full bg-navy/10 text-navy">
                {role} · {activeStaff.filter((s) => s.role === role).length}
              </span>
            ))}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Counselor availability</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {AVAILABILITIES.map((a) => (
              <span key={a} className={`text-xs font-medium px-2.5 py-1 rounded-full ${AVAILABILITY_STYLES[a]}`}>
                {a} · {counselors.filter((c) => c.availability === a).length}
              </span>
            ))}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Active clients per counselor</p>
          {workload.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No counselors in this branch.</p>
          ) : (
            workload.map((c) => (
              <button key={c.id} type="button" onClick={() => go('staff', { openStaffName: c.name })} className={`block py-1.5 ${CLICKABLE_ROW}`}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-navy truncate">{c.name}</span>
                  <span className="font-semibold text-navy">{c.activeAssignments}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-grey-bg overflow-hidden">
                  <div className="h-full rounded-full bg-navy-light" style={{ width: `${(c.activeAssignments / maxLoad) * 100}%` }} />
                </div>
              </button>
            ))
          )}
        </SectionCard>

        <SectionCard title="Daily Tasks" subtitle="Today’s progress by owner" action={{ label: 'Task Board', onClick: () => go('daily-tasks') }}>
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-navy">{tasksDone} of {todayTasks.length} done</span>
              <span className="text-xs text-gray-400">{todayTasks.length ? Math.round((tasksDone / todayTasks.length) * 100) : 0}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-grey-bg overflow-hidden">
              <div className="h-full rounded-full bg-navy" style={{ width: `${todayTasks.length ? (tasksDone / todayTasks.length) * 100 : 0}%` }} />
            </div>
          </div>
          {tasksByRole.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No tasks set for today.</p>
          ) : (
            tasksByRole.map((r) => (
              <button key={r.role} type="button" onClick={() => go('daily-tasks')} className={`flex items-center justify-between py-2 border-b border-grey-border last:border-0 ${CLICKABLE_ROW}`}>
                <span className="text-sm text-navy truncate">{r.role === 'Anyone' ? 'Anyone in branch' : r.role}</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.done === r.total ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                  {r.done}/{r.total}
                </span>
              </button>
            ))
          )}
        </SectionCard>

        <SectionCard title="Financial Snapshot" subtitle="All-time, from commission records" action={{ label: 'Finance', onClick: () => go('fin-dashboard') }}>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Total fees', value: money(finance.totalFees), tone: 'text-navy' },
              { label: 'Commission paid', value: money(finance.earned), tone: 'text-green-600' },
              { label: 'Commission pending', value: money(finance.pending), tone: 'text-amber-600' },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-grey-border p-3">
                <p className={`text-base font-bold ${m.tone} truncate`}>{m.value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{m.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Fees by counselor</p>
          {finance.topCounselors.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No commission records yet.</p>
          ) : (
            finance.topCounselors.map((c) => (
              <button key={c.name} type="button" onClick={() => go('fin-revenue-counselor')} className={`block py-1.5 ${CLICKABLE_ROW}`}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-navy truncate">{c.name}</span>
                  <span className="font-semibold text-navy">{money(c.fees)}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-grey-bg overflow-hidden">
                  <div className="h-full rounded-full bg-navy-light" style={{ width: `${(c.fees / maxFees) * 100}%` }} />
                </div>
              </button>
            ))
          )}
        </SectionCard>
      </div>
    </div>
  );
}
