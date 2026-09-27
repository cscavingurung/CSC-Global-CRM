import { supabase } from '../supabaseClient';
import { OnboardingCase } from '../../types';

export interface OnboardingCaseRow {
  id: string;
  code: string;
  branch: string;
  employee_name: string;
  email: string;
  role: OnboardingCase['role'];
  start_date: string;
  created_at: string;
  created_by: string;
  tasks: OnboardingCase['tasks'];
  completed_at: string | null;
  completed_by: string | null;
  log: OnboardingCase['log'];
}

export function fromRow(row: OnboardingCaseRow): OnboardingCase {
  return {
    id: row.id,
    code: row.code,
    branch: row.branch,
    employeeName: row.employee_name,
    email: row.email,
    role: row.role,
    startDate: row.start_date,
    createdAt: row.created_at,
    createdBy: row.created_by,
    tasks: row.tasks,
    completedAt: row.completed_at ?? undefined,
    completedBy: row.completed_by ?? undefined,
    log: row.log,
  };
}

function toRow(c: OnboardingCase): OnboardingCaseRow {
  return {
    id: c.id,
    code: c.code,
    branch: c.branch,
    employee_name: c.employeeName,
    email: c.email,
    role: c.role,
    start_date: c.startDate,
    created_at: c.createdAt,
    created_by: c.createdBy,
    tasks: c.tasks,
    completed_at: c.completedAt ?? null,
    completed_by: c.completedBy ?? null,
    log: c.log,
  };
}

function toRowUpdates(updates: Partial<OnboardingCase>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.employeeName !== undefined) row.employee_name = updates.employeeName;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.role !== undefined) row.role = updates.role;
  if (updates.startDate !== undefined) row.start_date = updates.startDate;
  if (updates.tasks !== undefined) row.tasks = updates.tasks;
  if (updates.completedAt !== undefined) row.completed_at = updates.completedAt;
  if (updates.completedBy !== undefined) row.completed_by = updates.completedBy;
  if (updates.log !== undefined) row.log = updates.log;
  return row;
}

export async function fetchOnboardingCases(): Promise<OnboardingCase[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('onboarding_cases').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as OnboardingCaseRow[]).map(fromRow);
}

export async function insertOnboardingCase(c: OnboardingCase): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('onboarding_cases').insert(toRow(c));
  if (error) throw error;
}

export async function updateOnboardingCase(id: string, updates: Partial<OnboardingCase>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('onboarding_cases').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}
