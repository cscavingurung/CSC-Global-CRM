import { supabase } from '../supabaseClient';
import { BranchPing } from '../../types';

export interface BranchPingRow {
  id: string;
  branch: string;
  rule: BranchPing['rule'];
  lead_ids: string[];
  at: string;
  by: string;
}

export function fromRow(row: BranchPingRow): BranchPing {
  return {
    id: row.id,
    branch: row.branch,
    rule: row.rule,
    leadIds: row.lead_ids,
    at: row.at,
    by: row.by,
  };
}

function toRow(ping: BranchPing): BranchPingRow {
  return {
    id: ping.id,
    branch: ping.branch,
    rule: ping.rule,
    lead_ids: ping.leadIds,
    at: ping.at,
    by: ping.by,
  };
}

export async function fetchMarketingPings(): Promise<BranchPing[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_pings').select('*').order('at', { ascending: false });
  if (error) throw error;
  return (data as BranchPingRow[]).map(fromRow);
}

export async function upsertMarketingPing(ping: BranchPing): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_pings').upsert(toRow(ping));
  if (error) throw error;
}

export async function deleteMarketingPing(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_pings').delete().eq('id', id);
  if (error) throw error;
}
