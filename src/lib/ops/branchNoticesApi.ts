import { supabase } from '../supabaseClient';
import { BranchNotice, BranchNoticeReceipt } from '../../types';

export interface BranchNoticeRow {
  id: string;
  branch: string;
  type: BranchNotice['type'];
  title: string;
  message: string;
  audience: BranchNotice['audience'];
  effective_date: string;
  expiry_date: string | null;
  ack_required: boolean;
  attachments: string[];
  posted_by: string;
  posted_at: string;
  receipts: BranchNoticeReceipt[];
  linked_task_ids: string[];
}

export function fromRow(row: BranchNoticeRow): BranchNotice {
  return {
    id: row.id,
    branch: row.branch,
    type: row.type,
    title: row.title,
    message: row.message,
    audience: row.audience,
    effectiveDate: row.effective_date,
    expiryDate: row.expiry_date ?? undefined,
    ackRequired: row.ack_required,
    attachments: row.attachments,
    postedBy: row.posted_by,
    postedAt: row.posted_at,
    receipts: row.receipts,
    linkedTaskIds: row.linked_task_ids,
  };
}

function toRow(notice: BranchNotice): BranchNoticeRow {
  return {
    id: notice.id,
    branch: notice.branch,
    type: notice.type,
    title: notice.title,
    message: notice.message,
    audience: notice.audience,
    effective_date: notice.effectiveDate,
    expiry_date: notice.expiryDate ?? null,
    ack_required: notice.ackRequired,
    attachments: notice.attachments,
    posted_by: notice.postedBy,
    posted_at: notice.postedAt,
    receipts: notice.receipts,
    linked_task_ids: notice.linkedTaskIds,
  };
}

function toRowUpdates(updates: Partial<BranchNotice>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.branch !== undefined) row.branch = updates.branch;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.message !== undefined) row.message = updates.message;
  if (updates.audience !== undefined) row.audience = updates.audience;
  if (updates.effectiveDate !== undefined) row.effective_date = updates.effectiveDate;
  if (updates.expiryDate !== undefined) row.expiry_date = updates.expiryDate;
  if (updates.ackRequired !== undefined) row.ack_required = updates.ackRequired;
  if (updates.attachments !== undefined) row.attachments = updates.attachments;
  if (updates.postedBy !== undefined) row.posted_by = updates.postedBy;
  if (updates.postedAt !== undefined) row.posted_at = updates.postedAt;
  if (updates.receipts !== undefined) row.receipts = updates.receipts;
  if (updates.linkedTaskIds !== undefined) row.linked_task_ids = updates.linkedTaskIds;
  return row;
}

export async function fetchBranchNotices(): Promise<BranchNotice[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('branch_notices').select('*').order('posted_at', { ascending: false });
  if (error) throw error;
  return (data as BranchNoticeRow[]).map(fromRow);
}

export async function insertBranchNotice(notice: BranchNotice): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branch_notices').insert(toRow(notice));
  if (error) throw error;
}

export async function updateBranchNotice(id: string, updates: Partial<BranchNotice>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('branch_notices').update(toRowUpdates(updates)).eq('id', id);
  if (error) throw error;
}
