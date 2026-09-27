import { supabase } from '../supabaseClient';
import { PayProfile } from '../../types';

export interface PayProfileRow {
  staff_name: string;
  branch: string;
  salary_history: PayProfile['salaryHistory'];
  fixed_allowance: number;
  commission_eligible: boolean;
  payment_method: PayProfile['paymentMethod'];
  bank_name: string;
  account_name: string;
  account_number: string;
}

export function fromRow(row: PayProfileRow): PayProfile {
  return {
    staffName: row.staff_name,
    branch: row.branch,
    salaryHistory: row.salary_history,
    fixedAllowance: row.fixed_allowance,
    commissionEligible: row.commission_eligible,
    paymentMethod: row.payment_method,
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNumber: row.account_number,
  };
}

function toRow(profile: PayProfile): PayProfileRow {
  return {
    staff_name: profile.staffName,
    branch: profile.branch,
    salary_history: profile.salaryHistory,
    fixed_allowance: profile.fixedAllowance,
    commission_eligible: profile.commissionEligible,
    payment_method: profile.paymentMethod,
    bank_name: profile.bankName,
    account_name: profile.accountName,
    account_number: profile.accountNumber,
  };
}

export async function fetchPayProfiles(): Promise<PayProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('pay_profiles').select('*').order('staff_name', { ascending: true });
  if (error) throw error;
  return (data as PayProfileRow[]).map(fromRow);
}

export async function upsertPayProfile(profile: PayProfile): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('pay_profiles').upsert(toRow(profile), { onConflict: 'staff_name,branch' });
  if (error) throw error;
}
