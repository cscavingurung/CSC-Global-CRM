import { supabase } from './supabaseClient';
import { IntakeStudent } from '../types';
import { normalizeAcademics } from './academics';

export interface StudentRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  purpose: string;
  dob: string;
  gender: string;
  marital_status: string;
  academics: unknown;
  ielts_pte: string;
  work_experience: string;
  submitted_at: string;
  added_by: string | null;
  visit_date_time: string | null;
  referred_through: string | null;
  platform_source: string | null;
  broadcast_branch: string | null;
  broadcast_city: string | null;
  broadcast_at: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  revisited_at: string | null;
  visit_history: string[] | null;
  status: IntakeStudent['status'];
  assigned_counselor: string | null;
  branch: string;
}

export function fromRow(row: StudentRow): IntakeStudent {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    country: row.country,
    purpose: row.purpose,
    dob: row.dob,
    gender: row.gender,
    maritalStatus: row.marital_status,
    academics: normalizeAcademics(row.academics),
    ieltsPte: row.ielts_pte,
    workExperience: row.work_experience,
    submittedAt: row.submitted_at,
    addedBy: row.added_by ?? undefined,
    visitDateTime: row.visit_date_time ?? undefined,
    referredThrough: row.referred_through ?? undefined,
    platformSource: row.platform_source ?? undefined,
    broadcastBranch: row.broadcast_branch,
    broadcastCity: row.broadcast_city,
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
    address: student.address,
    country: student.country,
    purpose: student.purpose,
    dob: student.dob,
    gender: student.gender,
    marital_status: student.maritalStatus,
    academics: student.academics,
    ielts_pte: student.ieltsPte,
    work_experience: student.workExperience,
    submitted_at: student.submittedAt,
    added_by: student.addedBy ?? null,
    visit_date_time: student.visitDateTime ?? null,
    referred_through: student.referredThrough ?? null,
    platform_source: student.platformSource ?? null,
    broadcast_branch: student.broadcastBranch ?? null,
    broadcast_city: student.broadcastCity ?? null,
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
  if (updates.address !== undefined) row.address = updates.address;
  if (updates.country !== undefined) row.country = updates.country;
  if (updates.purpose !== undefined) row.purpose = updates.purpose;
  if (updates.dob !== undefined) row.dob = updates.dob;
  if (updates.gender !== undefined) row.gender = updates.gender;
  if (updates.maritalStatus !== undefined) row.marital_status = updates.maritalStatus;
  if (updates.academics !== undefined) row.academics = updates.academics;
  if (updates.ieltsPte !== undefined) row.ielts_pte = updates.ieltsPte;
  if (updates.workExperience !== undefined) row.work_experience = updates.workExperience;
  if (updates.submittedAt !== undefined) row.submitted_at = updates.submittedAt;
  if (updates.addedBy !== undefined) row.added_by = updates.addedBy;
  if (updates.visitDateTime !== undefined) row.visit_date_time = updates.visitDateTime;
  if (updates.referredThrough !== undefined) row.referred_through = updates.referredThrough;
  if (updates.platformSource !== undefined) row.platform_source = updates.platformSource;
  if (updates.broadcastBranch !== undefined) row.broadcast_branch = updates.broadcastBranch;
  if (updates.broadcastCity !== undefined) row.broadcast_city = updates.broadcastCity;
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

/** Branches that already hold a client with this phone or email (see find_client_branches in
 * schema.sql). Returns null if the lookup fails, so callers can fall back to saving as usual. */
export async function findClientBranches(phone: string, email: string): Promise<string[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('find_client_branches', { p_phone: phone, p_email: email });
  if (error) {
    console.error('Failed to check other branches for this client', error);
    return null;
  }
  return (data as string[] | null) ?? [];
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

/**
 * First-accept-first-get: atomically claims a broadcast lead — `claimed_by is null` is checked
 * and set in the same UPDATE, so Postgres's row lock decides the race, not the client. Returns
 * the claimed row, or `null` when another counselor's claim landed first (0 rows matched).
 */
export async function claimStudent(
  id: string,
  claim: { claimedBy: string; claimedAt: string; branch: string; assignedCounselor: string },
): Promise<IntakeStudent | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('students')
    .update({
      claimed_by: claim.claimedBy,
      claimed_at: claim.claimedAt,
      branch: claim.branch,
      status: 'Assigned',
      assigned_counselor: claim.assignedCounselor,
    })
    .eq('id', id)
    .is('claimed_by', null)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as StudentRow) : null;
}

export async function deleteStudent(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
}
