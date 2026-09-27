import { supabase } from '../supabaseClient';
import { MarketingSupportRequest } from '../../types';

export interface MarketingSupportRequestRow {
  id: string;
  code: string;
  branch: string;
  kind: MarketingSupportRequest['kind'];
  title: string;
  budget: number;
  start_date: string;
  end_date: string | null;
  audience: string;
  justification: string;
  requested_by: string;
  requested_at: string;
  status: MarketingSupportRequest['status'];
  response_note: string | null;
}

export function fromRow(row: MarketingSupportRequestRow): MarketingSupportRequest {
  return {
    id: row.id,
    code: row.code,
    branch: row.branch,
    kind: row.kind,
    title: row.title,
    budget: row.budget,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    audience: row.audience,
    justification: row.justification,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    status: row.status,
    responseNote: row.response_note ?? undefined,
  };
}

function toRow(r: MarketingSupportRequest): MarketingSupportRequestRow {
  return {
    id: r.id,
    code: r.code,
    branch: r.branch,
    kind: r.kind,
    title: r.title,
    budget: r.budget,
    start_date: r.startDate,
    end_date: r.endDate ?? null,
    audience: r.audience,
    justification: r.justification,
    requested_by: r.requestedBy,
    requested_at: r.requestedAt,
    status: r.status,
    response_note: r.responseNote ?? null,
  };
}

function toRowUpdates(updates: Partial<MarketingSupportRequest>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.code !== undefined) row.code = updates.code;
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.kind !== undefined) row.kind = updates.kind;
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.budget !== undefined) row.budget = updates.budget;
  if (updates.startDate !== undefined) row.start_date = updates.startDate;
  if (updates.endDate !== undefined) row.end_date = updates.endDate;
  if (updates.audience !== undefined) row.audience = updates.audience;
  if (updates.justification !== undefined) row.justification = updates.justification;
  if (updates.requestedBy !== undefined) row.requested_by = updates.requestedBy;
  if (updates.requestedAt !== undefined) row.requested_at = updates.requestedAt;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.responseNote !== undefined) row.response_note = updates.responseNote;
  return row;
}

export async function fetchMarketingSupportRequests(): Promise<MarketingSupportRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_support_requests').select('*').order('requested_at', { ascending: false });
  if (error) throw error;
  return (data as MarketingSupportRequestRow[]).map(fromRow);
}

export async function insertMarketingSupportRequest(r: MarketingSupportRequest): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_support_requests').insert(toRow(r));
  if (error) throw error;
}

export async function updateMarketingSupportRequest(id: string, updates: Partial<MarketingSupportRequest>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_support_requests').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}
