import { supabase } from '../supabaseClient';
import { BranchTransfer, TransferLogEntry } from '../../types';

export interface BranchTransferRow {
  id: string;
  code: string;
  client_key: string;
  client_id: string;
  client_name: string;
  from_branch: string;
  to_branch: string;
  from_counselor: string;
  to_counselor: string;
  reason: string;
  visit_date: string;
  requested_by: string;
  requested_at: string;
  status: BranchTransfer['status'];
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  log: TransferLogEntry[];
}

export function fromRow(row: BranchTransferRow): BranchTransfer {
  return {
    id: row.id,
    code: row.code,
    clientKey: row.client_key,
    clientId: row.client_id,
    clientName: row.client_name,
    fromBranch: row.from_branch,
    toBranch: row.to_branch,
    fromCounselor: row.from_counselor,
    toCounselor: row.to_counselor,
    reason: row.reason,
    visitDate: row.visit_date,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    status: row.status,
    decidedBy: row.decided_by ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionNote: row.decision_note ?? undefined,
    log: row.log,
  };
}

function toRow(t: BranchTransfer): BranchTransferRow {
  return {
    id: t.id,
    code: t.code,
    client_key: t.clientKey,
    client_id: t.clientId,
    client_name: t.clientName,
    from_branch: t.fromBranch,
    to_branch: t.toBranch,
    from_counselor: t.fromCounselor,
    to_counselor: t.toCounselor,
    reason: t.reason,
    visit_date: t.visitDate,
    requested_by: t.requestedBy,
    requested_at: t.requestedAt,
    status: t.status,
    decided_by: t.decidedBy ?? null,
    decided_at: t.decidedAt ?? null,
    decision_note: t.decisionNote ?? null,
    log: t.log,
  };
}

function toRowUpdates(updates: Partial<BranchTransfer>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.code !== undefined) row.code = updates.code;
  if (updates.clientKey !== undefined) row.client_key = updates.clientKey;
  if (updates.clientId !== undefined) row.client_id = updates.clientId;
  if (updates.clientName !== undefined) row.client_name = updates.clientName;
  if (updates.fromBranch !== undefined) row.from_branch = updates.fromBranch;
  if (updates.toBranch !== undefined) row.to_branch = updates.toBranch;
  if (updates.fromCounselor !== undefined) row.from_counselor = updates.fromCounselor;
  if (updates.toCounselor !== undefined) row.to_counselor = updates.toCounselor;
  if (updates.reason !== undefined) row.reason = updates.reason;
  if (updates.visitDate !== undefined) row.visit_date = updates.visitDate;
  if (updates.requestedBy !== undefined) row.requested_by = updates.requestedBy;
  if (updates.requestedAt !== undefined) row.requested_at = updates.requestedAt;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.decidedBy !== undefined) row.decided_by = updates.decidedBy;
  if (updates.decidedAt !== undefined) row.decided_at = updates.decidedAt;
  if (updates.decisionNote !== undefined) row.decision_note = updates.decisionNote;
  if (updates.log !== undefined) row.log = updates.log;
  return row;
}

export async function fetchBranchTransfers(): Promise<BranchTransfer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('branch_transfers').select('*').order('requested_at', { ascending: false });
  if (error) throw error;
  return (data as BranchTransferRow[]).map(fromRow);
}

export async function insertBranchTransfer(t: BranchTransfer): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branch_transfers').insert(toRow(t));
  if (error) throw error;
}

export async function updateBranchTransfer(id: string, updates: Partial<BranchTransfer>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branch_transfers').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}
