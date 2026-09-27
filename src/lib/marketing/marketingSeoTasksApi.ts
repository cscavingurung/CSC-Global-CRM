import { supabase } from '../supabaseClient';
import { SeoTask } from '../../types';

export interface SeoTaskRow {
  id: string;
  title: string;
  type: SeoTask['type'];
  keyword: string | null;
  url: string | null;
  assignee: string;
  due: string;
  status: SeoTask['status'];
}

export function fromRow(row: SeoTaskRow): SeoTask {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    keyword: row.keyword ?? undefined,
    url: row.url ?? undefined,
    assignee: row.assignee,
    due: row.due,
    status: row.status,
  };
}

function toRow(task: SeoTask): SeoTaskRow {
  return {
    id: task.id,
    title: task.title,
    type: task.type,
    keyword: task.keyword ?? null,
    url: task.url ?? null,
    assignee: task.assignee,
    due: task.due,
    status: task.status,
  };
}

export async function fetchMarketingSeoTasks(): Promise<SeoTask[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_seo_tasks').select('*').order('due', { ascending: true });
  if (error) throw error;
  return (data as SeoTaskRow[]).map(fromRow);
}

export async function upsertMarketingSeoTask(task: SeoTask): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_seo_tasks').upsert(toRow(task));
  if (error) throw error;
}

export async function deleteMarketingSeoTask(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_seo_tasks').delete().eq('id', id);
  if (error) throw error;
}
