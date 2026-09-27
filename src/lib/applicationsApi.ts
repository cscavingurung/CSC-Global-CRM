import { supabase } from './supabaseClient';
import { ApplicationRecord, ClientNote, EnrolmentChecklist, OfferApplication, OfferStatus, PreviousEnrolment, Role, VisaApplication, VisaStageStatus, CountryPipelineState } from '../types';
import { normalizeAcademics } from './academics';

export interface ApplicationRow {
  id: string;
  client_id: string | null;
  name: string;
  phone: string;
  email: string;
  address: string | null;
  country: string;
  purpose: string;
  dob: string | null;
  gender: string | null;
  marital_status: string | null;
  academics: unknown;
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
  previous_enrolments: unknown;
  enrolment_checklist: unknown;
  country_pipeline: unknown;
  processing_offer_id: string | null;
}

const OFFER_STATUSES: OfferStatus[] = ['Enrolled', 'Applied to Institution', 'Offer Received', 'Rejected', 'Fee Paid'];
const VISA_STAGE_STATUSES: VisaStageStatus[] = ['Preparing Documents', 'File Ready for Visa', 'Visa Applied', 'Visa Approved', 'Visa Refused'];
const ROLES: Role[] = ['super_admin', 'marketing', 'branch_manager', 'receptionist', 'counselor', 'application_officer'];

/** Country pipeline jsonb — kept only when it names a supported country. */
function normalizeCountryPipeline(raw: unknown): CountryPipelineState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Partial<CountryPipelineState>;
  if (!p.country || !['Australia', 'United Kingdom', 'New Zealand', 'USA'].includes(p.country)) return undefined;
  return { country: p.country, steps: p.steps ?? {}, checklists: p.checklists ?? {}, requiresPreCasInterview: p.requiresPreCasInterview, universityClientId: p.universityClientId, log: p.log ?? [] };
}

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
      country: typeof o.country === 'string' ? o.country : undefined,
      status,
      course: typeof o.course === 'string' ? o.course : undefined,
      intake: typeof o.intake === 'string' ? o.intake : undefined,
      clientRefId: typeof o.clientRefId === 'string' ? o.clientRefId : undefined,
      studentId: typeof o.studentId === 'string' ? o.studentId : undefined,
      enrolledDate: typeof o.enrolledDate === 'string' ? o.enrolledDate : undefined,
      enrolledBy: typeof o.enrolledBy === 'string' ? o.enrolledBy : undefined,
      appliedDate: typeof o.appliedDate === 'string' ? o.appliedDate : undefined,
      appliedBy: typeof o.appliedBy === 'string' ? o.appliedBy : undefined,
      outcomeDate: typeof o.outcomeDate === 'string' ? o.outcomeDate : undefined,
      outcomeBy: typeof o.outcomeBy === 'string' ? o.outcomeBy : undefined,
      feePaidDate: typeof o.feePaidDate === 'string' ? o.feePaidDate : undefined,
      feePaidBy: typeof o.feePaidBy === 'string' ? o.feePaidBy : undefined,
      statusUpdatedAt: typeof o.statusUpdatedAt === 'string' ? o.statusUpdatedAt
        : (o.feePaidDate as string) ?? (o.outcomeDate as string) ?? (o.appliedDate as string) ?? new Date().toISOString().slice(0, 10),
      statusUpdatedTime: typeof o.statusUpdatedTime === 'string' ? o.statusUpdatedTime : undefined,
      statusUpdatedBy: typeof o.statusUpdatedBy === 'string' ? o.statusUpdatedBy : undefined,
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
    // Keep every stored key (current and retired) as a boolean — the UI decides what to show.
    checklist: Object.fromEntries(Object.entries(checklist).map(([key, value]) => [key, !!value])),
    preparingDocsDate: typeof o.preparingDocsDate === 'string' ? o.preparingDocsDate : undefined,
    fileReadyDate: typeof o.fileReadyDate === 'string' ? o.fileReadyDate : undefined,
    appliedDate: typeof o.appliedDate === 'string' ? o.appliedDate : undefined,
    outcomeDate: typeof o.outcomeDate === 'string' ? o.outcomeDate : undefined,
    statusUpdatedAt: typeof o.statusUpdatedAt === 'string' ? o.statusUpdatedAt
      : (o.outcomeDate as string) ?? (o.appliedDate as string) ?? new Date().toISOString().slice(0, 10),
    statusUpdatedTime: typeof o.statusUpdatedTime === 'string' ? o.statusUpdatedTime : undefined,
    statusUpdatedBy: typeof o.statusUpdatedBy === 'string' ? o.statusUpdatedBy : undefined,
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
    refundFollowUpDate: typeof o.refundFollowUpDate === 'string' ? o.refundFollowUpDate : undefined,
    refundFollowUpNote: typeof o.refundFollowUpNote === 'string' ? o.refundFollowUpNote : undefined,
    refundFollowUpSetBy: typeof o.refundFollowUpSetBy === 'string' ? o.refundFollowUpSetBy : undefined,
    refundFollowUpDone: !!o.refundFollowUpDone,
    refundFollowUpDoneDate: typeof o.refundFollowUpDoneDate === 'string' ? o.refundFollowUpDoneDate : undefined,
    refundReceived: !!o.refundReceived,
    refundReceivedDate: typeof o.refundReceivedDate === 'string' ? o.refundReceivedDate : undefined,
    refundReceivedBy: typeof o.refundReceivedBy === 'string' ? o.refundReceivedBy : undefined,
    enrollmentCompleted: !!o.enrollmentCompleted,
    enrollmentCompletedDate: typeof o.enrollmentCompletedDate === 'string' ? o.enrollmentCompletedDate : undefined,
  };
}

export function fromRow(row: ApplicationRow): ApplicationRecord {
  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address ?? undefined,
    country: row.country,
    purpose: row.purpose,
    dob: row.dob ?? undefined,
    gender: row.gender ?? undefined,
    maritalStatus: row.marital_status ?? undefined,
    academics: normalizeAcademics(row.academics),
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
    previousEnrolments: normalizePreviousEnrolments(row.previous_enrolments),
    enrolmentChecklist: normalizeEnrolmentChecklist(row.enrolment_checklist),
    countryPipeline: normalizeCountryPipeline(row.country_pipeline),
    processingOfferId: row.processing_offer_id ?? undefined,
  };
}

function normalizeEnrolmentChecklist(raw: unknown): EnrolmentChecklist | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const marks: EnrolmentChecklist['marks'] = {};
  Object.entries((o.marks ?? {}) as Record<string, unknown>).forEach(([key, value]) => {
    const m = value as Record<string, unknown> | null;
    if (m && typeof m === 'object') {
      marks[key] = { by: typeof m.by === 'string' ? m.by : 'Unknown', date: typeof m.date === 'string' ? m.date : '' };
    }
  });
  const custom = Array.isArray(o.custom)
    ? (o.custom as Record<string, unknown>[]).map((c, i) => ({
        id: typeof c.id === 'string' ? c.id : `ec${i}`,
        label: typeof c.label === 'string' ? c.label : '',
        done: !!c.done,
        addedBy: typeof c.addedBy === 'string' ? c.addedBy : 'Unknown',
        doneBy: typeof c.doneBy === 'string' ? c.doneBy : undefined,
        doneDate: typeof c.doneDate === 'string' ? c.doneDate : undefined,
      }))
    : [];
  return { marks, custom };
}

function normalizePreviousEnrolments(raw: unknown): PreviousEnrolment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: Record<string, unknown>, i: number): PreviousEnrolment => ({
    id: typeof p.id === 'string' ? p.id : `pe${i}`,
    closeReason: typeof p.closeReason === 'string' ? p.closeReason : 'Closed',
    closedDate: typeof p.closedDate === 'string' ? p.closedDate : undefined,
    reEnrolledDate: typeof p.reEnrolledDate === 'string' ? p.reEnrolledDate : '',
    reEnrolledBy: typeof p.reEnrolledBy === 'string' ? p.reEnrolledBy : 'Unknown',
    offerApplications: normalizeOfferApplications(p.offerApplications),
    visaApplication: normalizeVisaApplication(p.visaApplication),
  }));
}

function toRow(a: ApplicationRecord): ApplicationRow {
  return {
    id: a.id,
    client_id: a.clientId ?? null,
    name: a.name,
    phone: a.phone,
    email: a.email,
    address: a.address ?? null,
    country: a.country,
    purpose: a.purpose,
    dob: a.dob ?? null,
    gender: a.gender ?? null,
    marital_status: a.maritalStatus ?? null,
    academics: a.academics ?? null,
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
    previous_enrolments: a.previousEnrolments ?? [],
    enrolment_checklist: a.enrolmentChecklist ?? null,
    country_pipeline: a.countryPipeline ?? null,
    processing_offer_id: a.processingOfferId ?? null,
  };
}

function toRowUpdates(updates: Partial<ApplicationRecord>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.clientId !== undefined) row.client_id = updates.clientId;
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.phone !== undefined) row.phone = updates.phone;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.address !== undefined) row.address = updates.address;
  if (updates.country !== undefined) row.country = updates.country;
  if (updates.purpose !== undefined) row.purpose = updates.purpose;
  if (updates.dob !== undefined) row.dob = updates.dob;
  if (updates.gender !== undefined) row.gender = updates.gender;
  if (updates.maritalStatus !== undefined) row.marital_status = updates.maritalStatus;
  if (updates.academics !== undefined) row.academics = updates.academics;
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
  if (updates.previousEnrolments !== undefined) row.previous_enrolments = updates.previousEnrolments;
  if (updates.enrolmentChecklist !== undefined) row.enrolment_checklist = updates.enrolmentChecklist;
  if (updates.countryPipeline !== undefined) row.country_pipeline = updates.countryPipeline;
  if (updates.processingOfferId !== undefined) row.processing_offer_id = updates.processingOfferId || null;
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
