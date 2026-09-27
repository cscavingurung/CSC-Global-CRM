import { supabase } from '../supabaseClient';
import { BranchContentRequest } from '../../types';

export interface BranchContentRequestRow {
  id: string;
  code: string;
  branch: string;
  type: BranchContentRequest['type'];
  intake: string;
  country: string;
  notes: string;
  needed_by: string;
  requested_by: string;
  requested_at: string;
  status: BranchContentRequest['status'];
  updated_at: string | null;
  marketing_note: string | null;
  delivered_link: string | null;
}

export function fromRow(row: BranchContentRequestRow): BranchContentRequest {
  return {
    id: row.id,
    code: row.code,
    branch: row.branch,
    type: row.type,
    intake: row.intake,
    country: row.country,
    notes: row.notes,
    neededBy: row.needed_by,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    status: row.status,
    updatedAt: row.updated_at ?? undefined,
    marketingNote: row.marketing_note ?? undefined,
    deliveredLink: row.delivered_link ?? undefined,
  };
}

function toRow(r: BranchContentRequest): BranchContentRequestRow {
  return {
    id: r.id,
    code: r.code,
    branch: r.branch,
    type: r.type,
    intake: r.intake,
    country: r.country,
    notes: r.notes,
    needed_by: r.neededBy,
    requested_by: r.requestedBy,
    requested_at: r.requestedAt,
    status: r.status,
    updated_at: r.updatedAt ?? null,
    marketing_note: r.marketingNote ?? null,
    delivered_link: r.deliveredLink ?? null,
  };
}

function toRowUpdates(updates: Partial<BranchContentRequest>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.code !== undefined) row.code = updates.code;
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.intake !== undefined) row.intake = updates.intake;
  if (updates.country !== undefined) row.country = updates.country;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.neededBy !== undefined) row.needed_by = updates.neededBy;
  if (updates.requestedBy !== undefined) row.requested_by = updates.requestedBy;
  if (updates.requestedAt !== undefined) row.requested_at = updates.requestedAt;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt;
  if (updates.marketingNote !== undefined) row.marketing_note = updates.marketingNote;
  if (updates.deliveredLink !== undefined) row.delivered_link = updates.deliveredLink;
  return row;
}

export async function fetchBranchContentRequests(): Promise<BranchContentRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('branch_content_requests').select('*').order('requested_at', { ascending: false });
  if (error) throw error;
  return (data as BranchContentRequestRow[]).map(fromRow);
}

export async function insertBranchContentRequest(r: BranchContentRequest): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branch_content_requests').insert(toRow(r));
  if (error) throw error;
}

export async function updateBranchContentRequest(id: string, updates: Partial<BranchContentRequest>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branch_content_requests').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}

export async function deleteBranchContentRequest(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branch_content_requests').delete().eq('id', id);
  if (error) throw error;
}
