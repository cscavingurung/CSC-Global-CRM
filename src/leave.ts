// Leave Management — deliberately simple: fixed yearly allowances, working-day counts and a
// single approval step. Balances are allowance minus approved days this year.
import { Holiday, LeaveRecord, LeaveType } from './types';
import { holidayOn } from './holidays';

export const LEAVE_TYPES: LeaveType[] = ['Annual', 'Sick', 'Casual', 'Emergency', 'Unpaid'];

/** Yearly allowance for the types that have one. Emergency and Unpaid have no balance. */
export const ALLOWANCE: Partial<Record<LeaveType, number>> = { Annual: 15, Sick: 8, Casual: 5 };
export const BALANCE_TYPES = ['Annual', 'Sick', 'Casual'] as const;

export const LEAVE_STATUS_STYLES: Record<LeaveRecord['status'], string> = {
  Pending: 'bg-amber-50 text-amber-700',
  Approved: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-red-50 text-red-700',
  Returned: 'bg-amber-50 text-amber-800',
};

/** Days in [from, to] that count as leave: not Saturday (the weekly day off) and not a holiday
 * for the branch. Holidays passed here are already filtered to the employee's branch. */
export function workingDaysBetween(from: string, to: string, holidays: Holiday[] = []): number {
  return countDays(from, to, holidays).working;
}

/** Working days plus what was skipped, for the "Total days" breakdown. */
export function countDays(from: string, to: string, holidays: Holiday[] = []) {
  const out = { working: 0, saturdays: 0, holidays: [] as { date: string; name: string }[] };
  if (!from || !to || to < from) return out;
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const h = holidayOn(holidays, key);
    if (h) out.holidays.push({ date: key, name: h.name });
    else if (d.getDay() === 6) out.saturdays += 1;
    else out.working += 1;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Days a request actually costs — worked out live, so a holiday added later is refunded. */
export const leaveDays = (l: LeaveRecord, holidays: Holiday[] = []) => workingDaysBetween(l.from, l.to, holidays);

export interface Balance {
  type: (typeof BALANCE_TYPES)[number];
  allowance: number;
  used: number;
  pending: number;
  remaining: number;
}

export function balancesFor(name: string, leave: LeaveRecord[], year: number, holidays: Holiday[] = []): Balance[] {
  const mine = leave.filter((l) => l.staffName === name && l.from.startsWith(String(year)));
  return BALANCE_TYPES.map((type) => {
    const allowance = ALLOWANCE[type] ?? 0;
    const used = mine.filter((l) => l.type === type && l.status === 'Approved').reduce((n, l) => n + leaveDays(l, holidays), 0);
    const pending = mine.filter((l) => l.type === type && l.status === 'Pending').reduce((n, l) => n + leaveDays(l, holidays), 0);
    return { type, allowance, used, pending, remaining: allowance - used };
  });
}

/** An existing pending/approved request that overlaps [from, to]. */
export const overlapping = (leave: LeaveRecord[], name: string, from: string, to: string) =>
  leave.find((l) => l.staffName === name && (l.status === 'Pending' || l.status === 'Approved') && l.from <= to && from <= l.to);
