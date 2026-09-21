import { Counselor, CounselorAvailability } from './types';

// Availability reflects whether a counselor can take a student right now. It's a real,
// live status — never derive or fake it from caseload size. There is no capacity cap: a
// counselor's active student count is purely informational context, not a constraint.
export const AVAILABILITY_STYLES: Record<CounselorAvailability, string> = {
  Available: 'bg-green-100 text-green-700',
  'In Session': 'bg-navy text-white',
  Away: 'bg-gray-100 text-gray-600',
};

const AVAILABILITY_ORDER: Record<CounselorAvailability, number> = {
  Available: 0,
  'In Session': 1,
  Away: 2,
};

export function sortByAvailability(counselors: Counselor[]): Counselor[] {
  return [...counselors].sort((a, b) => AVAILABILITY_ORDER[a.availability] - AVAILABILITY_ORDER[b.availability]);
}
