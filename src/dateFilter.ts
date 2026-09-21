export function matchesDateRange(dateValue: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!dateValue) return false;
  const date = dateValue.slice(0, 10);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}
