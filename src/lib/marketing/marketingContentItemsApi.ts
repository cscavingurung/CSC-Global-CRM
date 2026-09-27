import { supabase } from '../supabaseClient';
import { ContentItem } from '../../types';

export interface ContentItemRow {
  id: string;
  title: string;
  platform: string;
  assignee: string;
  deadline: string;
  status: ContentItem['status'];
  branch: string | null;
  person: string | null;
  request_id: string | null;
  published_at: string | null;
  published_link: string | null;
  created_by: string;
}

export function fromRow(row: ContentItemRow): ContentItem {
  return {
    id: row.id,
    title: row.title,
    platform: row.platform,
    assignee: row.assignee,
    deadline: row.deadline,
    status: row.status,
    branch: row.branch ?? undefined,
    person: row.person ?? undefined,
    requestId: row.request_id ?? undefined,
    publishedAt: row.published_at ?? undefined,
    publishedLink: row.published_link ?? undefined,
    createdBy: row.created_by,
  };
}

function toRow(item: ContentItem): ContentItemRow {
  return {
    id: item.id,
    title: item.title,
    platform: item.platform,
    assignee: item.assignee,
    deadline: item.deadline,
    status: item.status,
    branch: item.branch ?? null,
    person: item.person ?? null,
    request_id: item.requestId ?? null,
    published_at: item.publishedAt ?? null,
    published_link: item.publishedLink ?? null,
    created_by: item.createdBy,
  };
}

export async function fetchMarketingContentItems(): Promise<ContentItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_content_items').select('*').order('deadline', { ascending: false });
  if (error) throw error;
  return (data as ContentItemRow[]).map(fromRow);
}

export async function upsertMarketingContentItem(item: ContentItem): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_content_items').upsert(toRow(item));
  if (error) throw error;
}

export async function deleteMarketingContentItem(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_content_items').delete().eq('id', id);
  if (error) throw error;
}
