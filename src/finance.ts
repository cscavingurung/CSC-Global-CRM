// Financial Management — readings of the one branch ledger (FinTransaction[]). Balances, plans,
// collections and revenue are all calculated from the same rows; nothing is stored twice.
import { FinService, FinTransaction, PaymentMethod } from './types';
import { parseSubmittedAt } from './dateTime';

export const STANDARD_FEES: Record<FinService, number> = {
  'Consultation Fee': 2000,
  'Application Processing': 25000,
  'Visa Processing': 35000,
  'IELTS / PTE Class': 12000,
  'Document Translation': 3000,
  'Courier Fee': 1500,
  'Notary Fee': 1000,
  'Legalization Fee': 2500,
  'Other Charge': 0,
};
export const SERVICES = Object.keys(STANDARD_FEES) as FinService[];
/** Main services a counselor assigns to a client (Service Fees panel). Document and processing
 * extras stay with the V/A Officer. */
export const CLIENT_SERVICES: FinService[] = ['Consultation Fee', 'Application Processing', 'Visa Processing', 'IELTS / PTE Class'];
export const METHODS: PaymentMethod[] = ['Cash', 'Bank', 'Other'];

export const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-IN')}`;

/** What to call a ledger line — a typed charge title if there is one, else the service. */
export const serviceLabel = (t: { service: string; title?: string }) => t.title ?? t.service;

/** A payment that counts — not voided. */
export const isLivePayment = (t: FinTransaction) => t.kind === 'Payment' && !t.void;
/** Discounts reduce what's owed once approved. */
export const isAppliedDiscount = (t: FinTransaction) => t.kind === 'Discount' && (t.status === 'Approved' || t.status === 'Processed');
/** Refunds only move money back once processed. */
export const isPaidOutRefund = (t: FinTransaction) => t.kind === 'Refund' && t.status === 'Processed';
/** Unpaid balance handed to another branch with a client transfer — a credit in this branch. */
export const isTransferCredit = (t: FinTransaction) => t.kind === 'Transfer';

export type DueStatus = 'Overdue' | 'Due' | 'Due Soon' | 'Scheduled' | 'Settled';
export const DUE_STYLES: Record<DueStatus, string> = {
  Overdue: 'bg-red-50 text-red-700',
  Due: 'bg-amber-50 text-amber-700',
  'Due Soon': 'bg-blue-50 text-blue-700',
  Scheduled: 'bg-gray-100 text-gray-600',
  Settled: 'bg-emerald-50 text-emerald-700',
};

const daysUntil = (date: string, today: string) =>
  Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);

/** Overdue before today; Due within 7 days; Due Soon within 30; otherwise Scheduled. */
export function dueStatus(dueDate: string | undefined, outstanding: number, today: string): DueStatus {
  if (outstanding <= 0 || !dueDate) return 'Settled';
  const d = daysUntil(dueDate, today);
  if (d < 0) return 'Overdue';
  if (d <= 7) return 'Due';
  if (d <= 30) return 'Due Soon';
  return 'Scheduled';
}

export interface ChargeLine {
  charge: FinTransaction;
  /** How much of this charge is covered. */
  paid: number;
  remaining: number;
}

/**
 * How one client's money is applied to their charges — the single rule every view uses:
 *  1. A payment recorded against a plan instalment covers that instalment first.
 *  2. Everything else (other payments, any excess from step 1, approved discounts) covers the
 *     remaining charges oldest-due first.
 * A processed refund is a credit: it returns money AND waives that part of the fee, so it never
 * re-opens a balance (BUSINESS_RULES.md → "Outstanding"). It is subtracted from revenue instead.
 * `txs` must be one client's rows. Lines come back in due-date order.
 */
export function chargeLines(txs: FinTransaction[]): ChargeLine[] {
  const charges = txs.filter((t) => t.kind === 'Charge').sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || (a.installment ?? 0) - (b.installment ?? 0));
  const paid = new Map<string, number>(charges.map((c) => [c.id, 0]));
  let pool = txs.filter(isAppliedDiscount).reduce((n, t) => n + t.amount, 0) + txs.filter(isTransferCredit).reduce((n, t) => n + t.amount, 0);
  txs.filter(isLivePayment).forEach((p) => {
    const target = p.planId ? charges.find((c) => c.planId === p.planId && c.installment === p.installment) : undefined;
    if (!target) { pool += p.amount; return; }
    const room = target.amount - (paid.get(target.id) ?? 0);
    const applied = Math.min(room, p.amount);
    paid.set(target.id, (paid.get(target.id) ?? 0) + applied);
    pool += p.amount - applied;
  });
  charges.forEach((c) => {
    if (pool <= 0) return;
    const room = c.amount - (paid.get(c.id) ?? 0);
    const applied = Math.min(room, pool);
    paid.set(c.id, (paid.get(c.id) ?? 0) + applied);
    pool -= applied;
  });
  return charges.map((c) => ({ charge: c, paid: paid.get(c.id) ?? 0, remaining: c.amount - (paid.get(c.id) ?? 0) }));
}

export interface ClientBalance {
  clientId: string;
  clientName: string;
  counselor: string;
  totalFee: number;
  discounts: number;
  paid: number;
  refunded: number;
  outstanding: number;
  /** Earliest charge not yet covered by payments + discounts (FIFO by due date). */
  nextDue?: string;
  status: DueStatus;
}

export function clientBalances(txs: FinTransaction[], today: string): ClientBalance[] {
  const byClient = new Map<string, FinTransaction[]>();
  txs.forEach((t) => byClient.set(t.clientId, [...(byClient.get(t.clientId) ?? []), t]));
  return [...byClient.values()].map((rows) => {
    const charges = rows.filter((t) => t.kind === 'Charge');
    // Net of balances handed to another branch: the old branch keeps only what it billed and
    // collected; the receiving branch carries the rest as its own charge.
    const totalFee = charges.reduce((n, t) => n + t.amount, 0) - rows.filter(isTransferCredit).reduce((n, t) => n + t.amount, 0);
    const discounts = rows.filter(isAppliedDiscount).reduce((n, t) => n + t.amount, 0);
    const paid = rows.filter(isLivePayment).reduce((n, t) => n + t.amount, 0);
    const refunded = rows.filter(isPaidOutRefund).reduce((n, t) => n + t.amount, 0);
    // Outstanding = charges − approved discounts − live payments. Refunds don't add back (see chargeLines).
    const outstanding = Math.max(0, totalFee - discounts - paid);
    // Next due = the earliest charge not yet fully covered (see chargeLines).
    const nextDue = outstanding > 0 ? chargeLines(rows).find((l) => l.remaining > 0)?.charge.dueDate : undefined;
    const first = rows[0];
    return {
      clientId: first.clientId, clientName: first.clientName, counselor: first.counselor,
      totalFee, discounts, paid, refunded, outstanding, nextDue, status: dueStatus(nextDue, outstanding, today),
    };
  }).filter((b) => b.totalFee > 0);
}

export interface PlanSummary {
  planId: string;
  clientId: string;
  clientName: string;
  service: FinTransaction['service'];
  total: number;
  count: number;
  perInstallment: number;
  installments: { no: number; due: string; amount: number; paid: number; status: DueStatus }[];
  paid: number;
  remaining: number;
}

export function planSummaries(txs: FinTransaction[], today: string): PlanSummary[] {
  const plans = new Map<string, FinTransaction[]>();
  txs.filter((t) => t.kind === 'Charge' && t.planId).forEach((t) => plans.set(t.planId!, [...(plans.get(t.planId!) ?? []), t]));
  return [...plans.entries()].map(([planId, charges]) => {
    const sorted = charges.sort((a, b) => (a.installment ?? 0) - (b.installment ?? 0));
    const lines = chargeLines(txs.filter((t) => t.clientId === sorted[0].clientId));
    const installments = sorted.map((c) => {
      const paid = lines.find((l) => l.charge.id === c.id)?.paid ?? 0;
      return { no: c.installment ?? 0, due: c.dueDate ?? '', amount: c.amount, paid, status: dueStatus(c.dueDate, c.amount - paid, today) };
    });
    const total = sorted.reduce((n, c) => n + c.amount, 0);
    const paid = installments.reduce((n, i) => n + Math.min(i.paid, i.amount), 0);
    return {
      planId, clientId: sorted[0].clientId, clientName: sorted[0].clientName, service: sorted[0].service,
      total, count: sorted.length, perInstallment: sorted[0].amount, installments, paid, remaining: total - paid,
    };
  });
}

/** Totals per payment method (voided receipts excluded). */
export function methodTotals(payments: FinTransaction[]) {
  const live = payments.filter(isLivePayment);
  const by = Object.fromEntries(METHODS.map((m) => [m, live.filter((p) => p.method === m).reduce((n, p) => n + p.amount, 0)])) as Record<PaymentMethod, number>;
  return { ...by, total: live.reduce((n, p) => n + p.amount, 0) };
}

// ─── Display helpers shared by the finance routes ───────────────────────────


export const TX_STATUS_STYLES: Record<string, string> = {
  'Pending Approval': 'bg-amber-50 text-amber-700',
  Approved: 'bg-blue-50 text-blue-700',
  Processed: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-red-50 text-red-700',
  Returned: 'bg-amber-50 text-amber-800',
  Paid: 'bg-emerald-50 text-emerald-700',
  Voided: 'bg-gray-100 text-gray-500',
  Billed: 'bg-gray-100 text-gray-600',
};

export const stampMs = (s: string) => parseSubmittedAt(s)?.getTime() ?? 0;
export const timeOnly = (s: string) => s.split(' ').slice(1).join(' ');
export const finDayLabel = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const monthOf = (s: string) => s.slice(0, 7);
export const finMonthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
export const txStatus = (t: FinTransaction) =>
  t.kind === 'Payment' ? (t.void ? 'Voided' : 'Paid') : t.kind === 'Charge' ? 'Billed' : t.status ?? '';
export const methodText = (t: FinTransaction) => (t.method ? `${t.method}${t.methodNote ? ` · ${t.methodNote}` : ''}` : '—');

/** Next receipt number for a branch, continuing its existing sequence (RCP-KTM-2026-01056). */
export function nextReceiptNo(branchTxs: FinTransaction[], branch: string, year: number): string {
  const existing = branchTxs.map((t) => t.receiptNo).filter((r): r is string => !!r);
  const prefix = existing[0]?.split('-')[1] ?? branch.slice(0, 3).toUpperCase();
  const max = Math.max(0, ...existing.filter((r) => r.includes(`-${year}-`)).map((r) => Number(r.split('-').pop()) || 0));
  return `RCP-${prefix}-${year}-${String(max + 1).padStart(5, '0')}`;
}
