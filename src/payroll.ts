// HRM · Payroll Inputs — the read-only figures Finance needs, pulled from Attendance and Leave,
// plus helpers for the manual columns. Deliberately no net-pay, tax or deduction formulas.
import { AttendanceRecord, Holiday, LeaveRecord, PayProfile, PayrollAuto, PayrollManual, PayrollRun, StaffMember } from './types';
import { datesBetween, dayView } from './attendance';
import { dateKey } from './dateTime';

export const MANUAL_COLUMNS: { key: Exclude<keyof PayrollManual, 'remarks'>; label: string; negative?: boolean }[] = [
  { key: 'overtime', label: 'Overtime' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'commission', label: 'Commission / Incentive' },
  { key: 'allowance', label: 'Allowance' },
  { key: 'deduction', label: 'Deduction', negative: true },
  { key: 'advance', label: 'Advance', negative: true },
  { key: 'other', label: 'Other Adjustment' },
];

export const RUN_STATUS_STYLES: Record<PayrollRun['status'] | 'Not started', string> = {
  Draft: 'bg-amber-50 text-amber-700',
  Submitted: 'bg-blue-50 text-blue-700',
  Processed: 'bg-emerald-50 text-emerald-700',
  'Not started': 'bg-gray-100 text-gray-500',
};

export const emptyManual = (allowance = 0): PayrollManual =>
  ({ overtime: 0, bonus: 0, commission: 0, allowance, deduction: 0, advance: 0, other: 0, remarks: '' });

export const money = (n: number) => (n ? `Rs ${n.toLocaleString('en-IN')}` : '—');

export const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Salary in force on a date — the latest entry that had taken effect. */
export function basicOn(profile: PayProfile | undefined, date: string): number {
  if (!profile) return 0;
  const entries = [...profile.salaryHistory].filter((e) => e.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return entries[0]?.amount ?? 0;
}

/**
 * Attendance and leave for one person over a month (to date, for the current month), using the
 * same day rules as the Attendance module: holidays and Saturdays aren't working days, approved
 * leave is leave, and a working day without a check-in or leave is an absence.
 */
export function autoFor(
  member: StaffMember, month: string, profile: PayProfile | undefined,
  attendance: AttendanceRecord[], leave: LeaveRecord[], holidays: Holiday[], now: Date,
): PayrollAuto {
  const today = dateKey(now);
  const last = dateKey(new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0));
  const first = attendance.filter((r) => r.staffName === member.name).map((r) => r.date).sort()[0];
  const out: PayrollAuto = { basic: basicOn(profile, last), workingDays: 0, daysWorked: 0, leaveDays: 0, late: 0, absent: 0 };
  datesBetween(`${month}-01`, last < today ? last : today).forEach((date) => {
    if (first && date < first) return;
    const v = dayView(member.name, date, attendance, leave, now, holidays);
    if (v.status === 'Off' || v.status === 'Holiday' || v.status === 'Not in yet') return;
    out.workingDays += 1;
    if (v.record?.checkIn) out.daysWorked += 1;
    if (v.status === 'On Leave') out.leaveDays += 1;
    if (v.status === 'Late' || v.status === 'Very Late') out.late += 1;
    if (v.status === 'Absent') out.absent += 1;
  });
  return out;
}
