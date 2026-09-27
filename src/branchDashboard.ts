// Branch Manager Dashboard — "what is happening in my branch today, and what needs my attention?"
// Pure functions over data App.tsx has already scoped to the manager's branch. Every figure
// carries the /manager/... path it opens; `resolveManagerPath()` turns a path into the CRM page.
import {
  ApplicationRecord, AttendanceCorrection, AttendanceRecord, BranchDayLog, BranchIssue, BranchTransfer, ContentRequest,
  CounselorStudent, DailyTask, ExpenseRequest, FinTransaction, Holiday, IntakeStudent, LeaveRecord, NavIntent, StaffMember,
} from './types';
import { dateKey } from './dateTime';
import { dayView, DayStatus } from './attendance';
import { timeOf } from './branchOps';
import { clientBalances, isLivePayment } from './finance';
import { daysInCurrentStatus, getClientStage, isClientInProgress } from './clientPipeline';
import { collectDecisions } from './approvals';

export interface BranchDashboardSources {
  branch: string;
  intakes: IntakeStudent[];
  consultations: CounselorStudent[];
  applications: ApplicationRecord[];
  staff: StaffMember[];
  tasks: DailyTask[];
  attendance: AttendanceRecord[];
  leave: LeaveRecord[];
  corrections: AttendanceCorrection[];
  dayLogs: BranchDayLog[];
  holidays: Holiday[];
  transactions: FinTransaction[];
  expenses: ExpenseRequest[];
  issues: BranchIssue[];
  /** Marketing's content requests addressed to this branch. */
  directives: ContentRequest[];
  /** Inter-branch transfers into or out of this branch. */
  transfers: BranchTransfer[];
}

export const APPLICATION_OVERDUE_DAYS = 7;

/** "Rs 250K", "Rs 1.2M". */
export function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ''));
  if (abs >= 1_000_000) return `Rs ${fmt(n / 1_000_000)}M`;
  if (abs >= 1_000) return `Rs ${fmt(n / 1_000)}K`;
  return `Rs ${Math.round(n)}`;
}

// ── Branch status ───────────────────────────────────────────────────────────
export interface BranchStatus {
  state: 'Open' | 'Closed' | 'Not Opened';
  text: string;
}

export function branchStatus(src: BranchDashboardSources, now = new Date()): BranchStatus {
  const log = src.dayLogs.find((l) => l.branch === src.branch && l.date === dateKey(now));
  const roleOf = (name?: string) => {
    const role = src.staff.find((s) => s.name === name)?.role;
    return role === 'Front Desk Officer' ? 'Front Desk' : role ?? name ?? 'staff';
  };
  if (log?.closedAt) return { state: 'Closed', text: `Closed at ${timeOf(log.closedAt)} by ${roleOf(log.closedBy)}` };
  if (log?.openedAt) return { state: 'Open', text: `Opened at ${timeOf(log.openedAt)} by ${roleOf(log.openedBy)}` };
  return { state: 'Not Opened', text: 'Opening checklist not done yet' };
}

// ── Staff today ─────────────────────────────────────────────────────────────
export interface StaffToday {
  id: string;
  name: string;
  role: string;
  status: DayStatus;
  checkIn?: string;
  pendingTasks: number;
}

export const STAFF_STATUS_STYLES: Record<DayStatus, string> = {
  Present: 'bg-emerald-100 text-emerald-800',
  Late: 'bg-amber-100 text-amber-800',
  'Very Late': 'bg-orange-100 text-orange-800',
  Absent: 'bg-red-100 text-red-800',
  'On Leave': 'bg-sky-100 text-sky-800',
  Holiday: 'bg-slate-100 text-slate-700',
  Off: 'bg-slate-100 text-slate-700',
  'Not in yet': 'bg-slate-100 text-slate-700',
};

export function staffToday(src: BranchDashboardSources, now = new Date()): StaffToday[] {
  const today = dateKey(now);
  return src.staff.filter((s) => s.status === 'Active').map((s) => {
    const v = dayView(s.name, today, src.attendance, src.leave, now, src.holidays);
    return {
      id: s.id, name: s.name, role: s.role, status: v.status, checkIn: v.record?.checkIn ? timeOf(v.record.checkIn) : undefined,
      pendingTasks: src.tasks.filter((t) => t.assignee === s.name && t.status !== 'Done' && t.date <= today).length,
    };
  }).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.name.localeCompare(b.name));
}
const ORDER: DayStatus[] = ['Absent', 'Very Late', 'Late', 'Not in yet', 'Present', 'On Leave', 'Holiday', 'Off'];
const isIn = (s: DayStatus) => s === 'Present' || s === 'Late' || s === 'Very Late';

// ── Today's appointments ────────────────────────────────────────────────────
// The CRM has no booking calendar, so "appointments" are today's client visits (new and repeat)
// plus follow-ups scheduled for today.
export type AppointmentStatus = 'Waiting' | 'With Counselor' | 'Completed' | 'Follow-up' | 'Unassigned';
export const APPOINTMENT_STYLES: Record<AppointmentStatus, string> = {
  Unassigned: 'bg-red-100 text-red-800',
  Waiting: 'bg-amber-100 text-amber-800',
  'With Counselor': 'bg-sky-100 text-sky-800',
  'Follow-up': 'bg-violet-100 text-violet-800',
  Completed: 'bg-emerald-100 text-emerald-800',
};

export interface Appointment {
  id: string;
  time: string;
  sortKey: string;
  client: string;
  counselor: string;
  status: AppointmentStatus;
  kind: 'Visit' | 'Follow-up';
}

export function appointmentsToday(src: BranchDashboardSources, now = new Date()): Appointment[] {
  const today = dateKey(now);
  const out: Appointment[] = [];
  src.intakes.forEach((s) => {
    const visit = [s.revisitedAt, s.visitDateTime, s.submittedAt].find((v) => v?.startsWith(today));
    if (!visit) return;
    const cs = src.consultations.find((c) => c.id === s.id);
    const counselor = cs?.assignedCounselor ?? s.assignedCounselor;
    const status: AppointmentStatus = !counselor ? 'Unassigned'
      : cs?.consultationStatus === 'Consultation Complete' || cs?.completedDate === today ? 'Completed'
        : cs && cs.consultationStatus !== 'Awaiting Consultation' ? 'With Counselor' : 'Waiting';
    out.push({ id: `v-${s.id}`, time: timeOf(visit) || '—', sortKey: visit, client: s.name, counselor: counselor ?? '—', status, kind: 'Visit' });
  });
  src.consultations.filter((c) => c.followUpDate === today && c.outcome === 'Pending' && !out.some((o) => o.id === `v-${c.id}`)).forEach((c) => {
    out.push({ id: `f-${c.id}`, time: 'Any time', sortKey: `${today} ~`, client: c.name, counselor: c.assignedCounselor, status: 'Follow-up', kind: 'Follow-up' });
  });
  return out.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

// ── Snapshot ────────────────────────────────────────────────────────────────
export interface SnapshotCard {
  key: string;
  label: string;
  value: string;
  hint: string;
  tone?: 'red' | 'amber' | 'green';
  path: string;
}

const overdueFollowUps = (src: BranchDashboardSources, today: string) =>
  src.consultations.filter((c) => c.outcome === 'Pending' && c.followUpDate && c.followUpDate < today);
const dueFollowUps = (src: BranchDashboardSources, today: string) =>
  src.consultations.filter((c) => c.outcome === 'Pending' && c.followUpDate && c.followUpDate <= today);
/** Assigned but not picked up: no counselor record yet, or still awaiting consultation after a day. */
const uncontacted = (src: BranchDashboardSources, today: string) => src.intakes.flatMap((s) => {
  if (!s.assignedCounselor) return [];
  const cs = src.consultations.find((c) => c.id === s.id);
  if (cs && cs.consultationStatus !== 'Awaiting Consultation') return [];
  const since = cs?.assignedDate ?? s.submittedAt.slice(0, 10);
  return since < today ? [{ name: s.name, counselor: cs?.assignedCounselor ?? s.assignedCounselor }] : [];
});
const balances = (src: BranchDashboardSources, today: string) => clientBalances(src.transactions, today).filter((b) => b.outstanding > 0);

export function snapshot(src: BranchDashboardSources, now = new Date()): SnapshotCard[] {
  const today = dateKey(now);
  const people = staffToday(src, now);
  const working = people.filter((p) => !['Holiday', 'Off', 'On Leave'].includes(p.status));
  const present = people.filter((p) => isIn(p.status)).length;
  const absent = people.filter((p) => p.status === 'Absent').length;
  const late = people.filter((p) => p.status === 'Late' || p.status === 'Very Late').length;
  const appts = appointmentsToday(src, now);
  const newToday = src.intakes.filter((s) => s.submittedAt.startsWith(today));
  const unassigned = src.intakes.filter((s) => s.status === 'New').length;
  const due = dueFollowUps(src, today);
  const overdue = overdueFollowUps(src, today).length;
  const active = src.applications.filter(isClientInProgress);
  const collected = src.transactions.filter((t) => isLivePayment(t) && t.at.startsWith(today)).reduce((n, t) => n + t.amount, 0);
  const owed = balances(src, today);
  const owedTotal = owed.reduce((n, b) => n + b.outstanding, 0);
  return [
    { key: 'present', label: 'Staff Present', value: `${present}/${working.length}`, hint: late ? `${late} late` : 'On time so far', tone: late ? 'amber' : undefined, path: '/manager/hr/attendance' },
    { key: 'absent', label: 'Staff Absent', value: String(absent), hint: absent ? 'No leave recorded' : 'Everyone accounted for', tone: absent ? 'red' : 'green', path: '/manager/hr/absence' },
    { key: 'appointments', label: 'Appointments', value: String(appts.length), hint: `${appts.filter((a) => a.status === 'Completed').length} completed`, path: '/manager/appointments' },
    { key: 'leads', label: 'New Leads', value: String(newToday.length), hint: `${unassigned} waiting for a counselor`, tone: unassigned ? 'amber' : undefined, path: '/manager/leads?stage=New' },
    { key: 'followups', label: 'Follow-ups Due', value: String(due.length), hint: overdue ? `${overdue} overdue` : 'None overdue', tone: overdue ? 'red' : undefined, path: '/manager/leads?stage=Followup' },
    { key: 'apps', label: 'Active Apps', value: String(active.length), hint: `${active.filter((a) => getClientStage(a) === 'Visa').length} in visa stage`, path: '/manager/applications' },
    { key: 'collection', label: 'Today’s Collection', value: compactMoney(collected), hint: `${src.transactions.filter((t) => isLivePayment(t) && t.at.startsWith(today)).length} payments`, tone: collected ? 'green' : undefined, path: '/manager/finance/collections' },
    { key: 'outstanding', label: 'Outstanding', value: compactMoney(owedTotal), hint: `${owed.length} clients owe`, tone: owedTotal ? 'red' : undefined, path: '/manager/finance/outstanding' },
  ];
}

// ── Attention required ──────────────────────────────────────────────────────
export interface AttentionRow {
  id: string;
  severity: 'critical' | 'warning';
  text: string;
  assignee?: string;
  path: string;
}

const byPerson = <T,>(rows: T[], who: (r: T) => string) => {
  const m = new Map<string, T[]>();
  rows.forEach((r) => m.set(who(r), [...(m.get(who(r)) ?? []), r]));
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function attentionRequired(src: BranchDashboardSources, now = new Date()): AttentionRow[] {
  const today = dateKey(now);
  const out: AttentionRow[] = [];
  const status = branchStatus(src, now);
  if (status.state === 'Not Opened' && now.getHours() >= 10) {
    out.push({ id: 'opening', severity: 'critical', text: 'Branch opening checklist not completed', path: '/manager/operations/opening' });
  }
  byPerson(overdueFollowUps(src, today), (c) => c.assignedCounselor).forEach(([who, rows]) =>
    out.push({ id: `fu-${who}`, severity: rows.length >= 3 ? 'critical' : 'warning', text: plural(rows.length, 'overdue follow-up'), assignee: who, path: '/manager/leads?stage=Followup' }));
  byPerson(uncontacted(src, today), (r) => r.counselor ?? '—').forEach(([who, rows]) =>
    out.push({ id: `uc-${who}`, severity: 'warning', text: plural(rows.length, 'uncontacted lead'), assignee: who, path: '/manager/leads?stage=Assigned' }));
  const waiting = src.intakes.filter((s) => s.status === 'New' && !s.submittedAt.startsWith(today)).length;
  if (waiting) out.push({ id: 'unassigned', severity: 'warning', text: `${plural(waiting, 'lead')} waiting for a counselor since yesterday or earlier`, path: '/manager/leads?stage=New' });
  const lateApps = src.applications.filter((a) => isClientInProgress(a) && daysInCurrentStatus(a, now) >= APPLICATION_OVERDUE_DAYS);
  if (lateApps.length) out.push({ id: 'apps', severity: 'warning', text: `${plural(lateApps.length, 'application')} overdue (no update for ${APPLICATION_OVERDUE_DAYS}+ days)`, path: '/manager/applications?stale=1' });
  const absent = staffToday(src, now).filter((p) => p.status === 'Absent');
  if (absent.length) out.push({ id: 'absent', severity: 'warning', text: `${plural(absent.length, 'staff member')} absent without leave (${absent.map((p) => p.name).join(', ')})`, path: '/manager/hr/absence' });
  const pendingLeave = src.leave.filter((l) => l.status === 'Pending').length;
  if (pendingLeave) out.push({ id: 'leave', severity: 'warning', text: plural(pendingLeave, 'pending leave request'), path: '/manager/hr/leave' });
  const decisions = collectDecisions({
    leave: [], corrections: src.corrections, attendance: src.attendance, transactions: src.transactions, expenses: src.expenses,
    holidays: src.holidays, transfers: src.transfers.filter((t) => t.fromBranch === src.branch),
  }).filter((d) => d.status === 'Pending');
  if (decisions.length) out.push({ id: 'approvals', severity: decisions.some((d) => d.type === 'Refund') ? 'critical' : 'warning', text: `${plural(decisions.length, 'approval')} waiting on you (${[...new Set(decisions.map((d) => d.type))].join(', ')})`, path: '/manager/approvals' });
  const owed = balances(src, today);
  const dueToday = owed.filter((b) => b.nextDue === today).length;
  const overdue = owed.filter((b) => b.status === 'Overdue').length;
  if (dueToday) out.push({ id: 'due', severity: 'warning', text: `${plural(dueToday, 'outstanding payment')} due today`, path: '/manager/finance/outstanding' });
  if (overdue) out.push({ id: 'overdue', severity: 'critical', text: `${plural(overdue, 'client payment')} overdue`, path: '/manager/finance/outstanding' });
  const urgent = src.issues.filter((i) => i.status !== 'Resolved' && i.status !== 'Closed' && (i.priority === 'Critical' || i.priority === 'High'));
  if (urgent.length) out.push({ id: 'issues', severity: urgent.some((i) => i.priority === 'Critical') ? 'critical' : 'warning', text: `${plural(urgent.length, 'urgent issue')} open`, path: '/manager/operations/issues' });
  const undelegated = src.directives.filter((r) => r.status === 'Waiting' && !r.delegatedBy).length;
  if (undelegated) out.push({ id: 'content', severity: 'warning', text: `${plural(undelegated, 'Marketing content request')} not delegated yet`, path: '/manager/marketing?view=directives' });
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1));
}

// ── Pipeline (where active leads and clients are right now) ─────────────────
export const PIPELINE_STEPS = ['New', 'Contacted', 'Consultation', 'Client', 'Application', 'Visa'] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export function pipeline(src: BranchDashboardSources): Record<PipelineStep, number> {
  const counts = Object.fromEntries(PIPELINE_STEPS.map((s) => [s, 0])) as Record<PipelineStep, number>;
  src.intakes.forEach((s) => {
    const cs = src.consultations.find((c) => c.id === s.id);
    const app = cs?.clientId ? src.applications.find((a) => a.clientId === cs.clientId) : undefined;
    if (cs?.outcome === 'Not Proceeding') return;
    if (app) {
      if (isClientInProgress(app)) counts[getClientStage(app) === 'Visa' ? 'Visa' : 'Application'] += 1;
      return;
    }
    if (cs?.outcome === 'Proceeding') counts.Client += 1;
    else if (cs && cs.consultationStatus !== 'Awaiting Consultation') counts.Consultation += 1;
    else if (cs?.assignedCounselor ?? s.assignedCounselor) counts.Contacted += 1;
    else counts.New += 1;
  });
  return counts;
}

// ── Bottom widgets ──────────────────────────────────────────────────────────
export interface Widget {
  key: string;
  title: string;
  path: string;
  lines: { label: string; value: string; tone?: 'red' | 'amber' }[];
}

export function widgets(src: BranchDashboardSources, now = new Date()): Widget[] {
  const today = dateKey(now);
  const month = today.slice(0, 7);
  const monthCollection = src.transactions.filter((t) => isLivePayment(t) && t.at.startsWith(month)).reduce((n, t) => n + t.amount, 0);
  const refunds = src.transactions.filter((t) => t.kind === 'Refund' && (t.status === 'Pending Approval' || t.status === 'Approved'));
  const visaFiles = src.applications.filter((a) => isClientInProgress(a) && a.visaApplication);
  const waitingDocs = visaFiles.filter((a) => a.visaApplication?.status === 'Preparing Documents').length;
  const processing = visaFiles.filter((a) => a.visaApplication?.status === 'File Ready for Visa' || a.visaApplication?.status === 'Visa Applied').length;
  const openIssues = src.issues.filter((i) => i.status !== 'Resolved' && i.status !== 'Closed');
  const waitingContent = src.directives.filter((r) => r.status === 'Waiting');
  const dueContent = waitingContent.filter((r) => (r.internalDue ?? r.deadline) <= today).length;
  return [
    {
      key: 'finance', title: 'Finance', path: '/manager/finance',
      lines: [
        { label: 'Month collection', value: compactMoney(monthCollection) },
        { label: 'Pending refunds', value: refunds.length ? `${refunds.length} · ${compactMoney(refunds.reduce((n, t) => n + t.amount, 0))}` : '0', tone: refunds.length ? 'amber' : undefined },
      ],
    },
    {
      key: 'apps', title: 'Applications & Visa', path: '/manager/applications?stage=Visa',
      lines: [
        { label: 'Waiting docs', value: String(waitingDocs), tone: waitingDocs ? 'amber' : undefined },
        { label: 'Visa processing', value: String(processing) },
      ],
    },
    {
      key: 'issues', title: 'Issues & IT', path: '/manager/operations/issues',
      lines: [
        { label: 'Open issues', value: String(openIssues.length), tone: openIssues.length ? 'amber' : undefined },
        { label: 'Escalated', value: String(openIssues.filter((i) => i.escalatedTo).length), tone: openIssues.some((i) => i.escalatedTo) ? 'red' : undefined },
      ],
    },
    {
      key: 'content', title: 'Content Requests', path: '/manager/marketing?view=directives',
      lines: [
        { label: 'Waiting on branch', value: String(waitingContent.length), tone: waitingContent.length ? 'amber' : undefined },
        { label: 'Due today', value: String(dueContent), tone: dueContent ? 'red' : undefined },
      ],
    },
  ];
}

// ── /manager/... → CRM page ─────────────────────────────────────────────────
/** Translate a dashboard path into the sidebar page (and filter) that shows its detail. */
export function resolveManagerPath(pathname: string, search: string, staff: StaffMember[]): { navKey: string; intent?: NavIntent } {
  const q = new URLSearchParams(search);
  const stage = q.get('stage') ?? '';
  const staffMatch = pathname.match(/^\/manager\/hr\/staff\/(.+)$/);
  if (staffMatch) return { navKey: 'staff', intent: { openStaffName: staff.find((s) => s.id === decodeURIComponent(staffMatch[1]))?.name } };
  switch (pathname) {
    case '/manager/leads': {
      if (stage === 'Application') return { navKey: 'applications', intent: { appStage: 'Offer' } };
      if (stage === 'Visa') return { navKey: 'applications', intent: { appStage: 'Visa' } };
      const clientStage = ({ New: 'New', Contacted: 'Assigned', Assigned: 'Assigned', Consultation: 'Assigned', Followup: 'Followup', Client: 'Enrolled' } as const)[stage as 'New'];
      return { navKey: 'students', intent: clientStage ? { clientStage } : undefined };
    }
    case '/manager/appointments': return { navKey: 'front-desk-control' };
    case '/manager/applications': return { navKey: 'applications', intent: stage === 'Visa' ? { appStage: 'Visa' } : stage === 'Offer' ? { appStage: 'Offer' } : undefined };
    case '/manager/hr/attendance': return { navKey: 'hr-att-today' };
    case '/manager/hr/absence': return { navKey: 'hr-att-late' };
    case '/manager/hr/leave': return { navKey: 'hr-leave' };
    case '/manager/tasks': return { navKey: 'daily-tasks' };
    case '/manager/finance': return { navKey: 'fin-dashboard' };
    case '/manager/finance/collections': return { navKey: 'fin-collections' };
    case '/manager/finance/outstanding': return { navKey: 'fin-outstanding' };
    case '/manager/finance/refunds': return { navKey: 'fin-refunds' };
    case '/manager/operations/opening': return { navKey: 'branch-attendance' };
    case '/manager/operations/issues': return { navKey: 'issues-escalations' };
    case '/manager/approvals': return { navKey: 'approvals' };
    case '/manager/marketing': return { navKey: 'bm-marketing', intent: q.get('view') === 'directives' ? { workspacePath: '/manager/marketing/directives' } : undefined };
    case '/manager/transfers': return { navKey: 'bm-transfers', intent: { workspacePath: '/manager/transfers/inter-branch' } };
    default: return { navKey: 'bm-dashboard' };
  }
}
