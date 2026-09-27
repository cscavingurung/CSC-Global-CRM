// Branch Manager Workspace — pure logic behind the Marketing, Client Transfers and Operations
// tabs. Everything here works on data App.tsx has already scoped to the manager's branch, except
// `transferCandidates()`, which searches other branches and returns only an identity projection.
import {
  ApplicationRecord, BranchContentType, ContentRequest, BranchRequestStatus, CounselorStudent, DailyTask, FinTransaction,
  IntakeStudent, ItTicketCategory, ItTicketPriority, ItTicketStatus, MarketingSupportKind, MarketingSupportStatus,
  StaffMember, TaskCategory, TaskPriority, TaskStatus, TransferStatus,
} from './types';
import { dateKey } from './dateTime';
import { isLivePayment } from './finance';

// ── Date range presets (shared by every filter bar) ─────────────────────────
export type RangePreset = 'All Time' | 'Today' | 'This Week' | 'This Month' | 'Custom';
export const RANGE_PRESETS: RangePreset[] = ['All Time', 'Today', 'This Week', 'This Month', 'Custom'];

export interface DateRange {
  preset: RangePreset;
  /** Custom range only, YYYY-MM-DD. */
  from: string;
  to: string;
}
export const ALL_TIME: DateRange = { preset: 'All Time', from: '', to: '' };

/** Inclusive [from, to] day keys for a range; '' means open-ended. Weeks start on Sunday. */
export function rangeBounds(range: DateRange, now = new Date()): { from: string; to: string } {
  const today = dateKey(now);
  if (range.preset === 'Today') return { from: today, to: today };
  if (range.preset === 'This Week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { from: dateKey(start), to: today };
  }
  if (range.preset === 'This Month') return { from: `${today.slice(0, 8)}01`, to: today };
  if (range.preset === 'Custom') return { from: range.from, to: range.to };
  return { from: '', to: '' };
}

/** Does a "YYYY-MM-DD…" value fall inside the range? */
export function inRange(value: string | undefined | null, range: DateRange, now = new Date()): boolean {
  const { from, to } = rangeBounds(range, now);
  if (!from && !to) return true;
  if (!value) return false;
  const d = value.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}

export const daysBetweenKeys = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000);

export const dayLabel = (key?: string) =>
  key ? new Date(`${key.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ── Marketing summary ───────────────────────────────────────────────────────
export type LeadSource = 'Facebook' | 'Instagram' | 'TikTok' | 'Walk-in' | 'Referral' | 'Website' | 'Other';
export const LEAD_SOURCES: LeadSource[] = ['Facebook', 'Instagram', 'TikTok', 'Walk-in', 'Referral', 'Website', 'Other'];

/** Received through Marketing — a campaign lead Marketing assigned or broadcast to the branch. */
export const isMarketingClient = (s: IntakeStudent) => s.referredThrough === 'Marketing' || Boolean(s.platformSource);

/** Channel filter: Marketing-generated clients vs. those who reached the branch themselves. */
export type LeadChannelGroup = 'Marketing' | 'Walk-in & Referral';
export const CHANNEL_GROUPS: LeadChannelGroup[] = ['Marketing', 'Walk-in & Referral'];
export const MARKETING_SOURCES: LeadSource[] = ['Facebook', 'Instagram', 'TikTok', 'Website', 'Other'];

/** One source per branch lead: the marketing platform, or how the client reached the branch. */
export function leadSourceOf(s: IntakeStudent): LeadSource {
  if (isMarketingClient(s)) {
    const p = (s.platformSource ?? '').toLowerCase();
    if (p === 'facebook') return 'Facebook';
    if (p === 'instagram') return 'Instagram';
    if (p === 'tiktok') return 'TikTok';
    if (p === 'website') return 'Website';
    return 'Other';
  }
  if (!s.referredThrough || /walk/i.test(s.referredThrough)) return 'Walk-in';
  return 'Referral';
}

/** Funnel stages, in order. Each lead is counted in every stage it has reached. */
export const FUNNEL_STAGES = ['Assigned', 'Contacted', 'Consultation', 'Client', 'Application', 'Visa'] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];
export const FUNNEL_HINTS: Record<FunnelStage, string> = {
  Assigned: 'Given to a counselor',
  Contacted: 'Counselor picked the lead up',
  Consultation: 'Consultation started',
  Client: 'Decided to proceed',
  Application: 'Offer or visa file lodged',
  Visa: 'Visa approved',
};

export interface BranchLead {
  id: string;
  name: string;
  /** Portal Client ID, once a counselor has the client. */
  clientId?: string;
  country: string;
  channel: LeadChannelGroup;
  source: LeadSource;
  counselor: string | null;
  receivedAt: string;
  /** Index into FUNNEL_STAGES of the furthest stage reached; -1 = still unassigned. */
  reached: number;
  revenue: number;
}

export function branchLeads(
  intakes: IntakeStudent[], consultations: CounselorStudent[], applications: ApplicationRecord[], transactions: FinTransaction[],
): BranchLead[] {
  return intakes.map((s) => {
    const cs = consultations.find((c) => c.id === s.id);
    const app = cs?.clientId ? applications.find((a) => a.clientId === cs.clientId) : undefined;
    const counselor = cs?.assignedCounselor ?? s.assignedCounselor;
    let reached = counselor ? 0 : -1;
    if (cs) reached = 1;
    if (cs && cs.consultationStatus !== 'Awaiting Consultation') reached = 2;
    if (cs?.outcome === 'Proceeding' || app) reached = 3;
    if (app && (app.offerApplications.some((o) => o.appliedDate || o.status !== 'Enrolled') || app.visaApplication?.status === 'Visa Applied'
      || app.visaApplication?.status === 'Visa Approved' || app.visaApplication?.status === 'Visa Refused')) reached = 4;
    if (app?.visaApplication?.status === 'Visa Approved') reached = 5;
    const clientId = cs?.clientId;
    const revenue = clientId
      ? transactions.filter((t) => t.clientId === clientId && isLivePayment(t)).reduce((sum, t) => sum + t.amount, 0)
      : 0;
    return {
      id: s.id, name: s.name, clientId, country: s.country, channel: isMarketingClient(s) ? 'Marketing' : 'Walk-in & Referral',
      source: leadSourceOf(s), counselor, receivedAt: s.submittedAt, reached, revenue,
    };
  });
}

/** Furthest stage a lead has reached, as a label. */
export const stageLabel = (reached: number) => (reached < 0 ? 'Unassigned' : FUNNEL_STAGES[reached]);
export const STAGE_LABELS = ['Unassigned', ...FUNNEL_STAGES];
export const STAGE_STYLES: Record<string, string> = {
  Unassigned: 'bg-slate-100 text-slate-700',
  Assigned: 'bg-sky-100 text-sky-800',
  Contacted: 'bg-sky-100 text-sky-800',
  Consultation: 'bg-amber-100 text-amber-800',
  Client: 'bg-violet-100 text-violet-800',
  Application: 'bg-indigo-100 text-indigo-800',
  Visa: 'bg-emerald-100 text-emerald-800',
};

export interface MarketingSummary {
  total: number;
  contactRate: number;
  conversionRate: number;
  applications: number;
  revenue: number;
  funnel: { stage: FunnelStage; count: number }[];
}

export const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

export function summarise(leads: BranchLead[]): MarketingSummary {
  const at = (i: number) => leads.filter((l) => l.reached >= i).length;
  return {
    total: leads.length,
    contactRate: pct(at(1), leads.length),
    conversionRate: pct(at(3), leads.length),
    applications: at(4),
    revenue: leads.reduce((s, l) => s + l.revenue, 0),
    funnel: FUNNEL_STAGES.map((stage, i) => ({ stage, count: at(i) })),
  };
}

// ── Outbound requests to central Marketing ──────────────────────────────────
export const CONTENT_TYPES: BranchContentType[] = ['Flyer', 'Poster', 'Social Reel', 'Event Banner'];
export const REQUEST_STATUSES: BranchRequestStatus[] = ['Requested', 'In Production', 'Review', 'Delivered'];
export const REQUEST_STYLES: Record<BranchRequestStatus, string> = {
  Requested: 'bg-sky-100 text-sky-800',
  'In Production': 'bg-amber-100 text-amber-800',
  Review: 'bg-violet-100 text-violet-800',
  Delivered: 'bg-emerald-100 text-emerald-800',
};
export const SUPPORT_KINDS: MarketingSupportKind[] = ['Local Ad Boost', 'Event Sponsorship', 'Regional Campaign Drive'];
export const SUPPORT_STATUSES: MarketingSupportStatus[] = ['Submitted', 'Under Review', 'Approved', 'Declined'];
export const SUPPORT_STYLES: Record<MarketingSupportStatus, string> = {
  Submitted: 'bg-sky-100 text-sky-800',
  'Under Review': 'bg-amber-100 text-amber-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Declined: 'bg-red-100 text-red-800',
};
export const INTAKES = ['Jan 2027', 'Feb 2027', 'May 2027', 'Jul 2027', 'Sep 2027'];
export const TARGET_COUNTRIES = ['Australia', 'Canada', 'United Kingdom', 'USA', 'New Zealand', 'Europe', 'Multiple'];

// ── Inbound directives (Marketing → branch) ─────────────────────────────────
export type DirectiveState = 'Awaiting Delegation' | 'Delegated' | 'Submitted';
export const DIRECTIVE_STATES: DirectiveState[] = ['Awaiting Delegation', 'Delegated', 'Submitted'];
export const DIRECTIVE_STYLES: Record<DirectiveState, string> = {
  'Awaiting Delegation': 'bg-amber-100 text-amber-800',
  Delegated: 'bg-sky-100 text-sky-800',
  Submitted: 'bg-emerald-100 text-emerald-800',
};
export const directiveState = (r: ContentRequest): DirectiveState =>
  r.status !== 'Waiting' ? 'Submitted' : r.delegatedBy ? 'Delegated' : 'Awaiting Delegation';

// ── Transfers ───────────────────────────────────────────────────────────────
export const TRANSFER_STYLES: Record<TransferStatus, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
};

/** A registered client, as another branch may see them when searching for a transfer. */
export interface TransferCandidate {
  clientKey: string;
  clientId: string;
  name: string;
  branch: string;
  counselor: string;
  /** Last 3 digits only — enough to confirm identity at the desk. */
  phoneHint: string;
  country: string;
}

/** Registered clients of every branch except `exclude`. Identity fields only — no notes,
 * documents, finance or pipeline detail cross the branch boundary. */
export function transferCandidates(
  consultations: CounselorStudent[], intakes: IntakeStudent[], staff: StaffMember[], exclude: string,
): TransferCandidate[] {
  return consultations.flatMap((c) => {
    const branch = branchOfClient(c, intakes, staff);
    if (!branch || branch === exclude) return [];
    return [{
      clientKey: c.id, clientId: c.clientId ?? '—', name: c.name, branch, counselor: c.assignedCounselor,
      phoneHint: c.phone ? `•••${c.phone.replace(/\D/g, '').slice(-3)}` : '—', country: c.country,
    }];
  });
}

/** A counselor record's branch: its intake row, else its counselor's branch. */
export function branchOfClient(c: CounselorStudent, intakes: IntakeStudent[], staff: StaffMember[]): string {
  return intakes.find((s) => s.id === c.id)?.branch || staff.find((s) => s.name === c.assignedCounselor)?.branch || '';
}

export function nextCode(prefix: string, existing: string[]): string {
  const year = new Date().getFullYear();
  const max = existing.reduce((m, c) => Math.max(m, Number(c.split('-').pop()) || 0), 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

// ── Task oversight ──────────────────────────────────────────────────────────
export const TASK_CATEGORIES: TaskCategory[] = ['Client Follow-up', 'Documentation', 'Front Desk', 'Marketing', 'Admin'];
const ROLE_CATEGORY: Record<string, TaskCategory> = {
  Counselor: 'Client Follow-up', 'V/A Officer': 'Documentation', 'Front Desk Officer': 'Front Desk',
};
export const taskCategory = (t: DailyTask): TaskCategory => t.category ?? ROLE_CATEGORY[t.assignedRole] ?? 'Admin';
export const taskOwner = (t: DailyTask) => t.assignee ?? (t.assignedRole === 'Anyone' ? 'Anyone in branch' : `Any ${t.assignedRole}`);

/** Days a task is past its date (0 when not overdue or done). */
export function overdueDays(t: DailyTask, today = dateKey(new Date())): number {
  if (t.status === 'Done' || t.date >= today) return 0;
  return daysBetweenKeys(t.date, today);
}

export const PRIORITY_STYLES: Record<TaskPriority | ItTicketPriority, string> = {
  High: 'bg-red-100 text-red-800',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-slate-100 text-slate-700',
};
export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  'To Do': 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-sky-100 text-sky-800',
  Done: 'bg-emerald-100 text-emerald-800',
};

// ── IT support ──────────────────────────────────────────────────────────────
export const IT_CATEGORIES: ItTicketCategory[] = ['Hardware', 'CRM Issue', 'Software Access', 'Network/VoIP'];
export const IT_PRIORITIES: ItTicketPriority[] = ['High', 'Medium', 'Low'];
export const IT_STATUSES: ItTicketStatus[] = ['Open', 'In Progress', 'Resolved'];
export const IT_STATUS_STYLES: Record<ItTicketStatus, string> = {
  Open: 'bg-amber-100 text-amber-800',
  'In Progress': 'bg-sky-100 text-sky-800',
  Resolved: 'bg-emerald-100 text-emerald-800',
};
