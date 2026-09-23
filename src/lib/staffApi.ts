import { supabase } from './supabaseClient';
import { StaffMember } from '../types';

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  password: string;
  role: StaffMember['role'];
  status: StaffMember['status'];
  branch: string;
}

export function fromRow(row: StaffRow): StaffMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    status: row.status,
    branch: row.branch,
  };
}

function toRowUpdates(updates: Partial<StaffMember>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.password !== undefined) row.password = updates.password;
  if (updates.role !== undefined) row.role = updates.role;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.branch !== undefined) row.branch = updates.branch;
  return row;
}

export async function fetchStaff(): Promise<StaffMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('staff').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data as StaffRow[]).map(fromRow);
}

export async function insertStaff(member: StaffMember): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('staff').insert(member);
  if (error) throw error;
}

export async function updateStaff(id: string, updates: Partial<StaffMember>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('staff').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}

export async function deleteStaff(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('staff').delete().eq('id', id);
  if (error) throw error;
}
