// HRM · Performance — role-specific numbers computed from CRM records (nothing typed in twice),
// and when a text review is due. There are deliberately no scores, weights or rankings.
import {
  ApplicationRecord, CommunicationEntry, CounselorStudent, DailyTask, IntakeStudent, OnboardingCase, PerformanceReview, ReviewAssessment, StaffRole,
} from './types';
import { parseSubmittedAt } from './dateTime';

export const ASSESSMENTS: ReviewAssessment[] = ['Exceeds Expectations', 'Meets Expectations', 'Needs Improvement'];

export const ASSESSMENT_STYLES: Record<ReviewAssessment, string> = {
  'Exceeds Expectations': 'bg-emerald-50 text-emerald-700',
  'Meets Expectations': 'bg-blue-50 text-blue-700',
  'Needs Improvement': 'bg-amber-50 text-amber-700',
};

/** Reviews happen every six months; new joiners get their first after 90 days. */
export const REVIEW_CYCLE_DAYS = 180;
export const FIRST_REVIEW_AFTER_DAYS = 90;

export interface CrmSources {
  counselorStudents: CounselorStudent[];
  students: IntakeStudent[];
  applications: ApplicationRecord[];
  communications: CommunicationEntry[];
  tasks: DailyTask[];
}

export interface Metric {
  label: string;
  value: string | number;
  /** Where the number comes from, shown on hover. */
  source: string;
  /** Needs a look (e.g. anything overdue). */
  warn?: boolean;
}

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000);

export function metricsFor(name: string, role: StaffRole, src: CrmSources, today: string): Metric[] {
  const contacts = src.communications.filter((c) => c.loggedBy === name);
  const openTasks = src.tasks.filter((t) => t.status !== 'Done' && t.date < today && (t.assignee === name || (!t.assignee && t.assignedRole === role)));

  if (role === 'Counselor') {
    const leads = src.counselorStudents.filter((s) => s.assignedCounselor === name);
    const apps = src.applications.filter((a) => a.counselor === name);
    const offers = apps.flatMap((a) => a.offerApplications).filter((o) => o.status === 'Offer Received' || o.status === 'Fee Paid');
    const overdue = leads.filter((s) => s.consultationStatus === 'Follow Up' && !!s.followUpDate && s.followUpDate < today);
    return [
      { label: 'Leads handled', value: leads.length, source: 'Leads assigned to this counselor' },
      { label: 'Consultations', value: leads.filter((s) => s.consultationStatus === 'Consultation Complete').length, source: 'Leads marked Consultation Complete' },
      { label: 'Applications', value: apps.length, source: 'Clients in the application pipeline with this counselor' },
      { label: 'Offers', value: offers.length, source: 'Offer letters received or fee paid, across their clients' },
      { label: 'Visa approvals', value: apps.filter((a) => a.visaApplication?.status === 'Visa Approved').length, source: 'Their clients with Visa Approved' },
      { label: 'Follow-ups completed', value: contacts.length, source: 'Client contacts they logged in the Communication Log' },
      { label: 'Overdue follow-ups', value: overdue.length, source: 'Follow-up date already passed', warn: overdue.length > 0 },
    ];
  }

  if (role === 'Front Desk Officer') {
    const registered = src.students.filter((s) => s.addedBy === name);
    const visits = registered.filter((s) => s.visitDateTime).reduce((n, s) => n + 1 + (s.visitHistory?.length ?? 0), 0);
    return [
      { label: 'Visitors handled', value: visits, source: 'Walk-in visits (and revisits) they registered' },
      { label: 'Leads registered', value: registered.length, source: 'Leads they added at the front desk' },
      { label: 'Appointments managed', value: src.counselorStudents.filter((s) => s.addedBy === name).length, source: 'Consultations they booked with a counselor' },
      { label: 'Calls / queries handled', value: contacts.length, source: 'Client contacts they logged in the Communication Log' },
      { label: 'Overdue tasks', value: openTasks.length, source: 'Their Daily Task Board tasks past due and not done', warn: openTasks.length > 0 },
    ];
  }

  if (role === 'V/A Officer') {
    const offers = src.applications.flatMap((a) => a.offerApplications);
    const lodged = offers.filter((o) => o.appliedBy === name).length + src.applications.filter((a) => a.visaApplication?.statusUpdatedBy === name).length;
    const decided = offers.filter((o) => o.outcomeBy === name).length
      + src.applications.filter((a) => a.visaApplication?.statusUpdatedBy === name && (a.visaApplication.status === 'Visa Approved' || a.visaApplication.status === 'Visa Refused')).length;
    const pending = src.applications.filter((a) => !a.withdrawn && a.visaApplication?.status !== 'Visa Approved' && a.visaApplication?.status !== 'Visa Refused').length;
    const timed = offers.filter((o) => o.appliedBy === name && o.appliedDate && o.outcomeDate);
    const avg = timed.length ? Math.round(timed.reduce((n, o) => n + daysBetween(o.appliedDate!.slice(0, 10), o.outcomeDate!.slice(0, 10)), 0) / timed.length) : null;
    return [
      { label: 'Applications processed', value: lodged, source: 'Offer applications they submitted plus visa files they updated' },
      { label: 'Cases completed', value: decided, source: 'Offer outcomes and visa decisions they recorded' },
      { label: 'Pending cases', value: pending, source: 'Branch clients still in the offer or visa pipeline' },
      { label: 'Overdue tasks', value: openTasks.length, source: 'Their Daily Task Board tasks past due and not done', warn: openTasks.length > 0 },
      { label: 'Processing time', value: avg === null ? '—' : `${avg} day${avg === 1 ? '' : 's'}`, source: 'Average days from applying to an institution to its decision' },
    ];
  }
  return [];
}

export type ReviewStatus = 'Due' | 'Up to Date';

/** Review due-ness, from the last review (or start date for new joiners). */
export function reviewStatus(name: string, reviews: PerformanceReview[], onboarding: OnboardingCase[], today: string) {
  const mine = reviews.filter((r) => r.staffName === name).sort((a, b) => (parseSubmittedAt(b.reviewedAt)?.getTime() ?? 0) - (parseSubmittedAt(a.reviewedAt)?.getTime() ?? 0));
  const last = mine[0];
  const started = onboarding.find((c) => c.employeeName === name)?.startDate;
  if (last) {
    const age = daysBetween(last.reviewedAt.slice(0, 10), today);
    return { status: (age > REVIEW_CYCLE_DAYS ? 'Due' : 'Up to Date') as ReviewStatus, last, note: age > REVIEW_CYCLE_DAYS ? `Last reviewed ${Math.round(age / 30)} months ago` : `Next review in ${REVIEW_CYCLE_DAYS - age} days` };
  }
  if (started && daysBetween(started, today) < FIRST_REVIEW_AFTER_DAYS) {
    return { status: 'Up to Date' as ReviewStatus, last, note: `New joiner — first review in ${FIRST_REVIEW_AFTER_DAYS - daysBetween(started, today)} days` };
  }
  return { status: 'Due' as ReviewStatus, last, note: 'No review on record' };
}

/** Plain, visible reasons an employee needs a manager's attention — no hidden scoring. */
export function attentionReasons(metrics: Metric[], last?: PerformanceReview): string[] {
  const out: string[] = [];
  if (last?.assessment === 'Needs Improvement') out.push('Last review: Needs Improvement');
  metrics.filter((m) => m.warn && typeof m.value === 'number' && m.value >= 2).forEach((m) => out.push(`${m.value} ${m.label.toLowerCase()}`));
  return out;
}

/** "Jan – Jun 2026" / "Jul – Dec 2026" for the half-year containing `date`. */
export function halfYearLabel(date: Date): string {
  return date.getMonth() < 6 ? `Jan – Jun ${date.getFullYear()}` : `Jul – Dec ${date.getFullYear()}`;
}
