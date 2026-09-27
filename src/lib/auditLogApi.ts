import { supabase } from './supabaseClient';
import { AuditOverrideEntry } from '../types';

// Append-only, per the type's own convention — no update/delete.
export interface AuditLogRow {
  id: string;
  at: string;
  by: string;
  record: string;
  field: string;
  from_value: string;
  to_value: string;
  reason: string;
}

export function fromRow(row: AuditLogRow): AuditOverrideEntry {
  return {
    id: row.id,
    at: row.at,
    by: row.by,
    record: row.record,
    field: row.field,
    from: row.from_value,
    to: row.to_value,
    reason: row.reason,
  };
}

function toRow(entry: AuditOverrideEntry): AuditLogRow {
  return {
    id: entry.id,
    at: entry.at,
    by: entry.by,
    record: entry.record,
    field: entry.field,
    from_value: entry.from,
    to_value: entry.to,
    reason: entry.reason,
  };
}

export async function fetchAuditLog(): Promise<AuditOverrideEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('audit_log').select('*').order('at', { ascending: false });
  if (error) throw error;
  return (data as AuditLogRow[]).map(fromRow);
}

export async function insertAuditLogEntry(entry: AuditOverrideEntry): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('audit_log').insert(toRow(entry));
  if (error) throw error;
}
