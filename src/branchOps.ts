// Branch Operations Control — shift rules, auto attendance status and the opening/closing
// checklists. Checklist items that fail can raise an Issue pre-filled from `issue`.
import { AttendanceStatus, IssueCategory, IssueImpact } from './types';
import { parseSubmittedAt } from './dateTime';

/** Shift starts 9:00 AM. Up to 10 min is On Time, up to 30 min Late, anything later Very Late. */
export const SHIFT_START_MINUTES = 9 * 60;
export const ON_TIME_GRACE = 10;
export const LATE_LIMIT = 30;
export const SHIFT_LABEL = '9:00 AM – 6:00 PM';
/** Saturday is the weekly day off. */
export const isWorkingDay = (d: Date) => d.getDay() !== 6;
/** Before this hour the dashboard leads with the opening checklist; from it, the closing one. */
export const CLOSING_FROM_HOUR = 16;

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function attendanceStatus(checkIn: string): AttendanceStatus | null {
  const d = parseSubmittedAt(checkIn);
  if (!d) return null;
  const late = minutesOfDay(d) - SHIFT_START_MINUTES;
  if (late <= ON_TIME_GRACE) return 'On Time';
  if (late <= LATE_LIMIT) return 'Late';
  return 'Very Late';
}

export const ATTENDANCE_STYLES: Record<AttendanceStatus, string> = {
  'On Time': 'bg-emerald-50 text-emerald-700',
  Late: 'bg-amber-50 text-amber-700',
  'Very Late': 'bg-red-50 text-red-700',
};

/** "2026-09-26 9:24 AM" → "9:24 AM" */
export const timeOf = (stamp?: string) => stamp?.split(' ').slice(1).join(' ') ?? '';

// ─── Checklists ─────────────────────────────────────────────────────────────

/** Items the system checks itself rather than a person ticking them. */
export type AutoCheck = 'crm' | 'staff-present' | 'tasks-assigned' | 'tasks-reviewed' | 'staff-checked-out';

export interface ChecklistItem {
  id: string;
  label: string;
  auto?: AutoCheck;
  /** Pre-fill for "Report an Issue" when this item is marked ❌. */
  issue?: { category: IssueCategory; impact: IssueImpact; title: string };
}

export interface ChecklistGroup {
  label: string;
  items: ChecklistItem[];
}

export const OPENING_CHECKLIST: ChecklistGroup[] = [
  {
    label: 'Office',
    items: [
      { id: 'lights', label: 'Lights & power on', issue: { category: 'Office/Facility', impact: 'Entire branch', title: 'Power / lighting problem in the branch' } },
      { id: 'ac', label: 'AC / fans working', issue: { category: 'Office/Facility', impact: '2-3 staff', title: 'AC / fans not working' } },
      { id: 'clean', label: 'Office & waiting area clean', issue: { category: 'Office/Facility', impact: 'Just me', title: 'Office or waiting area not cleaned' } },
    ],
  },
  {
    label: 'Technology',
    items: [
      { id: 'internet', label: 'Internet connected', issue: { category: 'IT/System', impact: 'Entire branch', title: 'Internet down at the branch' } },
      { id: 'printer', label: 'Printers working', issue: { category: 'IT/System', impact: '2-3 staff', title: 'Printer not working' } },
      { id: 'crm', label: 'CRM system', auto: 'crm', issue: { category: 'IT/System', impact: 'Entire branch', title: 'CRM not loading' } },
    ],
  },
  {
    label: 'Reception',
    items: [
      { id: 'desk', label: 'Front desk staffed & ready', issue: { category: 'Staff/HR', impact: '2-3 staff', title: 'Front desk not staffed at opening' } },
      { id: 'visitor-log', label: 'Visitor log & sign-in ready', issue: { category: 'Office/Facility', impact: 'Just me', title: 'Visitor sign-in not ready' } },
      { id: 'appointments', label: 'Today’s client appointments reviewed', issue: { category: 'Client/Service', impact: '2-3 staff', title: 'Client appointment clash today' } },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'staff-present', label: 'Staff present', auto: 'staff-present' },
      { id: 'tasks-assigned', label: 'Today’s tasks assigned', auto: 'tasks-assigned' },
      { id: 'cash-float', label: 'Cash float counted', issue: { category: 'Finance', impact: 'Just me', title: 'Cash float does not match' } },
    ],
  },
];

export const CLOSING_CHECKLIST: ChecklistGroup[] = [
  {
    label: 'Operations',
    items: [
      { id: 'visitors', label: 'All visitors handled' },
      { id: 'tasks-reviewed', label: 'Today’s tasks reviewed', auto: 'tasks-reviewed' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'collections', label: 'Today’s collections recorded' },
      { id: 'cash-safe', label: 'Cash deposited or locked in the safe' },
    ],
  },
  {
    label: 'Office',
    items: [
      { id: 'secured', label: 'Windows & doors locked' },
      { id: 'power-off', label: 'Lights, AC & equipment off' },
    ],
  },
  {
    label: 'Staff',
    items: [{ id: 'staff-out', label: 'All staff checked out', auto: 'staff-checked-out' }],
  },
];

export const manualItems = (groups: ChecklistGroup[]) => groups.flatMap((g) => g.items).filter((i) => !i.auto);
