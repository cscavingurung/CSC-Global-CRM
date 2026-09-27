import { supabase } from '../supabaseClient';
import { ExpenseRequest } from '../../types';

export interface ExpenseRequestRow {
  id: string;
  branch: string;
  title: string;
  category: ExpenseRequest['category'];
  amount: number;
  reason: string;
  requested_by: string;
  requested_at: string;
  receipt_attached: boolean;
  status: ExpenseRequest['status'];
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

export function fromRow(row: ExpenseRequestRow): ExpenseRequest {
  return {
    id: row.id,
    branch: row.branch,
    title: row.title,
    category: row.category,
    amount: row.amount,
    reason: row.reason,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    receiptAttached: row.receipt_attached,
    status: row.status,
    decidedBy: row.decided_by ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionNote: row.decision_note ?? undefined,
  };
}

function toRowUpdates(updates: Partial<ExpenseRequest>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.category !== undefined) row.category = updates.category;
  if (updates.amount !== undefined) row.amount = updates.amount;
  if (updates.reason !== undefined) row.reason = updates.reason;
  if (updates.requestedBy !== undefined) row.requested_by = updates.requestedBy;
  if (updates.requestedAt !== undefined) row.requested_at = updates.requestedAt;
  if (updates.receiptAttached !== undefined) row.receipt_attached = updates.receiptAttached;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.decidedBy !== undefined) row.decided_by = updates.decidedBy;
  if (updates.decidedAt !== undefined) row.decided_at = updates.decidedAt;
  if (updates.decisionNote !== undefined) row.decision_note = updates.decisionNote;
  return row;
}

export async function fetchExpenseRequests(): Promise<ExpenseRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('expense_requests').select('*').order('requested_at', { ascending: false });
  if (error) throw error;
  return (data as ExpenseRequestRow[]).map(fromRow);
}

export async function updateExpenseRequest(id: string, updates: Partial<ExpenseRequest>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('expense_requests').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}
