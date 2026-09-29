import { supabase } from '../supabaseClient';
import { MarketingLead } from '../../types';

export interface MarketingLeadRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: MarketingLead['source'];
  campaign_id: string | null;
  message: string | null;
  received_at: string;
  stage: MarketingLead['stage'];
  preferred_country: string | null;
  interested_program: string | null;
  intake: string | null;
  academic_background: string | null;
  english_test: string | null;
  preferred_branch: string | null;
  city_pool: string | null;
  notes: string | null;
  purpose: string | null;
  address: string | null;
  dob: string | null;
  gender: string | null;
  marital_status: string | null;
  academics: MarketingLead['academics'] | null;
  work_experience: string | null;
  qualified_by: string | null;
  qualified_at: string | null;
  disqualify_reason: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  intake_id: string | null;
}

export function fromRow(row: MarketingLeadRow): MarketingLead {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? undefined,
    source: row.source,
    campaignId: row.campaign_id ?? undefined,
    message: row.message ?? undefined,
    receivedAt: row.received_at,
    stage: row.stage,
    preferredCountry: row.preferred_country ?? undefined,
    interestedProgram: row.interested_program ?? undefined,
    intake: row.intake ?? undefined,
    academicBackground: row.academic_background ?? undefined,
    englishTest: row.english_test ?? undefined,
    preferredBranch: row.preferred_branch ?? undefined,
    cityPool: row.city_pool ?? undefined,
    notes: row.notes ?? undefined,
    purpose: row.purpose ?? undefined,
    address: row.address ?? undefined,
    dob: row.dob ?? undefined,
    gender: row.gender ?? undefined,
    maritalStatus: row.marital_status ?? undefined,
    academics: row.academics ?? undefined,
    workExperience: row.work_experience ?? undefined,
    qualifiedBy: row.qualified_by ?? undefined,
    qualifiedAt: row.qualified_at ?? undefined,
    disqualifyReason: row.disqualify_reason ?? undefined,
    assignedBy: row.assigned_by ?? undefined,
    assignedAt: row.assigned_at ?? undefined,
    intakeId: row.intake_id ?? undefined,
  };
}

function toRow(lead: MarketingLead): MarketingLeadRow {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? null,
    source: lead.source,
    campaign_id: lead.campaignId ?? null,
    message: lead.message ?? null,
    received_at: lead.receivedAt,
    stage: lead.stage,
    preferred_country: lead.preferredCountry ?? null,
    interested_program: lead.interestedProgram ?? null,
    intake: lead.intake ?? null,
    academic_background: lead.academicBackground ?? null,
    english_test: lead.englishTest ?? null,
    preferred_branch: lead.preferredBranch ?? null,
    city_pool: lead.cityPool ?? null,
    notes: lead.notes ?? null,
    purpose: lead.purpose ?? null,
    address: lead.address ?? null,
    dob: lead.dob ?? null,
    gender: lead.gender ?? null,
    marital_status: lead.maritalStatus ?? null,
    academics: lead.academics ?? null,
    work_experience: lead.workExperience ?? null,
    qualified_by: lead.qualifiedBy ?? null,
    qualified_at: lead.qualifiedAt ?? null,
    disqualify_reason: lead.disqualifyReason ?? null,
    assigned_by: lead.assignedBy ?? null,
    assigned_at: lead.assignedAt ?? null,
    intake_id: lead.intakeId ?? null,
  };
}

export async function fetchMarketingLeads(): Promise<MarketingLead[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_leads').select('*').order('received_at', { ascending: false });
  if (error) throw error;
  return (data as MarketingLeadRow[]).map(fromRow);
}

export async function upsertMarketingLead(lead: MarketingLead): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_leads').upsert(toRow(lead));
  if (error) throw error;
}

export async function deleteMarketingLead(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_leads').delete().eq('id', id);
  if (error) throw error;
}
