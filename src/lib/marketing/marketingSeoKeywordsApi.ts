import { supabase } from '../supabaseClient';
import { SeoKeyword } from '../../types';

// No `id` field on SeoKeyword — the keyword text itself is the primary key.
export interface SeoKeywordRow {
  keyword: string;
  position: number;
  previous: number;
  monthly_searches: number;
  url: string;
}

export function fromRow(row: SeoKeywordRow): SeoKeyword {
  return {
    keyword: row.keyword,
    position: row.position,
    previous: row.previous,
    monthlySearches: row.monthly_searches,
    url: row.url,
  };
}

function toRow(k: SeoKeyword): SeoKeywordRow {
  return {
    keyword: k.keyword,
    position: k.position,
    previous: k.previous,
    monthly_searches: k.monthlySearches,
    url: k.url,
  };
}

export async function fetchMarketingSeoKeywords(): Promise<SeoKeyword[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_seo_keywords').select('*').order('position', { ascending: true });
  if (error) throw error;
  return (data as SeoKeywordRow[]).map(fromRow);
}

export async function upsertMarketingSeoKeyword(k: SeoKeyword): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_seo_keywords').upsert(toRow(k));
  if (error) throw error;
}

export async function deleteMarketingSeoKeyword(keyword: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_seo_keywords').delete().eq('keyword', keyword);
  if (error) throw error;
}
