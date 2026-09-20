import { supabase } from './supabaseClient';
import { Partner, PartnerCourse } from '../types';

interface PartnerRow {
  id: string;
  name: string;
  type: Partner['type'];
  commission_rate: number;
  courses: unknown;
}

function normalizeCourses(raw: unknown): PartnerCourse[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: Record<string, unknown>): PartnerCourse => ({
    name: typeof c.name === 'string' ? c.name : '',
    price: typeof c.price === 'number' ? c.price : Number(c.price) || 0,
  }));
}

function fromRow(row: PartnerRow): Partner {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    commissionRate: row.commission_rate,
    courses: normalizeCourses(row.courses),
  };
}

function toRow(partner: Partner): PartnerRow {
  return {
    id: partner.id,
    name: partner.name,
    type: partner.type,
    commission_rate: partner.commissionRate,
    courses: partner.courses,
  };
}

function toRowUpdates(updates: Partial<Partner>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.commissionRate !== undefined) row.commission_rate = updates.commissionRate;
  if (updates.courses !== undefined) row.courses = updates.courses;
  return row;
}

export async function fetchPartners(): Promise<Partner[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data as PartnerRow[]).map(fromRow);
}

export async function insertPartner(partner: Partner): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('partners').insert(toRow(partner));
  if (error) throw error;
}

export async function updatePartner(id: string, updates: Partial<Partner>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('partners').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}

export async function deletePartner(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('partners').delete().eq('id', id);
  if (error) throw error;
}
