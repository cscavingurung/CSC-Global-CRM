import { AcademicEntry, ApplicationRecord, OfferApplication, OfferStatus, VisaApplication, VisaChecklist, VisaStageStatus, Role } from './types';

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

export function getClientStatusLabel(app: ApplicationRecord): string {
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
// Three defaults (NOC was removed) plus any custom items staff added.

export const DEFAULT_CHECKLIST_KEYS: (keyof VisaChecklist)[] = ['medical', 'financial', 'policeReport'];

export function checklistTotalCount(visa: VisaApplication): number {
  return DEFAULT_CHECKLIST_KEYS.length + (visa.customChecklist?.length ?? 0);
}

export function checklistCompleteCount(visa: VisaApplication): number {
  const defaults = DEFAULT_CHECKLIST_KEYS.filter((k) => visa.checklist[k]).length;
  const custom = (visa.customChecklist ?? []).filter((c) => c.done).length;
  return defaults + custom;
}

export function isChecklistComplete(visa: VisaApplication): boolean {
  return checklistCompleteCount(visa) === checklistTotalCount(visa);
}

export function emptyVisaChecklist(): VisaChecklist {
  return { noc: false, medical: false, financial: false, policeReport: false };
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
  name: string;
  description: string;
  date: Date;
}

// Flat "reached status" feed across every client — replaces the old from→to transition log,
// which relied on a full statusHistory array this model no longer keeps.
export function recentActivity(applications: ApplicationRecord[], limit = 5): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  applications.forEach((a) => {
    a.offerApplications.forEach((o, i) => {
      const d = new Date(o.statusUpdatedAt);
      if (isNaN(d.getTime())) return;
      events.push({ key: `${a.id}-offer-${i}`, name: a.name, description: `${o.status} — ${o.institution}`, date: d });
    });
    if (a.visaApplication) {
      const d = new Date(a.visaApplication.statusUpdatedAt);
      if (!isNaN(d.getTime())) {
        events.push({ key: `${a.id}-visa`, name: a.name, description: `Visa: ${a.visaApplication.status}`, date: d });
      }
    }
    if (a.withdrawn && a.withdrawnDate) {
      const d = new Date(a.withdrawnDate);
      if (!isNaN(d.getTime())) {
        events.push({ key: `${a.id}-withdrawn`, name: a.name, description: 'Withdrawn from pipeline', date: d });
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
