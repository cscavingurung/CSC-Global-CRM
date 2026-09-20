import { supabase } from './supabaseClient';
import { AppNotification } from '../types';

interface NotificationRow {
  id: string;
  trigger: AppNotification['trigger'];
  student_name: string;
  message_before: string;
  message_after: string;
  created_at: string;
  read: boolean;
  navigate_to: string;
  role: AppNotification['role'];
  branch: string | null;
  recipient_name: string | null;
  lead_id: string | null;
}

function fromRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    trigger: row.trigger,
    studentName: row.student_name,
    messageBefore: row.message_before,
    messageAfter: row.message_after,
    createdAt: new Date(row.created_at),
    read: row.read,
    navigateTo: row.navigate_to,
    role: row.role,
    branch: row.branch ?? undefined,
    recipientName: row.recipient_name ?? undefined,
    leadId: row.lead_id ?? undefined,
  };
}

function toRow(n: AppNotification): NotificationRow {
  return {
    id: n.id,
    trigger: n.trigger,
    student_name: n.studentName,
    message_before: n.messageBefore,
    message_after: n.messageAfter,
    created_at: n.createdAt.toISOString(),
    read: n.read,
    navigate_to: n.navigateTo,
    role: n.role,
    branch: n.branch ?? null,
    recipient_name: n.recipientName ?? null,
    lead_id: n.leadId ?? null,
  };
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as NotificationRow[]).map(fromRow);
}

export async function insertNotification(notification: AppNotification): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('notifications').insert(toRow(notification));
  if (error) throw error;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!supabase || ids.length === 0) return;
  const { error } = await supabase.from('notifications').update({ read: true }).in('id', ids);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}
