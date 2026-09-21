// Marketing workspace helpers — platform sources, soft-tinted badges and the shared
// "is this a marketing-generated lead" test used by every Marketing tab.
import { ApplicationRecord, CounselorStudent, IntakeStudent } from './types';
import { clientIdFor } from './clientId';

export const PLATFORM_SOURCES = ['Facebook', 'Instagram', 'Website', 'Tiktok', 'LinkedIn', 'Others'];

// Soft-tinted pills only — one tint per platform, never a solid fill.
const PLATFORM_STYLES: Record<string, string> = {
  Facebook: 'bg-blue-100 text-blue-700',
  Instagram: 'bg-pink-100 text-pink-700',
  Website: 'bg-navy/10 text-navy',
  Tiktok: 'bg-teal-100 text-teal-700',
  LinkedIn: 'bg-indigo-100 text-indigo-700',
  Others: 'bg-gray-100 text-gray-600',
};

export function platformBadgeStyle(source?: string): string {
  if (!source) return 'bg-gray-100 text-gray-600';
  return PLATFORM_STYLES[source] ?? 'bg-amber-50 text-amber-700';
}

/** A lead counts as marketing-generated when it carries a platform source. */
export function isMarketingLead(lead: IntakeStudent): boolean {
  return Boolean(lead.platformSource);
}

// Timestamps in this app come in two shapes: "YYYY-MM-DD h:mm AM/PM" (live submissions) and
// "18 Sep 2026, 09:10" (seeded demo rows). Both are accepted here so the dashboard filters
// never silently drop rows.
export function parseLeadDate(value?: string): Date | null {
  if (!value) return null;
  const strict = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}) (AM|PM)$/);
  if (strict) {
    const [, y, mo, d, hRaw, mi, ampm] = strict;
    let hour = parseInt(hRaw, 10) % 12;
    if (ampm === 'PM') hour += 12;
    return new Date(Number(y), Number(mo) - 1, Number(d), hour, Number(mi));
  }
  const parsed = new Date(value.replace(',', ''));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Branch a lead currently belongs to — the broadcast target wins while it's in the pool. */
export function leadBranch(lead: IntakeStudent): string {
  return lead.broadcastBranch || lead.branch || 'Unassigned';
}

export function matchEmail(a?: string, b?: string): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

/** Consultation record for a lead, matched on id first then on email. */
export function consultationFor(lead: IntakeStudent, consultations: CounselorStudent[]): CounselorStudent | undefined {
  return consultations.find((c) => c.id === lead.id || matchEmail(c.email, lead.email));
}

// Joined via the shared clientId, not email — two different clients can share an email
// (shared/test inbox, copy-paste), which would make an email-only join return the wrong
// client's application. An application only ever exists once its source consultation
// reaches "Proceeding", so the consultation (not the raw lead) is the join's starting point.
/** Pipeline record for a lead's consultation — created once it ends in "Proceeding". */
export function applicationFor(consultation: CounselorStudent | undefined, applications: ApplicationRecord[]): ApplicationRecord | undefined {
  if (!consultation) return undefined;
  const clientId = clientIdFor(consultation);
  return applications.find((a) => clientIdFor(a) === clientId);
}

export const QUALITY_STATUSES: CounselorStudent['consultationStatus'][] = [
  'In Progress',
  'Follow Up',
  'Consultation Complete',
];
