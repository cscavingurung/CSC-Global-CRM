import { supabase } from '../supabaseClient';
import { PayrollRun } from '../../types';

export interface PayrollRunRow {
  id: string;
  branch: string;
  month: string;
  status: PayrollRun['status'];
  manual: PayrollRun['manual'];
  snapshot: PayrollRun['snapshot'] | null;
  submitted_by: string | null;
  submitted_at: string | null;
  processed_by: string | null;
  processed_at: string | null;
}

export function fromRow(row: PayrollRunRow): PayrollRun {
  return {
    id: row.id,
    branch: row.branch,
    month: row.month,
    status: row.status,
    manual: row.manual,
    snapshot: row.snapshot ?? undefined,
    submittedBy: row.submitted_by ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    processedBy: row.processed_by ?? undefined,
    processedAt: row.processed_at ?? undefined,
  };
}

function toRow(run: PayrollRun): PayrollRunRow {
  return {
    id: run.id,
    branch: run.branch,
    month: run.month,
    status: run.status,
    manual: run.manual,
    snapshot: run.snapshot ?? null,
    submitted_by: run.submittedBy ?? null,
    submitted_at: run.submittedAt ?? null,
    processed_by: run.processedBy ?? null,
    processed_at: run.processedAt ?? null,
  };
}

export async function fetchPayrollRuns(): Promise<PayrollRun[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('payroll_runs').select('*').order('month', { ascending: false });
  if (error) throw error;
  return (data as PayrollRunRow[]).map(fromRow);
}

export async function upsertPayrollRun(run: PayrollRun): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('payroll_runs').upsert(toRow(run));
  if (error) throw error;
}
