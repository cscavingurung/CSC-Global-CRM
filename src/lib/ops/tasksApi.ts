import { supabase } from '../supabaseClient';
import { DailyTask } from '../../types';

export interface TaskRow {
  id: string;
  title: string;
  notes: string | null;
  branch: string;
  assigned_role: DailyTask['assignedRole'];
  assignee: string | null;
  date: string;
  category: DailyTask['category'] | null;
  due_time: string | null;
  priority: DailyTask['priority'];
  status: DailyTask['status'];
  created_by: string;
  updated_by: string | null;
  updated_at: string | null;
}

export function fromRow(row: TaskRow): DailyTask {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? undefined,
    branch: row.branch,
    assignedRole: row.assigned_role,
    assignee: row.assignee ?? undefined,
    date: row.date,
    category: row.category ?? undefined,
    dueTime: row.due_time ?? undefined,
    priority: row.priority,
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function toRow(task: DailyTask): TaskRow {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes ?? null,
    branch: task.branch,
    assigned_role: task.assignedRole,
    assignee: task.assignee ?? null,
    date: task.date,
    category: task.category ?? null,
    due_time: task.dueTime ?? null,
    priority: task.priority,
    status: task.status,
    created_by: task.createdBy,
    updated_by: task.updatedBy ?? null,
    updated_at: task.updatedAt ?? null,
  };
}

function toRowUpdates(updates: Partial<DailyTask>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.assignedRole !== undefined) row.assigned_role = updates.assignedRole;
  if (updates.assignee !== undefined) row.assignee = updates.assignee;
  if (updates.date !== undefined) row.date = updates.date;
  if (updates.category !== undefined) row.category = updates.category;
  if (updates.dueTime !== undefined) row.due_time = updates.dueTime;
  if (updates.priority !== undefined) row.priority = updates.priority;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.createdBy !== undefined) row.created_by = updates.createdBy;
  if (updates.updatedBy !== undefined) row.updated_by = updates.updatedBy;
  if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt;
  return row;
}

export async function fetchTasks(): Promise<DailyTask[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('tasks').select('*').order('date', { ascending: true });
  if (error) throw error;
  return (data as TaskRow[]).map(fromRow);
}

export async function insertTask(task: DailyTask): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('tasks').insert(toRow(task));
  if (error) throw error;
}

export async function updateTask(id: string, updates: Partial<DailyTask>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('tasks').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}
