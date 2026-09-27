import { supabase } from './supabaseClient';
import { FinService, ServicePrice } from '../types';

// Service Charges price list. Append-only: a fee change or retirement is a new row.

export interface ServicePriceRow {
  id: string;
  name: string;
  category: string;
  country: string;
  fee: number;
  currency: string;
  effective_from: string;
  active: boolean;
  note: string | null;
  set_by: string;
  set_at: string;
}

export function fromRow(row: ServicePriceRow): ServicePrice {
  return {
    id: row.id,
    name: row.name,
    category: row.category as FinService,
    country: row.country,
    fee: Number(row.fee) || 0,
    currency: 'NPR',
    effectiveFrom: row.effective_from,
    active: row.active,
    note: row.note ?? undefined,
    setBy: row.set_by,
    setAt: row.set_at,
  };
}

function toRow(p: ServicePrice): ServicePriceRow {
  return {
    id: p.id, name: p.name, category: p.category, country: p.country, fee: p.fee, currency: p.currency,
    effective_from: p.effectiveFrom, active: p.active, note: p.note ?? null, set_by: p.setBy, set_at: p.setAt,
  };
}

export async function fetchServicePrices(): Promise<ServicePrice[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('service_prices').select('*').order('effective_from', { ascending: false });
  if (error) throw error;
  return (data as ServicePriceRow[]).map(fromRow);
}

export async function insertServicePrice(p: ServicePrice): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('service_prices').insert(toRow(p));
  if (error) throw error;
}
