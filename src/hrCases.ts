// Employee Onboarding & Offboarding — checklist templates, stage derivation and progress.
import {
  ApplicationRecord, BranchIssue, CaseTask, ClearanceDept, CounselorStudent, DailyTask, OffboardingCase, OffboardingStage,
  OnboardingCase, OnboardingStage, StaffRole,
} from './types';
import { isActive } from './branchIssues';

export const ONBOARDING_STAGES: OnboardingStage[] = ['Pre-Joining', 'First Day', 'First Week', 'First 30 Days', 'Complete'];
export const OFFBOARDING_STAGES: OffboardingStage[] = ['Notice', 'Handover', 'Access & Assets', 'Clearance', 'Exit Interview', 'Closed'];
export const CLEARANCE_DEPTS: ClearanceDept[] = ['HR', 'Branch Manager', 'IT', 'Finance'];
/** Roles a branch hires and offboards through this module. */
export const CASE_ROLES: StaffRole[] = ['Counselor', 'V/A Officer', 'Front Desk Officer'];

type TaskSeed = Omit<CaseTask, 'id' | 'doneBy' | 'doneAt'>;

const ONBOARDING_COMMON: TaskSeed[] = [
  { label: 'Offer letter signed and returned', owner: 'HR', stage: 'Pre-Joining', critical: true },
  { label: 'Collect ID, academic and experience documents', owner: 'HR', stage: 'Pre-Joining', critical: true },
  { label: 'Create CRM account', owner: 'IT', stage: 'Pre-Joining', critical: true },
  { label: 'Set up company email', owner: 'IT', stage: 'Pre-Joining', critical: true },
  { label: 'Assign desk and phone', owner: 'Branch Manager', stage: 'Pre-Joining', critical: true },
  { label: 'Hand over laptop', owner: 'IT', stage: 'First Day', critical: true },
  { label: 'Register biometric attendance', owner: 'HR', stage: 'First Day', critical: true },
  { label: 'Branch tour and team introductions', owner: 'Branch Manager', stage: 'First Day' },
  { label: 'Read company policy and code of conduct', owner: 'Employee', stage: 'First Day' },
  { label: 'Set CRM password and complete your profile', owner: 'Employee', stage: 'First Day' },
  { label: 'Complete CRM training', owner: 'Employee', stage: 'First Week' },
  { label: 'Probation goals agreed', owner: 'HR', stage: 'First 30 Days', critical: true },
  { label: '30-day check-in meeting', owner: 'Branch Manager', stage: 'First 30 Days', critical: true },
];

/** Loaded on top of the common checklist, by role. */
export const ROLE_TRAINING: Partial<Record<StaffRole, TaskSeed[]>> = {
  Counselor: [
    { label: 'CRM training: client intake, consultations and follow-ups', owner: 'Employee', stage: 'First Week', kind: 'training' },
    { label: 'Destination briefings — Australia, Canada, UK', owner: 'Branch Manager', stage: 'First Week', kind: 'training' },
    { label: 'Shadow a senior counselor for 3 consultations', owner: 'Employee', stage: 'First Week', kind: 'training' },
    { label: 'Handle first client consultation independently', owner: 'Employee', stage: 'First 30 Days', kind: 'training' },
  ],
  'V/A Officer': [
    { label: 'Visa procedures and document checklists by country', owner: 'Employee', stage: 'First Week', kind: 'training' },
    { label: 'Offer application workflow in the CRM', owner: 'Employee', stage: 'First Week', kind: 'training' },
    { label: 'Shadow a visa lodgement with the senior V/A Officer', owner: 'Branch Manager', stage: 'First Week', kind: 'training' },
    { label: 'Lodge first visa application with review', owner: 'Employee', stage: 'First 30 Days', kind: 'training' },
  ],
  'Front Desk Officer': [
    { label: 'Visitor and lead intake in the CRM', owner: 'Employee', stage: 'First Week', kind: 'training' },
    { label: 'Assign-counselor workflow', owner: 'Employee', stage: 'First Week', kind: 'training' },
    { label: 'Cash handling and receipt issuing', owner: 'Branch Manager', stage: 'First Week', kind: 'training' },
    { label: 'Run opening and closing checklists', owner: 'Employee', stage: 'First 30 Days', kind: 'training' },
  ],
};

const OFFBOARDING_COMMON: TaskSeed[] = [
  { label: 'Resignation letter received and acknowledged', owner: 'HR', stage: 'Notice' },
  { label: 'Last working day confirmed with the employee', owner: 'HR', stage: 'Notice' },
  { label: 'Handover meeting held', owner: 'Branch Manager', stage: 'Handover' },
  { label: 'Laptop and charger returned', owner: 'IT', stage: 'Access & Assets', kind: 'asset' },
  { label: 'Office keys and access card returned', owner: 'Branch Manager', stage: 'Access & Assets', kind: 'asset' },
  { label: 'Staff ID card returned', owner: 'HR', stage: 'Access & Assets', kind: 'asset' },
  { label: 'Company email access revoked', owner: 'IT', stage: 'Access & Assets', kind: 'access' },
  { label: 'Shared drives and group chats removed', owner: 'IT', stage: 'Access & Assets', kind: 'access' },
  { label: 'Biometric attendance removed', owner: 'HR', stage: 'Access & Assets', kind: 'access' },
];

const OFFBOARDING_ROLE_ASSETS: Partial<Record<StaffRole, TaskSeed[]>> = {
  'Front Desk Officer': [{ label: 'Cash float and receipt book handed over', owner: 'Finance', stage: 'Access & Assets', kind: 'asset' }],
  'V/A Officer': [{ label: 'Visa portal (ImmiAccount / UKVI) logins transferred', owner: 'IT', stage: 'Access & Assets', kind: 'access' }],
  Counselor: [{ label: 'Client WhatsApp / phone number handed over', owner: 'Branch Manager', stage: 'Access & Assets', kind: 'asset' }],
};

const withIds = (prefix: string, seeds: TaskSeed[]): CaseTask[] => seeds.map((t, i) => ({ ...t, id: `${prefix}-${i}` }));

export const onboardingTasksFor = (role: StaffRole, prefix: string) =>
  withIds(prefix, [...ONBOARDING_COMMON, ...(ROLE_TRAINING[role] ?? [])]);

export const offboardingTasksFor = (role: StaffRole, prefix: string) =>
  withIds(prefix, [...OFFBOARDING_COMMON, ...(OFFBOARDING_ROLE_ASSETS[role] ?? [])]);

// ─── Onboarding ─────────────────────────────────────────────────────────────

export function onboardingStage(c: OnboardingCase): OnboardingStage {
  if (c.completedAt) return 'Complete';
  const open = ONBOARDING_STAGES.find((s) => c.tasks.some((t) => t.stage === s && !t.doneAt));
  return open ?? 'First 30 Days';
}

/** Days after the start date by which each stage's tasks should be done. */
export const STAGE_DUE_DAYS: Partial<Record<OnboardingStage, number>> = { 'Pre-Joining': 0, 'First Day': 0, 'First Week': 7, 'First 30 Days': 30 };

/** Open tasks whose stage deadline has passed. */
export function overdueOnboardingTasks(c: OnboardingCase, today: string): CaseTask[] {
  if (c.completedAt) return [];
  const start = new Date(`${c.startDate}T00:00:00`);
  return c.tasks.filter((t) => {
    if (t.doneAt) return false;
    const offset = STAGE_DUE_DAYS[t.stage as OnboardingStage];
    if (offset === undefined) return false;
    const due = new Date(start);
    due.setDate(due.getDate() + offset);
    const dueKey = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    return dueKey < today;
  });
}

export const criticalOpen = (c: OnboardingCase) => c.tasks.filter((t) => t.critical && t.owner !== 'Employee' && !t.doneAt);

export const onboardingProgress = (c: OnboardingCase) =>
  c.completedAt ? 100 : Math.round((c.tasks.filter((t) => t.doneAt).length / Math.max(1, c.tasks.length)) * 100);

// ─── Offboarding ────────────────────────────────────────────────────────────

/** `openWorkload` is live: leads, clients, tasks and issues still owned by the leaver. */
export function offboardingStage(c: OffboardingCase, openWorkload: number): OffboardingStage {
  if (c.finalizedAt) return 'Closed';
  const undone = (stage: OffboardingStage) => c.tasks.some((t) => t.stage === stage && !t.doneAt);
  if (undone('Notice')) return 'Notice';
  if (openWorkload > 0 || undone('Handover')) return 'Handover';
  if (undone('Access & Assets')) return 'Access & Assets';
  if (CLEARANCE_DEPTS.some((d) => !c.clearance[d])) return 'Clearance';
  return 'Exit Interview';
}

export function offboardingProgress(c: OffboardingCase, openWorkload: number): number {
  if (c.finalizedAt) return 100;
  const steps = c.tasks.length + CLEARANCE_DEPTS.length + 2; // + handover cleared + exit interview
  const done =
    c.tasks.filter((t) => t.doneAt).length +
    CLEARANCE_DEPTS.filter((d) => c.clearance[d]).length +
    (openWorkload === 0 ? 1 : 0) +
    (c.exitInterview ? 1 : 0);
  return Math.round((done / steps) * 100);
}

/** Next case number for the year — ONB-2026-0024. */
export function nextCaseCode(prefix: 'ONB' | 'OFF', existing: string[], year: number): string {
  const n = Math.max(0, ...existing.filter((c) => c.startsWith(`${prefix}-${year}-`)).map((c) => Number(c.split('-')[2]) || 0)) + 1;
  return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
}

export const OWNER_STYLES: Record<string, string> = {
  HR: 'bg-violet-50 text-violet-700',
  IT: 'bg-sky-50 text-sky-700',
  'Branch Manager': 'bg-indigo-50 text-indigo-700',
  Finance: 'bg-teal-50 text-teal-700',
  Employee: 'bg-amber-50 text-amber-700',
};

// ─── Open workload (Handover Engine) ────────────────────────────────────────

export interface WorkloadSources {
  counselorStudents: CounselorStudent[];
  applications: ApplicationRecord[];
  tasks: DailyTask[];
  issues: BranchIssue[];
}

export interface Workload {
  leads: CounselorStudent[];
  clients: ApplicationRecord[];
  tasks: DailyTask[];
  issues: BranchIssue[];
}

export function workloadOf(name: string, src: WorkloadSources): Workload {
  return {
    leads: src.counselorStudents.filter((s) => s.assignedCounselor === name && s.consultationStatus !== 'Consultation Complete'),
    clients: src.applications.filter((a) => a.counselor === name && !a.withdrawn),
    tasks: src.tasks.filter((t) => t.assignee === name && t.status !== 'Done'),
    issues: src.issues.filter((i) => i.owner === name && isActive(i)),
  };
}

export const workloadTotal = (w: Workload) => w.leads.length + w.clients.length + w.tasks.length + w.issues.length;
