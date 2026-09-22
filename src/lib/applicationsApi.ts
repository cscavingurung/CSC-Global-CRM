import { supabase } from './supabaseClient';
import { ApplicationRecord, ClientNote, OfferApplication, OfferStatus, Role, VisaApplication, VisaStageStatus } from '../types';

interface ApplicationRow {
  id: string;
  client_id: string | null;
  name: string;
  phone: string;
  email: string;
  country: string;
  purpose: string;
  dob: string | null;
  gender: string | null;
  marital_status: string | null;
  academic_qualification: string | null;
  ielts_pte: string | null;
  work_experience: string | null;
  counselor: string;
  consultation_date: string;
  added_by: string | null;
  platform_source: string | null;
  visit_date_time: string | null;
  consultation_notes: string;
  branch: string;
  offer_applications: unknown;
  visa_application: unknown;
  withdrawn: boolean | null;
  withdrawn_date: string | null;
  notes: unknown;
}

const OFFER_STATUSES: OfferStatus[] = ['Enrolled', 'Applied to Institution', 'Offer Received', 'Rejected', 'Fee Paid'];
const VISA_STAGE_STATUSES: VisaStageStatus[] = ['Preparing Documents', 'File Ready for Visa', 'Visa Applied', 'Visa Approved', 'Visa Refused'];
const ROLES: Role[] = ['super_admin', 'marketing', 'finance', 'branch_manager', 'receptionist', 'counselor', 'application_officer'];

function normalizeNotes(raw: unknown): ClientNote[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((n: Record<string, unknown>, i: number): ClientNote => ({
    id: typeof n.id === 'string' ? n.id : `note${Date.now()}${i}`,
    text: typeof n.text === 'string' ? n.text : '',
    authorName: typeof n.authorName === 'string' ? n.authorName : 'Unknown',
    authorRole: ROLES.includes(n.authorRole as Role) ? (n.authorRole as Role) : 'application_officer',
    createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date().toISOString().slice(0, 10),
  }));
}

// Defensive against rows saved under the pre-two-stage schema (institution/course + Preparing
// Documents/Offer Received/Accepted/Declined, or a documents[] visa checklist) — coerces
// unrecognised shapes to sane defaults instead of throwing when the officer opens the record.
function normalizeOfferApplications(raw: unknown): OfferApplication[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o: Record<string, unknown>, i: number): OfferApplication => {
    const status = OFFER_STATUSES.includes(o.status as OfferStatus) ? (o.status as OfferStatus) : 'Enrolled';
    return {
      id: typeof o.id === 'string' ? o.id : `o${Date.now()}${i}`,
      institution: typeof o.institution === 'string' ? o.institution : 'Unknown institution',
      status,
      course: typeof o.course === 'string' ? o.course : undefined,
      intake: typeof o.intake === 'string' ? o.intake : undefined,
      clientRefId: typeof o.clientRefId === 'string' ? o.clientRefId : undefined,
      studentId: typeof o.studentId === 'string' ? o.studentId : undefined,
      enrolledDate: typeof o.enrolledDate === 'string' ? o.enrolledDate : undefined,
      appliedDate: typeof o.appliedDate === 'string' ? o.appliedDate : undefined,
      outcomeDate: typeof o.outcomeDate === 'string' ? o.outcomeDate : undefined,
      feePaidDate: typeof o.feePaidDate === 'string' ? o.feePaidDate : undefined,
      statusUpdatedAt: typeof o.statusUpdatedAt === 'string' ? o.statusUpdatedAt
        : (o.feePaidDate as string) ?? (o.outcomeDate as string) ?? (o.appliedDate as string) ?? new Date().toISOString().slice(0, 10),
      notes: typeof o.notes === 'string' ? o.notes : undefined,
    };
  });
}

function normalizeVisaApplication(raw: unknown, includeHistory = true): VisaApplication | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const status = VISA_STAGE_STATUSES.includes(o.status as VisaStageStatus) ? (o.status as VisaStageStatus) : 'Preparing Documents';
  const checklist = (o.checklist ?? {}) as Record<string, unknown>;
  return {
    status,
    checklist: {
      noc: !!checklist.noc,
      medical: !!checklist.medical,
      financial: !!checklist.financial,
      policeReport: !!checklist.policeReport,
    },
    preparingDocsDate: typeof o.preparingDocsDate === 'string' ? o.preparingDocsDate : undefined,
    fileReadyDate: typeof o.fileReadyDate === 'string' ? o.fileReadyDate : undefined,
    appliedDate: typeof o.appliedDate === 'string' ? o.appliedDate : undefined,
    outcomeDate: typeof o.outcomeDate === 'string' ? o.outcomeDate : undefined,
    statusUpdatedAt: typeof o.statusUpdatedAt === 'string' ? o.statusUpdatedAt
      : (o.outcomeDate as string) ?? (o.appliedDate as string) ?? new Date().toISOString().slice(0, 10),
    customChecklist: Array.isArray(o.customChecklist)
      ? (o.customChecklist as Record<string, unknown>[]).map((c, i) => ({
          id: typeof c.id === 'string' ? c.id : `c${Date.now()}${i}`,
          label: typeof c.label === 'string' ? c.label : 'Document',
          done: !!c.done,
          addedBy: typeof c.addedBy === 'string' ? c.addedBy : 'Unknown',
        }))
      : [],
    history: includeHistory && Array.isArray(o.history)
      ? (o.history.map((entry) => normalizeVisaApplication(entry, false)).filter(Boolean) as VisaApplication[])
      : [],
    notes: typeof o.notes === 'string' ? o.notes : '',
    refundRequested: !!o.refundRequested,
    refundRequestedDate: typeof o.refundRequestedDate === 'string' ? o.refundRequestedDate : undefined,
    enrollmentCompleted: !!o.enrollmentCompleted,
    enrollmentCompletedDate: typeof o.enrollmentCompletedDate === 'string' ? o.enrollmentCompletedDate : undefined,
  };
}

function fromRow(row: ApplicationRow): ApplicationRecord {
  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    name: row.name,
    phone: row.phone,
    email: row.email,
    country: row.country,
    purpose: row.purpose,
    dob: row.dob ?? undefined,
    gender: row.gender ?? undefined,
    maritalStatus: row.marital_status ?? undefined,
    academicQualification: row.academic_qualification ?? undefined,
    ieltsPte: row.ielts_pte ?? undefined,
    workExperience: row.work_experience ?? undefined,
    counselor: row.counselor,
    consultationDate: row.consultation_date,
    addedBy: row.added_by ?? undefined,
    platformSource: row.platform_source ?? undefined,
    visitDateTime: row.visit_date_time ?? undefined,
    consultationNotes: row.consultation_notes,
    branch: row.branch,
    offerApplications: normalizeOfferApplications(row.offer_applications),
    visaApplication: normalizeVisaApplication(row.visa_application),
    withdrawn: row.withdrawn ?? false,
    withdrawnDate: row.withdrawn_date ?? undefined,
    notes: normalizeNotes(row.notes),
  };
}

function toRow(a: ApplicationRecord): ApplicationRow {
  return {
    id: a.id,
    client_id: a.clientId ?? null,
    name: a.name,
    phone: a.phone,
    email: a.email,
    country: a.country,
    purpose: a.purpose,
    dob: a.dob ?? null,
    gender: a.gender ?? null,
    marital_status: a.maritalStatus ?? null,
    academic_qualification: a.academicQualification ?? null,
    ielts_pte: a.ieltsPte ?? null,
    work_experience: a.workExperience ?? null,
    counselor: a.counselor,
    consultation_date: a.consultationDate,
    added_by: a.addedBy ?? null,
    platform_source: a.platformSource ?? null,
    visit_date_time: a.visitDateTime ?? null,
    consultation_notes: a.consultationNotes,
    branch: a.branch,
    offer_applications: a.offerApplications,
    visa_application: a.visaApplication,
    withdrawn: a.withdrawn,
    withdrawn_date: a.withdrawnDate ?? null,
    notes: a.notes,
  };
}

function toRowUpdates(updates: Partial<ApplicationRecord>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.clientId !== undefined) row.client_id = updates.clientId;
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.phone !== undefined) row.phone = updates.phone;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.country !== undefined) row.country = updates.country;
  if (updates.purpose !== undefined) row.purpose = updates.purpose;
  if (updates.dob !== undefined) row.dob = updates.dob;
  if (updates.gender !== undefined) row.gender = updates.gender;
  if (updates.maritalStatus !== undefined) row.marital_status = updates.maritalStatus;
  if (updates.academicQualification !== undefined) row.academic_qualification = updates.academicQualification;
  if (updates.ieltsPte !== undefined) row.ielts_pte = updates.ieltsPte;
  if (updates.workExperience !== undefined) row.work_experience = updates.workExperience;
  if (updates.counselor !== undefined) row.counselor = updates.counselor;
  if (updates.consultationDate !== undefined) row.consultation_date = updates.consultationDate;
  if (updates.addedBy !== undefined) row.added_by = updates.addedBy;
  if (updates.platformSource !== undefined) row.platform_source = updates.platformSource;
  if (updates.visitDateTime !== undefined) row.visit_date_time = updates.visitDateTime;
  if (updates.consultationNotes !== undefined) row.consultation_notes = updates.consultationNotes;
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.offerApplications !== undefined) row.offer_applications = updates.offerApplications;
  if (updates.visaApplication !== undefined) row.visa_application = updates.visaApplication;
  if (updates.withdrawn !== undefined) row.withdrawn = updates.withdrawn;
  if (updates.withdrawnDate !== undefined) row.withdrawn_date = updates.withdrawnDate;
  if (updates.notes !== undefined) row.notes = updates.notes;
  return row;
}

export async function fetchApplications(): Promise<ApplicationRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('consultation_date', { ascending: false });
  if (error) throw error;
  return (data as ApplicationRow[]).map(fromRow);
}

export async function insertApplication(application: ApplicationRecord): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('applications').insert(toRow(application));
  if (error) throw error;
}

export async function updateApplication(id: string, updates: Partial<ApplicationRecord>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('applications').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}

export async function deleteApplication(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) throw error;
}
