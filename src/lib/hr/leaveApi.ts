import { supabase } from '../supabaseClient';
import { LeaveRecord } from '../../types';

export interface LeaveRecordRow {
  id: string;
  staff_name: string;
  branch: string;
  from_date: string;
  to_date: string;
  type: LeaveRecord['type'];
  status: LeaveRecord['status'];
  days: number;
  reason: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

export function fromRow(row: LeaveRecordRow): LeaveRecord {
  return {
    id: row.id,
    staffName: row.staff_name,
    branch: row.branch,
    from: row.from_date,
    to: row.to_date,
    type: row.type,
    status: row.status,
    days: row.days,
    reason: row.reason,
    requestedAt: row.requested_at,
    decidedBy: row.decided_by ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionNote: row.decision_note ?? undefined,
  };
}

function toRow(record: LeaveRecord): LeaveRecordRow {
  return {
    id: record.id,
    staff_name: record.staffName,
    branch: record.branch,
    from_date: record.from,
    to_date: record.to,
    type: record.type,
    status: record.status,
    days: record.days,
    reason: record.reason,
    requested_at: record.requestedAt,
    decided_by: record.decidedBy ?? null,
    decided_at: record.decidedAt ?? null,
    decision_note: record.decisionNote ?? null,
  };
}

function toRowUpdates(updates: Partial<LeaveRecord>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.staffName !== undefined) row.staff_name = updates.staffName;
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.from !== undefined) row.from_date = updates.from;
  if (updates.to !== undefined) row.to_date = updates.to;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.days !== undefined) row.days = updates.days;
  if (updates.reason !== undefined) row.reason = updates.reason;
  if (updates.requestedAt !== undefined) row.requested_at = updates.requestedAt;
  if (updates.decidedBy !== undefined) row.decided_by = updates.decidedBy;
  if (updates.decidedAt !== undefined) row.decided_at = updates.decidedAt;
  if (updates.decisionNote !== undefined) row.decision_note = updates.decisionNote;
  return row;
}

export async function fetchLeave(): Promise<LeaveRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('leave_records').select('*').order('from_date', { ascending: false });
  if (error) throw error;
  return (data as LeaveRecordRow[]).map(fromRow);
}

export async function insertLeave(record: LeaveRecord): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('leave_records').insert(toRow(record));
  if (error) throw error;
}

export async function updateLeave(id: string, updates: Partial<LeaveRecord>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('leave_records').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}
