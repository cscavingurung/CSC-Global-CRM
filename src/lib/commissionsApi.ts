import { supabase } from './supabaseClient';
import { CommissionRecord } from '../types';

interface CommissionRow {
  id: string;
  student_name: string;
  branch: string;
  consultant: string;
  partner: string;
  full_fee: number;
  commission_rate: number;
  commission_status: CommissionRecord['commissionStatus'];
}

function fromRow(row: CommissionRow): CommissionRecord {
  return {
    id: row.id,
    studentName: row.student_name,
    branch: row.branch,
    consultant: row.consultant,
    partner: row.partner,
    fullFee: row.full_fee,
    commissionRate: row.commission_rate,
    commissionStatus: row.commission_status,
  };
}

function toRowUpdates(updates: Partial<CommissionRecord>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.studentName !== undefined) row.student_name = updates.studentName;
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.consultant !== undefined) row.consultant = updates.consultant;
  if (updates.partner !== undefined) row.partner = updates.partner;
  if (updates.fullFee !== undefined) row.full_fee = updates.fullFee;
  if (updates.commissionRate !== undefined) row.commission_rate = updates.commissionRate;
  if (updates.commissionStatus !== undefined) row.commission_status = updates.commissionStatus;
  return row;
}

export async function fetchCommissions(): Promise<CommissionRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('commissions')
    .select('*')
    .order('student_name', { ascending: true });
  if (error) throw error;
  return (data as CommissionRow[]).map(fromRow);
}

export async function updateCommission(id: string, updates: Partial<CommissionRecord>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('commissions').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}
