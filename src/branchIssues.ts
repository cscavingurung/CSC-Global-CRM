// Issue & Escalation Management helpers — priority rules, status pipeline and what needs the
// Branch Manager's attention.
import { BranchIssue, IssueCategory, MockUser, IssueEscalationReason, IssueEscalationTarget, IssueImpact, IssuePriority, IssueStatus } from './types';

export const ISSUE_CATEGORIES: IssueCategory[] = ['IT/System', 'Office/Facility', 'Client/Service', 'Staff/HR', 'Finance', 'Other'];
export const ISSUE_IMPACTS: IssueImpact[] = ['Just me', '2-3 staff', 'Most of the branch', 'Entire branch'];
export const ISSUE_PRIORITIES: IssuePriority[] = ['Critical', 'High', 'Normal'];
export const ISSUE_STATUSES: IssueStatus[] = ['Open', 'Assigned', 'In Progress', 'Waiting', 'Resolved', 'Closed'];
export const ESCALATION_REASONS: IssueEscalationReason[] = ['Cannot resolve', 'Requires manager decision', 'Urgent'];

/** Reporters never choose priority — it follows from how many people are blocked.
 * "Most of the branch" isn't in the original spec; it's treated as High (short of a full outage). */
export const IMPACT_PRIORITY: Record<IssueImpact, IssuePriority> = {
  'Just me': 'Normal',
  '2-3 staff': 'High',
  'Most of the branch': 'High',
  'Entire branch': 'Critical',
};

export const PRIORITY_STYLES: Record<IssuePriority, string> = {
  Critical: 'bg-red-50 text-red-700',
  High: 'bg-amber-50 text-amber-700',
  Normal: 'bg-emerald-50 text-emerald-700',
};

/** Coloured dot shown next to the priority — stands in for 🔴 / 🟠 / 🟢. */
export const PRIORITY_DOT: Record<IssuePriority, string> = {
  Critical: 'bg-red-500',
  High: 'bg-amber-500',
  Normal: 'bg-emerald-500',
};

export const STATUS_STYLES: Record<IssueStatus, string> = {
  Open: 'bg-blue-50 text-blue-700',
  Assigned: 'bg-indigo-50 text-indigo-700',
  'In Progress': 'bg-sky-50 text-sky-700',
  Waiting: 'bg-amber-50 text-amber-700',
  Resolved: 'bg-emerald-50 text-emerald-700',
  Closed: 'bg-gray-100 text-gray-600',
};

export const IT_SUPPORT = 'IT Support';

export const isActive = (i: BranchIssue) => i.status !== 'Resolved' && i.status !== 'Closed';

/** IT problems escalate to IT Support; everything else to the Branch Manager. */
export function escalationTargetFor(category: IssueCategory): IssueEscalationTarget {
  return category === 'IT/System' ? 'IT Support' : 'Branch Manager';
}

/** Resolved but can't be closed until the reporter confirms the fix. */
export const awaitingConfirmation = (i: BranchIssue) => i.status === 'Resolved' && !!i.requiresConfirmation && !i.reporterConfirmedAt;

export type AttentionReason = 'Escalated to you' | 'Critical' | 'Assigned to you' | 'Ready to close';

/** Why this issue belongs in the Branch Manager's "Needs My Attention" list, or null. */
export function attentionReason(i: BranchIssue, managerName: string): AttentionReason | null {
  if (isActive(i) && i.escalatedTo === 'Branch Manager') return 'Escalated to you';
  if (isActive(i) && i.priority === 'Critical') return 'Critical';
  if (isActive(i) && i.owner === managerName) return 'Assigned to you';
  if (i.status === 'Resolved' && !awaitingConfirmation(i)) return 'Ready to close';
  return null;
}

export interface NewIssueInput {
  title: string;
  category: IssueCategory;
  impact: IssueImpact;
  description: string;
  triedSoFar: string;
  attachments: string[];
}

/** A freshly reported issue — priority derived from impact, numbered after the branch's latest. */
export function buildIssue(input: NewIssueInput, reporter: MockUser, reporterRole: string, existing: BranchIssue[], at: string): BranchIssue {
  const priority = IMPACT_PRIORITY[input.impact];
  const nextNumber = Math.max(1000, ...existing.map((i) => Number(i.code.replace(/\D/g, '')) || 0)) + 1;
  const stamp = Date.now();
  return {
    id: `issue-${stamp}`,
    code: `ISS-${nextNumber}`,
    branch: reporter.branch,
    title: input.title.trim(),
    category: input.category,
    impact: input.impact,
    priority,
    description: input.description.trim(),
    triedSoFar: input.triedSoFar.trim(),
    attachments: input.attachments,
    reportedBy: reporter.name,
    reporterRole,
    reportedAt: at,
    status: 'Open',
    activity: [
      { id: `ia-${stamp}-0`, at, by: reporter.name, text: 'reported the issue', kind: 'reported' },
      { id: `ia-${stamp}-1`, at, by: reporter.name, text: `Priority set to ${priority} automatically (impact: ${input.impact.toLowerCase()})`, kind: 'status' },
    ],
  };
}
