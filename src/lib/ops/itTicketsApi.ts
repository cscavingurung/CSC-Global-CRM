import { supabase } from '../supabaseClient';
import { ItTicket, ItTicketEvent } from '../../types';

export interface ItTicketRow {
  id: string;
  code: string;
  branch: string;
  category: ItTicket['category'];
  priority: ItTicket['priority'];
  subject: string;
  description: string;
  attachments: string[];
  raised_by: string;
  raised_at: string;
  status: ItTicket['status'];
  assignee: string | null;
  resolution: string | null;
  resolved_at: string | null;
  history: ItTicketEvent[];
}

export function fromRow(row: ItTicketRow): ItTicket {
  return {
    id: row.id,
    code: row.code,
    branch: row.branch,
    category: row.category,
    priority: row.priority,
    subject: row.subject,
    description: row.description,
    attachments: row.attachments,
    raisedBy: row.raised_by,
    raisedAt: row.raised_at,
    status: row.status,
    assignee: row.assignee ?? undefined,
    resolution: row.resolution ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    history: row.history,
  };
}

function toRow(t: ItTicket): ItTicketRow {
  return {
    id: t.id,
    code: t.code,
    branch: t.branch,
    category: t.category,
    priority: t.priority,
    subject: t.subject,
    description: t.description,
    attachments: t.attachments,
    raised_by: t.raisedBy,
    raised_at: t.raisedAt,
    status: t.status,
    assignee: t.assignee ?? null,
    resolution: t.resolution ?? null,
    resolved_at: t.resolvedAt ?? null,
    history: t.history,
  };
}

function toRowUpdates(updates: Partial<ItTicket>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.code !== undefined) row.code = updates.code;
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.category !== undefined) row.category = updates.category;
  if (updates.priority !== undefined) row.priority = updates.priority;
  if (updates.subject !== undefined) row.subject = updates.subject;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.attachments !== undefined) row.attachments = updates.attachments;
  if (updates.raisedBy !== undefined) row.raised_by = updates.raisedBy;
  if (updates.raisedAt !== undefined) row.raised_at = updates.raisedAt;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.assignee !== undefined) row.assignee = updates.assignee;
  if (updates.resolution !== undefined) row.resolution = updates.resolution;
  if (updates.resolvedAt !== undefined) row.resolved_at = updates.resolvedAt;
  if (updates.history !== undefined) row.history = updates.history;
  return row;
}

export async function fetchItTickets(): Promise<ItTicket[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('it_tickets').select('*').order('raised_at', { ascending: false });
  if (error) throw error;
  return (data as ItTicketRow[]).map(fromRow);
}

export async function insertItTicket(t: ItTicket): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('it_tickets').insert(toRow(t));
  if (error) throw error;
}

export async function updateItTicket(id: string, updates: Partial<ItTicket>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('it_tickets').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}
