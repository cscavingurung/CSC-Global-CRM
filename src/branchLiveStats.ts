import { StaffMember, IntakeStudent, ApplicationRecord, CounselorStudent } from './types';
import { parseSubmittedAt } from './dateTime';
import { isClientInProgress, isVisaApproved, isVisaRefused } from './clientPipeline';

export interface BranchLiveStats {
  staffCount: number;
  activeStudents: number;
  applicationsInProgress: number;
  visasGranted: number;
  visasRefused: number;
}

// Computes a branch's numbers live from the real students/staff/applications data, matched
// by branch name, instead of relying on stored counts — always accurate, no sync required.
export function computeBranchLiveStats(
  branchName: string,
  staff: StaffMember[],
  students: IntakeStudent[],
  applications: ApplicationRecord[]
): BranchLiveStats {
  const branchApplications = applications.filter((a) => a.branch === branchName);
  return {
    staffCount: staff.filter((s) => s.branch === branchName).length,
    activeStudents: students.filter((s) => s.branch === branchName).length,
    applicationsInProgress: branchApplications.filter(isClientInProgress).length,
    visasGranted: branchApplications.filter(isVisaApproved).length,
    visasRefused: branchApplications.filter(isVisaRefused).length,
  };
}

export interface BranchOverviewStats {
  totalStudentsThisMonth: number;
  activeConsultations: number;
  applicationsInProgress: number;
  decidedGranted: number;
  decidedRefused: number;
}

// Live version of the Branch Manager Overview's four stat cards — replaces the seeded,
// never-updated `branch_stats` table. counselor_students rows carry no branch of their
// own, so "Active Consultations" is scoped by looking up the assigned counselor's branch
// via their staff record (matched by name).
export function computeBranchOverviewStats(
  branchName: string,
  students: IntakeStudent[],
  counselorStudents: CounselorStudent[],
  applications: ApplicationRecord[],
  staff: StaffMember[]
): BranchOverviewStats {
  const now = new Date();
  const totalStudentsThisMonth = students.filter((s) => {
    if (s.branch !== branchName) return false;
    const submitted = parseSubmittedAt(s.submittedAt);
    return !!submitted && submitted.getFullYear() === now.getFullYear() && submitted.getMonth() === now.getMonth();
  }).length;

  const counselorBranchByName = new Map(staff.filter((s) => s.role === 'Counselor').map((s) => [s.name, s.branch]));
  const activeConsultations = counselorStudents.filter(
    (cs) => cs.consultationStatus !== 'Consultation Complete' && counselorBranchByName.get(cs.assignedCounselor) === branchName
  ).length;

  const branchApplications = applications.filter((a) => a.branch === branchName);
  return {
    totalStudentsThisMonth,
    activeConsultations,
    applicationsInProgress: branchApplications.filter(isClientInProgress).length,
    decidedGranted: branchApplications.filter(isVisaApproved).length,
    decidedRefused: branchApplications.filter(isVisaRefused).length,
  };
}

// Company-wide version of computeBranchOverviewStats, for the Super Admin Overview's four
// stat cards — replaces the seeded, never-updated `branch_stats` aggregate. No branch
// filtering needed (unlike the per-branch version) since every real row already belongs to
// some real branch under real login, so summing across everything is the company total.
export function computeCompanyOverviewStats(
  students: IntakeStudent[],
  counselorStudents: CounselorStudent[],
  applications: ApplicationRecord[]
): BranchOverviewStats {
  const now = new Date();
  const totalStudentsThisMonth = students.filter((s) => {
    const submitted = parseSubmittedAt(s.submittedAt);
    return !!submitted && submitted.getFullYear() === now.getFullYear() && submitted.getMonth() === now.getMonth();
  }).length;

  const activeConsultations = counselorStudents.filter((cs) => cs.consultationStatus !== 'Consultation Complete').length;

  return {
    totalStudentsThisMonth,
    activeConsultations,
    applicationsInProgress: applications.filter(isClientInProgress).length,
    decidedGranted: applications.filter(isVisaApproved).length,
    decidedRefused: applications.filter(isVisaRefused).length,
  };
}
