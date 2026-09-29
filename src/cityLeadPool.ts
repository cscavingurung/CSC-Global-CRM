// City-Wide Lead Pool — a shared, cross-branch queue for leads Marketing routes to a whole city
// (MarketingLead.cityPool / IntakeStudent.broadcastCity, set from the Leads Specialist's
// "Assign to City Pool" destination — see components/marketing/MktLeadsSpecialist.tsx and
// App.tsx's handleMarketingPushToCityPool) instead of to one branch. Any counselor at a branch in
// that city can then claim a pooled lead; the first "Accept & Claim Lead" click locks it to their
// own branch and profile so no single branch gets first pick from Marketing.
//
// Real claims (App.tsx's handleAcceptLead → lib/studentsApi.ts's claimStudent) go through an
// atomic, RLS-guarded `UPDATE ... WHERE claimed_by IS NULL` — Postgres's row lock decides the
// race, not this module. `claimCityPoolLead` below is the same rule reimplemented as a pure
// function purely so components/counselor/CityLeadPool.tsx can also run as a self-contained demo
// (MOCK_CITY_POOL_LEADS) without a backend.

export type CityPoolLeadSource = 'Facebook' | 'Instagram' | 'TikTok' | 'Website';

export interface CityPoolLead {
  id: string;
  /** e.g. "Kathmandu" — matches a MarketingLead.cityPool / IntakeStudent.broadcastCity value. */
  city: string;
  fullName: string;
  fullPhone: string;
  email?: string;
  interestedCountry: string;
  targetProgram: string;
  source: CityPoolLeadSource;
  /** Marketing's enquiry notes — shown only once the lead is claimed. */
  notes?: string;
  /** "YYYY-MM-DD HH:mm" — when Marketing dropped it into the pool. */
  enteredPoolAt: string;
  /** Set the instant a counselor claims it; undefined while it's still sitting in the pool. */
  claim?: CityPoolClaim;
}

export interface CityPoolClaim {
  counselorName: string;
  branch: string;
  claimedAt: string;
}

/** "Aarav Shrestha" → "A. Shrestha" — first-name initial, full surname, until claimed. */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

/** "+977 9812345678" → "+977 98********" — country code + first 2 local digits, rest hidden. */
export function maskPhone(fullPhone: string): string {
  const match = fullPhone.match(/^(\+?\d{1,4}[\s-]?\d{2})(\d+)$/);
  if (!match) return fullPhone.replace(/\d/g, '*');
  return `${match[1]}${'*'.repeat(match[2].length)}`;
}

const MINUTE_MS = 60_000;

/** "YYYY-MM-DD HH:mm" `n` minutes ago, for seeding mock pool entries. */
function minutesAgo(n: number, now = new Date()): string {
  return new Date(now.getTime() - n * MINUTE_MS).toISOString().slice(0, 16).replace('T', ' ');
}

/** "Entered 12 mins ago" — how long a lead has been sitting unclaimed. */
export function timeInPool(enteredPoolAt: string, now = new Date()): string {
  const entered = new Date(enteredPoolAt.replace(' ', 'T'));
  if (Number.isNaN(entered.getTime())) return 'Entered moments ago';
  const minutes = Math.max(0, Math.round((now.getTime() - entered.getTime()) / MINUTE_MS));
  if (minutes < 1) return 'Entered moments ago';
  if (minutes < 60) return `Entered ${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Entered ${hours} hr${hours === 1 ? '' : 's'} ago`;
  return `Entered ${Math.round(hours / 24)}d ago`;
}

/** The claimed-lead audit line, e.g. "Claimed from Kathmandu City Pool by Counselor Rupesh
 * (Chitwan Branch) at 2026-09-29 14:32" — derived from the claim, not stored separately. */
export function claimAuditLine(lead: CityPoolLead): string | undefined {
  if (!lead.claim) return undefined;
  return `Claimed from ${lead.city} City Pool by Counselor ${lead.claim.counselorName} (${lead.claim.branch} Branch) at ${lead.claim.claimedAt}`;
}

/**
 * First-accept-first-get, reimplemented as a pure function for the demo path: claims `leadId` for
 * `counselorName`/`branch` if — and only if — it's still unclaimed. Returns the updated list, or
 * `null` when the lead is missing or someone already beat this click to it.
 */
export function claimCityPoolLead(
  leads: CityPoolLead[],
  leadId: string,
  counselorName: string,
  branch: string,
  now = new Date(),
): CityPoolLead[] | null {
  const target = leads.find((l) => l.id === leadId);
  if (!target || target.claim) return null;
  const claimedAt = now.toISOString().slice(0, 16).replace('T', ' ');
  return leads.map((l) => (l.id === leadId ? { ...l, claim: { counselorName, branch, claimedAt } } : l));
}

/** Three unclaimed Kathmandu City Pool leads — seeds the standalone demo. */
export const MOCK_CITY_POOL_LEADS: CityPoolLead[] = [
  {
    id: 'cpl-1', city: 'Kathmandu', fullName: 'Aarav Shrestha', fullPhone: '+977 9812345678',
    email: 'aarav.shrestha@example.com', interestedCountry: 'Australia', targetProgram: 'Bachelor of IT',
    source: 'Facebook', notes: 'Asked about intake deadlines for the Feb 2027 session.',
    enteredPoolAt: minutesAgo(12),
  },
  {
    id: 'cpl-2', city: 'Kathmandu', fullName: 'Priya Karki', fullPhone: '+977 9845098450',
    email: 'priya.karki@example.com', interestedCountry: 'Canada', targetProgram: 'Diploma in Business',
    source: 'Instagram', notes: 'DM enquiry — asked for a callback after 5pm.',
    enteredPoolAt: minutesAgo(34),
  },
  {
    id: 'cpl-3', city: 'Kathmandu', fullName: 'Bikash Tamang', fullPhone: '+977 9801122334',
    interestedCountry: 'United Kingdom', targetProgram: 'MSc Data Science',
    source: 'Website', notes: 'Submitted the contact form from the UK landing page.',
    enteredPoolAt: minutesAgo(58),
  },
];
