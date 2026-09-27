import { supabase } from '../supabaseClient';
import { AttendanceExplanation } from '../../types';

export interface AttendanceExplanationRow {
  id: string;
  staff_name: string;
  branch: string;
  date: string;
  kind: AttendanceExplanation['kind'];
  status: AttendanceExplanation['status'];
  reason: AttendanceExplanation['reason'] | null;
  note: string | null;
  requested_by: string | null;
  requested_at: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export function fromRow(row: AttendanceExplanationRow): AttendanceExplanation {
  return {
    id: row.id,
    staffName: row.staff_name,
    branch: row.branch,
    date: row.date,
    kind: row.kind,
    status: row.status,
    reason: row.reason ?? undefined,
    note: row.note ?? undefined,
    requestedBy: row.requested_by ?? undefined,
    requestedAt: row.requested_at ?? undefined,
    submittedBy: row.submitted_by ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewNote: row.review_note ?? undefined,
  };
}

function toRow(explanation: AttendanceExplanation): AttendanceExplanationRow {
  return {
    id: explanation.id,
    staff_name: explanation.staffName,
    branch: explanation.branch,
    date: explanation.date,
    kind: explanation.kind,
    status: explanation.status,
    reason: explanation.reason ?? null,
    note: explanation.note ?? null,
    requested_by: explanation.requestedBy ?? null,
    requested_at: explanation.requestedAt ?? null,
    submitted_by: explanation.submittedBy ?? null,
    submitted_at: explanation.submittedAt ?? null,
    reviewed_by: explanation.reviewedBy ?? null,
    reviewed_at: explanation.reviewedAt ?? null,
    review_note: explanation.reviewNote ?? null,
  };
}

export async function fetchAttendanceExplanations(): Promise<AttendanceExplanation[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('attendance_explanations').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data as AttendanceExplanationRow[]).map(fromRow);
}

export async function upsertAttendanceExplanation(explanation: AttendanceExplanation): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('attendance_explanations').upsert(toRow(explanation));
  if (error) throw error;
}
