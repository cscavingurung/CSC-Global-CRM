import { supabase } from '../supabaseClient';
import { AdSpend } from '../../types';

export interface AdSpendRow {
  id: string;
  campaign_id: string;
  date: string;
  amount: number;
  ad_name: string;
  logged_by: string;
}

export function fromRow(row: AdSpendRow): AdSpend {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    date: row.date,
    amount: row.amount,
    adName: row.ad_name,
    loggedBy: row.logged_by,
  };
}

function toRow(spend: AdSpend): AdSpendRow {
  return {
    id: spend.id,
    campaign_id: spend.campaignId,
    date: spend.date,
    amount: spend.amount,
    ad_name: spend.adName,
    logged_by: spend.loggedBy,
  };
}

export async function fetchMarketingAdSpend(): Promise<AdSpend[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_ad_spend').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data as AdSpendRow[]).map(fromRow);
}

export async function upsertMarketingAdSpend(spend: AdSpend): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_ad_spend').upsert(toRow(spend));
  if (error) throw error;
}

export async function deleteMarketingAdSpend(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_ad_spend').delete().eq('id', id);
  if (error) throw error;
}
