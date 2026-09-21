import { supabase } from './supabaseClient';
import { CounselorStudent } from '../types';

interface CounselorStudentRow {
  id: string;
  client_id: string | null;
  enrolments: unknown;
  name: string;
  phone: string;
  email: string;
  country: string;
  purpose: string;
  dob: string;
  gender: string;
  marital_status: string;
  academic_qualification: string;
  ielts_pte: string;
  work_experience: string;
  submitted_at: string;
  added_by: string | null;
  visit_date_time: string | null;
  referred_through: string | null;
  platform_source: string | null;
  revisited_at: string | null;
  assigned_date: string;
  assigned_counselor: string;
  consultation_status: CounselorStudent['consultationStatus'];
  consultation_notes: string;
  follow_up_date: string | null;
  completed_date: string | null;
  outcome: CounselorStudent['outcome'];
  lead_temperature?: CounselorStudent['leadTemperature'] | null;
  follow_up_note: string | null;
}

function normalizeEnrolments(raw: unknown): CounselorStudent['enrolments'] {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((e: Record<string, unknown>) => ({
    institution: typeof e.institution === 'string' ? e.institution : '',
    program: typeof e.program === 'string' ? e.program : '',
    intake: typeof e.intake === 'string' ? e.intake : '',
  }));
}

function fromRow(row: CounselorStudentRow): CounselorStudent {
  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    enrolments: normalizeEnrolments(row.enrolments),
    name: row.name,
    phone: row.phone,
    email: row.email,
    country: row.country,
    purpose: row.purpose,
    dob: row.dob,
    gender: row.gender,
    maritalStatus: row.marital_status,
    academicQualification: row.academic_qualification,
    ieltsPte: row.ielts_pte,
    workExperience: row.work_experience,
    submittedAt: row.submitted_at,
    addedBy: row.added_by ?? undefined,
    visitDateTime: row.visit_date_time ?? undefined,
    referredThrough: row.referred_through ?? undefined,
    platformSource: row.platform_source ?? undefined,
    revisitedAt: row.revisited_at ?? undefined,
    assignedDate: row.assigned_date,
    assignedCounselor: row.assigned_counselor,
    consultationStatus: row.consultation_status,
    consultationNotes: row.consultation_notes,
    followUpDate: row.follow_up_date,
    completedDate: row.completed_date,
    outcome: row.outcome,
    leadTemperature: row.lead_temperature ?? undefined,
    followUpNote: row.follow_up_note ?? undefined,
  };
}

function toRowUpdates(updates: Partial<CounselorStudent>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.clientId !== undefined) row.client_id = updates.clientId;
  if (updates.enrolments !== undefined) row.enrolments = updates.enrolments;
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
  if (updates.submittedAt !== undefined) row.submitted_at = updates.submittedAt;
  if (updates.addedBy !== undefined) row.added_by = updates.addedBy;
  if (updates.visitDateTime !== undefined) row.visit_date_time = updates.visitDateTime;
  if (updates.referredThrough !== undefined) row.referred_through = updates.referredThrough;
  if (updates.platformSource !== undefined) row.platform_source = updates.platformSource;
  if (updates.revisitedAt !== undefined) row.revisited_at = updates.revisitedAt;
  if (updates.assignedDate !== undefined) row.assigned_date = updates.assignedDate;
  if (updates.assignedCounselor !== undefined) row.assigned_counselor = updates.assignedCounselor;
  if (updates.consultationStatus !== undefined) row.consultation_status = updates.consultationStatus;
  if (updates.consultationNotes !== undefined) row.consultation_notes = updates.consultationNotes;
  if (updates.followUpDate !== undefined) row.follow_up_date = updates.followUpDate;
  if (updates.completedDate !== undefined) row.completed_date = updates.completedDate;
  if (updates.outcome !== undefined) row.outcome = updates.outcome;
  if (updates.leadTemperature !== undefined) row.lead_temperature = updates.leadTemperature;
  if (updates.followUpNote !== undefined) row.follow_up_note = updates.followUpNote;
  return row;
}

function toRow(cs: CounselorStudent): CounselorStudentRow {
  return {
    id: cs.id,
    client_id: cs.clientId ?? null,
    enrolments: cs.enrolments ?? null,
    name: cs.name,
    phone: cs.phone,
    email: cs.email,
    country: cs.country,
    purpose: cs.purpose,
    dob: cs.dob,
    gender: cs.gender,
    marital_status: cs.maritalStatus,
    academic_qualification: cs.academicQualification,
    ielts_pte: cs.ieltsPte,
    work_experience: cs.workExperience,
    submitted_at: cs.submittedAt,
    added_by: cs.addedBy ?? null,
    visit_date_time: cs.visitDateTime ?? null,
    referred_through: cs.referredThrough ?? null,
    platform_source: cs.platformSource ?? null,
    revisited_at: cs.revisitedAt ?? null,
    assigned_date: cs.assignedDate,
    assigned_counselor: cs.assignedCounselor,
    consultation_status: cs.consultationStatus,
    consultation_notes: cs.consultationNotes,
    follow_up_date: cs.followUpDate,
    completed_date: cs.completedDate,
    outcome: cs.outcome,
    lead_temperature: cs.leadTemperature ?? null,
    follow_up_note: cs.followUpNote ?? null,
  };
}

export async function upsertCounselorStudent(counselorStudent: CounselorStudent): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('counselor_students')
    .upsert(toRow(counselorStudent), { onConflict: 'id' });
  if (error) throw error;
}

export async function fetchCounselorStudents(): Promise<CounselorStudent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('counselor_students')
    .select('*')
    .order('assigned_date', { ascending: true });
  if (error) throw error;
  return (data as CounselorStudentRow[]).map(fromRow);
}

export async function updateCounselorStudent(id: string, updates: Partial<CounselorStudent>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('counselor_students').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}

export async function deleteCounselorStudent(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('counselor_students').delete().eq('id', id);
  if (error) throw error;
}
