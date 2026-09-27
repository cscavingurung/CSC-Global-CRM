// Graphics Designer — the design data boundary.
//
// The designer works a production queue and nothing else. App.tsx builds this projection from the
// Marketing store and passes ONLY it to the Designer module: design and video tasks, what's going
// out, what's been done, and which branch material is still on its way. No leads, clients,
// applications, visas, finance, HR, analytics, campaigns or ad budgets ever reach the designer —
// not even as ids (campaign ids are stripped).
import { DesignTask, MarketingStore, VideoTask } from './types';
import { toDate } from './marketingDept';

export interface ScheduledItem {
  id: string;
  title: string;
  platform: string;
  type: string;
  /** "YYYY-MM-DD" or a "YYYY-MM-DD h:mm AM/PM" stamp. */
  date: string;
  status: 'Scheduled' | 'Approved';
}

export interface HistoryItem {
  id: string;
  title: string;
  date: string;
  platform: string;
  type: string;
  designer: string;
  status: 'Published' | 'Approved' | 'Completed' | 'Scheduled';
  link?: string;
}

export interface MaterialOnTheWay {
  id: string;
  topic: string;
  needed: string;
  deadline: string;
  branch: string;
}

export interface DesignerData {
  designTasks: DesignTask[];
  videoTasks: VideoTask[];
  schedule: ScheduledItem[];
  history: HistoryItem[];
  waitingMaterial: MaterialOnTheWay[];
}

const typeFor = (platform: string, fallback = 'Post') => (platform === 'TikTok' || platform === 'YouTube' ? 'Video' : fallback);
const key = (t: string) => t.trim().toLowerCase();

export function designerView(store: MarketingStore): DesignerData {
  const strip = <T extends { campaignId?: string }>(t: T): T => ({ ...t, campaignId: undefined });
  const designById = new Map(store.designTasks.map((d) => [d.id, d]));
  const itemById = new Map(store.contentItems.map((c) => [c.id, c]));

  // What's going out: scheduled posts, scheduled calendar pieces, and approved designs awaiting a date.
  const schedule: ScheduledItem[] = [];
  const seen = new Set<string>();
  const push = (s: ScheduledItem) => { if (!seen.has(key(s.title))) { seen.add(key(s.title)); schedule.push(s); } };
  store.posts.filter((p) => p.status === 'Scheduled').forEach((p) => {
    const d = p.designTaskId ? designById.get(p.designTaskId) : undefined;
    push({ id: p.id, title: d?.title ?? p.caption, platform: p.platform, type: d?.type ?? typeFor(p.platform), date: p.scheduledAt, status: 'Scheduled' });
  });
  store.contentItems.filter((c) => c.status === 'Scheduled').forEach((c) => {
    push({ id: c.id, title: c.title, platform: c.platform, type: typeFor(c.platform), date: c.deadline, status: 'Scheduled' });
  });
  store.designTasks.filter((d) => d.stage === 'Scheduled').forEach((d) => {
    push({ id: d.id, title: d.title, platform: d.platform, type: d.type ?? 'Post', date: d.deadline, status: 'Scheduled' });
  });
  store.designTasks.filter((d) => d.stage === 'Approved').forEach((d) => {
    push({ id: d.id, title: d.title, platform: d.platform, type: d.type ?? 'Post', date: d.deadline, status: 'Approved' });
  });
  schedule.sort((a, b) => (toDate(a.date)?.getTime() ?? 0) - (toDate(b.date)?.getTime() ?? 0));

  // Completed work. A task whose calendar piece has been published shows as Published, with its link.
  const history: HistoryItem[] = [];
  const done = new Set<string>();
  const addHistory = (h: HistoryItem) => { if (!done.has(key(h.title))) { done.add(key(h.title)); history.push(h); } };
  const lastFile = (files?: { uploadedAt: string }[]) => files?.[files.length - 1]?.uploadedAt;
  store.videoTasks.filter((v) => v.status === 'Completed').forEach((v) => {
    const item = v.contentItemId ? itemById.get(v.contentItemId) : undefined;
    addHistory({
      id: v.id, title: v.title, date: item?.publishedAt ?? v.completedAt ?? v.deadline, platform: v.platform, type: 'Video',
      designer: v.assignee ?? '—', status: item?.status === 'Published' ? 'Published' : 'Completed', link: item?.publishedLink,
    });
  });
  store.designTasks.filter((d) => d.stage === 'Approved' || d.stage === 'Scheduled').forEach((d) => {
    const item = d.contentItemId ? itemById.get(d.contentItemId) : undefined;
    addHistory({
      id: d.id, title: d.title, date: item?.publishedAt ?? lastFile(d.finalFiles) ?? d.deadline, platform: d.platform, type: d.type ?? 'Post',
      designer: d.assignee ?? '—', status: item?.status === 'Published' ? 'Published' : d.stage as 'Approved' | 'Scheduled', link: item?.publishedLink,
    });
  });
  store.contentItems.filter((c) => c.status === 'Published').forEach((c) => {
    addHistory({ id: c.id, title: c.title, date: c.publishedAt ?? c.deadline, platform: c.platform, type: typeFor(c.platform), designer: c.assignee, status: 'Published', link: c.publishedLink });
  });
  history.sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0));

  return {
    designTasks: store.designTasks.map(strip),
    videoTasks: store.videoTasks,
    schedule,
    history,
    waitingMaterial: store.contentRequests
      .filter((r) => r.status === 'Waiting')
      .map((r) => ({ id: r.id, topic: r.topic, needed: r.needed, deadline: r.deadline, branch: r.targetBranch })),
  };
}
