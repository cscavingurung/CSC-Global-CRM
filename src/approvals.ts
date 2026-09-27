// Manager Approval Center — one decision inbox over requests that live in other modules.
// Nothing is stored here: each source (Leave, Attendance corrections, Finance ledger, Expense
// claims) is mapped into a common `Decision` shape, and a decision is written back to the
// module the request came from.
import {
  AttendanceCorrection, BranchTransfer, AttendanceRecord, ExpenseRequest, FinTransaction, Holiday, LeaveRecord,
} from './types';
import { balancesFor, leaveDays } from './leave';
import { correctionIssue } from './attendance';
import { rs } from './finance';
import { timeOf } from './branchOps';

export type DecisionType = 'Leave' | 'Attendance Correction' | 'Discount' | 'Refund' | 'Payment Exception' | 'Expense' | 'Branch Transfer';
export type DecisionStatus = 'Pending' | 'Approved' | 'Rejected' | 'Returned';

/** Source module, and where "Open in module" goes. */
export const SOURCES: Record<DecisionType, { module: string; area: 'HR' | 'Finance' | 'Clients'; navKey: string }> = {
  Leave: { module: 'Leave Management', area: 'HR', navKey: 'hr-leave' },
  'Attendance Correction': { module: 'HRM · Attendance', area: 'HR', navKey: 'hr-att-corrections' },
  Discount: { module: 'Financial Management', area: 'Finance', navKey: 'fin-discounts' },
  Refund: { module: 'Financial Management', area: 'Finance', navKey: 'fin-refunds' },
  'Payment Exception': { module: 'Financial Management', area: 'Finance', navKey: 'fin-outstanding' },
  Expense: { module: 'Expense Claims', area: 'Finance', navKey: 'approvals' },
  'Branch Transfer': { module: 'Client Transfers', area: 'Clients', navKey: 'bm-transfers' },
};

/** Types a manager can only approve or reject — there's nothing for the requester to fix. */
export const NO_RETURN: DecisionType[] = ['Branch Transfer'];

export const DECISION_TYPES = Object.keys(SOURCES) as DecisionType[];

export const TYPE_STYLES: Record<DecisionType, string> = {
  Leave: 'bg-blue-50 text-blue-700',
  'Attendance Correction': 'bg-sky-50 text-sky-700',
  Discount: 'bg-violet-50 text-violet-700',
  Refund: 'bg-rose-50 text-rose-700',
  'Payment Exception': 'bg-orange-50 text-orange-700',
  Expense: 'bg-teal-50 text-teal-700',
  'Branch Transfer': 'bg-indigo-50 text-indigo-700',
};

export const DECISION_STATUS_STYLES: Record<DecisionStatus, string> = {
  Pending: 'bg-amber-50 text-amber-700',
  Approved: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-red-50 text-red-700',
  Returned: 'bg-amber-50 text-amber-800',
};

export interface Decision {
  /** `${type}:${sourceId}` */
  key: string;
  type: DecisionType;
  sourceId: string;
  subject: string;
  subjectKind: 'Employee' | 'Client';
  subjectId?: string;
  /** Short detail for the table, e.g. "3 days · Annual" or "Rs 5,000". */
  detail: string;
  requestedBy: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  requestedAt: string;
  reason?: string;
  facts: { label: string; value: string }[];
  status: DecisionStatus;
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
}

export interface DecisionSources {
  leave: LeaveRecord[];
  corrections: AttendanceCorrection[];
  attendance: AttendanceRecord[];
  transactions: FinTransaction[];
  expenses: ExpenseRequest[];
  holidays: Holiday[];
  /** Inter-branch transfers OUT of this branch — only the origin branch's manager decides them. */
  transfers?: BranchTransfer[];
}

const fmtDate = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function collectDecisions(src: DecisionSources): Decision[] {
  const out: Decision[] = [];
  const year = new Date().getFullYear();

  src.leave.forEach((l) => {
    const days = leaveDays(l, src.holidays);
    const bal = balancesFor(l.staffName, src.leave, year, src.holidays).find((b) => b.type === l.type);
    out.push({
      key: `Leave:${l.id}`, type: 'Leave', sourceId: l.id, subject: l.staffName, subjectKind: 'Employee',
      detail: `${days} day${days === 1 ? '' : 's'} · ${l.type}`,
      requestedBy: l.staffName, requestedAt: l.requestedAt, reason: l.reason,
      facts: [
        { label: 'Leave type', value: l.type },
        { label: 'Dates', value: l.from === l.to ? fmtDate(l.from) : `${fmtDate(l.from)} – ${fmtDate(l.to)}` },
        { label: 'Days counted', value: `${days} (Saturdays and holidays excluded)` },
        ...(bal && l.status === 'Pending' ? [{ label: `${l.type} balance`, value: `${bal.remaining} → ${bal.remaining - days} after approval` }] : []),
      ],
      status: l.status, decidedBy: l.decidedBy, decidedAt: l.decidedAt, note: l.decisionNote,
    });
  });

  src.corrections.forEach((c) => {
    const record = src.attendance.find((r) => r.staffName === c.staffName && r.date === c.date);
    const current = record?.[c.field];
    out.push({
      key: `Attendance Correction:${c.id}`, type: 'Attendance Correction', sourceId: c.id, subject: c.staffName, subjectKind: 'Employee',
      detail: `${c.field === 'checkOut' ? 'Check-out' : 'Check-in'} → ${c.requestedTime}`,
      requestedBy: c.requestedBy ?? c.staffName, requestedAt: c.requestedAt, reason: c.reason,
      facts: [
        { label: 'Day', value: fmtDate(c.date) },
        { label: 'Issue', value: correctionIssue(c, record) },
        { label: 'Recorded', value: current ? timeOf(current) : 'Missing' },
        { label: 'Requested', value: c.requestedTime },
        { label: 'On approval', value: 'The original punch is kept; the new time is added as a correction.' },
      ],
      status: c.status, decidedBy: c.decidedBy, decidedAt: c.decidedAt, note: c.decisionNote,
    });
  });

  const byId = new Map(src.transactions.map((t) => [t.id, t]));
  src.transactions.filter((t) => t.kind === 'Discount' || t.kind === 'Refund').forEach((t) => {
    const status: DecisionStatus = t.status === 'Pending Approval' ? 'Pending' : t.status === 'Processed' ? 'Approved' : (t.status ?? 'Pending') as DecisionStatus;
    const orig = t.refOf ? byId.get(t.refOf) : undefined;
    out.push({
      key: `${t.kind}:${t.id}`, type: t.kind as DecisionType, sourceId: t.id, subject: t.clientName, subjectKind: 'Client', subjectId: t.clientId,
      detail: rs(t.amount), requestedBy: t.by, requestedAt: t.at, reason: t.reason,
      facts: t.kind === 'Discount'
        ? [
          { label: 'Service', value: t.service },
          { label: 'Standard fee', value: rs(t.standardFee ?? 0) },
          { label: 'Discount', value: `${rs(t.amount)}${t.standardFee ? ` (${Math.round((t.amount / t.standardFee) * 100)}%)` : ''}` },
          { label: 'Final amount', value: rs((t.standardFee ?? 0) - t.amount) },
        ]
        : [
          { label: 'Service', value: t.service },
          { label: 'Original payment', value: orig ? `${rs(orig.amount)} · ${orig.receiptNo}` : '—' },
          { label: 'Refund', value: rs(t.amount) },
          { label: 'On approval', value: 'The original payment is kept unchanged; the refund is its own entry.' },
        ],
      status, decidedBy: t.decidedBy, decidedAt: t.decidedAt, note: t.decisionNote,
    });
  });

  src.transactions.filter((t) => t.kind === 'Exception').forEach((t) => {
    const status: DecisionStatus = t.status === 'Pending Approval' ? 'Pending' : (t.status ?? 'Pending') as DecisionStatus;
    out.push({
      key: `Payment Exception:${t.id}`, type: 'Payment Exception', sourceId: t.id, subject: t.clientName, subjectKind: 'Client', subjectId: t.clientId,
      detail: t.exceptionType ?? 'Exception', requestedBy: t.by, requestedAt: t.at, reason: t.reason,
      facts: [
        { label: 'Request', value: t.exceptionType ?? '—' },
        { label: 'Service', value: t.service },
        ...(t.amount ? [{ label: 'Outstanding at request', value: rs(t.amount) }] : []),
        ...(t.requestedDueDate ? [{ label: 'Proposed due date', value: fmtDate(t.requestedDueDate) }] : []),
        { label: 'On approval', value: 'Finance sets up the agreed plan or new due date; fees don’t change.' },
      ],
      status, decidedBy: t.decidedBy, decidedAt: t.decidedAt, note: t.decisionNote,
    });
  });

  src.expenses.forEach((e) => {
    out.push({
      key: `Expense:${e.id}`, type: 'Expense', sourceId: e.id, subject: e.requestedBy, subjectKind: 'Employee',
      detail: rs(e.amount), requestedBy: e.requestedBy, requestedAt: e.requestedAt, reason: e.reason,
      facts: [
        { label: 'Expense', value: e.title },
        { label: 'Category', value: e.category },
        { label: 'Amount', value: rs(e.amount) },
        { label: 'Receipt', value: e.receiptAttached ? 'Attached' : 'Not attached' },
      ],
      status: e.status, decidedBy: e.decidedBy, decidedAt: e.decidedAt, note: e.decisionNote,
    });
  });

  (src.transfers ?? []).forEach((t) => {
    out.push({
      key: `Branch Transfer:${t.id}`, type: 'Branch Transfer', sourceId: t.id, subject: t.clientName, subjectKind: 'Client', subjectId: t.clientId,
      detail: `${t.fromBranch} → ${t.toBranch}`, requestedBy: t.requestedBy, requestedAt: t.requestedAt, reason: t.reason,
      facts: [
        { label: 'Transfer', value: t.code },
        { label: 'Origin branch', value: `${t.fromBranch} · ${t.fromCounselor}` },
        { label: 'Target branch', value: `${t.toBranch} · ${t.toCounselor}` },
        { label: 'Visited target branch', value: fmtDate(t.visitDate) },
        { label: 'On approval', value: 'The client’s primary branch and counselor change immediately; the move is written to the audit trail.' },
      ],
      status: t.status, decidedBy: t.decidedBy, decidedAt: t.decidedAt, note: t.decisionNote,
    });
  });

  return out;
}
