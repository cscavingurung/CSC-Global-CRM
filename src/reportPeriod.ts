// Shared time-window options for the dashboard report filters.
export type PeriodKey = 'today' | '7d' | '30d' | '6m' | '1y' | 'all';

export interface PeriodOption {
  key: PeriodKey;
  label: string;
  // Short suffix used inside stat card labels, e.g. "Total Clients This Month".
  suffix: string;
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { key: 'today', label: 'Today', suffix: 'Today' },
  { key: '7d', label: '7 Days', suffix: 'Last 7 Days' },
  { key: '30d', label: '30 Days', suffix: 'Last 30 Days' },
  { key: '6m', label: '6 Months', suffix: 'Last 6 Months' },
  { key: '1y', label: '1 Year', suffix: 'Last 12 Months' },
  { key: 'all', label: 'All Time', suffix: 'All Time' },
];

// Start of the selected window, measured back from `now`. `null` means "no lower bound".
export function periodStart(key: PeriodKey, now: Date): Date | null {
  const d = new Date(now.getTime());
  switch (key) {
    case 'today':
      d.setHours(0, 0, 0, 0);
      return d;
    case '7d':
      d.setDate(d.getDate() - 7);
      return d;
    case '30d':
      d.setDate(d.getDate() - 30);
      return d;
    case '6m':
      d.setMonth(d.getMonth() - 6);
      return d;
    case '1y':
      d.setFullYear(d.getFullYear() - 1);
      return d;
    case 'all':
      return null;
  }
}

export function periodSuffix(key: PeriodKey): string {
  return PERIOD_OPTIONS.find((o) => o.key === key)?.suffix ?? '';
}
