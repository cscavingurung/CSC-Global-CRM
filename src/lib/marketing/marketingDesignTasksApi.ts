import { supabase } from '../supabaseClient';
import { DesignTask } from '../../types';

export interface DesignTaskRow {
  id: string;
  title: string;
  brief: string;
  type: DesignTask['type'] | null;
  priority: DesignTask['priority'] | null;
  caption: string | null;
  reference_links: string[] | null;
  assets: DesignTask['assets'] | null;
  platform: DesignTask['platform'];
  dimensions: string;
  deadline: string;
  stage: DesignTask['stage'];
  requested_by: string;
  assignee: string | null;
  campaign_id: string | null;
  content_item_id: string | null;
  final_files: DesignTask['finalFiles'] | null;
  review_note: string | null;
}

export function fromRow(row: DesignTaskRow): DesignTask {
  return {
    id: row.id,
    title: row.title,
    brief: row.brief,
    type: row.type ?? undefined,
    priority: row.priority ?? undefined,
    caption: row.caption ?? undefined,
    references: row.reference_links ?? undefined,
    assets: row.assets ?? undefined,
    platform: row.platform,
    dimensions: row.dimensions,
    deadline: row.deadline,
    stage: row.stage,
    requestedBy: row.requested_by,
    assignee: row.assignee ?? undefined,
    campaignId: row.campaign_id ?? undefined,
    contentItemId: row.content_item_id ?? undefined,
    finalFiles: row.final_files ?? undefined,
    reviewNote: row.review_note ?? undefined,
  };
}

function toRow(task: DesignTask): DesignTaskRow {
  return {
    id: task.id,
    title: task.title,
    brief: task.brief,
    type: task.type ?? null,
    priority: task.priority ?? null,
    caption: task.caption ?? null,
    reference_links: task.references ?? null,
    assets: task.assets ?? null,
    platform: task.platform,
    dimensions: task.dimensions,
    deadline: task.deadline,
    stage: task.stage,
    requested_by: task.requestedBy,
    assignee: task.assignee ?? null,
    campaign_id: task.campaignId ?? null,
    content_item_id: task.contentItemId ?? null,
    final_files: task.finalFiles ?? null,
    review_note: task.reviewNote ?? null,
  };
}

export async function fetchMarketingDesignTasks(): Promise<DesignTask[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_design_tasks').select('*').order('deadline', { ascending: false });
  if (error) throw error;
  return (data as DesignTaskRow[]).map(fromRow);
}

export async function upsertMarketingDesignTask(task: DesignTask): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_design_tasks').upsert(toRow(task));
  if (error) throw error;
}

export async function deleteMarketingDesignTask(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_design_tasks').delete().eq('id', id);
  if (error) throw error;
}
