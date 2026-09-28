import { supabase } from './supabaseClient';
import { StaffMember } from '../types';

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  auth_user_id: string | null;
  role: StaffMember['role'];
  status: StaffMember['status'];
  branch: string;
  join_date: string | null;
  marketing_role: StaffMember['marketingRole'] | null;
}

export function fromRow(row: StaffRow): StaffMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    authUserId: row.auth_user_id ?? undefined,
    role: row.role,
    status: row.status,
    branch: row.branch,
    joinDate: row.join_date ?? undefined,
    marketingRole: row.marketing_role ?? undefined,
  };
}

function toRow(member: StaffMember): StaffRow {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    auth_user_id: member.authUserId ?? null,
    role: member.role,
    status: member.status,
    branch: member.branch,
    join_date: member.joinDate ?? null,
    marketing_role: member.marketingRole ?? null,
  };
}

function toRowUpdates(updates: Partial<StaffMember>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.authUserId !== undefined) row.auth_user_id = updates.authUserId;
  if (updates.role !== undefined) row.role = updates.role;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.joinDate !== undefined) row.join_date = updates.joinDate;
  if (updates.marketingRole !== undefined) row.marketing_role = updates.marketingRole;
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
  const { error } = await supabase.from('staff').insert(toRow(member));
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
