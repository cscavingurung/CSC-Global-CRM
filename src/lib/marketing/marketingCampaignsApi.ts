import { supabase } from '../supabaseClient';
import { Campaign } from '../../types';

export interface CampaignRow {
  id: string;
  name: string;
  platform: Campaign['platform'];
  objective: Campaign['objective'];
  target: number;
  start_date: string;
  end_date: string;
  budget: number;
  created_by: string;
}

export function fromRow(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    objective: row.objective,
    target: row.target,
    startDate: row.start_date,
    endDate: row.end_date,
    budget: row.budget,
    createdBy: row.created_by,
  };
}

function toRow(campaign: Campaign): CampaignRow {
  return {
    id: campaign.id,
    name: campaign.name,
    platform: campaign.platform,
    objective: campaign.objective,
    target: campaign.target,
    start_date: campaign.startDate,
    end_date: campaign.endDate,
    budget: campaign.budget,
    created_by: campaign.createdBy,
  };
}

export async function fetchMarketingCampaigns(): Promise<Campaign[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_campaigns').select('*').order('start_date', { ascending: false });
  if (error) throw error;
  return (data as CampaignRow[]).map(fromRow);
}

export async function upsertMarketingCampaign(campaign: Campaign): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_campaigns').upsert(toRow(campaign));
  if (error) throw error;
}

export async function deleteMarketingCampaign(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id);
  if (error) throw error;
}
