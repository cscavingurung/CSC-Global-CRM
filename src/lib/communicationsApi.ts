import { supabase } from './supabaseClient';
import { CommunicationEntry } from '../types';

export interface CommunicationRow {
  id: string;
  client_key: string;
  client_name: string;
  channel: CommunicationEntry['channel'];
  direction: CommunicationEntry['direction'];
  occurred_at: string;
  summary: string;
  outcome: string;
  next_action: string | null;
  next_action_date: string | null;
  logged_by: string;
  logged_by_role: CommunicationEntry['loggedByRole'];
  created_at: string;
}

export function fromRow(row: CommunicationRow): CommunicationEntry {
  return {
    id: row.id,
    clientKey: row.client_key,
    clientName: row.client_name,
    channel: row.channel,
    direction: row.direction,
    occurredAt: row.occurred_at,
    summary: row.summary,
    outcome: row.outcome,
    nextAction: row.next_action ?? undefined,
    nextActionDate: row.next_action_date ?? undefined,
    loggedBy: row.logged_by,
    loggedByRole: row.logged_by_role,
    createdAt: row.created_at,
  };
}

function toRow(e: CommunicationEntry): CommunicationRow {
  return {
    id: e.id,
    client_key: e.clientKey,
    client_name: e.clientName,
    channel: e.channel,
    direction: e.direction,
    occurred_at: e.occurredAt,
    summary: e.summary,
    outcome: e.outcome,
    next_action: e.nextAction ?? null,
    next_action_date: e.nextActionDate ?? null,
    logged_by: e.loggedBy,
    logged_by_role: e.loggedByRole,
    created_at: e.createdAt,
  };
}

export async function fetchCommunications(): Promise<CommunicationEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('communication_logs').select('*').order('occurred_at', { ascending: false });
  if (error) throw error;
  return (data as CommunicationRow[]).map(fromRow);
}

// Entries are append-only — the log is a record of what happened, so there's no edit/delete.
export async function insertCommunication(entry: CommunicationEntry): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('communication_logs').insert(toRow(entry));
  if (error) throw error;
}
