import { supabase } from '../supabaseClient';
import { Holiday } from '../../types';

export interface HolidayRow {
  id: string;
  name: string;
  type: Holiday['type'];
  from_date: string;
  to_date: string;
  repeats_annually: boolean;
  applies_to: Holiday['appliesTo'];
  created_by: string;
}

export function fromRow(row: HolidayRow): Holiday {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    from: row.from_date,
    to: row.to_date,
    repeatsAnnually: row.repeats_annually,
    appliesTo: row.applies_to,
    createdBy: row.created_by,
  };
}

function toRow(holiday: Holiday): HolidayRow {
  return {
    id: holiday.id,
    name: holiday.name,
    type: holiday.type,
    from_date: holiday.from,
    to_date: holiday.to,
    repeats_annually: holiday.repeatsAnnually,
    applies_to: holiday.appliesTo,
    created_by: holiday.createdBy,
  };
}

export async function fetchHolidays(): Promise<Holiday[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('holidays').select('*').order('from_date', { ascending: false });
  if (error) throw error;
  return (data as HolidayRow[]).map(fromRow);
}

export async function upsertHoliday(holiday: Holiday): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('holidays').upsert(toRow(holiday));
  if (error) throw error;
}

export async function deleteHoliday(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('holidays').delete().eq('id', id);
  if (error) throw error;
}
