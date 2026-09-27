// HRM Attendance — one place for how a day is classified and how a correction is applied, so
// the manager views, Branch Operations Control and the staff Time & Attendance page agree.
import {
  AttendanceCorrection, AttendanceExplanation, AttendanceRecord, ExplanationReason, Holiday, LeaveRecord, MockUser, NavIntent, StaffMember, StaffRole,
} from './types';
import { holidayOn } from './holidays';
import { attendanceStatus, isWorkingDay, LATE_LIMIT, SHIFT_START_MINUTES, minutesOfDay } from './branchOps';
import { dateKey, formatSubmittedAt, parseSubmittedAt } from './dateTime';

export type DayStatus = 'Present' | 'Late' | 'Very Late' | 'Absent' | 'On Leave' | 'Holiday' | 'Off' | 'Not in yet';

export const DAY_STATUS_STYLES: Record<DayStatus, string> = {
  Present: 'bg-emerald-50 text-emerald-700',
  Late: 'bg-amber-50 text-amber-700',
  'Very Late': 'bg-amber-100 text-amber-800',
  Absent: 'bg-red-50 text-red-700',
  'On Leave': 'bg-blue-50 text-blue-700',
  Holiday: 'bg-sky-50 text-sky-700',
  Off: 'bg-gray-100 text-gray-500',
  'Not in yet': 'bg-gray-100 text-gray-500',
};

/** Calendar letters: P Present, L Late, A Absent, O Off, LV Leave, H Holiday. */
export const DAY_LETTER: Record<DayStatus, string> = {
  Present: 'P', Late: 'L', 'Very Late': 'L', Absent: 'A', 'On Leave': 'LV', Holiday: 'H', Off: 'O', 'Not in yet': '·',
};

export type Department = 'Management' | 'Counseling' | 'Visa & Admissions' | 'Front Desk';
export const DEPARTMENTS: Department[] = ['Management', 'Counseling', 'Visa & Admissions', 'Front Desk'];
export const departmentOf = (role: StaffRole): Department =>
  role === 'Counselor' ? 'Counseling' : role === 'V/A Officer' ? 'Visa & Admissions' : role === 'Front Desk Officer' ? 'Front Desk' : 'Management';

/** Approved leave covering this day — pending and rejected requests never count. */
export const onLeave = (leave: LeaveRecord[], name: string, date: string) =>
  leave.find((l) => l.status === 'Approved' && l.staffName === name && l.from <= date && date <= l.to);

export interface DayView {
  date: string;
  staffName: string;
  record?: AttendanceRecord;
  status: DayStatus;
  /** Checked in on a past day but never checked out. */
  missingCheckOut: boolean;
  leave?: LeaveRecord;
  holiday?: Holiday;
}

/** How a staff member's day reads. "Present" means on time; Late/Very Late use the grace rules.
 * Saturday is the weekly day off — unless the branch operated that day (anyone in `records`
 * checked in), in which case a missing check-in is an absence like any other day.
 * A holiday (already filtered to this branch) is never an absence and outranks leave, so leave
 * that overlaps it isn't counted as leave either. */
export function dayView(
  staffName: string, date: string, records: AttendanceRecord[], leave: LeaveRecord[], now: Date, holidays: Holiday[] = [],
): DayView {
  const today = dateKey(now);
  const record = records.find((r) => r.staffName === staffName && r.date === date);
  const hol = holidayOn(holidays, date);
  const lv = hol ? undefined : onLeave(leave, staffName, date);
  let status: DayStatus;
  if (record?.checkIn) {
    const s = attendanceStatus(record.checkIn);
    status = s === 'On Time' || !s ? 'Present' : s;
  } else if (hol) status = 'Holiday';
  else if (lv) status = 'On Leave';
  else if (!isWorkingDay(new Date(`${date}T00:00:00`)) && !records.some((r) => r.date === date && r.checkIn)) status = 'Off';
  else if (date === today && minutesOfDay(now) <= SHIFT_START_MINUTES + LATE_LIMIT) status = 'Not in yet';
  else status = 'Absent';
  return { date, staffName, record, status, missingCheckOut: !!record?.checkIn && !record.checkOut && date < today, leave: lv, holiday: hol };
}

/** A day with both punches but less than this worked counts as a half day. */
export const HALF_DAY_MINUTES = 4 * 60;

export interface AttendanceSummary {
  workingDays: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  halfDay: number;
  /** Checked in on a past day but never checked out. */
  missing: number;
}

/** One person's attendance over [from, to] (capped at today), using the same day rules as every
 * Attendance view — Saturdays and holidays aren't working days; days before their first
 * record don't count. */
export function attendanceSummary(
  name: string, from: string, to: string, records: AttendanceRecord[], leave: LeaveRecord[], holidays: Holiday[], now: Date,
): AttendanceSummary {
  const today = dateKey(now);
  const first = firstDayOf(records, name);
  const out: AttendanceSummary = { workingDays: 0, present: 0, late: 0, absent: 0, leave: 0, halfDay: 0, missing: 0 };
  datesBetween(from, to < today ? to : today).forEach((date) => {
    if (!first || date < first) return;
    const v = dayView(name, date, records, leave, now, holidays);
    if (v.status === 'Off' || v.status === 'Holiday' || v.status === 'Not in yet') return;
    out.workingDays += 1;
    if (v.record?.checkIn) out.present += 1;
    if (v.status === 'Late' || v.status === 'Very Late') out.late += 1;
    if (v.status === 'Absent') out.absent += 1;
    if (v.status === 'On Leave') out.leave += 1;
    if (v.missingCheckOut) out.missing += 1;
    const worked = v.record?.checkOut ? workedMinutes(v.record, now) : null;
    if (worked !== null && worked < HALF_DAY_MINUTES) out.halfDay += 1;
  });
  return out;
}

/** Minutes between check-in and check-out (or now, if still in today). */
export function workedMinutes(record: AttendanceRecord | undefined, now: Date): number | null {
  const a = record?.checkIn ? parseSubmittedAt(record.checkIn) : null;
  if (!a) return null;
  const b = record?.checkOut ? parseSubmittedAt(record.checkOut) : record && record.date === dateKey(now) ? now : null;
  return b ? Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000)) : null;
}

export const formatMinutes = (m: number | null) => (m === null ? '—' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);

/** First day this person has any record — days before it are "not yet employed", not absences. */
export const firstDayOf = (records: AttendanceRecord[], name: string) =>
  records.filter((r) => r.staffName === name).map((r) => r.date).sort()[0];

/** Every date in [from, to], inclusive. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end) {
    out.push(dateKey(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** What the request is fixing, in plain words. */
export function correctionIssue(c: AttendanceCorrection, record?: AttendanceRecord): string {
  const current = record?.[c.field];
  const label = c.field === 'checkOut' ? 'check-out' : 'check-in';
  return current ? `Wrong ${label} time` : `Missing ${label}`;
}

/**
 * Apply an approved correction to the day's single record (creating it if the day had none).
 * The original punches are frozen on first correction and the change is appended as an
 * amendment — the previous value is never lost.
 */
export function applyCorrection(
  record: AttendanceRecord | undefined, c: AttendanceCorrection, approvedBy: string, approvedAt: string
): AttendanceRecord {
  const base: AttendanceRecord = record ?? { id: `att-${c.staffName}-${c.date}`, staffName: c.staffName, branch: c.branch, date: c.date };
  const to = `${c.date} ${c.requestedTime}`;
  return {
    ...base,
    original: base.original ?? { checkIn: base.checkIn, checkOut: base.checkOut },
    [c.field]: to,
    amendments: [
      ...(base.amendments ?? []),
      {
        id: `amd-${c.id}`,
        correctionId: c.id,
        field: c.field,
        from: base[c.field],
        to,
        reason: c.reason,
        requestedBy: c.requestedBy ?? c.staffName,
        requestedAt: c.requestedAt,
        approvedBy,
        approvedAt,
      },
    ],
  };
}

export const activeStaff = (staff: StaffMember[]) => staff.filter((s) => s.status === 'Active' && s.role !== 'Super Admin');

/** Month key "2026-09" → every date of that month up to today. */
export function monthDates(month: string, today: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const last = dateKey(new Date(y, m, 0));
  return datesBetween(`${month}-01`, last < today ? last : today);
}

/** Props every HRM Attendance view takes. */
export interface AttendanceViewProps {
  currentUser: MockUser;
  /** Branch staff. */
  staff: StaffMember[];
  attendance: AttendanceRecord[];
  corrections: AttendanceCorrection[];
  leave: LeaveRecord[];
  /** Holidays that apply to this branch. */
  holidays: Holiday[];
  intent?: NavIntent;
  onSaveAttendance: (record: AttendanceRecord) => void;
  onAddCorrection: (correction: AttendanceCorrection) => void;
  onUpdateCorrection: (id: string, updates: Partial<AttendanceCorrection>) => void;
  onNavigate: (key: string, intent?: NavIntent) => void;
}

/** A correction raised by a manager on an employee's behalf — still needs approval. */
export function managerCorrection(
  requester: MockUser, staffName: string, date: string, field: AttendanceCorrection['field'], time: string, reason: string
): AttendanceCorrection {
  return {
    id: `corr-${Date.now()}`, staffName, branch: requester.branch, date, field, requestedTime: time, reason,
    requestedAt: formatSubmittedAt(new Date()), requestedBy: requester.name, status: 'Pending',
  };
}

// ─── Late & Absence ─────────────────────────────────────────────────────────

/** Minutes after the scheduled start the person checked in (0 if on or before time). */
export function delayMinutes(record?: AttendanceRecord): number {
  const d = record?.checkIn ? parseSubmittedAt(record.checkIn) : null;
  return d ? Math.max(0, minutesOfDay(d) - SHIFT_START_MINUTES) : 0;
}

export const EXPLANATION_REASONS: ExplanationReason[] = ['Traffic', 'Medical', 'Work-related', 'Family / Personal', 'Other'];

/** Where an exception stands, from the manager's point of view. */
export type ExceptionState = 'Unexplained' | 'Unconfirmed' | 'Awaiting employee' | 'Needs review' | 'Excused' | 'Unexcused' | 'Approved leave';

export const EXCEPTION_STYLES: Record<ExceptionState, string> = {
  Unexplained: 'bg-amber-50 text-amber-700',
  Unconfirmed: 'bg-red-50 text-red-700',
  'Awaiting employee': 'bg-amber-50 text-amber-700',
  'Needs review': 'bg-blue-50 text-blue-700',
  Excused: 'bg-emerald-50 text-emerald-700',
  Unexcused: 'bg-red-50 text-red-700',
  'Approved leave': 'bg-emerald-50 text-emerald-700',
};

export function exceptionState(kind: 'Late' | 'Absence', explanation?: AttendanceExplanation, leave?: LeaveRecord): ExceptionState {
  if (leave) return 'Approved leave';
  if (!explanation) return kind === 'Late' ? 'Unexplained' : 'Unconfirmed';
  if (explanation.status === 'Requested') return 'Awaiting employee';
  if (explanation.status === 'Submitted') return 'Needs review';
  return explanation.status === 'Accepted' ? 'Excused' : 'Unexcused';
}
