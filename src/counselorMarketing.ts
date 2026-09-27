// Branch staff ↔ Marketing collaboration — the data boundary for counselors and the Front Desk.
//
// Branch staff only fulfil content requests. App.tsx passes their Marketing tab this projection of
// the requests addressed to them — topic, what's needed, deadline and the brief — and never the
// Marketing store itself: no analytics, ad budgets, campaigns, content calendar or schedules, and
// no designer/pipeline status beyond "you submitted it".
import { DeliveredFile, MarketingStore } from './types';

export interface CounselorRequest {
  id: string;
  topic: string;
  /** Required format, e.g. "60-second video". */
  needed: string;
  deadline: string;
  brief?: string;
  requestedBy: string;
  requestedByRole: string;
  requestedAt: string;
  /** Branch Manager who delegated it to this person, when they did. */
  delegatedBy?: string;
  status: 'Pending' | 'Submitted';
  /** Set when Marketing sent it back to redo. */
  redoReason?: string;
  reminders: number;
  submittedAt?: string;
  submittedFiles?: DeliveredFile[];
  submittedNote?: string;
}

/** Requests addressed to one branch staff member (counselor or Front Desk Officer). */
export function assignedContentRequests(store: MarketingStore, person: string, roleOf: (name: string) => string): CounselorRequest[] {
  return store.contentRequests
    .filter((r) => r.targetCounselor === person)
    .map((r) => ({
      id: r.id,
      topic: r.topic,
      needed: r.needed,
      // The Branch Manager's internal due date, when they delegated it, comes before Marketing's.
      deadline: r.internalDue ?? r.deadline,
      brief: r.delegationNote ? `${r.notes ? `${r.notes}\n\n` : ''}From your Branch Manager: ${r.delegationNote}` : r.notes,
      requestedBy: r.requestedBy,
      requestedByRole: roleOf(r.requestedBy),
      requestedAt: r.requestedAt,
      delegatedBy: r.delegatedBy,
      status: r.status === 'Waiting' ? 'Pending' : 'Submitted',
      redoReason: r.status === 'Waiting' ? r.reopenReason : undefined,
      reminders: r.reminders?.length ?? 0,
      submittedAt: r.status === 'Waiting' ? undefined : r.receivedAt,
      submittedFiles: r.submittedFiles,
      submittedNote: r.receivedNote,
    }));
}
