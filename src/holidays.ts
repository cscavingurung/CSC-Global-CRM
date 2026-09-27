// Holidays — which days are non-working, for whom. Attendance and Leave both ask `holidayOn`,
// so a holiday saved here changes how those modules count straight away.
import { Holiday, HolidayType } from './types';

export const HOLIDAY_TYPES: HolidayType[] = ['National', 'Festival', 'Company', 'Local'];

export const HOLIDAY_TYPE_STYLES: Record<HolidayType, string> = {
  National: 'bg-blue-50 text-blue-700',
  Festival: 'bg-amber-50 text-amber-700',
  Company: 'bg-indigo-50 text-indigo-700',
  Local: 'bg-teal-50 text-teal-700',
};

export const appliesToBranch = (h: Holiday, branch: string) => h.appliesTo === 'All' || h.appliesTo.includes(branch);

/** Holidays that apply to one branch. */
export const holidaysFor = (holidays: Holiday[], branch: string) => holidays.filter((h) => appliesToBranch(h, branch));

/** The holiday covering `date`, if any. Repeating holidays match on month-day in any year. */
export function holidayOn(holidays: Holiday[], date: string): Holiday | undefined {
  return holidays.find((h) => {
    if (h.from <= date && date <= h.to) return true;
    if (!h.repeatsAnnually) return false;
    const md = date.slice(5);
    const a = h.from.slice(5);
    const b = h.to.slice(5);
    return a <= b ? a <= md && md <= b : md >= a || md <= b;
  });
}

/** Where a holiday falls in `year` — repeating ones are moved into that year. */
export function occurrenceIn(h: Holiday, year: number): { from: string; to: string } | null {
  if (!h.repeatsAnnually) return h.from.startsWith(String(year)) ? { from: h.from, to: h.to } : null;
  return { from: `${year}${h.from.slice(4)}`, to: `${year}${h.to.slice(4)}` };
}

export const dayCount = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000) + 1;
