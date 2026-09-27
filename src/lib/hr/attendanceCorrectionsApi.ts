import { supabase } from '../supabaseClient';
import { AttendanceCorrection } from '../../types';

export interface AttendanceCorrectionRow {
  id: string;
  staff_name: string;
  branch: string;
  date: string;
  field: AttendanceCorrection['field'];
  requested_time: string;
  reason: string;
  requested_at: string;
  requested_by: string | null;
  status: AttendanceCorrection['status'];
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

export function fromRow(row: AttendanceCorrectionRow): AttendanceCorrection {
  return {
    id: row.id,
    staffName: row.staff_name,
    branch: row.branch,
    date: row.date,
    field: row.field,
    requestedTime: row.requested_time,
    reason: row.reason,
    requestedAt: row.requested_at,
    requestedBy: row.requested_by ?? undefined,
    status: row.status,
    decidedBy: row.decided_by ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionNote: row.decision_note ?? undefined,
  };
}

function toRow(correction: AttendanceCorrection): AttendanceCorrectionRow {
  return {
    id: correction.id,
    staff_name: correction.staffName,
    branch: correction.branch,
    date: correction.date,
    field: correction.field,
    requested_time: correction.requestedTime,
    reason: correction.reason,
    requested_at: correction.requestedAt,
    requested_by: correction.requestedBy ?? null,
    status: correction.status,
    decided_by: correction.decidedBy ?? null,
    decided_at: correction.decidedAt ?? null,
    decision_note: correction.decisionNote ?? null,
  };
}

function toRowUpdates(updates: Partial<AttendanceCorrection>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.staffName !== undefined) row.staff_name = updates.staffName;
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.date !== undefined) row.date = updates.date;
  if (updates.field !== undefined) row.field = updates.field;
  if (updates.requestedTime !== undefined) row.requested_time = updates.requestedTime;
  if (updates.reason !== undefined) row.reason = updates.reason;
  if (updates.requestedAt !== undefined) row.requested_at = updates.requestedAt;
  if (updates.requestedBy !== undefined) row.requested_by = updates.requestedBy;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.decidedBy !== undefined) row.decided_by = updates.decidedBy;
  if (updates.decidedAt !== undefined) row.decided_at = updates.decidedAt;
  if (updates.decisionNote !== undefined) row.decision_note = updates.decisionNote;
  return row;
}

export async function fetchAttendanceCorrections(): Promise<AttendanceCorrection[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('attendance_corrections').select('*').order('requested_at', { ascending: false });
  if (error) throw error;
  return (data as AttendanceCorrectionRow[]).map(fromRow);
}

export async function insertAttendanceCorrection(correction: AttendanceCorrection): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('attendance_corrections').insert(toRow(correction));
  if (error) throw error;
}

export async function updateAttendanceCorrection(id: string, updates: Partial<AttendanceCorrection>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('attendance_corrections').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}
