import { supabase } from '../supabaseClient';
import { AttendanceRecord } from '../../types';

export interface AttendanceRow {
  id: string;
  staff_name: string;
  branch: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  original: AttendanceRecord['original'] | null;
  amendments: NonNullable<AttendanceRecord['amendments']>;
}

export function fromRow(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    staffName: row.staff_name,
    branch: row.branch,
    date: row.date,
    checkIn: row.check_in ?? undefined,
    checkOut: row.check_out ?? undefined,
    original: row.original ?? undefined,
    amendments: row.amendments,
  };
}

function toRow(record: AttendanceRecord): AttendanceRow {
  return {
    id: record.id,
    staff_name: record.staffName,
    branch: record.branch,
    date: record.date,
    check_in: record.checkIn ?? null,
    check_out: record.checkOut ?? null,
    original: record.original ?? null,
    amendments: record.amendments ?? [],
  };
}

export async function fetchAttendance(): Promise<AttendanceRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('attendance').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data as AttendanceRow[]).map(fromRow);
}

export async function upsertAttendance(record: AttendanceRecord): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('attendance').upsert(toRow(record));
  if (error) throw error;
}
