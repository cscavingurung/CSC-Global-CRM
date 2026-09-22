import { supabase } from './supabaseClient';
import { IntakeStudent } from '../types';

interface StudentRow {
  id: string;
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
  broadcast_branch: string | null;
  broadcast_at: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  revisited_at: string | null;
  visit_history: string[] | null;
  status: IntakeStudent['status'];
  assigned_counselor: string | null;
  branch: string;
}

function fromRow(row: StudentRow): IntakeStudent {
  return {
    id: row.id,
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
    broadcastBranch: row.broadcast_branch,
    broadcastAt: row.broadcast_at ?? undefined,
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at ?? undefined,
    revisitedAt: row.revisited_at ?? undefined,
    visitHistory: row.visit_history ?? undefined,
    status: row.status,
    assignedCounselor: row.assigned_counselor,
    branch: row.branch,
  };
}

function toRow(student: IntakeStudent): StudentRow {
  return {
    id: student.id,
    name: student.name,
    phone: student.phone,
    email: student.email,
    country: student.country,
    purpose: student.purpose,
    dob: student.dob,
    gender: student.gender,
    marital_status: student.maritalStatus,
    academic_qualification: student.academicQualification,
    ielts_pte: student.ieltsPte,
    work_experience: student.workExperience,
    submitted_at: student.submittedAt,
    added_by: student.addedBy ?? null,
    visit_date_time: student.visitDateTime ?? null,
    referred_through: student.referredThrough ?? null,
    platform_source: student.platformSource ?? null,
    broadcast_branch: student.broadcastBranch ?? null,
    broadcast_at: student.broadcastAt ?? null,
    claimed_by: student.claimedBy ?? null,
    claimed_at: student.claimedAt ?? null,
    revisited_at: student.revisitedAt ?? null,
    visit_history: student.visitHistory ?? null,
    status: student.status,
    assigned_counselor: student.assignedCounselor,
    branch: student.branch,
  };
}

function toRowUpdates(updates: Partial<IntakeStudent>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
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
  if (updates.broadcastBranch !== undefined) row.broadcast_branch = updates.broadcastBranch;
  if (updates.broadcastAt !== undefined) row.broadcast_at = updates.broadcastAt;
  if (updates.claimedBy !== undefined) row.claimed_by = updates.claimedBy;
  if (updates.claimedAt !== undefined) row.claimed_at = updates.claimedAt;
  if (updates.revisitedAt !== undefined) row.revisited_at = updates.revisitedAt;
  if (updates.visitHistory !== undefined) row.visit_history = updates.visitHistory;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.assignedCounselor !== undefined) row.assigned_counselor = updates.assignedCounselor;
  if (updates.branch !== undefined) row.branch = updates.branch;
  return row;
}

export async function fetchStudents(): Promise<IntakeStudent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data as StudentRow[]).map(fromRow);
}

export async function insertStudent(student: IntakeStudent): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('students').insert(toRow(student));
  if (error) throw error;
}

export async function updateStudent(id: string, updates: Partial<IntakeStudent>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('students').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}

export async function deleteStudent(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
}
