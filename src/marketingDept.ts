// Marketing Department — the data boundary and the lead-tracking join.
//
// DATA BOUNDARY (strict RBAC): Marketing sees leads, the conversion pipeline and
// marketing-attributed revenue across every branch. It must never see branch HR,
// attendance, payroll, internal expenses, private counselor notes or application
// documents. So the Marketing module is never handed the raw branch records: App.tsx runs
// `trackMarketingLeads` and passes only the resulting `LeadTrack` rows down. Each row is
// a whitelist — branch, owning counselor's name, pipeline step, timestamps and a single
// revenue figure. Consultation notes, documents, academics, fee lines and every HR/finance
// table stay on the App side of this function.
import {
  Campaign, DesignStage,
  LeadChannel, MarketingLead, MarketingRole, MarketingStore, SocialPlatform,
} from './types';
import { TrackedApplication, TrackedConsultation, TrackedIntake, TrackedRevenueTransaction } from './lib/marketing/marketingTrackingApi';
import { isLivePayment, isPaidOutRefund } from './finance';
import { parseLeadDate } from './marketing';

export const LEAD_CHANNELS: LeadChannel[] = ['Facebook', 'Instagram', 'TikTok', 'Website'];
export const SOCIAL_PLATFORMS: SocialPlatform[] = ['Facebook', 'Instagram', 'LinkedIn', 'TikTok'];

export const CHANNEL_STYLES: Record<string, string> = {
  Facebook: 'bg-blue-50 text-blue-700',
  Instagram: 'bg-pink-50 text-pink-700',
  TikTok: 'bg-teal-50 text-teal-700',
  LinkedIn: 'bg-indigo-50 text-indigo-700',
  Website: 'bg-navy/10 text-navy',
  'Multi-platform': 'bg-violet-50 text-violet-700',
};

export const STAGE_STYLES: Record<string, string> = {
  Raw: 'bg-amber-50 text-amber-700',
  Qualified: 'bg-blue-50 text-blue-700',
  Assigned: 'bg-emerald-50 text-emerald-700',
  Disqualified: 'bg-gray-100 text-gray-500',
};

export const DESIGN_STAGES: DesignStage[] = ['Requested', 'In Progress', 'Ready for Review', 'Approved', 'Scheduled'];

export const FUNNEL_STEPS = ['Leads', 'Qualified', 'Assigned', 'Contacted', 'Consultation', 'Client', 'Application', 'Visa'] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

/** Hours a branch has to make first contact before the lead escalates. */
export const CONTACT_SLA_HOURS = 24;

/** The Lead 360 journey — every step is read-only and synced from the branch modules. */
export const JOURNEY_STEPS = [
  'New', 'Assigned', 'Contacted', 'Consultation', 'Client', 'Application', 'Offer', 'Visa Submitted', 'Visa Decision',
] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

/** Days without any branch-side movement before a lead counts as stalled. */
export const NO_ACTIVITY_DAYS = 5;
/** Days a consultation may sit without converting before it's flagged. */
export const CONSULTATION_STUCK_DAYS = 7;

/** What Marketing is allowed to know about a lead once it's in a branch. */
export interface LeadTrack {
  leadId: string;
  intakeId: string;
  branch: string;
  counselor: string | null;
  assignedAt: string;
  contactedAt?: string;
  /** Furthest funnel step reached (index into FUNNEL_STEPS). */
  step: number;
  /** Furthest Lead 360 journey step reached (index into JOURNEY_STEPS). */
  journey: number;
  /** When each journey step was reached (same order as JOURNEY_STEPS); '' = reached, date unknown. */
  journeyDates: (string | undefined)[];
  visaOutcome?: 'Approved' | 'Refused';
  /** High-level business outcome only, e.g. "Contacted", "Offer Received", "Visa Approved". */
  status: string;
  /** Visa decided, not proceeding or withdrawn — nothing left to chase. */
  closed: boolean;
  /** Latest branch-side movement ("YYYY-MM-DD" or a stamp). */
  lastUpdate: string;
  daysSinceUpdate: number;
  /** Hours since assignment with no contact — null once contacted. */
  hoursUncontacted: number | null;
  slaBreached: boolean;
  /** Consultation under way for more than CONSULTATION_STUCK_DAYS without becoming a Client. */
  consultationStuck: boolean;
  /** Contacted, still open, and no movement for NO_ACTIVITY_DAYS. */
  noActivity: boolean;
  /** Net fees received (payments less processed refunds). Only computed for roles allowed to see
   * marketing-attributed revenue — never for the Leads Specialist. */
  revenue?: number;
}

/** "YYYY-MM-DD" or "YYYY-MM-DD h:mm AM/PM" → Date. */
export function toDate(v?: string): Date | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T12:00:00`);
  return parseLeadDate(v);
}

export function whenLabel(v?: string): string {
  const d = toDate(v);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const DAY_MS = 86_400_000;

/**
 * Follow each assigned marketing lead into the branch pipeline and return only the
 * whitelisted LeadTrack fields. Join chain: MarketingLead.intakeId = IntakeStudent.id =
 * CounselorStudent.id → clientId = ApplicationRecord.clientId (= FinTransaction.clientId).
 * Pass `transactions: null` for roles that must not see money — the ledger is then never read.
 */
export function trackMarketingLeads(
  leads: MarketingLead[],
  intakes: TrackedIntake[],
  consultations: TrackedConsultation[],
  applications: TrackedApplication[],
  transactions: TrackedRevenueTransaction[] | null,
  now = new Date(),
): LeadTrack[] {
  return leads.flatMap((lead): LeadTrack[] => {
    if (lead.stage !== 'Assigned' || !lead.intakeId) return [];
    const intake = intakes.find((s) => s.id === lead.intakeId);
    const cs = consultations.find((c) => c.id === lead.intakeId);
    const app = cs?.clientId ? applications.find((a) => a.clientId === cs.clientId) : undefined;

    const counselor = cs?.assignedCounselor ?? intake?.assignedCounselor ?? null;
    const contactedAt = counselor ? intake?.claimedAt ?? cs?.assignedDate ?? '' : undefined;
    const offers = app?.offerApplications ?? [];
    const visa = app?.visaApplication ?? null;

    // Journey dates — '' means the step was reached but the branch didn't record when.
    const dates: (string | undefined)[] = Array(JOURNEY_STEPS.length).fill(undefined);
    dates[0] = lead.receivedAt;
    dates[1] = lead.assignedAt ?? '';
    if (contactedAt !== undefined) dates[2] = contactedAt;
    if (cs && cs.consultationStatus !== 'Awaiting Consultation') dates[3] = cs.completedDate ?? '';
    if (cs?.outcome === 'Proceeding' || app) dates[4] = cs?.completedDate ?? app?.consultationDate ?? '';
    const applied = offers.filter((o) => o.appliedDate).map((o) => o.appliedDate!).sort()[0];
    if (applied || visa) dates[5] = applied ?? visa?.preparingDocsDate ?? '';
    const offer = offers.find((o) => o.status === 'Offer Received' || o.status === 'Fee Paid');
    if (offer) dates[6] = offer.outcomeDate ?? offer.statusUpdatedAt;
    if (visa && ['Visa Applied', 'Visa Approved', 'Visa Refused'].includes(visa.status)) dates[7] = visa.appliedDate ?? '';
    const visaOutcome = visa?.status === 'Visa Approved' ? 'Approved' : visa?.status === 'Visa Refused' ? 'Refused' : undefined;
    if (visaOutcome) dates[8] = visa?.outcomeDate ?? visa?.statusUpdatedAt ?? '';
    // A step can't be reached without the ones before it (e.g. non-study files skip the offer).
    let journey = 0;
    dates.forEach((d, i) => { if (d !== undefined) journey = i; });
    for (let i = 0; i < journey; i++) if (dates[i] === undefined && i !== 6) dates[i] = '';

    const notProceeding = cs?.outcome === 'Not Proceeding';
    const withdrawn = Boolean(app?.withdrawn);
    let status = ['In branch queue', 'In branch queue', 'Contacted', 'Consultation', 'Client', 'Application Submitted', 'Offer Received', 'Visa Submitted', `Visa ${visaOutcome ?? 'Decision'}`][journey];
    if (journey === 5 && offers.length > 0 && offers.every((o) => o.status === 'Rejected')) status = 'Offer Rejected';
    if (notProceeding && journey < 4) status = 'Not Proceeding';
    if (withdrawn) status = 'Withdrawn';
    const closed = Boolean(visaOutcome) || (notProceeding && journey < 4) || withdrawn;

    // Funnel index for the Manager views (Leads … Visa approved).
    const step = journey <= 1 ? 2 : journey === 2 ? 3 : journey === 3 ? 4 : journey === 4 ? 5 : visaOutcome === 'Approved' ? 7 : 6;

    const stamps = [
      ...dates, cs?.followUpDate ?? undefined, ...offers.map((o) => o.statusUpdatedAt), visa?.statusUpdatedAt,
    ].map(toDate).filter((d): d is Date => d !== null && d.getTime() <= now.getTime());
    const last = stamps.reduce<Date | null>((m, d) => (!m || d > m ? d : m), null);
    const lastUpdate = last ? isoToday(last) : '';
    const daysSinceUpdate = last ? Math.floor((now.getTime() - last.getTime()) / DAY_MS) : 0;

    const assigned = parseLeadDate(lead.assignedAt);
    const hoursUncontacted = contactedAt === undefined && assigned ? Math.max(0, hoursBetween(assigned, now)) : null;
    const contacted = toDate(contactedAt);
    const consultationStuck = journey === 3 && cs?.outcome === 'Pending' && !closed
      && (contacted ? (now.getTime() - contacted.getTime()) / DAY_MS > CONSULTATION_STUCK_DAYS : false);

    let revenue: number | undefined;
    if (transactions) {
      const clientTx = cs?.clientId ? transactions.filter((t) => t.clientId === cs.clientId) : [];
      revenue = clientTx.filter(isLivePayment).reduce((n, t) => n + t.amount, 0)
        - clientTx.filter(isPaidOutRefund).reduce((n, t) => n + t.amount, 0);
    }

    return [{
      leadId: lead.id,
      intakeId: lead.intakeId,
      branch: intake?.branch || intake?.broadcastBranch || lead.preferredBranch || '—',
      counselor,
      assignedAt: lead.assignedAt ?? '',
      contactedAt,
      step,
      journey,
      journeyDates: dates,
      visaOutcome,
      status,
      closed,
      lastUpdate,
      daysSinceUpdate,
      hoursUncontacted,
      slaBreached: hoursUncontacted !== null && hoursUncontacted > CONTACT_SLA_HOURS,
      consultationStuck,
      noActivity: !closed && contactedAt !== undefined && !consultationStuck && daysSinceUpdate >= NO_ACTIVITY_DAYS,
      revenue,
    }];
  });
}

/** Soft-tinted pill per high-level status: blue while new, green once converted. */
export function trackStatusStyle(t: Pick<LeadTrack, 'status' | 'journey' | 'visaOutcome' | 'closed'>): string {
  if (t.visaOutcome === 'Approved') return 'bg-emerald-50 text-emerald-700';
  if (t.visaOutcome === 'Refused' || t.status === 'Offer Rejected') return 'bg-red-50 text-red-700';
  if (t.closed) return 'bg-gray-100 text-gray-500';
  if (t.journey >= 4) return 'bg-emerald-50 text-emerald-700';
  if (t.journey >= 2) return 'bg-violet-50 text-violet-700';
  return 'bg-blue-50 text-blue-700';
}

// ── Who can do what inside the department ───────────────────────────────────
export const MKT_CAN = {
  qualify: (r?: MarketingRole) => r === 'Marketing Manager' || r === 'Leads Specialist',
  campaigns: (r?: MarketingRole) => r === 'Marketing Manager',
  requestContent: (r?: MarketingRole) => r === 'Marketing Manager' || r === 'Content Planner',
  design: (r?: MarketingRole) => r === 'Graphics Designer' || r === 'Marketing Manager',
  approveDesign: (r?: MarketingRole) => r === 'Marketing Manager' || r === 'Content Planner',
  schedulePosts: (r?: MarketingRole) => r === 'Marketing Manager' || r === 'Content Planner',
  seo: (r?: MarketingRole) => r === 'Marketing Manager' || r === 'Content Planner',
};

const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;

/** Cumulative funnel counts: a lead that reached Visa also counts in every earlier step. */
export function funnelCounts(leads: MarketingLead[], tracks: LeadTrack[]): Record<FunnelStep, number> {
  const live = leads.filter((l) => l.stage !== 'Disqualified');
  const at = (i: number) => tracks.filter((t) => t.step >= i).length;
  return {
    Leads: leads.length,
    Qualified: live.filter((l) => l.stage !== 'Raw').length,
    Assigned: at(2),
    Contacted: at(3),
    Consultation: at(4),
    Client: at(5),
    Application: at(6),
    Visa: at(7),
  };
}

export interface CampaignRoi {
  campaign: Campaign;
  spend: number;
  leads: number;
  costPerLead: number | null;
  qualified: number;
  clients: number;
  applications: number;
  revenue: number;
}

export function campaignRoi(store: MarketingStore, tracks: LeadTrack[]): CampaignRoi[] {
  return store.campaigns.map((campaign) => {
    const leads = store.leads.filter((l) => l.campaignId === campaign.id);
    const ids = new Set(leads.map((l) => l.id));
    const mine = tracks.filter((t) => ids.has(t.leadId));
    const spend = store.adSpend.filter((a) => a.campaignId === campaign.id).reduce((n, a) => n + a.amount, 0);
    return {
      campaign,
      spend,
      leads: leads.length,
      costPerLead: leads.length ? spend / leads.length : null,
      qualified: leads.filter((l) => l.stage === 'Qualified' || l.stage === 'Assigned').length,
      clients: mine.filter((t) => t.step >= 5).length,
      applications: mine.filter((t) => t.step >= 6).length,
      revenue: mine.reduce((n, t) => n + (t.revenue ?? 0), 0),
    };
  });
}

export type CampaignState = 'Upcoming' | 'Active' | 'Ended';
export function campaignState(c: Campaign, today = isoToday()): CampaignState {
  if (today < c.startDate) return 'Upcoming';
  if (today > c.endDate) return 'Ended';
  return 'Active';
}

export function isoToday(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoToday(d);
}

/** Monday-to-Sunday bounds of the week containing `iso`. */
export function weekBounds(iso = isoToday()): [string, string] {
  const d = new Date(`${iso}T00:00:00`);
  const monday = addDaysIso(iso, -((d.getDay() + 6) % 7));
  return [monday, addDaysIso(monday, 6)];
}

/** "YYYY-MM-DD h:mm AM/PM" (or a plain ISO date) → "YYYY-MM-DD". */
export const dayOf = (stamp: string) => stamp.slice(0, 10);

export function shortDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function ago(stamp?: string, now = new Date()): string {
  const d = parseLeadDate(stamp);
  if (!d) return '—';
  const h = hoursBetween(d, now);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`;
  if (h < 24) return `${Math.round(h)} hr ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export function campaignName(campaigns: Campaign[], id?: string): string {
  return campaigns.find((c) => c.id === id)?.name ?? '—';
}
