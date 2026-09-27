import { createContext, useContext } from 'react';
import {
  AdSpend, BranchPing, Campaign, ContentItem, ContentRequest, DesignStage, DesignTask, MarketingLead, MarketingRole, MarketingStore,
  SeoTask, SocialPost, VideoStatus,
} from '../../types';
import { LeadTrack } from '../../marketingDept';

/** Everything the Add / Qualify Lead form captures. */
export type QualifyFields = Pick<MarketingLead,
  | 'name' | 'phone' | 'email' | 'preferredCountry' | 'interestedProgram' | 'intake' | 'academicBackground'
  | 'englishTest' | 'preferredBranch' | 'source' | 'campaignId' | 'notes'>;

export interface MarketingActions {
  /** Adds to the inbox — Raw, or Qualified when the qualification fields are complete. */
  addLead: (lead: Omit<MarketingLead, 'id' | 'receivedAt' | 'stage'>, stage?: 'Raw' | 'Qualified') => void;
  /** Manual entry that goes straight out to a branch. */
  addAndAssign: (fields: Omit<MarketingLead, 'id' | 'receivedAt' | 'stage'>, branch: string) => void;
  qualifyLead: (id: string, fields: QualifyFields) => void;
  disqualifyLead: (id: string, reason: string) => void;
  /** Assigns a Qualified lead — or, with `fields`, qualifies a Raw one and assigns it in one go. */
  assignLead: (id: string, branch: string, fields?: QualifyFields) => void;
  /** Flag stuck leads to the Branch Manager of `branch`. */
  pingBranch: (branch: string, rule: BranchPing['rule'], leadIds: string[], message: string) => void;
  createCampaign: (c: Omit<Campaign, 'id' | 'createdBy'>) => void;
  logAdSpend: (a: Omit<AdSpend, 'id' | 'loggedBy'>) => void;
  requestContent: (r: Omit<ContentRequest, 'id' | 'requestedBy' | 'requestedAt' | 'status'>) => void;
  markContentReceived: (id: string, materialLink?: string, note?: string) => void;
  /** Nudge the counselor (and their Branch Manager) about a Waiting request. */
  remindContentRequest: (id: string) => void;
  /** Received material wasn't usable — back to Waiting with the reason, counselor notified. */
  reopenContentRequest: (id: string, reason: string) => void;
  updateContentRequest: (id: string, patch: Partial<Pick<ContentRequest, 'deadline' | 'needed' | 'notes' | 'targetCounselor'>>) => void;
  /** Received branch material → a design task for the designer + an In Progress calendar item. */
  sendToDesigner: (requestId: string, designer: string, platform: string, deadline: string) => void;
  addContentItem: (item: Omit<ContentItem, 'id' | 'createdBy'>) => void;
  updateContentItem: (id: string, patch: Partial<Omit<ContentItem, 'id'>>) => void;
  createDesignTask: (t: Omit<DesignTask, 'id' | 'requestedBy' | 'stage'>) => void;
  moveDesign: (id: string, stage: DesignStage, note?: string) => void;
  /** Review a video edit: approve (Completed) or send back (In Progress, with a note). */
  moveVideo: (id: string, status: VideoStatus, note?: string) => void;
  schedulePost: (p: Omit<SocialPost, 'id' | 'createdBy' | 'status'>) => void;
  publishPost: (id: string, metrics: Pick<SocialPost, 'reach' | 'engagements' | 'leads'>) => void;
  addSeoTask: (t: Omit<SeoTask, 'id'>) => void;
  setSeoStatus: (id: string, status: SeoTask['status']) => void;
}

export interface MarketingContextValue {
  me: string;
  role: MarketingRole;
  store: MarketingStore;
  /** Whitelisted branch-pipeline view of assigned leads — see marketingDept.ts. */
  tracks: LeadTrack[];
  branches: string[];
  /** Active counselor names per branch, for content requests. Names only. */
  /** Branch staff Marketing can ask for content — counselors and Front Desk Officers. */
  contributorsByBranch: Record<string, { name: string; role: string }[]>;
  /** Marketing Department staff and their sub-roles — for assignee pickers. */
  team: { name: string; role: MarketingRole }[];
  actions: MarketingActions;
  /** Go to another marketing page, optionally preselecting a filter or form there. */
  navigate: (key: string, preset?: string) => void;
  /** Preset handed to this page by the last navigate() call. */
  preset?: string;
}

export const MarketingContext = createContext<MarketingContextValue | null>(null);

export function useMarketing(): MarketingContextValue {
  const ctx = useContext(MarketingContext);
  if (!ctx) throw new Error('useMarketing must be used inside MarketingModule');
  return ctx;
}
