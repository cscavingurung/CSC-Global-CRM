// Graphics Designer routes — the route table and the context every routed page reads through
// the layout's <Outlet context>.
import { useOutletContext } from 'react-router-dom';
import { DeliveredFile, DesignStage, VideoStatus } from '../../types';
import { DesignerData } from '../../designerData';

/** What the designer may change: their own progress and the files they deliver. Approval and
 * scheduling belong to the Marketing Manager / Content Planner (App.tsx enforces this too). */
export interface DesignerActions {
  updateDesign: (id: string, patch: { stage?: Extract<DesignStage, 'In Progress' | 'Ready for Review'>; finalFiles?: DeliveredFile[] }) => void;
  updateVideo: (id: string, patch: { status?: Extract<VideoStatus, 'In Progress' | 'Ready for Review'>; finalFiles?: DeliveredFile[] }) => void;
}

export interface DesignerContext {
  me: string;
  data: DesignerData;
  actions: DesignerActions;
  /** Move to another section, optionally opening a task there. */
  go: (path: string, openId?: string) => void;
  /** Task id to open on arrival (from a dashboard link). */
  openId?: string;
  flash: (message: string) => void;
}

export const useDesigner = () => useOutletContext<DesignerContext>();

export const DESIGNER_BASE = '/marketing/designer';

/** Sub-tabs, in order. `path` is relative to DESIGNER_BASE ('' is the index route); `navKey` is the
 * matching sidebar tab for the Graphics Designer. */
export const DESIGNER_ROUTES = [
  { path: '', navKey: 'overview', label: 'Dashboard' },
  { path: 'designs', navKey: 'gd-designs', label: 'Design Queue' },
  { path: 'videos', navKey: 'gd-videos', label: 'Video Editing' },
  { path: 'scheduled', navKey: 'gd-scheduled', label: 'Scheduled Posts' },
  { path: 'history', navKey: 'gd-history', label: 'Content History' },
] as const;

export const DESIGNER_NAV_KEYS: string[] = DESIGNER_ROUTES.map((r) => r.navKey);

export const designerPath = (sub: string) => (sub ? `${DESIGNER_BASE}/${sub}` : DESIGNER_BASE);

/** Route for a sidebar key (or a sub-path). */
export function designerPathFor(view?: string): string {
  const r = DESIGNER_ROUTES.find((x) => x.navKey === view || x.path === view);
  return designerPath(r?.path ?? '');
}

/** Sidebar key for a route. */
export const designerNavKeyFor = (pathname: string) =>
  DESIGNER_ROUTES.find((r) => designerPath(r.path) === pathname.replace(/\/$/, ''))?.navKey ?? 'overview';

// ── Shared look ─────────────────────────────────────────────────────────────
export const VIDEO_STATUSES: VideoStatus[] = ['To Edit', 'In Progress', 'Ready for Review', 'Completed'];
export const DESIGN_STATUSES: DesignStage[] = ['Requested', 'In Progress', 'Ready for Review', 'Approved', 'Scheduled'];

export const VIDEO_STYLES: Record<VideoStatus, string> = {
  'To Edit': 'bg-amber-50 text-amber-700',
  'In Progress': 'bg-blue-50 text-blue-700',
  'Ready for Review': 'bg-violet-50 text-violet-700',
  Completed: 'bg-emerald-50 text-emerald-700',
};
export const PRIORITY_STYLES: Record<string, string> = {
  High: 'bg-red-50 text-red-700', Medium: 'bg-amber-50 text-amber-700', Low: 'bg-gray-100 text-gray-600',
};
export const TYPE_STYLES: Record<string, string> = {
  Post: 'bg-blue-50 text-blue-700', Story: 'bg-pink-50 text-pink-700', Reel: 'bg-teal-50 text-teal-700',
  Poster: 'bg-violet-50 text-violet-700', Video: 'bg-teal-50 text-teal-700',
};
export const HISTORY_STYLES: Record<string, string> = {
  Published: 'bg-emerald-50 text-emerald-700', Completed: 'bg-emerald-50 text-emerald-700',
  Approved: 'bg-blue-50 text-blue-700', Scheduled: 'bg-navy/10 text-navy',
};

export const priorityRank = (p?: string) => (p === 'High' ? 0 : p === 'Medium' ? 1 : 2);

export function fileSize(bytes?: number): string {
  if (bytes === undefined) return 'Link';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
