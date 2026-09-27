import { supabase } from '../supabaseClient';
import { SocialPost } from '../../types';

export interface SocialPostRow {
  id: string;
  platform: SocialPost['platform'];
  caption: string;
  scheduled_at: string;
  status: SocialPost['status'];
  campaign_id: string | null;
  design_task_id: string | null;
  created_by: string;
  published_at: string | null;
  reach: number | null;
  engagements: number | null;
  leads: number | null;
}

export function fromRow(row: SocialPostRow): SocialPost {
  return {
    id: row.id,
    platform: row.platform,
    caption: row.caption,
    scheduledAt: row.scheduled_at,
    status: row.status,
    campaignId: row.campaign_id ?? undefined,
    designTaskId: row.design_task_id ?? undefined,
    createdBy: row.created_by,
    publishedAt: row.published_at ?? undefined,
    reach: row.reach ?? undefined,
    engagements: row.engagements ?? undefined,
    leads: row.leads ?? undefined,
  };
}

function toRow(post: SocialPost): SocialPostRow {
  return {
    id: post.id,
    platform: post.platform,
    caption: post.caption,
    scheduled_at: post.scheduledAt,
    status: post.status,
    campaign_id: post.campaignId ?? null,
    design_task_id: post.designTaskId ?? null,
    created_by: post.createdBy,
    published_at: post.publishedAt ?? null,
    reach: post.reach ?? null,
    engagements: post.engagements ?? null,
    leads: post.leads ?? null,
  };
}

export async function fetchMarketingPosts(): Promise<SocialPost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_posts').select('*').order('scheduled_at', { ascending: false });
  if (error) throw error;
  return (data as SocialPostRow[]).map(fromRow);
}

export async function upsertMarketingPost(post: SocialPost): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_posts').upsert(toRow(post));
  if (error) throw error;
}

export async function deleteMarketingPost(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_posts').delete().eq('id', id);
  if (error) throw error;
}
