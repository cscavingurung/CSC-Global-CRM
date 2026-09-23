import { supabase } from './supabaseClient';
import { Branch } from '../types';

export interface BranchRow {
  id: string;
  name: string;
  location: string;
  manager: string | null;
}

export function fromRow(row: BranchRow): Branch {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    manager: row.manager,
  };
}

function toRow(branch: Branch): BranchRow {
  return {
    id: branch.id,
    name: branch.name,
    location: branch.location,
    manager: branch.manager,
  };
}

function toRowUpdates(updates: Partial<Branch>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.location !== undefined) row.location = updates.location;
  if (updates.manager !== undefined) row.manager = updates.manager;
  return row;
}

export async function fetchBranches(): Promise<Branch[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('branches').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data as BranchRow[]).map(fromRow);
}

export async function insertBranch(branch: Branch): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branches').insert(toRow(branch));
  if (error) throw error;
}

export async function updateBranch(id: string, updates: Partial<Branch>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branches').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}

export async function deleteBranch(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branches').delete().eq('id', id);
  if (error) throw error;
}
