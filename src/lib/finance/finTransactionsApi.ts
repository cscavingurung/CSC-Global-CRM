import { supabase } from '../supabaseClient';
import { FinTransaction } from '../../types';

export interface FinTransactionRow {
  id: string;
  branch: string;
  kind: FinTransaction['kind'];
  client_id: string;
  client_name: string;
  counselor: string;
  country: string;
  service: FinTransaction['service'];
  title: string | null;
  price_id: string | null;
  transfer: FinTransaction['transfer'] | null;
  amount: number;
  at: string;
  by: string;
  due_date: string | null;
  plan_id: string | null;
  installment: number | null;
  installments: number | null;
  method: FinTransaction['method'] | null;
  method_note: string | null;
  note: string | null;
  receipt_no: string | null;
  void: FinTransaction['void'] | null;
  status: FinTransaction['status'] | null;
  reason: string | null;
  ref_of: string | null;
  standard_fee: number | null;
  exception_type: FinTransaction['exceptionType'] | null;
  requested_due_date: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  processed_by: string | null;
  processed_at: string | null;
}

export function fromRow(row: FinTransactionRow): FinTransaction {
  return {
    id: row.id,
    branch: row.branch,
    kind: row.kind,
    clientId: row.client_id,
    clientName: row.client_name,
    counselor: row.counselor,
    country: row.country,
    service: row.service,
    title: row.title ?? undefined,
    priceId: row.price_id ?? undefined,
    transfer: row.transfer ?? undefined,
    amount: row.amount,
    at: row.at,
    by: row.by,
    dueDate: row.due_date ?? undefined,
    planId: row.plan_id ?? undefined,
    installment: row.installment ?? undefined,
    installments: row.installments ?? undefined,
    method: row.method ?? undefined,
    methodNote: row.method_note ?? undefined,
    note: row.note ?? undefined,
    receiptNo: row.receipt_no ?? undefined,
    void: row.void ?? undefined,
    status: row.status ?? undefined,
    reason: row.reason ?? undefined,
    refOf: row.ref_of ?? undefined,
    standardFee: row.standard_fee ?? undefined,
    exceptionType: row.exception_type ?? undefined,
    requestedDueDate: row.requested_due_date ?? undefined,
    decidedBy: row.decided_by ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionNote: row.decision_note ?? undefined,
    processedBy: row.processed_by ?? undefined,
    processedAt: row.processed_at ?? undefined,
  };
}

function toRow(t: FinTransaction): FinTransactionRow {
  return {
    id: t.id,
    branch: t.branch,
    kind: t.kind,
    client_id: t.clientId,
    client_name: t.clientName,
    counselor: t.counselor,
    country: t.country,
    service: t.service,
    title: t.title ?? null,
    price_id: t.priceId ?? null,
    transfer: t.transfer ?? null,
    amount: t.amount,
    at: t.at,
    by: t.by,
    due_date: t.dueDate ?? null,
    plan_id: t.planId ?? null,
    installment: t.installment ?? null,
    installments: t.installments ?? null,
    method: t.method ?? null,
    method_note: t.methodNote ?? null,
    note: t.note ?? null,
    receipt_no: t.receiptNo ?? null,
    void: t.void ?? null,
    status: t.status ?? null,
    reason: t.reason ?? null,
    ref_of: t.refOf ?? null,
    standard_fee: t.standardFee ?? null,
    exception_type: t.exceptionType ?? null,
    requested_due_date: t.requestedDueDate ?? null,
    decided_by: t.decidedBy ?? null,
    decided_at: t.decidedAt ?? null,
    decision_note: t.decisionNote ?? null,
    processed_by: t.processedBy ?? null,
    processed_at: t.processedAt ?? null,
  };
}

export async function fetchFinTransactions(): Promise<FinTransaction[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('fin_transactions').select('*').order('at', { ascending: false });
  if (error) throw error;
  return (data as FinTransactionRow[]).map(fromRow);
}

/** Insert-or-replace by id — matches `handleSaveFinTransaction`'s own upsert semantics. */
export async function upsertFinTransaction(t: FinTransaction): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('fin_transactions').upsert(toRow(t));
  if (error) throw error;
}
