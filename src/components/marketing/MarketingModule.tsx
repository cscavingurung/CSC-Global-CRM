import { useMemo } from 'react';
import { BranchPing, ContentItem, ContentRequest, DesignTask, MarketingLead, MarketingRole, MarketingStore, NavIntent } from '../../types';
import { LeadTrack, isoToday } from '../../marketingDept';
import { formatSubmittedAt } from '../../dateTime';
import { MarketingActions, MarketingContext, MarketingContextValue } from './mktContext';
import { MARKETING_PAGES } from './mktPages';

interface MarketingModuleProps {
  activeKey: string;
  me: string;
  role?: MarketingRole;
  store: MarketingStore;
  setStore: React.Dispatch<React.SetStateAction<MarketingStore>>;
  /** Whitelisted pipeline rows only (marketingDept.trackMarketingLeads) — never raw branch records. */
  tracks: LeadTrack[];
  branches: string[];
  contributorsByBranch: Record<string, { name: string; role: string }[]>;
  team: { name: string; role: MarketingRole }[];
  /** Creates the lead in the branch's CRM queue and returns the new intake id. */
  onPushToBranch: (lead: MarketingLead, branch: string) => string;
  /** Creates the lead in the city's shared, unclaimed pool and returns the new intake id. */
  onPushToCityPool: (lead: MarketingLead, city: string) => string;
  /** Notifies the target Branch Manager and counselor of a content request (new, reminder or send-back). */
  onContentRequest: (req: ContentRequest, kind?: 'new' | 'reminder' | 'reopened') => void;
  /** Sends a Leads Specialist's escalation to that branch's Branch Manager. */
  onPingBranch: (ping: BranchPing, message: string) => void;
  /** A design/video task was just assigned to a team member — notify them to start work. */
  onTaskAssigned?: (kind: 'design' | 'video', title: string, assignee: string, deadline: string) => void;
  /** A design/video task was approved/marked complete — notify the assignee it's done. */
  onTaskDone?: (kind: 'design' | 'video', title: string, assignee: string) => void;
  onNavigate: (key: string, intent?: NavIntent) => void;
  preset?: string;
}

let seq = 0;
/** "60-second video" → "60 sec"; anything else is passed through. */
const durationOf = (needed: string) => needed.match(/(\d+)\s*-?\s*second/i)?.[1] ? `${needed.match(/(\d+)\s*-?\s*second/i)![1]} sec` : 'As briefed';
/** A calendar piece whose design/edit was approved becomes Ready (unless it already moved on). */
const readyItem = (items: ContentItem[], id: string) =>
  items.map((c) => (c.id === id && (c.status === 'Idea' || c.status === 'In Progress') ? { ...c, status: 'Ready' as const } : c));
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`;

export default function MarketingModule({
  activeKey, me, role = 'Marketing Manager', store, setStore, tracks, branches, contributorsByBranch, team,
  onPushToBranch, onPushToCityPool, onContentRequest, onPingBranch, onTaskAssigned, onTaskDone, onNavigate, preset,
}: MarketingModuleProps) {
  const actions = useMemo<MarketingActions>(() => {
    const now = () => formatSubmittedAt(new Date());
    const patchLead = (id: string, patch: Partial<MarketingLead>) =>
      setStore((s) => ({ ...s, leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
    return {
      addLead: (lead, stage = 'Raw') => setStore((s) => ({
        ...s,
        leads: [{
          ...lead, id: newId('mkl'), receivedAt: now(), stage,
          ...(stage === 'Qualified' ? { qualifiedBy: me, qualifiedAt: now() } : {}),
        }, ...s.leads],
      })),
      addAndAssign: (fields, branch) => {
        const stamp = now();
        const lead: MarketingLead = {
          ...fields, id: newId('mkl'), receivedAt: stamp, stage: 'Qualified', preferredBranch: branch, qualifiedBy: me, qualifiedAt: stamp,
        };
        const intakeId = onPushToBranch(lead, branch);
        setStore((s) => ({ ...s, leads: [{ ...lead, stage: 'Assigned', assignedBy: me, assignedAt: stamp, intakeId }, ...s.leads] }));
      },
      qualifyLead: (id, fields) => patchLead(id, { ...fields, stage: 'Qualified', qualifiedBy: me, qualifiedAt: now(), disqualifyReason: undefined }),
      disqualifyLead: (id, reason) => patchLead(id, { stage: 'Disqualified', disqualifyReason: reason, qualifiedBy: me, qualifiedAt: now() }),
      assignLead: (id, branch, fields) => {
        const current = store.leads.find((l) => l.id === id);
        if (!current || (current.stage !== 'Qualified' && !(fields && current.stage === 'Raw'))) return;
        const stamp = now();
        const lead = { ...current, ...fields, preferredBranch: branch };
        // Leaves the Marketing inbox and becomes a New lead in the branch's CRM queue.
        const intakeId = onPushToBranch(lead, branch);
        patchLead(id, {
          ...fields, stage: 'Assigned', preferredBranch: branch, assignedBy: me, assignedAt: stamp, intakeId,
          ...(current.stage === 'Raw' ? { qualifiedBy: me, qualifiedAt: stamp } : {}),
        });
      },
      // City pool leads carry `cityPool` instead of `preferredBranch` — onPushToCityPool creates
      // them unclaimed and visible to every branch in that city, same as onPushToBranch does for
      // one branch, so they show up in "My Assigned Leads" once a counselor claims one.
      assignToCityPool: (id, city, fields) => {
        const current = store.leads.find((l) => l.id === id);
        if (!current || (current.stage !== 'Qualified' && !(fields && current.stage === 'Raw'))) return;
        const stamp = now();
        const lead = { ...current, ...fields, preferredBranch: undefined, cityPool: city };
        const intakeId = onPushToCityPool(lead, city);
        patchLead(id, {
          ...fields, stage: 'Assigned', preferredBranch: undefined, cityPool: city, assignedBy: me, assignedAt: stamp, intakeId,
          ...(current.stage === 'Raw' ? { qualifiedBy: me, qualifiedAt: stamp } : {}),
        });
      },
      addAndAssignToCityPool: (fields, city) => {
        const stamp = now();
        const lead: MarketingLead = {
          ...fields, id: newId('mkl'), receivedAt: stamp, stage: 'Qualified', cityPool: city, qualifiedBy: me, qualifiedAt: stamp,
        };
        const intakeId = onPushToCityPool(lead, city);
        setStore((s) => ({ ...s, leads: [{ ...lead, stage: 'Assigned', assignedBy: me, assignedAt: stamp, intakeId }, ...s.leads] }));
      },
      pingBranch: (branch, rule, leadIds, message) => {
        const ping: BranchPing = { id: newId('ping'), branch, rule, leadIds, at: now(), by: me };
        setStore((s) => ({ ...s, pings: [ping, ...s.pings] }));
        onPingBranch(ping, message);
      },
      createCampaign: (c) => setStore((s) => ({ ...s, campaigns: [...s.campaigns, { ...c, id: newId('cmp'), createdBy: me }] })),
      logAdSpend: (a) => setStore((s) => ({ ...s, adSpend: [...s.adSpend, { ...a, id: newId('ads'), loggedBy: me }] })),
      requestContent: (r) => {
        const req: ContentRequest = { ...r, id: newId('cr'), requestedBy: me, requestedAt: now(), status: 'Waiting' };
        setStore((s) => ({
          ...s,
          contentRequests: [req, ...s.contentRequests],
          // Requested from a calendar idea: the piece now shows who it's waiting on.
          contentItems: req.contentItemId
            ? s.contentItems.map((c) => (c.id === req.contentItemId ? { ...c, branch: req.targetBranch, person: req.targetCounselor, requestId: req.id } : c))
            : s.contentItems,
        }));
        onContentRequest(req);
      },
      markContentReceived: (id, materialLink, note) => setStore((s) => ({
        ...s,
        contentRequests: s.contentRequests.map((r) => (r.id === id
          ? { ...r, status: 'Received', receivedAt: now(), materialLink: materialLink || r.materialLink, receivedNote: note || undefined }
          : r)),
      })),
      remindContentRequest: (id) => {
        const req = store.contentRequests.find((r) => r.id === id);
        if (!req || req.status !== 'Waiting') return;
        setStore((s) => ({ ...s, contentRequests: s.contentRequests.map((r) => (r.id === id ? { ...r, reminders: [...(r.reminders ?? []), now()] } : r)) }));
        onContentRequest(req, 'reminder');
      },
      reopenContentRequest: (id, reason) => {
        const req = store.contentRequests.find((r) => r.id === id);
        if (!req || req.status !== 'Received') return;
        // The rejected material's link is dropped so the designer can never be sent it.
        const updated: ContentRequest = { ...req, status: 'Waiting', reopenReason: reason, receivedAt: undefined, receivedNote: undefined, materialLink: undefined };
        setStore((s) => ({ ...s, contentRequests: s.contentRequests.map((r) => (r.id === id ? updated : r)) }));
        onContentRequest(updated, 'reopened');
      },
      updateContentRequest: (id, patch) => setStore((s) => ({
        ...s, contentRequests: s.contentRequests.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      })),
      sendToDesigner: (requestId, designer, platform, deadline) => {
        setStore((s) => {
          const req = s.contentRequests.find((r) => r.id === requestId);
          if (!req || req.status !== 'Received') return s;
          const existing = req.contentItemId ? s.contentItems.find((c) => c.id === req.contentItemId) : undefined;
          const contentItemId = existing?.id ?? newId('ci');
          const designTaskId = newId('dt');
          const channel = (['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'Website'].includes(platform) ? platform : 'Instagram') as DesignTask['platform'];
          const isVideo = /video|reel|footage|clip/i.test(req.needed);
          const itemPatch = { assignee: designer, deadline, platform, status: 'In Progress' as const, branch: req.targetBranch, person: req.targetCounselor, requestId };
          return {
            ...s,
            contentRequests: s.contentRequests.map((r) => (r.id === requestId ? { ...r, status: 'Ready', contentItemId, designTaskId, sentToDesignerAt: now() } : r)),
            // A request raised from a calendar idea moves that same piece forward; otherwise a new piece is added.
            contentItems: existing
              ? s.contentItems.map((c) => (c.id === existing.id ? { ...c, ...itemPatch } : c))
              : [...s.contentItems, { id: contentItemId, title: req.topic, createdBy: me, ...itemPatch }],
            // Footage goes to the designer's Video Editing queue; photos and everything else to the Design Queue.
            ...(isVideo ? {
              videoTasks: [...s.videoTasks, {
                id: designTaskId, title: existing?.title ?? req.topic, status: 'To Edit' as const, priority: 'Medium' as const,
                platform: platform === 'YouTube' ? 'YouTube' as const : channel, duration: durationOf(req.needed), deadline,
                sourceLink: req.materialLink, requestedBy: me, assignee: designer, branch: req.targetBranch, person: req.targetCounselor,
                requestId, contentItemId, instructions: [req.notes, req.receivedNote].filter(Boolean).join(' ') || `Edit the ${req.needed.toLowerCase()} for ${platform}.`,
              }],
            } : {
              designTasks: [...s.designTasks, {
                id: designTaskId, title: existing?.title ?? req.topic, platform: channel, type: 'Post' as const, priority: 'Medium' as const,
                dimensions: channel === 'Website' ? '1920×600' : channel === 'TikTok' ? '1080×1920' : '1080×1350',
                brief: `Design from ${req.needed.toLowerCase()} by ${req.targetCounselor} (${req.targetBranch}).${req.notes ? ` ${req.notes}` : ''}`,
                assets: req.materialLink ? [{ name: `Material from ${req.targetCounselor}`, url: req.materialLink }] : undefined,
                deadline, stage: 'Requested' as const, requestedBy: me, assignee: designer, campaignId: req.campaignId, contentItemId,
              }],
            }),
          };
        });
        // Notify the designer/editor they've got new work — only when sent to someone other than self.
        const req = store.contentRequests.find((r) => r.id === requestId);
        if (req && req.status === 'Received' && designer !== me) {
          onTaskAssigned?.(/video|reel|footage|clip/i.test(req.needed) ? 'video' : 'design', req.topic, designer, deadline);
        }
      },
      addContentItem: (item) => setStore((s) => ({ ...s, contentItems: [...s.contentItems, { ...item, id: newId('ci'), createdBy: me }] })),
      updateContentItem: (id, patch) => setStore((s) => ({
        ...s,
        contentItems: s.contentItems.map((c) => (c.id !== id ? c : {
          ...c, ...patch,
          // Publishing stamps the date once; moving back out of Published clears it.
          publishedAt: (patch.status ?? c.status) === 'Published' ? c.publishedAt ?? patch.publishedAt ?? isoToday() : undefined,
        })),
      })),
      createDesignTask: (t) => setStore((s) => ({ ...s, designTasks: [...s.designTasks, { ...t, id: newId('dt'), requestedBy: me, stage: 'Requested' }] })),
      moveDesign: (id, stage, note) => {
        setStore((s) => {
          const task = s.designTasks.find((t) => t.id === id);
          return {
            ...s,
            designTasks: s.designTasks.map((t) => (t.id !== id ? t : {
              ...t, stage,
              reviewNote: note ?? (stage === 'In Progress' ? t.reviewNote : undefined),
            })),
            // Approving the design makes its Content Calendar piece Ready to schedule.
            contentItems: !task?.contentItemId ? s.contentItems
              : stage === 'Approved' ? readyItem(s.contentItems, task.contentItemId)
                // Scheduling the design schedules the piece too.
                : stage === 'Scheduled' ? s.contentItems.map((c) => (c.id === task.contentItemId && c.status !== 'Published' ? { ...c, status: 'Scheduled' as const } : c))
                  : s.contentItems,
          };
        });
        // Approval is the finish line for the designer's part of the work — let them know it landed.
        if (stage === 'Approved') {
          const task = store.designTasks.find((t) => t.id === id);
          if (task?.assignee && task.assignee !== me) onTaskDone?.('design', task.title, task.assignee);
        }
      },
      moveVideo: (id, status, note) => {
        setStore((s) => {
          const task = s.videoTasks.find((t) => t.id === id);
          return {
            ...s,
            videoTasks: s.videoTasks.map((t) => (t.id !== id ? t : {
              ...t, status, reviewNote: note ?? (status === 'In Progress' ? t.reviewNote : undefined),
              completedAt: status === 'Completed' ? now() : t.completedAt,
            })),
            contentItems: status === 'Completed' && task?.contentItemId ? readyItem(s.contentItems, task.contentItemId) : s.contentItems,
          };
        });
        if (status === 'Completed') {
          const task = store.videoTasks.find((t) => t.id === id);
          if (task?.assignee && task.assignee !== me) onTaskDone?.('video', task.title, task.assignee);
        }
      },
      schedulePost: (p) => setStore((s) => ({ ...s, posts: [...s.posts, { ...p, id: newId('p'), createdBy: me, status: 'Scheduled' }] })),
      publishPost: (id, metrics) => setStore((s) => ({
        ...s, posts: s.posts.map((p) => (p.id === id ? { ...p, ...metrics, status: 'Published', publishedAt: now() } : p)),
      })),
      addSeoTask: (t) => setStore((s) => ({ ...s, seoTasks: [...s.seoTasks, { ...t, id: newId('seo') }] })),
      setSeoStatus: (id, status) => setStore((s) => ({ ...s, seoTasks: s.seoTasks.map((t) => (t.id === id ? { ...t, status } : t)) })),
    };
  }, [
    store.leads, store.contentRequests, store.designTasks, store.videoTasks, setStore, me,
    onPushToBranch, onPushToCityPool, onContentRequest, onPingBranch, onTaskAssigned, onTaskDone,
  ]);

  const value: MarketingContextValue = {
    me, role, store, tracks, branches, contributorsByBranch, team, actions, preset,
    navigate: (key, p) => onNavigate(key, p ? { marketingPreset: p } : undefined),
  };
  const Page = MARKETING_PAGES[activeKey] ?? MARKETING_PAGES.overview;
  return (
    <MarketingContext.Provider value={value}>
      <Page />
    </MarketingContext.Provider>
  );
}
