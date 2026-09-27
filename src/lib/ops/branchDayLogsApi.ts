import { supabase } from '../supabaseClient';
import { BranchDayLog } from '../../types';

export interface BranchDayLogRow {
  id: string;
  branch: string;
  date: string;
  opening: BranchDayLog['opening'];
  opened_at: string | null;
  opened_by: string | null;
  closing: BranchDayLog['closing'];
  closed_at: string | null;
  closed_by: string | null;
  closed_with_pending: number | null;
  handover: BranchDayLog['handover'];
}

export function fromRow(row: BranchDayLogRow): BranchDayLog {
  return {
    id: row.id,
    branch: row.branch,
    date: row.date,
    opening: row.opening,
    openedAt: row.opened_at ?? undefined,
    openedBy: row.opened_by ?? undefined,
    closing: row.closing,
    closedAt: row.closed_at ?? undefined,
    closedBy: row.closed_by ?? undefined,
    closedWithPending: row.closed_with_pending ?? undefined,
    handover: row.handover,
  };
}

function toRow(log: BranchDayLog): BranchDayLogRow {
  return {
    id: log.id,
    branch: log.branch,
    date: log.date,
    opening: log.opening,
    opened_at: log.openedAt ?? null,
    opened_by: log.openedBy ?? null,
    closing: log.closing,
    closed_at: log.closedAt ?? null,
    closed_by: log.closedBy ?? null,
    closed_with_pending: log.closedWithPending ?? null,
    handover: log.handover,
  };
}

export async function fetchBranchDayLogs(): Promise<BranchDayLog[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('branch_day_logs').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data as BranchDayLogRow[]).map(fromRow);
}

export async function upsertBranchDayLog(log: BranchDayLog): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branch_day_logs').upsert(toRow(log));
  if (error) throw error;
}
