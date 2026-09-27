// Branch Communication Center helpers — who a notice reaches and where each person stands.
import { BranchNotice, BranchNoticeAudience, BranchNoticeReceipt, BranchNoticeType, StaffMember } from './types';

export type ReceiptStatus = 'Acknowledged' | 'Read' | 'Pending';

export const NOTICE_TYPES: BranchNoticeType[] = ['Announcement', 'Instruction', 'SOP Update', 'Urgent Alert', 'Meeting', 'Recognition'];

/** Soft-tinted pill per notice type. */
export const NOTICE_TYPE_STYLES: Record<BranchNoticeType, string> = {
  Announcement: 'bg-blue-50 text-blue-700',
  Instruction: 'bg-indigo-50 text-indigo-700',
  'SOP Update': 'bg-teal-50 text-teal-700',
  'Urgent Alert': 'bg-red-50 text-red-700',
  Meeting: 'bg-amber-50 text-amber-700',
  Recognition: 'bg-emerald-50 text-emerald-700',
};

/** Checkbox label for each audience value. */
export const AUDIENCE_LABELS: Record<BranchNoticeAudience, string> = {
  'All Staff': 'All Staff',
  Counselor: 'Counselors',
  'V/A Officer': 'V/A Officers',
  'Front Desk Officer': 'Front Desk',
};

export const AUDIENCE_OPTIONS: BranchNoticeAudience[] = ['All Staff', 'Counselor', 'V/A Officer', 'Front Desk Officer'];

/** "Counselors + V/A Officers" */
export function audienceLabel(audience: BranchNoticeAudience[]): string {
  if (audience.includes('All Staff')) return 'All Staff';
  return audience.map((a) => AUDIENCE_LABELS[a]).join(' + ');
}

/** Active branch staff a notice for these audiences reaches (never the Branch Manager themselves). */
export function noticeRecipients(branchStaff: StaffMember[], audience: BranchNoticeAudience[]): StaffMember[] {
  return branchStaff.filter(
    (s) => s.status === 'Active' && s.role !== 'Branch Manager' && s.role !== 'Super Admin' &&
      (audience.includes('All Staff') || audience.includes(s.role as BranchNoticeAudience))
  );
}

export function receiptStatus(receipt: BranchNoticeReceipt | undefined): ReceiptStatus {
  if (receipt?.acknowledgedAt) return 'Acknowledged';
  if (receipt?.readAt) return 'Read';
  return 'Pending';
}

export function isExpired(notice: BranchNotice, today: string): boolean {
  return !!notice.expiryDate && notice.expiryDate < today;
}
