import { useState } from 'react';
import { ContentRequest, ContentStatus, DesignStage, MarketingStore } from '../../types';
import { LeadTrack, isoToday, shortDay, toDate } from '../../marketingDept';

/** Waiting / Received / Ready, with Overdue for a Waiting request past its deadline. */
export const requestState = (r: ContentRequest, today = isoToday()): 'Waiting' | 'Overdue' | 'Received' | 'Ready' =>
  r.status === 'Waiting' && r.deadline < today ? 'Overdue' : r.status;
export const REQUEST_STYLES: Record<string, string> = {
  Waiting: 'bg-amber-50 text-amber-700', Overdue: 'bg-red-50 text-red-700',
  Received: 'bg-blue-50 text-blue-700', Ready: 'bg-emerald-50 text-emerald-700',
};

export const CONTENT_STATUSES: ContentStatus[] = ['Idea', 'In Progress', 'Ready', 'Scheduled', 'Published'];
export const CONTENT_STATUS_STYLES: Record<ContentStatus, string> = {
  Idea: 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-50 text-blue-700',
  Ready: 'bg-violet-50 text-violet-700',
  Scheduled: 'bg-navy/10 text-navy',
  Published: 'bg-emerald-50 text-emerald-700',
};
export const CONTENT_PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'Website'];
export const DESIGN_STYLES: Record<DesignStage, string> = {
  Requested: 'bg-amber-50 text-amber-700',
  'In Progress': 'bg-blue-50 text-blue-700',
  'Ready for Review': 'bg-violet-50 text-violet-700',
  Approved: 'bg-emerald-50 text-emerald-700',
  Scheduled: 'bg-navy/10 text-navy',
};

export function deadlineTone(deadline: string, done = false) {
  if (done) return 'text-gray-500';
  const today = isoToday();
  return deadline < today ? 'text-red-600 font-semibold' : deadline === today ? 'text-amber-700 font-semibold' : 'text-gray-500';
}
export function deadlineText(deadline: string) {
  const today = isoToday();
  return deadline < today ? `Overdue · ${shortDay(deadline)}` : deadline === today ? 'Due today' : `Due ${shortDay(deadline)}`;
}

export const COUNTRIES = ['Australia', 'Canada', 'United Kingdom', 'USA', 'New Zealand', 'Europe', 'Japan', 'Other'];

/** Stuck in the branch pipeline: past contact SLA, consultation not converting, or gone quiet. */
export const needsAttention = (t: LeadTrack) => t.slaBreached || t.consultationStuck || t.noActivity;

/**
 * Dashboard report-period filter (same windows as the Branch Manager / Counselor dashboards).
 * Leads are a cohort by the date they came in, and their branch outcomes follow them. Ad spend
 * counts by spend date. Work that is still open — unfinished designs, pending branch content,
 * posts still scheduled — always stays visible, so a short window never hides a live queue.
 */
export function storeForPeriod(store: MarketingStore, tracks: LeadTrack[], start: Date | null): { store: MarketingStore; tracks: LeadTrack[] } {
  if (!start) return { store, tracks };
  const inWindow = (v?: string) => { const d = toDate(v); return d !== null && d >= start; };
  const leads = store.leads.filter((l) => inWindow(l.receivedAt));
  const ids = new Set(leads.map((l) => l.id));
  return {
    store: {
      ...store,
      leads,
      adSpend: store.adSpend.filter((a) => inWindow(a.date)),
      contentRequests: store.contentRequests.filter((r) => r.status !== 'Ready' || inWindow(r.requestedAt)),
      contentItems: store.contentItems.filter((c) => c.status !== 'Published' || inWindow(c.publishedAt)),
      designTasks: store.designTasks.filter((t) => t.stage !== 'Scheduled' || inWindow(t.deadline)),
      posts: store.posts.filter((p) => p.status === 'Scheduled' || inWindow(p.publishedAt ?? p.scheduledAt)),
    },
    tracks: tracks.filter((t) => ids.has(t.leadId)),
  };
}

// ── Excel sheet view ────────────────────────────────────────────────────────
export type ViewMode = 'simple' | 'sheet';

export interface SheetColumn<T> {
  key: string;
  header: string;
  /** Cell value — what's filtered, sorted (unless `sort` is given) and downloaded. */
  value: (r: T) => string | number | null | undefined;
  /** Sort key when the display value doesn't sort naturally (e.g. "3:05 PM" stamps). */
  sort?: (r: T) => string | number | null | undefined;
  /** Rich cell (pill, button); falls back to `value`. */
  render?: (r: T) => React.ReactNode;
  numeric?: boolean;
  /** Sum this column in the footer. */
  total?: boolean;
  /** Hidden until switched on in the Columns menu. */
  hidden?: boolean;
  /** Long text — truncate with a tooltip. */
  wide?: boolean;
  /** Action cells (buttons) are left out of the download. */
  noExport?: boolean;
}

/** Simple / Excel sheet choice, remembered per page for this browser. */
export function useViewMode(page: string): [ViewMode, (v: ViewMode) => void] {
  const storageKey = `mkt-view:${page}`;
  const [mode, setMode] = useState<ViewMode>(() => {
    try { return localStorage.getItem(storageKey) === 'sheet' ? 'sheet' : 'simple'; } catch { return 'simple'; }
  });
  const set = (v: ViewMode) => {
    setMode(v);
    try { localStorage.setItem(storageKey, v); } catch { /* storage unavailable — keep in memory */ }
  };
  return [mode, set];
}

/** Sortable timestamp for "YYYY-MM-DD h:mm AM/PM" or ISO dates. */
export const stampSort = (v?: string) => toDate(v)?.getTime() ?? null;
