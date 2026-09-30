import { supabase } from '../supabaseClient';
import { ApplicationRecord, CounselorStudent, IntakeStudent } from '../../types';

// Backs Lead Monitoring (src/components/marketing/MktLeads.tsx LeadsMonitoring) via
// trackMarketingLeads() in src/marketingDept.ts. Marketing has no `select` on students/
// counselor_students/applications (RLS denies it — see 2026-09-27-rls-lockdown.sql /
// marketing-branch-leak-fix.sql), so these call narrow SECURITY DEFINER RPCs
// (2026-09-30-marketing-lead-tracking.sql) that return only the whitelisted columns
// trackMarketingLeads reads, for rows behind one of this org's own marketing_leads —
// never a whole branch's data. Each RPC returns no rows for a non-Marketing caller.

export type TrackedIntake = Pick<IntakeStudent, 'id' | 'branch' | 'broadcastBranch' | 'assignedCounselor' | 'claimedAt'>;
export type TrackedConsultation = Pick<CounselorStudent, 'id' | 'clientId' | 'assignedCounselor' | 'assignedDate' | 'consultationStatus' | 'completedDate' | 'outcome' | 'followUpDate'>;
export type TrackedApplication = Pick<ApplicationRecord, 'clientId' | 'offerApplications' | 'visaApplication' | 'consultationDate' | 'withdrawn'>;

interface TrackedIntakeRow {
  id: string;
  branch: string | null;
  broadcast_branch: string | null;
  assigned_counselor: string | null;
  claimed_at: string | null;
}

interface TrackedConsultationRow {
  id: string;
  client_id: string | null;
  assigned_counselor: string;
  assigned_date: string;
  consultation_status: CounselorStudent['consultationStatus'];
  completed_date: string | null;
  outcome: CounselorStudent['outcome'];
  follow_up_date: string | null;
}

interface TrackedApplicationRow {
  client_id: string;
  offer_applications: ApplicationRecord['offerApplications'] | null;
  visa_application: ApplicationRecord['visaApplication'] | null;
  consultation_date: string;
  withdrawn: boolean | null;
}

export async function fetchMarketingTrackedIntakes(): Promise<TrackedIntake[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('marketing_tracked_intakes');
  if (error) throw error;
  return (data as TrackedIntakeRow[]).map((row) => ({
    id: row.id,
    branch: row.branch ?? '',
    broadcastBranch: row.broadcast_branch,
    assignedCounselor: row.assigned_counselor,
    claimedAt: row.claimed_at ?? undefined,
  }));
}

export async function fetchMarketingTrackedConsultations(): Promise<TrackedConsultation[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('marketing_tracked_consultations');
  if (error) throw error;
  return (data as TrackedConsultationRow[]).map((row) => ({
    id: row.id,
    clientId: row.client_id ?? undefined,
    assignedCounselor: row.assigned_counselor,
    assignedDate: row.assigned_date,
    consultationStatus: row.consultation_status,
    completedDate: row.completed_date,
    outcome: row.outcome,
    followUpDate: row.follow_up_date,
  }));
}

export async function fetchMarketingTrackedApplications(): Promise<TrackedApplication[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('marketing_tracked_applications');
  if (error) throw error;
  return (data as TrackedApplicationRow[]).map((row) => ({
    clientId: row.client_id,
    offerApplications: row.offer_applications ?? [],
    visaApplication: row.visa_application,
    consultationDate: row.consultation_date,
    withdrawn: row.withdrawn ?? false,
  }));
}
