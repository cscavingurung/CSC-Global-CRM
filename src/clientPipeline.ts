import { AcademicEntry, ApplicationRecord, ChecklistKey, OfferApplication, OfferStatus, VisaApplication, VisaChecklist, VisaStageStatus, Role } from './types';

export type ClientStage = 'Offer' | 'Visa';

export type StatusTone = 'progress' | 'positive' | 'negative' | 'early' | 'withdrawn';

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Combines one Academic entry's 4 fields into one display string, e.g. "Bachelor's in Computer Science, GPA 3.6 (2024)". */
function formatAcademicEntry(entry: AcademicEntry): string {
  const levelAndStream = [entry.level, entry.stream].filter(Boolean).join(' in ');
  const gpa = entry.gpa ? `GPA ${entry.gpa}` : '';
  const year = entry.completionYear ? `(${entry.completionYear})` : '';
  return [levelAndStream, gpa, year].filter(Boolean).join(', ').replace(/, \(/, ' (');
}

/** Joins every academic qualification into one display string, semicolon-separated. */
export function formatAcademic(record: { academics?: AcademicEntry[] }): string {
  return (record.academics ?? []).map(formatAcademicEntry).filter(Boolean).join('; ');
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// The most recent offer attempt that hasn't been rejected — the one the officer is actively
// working. Falls back to the most recent attempt overall (which will be Rejected) so a fully
// rejected history still has something to point at.
export function getActiveOfferApplication(app: ApplicationRecord): OfferApplication | null {
  const attempts = app.offerApplications;
  if (attempts.length === 0) return null;
  const active = [...attempts].reverse().find((a) => a.status !== 'Rejected');
  return active ?? attempts[attempts.length - 1];
}

// Visa unlocks once the fee is paid on an offer — not merely on receiving the offer. SOWP
// and Visit cases have no offer stage at all, so their visa case opening unlocks it.
export function isVisaUnlocked(app: ApplicationRecord): boolean {
  return app.offerApplications.some((a) => a.status === 'Fee Paid') || app.visaApplication !== null;
}

/** The offer whose fee was paid — the institution the client is actually enrolling with. */
export function getFeePaidOffer(app: ApplicationRecord): OfferApplication | null {
  return app.offerApplications.find((o) => o.status === 'Fee Paid') ?? null;
}

export function getClientStage(app: ApplicationRecord): ClientStage {
  return isVisaUnlocked(app) ? 'Visa' : 'Offer';
}

/** File closed through "Mark Refund Received & Close File" (withdrawn, with the refund recorded). */
export function isClosedAfterRefund(app: ApplicationRecord): boolean {
  return app.withdrawn && !!app.visaApplication?.refundReceived;
}

export function getClientStatusLabel(app: ApplicationRecord): string {
  if (isClosedAfterRefund(app)) return 'File Closed · Refund Received';
  if (app.withdrawn) return 'Withdrawn';
  if (getClientStage(app) === 'Visa') {
    return app.visaApplication ? app.visaApplication.status : 'Ready to Start Visa';
  }
  const active = getActiveOfferApplication(app);
  return active ? active.status : 'Not Started';
}

export function getStatusTone(app: ApplicationRecord): StatusTone {
  if (app.withdrawn) return 'withdrawn';
  const label = getClientStatusLabel(app);
  if (label === 'Offer Received' || label === 'Fee Paid' || label === 'Visa Approved') return 'positive';
  if (label === 'Rejected' || label === 'Visa Refused') return 'negative';
  if (label === 'Enrolled' || label === 'Preparing Documents' || label === 'Not Started' || label === 'Ready to Start Visa') return 'early';
  return 'progress';
}

export const STATUS_TONE_STYLES: Record<StatusTone, string> = {
  progress: 'bg-navy/10 text-navy',
  positive: 'bg-green-100 text-green-700',
  negative: 'bg-red-100 text-red-700',
  early: 'bg-gray-100 text-gray-600',
  withdrawn: 'bg-gray-100 text-gray-500',
};

// Per-status pill colors — centralized so every screen that shows an offer/visa status
// (officer views, the read-only branch/counselor views) renders it identically.
export const OFFER_STATUS_STYLES: Record<OfferStatus, string> = {
  Enrolled: 'bg-gray-100 text-gray-600',
  'Applied to Institution': 'bg-navy/10 text-navy',
  'Further Information Required': 'bg-amber-50 text-amber-700',
  'Offer Received': 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  'Fee Paid': 'bg-green-100 text-green-700',
};

export const VISA_STATUS_STYLES: Record<VisaStageStatus, string> = {
  'Preparing Documents': 'bg-gray-100 text-gray-600',
  'File Ready for Visa': 'bg-navy/10 text-navy',
  'Visa Applied': 'bg-navy/10 text-navy',
  'Visa Approved': 'bg-green-100 text-green-700',
  'Visa Refused': 'bg-red-100 text-red-700',
};

export function isClientInProgress(app: ApplicationRecord): boolean {
  if (app.withdrawn) return false;
  const visa = app.visaApplication;
  if (visa && (visa.status === 'Visa Approved' || visa.status === 'Visa Refused')) return false;
  return true;
}

export function isVisaApproved(app: ApplicationRecord): boolean {
  return app.visaApplication?.status === 'Visa Approved';
}

export function isVisaRefused(app: ApplicationRecord): boolean {
  return app.visaApplication?.status === 'Visa Refused';
}

// ─── Case type branching ───────────────────────────────────────────────────────
// Study cases run the full pipeline (Enrolled → Offer → Fee Paid → Visa). SOWP and Visit
// cases never need a university offer, so they jump straight to document preparation.
export function isStudyCase(purpose: string): boolean {
  return /stud/i.test(purpose);
}

// ─── Document checklist ────────────────────────────────────────────────────────
// The standard visa document list, grouped as it's shown on the Status Tracker, plus any custom
// items staff added. Optional documents can be ticked but never block "File Ready for Visa".

export interface ChecklistItemDef {
  key: ChecklistKey;
  label: string;
  optional?: boolean;
}

export const CHECKLIST_GROUPS: { title: string; items: ChecklistItemDef[] }[] = [
  {
    title: 'Client Information',
    items: [
      { key: 'sop', label: 'SOP' },
      { key: 'experience', label: 'Experiences' },
      { key: 'recommendation', label: 'Recommendation' },
      { key: 'noc', label: 'NOC' },
      { key: 'policeReport', label: 'Police Report' },
    ],
  },
  {
    title: 'Financial Documents',
    items: [
      { key: 'sponsorshipLetter', label: 'Letter of Sponsorship' },
      { key: 'wardDocuments', label: 'Ward Documents' },
      { key: 'ca', label: 'CA' },
      { key: 'bankBalanceCertificate', label: 'Bank Balance Certificate' },
      { key: 'bankStatement', label: 'Bank Balance Statement' },
      { key: 'incomeDocuments', label: 'Income Documents' },
      { key: 'propertyValuation', label: 'Property Valuation' },
      { key: 'translation', label: 'Translation' },
    ],
  },
  {
    title: 'Other Documents',
    items: [
      { key: 'passport', label: 'Passport Scan' },
      { key: 'photo', label: 'Photo' },
      { key: 'medical', label: 'Medical', optional: true },
      { key: 'pal', label: 'PAL' },
    ],
  },
];

// A visa re-application after a refusal only needs these — the rest of the file was already
// submitted. Staff add anything else the case needs as a custom item.
export const REAPPLICATION_CHECKLIST_GROUPS: { title: string; items: ChecklistItemDef[] }[] = [
  {
    title: 'Re-application Documents',
    items: [
      { key: 'reappealLetter', label: 'Reappeal Letter' },
      { key: 'newPal', label: 'New PAL' },
    ],
  },
];

// ─── Enrolment documents ──────────────────────────────────────────────────────
// Collected once a client is enrolled, before the application goes to an institution. Only
// the V/A Officer marks them; counselors and managers see what's received and what isn't.

export const ENROLMENT_CHECKLIST_ITEMS: ChecklistItemDef[] = [
  { key: 'academics', label: 'Academics' },
  { key: 'passport', label: 'Passport' },
  { key: 'englishProficiency', label: 'English Proficiency' },
  { key: 'recommendationLetter', label: 'Letter of Recommendation', optional: true },
];

/** Received / total — required standard items plus every document the officer added. */
export function enrolmentChecklistCounts(app: ApplicationRecord): { done: number; total: number } {
  const list = app.enrolmentChecklist;
  const required = ENROLMENT_CHECKLIST_ITEMS.filter((i) => !i.optional);
  const custom = list?.custom ?? [];
  return {
    done: required.filter((i) => list?.marks[i.key]).length + custom.filter((c) => c.done).length,
    total: required.length + custom.length,
  };
}

/** Every required enrolment document (and every one the officer added) is received. */
export function isEnrolmentChecklistComplete(app: ApplicationRecord): boolean {
  const { done, total } = enrolmentChecklistCounts(app);
  return done === total;
}

/** Shown wherever "Applied to Institution" is blocked by missing enrolment documents. */
export const ENROLMENT_CHECKLIST_BLOCK_REASON = 'Tick every enrolment document on the Enrolled step first';

/** A visa attempt is a re-application when an earlier attempt on the case was refused. */
export function isVisaReapplication(visa: VisaApplication): boolean {
  return (visa.history ?? []).some((h) => h.status === 'Visa Refused');
}

/** The document groups that apply to this visa attempt. */
export function checklistGroupsFor(visa: VisaApplication): { title: string; items: ChecklistItemDef[] }[] {
  return isVisaReapplication(visa) ? REAPPLICATION_CHECKLIST_GROUPS : CHECKLIST_GROUPS;
}

const requiredKeys = (groups: { items: ChecklistItemDef[] }[]): ChecklistKey[] =>
  groups.flatMap((g) => g.items).filter((item) => !item.optional).map((item) => item.key);

/** Standard (first-attempt) documents that must be ticked before the file is ready. */
export const DEFAULT_CHECKLIST_KEYS: ChecklistKey[] = requiredKeys(CHECKLIST_GROUPS);

export function checklistTotalCount(visa: VisaApplication): number {
  return requiredKeys(checklistGroupsFor(visa)).length + (visa.customChecklist?.length ?? 0);
}

export function checklistCompleteCount(visa: VisaApplication): number {
  const defaults = requiredKeys(checklistGroupsFor(visa)).filter((k) => visa.checklist[k]).length;
  const custom = (visa.customChecklist ?? []).filter((c) => c.done).length;
  return defaults + custom;
}

export function isChecklistComplete(visa: VisaApplication): boolean {
  return checklistCompleteCount(visa) === checklistTotalCount(visa);
}

export function emptyVisaChecklist(): VisaChecklist {
  return {};
}

// Days spent in whichever status is currently active for the client (offer attempt or visa
// case, whichever stage they're in) — used for "needs attention" / staleness views.
export function daysInCurrentStatus(app: ApplicationRecord, now: Date): number {
  const stage = getClientStage(app);
  const updatedAt = stage === 'Visa' ? app.visaApplication?.statusUpdatedAt : getActiveOfferApplication(app)?.statusUpdatedAt;
  if (!updatedAt) return 0;
  const d = new Date(updatedAt);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, daysBetween(d, now));
}

// The latest tracked date on a single client's record, or null if nothing has happened yet.
export function latestActivityDateForApp(app: ApplicationRecord): Date | null {
  const dates: Date[] = [];
  app.offerApplications.forEach((o) => dates.push(new Date(o.statusUpdatedAt)));
  if (app.visaApplication) dates.push(new Date(app.visaApplication.statusUpdatedAt));
  if (app.withdrawnDate) dates.push(new Date(app.withdrawnDate));
  const valid = dates.filter((d) => !isNaN(d.getTime()));
  if (valid.length === 0) return null;
  return valid.reduce((latest, d) => (d > latest ? d : latest), valid[0]);
}

// Treat the latest of any tracked date across a set of applications as "now" — the mock
// dataset has no live clock, so the latest timestamp anchors "this month" / day counts.
export function latestActivityDate(applications: ApplicationRecord[]): Date {
  const valid = applications.map(latestActivityDateForApp).filter((d): d is Date => d !== null);
  if (valid.length === 0) return new Date();
  return valid.reduce((latest, d) => (d > latest ? d : latest), valid[0]);
}

export interface ActivityEvent {
  key: string;
  /** Id of the ApplicationRecord the event belongs to. */
  appId: string;
  name: string;
  description: string;
  date: Date;
  /** False when only the day is known (older records) — show the date without a time. */
  hasTime: boolean;
  /** Who made the change, when recorded. */
  by?: string;
}

// Older offers carry no statusUpdatedBy, so fall back to the per-step "by" fields.
function offerStatusBy(o: OfferApplication): string | undefined {
  if (o.statusUpdatedBy) return o.statusUpdatedBy;
  if (o.status === 'Fee Paid') return o.feePaidBy;
  if (o.status === 'Offer Received' || o.status === 'Rejected') return o.outcomeBy;
  if (o.status === 'Applied to Institution' || o.status === 'Further Information Required') return o.appliedBy;
  if (o.status === 'Enrolled') return o.enrolledBy;
  return undefined;
}

/** The moment a status was set: exact time when stamped, else the start of its day. */
function statusMoment(time: string | undefined, day: string): { date: Date; hasTime: boolean } {
  const exact = time ? new Date(time) : null;
  if (exact && !Number.isNaN(exact.getTime())) return { date: exact, hasTime: true };
  return { date: new Date(day), hasTime: false };
}

// Flat "reached status" feed across every client — replaces the old from→to transition log,
// which relied on a full statusHistory array this model no longer keeps.
export function recentActivity(applications: ApplicationRecord[], limit = 5): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  applications.forEach((a) => {
    a.offerApplications.forEach((o, i) => {
      const { date, hasTime } = statusMoment(o.statusUpdatedTime, o.statusUpdatedAt);
      if (isNaN(date.getTime())) return;
      events.push({ key: `${a.id}-offer-${i}`, appId: a.id, name: a.name, description: `${o.status} — ${o.institution}`, date, hasTime, by: offerStatusBy(o) });
    });
    if (a.visaApplication) {
      const v = a.visaApplication;
      const { date, hasTime } = statusMoment(v.statusUpdatedTime, v.statusUpdatedAt);
      if (!isNaN(date.getTime())) {
        events.push({ key: `${a.id}-visa`, appId: a.id, name: a.name, description: `Visa: ${v.status}`, date, hasTime, by: v.statusUpdatedBy });
      }
    }
    if (a.withdrawn && a.withdrawnDate) {
      const d = new Date(a.withdrawnDate);
      if (!isNaN(d.getTime())) {
        const closed = isClosedAfterRefund(a);
        events.push({
          key: `${a.id}-withdrawn`, appId: a.id, name: a.name,
          description: closed ? 'File closed — refund received' : 'Withdrawn from pipeline',
          date: d, hasTime: false, by: closed ? a.visaApplication?.refundReceivedBy : undefined,
        });
      }
    }
  });
  return events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}

export const VISA_STAGE_STATUSES: VisaStageStatus[] = [
  'Preparing Documents', 'File Ready for Visa', 'Visa Applied', 'Visa Approved', 'Visa Refused',
];

// ─── Unified pipeline stepper ───────────────────────────────────────────────────
// The Status Tracker shows one linear stepper spanning both stages, even though the
// underlying data is still "offer attempts[] + one visa case" — this just derives which
// of the 8 canonical steps the client's active attempt/case currently sits at.

export type PipelineStepKey =
  | 'enrolled' | 'applied' | 'offer_outcome' | 'fee_paid'
  | 'preparing_docs' | 'file_ready' | 'visa_applied' | 'visa_outcome';

export interface PipelineStep {
  key: PipelineStepKey;
  label: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'applied', label: 'Applied to Institution' },
  { key: 'offer_outcome', label: 'Offer Received' },
  { key: 'fee_paid', label: 'Fee Paid' },
  { key: 'preparing_docs', label: 'Preparing Documents' },
  { key: 'file_ready', label: 'File Ready for Visa' },
  { key: 'visa_applied', label: 'Visa Applied' },
  { key: 'visa_outcome', label: 'Visa Approved' },
];

// SOWP and Visit cases never touch the offer stages.
export const DIRECT_PIPELINE_STEPS: PipelineStep[] = [
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'preparing_docs', label: 'Preparing Documents' },
  { key: 'file_ready', label: 'File Ready for Visa' },
  { key: 'visa_applied', label: 'Visa Applied' },
  { key: 'visa_outcome', label: 'Visa Approved' },
];

export function pipelineStepsFor(app: ApplicationRecord): PipelineStep[] {
  return isStudyCase(app.purpose) ? PIPELINE_STEPS : DIRECT_PIPELINE_STEPS;
}

// The current step index (0-based) plus whether that step landed on a negative branch
// (Rejected / Visa Refused) — used to swap the step's label/color without an extra column.
export function getPipelineStep(app: ApplicationRecord): { index: number; negative: boolean } {
  const steps = pipelineStepsFor(app);
  const at = (key: PipelineStepKey, negative = false) => ({ index: steps.findIndex((s) => s.key === key), negative });
  const visa = app.visaApplication;
  if (visa) {
    switch (visa.status) {
      case 'Preparing Documents': return at('preparing_docs');
      case 'File Ready for Visa': return at('file_ready');
      case 'Visa Applied': return at('visa_applied');
      case 'Visa Approved': return at('visa_outcome');
      case 'Visa Refused': return at('visa_outcome', true);
    }
  }
  const active = getActiveOfferApplication(app);
  if (!active) return at('enrolled');
  switch (active.status) {
    case 'Enrolled': return at('enrolled');
    case 'Applied to Institution': return at('applied');
    case 'Further Information Required': return at('applied');
    case 'Offer Received': return at('offer_outcome');
    case 'Rejected': return at('offer_outcome', true);
    case 'Fee Paid': return at('fee_paid');
  }
}

// Per-offer step, independent of any visa data — used when a specific institution attempt
// (not necessarily the one whose fee was paid) is selected for display, since only one
// offer's fee ever becomes the client's actual enrollment/visa case.
export function getOfferPipelineStep(offer: OfferApplication): { key: PipelineStepKey; negative: boolean } {
  switch (offer.status) {
    case 'Enrolled': return { key: 'enrolled', negative: false };
    case 'Applied to Institution':
    case 'Further Information Required': return { key: 'applied', negative: false };
    case 'Offer Received': return { key: 'offer_outcome', negative: false };
    case 'Rejected': return { key: 'offer_outcome', negative: true };
    case 'Fee Paid': return { key: 'fee_paid', negative: false };
  }
}

// Roles allowed to edit a client's status/notes on the Client Profile page — everyone
// except the front desk, who gets a read-only view.
export function canEditClientProfile(role: Role): boolean {
  return role === 'application_officer' || role === 'counselor' || role === 'branch_manager' || role === 'super_admin';
}

// Withdrawing a client is narrower than general edit access — only their counselor or a
// branch manager (or an admin) can pull them out of the pipeline; the V/A officer, who only
// handles the offer/visa stages, cannot.
export function canWithdrawClient(role: Role): boolean {
  return role === 'counselor' || role === 'branch_manager' || role === 'super_admin';
}
