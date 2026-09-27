// Super Admin Command Center — company-wide datasets, the global filter logic, dashboard metrics,
// the attention feed and the monthly report. Pure functions over App state; nothing is stored.
//
// Every number on the dashboard is a count or sum of rows from one of the DATASETS below, so a
// click on any number opens exactly the rows behind it (the "Excel view").
import {
  ApplicationRecord, AttendanceCorrection, AttendanceRecord, AuditOverrideEntry, Branch, BranchDayLog, BranchIssue,
  BranchTransfer, CounselorStudent, DailyTask, ExpenseRequest, FinTransaction, Holiday, IntakeStudent, LeaveRecord,
  MarketingLead, NavIntent, ServicePrice, StaffMember, StaffRole,
} from './types';
import { dateKey } from './dateTime';
import { clientBalances, rs } from './finance';
import { daysInCurrentStatus, getActiveOfferApplication, getClientStatusLabel } from './clientPipeline';
import { collectDecisions } from './approvals';
import { overdueDays } from './managerWorkspace';
import { appUniversityClientId } from './applicationFilters';

// ── Sources ─────────────────────────────────────────────────────────────────
export interface CommandSources {
  branches: Branch[];
  staff: StaffMember[];
  intakes: IntakeStudent[];
  consultations: CounselorStudent[];
  applications: ApplicationRecord[];
  transactions: FinTransaction[];
  expenses: ExpenseRequest[];
  marketingLeads: MarketingLead[];
  issues: BranchIssue[];
  tasks: DailyTask[];
  attendance: AttendanceRecord[];
  dayLogs: BranchDayLog[];
  leave: LeaveRecord[];
  corrections: AttendanceCorrection[];
  holidays: Holiday[];
  transfers: BranchTransfer[];
  audit: AuditOverrideEntry[];
  /** Service Charges price list (Super Admin → Finance). */
  servicePrices: ServicePrice[];
}

// ── Thresholds (raw operational rules, not scores) ──────────────────────────
export const VISA_OVERDUE_DAYS = 14;
export const APPLICATION_STALE_DAYS = 7;
export const LARGE_REFUND = 50_000;
export const TRANSFER_WAIT_DAYS = 2;

// ── Departments ─────────────────────────────────────────────────────────────
export const DEPARTMENTS = ['Counseling', 'Visa & Admissions', 'Front Desk', 'Branch Management', 'Marketing', 'Head Office'] as const;
export type Department = (typeof DEPARTMENTS)[number];
const ROLE_DEPT: Record<StaffRole, Department> = {
  Counselor: 'Counseling', 'V/A Officer': 'Visa & Admissions', 'Front Desk Officer': 'Front Desk',
  'Branch Manager': 'Branch Management', Marketing: 'Marketing', 'Super Admin': 'Head Office',
};
export const departmentOf = (role?: string) => (role && ROLE_DEPT[role as StaffRole]) || '';

// ── Global filters ──────────────────────────────────────────────────────────
export const PERIODS = ['This Month', 'Last Month', 'Last 3 Months', 'This Year', 'All Time', 'Custom'] as const;
export type Period = (typeof PERIODS)[number];
export type Dim = 'date' | 'branch' | 'country' | 'counselor' | 'department' | 'intake';

export interface GlobalFilters {
  period: Period;
  from: string;
  to: string;
  branch: string;
  country: string;
  counselor: string;
  department: string;
  intake: string;
}
export const DEFAULT_FILTERS: GlobalFilters = { period: 'This Month', from: '', to: '', branch: '', country: '', counselor: '', department: '', intake: '' };

/** Inclusive YYYY-MM-DD bounds; '' = open. */
export function periodBounds(f: Pick<GlobalFilters, 'period' | 'from' | 'to'>, now = new Date()): { from: string; to: string } {
  const today = dateKey(now);
  const monthStart = (offset: number) => dateKey(new Date(now.getFullYear(), now.getMonth() + offset, 1));
  switch (f.period) {
    case 'This Month': return { from: monthStart(0), to: today };
    case 'Last Month': return { from: monthStart(-1), to: dateKey(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case 'Last 3 Months': return { from: monthStart(-2), to: today };
    case 'This Year': return { from: `${now.getFullYear()}-01-01`, to: today };
    case 'Custom': return { from: f.from, to: f.to };
    default: return { from: '', to: '' };
  }
}

export function periodLabel(f: GlobalFilters, now = new Date()): string {
  if (f.period === 'All Time') return 'All time';
  const { from, to } = periodBounds(f, now);
  const fmt = (k: string) => new Date(`${k}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (f.period === 'Custom') return from || to ? `${from ? fmt(from) : '…'} – ${to ? fmt(to) : '…'}` : 'Custom range';
  return `${f.period} · ${fmt(from)} – ${fmt(to)}`;
}

/** Month bounds for the monthly report ("YYYY-MM"). */
export function monthFilters(month: string, branch: string): GlobalFilters {
  const [y, m] = month.split('-').map(Number);
  return { ...DEFAULT_FILTERS, period: 'Custom', from: `${month}-01`, to: dateKey(new Date(y, m, 0)), branch };
}

// ── Rows & datasets ─────────────────────────────────────────────────────────
export type CellValue = string | number;
export type ColumnKind = 'text' | 'number' | 'money' | 'date';

export interface SheetColumn {
  key: string;
  label: string;
  kind?: ColumnKind;
}

export interface SheetRow {
  id: string;
  cells: Record<string, CellValue>;
  dims: Partial<Record<Dim, string>>;
  /** Highlighted in soft red (e.g. overdue). */
  flag?: boolean;
  /** Where the record lives in the CRM. */
  open?: { navKey: string; intent?: NavIntent; label: string };
}

export type DatasetKey =
  | 'leads' | 'clients' | 'applications' | 'visa' | 'finance' | 'outstanding' | 'approvals'
  | 'tasks' | 'issues' | 'checkouts' | 'people' | 'audit';

export interface Dataset {
  key: DatasetKey;
  title: string;
  description: string;
  columns: SheetColumn[];
  /** Global filters that apply to this dataset — the rest are disabled on its view. */
  dims: Dim[];
  /** Why a filter doesn't apply (shown as a tooltip). */
  dimNotes?: Partial<Record<Dim, string>>;
  /** Columns offered as dropdown filters inside the sheet. */
  quick: string[];
  /** Label for the "flagged rows only" toggle, when the dataset flags rows. */
  flagLabel?: string;
  build: (src: CommandSources, now: Date) => SheetRow[];
}

const day = (s?: string | null) => (s ? s.slice(0, 10) : '');
const branchOfCounselor = (src: CommandSources, name?: string | null) => src.staff.find((s) => s.name === name)?.branch ?? '';
const intakeOf = (app?: ApplicationRecord) => (app ? getActiveOfferApplication(app)?.intake ?? app.offerApplications.find((o) => o.intake)?.intake ?? '' : '');
const appOf = (src: CommandSources, cs?: CounselorStudent) => (cs?.clientId ? src.applications.find((a) => a.clientId === cs.clientId) : undefined);
const sourceOf = (s: IntakeStudent) => s.platformSource ? (s.platformSource === 'Tiktok' ? 'TikTok' : s.platformSource)
  : /walk/i.test(s.referredThrough ?? '') || !s.referredThrough ? 'Walk-in' : /marketing/i.test(s.referredThrough) ? 'Marketing' : 'Referral';

const LEADS: Dataset = {
  key: 'leads',
  title: 'Leads',
  description: 'Every enquiry — walk-ins and referrals at the branches, plus Marketing leads not yet routed to one.',
  columns: [
    { key: 'name', label: 'Lead' }, { key: 'source', label: 'Source' }, { key: 'branch', label: 'Branch' },
    { key: 'country', label: 'Country' }, { key: 'counselor', label: 'Counselor' }, { key: 'received', label: 'Received', kind: 'date' },
    { key: 'status', label: 'Status' }, { key: 'qualified', label: 'Qualified' },
  ],
  dims: ['date', 'branch', 'country', 'counselor', 'intake'],
  dimNotes: { department: 'Leads are not tied to a staff department.' },
  quick: ['status', 'source', 'qualified'],
  build: (src) => [
    ...src.intakes.map((s): SheetRow => {
      const cs = src.consultations.find((c) => c.id === s.id);
      const app = appOf(src, cs);
      const counselor = cs?.assignedCounselor ?? s.assignedCounselor ?? '';
      const status = cs?.outcome === 'Proceeding' || app ? 'Converted' : cs?.outcome === 'Not Proceeding' ? 'Not Proceeding' : counselor ? 'Assigned' : 'New';
      const branch = s.branch || s.broadcastBranch || 'Unrouted';
      return {
        id: `lead-${s.id}`,
        cells: { name: s.name, source: sourceOf(s), branch, country: s.country, counselor: counselor || '—', received: day(s.submittedAt), status, qualified: counselor ? 'Yes' : 'No' },
        dims: { date: day(s.submittedAt), branch, country: s.country, counselor, intake: intakeOf(app) },
        open: { navKey: 'students', intent: { search: s.name }, label: 'Open in Clients' },
      };
    }),
    ...src.marketingLeads.filter((l) => l.stage !== 'Assigned').map((l): SheetRow => {
      const branch = l.preferredBranch || 'Unrouted';
      return {
        id: `mlead-${l.id}`,
        cells: { name: l.name, source: l.source, branch, country: l.preferredCountry ?? '—', counselor: '—', received: day(l.receivedAt), status: l.stage === 'Raw' ? 'New' : l.stage, qualified: l.stage === 'Qualified' ? 'Yes' : 'No' },
        dims: { date: day(l.receivedAt), branch, country: l.preferredCountry ?? '', intake: l.intake ?? '' },
      };
    }),
  ],
};

const CLIENTS: Dataset = {
  key: 'clients',
  title: 'Converted Clients',
  description: 'Leads who decided to proceed after consultation, and where their file stands now.',
  columns: [
    { key: 'name', label: 'Client' }, { key: 'clientId', label: 'Client ID' }, { key: 'branch', label: 'Branch' },
    { key: 'country', label: 'Country' }, { key: 'counselor', label: 'Counselor' }, { key: 'intake', label: 'Intake' },
    { key: 'universityClientId', label: 'University Client ID' }, { key: 'converted', label: 'Converted On', kind: 'date' }, { key: 'status', label: 'Current Status' },
  ],
  dims: ['date', 'branch', 'country', 'counselor', 'intake'],
  dimNotes: { department: 'Clients are not tied to a staff department.' },
  quick: ['status', 'intake'],
  build: (src) => src.consultations.flatMap((cs): SheetRow[] => {
    const app = appOf(src, cs);
    if (cs.outcome !== 'Proceeding' && !app) return [];
    const branch = app?.branch || src.intakes.find((s) => s.id === cs.id)?.branch || branchOfCounselor(src, cs.assignedCounselor);
    const converted = day(cs.completedDate ?? app?.consultationDate ?? cs.assignedDate);
    return [{
      id: `client-${cs.id}`,
      cells: { name: cs.name, clientId: cs.clientId ?? '—', branch, country: cs.country, counselor: cs.assignedCounselor, intake: intakeOf(app) || '—', universityClientId: appUniversityClientId(app) || '—', converted, status: app ? getClientStatusLabel(app) : 'Proceeding · file not opened' },
      dims: { date: converted, branch, country: cs.country, counselor: cs.assignedCounselor, intake: intakeOf(app) },
      open: { navKey: 'students', intent: { search: cs.name, branch }, label: 'Open in Clients' },
    }];
  }),
};

const APPLICATIONS: Dataset = {
  key: 'applications',
  title: 'Applications',
  description: `Client files in the offer and visa stages. Files untouched for ${APPLICATION_STALE_DAYS}+ days are flagged.`,
  columns: [
    { key: 'name', label: 'Client' }, { key: 'clientId', label: 'Client ID' }, { key: 'branch', label: 'Branch' },
    { key: 'country', label: 'Country' }, { key: 'counselor', label: 'Counselor' }, { key: 'institution', label: 'Institution' },
    { key: 'intake', label: 'Intake' }, { key: 'universityClientId', label: 'University Client ID' }, { key: 'opened', label: 'Opened', kind: 'date' }, { key: 'status', label: 'Status' },
    { key: 'days', label: 'Days in Status', kind: 'number' },
  ],
  dims: ['date', 'branch', 'country', 'counselor', 'intake'],
  dimNotes: { department: 'Applications are not tied to a staff department.' },
  quick: ['status', 'intake'],
  flagLabel: `Stale only (${APPLICATION_STALE_DAYS}+ days)`,
  build: (src, now) => src.applications.map((a): SheetRow => {
    const opened = day(a.offerApplications.map((o) => o.enrolledDate).filter(Boolean).sort()[0] ?? a.consultationDate);
    const status = getClientStatusLabel(a);
    const days = daysInCurrentStatus(a, now);
    const closed = a.withdrawn || a.visaApplication?.status === 'Visa Approved' || a.visaApplication?.status === 'Visa Refused';
    return {
      id: `app-${a.id}`,
      cells: { name: a.name, clientId: a.clientId ?? '—', branch: a.branch, country: a.country, counselor: a.counselor, institution: getActiveOfferApplication(a)?.institution ?? '—', intake: intakeOf(a) || '—', universityClientId: appUniversityClientId(a) || '—', opened, status, days },
      dims: { date: opened, branch: a.branch, country: a.country, counselor: a.counselor, intake: intakeOf(a) },
      flag: !closed && days >= APPLICATION_STALE_DAYS,
      open: { navKey: 'applications', intent: { openClientId: a.id, branch: a.branch }, label: 'Open application' },
    };
  }),
};

const VISA_FINAL = ['Visa Approved', 'Visa Refused'];
const VISA: Dataset = {
  key: 'visa',
  title: 'Visa Cases',
  description: `Every visa file. Open files sitting in one status for ${VISA_OVERDUE_DAYS}+ days are overdue. Date = decision date once decided.`,
  columns: [
    { key: 'name', label: 'Client' }, { key: 'clientId', label: 'Client ID' }, { key: 'branch', label: 'Branch' },
    { key: 'country', label: 'Country' }, { key: 'counselor', label: 'Counselor' }, { key: 'intake', label: 'Intake' },
    { key: 'universityClientId', label: 'University Client ID' }, { key: 'status', label: 'Visa Status' }, { key: 'lodged', label: 'Lodged', kind: 'date' }, { key: 'decided', label: 'Decision Date', kind: 'date' },
    { key: 'days', label: 'Days in Status', kind: 'number' },
  ],
  dims: ['date', 'branch', 'country', 'counselor', 'intake'],
  dimNotes: { department: 'Visa cases are not tied to a staff department.' },
  quick: ['status', 'intake'],
  flagLabel: `Overdue only (${VISA_OVERDUE_DAYS}+ days)`,
  build: (src, now) => src.applications.flatMap((a): SheetRow[] => {
    const v = a.visaApplication;
    if (!v) return [];
    const final = VISA_FINAL.includes(v.status);
    const days = daysInCurrentStatus(a, now);
    const date = day(final ? v.outcomeDate ?? v.statusUpdatedAt : v.appliedDate ?? v.preparingDocsDate ?? v.statusUpdatedAt);
    return [{
      id: `visa-${a.id}`,
      cells: { name: a.name, clientId: a.clientId ?? '—', branch: a.branch, country: a.country, counselor: a.counselor, intake: intakeOf(a) || '—', universityClientId: appUniversityClientId(a) || '—', status: v.status, lodged: day(v.appliedDate) || '—', decided: day(v.outcomeDate) || '—', days },
      dims: { date, branch: a.branch, country: a.country, counselor: a.counselor, intake: intakeOf(a) },
      flag: !final && !a.withdrawn && days >= VISA_OVERDUE_DAYS,
      open: { navKey: 'applications', intent: { openClientId: a.id, branch: a.branch, appStage: 'Visa' }, label: 'Open visa file' },
    }];
  }),
};

const FINANCE: Dataset = {
  key: 'finance',
  title: 'Finance Ledger',
  description: 'Payments, refunds, discounts and branch expenses. Revenue = payments − paid-out refunds; Net = revenue − approved expenses.',
  columns: [
    { key: 'date', label: 'Date', kind: 'date' }, { key: 'ref', label: 'Receipt / Ref' }, { key: 'party', label: 'Client / Payee' },
    { key: 'branch', label: 'Branch' }, { key: 'counselor', label: 'Counselor' }, { key: 'item', label: 'Service / Item' },
    { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'amount', label: 'Amount', kind: 'money' },
  ],
  dims: ['date', 'branch', 'country', 'counselor'],
  dimNotes: { intake: 'Ledger entries have no intake.', department: 'Ledger entries have no department.' },
  quick: ['type', 'status'],
  build: (src) => [
    ...src.transactions.filter((t) => !t.void && t.kind !== 'Charge' && t.kind !== 'Exception').map((t): SheetRow => ({
      id: `tx-${t.id}`,
      cells: {
        date: day(t.at), ref: t.receiptNo ?? t.id, party: t.clientName, branch: t.branch, counselor: t.counselor, item: t.title ?? t.service,
        type: t.kind, status: t.kind === 'Payment' ? 'Received' : t.status === 'Pending Approval' ? 'Pending' : t.status ?? '—', amount: t.amount,
      },
      dims: { date: day(t.at), branch: t.branch, country: t.country, counselor: t.counselor },
    })),
    ...src.expenses.map((e): SheetRow => ({
      id: `exp-${e.id}`,
      cells: { date: day(e.requestedAt), ref: e.id, party: e.requestedBy, branch: e.branch, counselor: '—', item: `${e.title} (${e.category})`, type: 'Expense', status: e.status, amount: e.amount },
      dims: { date: day(e.requestedAt), branch: e.branch },
    })),
  ],
};

const OUTSTANDING: Dataset = {
  key: 'outstanding',
  title: 'Outstanding Balances',
  description: 'What each client still owes, as of today. Overdue balances are flagged.',
  columns: [
    { key: 'name', label: 'Client' }, { key: 'clientId', label: 'Client ID' }, { key: 'branch', label: 'Branch' },
    { key: 'counselor', label: 'Counselor' }, { key: 'fee', label: 'Total Fee', kind: 'money' }, { key: 'paid', label: 'Paid', kind: 'money' },
    { key: 'outstanding', label: 'Outstanding', kind: 'money' }, { key: 'due', label: 'Next Due', kind: 'date' }, { key: 'status', label: 'Status' },
  ],
  dims: ['branch', 'country', 'counselor'],
  dimNotes: { date: 'Balances are as of today, not for a period.', intake: 'Balances have no intake.', department: 'Balances have no department.' },
  quick: ['status'],
  flagLabel: 'Overdue only',
  build: (src, now) => src.branches.flatMap((b) => {
    const txs = src.transactions.filter((t) => t.branch === b.name);
    return clientBalances(txs, dateKey(now)).filter((c) => c.outstanding > 0).map((c): SheetRow => ({
      id: `bal-${b.name}-${c.clientId}`,
      cells: { name: c.clientName, clientId: c.clientId, branch: b.name, counselor: c.counselor, fee: c.totalFee, paid: c.paid - c.refunded, outstanding: c.outstanding, due: c.nextDue ?? '—', status: c.status },
      dims: { branch: b.name, counselor: c.counselor, country: txs.find((t) => t.clientId === c.clientId)?.country },
      flag: c.status === 'Overdue',
    }));
  }),
};

const APPROVALS: Dataset = {
  key: 'approvals',
  title: 'Approvals',
  description: `Decisions requested across all branches. Refunds of ${rs(LARGE_REFUND)}+ and transfers waiting ${TRANSFER_WAIT_DAYS}+ days are flagged.`,
  columns: [
    { key: 'type', label: 'Type' }, { key: 'subject', label: 'For' }, { key: 'branch', label: 'Branch' }, { key: 'detail', label: 'Detail' },
    { key: 'by', label: 'Requested By' }, { key: 'requested', label: 'Requested', kind: 'date' }, { key: 'amount', label: 'Amount', kind: 'money' },
    { key: 'status', label: 'Status' }, { key: 'decidedBy', label: 'Decided By' },
  ],
  dims: ['date', 'branch'],
  dimNotes: { country: 'Approvals have no country.', counselor: 'Approvals are raised by any staff role.', intake: 'Approvals have no intake.', department: 'Use the Type column instead.' },
  quick: ['status', 'type'],
  flagLabel: 'Needs attention only',
  build: (src, now) => src.branches.flatMap((b) => collectDecisions({
    leave: src.leave.filter((x) => x.branch === b.name),
    corrections: src.corrections.filter((x) => x.branch === b.name),
    attendance: src.attendance.filter((x) => x.branch === b.name),
    transactions: src.transactions.filter((x) => x.branch === b.name),
    expenses: src.expenses.filter((x) => x.branch === b.name),
    holidays: src.holidays,
    transfers: src.transfers.filter((x) => x.fromBranch === b.name),
  }).map((d): SheetRow => {
    const tx = src.transactions.find((t) => t.id === d.sourceId);
    const amount = d.type === 'Expense' ? src.expenses.find((e) => e.id === d.sourceId)?.amount ?? 0 : tx?.amount ?? 0;
    const waited = Math.floor((now.getTime() - new Date(`${day(d.requestedAt)}T00:00:00`).getTime()) / 86_400_000);
    return {
      id: `dec-${d.key}`,
      cells: { type: d.type, subject: d.subject, branch: b.name, detail: d.detail, by: d.requestedBy, requested: day(d.requestedAt), amount, status: d.status, decidedBy: d.decidedBy ?? '—' },
      dims: { date: day(d.requestedAt), branch: b.name },
      flag: d.status === 'Pending' && ((d.type === 'Refund' && amount >= LARGE_REFUND) || (d.type === 'Branch Transfer' && waited >= TRANSFER_WAIT_DAYS)),
      open: { navKey: 'approvals', label: 'Branch Approval Center' },
    };
  })),
};

const TASKS: Dataset = {
  key: 'tasks',
  title: 'Tasks',
  description: 'Daily operational tasks across every branch. Overdue tasks are flagged.',
  columns: [
    { key: 'title', label: 'Task' }, { key: 'branch', label: 'Branch' }, { key: 'department', label: 'Department' },
    { key: 'owner', label: 'Assigned To' }, { key: 'date', label: 'Date', kind: 'date' }, { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' }, { key: 'overdue', label: 'Days Overdue', kind: 'number' },
  ],
  dims: ['date', 'branch', 'department'],
  dimNotes: { country: 'Tasks have no country.', counselor: 'Use Department + the Assigned To column.', intake: 'Tasks have no intake.' },
  quick: ['status', 'priority'],
  flagLabel: 'Overdue only',
  build: (src, now) => src.tasks.map((t): SheetRow => {
    const late = overdueDays(t, dateKey(now));
    const role = t.assignee ? src.staff.find((s) => s.name === t.assignee)?.role : t.assignedRole === 'Anyone' ? undefined : t.assignedRole;
    const department = departmentOf(role) || 'Any department';
    return {
      id: `task-${t.id}`,
      cells: { title: t.title, branch: t.branch, department, owner: t.assignee ?? (t.assignedRole === 'Anyone' ? 'Anyone' : `Any ${t.assignedRole}`), date: t.date, priority: t.priority, status: t.status, overdue: late },
      dims: { date: t.date, branch: t.branch, department },
      flag: late > 0,
    };
  }),
};

const ISSUES: Dataset = {
  key: 'issues',
  title: 'Issues',
  description: 'Issues raised at the branches. Open IT issues of High or Critical priority are flagged.',
  columns: [
    { key: 'code', label: 'Code' }, { key: 'title', label: 'Issue' }, { key: 'branch', label: 'Branch' }, { key: 'category', label: 'Category' },
    { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' }, { key: 'by', label: 'Reported By' },
    { key: 'department', label: 'Department' }, { key: 'reported', label: 'Reported', kind: 'date' }, { key: 'escalated', label: 'Escalated To' },
  ],
  dims: ['date', 'branch', 'department'],
  dimNotes: { country: 'Issues have no country.', counselor: 'Use Department + the Reported By column.', intake: 'Issues have no intake.' },
  quick: ['status', 'category', 'priority'],
  flagLabel: 'Urgent IT only',
  build: (src) => src.issues.map((i): SheetRow => {
    const department = departmentOf(i.reporterRole) || i.reporterRole;
    const open = i.status !== 'Resolved' && i.status !== 'Closed';
    return {
      id: `iss-${i.id}`,
      cells: { code: i.code, title: i.title, branch: i.branch, category: i.category, priority: i.priority, status: i.status, by: i.reportedBy, department, reported: day(i.reportedAt), escalated: i.escalatedTo ?? '—' },
      dims: { date: day(i.reportedAt), branch: i.branch, department },
      flag: open && i.category === 'IT/System' && (i.priority === 'Critical' || i.priority === 'High'),
    };
  }),
};

const CHECKOUTS: Dataset = {
  key: 'checkouts',
  title: 'Missing Check-outs',
  description: 'Staff who checked in but never checked out, and branch days opened but never closed (before today).',
  columns: [
    { key: 'date', label: 'Date', kind: 'date' }, { key: 'branch', label: 'Branch' }, { key: 'kind', label: 'What’s Missing' },
    { key: 'who', label: 'Staff / Opened By' }, { key: 'department', label: 'Department' }, { key: 'since', label: 'Checked In / Opened' },
  ],
  dims: ['date', 'branch', 'department'],
  dimNotes: { country: 'Attendance has no country.', counselor: 'Use Department.', intake: 'Attendance has no intake.' },
  quick: ['kind'],
  build: (src, now) => {
    const today = dateKey(now);
    return [
      ...src.attendance.filter((r) => r.date < today && r.checkIn && !r.checkOut).map((r): SheetRow => {
        const department = departmentOf(src.staff.find((s) => s.name === r.staffName)?.role);
        return {
          id: `co-${r.id}`,
          cells: { date: r.date, branch: r.branch, kind: 'Staff check-out', who: r.staffName, department: department || '—', since: r.checkIn ?? '' },
          dims: { date: r.date, branch: r.branch, department }, flag: true,
        };
      }),
      ...src.dayLogs.filter((l) => l.date < today && l.openedAt && !l.closedAt).map((l): SheetRow => ({
        id: `bc-${l.id}`,
        cells: { date: l.date, branch: l.branch, kind: 'Branch closing', who: l.openedBy ?? '—', department: 'Branch Management', since: l.openedAt ?? '' },
        dims: { date: l.date, branch: l.branch, department: 'Branch Management' }, flag: true,
      })),
    ];
  },
};

const PEOPLE: Dataset = {
  key: 'people',
  title: 'People',
  description: 'Every staff member by branch and department.',
  columns: [
    { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'department', label: 'Department' },
    { key: 'branch', label: 'Branch' }, { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' },
  ],
  dims: ['branch', 'department'],
  dimNotes: { date: 'Staff records are current, not for a period.', country: 'Staff have no country.', counselor: 'Use Department.', intake: 'Staff have no intake.' },
  quick: ['status', 'role'],
  build: (src) => src.staff.map((s): SheetRow => ({
    id: `st-${s.id}`,
    cells: { name: s.name, role: s.marketingRole ? `${s.role} · ${s.marketingRole}` : s.role, department: departmentOf(s.role), branch: s.branch, email: s.email, status: s.status },
    dims: { branch: s.branch, department: departmentOf(s.role) },
    open: { navKey: 'staff', intent: { openStaffName: s.name }, label: 'Open staff record' },
  })),
};

const AUDIT: Dataset = {
  key: 'audit',
  title: 'Override Audit Log',
  description: 'Every administrative override. Entries are permanent and can’t be edited or removed.',
  columns: [
    { key: 'at', label: 'When' }, { key: 'by', label: 'By' }, { key: 'record', label: 'Record' }, { key: 'field', label: 'Field' },
    { key: 'from', label: 'Original Value' }, { key: 'to', label: 'New Value' }, { key: 'reason', label: 'Reason' },
  ],
  dims: ['date'],
  dimNotes: { branch: 'Overrides are company-wide.', country: '—', counselor: '—', intake: '—', department: '—' },
  quick: ['field'],
  build: (src) => src.audit.map((a): SheetRow => ({
    id: a.id, cells: { at: a.at, by: a.by, record: a.record, field: a.field, from: a.from, to: a.to, reason: a.reason }, dims: { date: day(a.at) },
  })),
};

export const DATASETS: Record<DatasetKey, Dataset> = {
  leads: LEADS, clients: CLIENTS, applications: APPLICATIONS, visa: VISA, finance: FINANCE, outstanding: OUTSTANDING,
  approvals: APPROVALS, tasks: TASKS, issues: ISSUES, checkouts: CHECKOUTS, people: PEOPLE, audit: AUDIT,
};
export const DATASET_ORDER: DatasetKey[] = ['leads', 'clients', 'applications', 'visa', 'finance', 'outstanding', 'approvals', 'tasks', 'issues', 'checkouts', 'people', 'audit'];

/** Apply the global filters a dataset supports; unsupported ones are ignored. */
export function applyGlobal(rows: SheetRow[], ds: Dataset, f: GlobalFilters, now = new Date()): SheetRow[] {
  const { from, to } = periodBounds(f, now);
  const on = (d: Dim) => ds.dims.includes(d);
  return rows.filter((r) => {
    if (on('date') && (from || to)) {
      const d = r.dims.date;
      if (!d || (from && d < from) || (to && d > to)) return false;
    }
    if (on('branch') && f.branch && r.dims.branch !== f.branch) return false;
    if (on('country') && f.country && r.dims.country !== f.country) return false;
    if (on('counselor') && f.counselor && r.dims.counselor !== f.counselor) return false;
    if (on('department') && f.department && r.dims.department !== f.department) return false;
    if (on('intake') && f.intake && r.dims.intake !== f.intake) return false;
    return true;
  });
}

// ── Dashboard metrics ───────────────────────────────────────────────────────
export interface Preset {
  /** Quick-filter column → value. */
  column?: string;
  value?: string;
  flagOnly?: boolean;
}

export interface Metric {
  key: string;
  label: string;
  value: number;
  money?: boolean;
  hint: string;
  tone?: 'red' | 'green';
  dataset: DatasetKey;
  preset?: Preset;
}

export type BuiltRows = Record<DatasetKey, SheetRow[]>;

export function buildAll(src: CommandSources, now = new Date()): BuiltRows {
  return Object.fromEntries(DATASET_ORDER.map((k) => [k, DATASETS[k].build(src, now)])) as BuiltRows;
}

const sum = (rows: SheetRow[], key: string) => rows.reduce((n, r) => n + (Number(r.cells[key]) || 0), 0);

export function financeTotals(rows: SheetRow[]) {
  const payments = sum(rows.filter((r) => r.cells.type === 'Payment'), 'amount');
  const refunds = sum(rows.filter((r) => r.cells.type === 'Refund' && r.cells.status === 'Processed'), 'amount');
  const expenses = sum(rows.filter((r) => r.cells.type === 'Expense' && r.cells.status === 'Approved'), 'amount');
  return { revenue: payments - refunds, expenses, net: payments - refunds - expenses };
}

export function metrics(all: BuiltRows, f: GlobalFilters, now = new Date()): Metric[] {
  const g = (k: DatasetKey) => applyGlobal(all[k], DATASETS[k], f, now);
  const leads = g('leads');
  const visa = g('visa');
  const fin = financeTotals(g('finance'));
  const outstanding = sum(g('outstanding'), 'outstanding');
  return [
    { key: 'leads', label: 'Total Leads', value: leads.length, hint: 'Enquiries received', dataset: 'leads' },
    { key: 'qualified', label: 'Qualified Leads', value: leads.filter((r) => r.cells.qualified === 'Yes').length, hint: 'Given to a counselor', dataset: 'leads', preset: { column: 'qualified', value: 'Yes' } },
    { key: 'clients', label: 'Converted Clients', value: g('clients').length, hint: 'Decided to proceed', dataset: 'clients' },
    { key: 'applications', label: 'Applications', value: g('applications').length, hint: 'Files opened', dataset: 'applications' },
    { key: 'approved', label: 'Visa Approvals', value: visa.filter((r) => r.cells.status === 'Visa Approved').length, hint: 'Decided in period', tone: 'green', dataset: 'visa', preset: { column: 'status', value: 'Visa Approved' } },
    { key: 'refused', label: 'Visa Refusals', value: visa.filter((r) => r.cells.status === 'Visa Refused').length, hint: 'Decided in period', tone: 'red', dataset: 'visa', preset: { column: 'status', value: 'Visa Refused' } },
    { key: 'revenue', label: 'Total Revenue', value: fin.revenue, money: true, hint: 'Payments − paid refunds', dataset: 'finance', preset: { column: 'type', value: 'Payment' } },
    { key: 'outstanding', label: 'Outstanding', value: outstanding, money: true, hint: 'Owed by clients today', tone: outstanding > 0 ? 'red' : undefined, dataset: 'outstanding' },
    { key: 'net', label: 'Net Financial Result', value: fin.net, money: true, hint: `Revenue − ${rs(fin.expenses)} expenses`, tone: fin.net < 0 ? 'red' : 'green', dataset: 'finance' },
  ];
}

// ── Today's attention ───────────────────────────────────────────────────────
export interface AttentionItem {
  id: string;
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
  dataset: DatasetKey;
  preset?: Preset;
  branch?: string;
}

/** Only items that need Super Admin oversight. Respects the Branch filter; not the period. */
export function attention(all: BuiltRows, branch: string): AttentionItem[] {
  const inBranch = (rows: SheetRow[]) => rows.filter((r) => !branch || r.dims.branch === branch);
  const out: AttentionItem[] = [];
  const itIssues = inBranch(all.issues).filter((r) => r.flag);
  if (itIssues.length) {
    const critical = itIssues.filter((r) => r.cells.priority === 'Critical').length;
    out.push({
      id: 'it', severity: critical ? 'critical' : 'warning',
      title: `${itIssues.length} urgent IT issue${itIssues.length === 1 ? '' : 's'} open`,
      detail: `${critical ? `${critical} critical · ` : ''}${[...new Set(itIssues.map((r) => r.dims.branch))].join(', ')}`,
      dataset: 'issues', preset: { flagOnly: true },
    });
  }
  const visa = inBranch(all.visa).filter((r) => r.flag);
  if (visa.length) out.push({
    id: 'visa', severity: visa.length >= 5 ? 'critical' : 'warning',
    title: `${visa.length} overdue visa case${visa.length === 1 ? '' : 's'}`,
    detail: `No status change for ${VISA_OVERDUE_DAYS}+ days · ${[...new Set(visa.map((r) => r.dims.branch))].join(', ')}`,
    dataset: 'visa', preset: { flagOnly: true },
  });
  const refunds = inBranch(all.approvals).filter((r) => r.flag && r.cells.type === 'Refund');
  if (refunds.length) out.push({
    id: 'refund', severity: 'critical',
    title: `${refunds.length} large refund request${refunds.length === 1 ? '' : 's'} pending`,
    detail: `${rs(sum(refunds, 'amount'))} awaiting branch approval (${rs(LARGE_REFUND)}+ each)`,
    dataset: 'approvals', preset: { column: 'type', value: 'Refund', flagOnly: true },
  });
  const transfers = inBranch(all.approvals).filter((r) => r.flag && r.cells.type === 'Branch Transfer');
  if (transfers.length) out.push({
    id: 'transfer', severity: 'warning',
    title: `${transfers.length} inter-branch transfer${transfers.length === 1 ? '' : 's'} waiting`,
    detail: `Pending ${TRANSFER_WAIT_DAYS}+ days at the origin branch`,
    dataset: 'approvals', preset: { column: 'type', value: 'Branch Transfer', flagOnly: true },
  });
  const byBranch = new Map<string, SheetRow[]>();
  inBranch(all.checkouts).forEach((r) => byBranch.set(r.dims.branch ?? '', [...(byBranch.get(r.dims.branch ?? '') ?? []), r]));
  byBranch.forEach((rows, b) => {
    const staffMissing = rows.filter((r) => r.cells.kind === 'Staff check-out').length;
    const closings = rows.filter((r) => r.cells.kind === 'Branch closing').length;
    out.push({
      id: `co-${b}`, severity: 'warning', branch: b,
      title: `Missing branch check-outs: ${b}`,
      detail: [staffMissing && `${staffMissing} staff check-out${staffMissing === 1 ? '' : 's'}`, closings && `${closings} day${closings === 1 ? '' : 's'} not closed`].filter(Boolean).join(' · '),
      dataset: 'checkouts',
    });
  });
  const lateTasks = inBranch(all.tasks).filter((r) => Number(r.cells.overdue) >= 3);
  if (lateTasks.length) out.push({
    id: 'tasks', severity: 'warning',
    title: `${lateTasks.length} task${lateTasks.length === 1 ? '' : 's'} overdue by 3+ days`,
    detail: [...new Set(lateTasks.map((r) => r.dims.branch))].join(', '),
    dataset: 'tasks', preset: { flagOnly: true },
  });
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1));
}

// ── Branch performance ──────────────────────────────────────────────────────
export interface BranchPerf {
  branch: string;
  leads: number;
  clients: number;
  applications: number;
  visaApproved: number;
  revenue: number;
  outstanding: number;
}

export function branchPerformance(all: BuiltRows, f: GlobalFilters, branches: string[], now = new Date()): BranchPerf[] {
  // Marketing leads not yet routed to a branch, so the Leads column adds up to the Total Leads card.
  const unrouted = f.branch ? 0 : applyGlobal(all.leads, DATASETS.leads, f, now).filter((r) => r.dims.branch === 'Unrouted').length;
  const extra: BranchPerf[] = unrouted ? [{ branch: 'Unrouted', leads: unrouted, clients: 0, applications: 0, visaApproved: 0, revenue: 0, outstanding: 0 }] : [];
  return [...branches.filter((b) => !f.branch || b === f.branch).map((branch) => {
    const g = (k: DatasetKey) => applyGlobal(all[k], DATASETS[k], { ...f, branch }, now);
    return {
      branch,
      leads: g('leads').length,
      clients: g('clients').length,
      applications: g('applications').length,
      visaApproved: g('visa').filter((r) => r.cells.status === 'Visa Approved').length,
      revenue: financeTotals(g('finance')).revenue,
      outstanding: sum(g('outstanding'), 'outstanding'),
    };
  }), ...extra];
}

// ── Display & export ────────────────────────────────────────────────────────
export function formatCell(value: CellValue | undefined, kind?: ColumnKind): string {
  if (value === undefined || value === '') return '—';
  if (kind === 'money') return rs(Number(value));
  if (kind === 'number') return Number(value).toLocaleString('en-IN');
  if (kind === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return String(value);
}

// ── Sheet → spreadsheet rows ────────────────────────────────────────────────
export function sheetFor(ds: Dataset, rows: SheetRow[], name = ds.title) {
  return {
    name,
    headers: ds.columns.map((c) => c.label),
    rows: rows.map((r) => ds.columns.map((c) => r.cells[c.key] ?? '')),
  };
}

/** One workbook for a month: summary, branch table, attention and every dataset in the month. */
export function monthlyReport(all: BuiltRows, month: string, branch: string, branches: string[], now = new Date()) {
  const f = monthFilters(month, branch);
  const monthName = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const m = metrics(all, f, now);
  const perf = branchPerformance(all, f, branches, now);
  const summary = {
    name: 'Summary',
    headers: ['Metric', 'Value', 'Note'],
    rows: [
      ['CSC Global — Monthly Report', monthName, branch || 'All branches'],
      ['Generated', new Date().toLocaleString('en-GB'), ''],
      ['', '', ''],
      ...m.map((x) => [x.label, x.value, x.key === 'outstanding' ? 'As of today' : x.hint]),
    ],
  };
  const perfSheet = {
    name: 'Branch Performance',
    headers: ['Branch', 'Leads', 'Clients', 'Applications', 'Visa Approved', 'Revenue', 'Outstanding'],
    rows: [
      ...perf.map((p) => [p.branch === 'Unrouted' ? 'Not yet routed (Marketing)' : p.branch, p.leads, p.clients, p.applications, p.visaApproved, p.revenue, p.outstanding]),
      ['Total', ...(['leads', 'clients', 'applications', 'visaApproved', 'revenue', 'outstanding'] as const).map((k) => perf.reduce((n, p) => n + p[k], 0))],
    ],
  };
  const att = attention(all, branch);
  const attSheet = {
    name: 'Attention',
    headers: ['Severity', 'Item', 'Detail'],
    rows: att.length ? att.map((a) => [a.severity === 'critical' ? 'Critical' : 'Warning', a.title, a.detail]) : [['—', 'Nothing needs attention', '']],
  };
  const datasets: DatasetKey[] = ['leads', 'clients', 'applications', 'visa', 'finance', 'outstanding', 'approvals', 'tasks', 'issues'];
  return {
    filename: `CSC-Monthly-Report-${month}${branch ? `-${branch}` : ''}`,
    sheets: [summary, perfSheet, attSheet, ...datasets.map((k) => sheetFor(DATASETS[k], applyGlobal(all[k], DATASETS[k], f, now)))],
  };
}

// ── Global search ───────────────────────────────────────────────────────────
export interface SearchHit {
  dataset: DatasetKey;
  row: SheetRow;
  title: string;
  subtitle: string;
}

export function searchAll(all: BuiltRows, query: string, limit = 8): { dataset: DatasetKey; hits: SearchHit[]; total: number }[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const keys: DatasetKey[] = ['clients', 'leads', 'applications', 'visa', 'people', 'issues', 'tasks', 'finance'];
  return keys.map((k) => {
    const ds = DATASETS[k];
    const match = all[k].filter((r) => Object.values(r.cells).some((v) => String(v).toLowerCase().includes(q)));
    const [a, b, c] = ds.columns.map((col) => col.key);
    return {
      dataset: k,
      total: match.length,
      hits: match.slice(0, limit).map((row) => ({
        dataset: k, row,
        title: String(row.cells[a] ?? ''),
        subtitle: [row.cells[b], row.cells[c], row.cells.status].filter((v) => v !== undefined && v !== '').join(' · '),
      })),
    };
  }).filter((g) => g.total > 0);
}
