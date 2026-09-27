// "Smart" filters for the V/A Officer's application lists (Clients, Offer Applications and
// Visa Applications). Built around what the officer actually works from: a status they can see
// at a glance with counts, "needs attention" shortcuts, and a tidy panel for the rest (counselor,
// destination, case type, institution, intake, submitted date).
//
// The classic filter bar in ApplicationsList is untouched — users can switch back at any time
// (see FILTER_MODE_KEY), and deleting this file plus the `smart` branch in ApplicationsList
// removes the feature entirely.
import { ApplicationRecord, OfferApplication, VisaStageStatus } from './types';
import {
  daysInCurrentStatus, getActiveOfferApplication, getClientStage, getClientStatusLabel, getFeePaidOffer, isChecklistComplete,
} from './clientPipeline';
import { INTAKE_MONTHS, splitCountries } from './mockData';
import { matchesDateRange } from './dateFilter';
import { clientIdFor } from './clientId';

// 'pipeline' is the Branch Manager's Application Operations Monitor: every client, filtered by
// their current status anywhere in the Offer → Visa pipeline.
export type FilterScope = 'all' | 'offer' | 'visa' | 'pipeline';
export type FilterMode = 'smart' | 'classic';

/** localStorage key remembering whether the officer prefers the new or the classic filters. */
export const FILTER_MODE_KEY = 'csc:applicationFilterMode';

export type QuickKey = 'stale' | 'further-info' | 'intake-soon' | 'checklist' | 'interview' | 'hc-docs' | 'refund';

export interface SmartFilters {
  search: string;
  /** Multi-select status chips; empty = all. */
  statuses: string[];
  quick: QuickKey[];
  counselor: string;
  country: string;
  caseType: string;
  institution: string;
  /** "Feb 2027" */
  intake: string;
  /** Institution-issued University Client ID (captured when the fee is marked paid) — partial match. */
  universityClientId: string;
  /** Pipeline scope: intake split into month ("Feb") and year ("2027"), each optional. */
  intakeMonth: string;
  intakeYear: string;
  /** Pipeline scope: furthest point the client has ever reached, regardless of current status. */
  milestone: MilestoneKey | '';
  dateFrom: string;
  dateTo: string;
  /** Pipeline scope: date the visa was approved/refused. */
  decisionFrom: string;
  decisionTo: string;
}

export const EMPTY_SMART_FILTERS: SmartFilters = {
  search: '', statuses: [], quick: [], counselor: '', country: '', caseType: '', institution: '', intake: '', universityClientId: '',
  intakeMonth: '', intakeYear: '', milestone: '', dateFrom: '', dateTo: '', decisionFrom: '', decisionTo: '',
};

export type MilestoneKey = 'applied' | 'offer-letter' | 'fee-paid' | 'visa-lodged' | 'visa-decided';

export const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  applied: 'Applied to an institution',
  'offer-letter': 'Received an offer letter',
  'fee-paid': 'Tuition fee paid',
  'visa-lodged': 'Visa lodged',
  'visa-decided': 'Visa decision received',
};

const VISA_LODGED: VisaStageStatus[] = ['Visa Applied', 'Visa Approved', 'Visa Refused'];

/** Has the client ever reached this point? Stays true after they move further along. */
export function reachedMilestone(app: ApplicationRecord, key: MilestoneKey): boolean {
  const offers = app.offerApplications;
  const visaEver = app.visaApplication ? [app.visaApplication, ...(app.visaApplication.history ?? [])] : [];
  switch (key) {
    case 'applied':
      return offers.some((o) => o.status !== 'Enrolled') || !!app.visaApplication;
    case 'offer-letter':
      return offers.some((o) => o.status === 'Offer Received' || o.status === 'Fee Paid');
    case 'fee-paid':
      return !!getFeePaidOffer(app);
    case 'visa-lodged':
      return visaEver.some((v) => VISA_LODGED.includes(v.status));
    case 'visa-decided':
      return visaEver.some((v) => v.status === 'Visa Approved' || v.status === 'Visa Refused');
  }
}

export interface FilterableRow {
  app: ApplicationRecord;
  /** The offer attempt this row stands for (Offer queue), else null. */
  offer: OfferApplication | null;
}

export const STALE_DAYS = 7;
export const INTAKE_SOON_DAYS = 60;

const NOT_STARTED = 'Not Started';

/** Status chips per list, in pipeline order. */
export function statusOptions(scope: FilterScope, excludePendingOffers?: boolean): string[] {
  if (scope === 'offer') {
    const offer: string[] = ['Applied to Institution', 'Further Information Required', 'Offer Received', 'Rejected', 'Fee Paid'];
    return excludePendingOffers ? offer : [NOT_STARTED, 'Enrolled', ...offer];
  }
  if (scope === 'visa') {
    return [NOT_STARTED, 'Preparing Documents', 'File Ready for Visa', 'Visa Applied', 'Visa Approved', 'Visa Refused'];
  }
  if (scope === 'pipeline') return PIPELINE_STATUS_GROUPS.flatMap((g) => g.values);
  return ['Offer Stage', 'Visa Stage', 'Withdrawn'];
}

/** Pipeline scope: status chips grouped by stage, in pipeline order. */
export const PIPELINE_STATUS_GROUPS: { label: string; values: string[] }[] = [
  { label: 'Offer', values: [NOT_STARTED, 'Enrolled', 'Applied to Institution', 'Further Information Required', 'Offer Received', 'Rejected', 'Fee Paid'] },
  { label: 'Visa', values: ['Ready to Start Visa', 'Preparing Documents', 'File Ready for Visa', 'Visa Applied', 'Visa Approved', 'Visa Refused'] },
  { label: 'Closed', values: ['Withdrawn', 'File Closed · Refund Received'] },
];

/** Short chip labels — the full status is kept as the value. */
export const STATUS_SHORT_LABELS: Record<string, string> = {
  'Applied to Institution': 'Applied',
  'Further Information Required': 'Info Required',
  'File Ready for Visa': 'File Ready',
  'Preparing Documents': 'Preparing Docs',
  'Offer Received': 'Offer Letter Received',
  Rejected: 'Offer Rejected',
  'Ready to Start Visa': 'Ready for Visa',
  'File Closed · Refund Received': 'Refund Received & Closed',
};

export const QUICK_LABELS: Record<QuickKey, string> = {
  stale: `Stuck ${STALE_DAYS}+ days`,
  'further-info': 'Info requested',
  'intake-soon': `Intake within ${INTAKE_SOON_DAYS} days`,
  checklist: 'Checklist incomplete',
  interview: 'Interview required',
  'hc-docs': 'High Commission docs',
  refund: 'Refund requested',
};

export function quickOptions(scope: FilterScope): QuickKey[] {
  if (scope === 'offer') return ['stale', 'further-info', 'intake-soon'];
  if (scope === 'visa') return ['stale', 'checklist', 'interview', 'hc-docs', 'refund', 'intake-soon'];
  if (scope === 'pipeline') return ['stale', 'further-info', 'intake-soon', 'checklist', 'interview', 'hc-docs', 'refund'];
  return ['stale', 'further-info', 'intake-soon'];
}

// Old visa-status buckets (used by dashboard links) → the detailed statuses shown as chips.
const VISA_BUCKET_TO_STATUS: Record<string, VisaStageStatus[]> = {
  Pending: ['Preparing Documents', 'File Ready for Visa'],
  Applied: ['Visa Applied'],
  Approved: ['Visa Approved'],
  Refused: ['Visa Refused'],
};

/** Translate a dashboard redirect's filters into the smart filter shape. */
export function smartFiltersFromIntent(
  scope: FilterScope,
  intent?: { search?: string; appStage?: string; visaStatuses?: string[] }
): SmartFilters {
  if (scope === 'pipeline') {
    const stage = intent?.appStage;
    const group = stage === 'Withdrawn' ? 'Closed' : stage;
    const statuses = group ? PIPELINE_STATUS_GROUPS.find((g) => g.label === group)?.values ?? []
      : intent?.visaStatuses ? intent.visaStatuses.flatMap((b) => VISA_BUCKET_TO_STATUS[b] ?? [])
      : [];
    return { ...EMPTY_SMART_FILTERS, search: intent?.search ?? '', statuses };
  }
  const statuses =
    scope === 'visa' && intent?.visaStatuses ? intent.visaStatuses.flatMap((b) => VISA_BUCKET_TO_STATUS[b] ?? [])
    : scope === 'all' && intent?.appStage ? [intent.appStage === 'Withdrawn' ? 'Withdrawn' : `${intent.appStage} Stage`]
    : [];
  return { ...EMPTY_SMART_FILTERS, search: intent?.search ?? '', statuses };
}

// ── Row facts ────────────────────────────────────────────────────────────────

export function rowStatus(row: FilterableRow, scope: FilterScope): string {
  if (scope === 'offer') return row.offer ? row.offer.status : NOT_STARTED;
  if (scope === 'visa') return row.app.visaApplication ? row.app.visaApplication.status : NOT_STARTED;
  if (scope === 'pipeline') return getClientStatusLabel(row.app);
  if (row.app.withdrawn) return 'Withdrawn';
  return `${getClientStage(row.app)} Stage`;
}

export function rowIntake(row: FilterableRow): string {
  return row.offer?.intake ?? getFeePaidOffer(row.app)?.intake ?? getActiveOfferApplication(row.app)?.intake ?? '';
}

// ── Intake & University Client ID (shared by every client list) ──
/** The intake a client is going for: the fee-paid offer's, else the active attempt's. */
export const appIntake = (app?: ApplicationRecord | null) => (app ? rowIntake({ app, offer: null }) : '');

/** Institution-issued University Client ID, entered when the tuition fee is marked paid (for commissions). */
export const appUniversityClientId = (app?: ApplicationRecord | null, offer?: OfferApplication | null) =>
  offer?.studentId ?? (app
    ? getFeePaidOffer(app)?.studentId ?? app.offerApplications.find((o) => o.studentId)?.studentId ?? app.countryPipeline?.universityClientId ?? ''
    : '');

/** Intake like "Feb 2027" against a month ("Feb") and/or year ("2027"); both empty = any. */
export function matchesIntakeParts(intake: string, month: string, year: string): boolean {
  if (!month && !year) return true;
  const [m, y] = intake.split(' ');
  return (!month || m === month) && (!year || y === year);
}

/** Partial, case- and space-insensitive University Client ID match; empty query = any. */
export function matchesUniversityClientId(id: string, query: string): boolean {
  const q = query.replace(/\s+/g, '').toLowerCase();
  return !q || id.replace(/\s+/g, '').toLowerCase().includes(q);
}

export function rowCountries(row: FilterableRow): string[] {
  const offerCountry = row.offer?.country ?? getFeePaidOffer(row.app)?.country;
  return offerCountry ? [offerCountry] : splitCountries(row.app.country);
}

export function rowInstitution(row: FilterableRow): string {
  return row.offer?.institution ?? getFeePaidOffer(row.app)?.institution ?? getActiveOfferApplication(row.app)?.institution ?? '';
}

/** First day of an intake like "Feb 2027", or null if unparseable. */
export function intakeDate(intake: string): Date | null {
  const [m, y] = intake.split(' ');
  const mi = INTAKE_MONTHS.indexOf(m);
  const year = Number(y);
  return mi < 0 || !year ? null : new Date(year, mi, 1);
}

function matchesQuick(row: FilterableRow, key: QuickKey, now: Date): boolean {
  const visa = row.app.visaApplication;
  switch (key) {
    case 'stale':
      return !row.app.withdrawn && daysInCurrentStatus(row.app, now) >= STALE_DAYS;
    case 'further-info': {
      const offer = row.offer ?? getActiveOfferApplication(row.app);
      return !!offer && (offer.status === 'Further Information Required' || !!offer.furtherInfoRequired);
    }
    case 'intake-soon': {
      const d = intakeDate(rowIntake(row));
      if (!d) return false;
      const days = (d.getTime() - now.getTime()) / 86_400_000;
      return days >= 0 && days <= INTAKE_SOON_DAYS;
    }
    case 'checklist':
      return !!visa && visa.status === 'Preparing Documents' && !isChecklistComplete(visa);
    case 'interview':
      return !!visa?.interviewRequired;
    case 'hc-docs':
      return !!visa?.documentsRequestedFromHighCommission;
    case 'refund':
      return !!visa?.refundRequested;
  }
}

/** Every filter except `skip` — lets the status chips and quick toggles show live counts.
 * 'breakdown' skips status, milestone and intake, which the intake breakdown sets itself. */
export function matchesSmart(
  row: FilterableRow, f: SmartFilters, scope: FilterScope, now: Date, skip?: 'statuses' | 'quick' | 'breakdown'
): boolean {
  const term = f.search.trim().toLowerCase();
  if (term) {
    const haystack = [row.app.name, clientIdFor(row.app), row.app.phone, row.app.email, rowInstitution(row), appUniversityClientId(row.app, row.offer)].join(' ').toLowerCase();
    if (!haystack.includes(term)) return false;
  }
  if (skip !== 'statuses' && skip !== 'breakdown' && f.statuses.length > 0 && !f.statuses.includes(rowStatus(row, scope))) return false;
  if (skip !== 'quick' && f.quick.some((q) => !matchesQuick(row, q, now))) return false;
  if (f.counselor && row.app.counselor !== f.counselor) return false;
  if (f.country && !rowCountries(row).includes(f.country)) return false;
  if (f.caseType && row.app.purpose !== f.caseType) return false;
  if (f.institution && rowInstitution(row) !== f.institution) return false;
  if (f.intake && rowIntake(row) !== f.intake) return false;
  if (!matchesUniversityClientId(appUniversityClientId(row.app, row.offer), f.universityClientId)) return false;
  if (skip !== 'breakdown') {
    if (f.milestone && !reachedMilestone(row.app, f.milestone)) return false;
    if (f.intakeMonth || f.intakeYear) {
      const [m, y] = rowIntake(row).split(' ');
      if ((f.intakeMonth && m !== f.intakeMonth) || (f.intakeYear && y !== f.intakeYear)) return false;
    }
  }
  if ((f.dateFrom || f.dateTo) && !matchesDateRange(row.app.consultationDate, f.dateFrom, f.dateTo)) return false;
  if (f.decisionFrom || f.decisionTo) {
    const decided = row.app.visaApplication?.outcomeDate;
    if (!decided || !matchesDateRange(decided, f.decisionFrom, f.decisionTo)) return false;
  }
  return true;
}

export function countQuick(rows: FilterableRow[], f: SmartFilters, scope: FilterScope, key: QuickKey, now: Date): number {
  return rows.filter((r) => matchesSmart(r, f, scope, now, 'quick') && matchesQuick(r, key, now)).length;
}

/** Dropdown options built from the rows themselves, so they only ever offer values that exist. */
export function panelOptions(rows: FilterableRow[]) {
  const uniq = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const intakes = Array.from(new Set(rows.map(rowIntake).filter(Boolean))).sort(
    (a, b) => (intakeDate(a)?.getTime() ?? 0) - (intakeDate(b)?.getTime() ?? 0)
  );
  const intakeYears = Array.from(new Set(intakes.map((i) => i.split(' ')[1]).filter(Boolean))).sort();
  return {
    intakeYears,
    counselors: uniq(rows.map((r) => r.app.counselor)),
    countries: uniq(rows.flatMap(rowCountries)),
    caseTypes: uniq(rows.map((r) => r.app.purpose)),
    institutions: uniq(rows.map(rowInstitution)),
    intakes,
  };
}

export function readFilterMode(): FilterMode {
  try {
    return window.localStorage.getItem(FILTER_MODE_KEY) === 'classic' ? 'classic' : 'smart';
  } catch {
    return 'smart';
  }
}

export function saveFilterMode(mode: FilterMode): void {
  try {
    window.localStorage.setItem(FILTER_MODE_KEY, mode);
  } catch {
    /* storage unavailable — the choice still applies for this session */
  }
}

// ── Intake breakdown (pipeline scope) ───────────────────────────────────────

export interface IntakeBreakdownRow {
  intake: string;
  clients: number;
  offerLetters: number;
  feePaid: number;
  visaLodged: number;
  approved: number;
  refused: number;
}

/** Per-intake funnel counts, earliest intake first. Rows with no intake are left out. */
export function intakeBreakdown(rows: FilterableRow[]): IntakeBreakdownRow[] {
  const byIntake = new Map<string, IntakeBreakdownRow>();
  rows.forEach((row) => {
    const intake = rowIntake(row);
    if (!intake) return;
    const entry = byIntake.get(intake) ?? { intake, clients: 0, offerLetters: 0, feePaid: 0, visaLodged: 0, approved: 0, refused: 0 };
    const status = rowStatus(row, 'pipeline');
    entry.clients += 1;
    if (reachedMilestone(row.app, 'offer-letter')) entry.offerLetters += 1;
    if (reachedMilestone(row.app, 'fee-paid')) entry.feePaid += 1;
    if (reachedMilestone(row.app, 'visa-lodged')) entry.visaLodged += 1;
    if (status === 'Visa Approved') entry.approved += 1;
    if (status === 'Visa Refused') entry.refused += 1;
    byIntake.set(intake, entry);
  });
  return Array.from(byIntake.values()).sort(
    (a, b) => (intakeDate(a.intake)?.getTime() ?? 0) - (intakeDate(b.intake)?.getTime() ?? 0)
  );
}
