import { supabase } from '../supabaseClient';
import { ContentRequest } from '../../types';

export interface ContentRequestRow {
  id: string;
  topic: string;
  target_branch: string;
  target_counselor: string;
  needed: string;
  deadline: string;
  notes: string | null;
  campaign_id: string | null;
  requested_by: string;
  requested_at: string;
  status: ContentRequest['status'];
  received_at: string | null;
  material_link: string | null;
  received_note: string | null;
  reminders: string[] | null;
  submitted_files: ContentRequest['submittedFiles'] | null;
  submitted_by: string | null;
  reopen_reason: string | null;
  sent_to_designer_at: string | null;
  content_item_id: string | null;
  design_task_id: string | null;
  delegated_by: string | null;
  delegated_at: string | null;
  internal_due: string | null;
  delegation_note: string | null;
}

export function fromRow(row: ContentRequestRow): ContentRequest {
  return {
    id: row.id,
    topic: row.topic,
    targetBranch: row.target_branch,
    targetCounselor: row.target_counselor,
    needed: row.needed,
    deadline: row.deadline,
    notes: row.notes ?? undefined,
    campaignId: row.campaign_id ?? undefined,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    status: row.status,
    receivedAt: row.received_at ?? undefined,
    materialLink: row.material_link ?? undefined,
    receivedNote: row.received_note ?? undefined,
    reminders: row.reminders ?? undefined,
    submittedFiles: row.submitted_files ?? undefined,
    submittedBy: row.submitted_by ?? undefined,
    reopenReason: row.reopen_reason ?? undefined,
    sentToDesignerAt: row.sent_to_designer_at ?? undefined,
    contentItemId: row.content_item_id ?? undefined,
    designTaskId: row.design_task_id ?? undefined,
    delegatedBy: row.delegated_by ?? undefined,
    delegatedAt: row.delegated_at ?? undefined,
    internalDue: row.internal_due ?? undefined,
    delegationNote: row.delegation_note ?? undefined,
  };
}

function toRow(request: ContentRequest): ContentRequestRow {
  return {
    id: request.id,
    topic: request.topic,
    target_branch: request.targetBranch,
    target_counselor: request.targetCounselor,
    needed: request.needed,
    deadline: request.deadline,
    notes: request.notes ?? null,
    campaign_id: request.campaignId ?? null,
    requested_by: request.requestedBy,
    requested_at: request.requestedAt,
    status: request.status,
    received_at: request.receivedAt ?? null,
    material_link: request.materialLink ?? null,
    received_note: request.receivedNote ?? null,
    reminders: request.reminders ?? null,
    submitted_files: request.submittedFiles ?? null,
    submitted_by: request.submittedBy ?? null,
    reopen_reason: request.reopenReason ?? null,
    sent_to_designer_at: request.sentToDesignerAt ?? null,
    content_item_id: request.contentItemId ?? null,
    design_task_id: request.designTaskId ?? null,
    delegated_by: request.delegatedBy ?? null,
    delegated_at: request.delegatedAt ?? null,
    internal_due: request.internalDue ?? null,
    delegation_note: request.delegationNote ?? null,
  };
}

export async function fetchMarketingContentRequests(): Promise<ContentRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('marketing_content_requests').select('*').order('requested_at', { ascending: false });
  if (error) throw error;
  return (data as ContentRequestRow[]).map(fromRow);
}

export async function upsertMarketingContentRequest(request: ContentRequest): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_content_requests').upsert(toRow(request));
  if (error) throw error;
}

export async function deleteMarketingContentRequest(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marketing_content_requests').delete().eq('id', id);
  if (error) throw error;
}
