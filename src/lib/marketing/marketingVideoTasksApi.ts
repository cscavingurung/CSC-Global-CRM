import { supabase } from '../supabaseClient';
import { VideoTask } from '../../types';

export interface VideoTaskRow {
  id: string;
  title: string;
  source_link: string | null;
  instructions: string;
  platform: VideoTask['platform'];
  duration: string;
  deadline: string;
  status: VideoTask['status'];
  priority: VideoTask['priority'] | null;
  requested_by: string;
  assignee: string | null;
  branch: string | null;
  person: string | null;
  request_id: string | null;
  content_item_id: string | null;
  final_files: VideoTask['finalFiles'] | null;
  review_note: string | null;
  completed_at: string | null;
}

export function fromRow(row: VideoTaskRow): VideoTask {
  return {
    id: row.id,
    title: row.title,
    sourceLink: row.source_link ?? undefined,
    instructions: row.instructions,
    platform: row.platform,
    duration: row.duration,
    deadline: row.deadline,
    status: row.status,
    priority: row.priority ?? undefined,
    requestedBy: row.requested_by,
    assignee: row.assignee ?? undefined,
    branch: row.branch ?? undefined,
    person: row.person ?? undefined,
    requestId: row.request_id ?? undefined,
    contentItemId: row.content_item_id ?? undefined,
    finalFiles: row.final_files ?? undefined,
    reviewNote: row.review_note ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

function toRow(task: VideoTask): VideoTaskRow {
  return {
    id: task.id,
    title: task.title,
    source_link: task.sourceLink ?? null,
    instructions: task.instructions,
    platform: task.platform,
    duration: task.duration,
    deadline: task.deadline,
    status: task.status,
    priority: task.priority ?? null,
    requested_by: task.requestedBy,
    assignee: task.assignee ?? null,
    branch: task.branch ?? null,
    person: task.person ?? null,
    request_id: task.requestId ?? null,
    content_item_id: task.contentItemId ?? null,
    final_files: task.finalFiles ?? null,
    review_note: task.reviewNote ?? null,
    completed_at: task.completedAt ?? null,
  };
}

export async function fetchMarketingVideoTasks(): Promise<VideoTask[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_video_tasks').select('*').order('deadline', { ascending: false });
  if (error) throw error;
  return (data as VideoTaskRow[]).map(fromRow);
}

export async function upsertMarketingVideoTask(task: VideoTask): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_video_tasks').upsert(toRow(task));
  if (error) throw error;
}

export async function deleteMarketingVideoTask(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_video_tasks').delete().eq('id', id);
  if (error) throw error;
}
