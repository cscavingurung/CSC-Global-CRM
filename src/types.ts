export type Role =
  | 'super_admin'
  | 'marketing'
  | 'finance'
  | 'branch_manager'
  | 'receptionist'
  | 'counselor'
  | 'application_officer';

export interface MockUser {
  name: string;
  role: Role;
  branch: string;
  email: string;
}

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  viewOnly?: boolean;
}

export type NavConfig = Record<Role, NavItem[]>;

export interface IntakeStudent {
  id: string;
  name: string;
  phone: string;
  email: string;
  country: string;
  purpose: string;
  dob: string;
  gender: string;
  maritalStatus: string;
  academicQualification: string;
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
  country: string;
  purpose: string;
  dob: string;
  gender: string;
  maritalStatus: string;
  academicQualification: string;
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
  status: OfferStatus;
  /** Free-text program/course name. */
  course?: string;
  /** Free-text intake period (e.g. "Jan 2027") — deferrable after it's first set. */
  intake?: string;
  /** Reference number captured at Fee Paid. */
  clientRefId?: string;
  /** Institution-issued Student ID, captured when the fee is confirmed paid. */
  studentId?: string;
  /** Set when the offer attempt is first added — the Status Tracker's "Enrolled" date. */
  enrolledDate?: string;
  /** Set when status moves to 'Applied to Institution'. */
  appliedDate?: string;
  /** Set when status reaches 'Offer Received' or 'Rejected'. */
  outcomeDate?: string;
  /** Set when status reaches 'Fee Paid'. */
  feePaidDate?: string;
  /** Date the current status was entered — powers "days in current status" staleness checks. */
  statusUpdatedAt: string;
  /** Flagged when the institution asks for more information — set by Counselor, Branch Manager or V/A Officer. */
  furtherInfoRequired?: boolean;
  notes?: string;
}

// Stage 2 — unlocked once an OfferApplication reaches 'Fee Paid' (Study cases) or straight
// after enrolment (SOWP / Visit cases). Three default checklist items plus any custom items
// staff add. Every item must be ticked before advancing past 'Preparing Documents'.
export interface VisaChecklist {
  /** Legacy field — no longer part of the default checklist, kept so old records still load. */
  noc: boolean;
  medical: boolean;
  financial: boolean;
  policeReport: boolean;
}

/** A checklist item added by a staff member on top of the default three. */
export interface CustomChecklistItem {
  id: string;
  label: string;
  done: boolean;
  /** Name of the staff member who added the item. */
  addedBy: string;
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
  notes: string;
  /** Set via the "Request Refund" action after a Visa Refused outcome. */
  refundRequested?: boolean;
  refundRequestedDate?: string;
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
  country: string;
  purpose: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  academicQualification?: string;
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
}

export type StaffRole =
  | 'Front Desk Officer'
  | 'Counselor'
  | 'V/A Officer'
  | 'Branch Manager'
  | 'Super Admin'
  | 'Marketing'
  | 'Finance';
export type StaffStatus = 'Active' | 'Inactive';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  status: StaffStatus;
  branch: string;
}

export interface ActivityEntry {
  id: string;
  message: string;
  timestamp: string;
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
}
