import { AppNotification, MockUser } from './types';

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `notif${Date.now()}_${idCounter}`;
}

export function createIntakeNotification(studentName: string, country: string, purpose: string, branch: string): AppNotification {
  return {
    id: nextId(),
    trigger: 'new-intake',
    studentName,
    messageBefore: 'New lead from ',
    messageAfter: ` — ${country}, ${purpose}`,
    createdAt: new Date(),
    read: false,
    role: 'receptionist',
    branch,
    navigateTo: 'assign-counselor',
  };
}

export function createAssignmentNotification(studentName: string, country: string, purpose: string, counselorName: string): AppNotification {
  return {
    id: nextId(),
    trigger: 'assigned-to-counselor',
    studentName,
    messageBefore: '',
    messageAfter: ` assigned to you — ${country}, ${purpose}`,
    createdAt: new Date(),
    read: false,
    role: 'counselor',
    recipientName: counselorName,
    navigateTo: 'my-students',
  };
}

export function createConsultationReadyNotification(studentName: string, branch: string): AppNotification {
  return {
    id: nextId(),
    trigger: 'consultation-ready',
    studentName,
    messageBefore: '',
    messageAfter: ' ready for application — consultation complete',
    createdAt: new Date(),
    read: false,
    role: 'application_officer',
    branch,
    navigateTo: 'applications',
  };
}

// Blind marketing broadcast — every counselor in the branch group sees it, but the personal
// contact details stay hidden (no name/phone/email) until one of them accepts the lead.
export function createLeadBroadcastNotification(leadId: string, country: string, purpose: string, branch: string): AppNotification {
  return {
    id: nextId(),
    trigger: 'lead-broadcast',
    studentName: '',
    messageBefore: `New lead available — ${country} · ${purpose}`,
    messageAfter: '. Contact details stay hidden until you accept.',
    createdAt: new Date(),
    read: false,
    role: 'counselor',
    branch,
    navigateTo: 'my-students',
    leadId,
  };
}

// A client's status tracker (offer stage or visa stage) advanced — branch manager only, since
// no other role needs a push for their own case work.
export function createStatusUpdateNotification(studentName: string, statusLabel: string, branch: string): AppNotification {
  return {
    id: nextId(),
    trigger: 'status-update',
    studentName,
    messageBefore: '',
    messageAfter: ` status updated to ${statusLabel}`,
    createdAt: new Date(),
    read: false,
    role: 'branch_manager',
    branch,
    navigateTo: 'applications',
  };
}

// A branch-scoped copy of one of the three events above, addressed to the Branch Manager —
// none of the three factories above ever set role: 'branch_manager', so without this a
// manager never sees a notification for activity in their own branch.
export function createBranchManagerNotification(
  trigger: AppNotification['trigger'],
  studentName: string,
  messageBefore: string,
  messageAfter: string,
  branch: string,
  navigateTo: string
): AppNotification {
  return {
    id: nextId(),
    trigger,
    studentName,
    messageBefore,
    messageAfter,
    createdAt: new Date(),
    read: false,
    role: 'branch_manager',
    branch,
    navigateTo,
  };
}

// A notification is visible to a user when the role matches, and — depending on how it's
// scoped — either the specific recipient or the branch also matches. Role-only notifications
// (neither set) are visible to everyone in that role.
export function isNotificationVisibleTo(n: AppNotification, user: MockUser): boolean {
  if (n.role !== user.role) return false;
  if (n.recipientName) return n.recipientName === user.name;
  if (n.branch) return n.branch === user.branch;
  return true;
}

export function formatRelativeTime(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
