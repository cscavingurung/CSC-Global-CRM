export type Role =
  | 'super_admin'
  | 'marketing'
  | 'branch_manager'
  | 'receptionist'
  | 'counselor'
  | 'application_officer';

export interface MockUser {
  name: string;
  role: Role;
  branch: string;
  email: string;
  /** Supabase Auth user id for this session (see `staff.auth_user_id`). */
  authUserId: string;
  /** Marketing Department only — picks which role dashboard and actions they get. */
  marketingRole?: MarketingRole;
}

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  viewOnly?: boolean;
  /** Sub-tabs — makes this a Main Tab (or a nested group inside one) that reveals a menu
   * instead of a page. Groups can nest one level further, e.g. HRM → Attendance → pages. */
  children?: NavItem[];
}

export type NavConfig = Record<Role, NavItem[]>;

/**
 * Extra context passed along with a page switch, e.g. from a dashboard card click. Each page
 * reads only the fields it understands, as its initial filter/selection state.
 */
export interface NavIntent {
  /** Counselor Clients page — consultation status filter. */
  statusFilter?: ConsultationStatus;
  /** Clients list (StudentList) — pipeline stage filter. */
  clientStage?: 'New' | 'Assigned' | 'Enrolled' | 'Followup' | 'Archive';
  /** Applications list — stage filter. */
  appStage?: 'Offer' | 'Visa' | 'Withdrawn';
  /** Marketing pages — opens the page with a filter or form preselected (e.g. "Waiting", "new"). */
  marketingPreset?: string;
  /** Visa Applications queue — visa status buckets. */
  visaStatuses?: ('Pending' | 'Applied' | 'Approved' | 'Refused')[];
  /** Branch filter on company-wide lists (Super Admin). */
  branch?: string;
  /** Marketing Clients — platform source filter. */
  platform?: string;
  /** Prefilled search box text. */
  search?: string;
  /** Open this record's profile on arrival — a counselor-student id, or an application id on application lists. */
  openClientId?: string;
  /** Staff page — open this staff member's details. */
  openStaffName?: string;
  /** All Branches — open this branch's details. */
  openBranchId?: string;
  /** Daily Task Board — open on this day (YYYY-MM-DD). */
  taskDate?: string;
  /** Issue & Escalation Management — open this issue's detail view. */
  openIssueId?: string;
  /** HRM Attendance — focus this day (YYYY-MM-DD), with openStaffName for the employee. */
  attendanceDate?: string;
  /** Branch Manager Workspace — open on this sub-route (e.g. "/manager/transfers/inbox"). */
  workspacePath?: string;
  /** Super Admin Command Center — open on this route (e.g. "/admin/sheet/visa?flag=1"). */
  adminPath?: string;
}

/** One academic qualification. A client can list several (SEE, +2, Bachelor's, …). */
export interface AcademicEntry {
  /** Highest completed level of education, e.g. Bachelor's, Master's. */
  level: string;
  /** Field of study, e.g. Computer Science. */
  stream: string;
  gpa: string;
  completionYear: string;
}

export interface IntakeStudent {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  purpose: string;
  dob: string;
  gender: string;
  maritalStatus: string;
  academics: AcademicEntry[];
  ieltsPte: string;
  workExperience: string;
  submittedAt: string;
  /** Original staff member or intake source that created the lead. */
  addedBy?: string;
  /** Physical visit or initial consultation date/time. */
  visitDateTime?: string;
  /** How the lead reached the consultancy: Walk Ins, Marketing or Others. */
  referredThrough?: string;
  /** Platform the marketing team generated the lead from (Facebook, Instagram, …). */
  platformSource?: string;
  /** Branch group the lead was broadcast to by Marketing — blind claim pool. */
  broadcastBranch?: string | null;
  /** When the lead was broadcast to the branch group. */
  broadcastAt?: string;
  /** Counselor who claimed the broadcast lead first (first-come, first-served). */
  claimedBy?: string | null;
  claimedAt?: string;
  /** Latest repeat visit logged by the front desk ("Add Revisited Client"). */
  revisitedAt?: string;
  /** Every earlier visit timestamp, oldest first — so logging a new visit never erases the last one. */
  visitHistory?: string[];
  status: 'New' | 'Assigned';
  assignedCounselor: string | null;
  branch: string;
}

export type CounselorAvailability = 'Available' | 'In Session' | 'Away';

export interface Counselor {
  id: string;
  name: string;
  /** Countries this counselor specializes in — a counselor can cover more than one. */
  countries: string[];
  activeAssignments: number;
  availability: CounselorAvailability;
}

export type ConsultationStatus = 'Awaiting Consultation' | 'In Progress' | 'Follow Up' | 'Consultation Complete';

export type ConsultationOutcome = 'Pending' | 'Proceeding' | 'Not Proceeding';

// How warm a lead is, captured whenever a follow-up is scheduled or logged.
export type LeadTemperature = 'Hot' | 'Mild' | 'Cold';

/** One target institution chosen by the counselor when a client starts enrolment. */
export interface EnrolmentChoice {
  institution: string;
  country: string;
  program: string;
  intake: string;
}

export interface CounselorStudent {
  id: string;
  /** Auto-generated portal-wide Client ID (e.g. CSC-2026-0148). */
  clientId?: string;
  /** Institutions picked in the "Proceeding to Enrolled" modal — local handoff only. */
  enrolments?: EnrolmentChoice[];
  name: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  purpose: string;
  dob: string;
  gender: string;
  maritalStatus: string;
  academics: AcademicEntry[];
  ieltsPte: string;
  workExperience: string;
  submittedAt: string;
  /** Original staff member or intake source that created the lead. */
  addedBy?: string;
  /** Physical visit or initial consultation date/time. */
  visitDateTime?: string;
  /** How the lead reached the consultancy: Walk Ins, Marketing or Others. */
  referredThrough?: string;
  /** Platform the marketing team generated the lead from, carried over on assignment. */
  platformSource?: string;
  /** Latest repeat visit logged by the front desk ("Add Revisited Client"). */
  revisitedAt?: string;
  /** Every earlier visit timestamp, oldest first — so logging a new visit never erases the last one. */
  visitHistory?: string[];
  assignedDate: string;
  assignedCounselor: string;
  consultationStatus: ConsultationStatus;
  consultationNotes: string;
  followUpDate: string | null;
  completedDate: string | null;
  outcome: ConsultationOutcome;
  /** Required when a follow-up is scheduled — drives the Hot/Mild/Cold badges and filters. */
  leadTemperature?: LeadTemperature;
  /** Required note captured whenever a lead is flagged for follow-up. */
  followUpNote?: string;
  /** Append-only case history (handovers). */
  auditLog?: ClientAuditEntry[];
}

// Stage 1 — one attempt at a single institution. A client can have several of these (one
// per institution); a Rejected attempt stays in the array as history rather than being
// removed, and the officer can add a new attempt (Re-apply) to try a different institution.
// Reaching 'Fee Paid' closes this attempt out and unlocks the visa stage.
export type OfferStatus =
  | 'Enrolled'
  | 'Applied to Institution'
  | 'Further Information Required'
  | 'Offer Received'
  | 'Rejected'
  | 'Fee Paid';

export interface OfferApplication {
  id: string;
  institution: string;
  /** Country this institution is in — a client can apply to different countries per institution. */
  country?: string;
  status: OfferStatus;
  /** Free-text program/course name. */
  course?: string;
  /** Free-text intake period (e.g. "Jan 2027") — deferrable after it's first set. */
  intake?: string;
  /** Reference number captured at Fee Paid. */
  clientRefId?: string;
  /** Institution-issued University Client ID, captured when the fee is confirmed paid. */
  studentId?: string;
  /** Set when the offer attempt is first added — the Status Tracker's "Enrolled" date. */
  enrolledDate?: string;
  /** Staff member who added/marked this institution attempt as Enrolled. */
  enrolledBy?: string;
  /** Set when status moves to 'Applied to Institution'. */
  appliedDate?: string;
  /** Staff member who marked this offer Applied to Institution. */
  appliedBy?: string;
  /** Set when status reaches 'Offer Received' or 'Rejected'. */
  outcomeDate?: string;
  /** Staff member who marked the offer Received or Rejected. */
  outcomeBy?: string;
  /** Set when status reaches 'Fee Paid'. */
  feePaidDate?: string;
  /** Staff member who marked the fee Paid. */
  feePaidBy?: string;
  /** Date the current status was entered — powers "days in current status" staleness checks. */
  statusUpdatedAt: string;
  /** Exact moment (ISO) the current status was set, and who set it — for activity feeds. */
  statusUpdatedTime?: string;
  statusUpdatedBy?: string;
  /** Flagged when the institution asks for more information — set by Counselor, Branch Manager or V/A Officer. */
  furtherInfoRequired?: boolean;
  notes?: string;
}

// Stage 2 — unlocked once an OfferApplication reaches 'Fee Paid' (Study cases) or straight
// after enrolment (SOWP / Visit cases). The standard document list (CHECKLIST_GROUPS in
// clientPipeline.ts) plus any custom items staff add. Every required item must be ticked
// before advancing past 'Preparing Documents'; optional ones (Medical) don't block.
export type ChecklistKey =
  | 'sop' | 'experience' | 'recommendation' | 'noc' | 'policeReport'
  | 'sponsorshipLetter' | 'wardDocuments' | 'ca' | 'bankBalanceCertificate' | 'bankStatement'
  | 'incomeDocuments' | 'propertyValuation' | 'translation'
  | 'passport' | 'photo' | 'medical' | 'pal'
  // Re-application after a visa refusal
  | 'reappealLetter' | 'newPal'
  // Enrolment documents (before applying to an institution)
  | 'academics' | 'englishProficiency' | 'recommendationLetter';

/** Ticked state per document — a missing key means not yet received. Older records may still
 *  carry retired keys (e.g. `financial`); they're kept but no longer shown or counted. */
export type VisaChecklist = Partial<Record<ChecklistKey, boolean>> & Record<string, boolean | undefined>;

/** A checklist item added by a staff member on top of the standard list. */
export interface CustomChecklistItem {
  id: string;
  label: string;
  done: boolean;
  /** Name of the staff member who added the item. */
  addedBy: string;
  /** Who ticked it, and when (enrolment checklist). */
  doneBy?: string;
  doneDate?: string;
}

export type VisaStageStatus = 'Preparing Documents' | 'File Ready for Visa' | 'Visa Applied' | 'Visa Approved' | 'Visa Refused';

export interface VisaApplication {
  status: VisaStageStatus;
  /** Previous visa attempts kept after re-apply, so refusals remain visible in the tracker. */
  history?: VisaApplication[];
  checklist: VisaChecklist;
  /** Set when the visa case is first opened — the Status Tracker's "Preparing Documents" date. */
  preparingDocsDate?: string;
  /** Set when status moves to 'File Ready for Visa'. */
  fileReadyDate?: string;
  /** Set when status moves to 'Visa Applied'. */
  appliedDate?: string;
  /** Set when status reaches 'Visa Approved' or 'Visa Refused'. */
  outcomeDate?: string;
  /** Date the current status was entered — powers "days in current status" staleness checks. */
  statusUpdatedAt: string;
  /** Exact moment (ISO) the current status was set, and who set it — for activity feeds. */
  statusUpdatedTime?: string;
  statusUpdatedBy?: string;
  notes: string;
  /** Set via the "Request Refund" action after a Visa Refused outcome. */
  refundRequested?: boolean;
  refundRequestedDate?: string;
  /** Reminder date (YYYY-MM-DD) to follow up with the client on the refund — set when it's requested. */
  refundFollowUpDate?: string;
  refundFollowUpNote?: string;
  /** Who set (or last changed) the refund follow-up. */
  refundFollowUpSetBy?: string;
  refundFollowUpDone?: boolean;
  refundFollowUpDoneDate?: string;
  /** Set by "Mark Refund Received & Close File" — the application is withdrawn at the same time. */
  refundReceived?: boolean;
  refundReceivedDate?: string;
  refundReceivedBy?: string;
  /** Extra checklist items added by staff, each tagged with who added it. */
  customChecklist?: CustomChecklistItem[];
  /** Conditional markers available once the visa has been applied for. */
  interviewRequired?: boolean;
  documentsRequestedFromHighCommission?: boolean;
  /** Set through "Complete Enrollment" after a Visa Approved outcome. */
  enrollmentCompleted?: boolean;
  enrollmentCompletedDate?: string;
}

// Internal staff communication log entry on a client's profile — visible to any staff role,
// editable by everyone except the front desk (view-only).
/** Append-only audit trail entry on a client's case — e.g. a counselor handover. Never edited or removed. */
export interface ClientAuditEntry {
  id: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  at: string;
  by: string;
  action: 'Handover' | 'Branch Transfer';
  /** e.g. "Transferred from Aarav Sharma to Sneha Tamang. Reason: Client requested." */
  text: string;
  from?: string;
  to?: string;
  reason?: string;
}

export interface ClientNote {
  id: string;
  text: string;
  authorName: string;
  authorRole: Role;
  createdAt: string;
}

export interface ApplicationRecord {
  id: string;
  /** Auto-generated portal-wide Client ID (e.g. CSC-2026-0148). */
  clientId?: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  country: string;
  purpose: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  academics?: AcademicEntry[];
  ieltsPte?: string;
  workExperience?: string;
  counselor: string;
  consultationDate: string;
  /** Original staff member or intake source that created the lead. */
  addedBy?: string;
  /** Platform the marketing team generated the lead from, carried down the pipeline. */
  platformSource?: string;
  /** Physical visit or initial consultation date/time. */
  visitDateTime?: string;
  consultationNotes: string;
  branch: string;
  offerApplications: OfferApplication[];
  visaApplication: VisaApplication | null;
  /** The only way a client exits the pipeline — never automatic on a rejected/refused outcome. */
  withdrawn: boolean;
  withdrawnDate?: string;
  notes: ClientNote[];
  /** Earlier rounds of this client's case, archived when a closed file is re-enrolled. */
  previousEnrolments?: PreviousEnrolment[];
  /** Documents collected after enrolment, before applying to an institution (V/A Officer marks). */
  enrolmentChecklist?: EnrolmentChecklist;
  /** Append-only case history (handovers) — mirrors the counselor record's. */
  auditLog?: ClientAuditEntry[];
  /** Country-specific route progress (Australia / UK / New Zealand / USA); null when cleared. */
  countryPipeline?: CountryPipelineState | null;
  /** The offer (and so the country) the client chose to process when holding offers from more
   * than one institution / country. '' = choice cleared. */
  processingOfferId?: string;
}

/** Who marked a document received, and when. */
export interface ChecklistMark {
  by: string;
  /** YYYY-MM-DD */
  date: string;
}

/**
 * Enrolment document checklist — the standard items (ENROLMENT_CHECKLIST_ITEMS) plus any the
 * V/A Officer adds. A standard item is received when it has a mark; custom items carry `done`.
 */
export interface EnrolmentChecklist {
  marks: Partial<Record<string, ChecklistMark>>;
  custom: CustomChecklistItem[];
}

/**
 * A closed round of a client's case (every offer attempt plus the visa attempt), set aside by
 * "Re-enroll Client" so the Status Tracker can start fresh for a new course or country.
 */
export interface PreviousEnrolment {
  id: string;
  /** Why the round ended, e.g. "Refund received". */
  closeReason: string;
  closedDate?: string;
  reEnrolledDate: string;
  reEnrolledBy: string;
  offerApplications: OfferApplication[];
  visaApplication: VisaApplication | null;
}

export type StaffRole =
  | 'Front Desk Officer'
  | 'Counselor'
  | 'V/A Officer'
  | 'Branch Manager'
  | 'Super Admin'
  | 'Marketing';
export type StaffStatus = 'Active' | 'Inactive';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  /** Supabase Auth user id backing this staff member's login (see `admin-staff` Edge Function). */
  authUserId?: string;
  role: StaffRole;
  status: StaffStatus;
  branch: string;
  /** YYYY-MM-DD — used by HR Reports when no onboarding case gives a start date. */
  joinDate?: string;
  /** Marketing Department only. */
  marketingRole?: MarketingRole;
}

export interface ActivityEntry {
  id: string;
  message: string;
  timestamp: string;
  /** Who caused the activity, when known. */
  by?: string;
  type: 'assignment' | 'status' | 'intake' | 'consultation';
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  manager: string | null;
}

export type PartnerType = 'College' | 'University';

export interface PartnerCourse {
  name: string;
  price: number;
}

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  commissionRate: number;
  courses: PartnerCourse[];
}

export type CommissionStatus = 'Pending' | 'Paid';

export interface CommissionRecord {
  id: string;
  studentName: string;
  branch: string;
  consultant: string;
  partner: string;
  fullFee: number;
  commissionRate: number;
  commissionStatus: CommissionStatus;
}

export type NotificationTrigger = 'new-intake' | 'assigned-to-counselor' | 'consultation-ready' | 'lead-broadcast' | 'status-update';

export interface AppNotification {
  id: string;
  trigger: NotificationTrigger;
  studentName: string;
  // Full message is `${messageBefore}${studentName}${messageAfter}`, split so the
  // student's name alone can be rendered in bold.
  messageBefore: string;
  messageAfter: string;
  createdAt: Date;
  read: boolean;
  navigateTo: string;
  /** Which role this notification is addressed to. */
  role: Role;
  /** Set for role+branch-scoped notifications (receptionist, application officer). */
  branch?: string;
  /** Set for notifications addressed to one specific person (counselor). */
  recipientName?: string;
  /** Set on blind marketing lead broadcasts — the lead any counselor in the branch can claim. */
  leadId?: string;
  /** Staff member whose action produced this notification. */
  actorName?: string;
}

// ─── Daily Task Board ───────────────────────────────────────────────────────
export type TaskStatus = 'To Do' | 'In Progress' | 'Done';
export type TaskPriority = 'High' | 'Medium' | 'Low';
export type TaskCategory = 'Client Follow-up' | 'Documentation' | 'Front Desk' | 'Marketing' | 'Admin';

export interface DailyTask {
  id: string;
  title: string;
  notes?: string;
  branch: string;
  /** Role responsible — any member holding it can update the task. 'Anyone' opens it to the whole branch. */
  assignedRole: StaffRole | 'Anyone';
  /** Optional specific staff member (by name) the task is assigned to. */
  assignee?: string;
  /** Task date, YYYY-MM-DD. */
  date: string;
  /** Kind of work — tasks without one are grouped by the assigned role (see taskCategory()). */
  category?: TaskCategory;
  /** Optional due time, e.g. "10:00 AM". */
  dueTime?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdBy: string;
  updatedBy?: string;
  /** "YYYY-MM-DD h:mm AM/PM", same format as submittedAt. */
  updatedAt?: string;
}

// ─── Branch Communication Center ───────────────────────────────────────────
// Official one-way notices from the Branch Manager to branch staff — not a chat. Staff can
// only open a notice (Read) and, when asked, confirm "I have read and understood this".
export type BranchNoticeType = 'Announcement' | 'Instruction' | 'SOP Update' | 'Urgent Alert' | 'Meeting' | 'Recognition';
export type BranchNoticeAudience = 'All Staff' | 'Counselor' | 'V/A Officer' | 'Front Desk Officer';

export interface BranchNoticeReceipt {
  staffName: string;
  /** "YYYY-MM-DD h:mm AM/PM" — first time the staff member opened the notice. */
  readAt?: string;
  /** Set when they click "I have read and understood this". */
  acknowledgedAt?: string;
}

export interface BranchNotice {
  id: string;
  branch: string;
  type: BranchNoticeType;
  title: string;
  message: string;
  audience: BranchNoticeAudience[];
  /** YYYY-MM-DD */
  effectiveDate: string;
  /** YYYY-MM-DD — optional; the notice shows as Expired after this date. */
  expiryDate?: string;
  ackRequired: boolean;
  /** File names only — uploads are mocked until storage is wired up. */
  attachments: string[];
  postedBy: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  postedAt: string;
  receipts: BranchNoticeReceipt[];
  /** Daily Task Board tasks created from this notice. */
  linkedTaskIds: string[];
}

// ─── Issue & Escalation Management ─────────────────────────────────────────
// Work-blocking problems that need IT or manager intervention — not tasks, not chat.
export type IssueCategory = 'IT/System' | 'Office/Facility' | 'Client/Service' | 'Staff/HR' | 'Finance' | 'Other';
export type IssueImpact = 'Just me' | '2-3 staff' | 'Most of the branch' | 'Entire branch';
/** Never picked by the reporter — derived from the impact level. */
export type IssuePriority = 'Normal' | 'High' | 'Critical';
export type IssueStatus = 'Open' | 'Assigned' | 'In Progress' | 'Waiting' | 'Resolved' | 'Closed';
export type IssueEscalationReason = 'Cannot resolve' | 'Requires manager decision' | 'Urgent';
export type IssueEscalationTarget = 'Branch Manager' | 'IT Support';

export interface IssueActivity {
  id: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  at: string;
  by: string;
  text: string;
  kind: 'reported' | 'assigned' | 'status' | 'escalated' | 'update' | 'resolved' | 'confirmed' | 'closed' | 'reopened';
}

export interface BranchIssue {
  id: string;
  /** Human-readable reference, e.g. ISS-1042. */
  code: string;
  branch: string;
  title: string;
  category: IssueCategory;
  impact: IssueImpact;
  priority: IssuePriority;
  description: string;
  triedSoFar: string;
  /** File names only — uploads are mocked until storage is wired up. */
  attachments: string[];
  reportedBy: string;
  reporterRole: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  reportedAt: string;
  status: IssueStatus;
  /** Staff member name, or 'IT Support'. */
  owner?: string;
  escalatedTo?: IssueEscalationTarget;
  escalationReason?: IssueEscalationReason;
  resolution?: string;
  requiresConfirmation?: boolean;
  reporterConfirmedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  activity: IssueActivity[];
}

// ─── Branch Operations Control ─────────────────────────────────────────────
// One working day at a branch: attendance, the opening checklist and the closing handover.
export type AttendanceStatus = 'On Time' | 'Late' | 'Very Late';

/** Exactly one per employee per day. checkIn/checkOut hold the current (possibly corrected)
 * values; the raw punches are frozen in `original` the first time a correction is applied,
 * and every approved change is appended to `amendments`. Nothing is ever overwritten silently. */
export interface AttendanceRecord {
  id: string;
  staffName: string;
  branch: string;
  /** YYYY-MM-DD */
  date: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  checkIn?: string;
  checkOut?: string;
  /** Punches exactly as recorded, before any correction. */
  original?: { checkIn?: string; checkOut?: string };
  amendments?: AttendanceAmendment[];
}

export interface AttendanceAmendment {
  id: string;
  correctionId: string;
  field: 'checkIn' | 'checkOut';
  /** Value before this amendment (undefined = the punch was missing). */
  from?: string;
  to: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  approvedBy: string;
  approvedAt: string;
}

/** Why someone was late or absent. Requested by the manager, submitted by the employee (or
 * recorded by the manager on their behalf), then accepted (excused) or rejected (unexcused). */
export type ExplanationReason = 'Traffic' | 'Medical' | 'Work-related' | 'Family / Personal' | 'Other';

export interface AttendanceExplanation {
  id: string;
  staffName: string;
  branch: string;
  /** YYYY-MM-DD */
  date: string;
  kind: 'Late' | 'Absence';
  status: 'Requested' | 'Submitted' | 'Accepted' | 'Rejected';
  reason?: ExplanationReason;
  note?: string;
  requestedBy?: string;
  requestedAt?: string;
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

// ─── HRM · Performance ──────────────────────────────────────────────────────
// Text reviews only — no scores or rankings. Numbers shown alongside come straight from the CRM.
export type ReviewAssessment = 'Exceeds Expectations' | 'Meets Expectations' | 'Needs Improvement';

export interface PerformanceReview {
  id: string;
  staffName: string;
  branch: string;
  /** Free text, e.g. "Jan – Jun 2026". */
  period: string;
  overall: string;
  strengths: string;
  improvements: string;
  goals: string;
  assessment: ReviewAssessment;
  acknowledged: boolean;
  acknowledgedAt?: string;
  reviewedBy: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  reviewedAt: string;
}

// ─── Financial Management ───────────────────────────────────────────────────
// One ledger for the branch. Every view (collections, receipts, outstanding, plans, revenue,
// refunds, discounts) is a different reading of these rows — nothing is entered twice, and
// nothing is deleted: payments are voided, refunds reference the original payment.
export type FinService =
  | 'Consultation Fee' | 'Application Processing' | 'Visa Processing' | 'IELTS / PTE Class' | 'Document Translation'
  // Ad-hoc document & processing charges added by the V/A Officer.
  | 'Courier Fee' | 'Notary Fee' | 'Legalization Fee' | 'Other Charge';
export type PaymentMethod = 'Cash' | 'Bank' | 'Other';

export interface FinTransaction {
  id: string;
  branch: string;
  /** Exception = a counselor's request for a custom payment plan or a due-date extension.
   * Transfer = the unpaid balance leaving this branch with an inter-branch transfer (a credit here;
   * the receiving branch gets a matching Charge). */
  kind: 'Charge' | 'Payment' | 'Refund' | 'Discount' | 'Exception' | 'Transfer';
  clientId: string;
  clientName: string;
  counselor: string;
  country: string;
  service: FinService;
  /** Free-text name for an ad-hoc charge (e.g. "Police report translation"); its payment carries it too. */
  title?: string;
  /** Charge set from the Super Admin's Service Charges — the price version it was copied from. */
  priceId?: string;
  /** Inter-branch transfer that moved an unpaid balance (on the Transfer credit and its Charge). */
  transfer?: { code: string; from: string; to: string };
  amount: number;
  /** "YYYY-MM-DD h:mm AM/PM" — when it was recorded or requested. */
  at: string;
  /** Staff member who received the payment / raised the charge or request. */
  by: string;
  /** Charge: when it's due (YYYY-MM-DD). */
  dueDate?: string;
  /** Charge or payment: which payment plan / instalment it belongs to. */
  planId?: string;
  installment?: number;
  installments?: number;
  /** Payment */
  method?: PaymentMethod;
  methodNote?: string;
  /** Free-text note from whoever took the payment, e.g. "Paid to CSC Global Laxmi Bank account". */
  note?: string;
  receiptNo?: string;
  void?: { reason: string; by: string; at: string };
  /** Refund / discount workflow. */
  /** Returned = sent back to the requester for changes (Manager Approval Center). */
  status?: 'Pending Approval' | 'Approved' | 'Processed' | 'Rejected' | 'Returned';
  reason?: string;
  /** Refund: the payment being refunded (never modified). */
  refOf?: string;
  /** Discount: the standard fee it's taken off. */
  standardFee?: number;
  /** Exception: what's being asked for, and the proposed new due date if any. */
  exceptionType?: 'Custom payment plan' | 'Due date extension';
  requestedDueDate?: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  processedBy?: string;
  processedAt?: string;
}

// ─── HRM · Payroll Inputs ───────────────────────────────────────────────────
// Data collection for Finance only — no tax, payslips or salary formulas.
export interface SalaryEntry {
  amount: number;
  /** YYYY-MM-DD */
  effectiveFrom: string;
  setBy: string;
  setAt: string;
  note?: string;
}

/** Per-employee fixed inputs. Salary changes append to `salaryHistory`; nothing is overwritten. */
export interface PayProfile {
  staffName: string;
  branch: string;
  salaryHistory: SalaryEntry[];
  fixedAllowance: number;
  commissionEligible: boolean;
  paymentMethod: 'Bank transfer' | 'Cash' | 'Cheque';
  bankName: string;
  accountName: string;
  accountNumber: string;
}

/** What the branch enters by hand each month. */
export interface PayrollManual {
  overtime: number;
  bonus: number;
  commission: number;
  allowance: number;
  deduction: number;
  advance: number;
  other: number;
  remarks: string;
}

/** Figures pulled from Attendance / Leave — frozen into the run when it's submitted. */
export interface PayrollAuto {
  basic: number;
  workingDays: number;
  daysWorked: number;
  leaveDays: number;
  late: number;
  absent: number;
}

export interface PayrollRun {
  id: string;
  branch: string;
  /** YYYY-MM */
  month: string;
  status: 'Draft' | 'Submitted' | 'Processed';
  manual: Record<string, PayrollManual>;
  /** Only set once submitted. */
  snapshot?: Record<string, PayrollAuto>;
  submittedBy?: string;
  submittedAt?: string;
  processedBy?: string;
  processedAt?: string;
}

export type HolidayType = 'National' | 'Festival' | 'Company' | 'Local';

/** A non-working day (or range). Attendance treats it as "Holiday" — never Absent — and leave
 * falling on it isn't deducted from anyone's balance. */
export interface Holiday {
  id: string;
  name: string;
  type: HolidayType;
  /** YYYY-MM-DD, inclusive. */
  from: string;
  to: string;
  /** Same month/day every year (e.g. Labour Day). Lunar festivals like Dashain move, so they're entered per year. */
  repeatsAnnually: boolean;
  /** 'All' CSC branches, or specific branch names. */
  appliesTo: 'All' | string[];
  createdBy: string;
}

export type LeaveType = 'Annual' | 'Sick' | 'Casual' | 'Emergency' | 'Unpaid';

// ─── Expense claims ─────────────────────────────────────────────────────────
// Branch spending that needs the manager's sign-off (decided in the Manager Approval Center).
export type ExpenseCategory = 'Office Supplies' | 'Travel' | 'Client Service' | 'Utilities' | 'Marketing';

export interface ExpenseRequest {
  id: string;
  branch: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  reason: string;
  requestedBy: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  requestedAt: string;
  receiptAttached: boolean;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Returned';
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

/** A leave request. Only Approved ones count as leave anywhere else — Attendance reads this
 * same record, so approving it is what turns those days into "On Leave". */
export interface LeaveRecord {
  id: string;
  staffName: string;
  branch: string;
  /** YYYY-MM-DD, inclusive */
  from: string;
  to: string;
  type: LeaveType;
  /** Returned = sent back to the requester for changes (Manager Approval Center). */
  status: 'Pending' | 'Approved' | 'Rejected' | 'Returned';
  /** Working days in the range (Saturdays excluded), fixed when requested. */
  days: number;
  reason: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export interface AttendanceCorrection {
  id: string;
  staffName: string;
  branch: string;
  /** Day being corrected, YYYY-MM-DD. */
  date: string;
  field: 'checkIn' | 'checkOut';
  /** The time the staff member says is correct, "h:mm AM/PM". */
  requestedTime: string;
  reason: string;
  requestedAt: string;
  /** Who raised it — the employee, or a manager on their behalf. Defaults to the employee. */
  requestedBy?: string;
  /** Returned = sent back to the requester for changes (Manager Approval Center). */
  status: 'Pending' | 'Approved' | 'Rejected' | 'Returned';
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export type ChecklistState = 'ok' | 'fail';

export interface ChecklistMarkEntry {
  state: ChecklistState;
  by: string;
  at: string;
  /** Issue raised from a failed item. */
  issueId?: string;
}

export interface HandoverItem {
  id: string;
  label: string;
  owner: string;
  /** Daily Task Board task created for the next morning. */
  taskId?: string;
}

export interface BranchDayLog {
  id: string;
  branch: string;
  /** YYYY-MM-DD */
  date: string;
  opening: Record<string, ChecklistMarkEntry>;
  openedAt?: string;
  openedBy?: string;
  closing: Record<string, ChecklistMarkEntry>;
  closedAt?: string;
  closedBy?: string;
  closedWithPending?: number;
  handover: HandoverItem[];
}

// ─── Employee Onboarding & Offboarding ─────────────────────────────────────
// Case-driven workflows (ONB-2026-0024 / OFF-2026-0007). Employees are never deleted —
// finalising an offboarding sets the staff record to Inactive so client history keeps its
// author.
export type CaseOwner = 'HR' | 'IT' | 'Branch Manager' | 'Finance' | 'Employee';
export type OnboardingStage = 'Pre-Joining' | 'First Day' | 'First Week' | 'First 30 Days' | 'Complete';
export type OffboardingStage = 'Notice' | 'Handover' | 'Access & Assets' | 'Clearance' | 'Exit Interview' | 'Closed';
export type ClearanceDept = 'HR' | 'Branch Manager' | 'IT' | 'Finance';
export type OffboardingReason = 'Resignation' | 'Contract end' | 'Termination' | 'Transfer';

export interface CaseTask {
  id: string;
  label: string;
  owner: CaseOwner;
  /** Pipeline stage the task belongs to. */
  stage: OnboardingStage | OffboardingStage;
  /** Onboarding: must be done before "Complete Onboarding" unlocks. */
  critical?: boolean;
  /** Role-specific training (onboarding) or asset/access item (offboarding). */
  kind?: 'training' | 'asset' | 'access';
  doneBy?: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  doneAt?: string;
}

export interface CaseEvent {
  id: string;
  at: string;
  by: string;
  text: string;
}

export interface OnboardingCase {
  id: string;
  code: string;
  branch: string;
  employeeName: string;
  email: string;
  role: StaffRole;
  /** YYYY-MM-DD */
  startDate: string;
  createdAt: string;
  createdBy: string;
  tasks: CaseTask[];
  completedAt?: string;
  completedBy?: string;
  log: CaseEvent[];
}

export interface HandoverTransfer {
  id: string;
  at: string;
  by: string;
  category: 'Active leads' | 'Active clients' | 'Pending tasks' | 'Open issues';
  count: number;
  to: string;
}

export interface OffboardingCase {
  id: string;
  code: string;
  branch: string;
  employeeName: string;
  role: StaffRole;
  reason: OffboardingReason;
  /** YYYY-MM-DD */
  noticeDate: string;
  /** YYYY-MM-DD */
  lastWorkingDay: string;
  createdAt: string;
  createdBy: string;
  tasks: CaseTask[];
  clearance: Partial<Record<ClearanceDept, { by: string; at: string }>>;
  exitInterview?: { at: string; by: string; notes: string; declined?: boolean };
  handoverLog: HandoverTransfer[];
  finalizedAt?: string;
  finalizedBy?: string;
  log: CaseEvent[];
}

// ─── Communication Log ──────────────────────────────────────────────────────
// Every interaction with a client, across all staff and stages — the institutional memory of
// the relationship. Keyed by Client ID so the same history follows the client from the
// counselor's profile through to the application profile.
export type CommunicationChannel = 'Phone call' | 'WhatsApp' | 'Email' | 'SMS' | 'In-person' | 'Video consultation';
export type CommunicationDirection = 'Outbound' | 'Inbound';

export interface CommunicationEntry {
  id: string;
  /** Client ID (clientIdFor) — shared by the client's counselor record and application. */
  clientKey: string;
  clientName: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  /** When the interaction happened (ISO). */
  occurredAt: string;
  summary: string;
  outcome: string;
  nextAction?: string;
  /** YYYY-MM-DD */
  nextActionDate?: string;
  loggedBy: string;
  loggedByRole: Role;
  /** When it was logged (ISO). */
  createdAt: string;
}

// ─── Marketing Department ───────────────────────────────────────────────────
// Centralised above the branches. Marketing sees leads, the conversion pipeline and
// marketing-attributed revenue across every branch — nothing else (see marketingDept.ts).
export type MarketingRole = 'Marketing Manager' | 'Leads Specialist' | 'Content Planner' | 'Graphics Designer';
export type LeadChannel = 'Facebook' | 'Instagram' | 'TikTok' | 'Website';
/** Raw (just arrived) → Qualified → Assigned (pushed to a branch). Disqualified leaves the funnel. */
export type MarketingLeadStage = 'Raw' | 'Qualified' | 'Assigned' | 'Disqualified';

export interface MarketingLead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  /** Mandatory: which channel the lead came in on. */
  source: LeadChannel;
  /** The campaign it's attributed to, when there is one. */
  campaignId?: string;
  /** What they wrote in the form / DM / comment. */
  message?: string;
  /** "YYYY-MM-DD HH:mm" */
  receivedAt: string;
  stage: MarketingLeadStage;
  preferredCountry?: string;
  interestedProgram?: string;
  /** e.g. "Jan 2027" */
  intake?: string;
  academicBackground?: string;
  /** e.g. "IELTS 6.5", "Preparing for PTE", "Not taken" */
  englishTest?: string;
  preferredBranch?: string;
  /** Marketing's own notes from the enquiry — never the branch's counselor notes. */
  notes?: string;
  /** Full intake profile captured by the Add Lead form (same fields as the Front Desk intake),
   * handed to the branch on assignment so it doesn't have to re-collect it. */
  purpose?: string;
  address?: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  academics?: AcademicEntry[];
  workExperience?: string;
  qualifiedBy?: string;
  qualifiedAt?: string;
  disqualifyReason?: string;
  assignedBy?: string;
  assignedAt?: string;
  /** The IntakeStudent created in the branch queue on assignment. */
  intakeId?: string;
}

export type CampaignObjective = 'Lead Generation' | 'Brand Awareness' | 'Event Registration' | 'Engagement';
export interface Campaign {
  id: string;
  name: string;
  platform: LeadChannel | 'Multi-platform';
  objective: CampaignObjective;
  /** Target number of leads. */
  target: number;
  startDate: string;
  endDate: string;
  budget: number;
  createdBy: string;
}

/** One ad-spend entry against a campaign. */
export interface AdSpend {
  id: string;
  campaignId: string;
  date: string;
  amount: number;
  adName: string;
  loggedBy: string;
}

/** Planner → branch ask for raw material. Waiting (on the branch) → Received → Ready (with the designer). */
export type ContentRequestStatus = 'Waiting' | 'Received' | 'Ready';
export interface ContentRequest {
  id: string;
  topic: string;
  targetBranch: string;
  /** Target person — the counselor asked to record it. */
  targetCounselor: string;
  /** What is needed, in plain words — e.g. "60-second video", "3 photos of the office". */
  needed: string;
  deadline: string;
  notes?: string;
  campaignId?: string;
  requestedBy: string;
  requestedAt: string;
  status: ContentRequestStatus;
  receivedAt?: string;
  /** Where the delivered material is (Drive/WhatsApp/folder link), and any note on receipt. */
  materialLink?: string;
  receivedNote?: string;
  /** Every reminder sent to the counselor while Waiting. */
  reminders?: string[];
  /** Files the counselor submitted from their Marketing tab, and who submitted. */
  submittedFiles?: DeliveredFile[];
  submittedBy?: string;
  /** Why it was sent back to Waiting (e.g. footage unusable) — the latest reason. */
  reopenReason?: string;
  sentToDesignerAt?: string;
  /** The Content Calendar piece this feeds (set up front when requested from a calendar idea,
   * or created by "Send to Designer"), and the design task it became. */
  contentItemId?: string;
  designTaskId?: string;
  /** Branch Manager delegation — who handed it to `targetCounselor`, the branch's own due date
   * (earlier than or equal to Marketing's deadline) and any instruction. */
  delegatedBy?: string;
  delegatedAt?: string;
  internalDue?: string;
  delegationNote?: string;
}

/** One planned piece of content on the Content Calendar. */
export type ContentStatus = 'Idea' | 'In Progress' | 'Ready' | 'Scheduled' | 'Published';
export interface ContentItem {
  id: string;
  title: string;
  platform: string;
  /** Who's working on it — the planner, the designer, or a counselor. */
  assignee: string;
  /** YYYY-MM-DD */
  deadline: string;
  status: ContentStatus;
  /** Where the raw material came from, when it came from a branch. */
  branch?: string;
  person?: string;
  requestId?: string;
  publishedAt?: string;
  publishedLink?: string;
  createdBy: string;
}

/** Static design work: Requested → In Progress → Ready for Review → Approved → Scheduled. */
export type DesignStage = 'Requested' | 'In Progress' | 'Ready for Review' | 'Approved' | 'Scheduled';
export type DesignType = 'Post' | 'Story' | 'Reel' | 'Poster';
export type TaskPriority2 = 'High' | 'Medium' | 'Low';

/** A file the designer attached as the final output (or a link to it). */
export interface DeliveredFile {
  id: string;
  name: string;
  /** Bytes — absent for links. */
  size?: number;
  /** Shared link (Drive etc.) — persists; a browser upload only has a session preview URL. */
  url?: string;
  uploadedAt: string;
  by: string;
}

export interface DesignTask {
  id: string;
  title: string;
  /** Instructions — what the design must do. */
  brief: string;
  type?: DesignType;
  priority?: TaskPriority2;
  /** The copy / caption that goes on or with the design. */
  caption?: string;
  /** Reference material — inspiration or previous posts to match. */
  references?: string[];
  /** Assets supplied with the request (logo pack, photos, footage). */
  assets?: { name: string; url?: string }[];
  platform: LeadChannel;
  /** Required size. */
  dimensions: string;
  deadline: string;
  stage: DesignStage;
  requestedBy: string;
  assignee?: string;
  campaignId?: string;
  /** Content Calendar piece this design is for. */
  contentItemId?: string;
  finalFiles?: DeliveredFile[];
  /** Last reviewer comment when sent back to In Progress. */
  reviewNote?: string;
}

/** Video editing work, kept separate from static designs. */
export type VideoStatus = 'To Edit' | 'In Progress' | 'Ready for Review' | 'Completed';
export interface VideoTask {
  id: string;
  title: string;
  /** Link to the raw footage (usually the branch counselor's upload). */
  sourceLink?: string;
  instructions: string;
  platform: LeadChannel | 'YouTube';
  /** e.g. "60 sec", "15–30 sec" */
  duration: string;
  deadline: string;
  status: VideoStatus;
  priority?: TaskPriority2;
  requestedBy: string;
  assignee?: string;
  /** Where the footage came from. */
  branch?: string;
  person?: string;
  requestId?: string;
  contentItemId?: string;
  finalFiles?: DeliveredFile[];
  reviewNote?: string;
  completedAt?: string;
}

export interface SocialPost {
  id: string;
  platform: LeadChannel;
  caption: string;
  /** "YYYY-MM-DD HH:mm" */
  scheduledAt: string;
  status: 'Scheduled' | 'Published';
  campaignId?: string;
  designTaskId?: string;
  createdBy: string;
  publishedAt?: string;
  reach?: number;
  engagements?: number;
  leads?: number;
}

export interface SeoTask {
  id: string;
  title: string;
  type: 'Blog Post' | 'On-page' | 'Technical' | 'Backlinks' | 'Keyword Research';
  keyword?: string;
  url?: string;
  assignee: string;
  due: string;
  status: 'To Do' | 'In Progress' | 'Done';
}

export interface SeoKeyword {
  keyword: string;
  position: number;
  previous: number;
  monthlySearches: number;
  url: string;
}

/** A Leads Specialist's "Flag / Ping Branch" alert to a Branch Manager about stuck leads. */
export interface BranchPing {
  id: string;
  branch: string;
  rule: 'uncontacted' | 'consultation-stuck' | 'no-activity';
  leadIds: string[];
  at: string;
  by: string;
}

export interface MarketingStore {
  pings: BranchPing[];
  leads: MarketingLead[];
  campaigns: Campaign[];
  adSpend: AdSpend[];
  contentRequests: ContentRequest[];
  contentItems: ContentItem[];
  designTasks: DesignTask[];
  videoTasks: VideoTask[];
  posts: SocialPost[];
  seoTasks: SeoTask[];
  keywords: SeoKeyword[];
}

// ─── Branch Manager Workspace ──────────────────────────────────────────────
// Records the Branch Manager raises with Head Office (content, marketing support, IT) and
// client transfers between branches. Held in App state beside the other operational stores.

export type BranchContentType = 'Flyer' | 'Poster' | 'Social Reel' | 'Event Banner';
export type BranchRequestStatus = 'Requested' | 'In Production' | 'Review' | 'Delivered';

/** Collateral a branch asks central Marketing to produce. */
export interface BranchContentRequest {
  id: string;
  /** e.g. MKR-0142 */
  code: string;
  branch: string;
  type: BranchContentType;
  /** Target intake, e.g. "Jan 2027". */
  intake: string;
  country: string;
  notes: string;
  /** YYYY-MM-DD */
  neededBy: string;
  requestedBy: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  requestedAt: string;
  status: BranchRequestStatus;
  /** Set by Marketing as the piece moves along. */
  updatedAt?: string;
  marketingNote?: string;
  deliveredLink?: string;
}

export type MarketingSupportKind = 'Local Ad Boost' | 'Event Sponsorship' | 'Regional Campaign Drive';
export type MarketingSupportStatus = 'Submitted' | 'Under Review' | 'Approved' | 'Declined';

/** Budget / campaign help a branch asks central Marketing for. */
export interface MarketingSupportRequest {
  id: string;
  code: string;
  branch: string;
  kind: MarketingSupportKind;
  title: string;
  /** Requested budget in NPR (0 when none is needed). */
  budget: number;
  /** YYYY-MM-DD */
  startDate: string;
  endDate?: string;
  audience: string;
  justification: string;
  requestedBy: string;
  requestedAt: string;
  status: MarketingSupportStatus;
  responseNote?: string;
}

export type ItTicketCategory = 'Hardware' | 'CRM Issue' | 'Software Access' | 'Network/VoIP';
export type ItTicketPriority = 'High' | 'Medium' | 'Low';
export type ItTicketStatus = 'Open' | 'In Progress' | 'Resolved';

export interface ItTicketEvent {
  at: string;
  by: string;
  text: string;
}

export interface ItTicket {
  id: string;
  /** e.g. IT-2026-0318 */
  code: string;
  branch: string;
  category: ItTicketCategory;
  priority: ItTicketPriority;
  subject: string;
  description: string;
  /** File names only — uploads are mocked until storage is wired up. */
  attachments: string[];
  raisedBy: string;
  raisedAt: string;
  status: ItTicketStatus;
  /** IT engineer handling it. */
  assignee?: string;
  resolution?: string;
  resolvedAt?: string;
  history: ItTicketEvent[];
}

export type TransferStatus = 'Pending' | 'Approved' | 'Rejected';

/** Append-only audit entry on an inter-branch transfer. */
export interface TransferLogEntry {
  at: string;
  by: string;
  role: string;
  text: string;
}

/** A client registered at `fromBranch` who wants to continue at `toBranch`. Requested by the
 * receiving branch, decided by the origin branch's manager. */
export interface BranchTransfer {
  id: string;
  /** e.g. TRF-2026-0021 */
  code: string;
  /** CounselorStudent / IntakeStudent id. */
  clientKey: string;
  /** Portal Client ID (CSC-YYYY-####). */
  clientId: string;
  clientName: string;
  fromBranch: string;
  toBranch: string;
  fromCounselor: string;
  /** Counselor at the receiving branch who takes over on approval. */
  toCounselor: string;
  reason: string;
  /** YYYY-MM-DD — when the client visited the receiving branch. */
  visitDate: string;
  requestedBy: string;
  requestedAt: string;
  status: TransferStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  log: TransferLogEntry[];
}

export interface ManagerWorkspaceStore {
  contentRequests: BranchContentRequest[];
  supportRequests: MarketingSupportRequest[];
  itTickets: ItTicket[];
  transfers: BranchTransfer[];
}

// ─── Super Admin · Administrative overrides ────────────────────────────────
/** One Super Admin override. Append-only: entries are never edited or removed. */
export interface AuditOverrideEntry {
  id: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  at: string;
  by: string;
  /** What was overridden, e.g. "Task · Renew printer service contract (Pokhara)". */
  record: string;
  field: string;
  from: string;
  to: string;
  reason: string;
}

// ─── Country-specific application pipeline ─────────────────────────────────
export type PipelineCountry = 'Australia' | 'United Kingdom' | 'New Zealand' | 'USA';

export interface PipelineStepRecord {
  /** "YYYY-MM-DD h:mm AM/PM" */
  doneAt?: string;
  doneBy?: string;
  /** Step input, e.g. "Conditional", "Approved", or an interview date-time (YYYY-MM-DDTHH:mm). */
  value?: string;
}

export interface PipelineLogEntry {
  at: string;
  by: string;
  text: string;
}

export interface CountryPipelineState {
  country: PipelineCountry;
  steps: Record<string, PipelineStepRecord>;
  /** Checklist ticks per checklist key → item key. */
  checklists: Record<string, Record<string, boolean>>;
  /** UK only — off skips Pre-CAS Deposit and Pre-CAS Interview. */
  requiresPreCasInterview?: boolean;
  /** The institution's own ID for the client, required to mark the fee paid (Australia). */
  universityClientId?: string;
  log: PipelineLogEntry[];
}

// ─── Service Charges (price list) ──────────────────────────────────────────
/** One version of a service price, set by the Super Admin. Never edited: a fee change or a
 * retirement is a new version with its own effective date, so history is kept. */
export interface ServicePrice {
  id: string;
  /** What the client buys, e.g. "Student Visa", "Student Visa + SOWP", "Visitor Visa". */
  name: string;
  /** Ledger bucket reports group by. */
  category: FinService;
  /** Destination country, or ALL_COUNTRIES as the fallback for countries without their own price. */
  country: string;
  fee: number;
  currency: 'NPR';
  /** YYYY-MM-DD — this version applies from this day. */
  effectiveFrom: string;
  /** false = the service is withdrawn from this date. */
  active: boolean;
  note?: string;
  setBy: string;
  /** "YYYY-MM-DD h:mm AM/PM" */
  setAt: string;
}
