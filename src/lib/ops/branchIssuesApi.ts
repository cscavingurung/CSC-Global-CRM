import { supabase } from '../supabaseClient';
import { BranchIssue, IssueActivity } from '../../types';

export interface BranchIssueRow {
  id: string;
  code: string;
  branch: string;
  title: string;
  category: BranchIssue['category'];
  impact: BranchIssue['impact'];
  priority: BranchIssue['priority'];
  description: string;
  tried_so_far: string;
  attachments: string[];
  reported_by: string;
  reporter_role: string;
  reported_at: string;
  status: BranchIssue['status'];
  owner: string | null;
  escalated_to: BranchIssue['escalatedTo'] | null;
  escalation_reason: BranchIssue['escalationReason'] | null;
  resolution: string | null;
  requires_confirmation: boolean | null;
  reporter_confirmed_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  activity: IssueActivity[];
}

export function fromRow(row: BranchIssueRow): BranchIssue {
  return {
    id: row.id,
    code: row.code,
    branch: row.branch,
    title: row.title,
    category: row.category,
    impact: row.impact,
    priority: row.priority,
    description: row.description,
    triedSoFar: row.tried_so_far,
    attachments: row.attachments,
    reportedBy: row.reported_by,
    reporterRole: row.reporter_role,
    reportedAt: row.reported_at,
    status: row.status,
    owner: row.owner ?? undefined,
    escalatedTo: row.escalated_to ?? undefined,
    escalationReason: row.escalation_reason ?? undefined,
    resolution: row.resolution ?? undefined,
    requiresConfirmation: row.requires_confirmation ?? undefined,
    reporterConfirmedAt: row.reporter_confirmed_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    closedAt: row.closed_at ?? undefined,
    activity: row.activity,
  };
}

function toRow(issue: BranchIssue): BranchIssueRow {
  return {
    id: issue.id,
    code: issue.code,
    branch: issue.branch,
    title: issue.title,
    category: issue.category,
    impact: issue.impact,
    priority: issue.priority,
    description: issue.description,
    tried_so_far: issue.triedSoFar,
    attachments: issue.attachments,
    reported_by: issue.reportedBy,
    reporter_role: issue.reporterRole,
    reported_at: issue.reportedAt,
    status: issue.status,
    owner: issue.owner ?? null,
    escalated_to: issue.escalatedTo ?? null,
    escalation_reason: issue.escalationReason ?? null,
    resolution: issue.resolution ?? null,
    requires_confirmation: issue.requiresConfirmation ?? null,
    reporter_confirmed_at: issue.reporterConfirmedAt ?? null,
    resolved_at: issue.resolvedAt ?? null,
    closed_at: issue.closedAt ?? null,
    activity: issue.activity,
  };
}

function toRowUpdates(updates: Partial<BranchIssue>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.code !== undefined) row.code = updates.code;
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.category !== undefined) row.category = updates.category;
  if (updates.impact !== undefined) row.impact = updates.impact;
  if (updates.priority !== undefined) row.priority = updates.priority;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.triedSoFar !== undefined) row.tried_so_far = updates.triedSoFar;
  if (updates.attachments !== undefined) row.attachments = updates.attachments;
  if (updates.reportedBy !== undefined) row.reported_by = updates.reportedBy;
  if (updates.reporterRole !== undefined) row.reporter_role = updates.reporterRole;
  if (updates.reportedAt !== undefined) row.reported_at = updates.reportedAt;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.owner !== undefined) row.owner = updates.owner;
  if (updates.escalatedTo !== undefined) row.escalated_to = updates.escalatedTo;
  if (updates.escalationReason !== undefined) row.escalation_reason = updates.escalationReason;
  if (updates.resolution !== undefined) row.resolution = updates.resolution;
  if (updates.requiresConfirmation !== undefined) row.requires_confirmation = updates.requiresConfirmation;
  if (updates.reporterConfirmedAt !== undefined) row.reporter_confirmed_at = updates.reporterConfirmedAt;
  if (updates.resolvedAt !== undefined) row.resolved_at = updates.resolvedAt;
  if (updates.closedAt !== undefined) row.closed_at = updates.closedAt;
  if (updates.activity !== undefined) row.activity = updates.activity;
  return row;
}

export async function fetchBranchIssues(): Promise<BranchIssue[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('branch_issues').select('*').order('reported_at', { ascending: false });
  if (error) throw error;
  return (data as BranchIssueRow[]).map(fromRow);
}

export async function insertBranchIssue(issue: BranchIssue): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branch_issues').insert(toRow(issue));
  if (error) throw error;
}

export async function updateBranchIssue(id: string, updates: Partial<BranchIssue>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branch_issues').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}
