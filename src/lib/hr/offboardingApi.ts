import { supabase } from '../supabaseClient';
import { OffboardingCase } from '../../types';

export interface OffboardingCaseRow {
  id: string;
  code: string;
  branch: string;
  employee_name: string;
  role: OffboardingCase['role'];
  reason: OffboardingCase['reason'];
  notice_date: string;
  last_working_day: string;
  created_at: string;
  created_by: string;
  tasks: OffboardingCase['tasks'];
  clearance: OffboardingCase['clearance'];
  exit_interview: OffboardingCase['exitInterview'] | null;
  handover_log: OffboardingCase['handoverLog'];
  finalized_at: string | null;
  finalized_by: string | null;
  log: OffboardingCase['log'];
}

export function fromRow(row: OffboardingCaseRow): OffboardingCase {
  return {
    id: row.id,
    code: row.code,
    branch: row.branch,
    employeeName: row.employee_name,
    role: row.role,
    reason: row.reason,
    noticeDate: row.notice_date,
    lastWorkingDay: row.last_working_day,
    createdAt: row.created_at,
    createdBy: row.created_by,
    tasks: row.tasks,
    clearance: row.clearance,
    exitInterview: row.exit_interview ?? undefined,
    handoverLog: row.handover_log,
    finalizedAt: row.finalized_at ?? undefined,
    finalizedBy: row.finalized_by ?? undefined,
    log: row.log,
  };
}

function toRow(c: OffboardingCase): OffboardingCaseRow {
  return {
    id: c.id,
    code: c.code,
    branch: c.branch,
    employee_name: c.employeeName,
    role: c.role,
    reason: c.reason,
    notice_date: c.noticeDate,
    last_working_day: c.lastWorkingDay,
    created_at: c.createdAt,
    created_by: c.createdBy,
    tasks: c.tasks,
    clearance: c.clearance,
    exit_interview: c.exitInterview ?? null,
    handover_log: c.handoverLog,
    finalized_at: c.finalizedAt ?? null,
    finalized_by: c.finalizedBy ?? null,
    log: c.log,
  };
}

function toRowUpdates(updates: Partial<OffboardingCase>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.employeeName !== undefined) row.employee_name = updates.employeeName;
  if (updates.role !== undefined) row.role = updates.role;
  if (updates.reason !== undefined) row.reason = updates.reason;
  if (updates.noticeDate !== undefined) row.notice_date = updates.noticeDate;
  if (updates.lastWorkingDay !== undefined) row.last_working_day = updates.lastWorkingDay;
  if (updates.tasks !== undefined) row.tasks = updates.tasks;
  if (updates.clearance !== undefined) row.clearance = updates.clearance;
  if (updates.exitInterview !== undefined) row.exit_interview = updates.exitInterview;
  if (updates.handoverLog !== undefined) row.handover_log = updates.handoverLog;
  if (updates.finalizedAt !== undefined) row.finalized_at = updates.finalizedAt;
  if (updates.finalizedBy !== undefined) row.finalized_by = updates.finalizedBy;
  if (updates.log !== undefined) row.log = updates.log;
  return row;
}

export async function fetchOffboardingCases(): Promise<OffboardingCase[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('offboarding_cases').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as OffboardingCaseRow[]).map(fromRow);
}

export async function insertOffboardingCase(c: OffboardingCase): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('offboarding_cases').insert(toRow(c));
  if (error) throw error;
}

export async function updateOffboardingCase(id: string, updates: Partial<OffboardingCase>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('offboarding_cases').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}
