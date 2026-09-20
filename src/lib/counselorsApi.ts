import { supabase } from './supabaseClient';
import { Counselor } from '../types';

interface CounselorRow {
  id: string;
  name: string;
  country: string;
  active_assignments: number;
  availability: Counselor['availability'];
}

function fromRow(row: CounselorRow): Counselor {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    activeAssignments: row.active_assignments,
    availability: row.availability,
  };
}

function toRow(counselor: Counselor): CounselorRow {
  return {
    id: counselor.id,
    name: counselor.name,
    country: counselor.country,
    active_assignments: counselor.activeAssignments,
    availability: counselor.availability,
  };
}

function toRowUpdates(updates: Partial<Counselor>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.country !== undefined) row.country = updates.country;
  if (updates.activeAssignments !== undefined) row.active_assignments = updates.activeAssignments;
  if (updates.availability !== undefined) row.availability = updates.availability;
  return row;
}

export async function fetchCounselors(): Promise<Counselor[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('counselors')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data as CounselorRow[]).map(fromRow);
}

export async function insertCounselor(counselor: Counselor): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('counselors').insert(toRow(counselor));
  if (error) throw error;
}

export async function updateCounselor(id: string, updates: Partial<Counselor>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('counselors').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}

export async function deleteCounselor(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('counselors').delete().eq('id', id);
  if (error) throw error;
}
