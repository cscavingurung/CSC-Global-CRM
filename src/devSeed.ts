// Dummy data used for local testing whenever Supabase isn't configured or a table comes
// back empty. Every list holds 15–20 records spread across branches, roles and pipeline
// stages so each role's dashboard has something to show. Dates are relative to "now" so
// the "today" / "this week" widgets stay populated whenever the app is opened.
import {
  AppNotification,
  ApplicationRecord,
  Branch,
  CommissionRecord,
  CommunicationEntry,
  BranchNotice,
  BranchIssue,
  IssueActivity,
  AttendanceRecord,
  AttendanceCorrection,
  LeaveRecord,
  Holiday,
  PerformanceReview,
  PayProfile,
  PayrollRun,
  PayrollManual,
  PayrollAuto,
  FinTransaction,
  ExpenseRequest,
  AttendanceExplanation,
  BranchDayLog,
  ChecklistMarkEntry,
  OnboardingCase,
  OffboardingCase,
  CaseTask,
  BranchNoticeReceipt,
  ConsultationOutcome,
  ConsultationStatus,
  Counselor,
  CounselorStudent,
  DailyTask,
  IntakeStudent,
  OfferStatus,
  Partner,
  StaffMember,
  VisaStageStatus,
  MarketingStore,
  MarketingLead,
  MarketingRole,
  StaffRole,
  BranchContentRequest,
  ContentRequest,
  MarketingSupportRequest,
  ItTicket,
  BranchTransfer,
  ManagerWorkspaceStore,
  AuditOverrideEntry,
  ServicePrice,
} from './types';
import { formatSubmittedAt } from './dateTime';
import { noticeRecipients } from './branchNotices';
import { offboardingTasksFor, onboardingTasksFor } from './hrCases';
import { workingDaysBetween } from './leave';
import { holidayOn, holidaysFor } from './holidays';
import { DEFAULT_CHECKLIST_KEYS } from './clientPipeline';
import { CHECKLISTS } from './countryPipeline';

function daysAgo(days: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}
/** A seeded moment that's never later than now (today's mock times can't be in the future). */
const pastIso = (d: Date) => new Date(Math.min(d.getTime(), Date.now() - 5 * 60000)).toISOString();
const stamp = (days: number, hour?: number, minute?: number) => formatSubmittedAt(daysAgo(days, hour, minute));
const isoDate = (days: number) => {
  const d = daysAgo(days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── Branches ────────────────────────────────────────────────────────────────
export const SEED_BRANCHES: Branch[] = [
  { id: 'b1', name: 'Kathmandu', location: 'Putalisadak, Kathmandu', manager: 'Sujata Shrestha' },
  { id: 'b2', name: 'Pokhara', location: 'Lakeside, Pokhara', manager: 'Bikash Gurung' },
  { id: 'b3', name: 'Butwal', location: 'Traffic Chowk, Butwal', manager: 'Anita Poudel' },
  { id: 'b4', name: 'Chitwan', location: 'Bharatpur, Chitwan', manager: 'Ramesh Adhikari' },
];

// ── Staff (these are the selectable login users) ────────────────────────────
const staff = (
  id: string, name: string, role: StaffMember['role'], branch: string, status: StaffMember['status'] = 'Active'
): StaffMember => ({
  id,
  name,
  email: `${name.split(' ')[0].toLowerCase()}@csc.edu.np`,
  password: 'Test12345',
  role,
  status,
  branch,
});

export const SEED_STAFF: StaffMember[] = [
  staff('st1', 'Milan Gurung', 'Super Admin', 'Head Office'),
  { ...staff('st2', 'Priya Karki', 'Marketing', 'Head Office'), marketingRole: 'Marketing Manager' as MarketingRole },
  { ...staff('st23', 'Sabina Gurung', 'Marketing', 'Head Office'), marketingRole: 'Leads Specialist' as MarketingRole },
  { ...staff('st24', 'Srishti Shakya', 'Marketing', 'Head Office'), marketingRole: 'Content Planner' as MarketingRole },
  { ...staff('st25', 'Rojan Maharjan', 'Marketing', 'Head Office'), marketingRole: 'Graphics Designer' as MarketingRole },
  staff('st4', 'Sujata Shrestha', 'Branch Manager', 'Kathmandu'),
  staff('st5', 'Bikash Gurung', 'Branch Manager', 'Pokhara'),
  staff('st6', 'Anita Poudel', 'Branch Manager', 'Butwal'),
  staff('st7', 'Ramesh Adhikari', 'Branch Manager', 'Chitwan'),
  staff('st8', 'Sita Maharjan', 'Front Desk Officer', 'Kathmandu'),
  staff('st9', 'Kiran Pun', 'Front Desk Officer', 'Pokhara'),
  staff('st10', 'Nisha Bhandari', 'Front Desk Officer', 'Butwal'),
  staff('st11', 'Pooja Rai', 'Front Desk Officer', 'Chitwan'),
  staff('st12', 'Aarav Sharma', 'Counselor', 'Kathmandu'),
  staff('st13', 'Sneha Tamang', 'Counselor', 'Kathmandu'),
  staff('st14', 'Rohan Lama', 'Counselor', 'Pokhara'),
  staff('st15', 'Asmita Khadka', 'Counselor', 'Pokhara'),
  staff('st16', 'Suman Basnet', 'Counselor', 'Butwal'),
  staff('st17', 'Manisha Joshi', 'Counselor', 'Chitwan'),
  staff('st18', 'Prakash Magar', 'V/A Officer', 'Kathmandu'),
  staff('st19', 'Rina Chaudhary', 'V/A Officer', 'Pokhara'),
  staff('st20', 'Hari Bista', 'V/A Officer', 'Butwal', 'Inactive'),
  // New joiner, mid-onboarding (ONB-2026-0024) — log in as her to see My Onboarding.
  staff('st21', 'Riya Thapa', 'Counselor', 'Kathmandu'),
  // Second front desk officer — absent today without explanation (Late & Absence coverage alert).
  staff('st22', 'Anjali Shrestha', 'Front Desk Officer', 'Kathmandu'),
  // Second Chitwan counselor — the target of the Content Planner's "Why choose Canada" request.
  staff('st26', 'Rupesh Chaudhary', 'Counselor', 'Chitwan'),
];

// ── Counselors ──────────────────────────────────────────────────────────────
const COUNSELOR_COUNTRIES: Record<string, string[]> = {
  'Aarav Sharma': ['Australia', 'New Zealand'],
  'Sneha Tamang': ['Canada', 'USA'],
  'Rohan Lama': ['United Kingdom', 'Australia'],
  'Asmita Khadka': ['Canada'],
  'Suman Basnet': ['Australia', 'USA'],
  'Manisha Joshi': ['United Kingdom', 'New Zealand'],
};
const AVAILABILITY: Counselor['availability'][] = ['Available', 'In Session', 'Available', 'Away', 'Available', 'In Session'];

export const SEED_COUNSELORS: Counselor[] = Object.entries(COUNSELOR_COUNTRIES).map(([name, countries], i) => ({
  id: `c${i + 1}`,
  name,
  countries,
  activeAssignments: 0,
  availability: AVAILABILITY[i],
}));
// Added after the list above so the seeded client round-robin (COUNSELOR_NAMES) stays unchanged.
SEED_COUNSELORS.push({ id: 'c7', name: 'Rupesh Chaudhary', countries: ['Canada', 'Australia'], activeAssignments: 0, availability: 'Available' });

const COUNSELOR_BRANCH: Record<string, string> = Object.fromEntries(
  SEED_STAFF.filter((s) => s.role === 'Counselor').map((s) => [s.name, s.branch])
);
const COUNSELOR_NAMES = Object.keys(COUNSELOR_COUNTRIES);

// ── Clients ─────────────────────────────────────────────────────────────────
interface ClientSeed {
  name: string;
  gender: 'Male' | 'Female';
  country: string;
  purpose: string;
  level: string;
  stream: string;
  gpa: string;
  ielts: string;
}

const CLIENTS: ClientSeed[] = [
  { name: 'Aayush Neupane', gender: 'Male', country: 'Australia', purpose: 'Study', level: '+2/A Level', stream: 'Science', gpa: '3.4', ielts: 'IELTS 6.5' },
  { name: 'Bipana Thapa', gender: 'Female', country: 'Canada', purpose: 'Study', level: "Bachelor's", stream: 'Business Studies', gpa: '3.2', ielts: 'IELTS 7.0' },
  { name: 'Chiranjibi Oli', gender: 'Male', country: 'United Kingdom', purpose: 'Study', level: "Bachelor's", stream: 'Computer Science', gpa: '3.6', ielts: 'PTE 65' },
  { name: 'Dikshya Rana', gender: 'Female', country: 'Australia', purpose: 'SOWP', level: "Bachelor's", stream: 'Nursing', gpa: '3.1', ielts: 'IELTS 6.0' },
  { name: 'Eshan Koirala', gender: 'Male', country: 'USA', purpose: 'Study', level: '+2/A Level', stream: 'Management', gpa: '3.0', ielts: 'Duolingo 115' },
  { name: 'Faguni Shahi', gender: 'Female', country: 'New Zealand', purpose: 'Study', level: "Master's", stream: 'Public Health', gpa: '3.5', ielts: 'IELTS 7.5' },
  { name: 'Gaurav Pandey', gender: 'Male', country: 'Canada', purpose: 'PR', level: "Bachelor's", stream: 'Civil Engineering', gpa: '3.3', ielts: 'IELTS 7.0' },
  { name: 'Hima KC', gender: 'Female', country: 'Australia', purpose: 'Tourist', level: 'SEE', stream: 'General', gpa: '3.8', ielts: 'N/A' },
  { name: 'Ishwor Dahal', gender: 'Male', country: 'United Kingdom', purpose: 'Study', level: '+2/A Level', stream: 'Science', gpa: '3.7', ielts: 'IELTS 6.5' },
  { name: 'Jyoti Sapkota', gender: 'Female', country: 'Australia', purpose: 'Study', level: "Bachelor's", stream: 'Hospitality', gpa: '2.9', ielts: 'PTE 58' },
  { name: 'Kushal Ghimire', gender: 'Male', country: 'Canada', purpose: 'Study', level: "Bachelor's", stream: 'Information Technology', gpa: '3.4', ielts: 'IELTS 6.5' },
  { name: 'Laxmi Bhattarai', gender: 'Female', country: 'USA', purpose: 'Study', level: "Master's", stream: 'Data Science', gpa: '3.9', ielts: 'IELTS 8.0' },
  { name: 'Manoj Regmi', gender: 'Male', country: 'Australia', purpose: 'SOWP', level: "Bachelor's", stream: 'Accounting', gpa: '3.0', ielts: 'IELTS 6.0' },
  { name: 'Nirjala Acharya', gender: 'Female', country: 'United Kingdom', purpose: 'Study', level: '+2/A Level', stream: 'Management', gpa: '3.2', ielts: 'PTE 62' },
  { name: 'Om Prakash Yadav', gender: 'Male', country: 'New Zealand', purpose: 'Study', level: "Bachelor's", stream: 'Agriculture', gpa: '3.1', ielts: 'IELTS 6.5' },
  { name: 'Pratiksha Luitel', gender: 'Female', country: 'Canada', purpose: 'Study', level: '+2/A Level', stream: 'Science', gpa: '3.6', ielts: 'IELTS 7.0' },
  { name: 'Rajan Subedi', gender: 'Male', country: 'Australia', purpose: 'Study', level: "Bachelor's", stream: 'Mechanical Engineering', gpa: '3.3', ielts: 'PTE 60' },
  { name: 'Samikshya Pant', gender: 'Female', country: 'USA', purpose: 'Tourist', level: "Bachelor's", stream: 'Arts', gpa: '3.0', ielts: 'N/A' },
  { name: 'Tulsi Giri', gender: 'Female', country: 'Canada', purpose: 'Study', level: "Bachelor's", stream: 'Nursing', gpa: '3.4', ielts: 'IELTS 7.0' },
  { name: 'Ujjwal Khatri', gender: 'Male', country: 'Australia', purpose: 'Study', level: '+2/A Level', stream: 'Management', gpa: '2.8', ielts: 'IELTS 6.0' },
];

const CITIES = ['Kathmandu', 'Lalitpur', 'Pokhara', 'Butwal', 'Bharatpur', 'Bhaktapur', 'Dharan', 'Hetauda'];
const PLATFORMS = ['Facebook', 'Instagram', 'Website', 'Tiktok', 'LinkedIn'];

function baseProfile(c: ClientSeed, i: number) {
  return {
    name: c.name,
    phone: `98${String(41000000 + i * 137913).padStart(8, '0')}`,
    email: `${c.name.split(' ')[0].toLowerCase()}.${c.name.split(' ').slice(-1)[0].toLowerCase()}@gmail.com`,
    address: `${CITIES[i % CITIES.length]}, Nepal`,
    country: c.country,
    purpose: c.purpose,
    dob: `${1996 + (i % 9)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    gender: c.gender,
    maritalStatus: i % 5 === 3 ? 'Married' : 'Single',
    academics: [{ level: c.level, stream: c.stream, gpa: c.gpa, completionYear: String(2018 + (i % 7)) }],
    ieltsPte: c.ielts,
    workExperience: i % 3 === 0 ? `${(i % 4) + 1} years` : 'None',
  };
}

// First 16 clients are assigned to counselors; the last 4 are fresh, unassigned leads.
// Clients 12–15 are marketing leads (with a platform source); 18–19 sit in the broadcast pool.
const ASSIGNED_COUNT = 16;

export const SEED_STUDENTS: IntakeStudent[] = CLIENTS.map((c, i) => {
  const assigned = i < ASSIGNED_COUNT;
  const counselor = assigned ? COUNSELOR_NAMES[i % COUNSELOR_NAMES.length] : null;
  const isMarketing = (i >= 12 && i < 16) || i >= 18;
  const inBroadcastPool = i >= 18;
  const branch = counselor ? COUNSELOR_BRANCH[counselor] : inBroadcastPool ? '' : SEED_BRANCHES[i % SEED_BRANCHES.length].name;
  const submitted = stamp(Math.max(0, 20 - i), 9 + (i % 8), (i * 7) % 60);
  return {
    id: `s${i + 1}`,
    ...baseProfile(c, i),
    submittedAt: submitted,
    addedBy: isMarketing ? 'Priya Karki' : 'Sita Maharjan',
    visitDateTime: submitted,
    referredThrough: isMarketing ? 'Marketing' : i % 4 === 1 ? 'Referred By: Friend' : 'Walk Ins',
    platformSource: isMarketing ? PLATFORMS[i % PLATFORMS.length] : undefined,
    broadcastBranch: inBroadcastPool ? SEED_BRANCHES[i % SEED_BRANCHES.length].name : isMarketing ? branch : null,
    broadcastAt: isMarketing ? submitted : undefined,
    claimedBy: isMarketing && counselor ? counselor : null,
    claimedAt: isMarketing && counselor ? submitted : undefined,
    revisitedAt: i % 6 === 2 ? stamp(1, 14, 15) : undefined,
    visitHistory: i % 6 === 2 ? [submitted] : undefined,
    status: assigned ? 'Assigned' : 'New',
    assignedCounselor: counselor,
    branch,
  };
});

// ── Counselor clients ───────────────────────────────────────────────────────
const CONSULTATION_PLAN: { status: ConsultationStatus; outcome: ConsultationOutcome }[] = [
  { status: 'Consultation Complete', outcome: 'Proceeding' },
  { status: 'Consultation Complete', outcome: 'Proceeding' },
  { status: 'Consultation Complete', outcome: 'Proceeding' },
  { status: 'In Progress', outcome: 'Pending' },
  { status: 'Follow Up', outcome: 'Pending' },
  { status: 'Awaiting Consultation', outcome: 'Pending' },
  { status: 'Consultation Complete', outcome: 'Proceeding' },
  { status: 'Consultation Complete', outcome: 'Not Proceeding' },
];

export const SEED_COUNSELOR_STUDENTS: CounselorStudent[] = SEED_STUDENTS.slice(0, ASSIGNED_COUNT).map((s, i) => {
  const plan = CONSULTATION_PLAN[i % CONSULTATION_PLAN.length];
  const complete = plan.status === 'Consultation Complete';
  const followUp = plan.status === 'Follow Up';
  return {
    id: s.id,
    clientId: `CSC-2026-${String(1001 + i)}`,
    name: s.name,
    phone: s.phone,
    email: s.email,
    address: s.address,
    country: s.country,
    purpose: s.purpose,
    dob: s.dob,
    gender: s.gender,
    maritalStatus: s.maritalStatus,
    academics: s.academics,
    ieltsPte: s.ieltsPte,
    workExperience: s.workExperience,
    submittedAt: s.submittedAt,
    addedBy: s.addedBy,
    visitDateTime: s.visitDateTime,
    referredThrough: s.referredThrough,
    platformSource: s.platformSource,
    revisitedAt: s.revisitedAt,
    visitHistory: s.visitHistory,
    assignedDate: isoDate(Math.max(0, 19 - i)),
    assignedCounselor: s.assignedCounselor!,
    consultationStatus: plan.status,
    consultationNotes: complete ? `Discussed ${s.country} options and documentation requirements.` : '',
    followUpDate: followUp ? isoDate(-2 - (i % 3)) : null,
    completedDate: complete ? isoDate(Math.max(0, 15 - i)) : null,
    outcome: plan.outcome,
    leadTemperature: followUp ? (['Hot', 'Mild', 'Cold'] as const)[i % 3] : undefined,
    followUpNote: followUp ? 'Client waiting on IELTS result before deciding.' : undefined,
  };
});

// ── Partners ────────────────────────────────────────────────────────────────
const PARTNER_SEEDS: [string, Partner['type'], number, string, string][] = [
  ['University of Sydney', 'University', 15, 'Australia', 'Bachelor of IT'],
  ['Monash University', 'University', 15, 'Australia', 'Master of Data Science'],
  ['Deakin University', 'University', 12, 'Australia', 'Bachelor of Nursing'],
  ['Kaplan Business School', 'College', 20, 'Australia', 'Diploma of Hospitality'],
  ['University of Toronto', 'University', 10, 'Canada', 'BSc Computer Science'],
  ['Seneca College', 'College', 18, 'Canada', 'Business Administration Diploma'],
  ['Humber College', 'College', 18, 'Canada', 'Practical Nursing'],
  ['Conestoga College', 'College', 17, 'Canada', 'IT Support Services'],
  ['University of Manchester', 'University', 12, 'United Kingdom', 'MSc Engineering Management'],
  ['Coventry University', 'University', 14, 'United Kingdom', 'BA Business Management'],
  ['University of Hertfordshire', 'University', 14, 'United Kingdom', 'MSc Computer Science'],
  ['Arizona State University', 'University', 10, 'USA', 'MS Data Analytics'],
  ['University of Texas at Arlington', 'University', 11, 'USA', 'BS Management'],
  ['University of Auckland', 'University', 12, 'New Zealand', 'Master of Public Health'],
  ['Lincoln University', 'University', 13, 'New Zealand', 'Bachelor of Agriculture'],
];

export const SEED_PARTNERS: Partner[] = PARTNER_SEEDS.map(([name, type, rate, , course], i) => ({
  id: `p${i + 1}`,
  name,
  type,
  commissionRate: rate,
  courses: [
    { name: course, price: 18000 + i * 1500 },
    { name: 'Foundation Pathway', price: 12000 + i * 500 },
  ],
}));

const partnersForCountry = (country: string) => PARTNER_SEEDS.filter((p) => p[3] === country);

// ── Applications ────────────────────────────────────────────────────────────
// Each "Proceeding" client gets an application; extra rows are added from the remaining
// assigned clients so the list reaches 15 and covers every offer/visa stage.
const OFFER_STAGES: OfferStatus[] = [
  'Enrolled', 'Applied to Institution', 'Further Information Required', 'Offer Received', 'Rejected', 'Fee Paid',
];
// Visa stage per application row (only rows that reached the visa stage use it). Chosen so the
// counselor's Visa Approved page has both Study clients (with an intake) and SOWP / Tourist ones.
const VISA_PLAN: Record<number, VisaStageStatus> = {
  3: 'Visa Applied', 8: 'Visa Approved', 9: 'Visa Approved', 10: 'Visa Applied',
  11: 'Visa Approved', 12: 'Visa Approved', 13: 'Visa Refused', 14: 'Preparing Documents',
};

const applicationSources = [
  ...SEED_COUNSELOR_STUDENTS.filter((c) => c.outcome === 'Proceeding'),
  ...SEED_COUNSELOR_STUDENTS.filter((c) => c.outcome !== 'Proceeding'),
].slice(0, 15);

// Visa timeline dates. Still-open files have sat in their status for 2–4 weeks, so the Super
// Admin's "overdue visa cases" and the V/A queues' staleness flags have real examples.
function visaTimeline(i: number, status: VisaStageStatus) {
  const open = status !== 'Visa Approved' && status !== 'Visa Refused';
  const lag = open ? 14 + (i % 3) * 5 : 0;
  const updated = (i % 4) + lag;
  return {
    preparingDocsDate: isoDate(4 + lag),
    fileReadyDate: status !== 'Preparing Documents' ? isoDate(3 + lag) : undefined,
    appliedDate: ['Visa Applied', 'Visa Approved', 'Visa Refused'].includes(status) ? isoDate(2 + lag) : undefined,
    statusUpdatedAt: isoDate(updated),
    statusUpdatedTime: pastIso(daysAgo(updated, 10 + (i % 7), (i * 17) % 60)),
  };
}

export const SEED_APPLICATIONS: ApplicationRecord[] = applicationSources.map((c, i) => {
  const isStudy = c.purpose === 'Study';
  const partnerOptions = partnersForCountry(c.country);
  const partner = partnerOptions[i % Math.max(1, partnerOptions.length)] ?? PARTNER_SEEDS[0];
  // Rows 0–8 sit in the offer stage; rows 9–14 have moved on to the visa stage.
  const inVisa = i >= 9 || !isStudy;
  const offerStatus: OfferStatus = inVisa ? 'Fee Paid' : OFFER_STAGES[i % OFFER_STAGES.length];
  const visaStatus = VISA_PLAN[i] ?? 'Preparing Documents';
  const branch = COUNSELOR_BRANCH[c.assignedCounselor];
  // Offer / visa updates are made by the branch's V/A Officer (the counselor where there's none).
  const officer = SEED_STAFF.find((st) => st.branch === branch && st.role === 'V/A Officer' && st.status === 'Active')?.name ?? c.assignedCounselor;
  return {
    id: `a${i + 1}`,
    clientId: c.clientId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    country: c.country,
    purpose: c.purpose,
    dob: c.dob,
    gender: c.gender,
    maritalStatus: c.maritalStatus,
    academics: c.academics,
    ieltsPte: c.ieltsPte,
    workExperience: c.workExperience,
    counselor: c.assignedCounselor,
    consultationDate: c.completedDate ?? isoDate(10),
    addedBy: c.addedBy,
    platformSource: c.platformSource,
    visitDateTime: c.visitDateTime,
    consultationNotes: c.consultationNotes || 'Initial consultation done.',
    branch,
    offerApplications: isStudy
      ? [{
          id: `o${i + 1}`,
          institution: partner[0],
          country: c.country,
          course: partner[4],
          intake: i % 2 === 0 ? 'Feb 2027' : 'Jul 2027',
          status: offerStatus,
          statusUpdatedAt: isoDate(i % 6),
          statusUpdatedTime: pastIso(daysAgo(i % 6, 9 + (i % 8), (i * 13) % 60)),
          statusUpdatedBy: offerStatus === 'Enrolled' ? c.assignedCounselor : officer,
          enrolledDate: isoDate(14),
          enrolledBy: c.assignedCounselor,
          appliedDate: offerStatus !== 'Enrolled' ? isoDate(10) : undefined,
          appliedBy: offerStatus !== 'Enrolled' ? 'Prakash Magar' : undefined,
          outcomeDate: ['Offer Received', 'Rejected', 'Fee Paid'].includes(offerStatus) ? isoDate(6) : undefined,
          outcomeBy: ['Offer Received', 'Rejected', 'Fee Paid'].includes(offerStatus) ? 'Prakash Magar' : undefined,
          feePaidDate: offerStatus === 'Fee Paid' ? isoDate(4) : undefined,
          feePaidBy: offerStatus === 'Fee Paid' ? 'Prakash Magar' : undefined,
          furtherInfoRequired: offerStatus === 'Further Information Required',
          clientRefId: offerStatus === 'Fee Paid' ? `REF-${5000 + i}` : undefined,
          studentId: offerStatus === 'Fee Paid' ? `STU${880000 + i}` : undefined,
        }]
      : [],
    visaApplication: inVisa
      ? {
          ...visaTimeline(i, visaStatus),
          status: visaStatus,
          // Files past Preparing Documents have every document; ones still preparing have
          // only the client information group ticked so far.
          checklist: Object.fromEntries(
            DEFAULT_CHECKLIST_KEYS.map((key, k) => [key, visaStatus !== 'Preparing Documents' || k < 5])
          ),
          outcomeDate: ['Visa Approved', 'Visa Refused'].includes(visaStatus) ? isoDate(1) : undefined,
          statusUpdatedBy: officer,
          notes: '',
          // The refused file has a refund requested, with a follow-up due in two days.
          ...(visaStatus === 'Visa Refused'
            ? { refundRequested: true, refundRequestedDate: isoDate(1), refundFollowUpDate: isoDate(-2), refundFollowUpNote: 'Check refund status with the institution', refundFollowUpSetBy: c.assignedCounselor }
            : {}),
          enrollmentCompleted: visaStatus === 'Visa Approved' && i % 2 === 0,
          enrollmentCompletedDate: visaStatus === 'Visa Approved' && i % 2 === 0 ? isoDate(0) : undefined,
        }
      : null,
    // Enrolment documents: complete once the offer has been applied for; partly collected
    // for files still sitting at Enrolled.
    enrolmentChecklist: isStudy
      ? {
          marks: Object.fromEntries(
            (offerStatus === 'Enrolled' ? ['academics', 'passport'] : ['academics', 'passport', 'englishProficiency'])
              .map((key) => [key, { by: officer, date: isoDate(12) }])
          ),
          custom: offerStatus === 'Enrolled' ? [{ id: `ec-seed-${i}`, label: 'Work experience letter', done: false, addedBy: officer }] : [],
        }
      : undefined,
    withdrawn: false,
    notes: i % 4 === 0
      ? [{ id: `n${i + 1}`, text: 'Documents verified at the front desk.', authorName: 'Sujata Shrestha', authorRole: 'branch_manager', createdAt: stamp(3, 11, 20) }]
      : [],
  };
});

// ── Commissions ─────────────────────────────────────────────────────────────
export const SEED_COMMISSIONS: CommissionRecord[] = SEED_APPLICATIONS.map((a, i) => {
  const partner = SEED_PARTNERS.find((p) => p.name === a.offerApplications[0]?.institution) ?? SEED_PARTNERS[i % SEED_PARTNERS.length];
  return {
    id: `cm${i + 1}`,
    studentName: a.name,
    branch: a.branch,
    consultant: a.counselor,
    partner: partner.name,
    fullFee: partner.courses[0].price,
    commissionRate: partner.commissionRate,
    commissionStatus: i % 3 === 0 ? 'Paid' : 'Pending',
  };
});

// ── Notifications ───────────────────────────────────────────────────────────
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000);

export const SEED_NOTIFICATIONS: AppNotification[] = [
  ...SEED_STUDENTS.slice(16).map((s, i): AppNotification => ({
    id: `seed-n-intake-${i}`,
    trigger: 'new-intake',
    studentName: s.name,
    messageBefore: 'New lead from ',
    messageAfter: ` — ${s.country}, ${s.purpose}`,
    createdAt: minutesAgo(15 + i * 30),
    read: false,
    role: 'receptionist',
    branch: s.branch || s.broadcastBranch || 'Kathmandu',
    navigateTo: 'assign-counselor',
    actorName: SEED_STAFF.find((st) => st.role === 'Front Desk Officer' && st.branch === (s.branch || s.broadcastBranch))?.name,
  })),
  ...SEED_COUNSELOR_STUDENTS.slice(0, 6).map((c, i): AppNotification => ({
    id: `seed-n-assign-${i}`,
    trigger: 'assigned-to-counselor',
    studentName: c.name,
    messageBefore: '',
    messageAfter: ` assigned to you — ${c.country}, ${c.purpose}`,
    createdAt: minutesAgo(60 + i * 90),
    read: i > 2,
    role: 'counselor',
    recipientName: c.assignedCounselor,
    navigateTo: 'my-students',
    actorName: SEED_STAFF.find((st) => st.role === 'Front Desk Officer' && st.branch === COUNSELOR_BRANCH[c.assignedCounselor])?.name,
  })),
  ...SEED_APPLICATIONS.slice(0, 4).map((a, i): AppNotification => ({
    id: `seed-n-ready-${i}`,
    trigger: 'consultation-ready',
    studentName: a.name,
    messageBefore: '',
    messageAfter: ' ready for application — consultation complete',
    createdAt: minutesAgo(120 + i * 60),
    read: false,
    role: 'application_officer',
    branch: a.branch,
    navigateTo: 'applications',
    actorName: a.counselor,
  })),
  ...SEED_APPLICATIONS.slice(9, 14).map((a, i): AppNotification => ({
    id: `seed-n-status-${i}`,
    trigger: 'status-update',
    studentName: a.name,
    messageBefore: '',
    messageAfter: ` status updated to ${a.visaApplication?.status ?? 'Fee Paid'}`,
    createdAt: minutesAgo(30 + i * 45),
    read: false,
    role: 'branch_manager',
    branch: a.branch,
    navigateTo: 'applications',
    actorName: a.visaApplication?.statusUpdatedBy ?? a.counselor,
  })),
];

// ── Daily tasks ─────────────────────────────────────────────────────────────
const TASK_TEMPLATES: Omit<DailyTask, 'id' | 'branch' | 'date' | 'createdBy'>[] = [
  { title: 'Open branch and complete the opening checklist', category: 'Front Desk', assignedRole: 'Front Desk Officer', dueTime: '9:00 AM', priority: 'High', status: 'Done' },
  { title: 'Call back yesterday’s walk-in clients', assignedRole: 'Front Desk Officer', dueTime: '11:00 AM', priority: 'High', status: 'In Progress' },
  { title: 'Update visitor log for walk-ins', assignedRole: 'Front Desk Officer', priority: 'Medium', status: 'To Do' },
  { title: 'Follow up with Hot leads due today', assignedRole: 'Counselor', dueTime: '1:00 PM', priority: 'High', status: 'To Do' },
  { title: 'Upload missing academic documents for enrolled clients', category: 'Documentation', assignedRole: 'Counselor', priority: 'Medium', status: 'In Progress' },
  { title: 'Submit pending offer applications', assignedRole: 'V/A Officer', dueTime: '3:00 PM', priority: 'High', status: 'To Do' },
  { title: 'Check visa file checklists for completeness', assignedRole: 'V/A Officer', priority: 'Medium', status: 'To Do' },
  { title: 'Restock brochures at reception', category: 'Marketing', assignedRole: 'Anyone', priority: 'Low', status: 'To Do' },
];

export const SEED_TASKS: DailyTask[] = SEED_BRANCHES.flatMap((b, bi) => {
  const manager = b.manager ?? 'Branch Manager';
  // Kathmandu and Pokhara get the full list, the other branches a shorter one.
  const templates = bi < 2 ? TASK_TEMPLATES : TASK_TEMPLATES.slice(0, 2).concat(TASK_TEMPLATES.slice(3, 5));
  return templates.map((t, i): DailyTask => ({
    ...t,
    id: `task-${b.id}-${i}`,
    branch: b.name,
    date: isoDate(0),
    createdBy: manager,
    updatedBy: t.status !== 'To Do' ? SEED_STAFF.find((s) => s.branch === b.name && s.role === t.assignedRole)?.name : undefined,
    updatedAt: t.status !== 'To Do' ? stamp(0, 9 + i, 15) : undefined,
  }));
}).concat(
  // Open work for Sneha Tamang, who is leaving (OFF-2026-0007) — fed to the Handover Engine.
  ([
    ['Call back Kathmandu walk-in about Canada study options', 0, '2:00 PM', 'High'],
    ['Send IELTS preparation schedule to follow-up client', 1, undefined, 'Medium'],
    ['Prepare document checklist for Sep 2027 Australia applicants', 2, undefined, 'Medium'],
  ] as const).map(([title, inDays, dueTime, priority], i): DailyTask => ({
    id: `task-b1-leaver-${i}`,
    title,
    branch: 'Kathmandu',
    assignedRole: 'Counselor',
    assignee: 'Sneha Tamang',
    date: isoDate(-inDays),
    dueTime,
    priority,
    status: 'To Do',
    createdBy: 'Sujata Shrestha',
  }))
).concat(
  // Slipped work from earlier in the week — what the Branch Manager's Task Oversight flags as overdue.
  SEED_BRANCHES.flatMap((b) => {
    const people = SEED_STAFF.filter((s) => s.branch === b.name && s.status === 'Active');
    const who = (role: StaffRole) => people.find((s) => s.role === role)?.name;
    return ([
      ['Chase GTE documents for Australia Feb intake files', 'Documentation', 'V/A Officer', 3, 'High', 'In Progress'],
      ['Call Not-Responding leads from last week’s Facebook campaign', 'Client Follow-up', 'Counselor', 2, 'High', 'To Do'],
      ['Reconcile walk-in register with CRM entries', 'Front Desk', 'Front Desk Officer', 5, 'Medium', 'To Do'],
      ['Share branch seminar photos with Marketing', 'Marketing', 'Counselor', 1, 'Low', 'To Do'],
      ['Renew printer service contract', 'Admin', 'Anyone', 4, 'Medium', 'In Progress'],
      ['Prepare monthly partner-college visit report', 'Admin', 'Anyone', 6, 'Low', 'Done'],
    ] as const).map(([title, category, role, daysLate, priority, status], i): DailyTask => ({
      id: `task-${b.id}-late-${i}`,
      title,
      category,
      branch: b.name,
      assignedRole: role === 'Anyone' ? 'Anyone' : role,
      assignee: role === 'Anyone' ? undefined : who(role),
      date: isoDate(daysLate),
      priority,
      status,
      createdBy: b.manager ?? 'Branch Manager',
      updatedAt: status !== 'To Do' ? stamp(daysLate - 1 < 0 ? 0 : daysLate - 1, 11, 20) : undefined,
    }));
  })
);

// ── Branch Communication Center ─────────────────────────────────────────────
// Receipt pattern per recipient, in staff order: A = acknowledged, R = read only, P = pending.
type ReceiptMark = 'A' | 'R' | 'P';
type NoticeTemplate = Omit<BranchNotice, 'id' | 'branch' | 'postedBy' | 'postedAt' | 'receipts' | 'linkedTaskIds' | 'effectiveDate' | 'expiryDate'> & {
  postedDaysAgo: number;
  expiresInDays?: number;
  marks: ReceiptMark[];
};

const NOTICE_TEMPLATES: NoticeTemplate[] = [
  {
    type: 'Urgent Alert',
    title: 'Hold all Australian visa lodgements until further notice',
    message:
      'The ImmiAccount portal is returning errors on payment for subclass 500 applications. Do not lodge or pay for any Australian student visa until Head Office confirms the issue is resolved. ' +
      'Save completed applications as drafts and tell affected clients there is a short, system-side delay. Report any client already charged without a TRN to the Branch Manager today.',
    audience: ['Counselor', 'V/A Officer'],
    ackRequired: true,
    attachments: ['ImmiAccount-incident-notice.pdf'],
    postedDaysAgo: 0,
    expiresInDays: 3,
    marks: ['A', 'R', 'P', 'A'],
  },
  {
    type: 'SOP Update',
    title: 'Document verification SOP v2.3 — certified copies now mandatory',
    message:
      'From this week, every academic document uploaded to a client file must be a certified copy verified against the original at the front desk. ' +
      'Uncertified scans will be returned by the V/A Officer. Front Desk: stamp and initial each verified copy. Counselors: tell clients to bring originals to their next visit. The full procedure is attached.',
    audience: ['All Staff'],
    ackRequired: true,
    attachments: ['SOP-Document-Verification-v2.3.pdf', 'Verification-stamp-guide.pdf'],
    postedDaysAgo: 2,
    expiresInDays: 60,
    marks: ['A', 'A', 'R', 'P', 'A'],
  },
  {
    type: 'Meeting',
    title: 'Monthly branch review — Friday, 4:00 PM',
    message:
      'Conference room. We will review this month’s enrolments, offer turnaround times and the Feb 2027 intake pipeline. Bring your open client list and any blocked cases.',
    audience: ['All Staff'],
    ackRequired: true,
    attachments: [],
    postedDaysAgo: 1,
    expiresInDays: 4,
    marks: ['A', 'A', 'A', 'A', 'A'],
  },
  {
    type: 'Instruction',
    title: 'Log every client interaction within 24 hours',
    message:
      'All calls, visits and emails must be added to the client’s Communication Log on the same working day, and no later than 24 hours. Missing entries will be flagged in the weekly review.',
    audience: ['Counselor', 'Front Desk Officer'],
    ackRequired: false,
    attachments: [],
    postedDaysAgo: 4,
    marks: ['R', 'R', 'P'],
  },
  {
    type: 'Announcement',
    title: 'Canada September 2027 intake applications are now open',
    message:
      'Partner colleges have opened applications for the Sep 2027 intake. Prioritise clients with IELTS 6.5+ and complete academic documents. Early submissions receive faster offer decisions.',
    audience: ['Counselor', 'V/A Officer'],
    ackRequired: false,
    attachments: ['Canada-Sep-2027-partner-list.xlsx'],
    postedDaysAgo: 6,
    marks: ['R', 'R', 'R'],
  },
  {
    type: 'Recognition',
    title: 'Counselor of the Month',
    message: 'Congratulations on the highest consultation-to-enrolment conversion in the branch this month. Thank you for the consistent follow-up and client care.',
    audience: ['All Staff'],
    ackRequired: false,
    attachments: [],
    postedDaysAgo: 9,
    marks: ['R', 'R', 'R', 'R', 'P'],
  },
  {
    type: 'Announcement',
    title: 'Branch closed for public holiday',
    message: 'The branch was closed for the public holiday. Client appointments were rescheduled by the front desk.',
    audience: ['All Staff'],
    ackRequired: false,
    attachments: [],
    postedDaysAgo: 20,
    expiresInDays: 6,
    marks: ['R', 'R', 'R', 'R', 'R'],
  },
];

export const SEED_NOTICES: BranchNotice[] = SEED_BRANCHES.flatMap((b) => {
  const manager = b.manager ?? 'Branch Manager';
  const branchStaff = SEED_STAFF.filter((st) => st.branch === b.name);
  const counselorOfMonth = branchStaff.find((st) => st.role === 'Counselor')?.name;
  return NOTICE_TEMPLATES.map((t, i): BranchNotice => {
    const { postedDaysAgo, expiresInDays, marks, ...rest } = t;
    const receipts: BranchNoticeReceipt[] = noticeRecipients(branchStaff, t.audience).map((st, si) => {
      const mark = marks[si % marks.length];
      return {
        staffName: st.name,
        readAt: mark === 'P' ? undefined : stamp(postedDaysAgo, 10 + si, 20),
        acknowledgedAt: mark === 'A' && t.ackRequired ? stamp(postedDaysAgo, 10 + si, 35) : undefined,
      };
    });
    return {
      ...rest,
      title: t.type === 'Recognition' && counselorOfMonth ? `Counselor of the Month — ${counselorOfMonth}` : t.title,
      id: `notice-${b.id}-${i}`,
      branch: b.name,
      effectiveDate: isoDate(postedDaysAgo),
      expiryDate: expiresInDays === undefined ? undefined : isoDate(postedDaysAgo - expiresInDays),
      postedBy: manager,
      postedAt: stamp(postedDaysAgo, 9, 15),
      receipts,
      linkedTaskIds: [],
    };
  });
});

// ── Issue & Escalation Management ───────────────────────────────────────────
// Activity steps are [daysAgo, hour, minute, actor, text, kind]; actor tokens (FD, CO, VA, BM,
// IT) resolve to the branch's staff so every branch gets a believable history.
type IssueActor = 'FD' | 'CO' | 'VA' | 'BM' | 'IT';
type IssueStep = [number, number, number, IssueActor, string, IssueActivity['kind']];
type IssueTemplate = Omit<BranchIssue, 'id' | 'code' | 'branch' | 'reportedBy' | 'reporterRole' | 'reportedAt' | 'owner' | 'activity' | 'resolvedAt' | 'closedAt' | 'reporterConfirmedAt'> & {
  reporter: IssueActor;
  owner?: IssueActor;
  steps: IssueStep[];
  confirmed?: boolean;
};

const ISSUE_TEMPLATES: IssueTemplate[] = [
  {
    title: 'CRM times out on every client profile — branch cannot open client files',
    category: 'IT/System',
    impact: 'Entire branch',
    priority: 'Critical',
    description:
      'Since 10:15 AM every client profile shows a spinner and then "Request timed out". Dashboards load but no one can open a client file, update applications or log communication. Walk-in clients are waiting.',
    triedSoFar: 'Logged out and back in, cleared browser cache, tried Chrome and Edge, and on mobile data instead of office Wi-Fi. Same result on every device.',
    attachments: ['crm-timeout-screenshot.png'],
    status: 'In Progress',
    reporter: 'FD',
    owner: 'IT',
    escalatedTo: 'IT Support',
    escalationReason: 'Urgent',
    steps: [
      [0, 10, 32, 'FD', 'reported the issue', 'reported'],
      [0, 10, 33, 'FD', 'Priority set to Critical automatically (impact: entire branch)', 'status'],
      [0, 10, 40, 'BM', 'escalated to IT Support — Urgent', 'escalated'],
      [0, 10, 41, 'BM', 'assigned to IT Support', 'assigned'],
      [0, 11, 5, 'IT', 'moved to In Progress', 'status'],
      [0, 11, 20, 'IT', 'Database server CPU at 100%. Restarting the query service; expect 20–30 minutes.', 'update'],
    ],
  },
  {
    title: 'Client disputes refund amount after visa refusal',
    category: 'Client/Service',
    impact: '2-3 staff',
    priority: 'High',
    description:
      'Client was refused a UK student visa and says they were promised a full service-fee refund. Our agreement allows a partial refund only. The client is visiting the branch daily and the counselor and front desk cannot give an answer.',
    triedSoFar: 'Shared the signed service agreement and refund policy. Offered the standard partial refund; the client declined and asked to speak to management.',
    attachments: ['service-agreement-signed.pdf', 'refund-policy-v4.pdf'],
    status: 'Waiting',
    reporter: 'CO',
    owner: 'BM',
    escalatedTo: 'Branch Manager',
    escalationReason: 'Requires manager decision',
    steps: [
      [1, 14, 5, 'CO', 'reported the issue', 'reported'],
      [1, 14, 6, 'CO', 'Priority set to High automatically (impact: 2-3 staff)', 'status'],
      [1, 14, 30, 'CO', 'escalated to Branch Manager — Requires manager decision', 'escalated'],
      [1, 15, 10, 'BM', 'Reviewed the file. Requested the original fee breakdown from Finance before deciding.', 'update'],
      [0, 9, 45, 'BM', 'moved to Waiting — awaiting Finance fee breakdown', 'status'],
    ],
  },
  {
    title: 'Receipt numbers duplicated in the collection register',
    category: 'Finance',
    impact: '2-3 staff',
    priority: 'High',
    description: 'Two receipts issued yesterday share the same number. Day-end reconciliation will not balance until this is corrected.',
    triedSoFar: 'Voided neither receipt yet. Checked the register — the second receipt was issued after a page refresh.',
    attachments: [],
    status: 'Assigned',
    reporter: 'FD',
    owner: 'BM',
    steps: [
      [0, 8, 50, 'FD', 'reported the issue', 'reported'],
      [0, 8, 51, 'FD', 'Priority set to High automatically (impact: 2-3 staff)', 'status'],
      [0, 9, 20, 'BM', 'assigned to the Branch Manager', 'assigned'],
    ],
  },
  {
    // Raised from this morning's opening checklist (Printers working ❌) — see SEED_DAY_LOGS.
    title: 'Printer not working — first-floor printer jams on every page',
    category: 'IT/System',
    impact: '2-3 staff',
    priority: 'High',
    description: 'Failed on the opening checklist. The first-floor printer jams on every page, so offer letters and receipts cannot be printed for client signatures.',
    triedSoFar: 'Removed jammed paper, reloaded the tray and restarted the printer.',
    attachments: [],
    status: 'Open',
    reporter: 'FD',
    steps: [
      [0, 9, 10, 'FD', 'reported the issue from the opening checklist (Printers working ❌)', 'reported'],
      [0, 9, 10, 'FD', 'Priority set to High automatically (impact: 2-3 staff)', 'status'],
    ],
  },
  {
    title: 'Wi-Fi drops in both counselling rooms',
    category: 'IT/System',
    impact: 'Most of the branch',
    priority: 'High',
    description: 'Video consultations disconnect every 10–15 minutes in both counselling rooms.',
    triedSoFar: 'Reconnected, restarted laptops, moved closer to the router.',
    attachments: [],
    status: 'Resolved',
    reporter: 'CO',
    owner: 'IT',
    escalatedTo: 'IT Support',
    escalationReason: 'Cannot resolve',
    resolution: 'Replaced the faulty access point in the corridor and moved the counselling rooms to the 5 GHz network.',
    requiresConfirmation: true,
    steps: [
      [3, 11, 0, 'CO', 'reported the issue', 'reported'],
      [3, 11, 1, 'CO', 'Priority set to High automatically (impact: most of the branch)', 'status'],
      [3, 11, 30, 'CO', 'escalated to IT Support — Cannot resolve', 'escalated'],
      [2, 10, 0, 'IT', 'moved to In Progress', 'status'],
      [1, 16, 40, 'IT', 'resolved — reporter confirmation required', 'resolved'],
    ],
  },
  {
    title: 'Air conditioning not working in the client waiting area',
    category: 'Office/Facility',
    impact: '2-3 staff',
    priority: 'High',
    description: 'AC in the waiting area stopped cooling; clients are waiting in heat.',
    triedSoFar: 'Reset the unit at the breaker.',
    attachments: [],
    status: 'Resolved',
    reporter: 'FD',
    owner: 'BM',
    resolution: 'Technician recharged the refrigerant and cleaned the filters. Cooling back to normal.',
    requiresConfirmation: false,
    steps: [
      [5, 9, 30, 'FD', 'reported the issue', 'reported'],
      [5, 9, 31, 'FD', 'Priority set to High automatically (impact: 2-3 staff)', 'status'],
      [5, 10, 0, 'BM', 'assigned to the Branch Manager', 'assigned'],
      [4, 15, 0, 'BM', 'resolved', 'resolved'],
    ],
  },
  {
    title: 'Biometric attendance not recording morning check-ins',
    category: 'Staff/HR',
    impact: 'Most of the branch',
    priority: 'High',
    description: 'The biometric device accepts fingerprints but check-ins do not appear in the attendance report.',
    triedSoFar: 'Re-registered one fingerprint as a test; still not recorded.',
    attachments: [],
    status: 'Closed',
    reporter: 'FD',
    owner: 'IT',
    escalatedTo: 'IT Support',
    escalationReason: 'Cannot resolve',
    resolution: 'Device clock had drifted by a day after a power cut. Re-synced time and back-filled the missing check-ins.',
    requiresConfirmation: true,
    confirmed: true,
    steps: [
      [9, 9, 10, 'FD', 'reported the issue', 'reported'],
      [9, 9, 11, 'FD', 'Priority set to High automatically (impact: most of the branch)', 'status'],
      [9, 9, 40, 'FD', 'escalated to IT Support — Cannot resolve', 'escalated'],
      [8, 14, 0, 'IT', 'resolved — reporter confirmation required', 'resolved'],
      [8, 16, 30, 'FD', 'confirmed the issue is fixed', 'confirmed'],
      [7, 10, 0, 'BM', 'closed the issue', 'closed'],
    ],
  },
];

export const SEED_ISSUES: BranchIssue[] = SEED_BRANCHES.flatMap((b, bi) => {
  const people = SEED_STAFF.filter((st) => st.branch === b.name && st.status === 'Active');
  const byRole = (role: StaffMember['role']) => people.find((st) => st.role === role)?.name;
  const actors: Record<IssueActor, { name: string; role: string }> = {
    FD: { name: byRole('Front Desk Officer') ?? 'Front Desk', role: 'Front Desk Officer' },
    CO: { name: byRole('Counselor') ?? 'Counselor', role: 'Counselor' },
    VA: { name: byRole('V/A Officer') ?? byRole('Counselor') ?? 'V/A Officer', role: byRole('V/A Officer') ? 'V/A Officer' : 'Counselor' },
    BM: { name: b.manager ?? 'Branch Manager', role: 'Branch Manager' },
    IT: { name: 'IT Support', role: 'IT Support' },
  };
  return ISSUE_TEMPLATES.map((t, i): BranchIssue => {
    const { reporter, owner, steps, confirmed, ...rest } = t;
    const activity: IssueActivity[] = steps.map(([days, h, m, who, text, kind], si) => ({
      id: `ia-${b.id}-${i}-${si}`, at: stamp(days, h, m), by: actors[who].name, text, kind,
    }));
    const when = (kind: IssueActivity['kind']) => activity.find((a) => a.kind === kind)?.at;
    return {
      ...rest,
      id: `issue-${b.id}-${i}`,
      code: `ISS-${1040 + bi * 100 + i}`,
      branch: b.name,
      reportedBy: actors[reporter].name,
      reporterRole: actors[reporter].role,
      reportedAt: activity[0].at,
      owner: owner ? actors[owner].name : undefined,
      resolvedAt: when('resolved'),
      reporterConfirmedAt: confirmed ? when('confirmed') : undefined,
      closedAt: when('closed'),
      activity,
    };
  });
});

// ── Branch Operations Control ───────────────────────────────────────────────
// Today at every branch: the manager, front desk and V/A Officer are on time, the first
// counselor is Late, the second counselor hasn't checked in. Yesterday the front desk forgot
// to check out and has a correction request waiting. The rest of the last 30 days is complete
// apart from a scattering of late and absent days; Saturdays are the weekly day off.
const ATTENDANCE_DAYS = 30;
// ── Holidays ────────────────────────────────────────────────────────────────
// Indicative 2026 dates (lunar festivals move every year, so they don't repeat). Gai Jatra is
// Kathmandu-only, Chhath applies to the Terai branches and Tamu Lhosar to Pokhara.
const hol = (id: string, name: string, type: Holiday['type'], from: string, to: string, repeatsAnnually: boolean, appliesTo: Holiday['appliesTo'] = 'All'): Holiday =>
  ({ id: `hol-${id}`, name, type, from, to, repeatsAnnually, appliesTo, createdBy: 'HR — Head Office' });
export const SEED_HOLIDAYS: Holiday[] = [
  hol('found', 'CSC Global Foundation Day', 'Company', '2026-01-15', '2026-01-15', true),
  hol('demo', 'Democracy Day', 'National', '2026-02-19', '2026-02-19', false),
  hol('women', 'International Women’s Day', 'National', '2026-03-08', '2026-03-08', true),
  hol('newyear', 'Nepali New Year 2083', 'National', '2026-04-14', '2026-04-14', false),
  hol('labour', 'Labour Day', 'National', '2026-05-01', '2026-05-01', true),
  hol('gai', 'Gai Jatra', 'Local', '2026-08-28', '2026-08-28', false, ['Kathmandu']),
  hol('const', 'Constitution Day', 'National', '2026-09-19', '2026-09-19', true),
  hol('dashain', 'Dashain (Fulpati – Ekadashi)', 'Festival', '2026-10-18', '2026-10-22', false),
  hol('tihar', 'Tihar (Laxmi Puja – Bhai Tika)', 'Festival', '2026-11-08', '2026-11-10', false),
  hol('chhath', 'Chhath Parva', 'Festival', '2026-11-15', '2026-11-15', false, ['Butwal', 'Chitwan']),
  hol('xmas', 'Christmas Day', 'National', '2026-12-25', '2026-12-25', true),
  hol('lhosar', 'Tamu Lhosar', 'Local', '2026-12-30', '2026-12-30', false, ['Pokhara']),
];
const isHolidaySeed = (branch: string, date: string) => !!holidayOn(holidaysFor(SEED_HOLIDAYS, branch), date);

/** Recent joiners have no attendance before their first day. */
const JOINED_DAYS_AGO: Record<string, number> = { 'Riya Thapa': 9 };

// Leave requests. Kept from before (so attendance history is unchanged): the V/A Officer's
// two days of annual leave and the first counselor's sick day. Added for Leave Management:
// earlier approved leave this year (so balances differ), one rejected request, the second
// counselor on annual leave today, a pending Annual request from the first counselor, a
// pending Casual day for the front desk and an approved day off inside the next 7 days.
/** Days from today to the start of Dashain, for leave that overlaps it. */
const DAYS_TO_DASHAIN = Math.round((new Date('2026-10-18T00:00:00').getTime() - daysAgo(0, 0, 0).getTime()) / 86_400_000);

export const SEED_LEAVE: LeaveRecord[] = SEED_BRANCHES.flatMap((b) => {
  const manager = b.manager ?? 'Branch Manager';
  const people = SEED_STAFF.filter((st) => st.branch === b.name && st.status === 'Active' && !JOINED_DAYS_AGO[st.name]);
  const annual = people.find((st) => st.role === 'V/A Officer') ?? people.find((st) => st.role === 'Front Desk Officer');
  const counselors = people.filter((st) => st.role === 'Counselor');
  const fd = people.find((st) => st.role === 'Front Desk Officer');
  const req = (
    id: string, name: string, type: LeaveRecord['type'], fromAgo: number, toAgo: number, status: LeaveRecord['status'], reason: string, askedAgo: number, note?: string,
  ): LeaveRecord => ({
    id: `lv-${b.id}-${id}`, staffName: name, branch: b.name, from: isoDate(fromAgo), to: isoDate(toAgo), type, status,
    days: workingDaysBetween(isoDate(fromAgo), isoDate(toAgo)), reason, requestedAt: stamp(askedAgo, 10, 15),
    ...(status === 'Pending' ? {} : { decidedBy: manager, decidedAt: stamp(Math.max(0, askedAgo - 1), 16, 0), decisionNote: note }),
  });
  return [
    ...(annual ? [req('a', annual.name, 'Annual', 12, 11, 'Approved', 'Family function in Chitwan.', 20)] : []),
    ...(counselors[0] ? [req('s', counselors[0].name, 'Sick', 4, 4, 'Approved', 'Fever — resting at home.', 4)] : []),
    // Earlier this year
    ...people.map((st, si) => req(`h${si}`, st.name, 'Annual', 70 + si * 9, 70 + si * 9 - (si % 4) - 1, 'Approved', 'Planned family trip.', 90 + si * 9)),
    ...people.filter((_, si) => si % 2 === 1).map((st, si) => req(`c${si}`, st.name, 'Casual', 45 + si, 45 + si, 'Approved', 'Personal errand.', 50 + si)),
    ...(fd ? [req('r', fd.name, 'Casual', 34, 34, 'Rejected', 'Friend’s engagement ceremony.', 38, 'Month-end rush — front desk can’t be short that day.')] : []),
    // Now and upcoming
    ...(counselors[1] ? [req('t', counselors[1].name, 'Annual', 0, -2, 'Approved', 'Using remaining annual leave before my last working day.', 6)] : []),
    // Runs into Dashain — the holiday days inside it aren't deducted from his balance.
    ...(counselors[0] ? [req('p', counselors[0].name, 'Annual', -DAYS_TO_DASHAIN + 3, -DAYS_TO_DASHAIN - 3, 'Pending', 'My sister’s wedding in Pokhara during Dashain — travelling with family.', 1)] : []),
    ...(fd ? [req('q', fd.name, 'Casual', -3, -3, 'Pending', 'Bank appointment for a home loan.', 0)] : []),
    ...(annual ? [req('u', annual.name, 'Casual', -5, -5, 'Approved', 'Renewing citizenship documents at the district office.', 2)] : []),
  ];
});
const onLeaveSeed = (name: string, date: string) => SEED_LEAVE.some((l) => l.status === 'Approved' && l.staffName === name && l.from <= date && date <= l.to);

const RAW_ATTENDANCE: AttendanceRecord[] = SEED_BRANCHES.flatMap((b) => {
  const people = SEED_STAFF.filter((st) => st.branch === b.name && st.status === 'Active');
  const counselors = people.filter((st) => st.role === 'Counselor');
  return people.flatMap((st, si) =>
    Array.from({ length: Math.min(ATTENDANCE_DAYS, JOINED_DAYS_AGO[st.name] ?? ATTENDANCE_DAYS) }, (_, days): AttendanceRecord | null => {
      const isToday = days === 0;
      const lateToday = isToday && st.name === counselors[0]?.name;
      const absentToday = isToday && (st.name === counselors[1]?.name || st.name === 'Anjali Shrestha');
      if (absentToday) return null;
      if (days > 0 && daysAgo(days).getDay() === 6) return null;
      if (onLeaveSeed(st.name, isoDate(days)) || isHolidaySeed(b.name, isoDate(days))) return null;
      if (days > 1 && si % 2 === 1 && !JOINED_DAYS_AGO[st.name] && (si + days) % 23 === 9) return null;
      // The first counselor has a repeated pattern: four late days this month, including today.
      const lateDay = (days > 1 && (si * 5 + days) % 17 === 7) || (st.name === counselors[0]?.name && [3, 10].includes(days));
      const veryLateDay = days > 1 && (si + days) % 29 === 13;
      const inMinute = lateToday ? 24 : veryLateDay ? 41 : lateDay ? 21 : [52, 55, 58, 5, 2][(si + days) % 5];
      const inHour = lateToday || lateDay || veryLateDay || inMinute < 30 ? 9 : 8;
      const missingOut = days === 1 && st.role === 'Front Desk Officer';
      return {
        id: `att-${st.id}-${days}`,
        staffName: st.name,
        branch: b.name,
        date: isoDate(days),
        checkIn: stamp(days, inHour, inMinute),
        // Two half days this month (left at lunchtime) for the HR attendance report.
        checkOut: isToday || missingOut ? undefined
          : (st.role === 'V/A Officer' && days === 8) || (st.name === 'Anjali Shrestha' && days === 5) ? stamp(days, 12, 30)
            : stamp(days, 18, (si * 7) % 30),
      };
    }).filter((r): r is AttendanceRecord => r !== null)
  );
});

// One approved correction per branch so the audit trail has something to show: the first
// counselor's check-in a week ago was wrongly punched late and corrected — the original punch
// is kept in `original`, the change in `amendments`.
const firstCounselorOf = (branch: string) => SEED_STAFF.find((st) => st.branch === branch && st.role === 'Counselor' && st.status === 'Active');
const AMENDED: Record<string, string> = Object.fromEntries(SEED_BRANCHES.flatMap((b) => {
  const c = firstCounselorOf(b.name);
  const rec = c && [6, 7, 8, 9].map((d) => RAW_ATTENDANCE.find((r) => r.staffName === c.name && r.date === isoDate(d))).find(Boolean);
  return rec ? [[rec.id, b.id]] : [];
}));

export const SEED_ATTENDANCE: AttendanceRecord[] = RAW_ATTENDANCE.map((r) => {
  const bid = AMENDED[r.id];
  if (!bid) return r;
  const punched = `${r.date} 9:32 AM`;
  const corrected = `${r.date} 9:04 AM`;
  const manager = SEED_BRANCHES.find((b) => b.id === bid)?.manager ?? 'Branch Manager';
  return {
    ...r,
    checkIn: corrected,
    original: { checkIn: punched, checkOut: r.checkOut },
    amendments: [{
      id: `amd-corr-${bid}-0`, correctionId: `corr-${bid}-0`, field: 'checkIn', from: punched, to: corrected,
      reason: 'Biometric reader failed at the door; signed the paper register at 9:04 AM.',
      requestedBy: r.staffName, requestedAt: `${r.date} 11:20 AM`, approvedBy: manager, approvedAt: `${r.date} 12:05 PM`,
    }],
  };
});

// Explanations: the most recent unplanned absence has one submitted and waiting for review,
// the next was requested and the employee hasn't replied; any others (e.g. today's) are
// still unconfirmed. One of the first counselor's late arrivals was explained and excused.
export const SEED_EXPLANATIONS: AttendanceExplanation[] = SEED_BRANCHES.flatMap((b) => {
  const manager = b.manager ?? 'Branch Manager';
  const people = SEED_STAFF.filter((st) => st.branch === b.name && st.status === 'Active' && st.role !== 'Branch Manager');
  const absences: { name: string; date: string }[] = [];
  for (let d = 1; d < ATTENDANCE_DAYS; d += 1) {
    if (daysAgo(d).getDay() === 6) continue;
    people.forEach((st) => {
      const date = isoDate(d);
      if ((JOINED_DAYS_AGO[st.name] ?? ATTENDANCE_DAYS) <= d) return;
      if (onLeaveSeed(st.name, date) || isHolidaySeed(b.name, date) || RAW_ATTENDANCE.some((r) => r.staffName === st.name && r.date === date)) return;
      absences.push({ name: st.name, date });
    });
  }
  const counselor = firstCounselorOf(b.name);
  const lateDay = counselor && SEED_ATTENDANCE.find((r) => r.staffName === counselor.name && r.date === isoDate(10) && r.checkIn?.includes(' 9:2'));
  const out: AttendanceExplanation[] = [];
  if (absences[0]) {
    out.push({
      id: `exp-${b.id}-0`, staffName: absences[0].name, branch: b.name, date: absences[0].date, kind: 'Absence', status: 'Submitted',
      reason: 'Medical', note: 'High fever — saw a doctor that morning. Medical note attached.',
      requestedBy: manager, requestedAt: `${absences[0].date} 11:00 AM`, submittedBy: absences[0].name, submittedAt: stamp(0, 8, 40),
    });
  }
  if (absences[1]) {
    out.push({
      id: `exp-${b.id}-1`, staffName: absences[1].name, branch: b.name, date: absences[1].date, kind: 'Absence', status: 'Requested',
      requestedBy: manager, requestedAt: `${absences[1].date} 10:30 AM`,
    });
  }
  if (lateDay) {
    out.push({
      id: `exp-${b.id}-2`, staffName: lateDay.staffName, branch: b.name, date: lateDay.date, kind: 'Late', status: 'Accepted',
      reason: 'Traffic', note: 'Road closed at Putalisadak for a rally; took the long way round.',
      submittedBy: lateDay.staffName, submittedAt: `${lateDay.date} 9:40 AM`, reviewedBy: manager, reviewedAt: `${lateDay.date} 10:15 AM`,
    });
  }
  return out;
});

export const SEED_CORRECTIONS: AttendanceCorrection[] = SEED_BRANCHES.flatMap((b) => {
  const manager = b.manager ?? 'Branch Manager';
  const amended = SEED_ATTENDANCE.find((r) => AMENDED[r.id] === b.id);
  const va = SEED_STAFF.find((st) => st.branch === b.name && st.role === 'V/A Officer' && st.status === 'Active');
  const vaLate = va && SEED_ATTENDANCE.filter((r) => r.staffName === va.name && r.date < isoDate(1) && r.checkIn && !r.checkIn.includes(' 8:'))[0];
  const fd = SEED_STAFF.find((st) => st.branch === b.name && st.role === 'Front Desk Officer' && st.status === 'Active');
  const fdOld = fd && SEED_ATTENDANCE.filter((r) => r.staffName === fd.name && r.date <= isoDate(7) && r.checkOut)[0];
  return <AttendanceCorrection[]>[
    ...(amended ? [{
      id: `corr-${b.id}-0`, staffName: amended.staffName, branch: b.name, date: amended.date, field: 'checkIn' as const,
      requestedTime: '9:04 AM', reason: amended.amendments![0].reason, requestedAt: amended.amendments![0].requestedAt,
      status: 'Approved' as const, decidedBy: manager, decidedAt: amended.amendments![0].approvedAt,
    }] : []),
    ...(vaLate ? [{
      id: `corr-${b.id}-2`, staffName: va!.name, branch: b.name, date: vaLate.date, field: 'checkIn' as const,
      requestedTime: '8:55 AM', reason: 'Scanner didn’t read my fingerprint; the front desk saw me arrive at 8:55.',
      requestedAt: stamp(0, 9, 40), status: 'Pending' as const,
    }] : []),
    ...(fdOld ? [{
      id: `corr-${b.id}-3`, staffName: fd!.name, branch: b.name, date: fdOld.date, field: 'checkOut' as const,
      requestedTime: '7:30 PM', reason: 'Stayed late to finish the visitor log.', requestedAt: `${fdOld.date} 7:45 PM`,
      status: 'Rejected' as const, decidedBy: manager, decidedAt: stamp(6, 10, 0), decisionNote: 'Closing log shows the branch was locked at 6:15 PM.',
    }] : []),
  ];
}).concat(SEED_BRANCHES.flatMap((b) => {
  const fd = SEED_STAFF.find((st) => st.branch === b.name && st.role === 'Front Desk Officer' && st.status === 'Active');
  return fd
    ? [{
      id: `corr-${b.id}-1`,
      staffName: fd.name,
      branch: b.name,
      date: isoDate(1),
      field: 'checkOut' as const,
      requestedTime: '6:10 PM',
      reason: 'Left after locking up and forgot to check out on the way out.',
      requestedAt: stamp(0, 8, 58),
      status: 'Pending' as const,
    }]
    : [];
}));

const mark = (by: string, days: number, h: number, m: number, extra?: Partial<ChecklistMarkEntry>): ChecklistMarkEntry =>
  ({ state: 'ok', by, at: stamp(days, h, m), ...extra });

const ALL_OPENING = ['lights', 'ac', 'clean', 'internet', 'printer', 'desk', 'visitor-log', 'appointments', 'cash-float'];
const ALL_CLOSING = ['visitors', 'collections', 'cash-safe', 'secured', 'power-off'];

export const SEED_DAY_LOGS: BranchDayLog[] = SEED_BRANCHES.flatMap((b) => {
  const manager = b.manager ?? 'Branch Manager';
  const fd = SEED_STAFF.find((st) => st.branch === b.name && st.role === 'Front Desk Officer')?.name ?? manager;
  const printerIssue = `issue-${b.id}-3`;
  // Today: opened with the printer failed (and raised as an issue).
  const today: BranchDayLog = {
    id: `day-${b.id}-0`,
    branch: b.name,
    date: isoDate(0),
    opening: Object.fromEntries(ALL_OPENING.map((id, i) => [
      id,
      id === 'printer'
        ? mark(fd, 0, 9, 10, { state: 'fail', issueId: printerIssue })
        : mark(id === 'cash-float' || id === 'appointments' ? manager : fd, 0, 9, 1 + i),
    ])),
    openedAt: stamp(0, 9, 12),
    openedBy: manager,
    closing: {},
    handover: [],
  };
  // Yesterday: closed normally with one handover item.
  const yesterday: BranchDayLog = {
    id: `day-${b.id}-1`,
    branch: b.name,
    date: isoDate(1),
    opening: Object.fromEntries(ALL_OPENING.map((id, i) => [id, mark(fd, 1, 9, i)])),
    openedAt: stamp(1, 9, 8),
    openedBy: manager,
    closing: Object.fromEntries(ALL_CLOSING.map((id, i) => [id, mark(manager, 1, 18, i)])),
    closedAt: stamp(1, 18, 25),
    closedBy: manager,
    closedWithPending: 1,
    handover: [{ id: `ho-${b.id}-1`, label: 'Call back 2 clients who missed their afternoon consultations', owner: fd }],
  };
  return [today, yesterday];
});

// ── Employee Onboarding & Offboarding ───────────────────────────────────────
/** Marks the first `n` tasks of a case done (templates are in pipeline order). */
function tickFirst(tasks: CaseTask[], n: number, by: (t: CaseTask) => string, days: number): CaseTask[] {
  return tasks.map((t, i) => (i < n ? { ...t, doneBy: by(t), doneAt: stamp(Math.max(0, days - Math.floor(i / 3)), 10 + (i % 6), 5 * (i % 10)) } : t));
}
const OWNER_NAME: Record<string, string> = {
  HR: 'HR — Head Office', IT: 'IT Support', 'Branch Manager': 'Sujata Shrestha', Finance: 'Finance — Head Office', Employee: 'Riya Thapa',
};

export const SEED_ONBOARDING: OnboardingCase[] = [
  {
    // Started 8 days ago — first week nearly done.
    id: 'onb-24',
    code: 'ONB-2026-0024',
    branch: 'Kathmandu',
    employeeName: 'Riya Thapa',
    email: 'riya@csc.edu.np',
    role: 'Counselor',
    startDate: isoDate(8),
    createdAt: stamp(21, 11, 0),
    createdBy: 'Sujata Shrestha',
    // Everything up to the first week is done except shadowing a senior counselor (now overdue);
    // the First 30 Days items are still open and not yet due.
    tasks: tickFirst(onboardingTasksFor('Counselor', 'onb-24'), 99, (t) => OWNER_NAME[t.owner], 20)
      .map((t) => (t.label.startsWith('Shadow a senior') || t.stage === 'First 30 Days' ? { ...t, doneAt: undefined, doneBy: undefined } : t)),
    log: [
      { id: 'onb-24-l0', at: stamp(21, 11, 0), by: 'Sujata Shrestha', text: 'opened the onboarding case' },
      { id: 'onb-24-l1', at: stamp(8, 9, 0), by: 'Riya Thapa', text: 'started — first day' },
    ],
  },
  {
    // Joins next week — account not created yet, so no login.
    id: 'onb-25',
    code: 'ONB-2026-0025',
    branch: 'Kathmandu',
    employeeName: 'Bibek Karki',
    email: 'bibek@csc.edu.np',
    role: 'V/A Officer',
    startDate: isoDate(-6),
    createdAt: stamp(3, 15, 30),
    createdBy: 'Sujata Shrestha',
    tasks: tickFirst(onboardingTasksFor('V/A Officer', 'onb-25'), 2, (t) => OWNER_NAME[t.owner], 2),
    log: [{ id: 'onb-25-l0', at: stamp(3, 15, 30), by: 'Sujata Shrestha', text: 'opened the onboarding case' }],
  },
  {
    // Finished last year — history.
    id: 'onb-19',
    code: 'ONB-2026-0019',
    branch: 'Kathmandu',
    employeeName: 'Prakash Magar',
    email: 'prakash@csc.edu.np',
    role: 'V/A Officer',
    startDate: isoDate(430),
    createdAt: stamp(445, 10, 0),
    createdBy: 'Sujata Shrestha',
    tasks: tickFirst(onboardingTasksFor('V/A Officer', 'onb-19'), 99, (t) => OWNER_NAME[t.owner], 425),
    completedAt: stamp(398, 16, 0),
    completedBy: 'Sujata Shrestha',
    log: [{ id: 'onb-19-l0', at: stamp(398, 16, 0), by: 'Sujata Shrestha', text: 'completed onboarding' }],
  },
];

export const SEED_OFFBOARDING: OffboardingCase[] = [
  {
    // Resigned 25 days ago, leaves in 5 days — notice done, handover under way.
    id: 'off-07',
    code: 'OFF-2026-0007',
    branch: 'Kathmandu',
    employeeName: 'Sneha Tamang',
    role: 'Counselor',
    reason: 'Resignation',
    noticeDate: isoDate(25),
    lastWorkingDay: isoDate(-5),
    createdAt: stamp(25, 12, 0),
    createdBy: 'Sujata Shrestha',
    tasks: tickFirst(offboardingTasksFor('Counselor', 'off-07'), 2, () => 'HR — Head Office', 24),
    clearance: { HR: { by: 'HR — Head Office', at: stamp(2, 14, 0) } },
    handoverLog: [],
    log: [
      { id: 'off-07-l0', at: stamp(25, 12, 0), by: 'Sujata Shrestha', text: 'opened the offboarding case — resignation' },
    ],
  },
  {
    // Closed last month — the account stays, marked Inactive.
    id: 'off-04',
    code: 'OFF-2026-0004',
    branch: 'Butwal',
    employeeName: 'Hari Bista',
    role: 'V/A Officer',
    reason: 'Resignation',
    noticeDate: isoDate(70),
    lastWorkingDay: isoDate(40),
    createdAt: stamp(70, 10, 0),
    createdBy: 'Anita Poudel',
    tasks: tickFirst(offboardingTasksFor('V/A Officer', 'off-04'), 99, () => 'Anita Poudel', 40),
    clearance: Object.fromEntries((['HR', 'Branch Manager', 'IT', 'Finance'] as const).map((d) => [d, { by: d === 'Branch Manager' ? 'Anita Poudel' : `${d} — Head Office`, at: stamp(40, 15, 0) }])),
    exitInterview: { at: stamp(41, 11, 0), by: 'Anita Poudel', notes: 'Moving abroad for further study. Positive about team support.' },
    handoverLog: [{ id: 'off-04-h0', at: stamp(45, 12, 0), by: 'Anita Poudel', category: 'Pending tasks', count: 2, to: 'Suman Basnet' }],
    finalizedAt: stamp(40, 17, 0),
    finalizedBy: 'Anita Poudel',
    log: [{ id: 'off-04-l0', at: stamp(40, 17, 0), by: 'Anita Poudel', text: 'finalized offboarding — marked Inactive' }],
  },
];

// ── Performance reviews ─────────────────────────────────────────────────────
// Per branch, by role: the first counselor has two acknowledged reviews (up to date), the
// V/A Officer's last review was "Needs Improvement", the first front desk officer was last
// reviewed over six months ago (due), and the second counselor's recent review is still
// waiting for acknowledgement. Everyone else has no review yet.
export const SEED_REVIEWS: PerformanceReview[] = SEED_BRANCHES.flatMap((b) => {
  const manager = b.manager ?? 'Branch Manager';
  const people = SEED_STAFF.filter((st) => st.branch === b.name && st.status === 'Active');
  const counselors = people.filter((st) => st.role === 'Counselor');
  const va = people.find((st) => st.role === 'V/A Officer');
  const fd = people.find((st) => st.role === 'Front Desk Officer');
  const r = (id: string, name: string, daysAgoN: number, period: string, assessment: PerformanceReview['assessment'], acknowledged: boolean, t: [string, string, string, string]): PerformanceReview => ({
    id: `rev-${b.id}-${id}`, staffName: name, branch: b.name, period, assessment, acknowledged,
    acknowledgedAt: acknowledged ? stamp(Math.max(0, daysAgoN - 2), 15, 0) : undefined,
    overall: t[0], strengths: t[1], improvements: t[2], goals: t[3], reviewedBy: manager, reviewedAt: stamp(daysAgoN, 14, 0),
  });
  return [
    ...(counselors[0] ? [
      r('c0a', counselors[0].name, 280, 'Jul – Dec 2025', 'Exceeds Expectations', true, [
        'Strong first year. Consistently converts consultations into applications and keeps clients well informed.',
        'Clear, honest advice on destination choices; clients often ask for him by name.',
        'Log follow-up calls in the Communication Log on the same day.',
        'Take ownership of Australia intake briefings for new counselors.',
      ]),
      r('c0b', counselors[0].name, 95, 'Jan – Jun 2026', 'Meets Expectations', true, [
        'Solid half-year. Client numbers steady and application quality good.',
        'Thorough document checks before handing files to the V/A Officer — very few returns.',
        'Punctuality has slipped; several late arrivals this quarter.',
        'Arrive on time; clear overdue follow-ups within 48 hours.',
      ]),
    ] : []),
    ...(va ? [r('va', va.name, 100, 'Jan – Jun 2026', 'Needs Improvement', true, [
      'Offer applications are accurate, but visa files are taking too long to lodge after fee payment.',
      'Detailed knowledge of UK and Australia visa rules; good with difficult cases.',
      'Turnaround from “File Ready” to “Visa Applied” — several files waited over a week.',
      'Lodge every ready file within 3 working days; weekly check-in with the Branch Manager on the visa queue.',
    ])] : []),
    ...(fd ? [r('fd', fd.name, 210, 'Jul – Dec 2025', 'Exceeds Expectations', true, [
      'The front desk runs smoothly; walk-in clients are greeted, registered and assigned quickly.',
      'Calm under pressure on busy intake days; excellent visitor records.',
      'Hand over the cash float with a written count every evening.',
      'Train the second front desk officer on the opening and closing checklists.',
    ])] : []),
    ...(counselors[1] ? [r('c1', counselors[1].name, 20, 'Jan – Jun 2026', 'Meets Expectations', false, [
      'Reliable with Canada and USA clients; application files well prepared.',
      'Patient, detailed consultations; strong client feedback.',
      'Follow-up notes are sometimes missing temperature and next steps.',
      'Complete handover of all active clients before the last working day.',
    ])] : []),
  ];
});

// ── Joining dates ───────────────────────────────────────────────────────────
// Not stored on staff records yet; mock dates for the HR Staff Report. Recent joiners use their
// onboarding start date.
export const SEED_JOIN_DATES: Record<string, string> = Object.fromEntries(
  SEED_STAFF.map((st, i) => [
    st.name,
    JOINED_DAYS_AGO[st.name] ? isoDate(JOINED_DAYS_AGO[st.name])
      : `${2019 + (i % 6)}-${String(1 + ((i * 5) % 12)).padStart(2, '0')}-${String(1 + ((i * 11) % 27)).padStart(2, '0')}`,
  ])
);

// ── Payroll inputs ──────────────────────────────────────────────────────────
// Salaries by role, raised from the start of the fiscal year (Shrawan, mid-July). New joiners
// have a single entry from their start date. Counselors are commission-eligible.
const BASE_SALARY: Record<string, number> = {
  'Branch Manager': 85000, Counselor: 46000, 'V/A Officer': 42000, 'Front Desk Officer': 32000,
};
const BANKS = ['Nabil Bank', 'NIC Asia Bank', 'Global IME Bank', 'Himalayan Bank'];
const FY_START = '2026-07-17';

export const SEED_PAY_PROFILES: PayProfile[] = SEED_BRANCHES.flatMap((b, bi) => {
  const manager = b.manager ?? 'Branch Manager';
  return SEED_STAFF.filter((st) => st.branch === b.name && st.status === 'Active' && BASE_SALARY[st.role]).map((st, si): PayProfile => {
    const base = BASE_SALARY[st.role] + (si % 3) * 1500;
    const joined = JOINED_DAYS_AGO[st.name];
    return {
      staffName: st.name,
      branch: b.name,
      salaryHistory: joined
        ? [{ amount: base - 4000, effectiveFrom: isoDate(joined), setBy: manager, setAt: stamp(joined + 14, 11, 0), note: 'Starting salary' }]
        : [
          { amount: Math.round(base * 0.92 / 500) * 500, effectiveFrom: '2025-07-17', setBy: 'HR — Head Office', setAt: '2025-07-10 11:00 AM', note: 'FY 2082/83 salary' },
          { amount: base, effectiveFrom: FY_START, setBy: 'HR — Head Office', setAt: '2026-07-10 11:00 AM', note: 'Annual increment — FY 2083/84' },
        ],
      fixedAllowance: st.role === 'Branch Manager' ? 5000 : 2500,
      commissionEligible: st.role === 'Counselor' || st.role === 'Branch Manager',
      paymentMethod: 'Bank transfer',
      bankName: BANKS[(bi + si) % BANKS.length],
      accountName: st.name.toUpperCase(),
      accountNumber: `0${bi + 1}${si}0-${String(104729 + si * 7919 + bi * 131).padStart(7, '0')}-01`,
    };
  });
});

const monthOffset = (n: number) => {
  const d = daysAgo(0);
  const m = new Date(d.getFullYear(), d.getMonth() - n, 1);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
};

export const SEED_PAYROLL_RUNS: PayrollRun[] = SEED_BRANCHES.flatMap((b) => {
  const manager = b.manager ?? 'Branch Manager';
  const profiles = SEED_PAY_PROFILES.filter((p) => p.branch === b.name);
  const people = SEED_STAFF.filter((st) => st.branch === b.name && profiles.some((p) => p.staffName === st.name));
  const counselors = people.filter((st) => st.role === 'Counselor');
  const fd = people.find((st) => st.role === 'Front Desk Officer');
  const va = people.find((st) => st.role === 'V/A Officer');
  const base = (name: string) => emptyManualSeed(profiles.find((p) => p.staffName === name)?.fixedAllowance ?? 0);
  const withEdits = (edits: Record<string, Partial<PayrollManual>>) =>
    Object.fromEntries(people.map((st) => [st.name, { ...base(st.name), ...(edits[st.name] ?? {}) }]));

  // This month — still a draft, with a few manual entries already made.
  const current: PayrollRun = {
    id: `pay-${b.id}-0`, branch: b.name, month: monthOffset(0), status: 'Draft',
    manual: withEdits({
      ...(counselors[0] ? { [counselors[0].name]: { bonus: 5000, commission: 3500, remarks: 'Bonus: Canada September intake target met.' } } : {}),
      ...(fd ? { [fd.name]: { overtime: 1200, advance: 10000, remarks: 'Salary advance approved 12 Sep (medical) — recover over 2 months.' } } : {}),
      ...(va ? { [va.name]: { overtime: 2400, remarks: 'Three Saturdays worked on the pre-Dashain visa rush.' } } : {}),
      ...(counselors[1] ? { [counselors[1].name]: { commission: 1500, remarks: 'Leaving after 1 Oct — final settlement; HR to confirm leave encashment.' } } : {}),
      ...Object.fromEntries(people.filter((st) => JOINED_DAYS_AGO[st.name]).map((st) => [st.name, { remarks: 'Joined mid-month — please prorate.' }])),
    }),
  };

  // Past months — snapshots of what was submitted.
  const past = (n: number, status: PayrollRun['status']): PayrollRun => {
    const month = monthOffset(n);
    const members = people.filter((st) => !JOINED_DAYS_AGO[st.name]);
    const snapshot: Record<string, PayrollAuto> = Object.fromEntries(members.map((st, si) => {
      const profile = profiles.find((p) => p.staffName === st.name);
      const monthEnd = `${month}-28`;
      const amount = [...(profile?.salaryHistory ?? [])].filter((e) => e.effectiveFrom <= monthEnd).sort((a, c) => c.effectiveFrom.localeCompare(a.effectiveFrom))[0]?.amount ?? 0;
      const leaveDays = (si + n) % 4 === 1 ? 2 : 0;
      const absent = (si + n) % 5 === 3 ? 1 : 0;
      return [st.name, { basic: amount, workingDays: 26, daysWorked: 26 - leaveDays - absent, leaveDays, late: (si * 2 + n) % 4, absent }];
    }));
    return {
      id: `pay-${b.id}-${n}`, branch: b.name, month, status,
      manual: Object.fromEntries(members.map((st, si) => [st.name, {
        ...base(st.name),
        ...(st.role === 'Counselor' ? { commission: 2000 + ((si + n) % 3) * 1500 } : {}),
        ...((si + n) % 4 === 0 ? { overtime: 1800 } : {}),
      }])),
      snapshot,
      submittedBy: manager, submittedAt: `${monthOffset(n - 1)}-03 4:30 PM`,
      ...(status === 'Processed' ? { processedBy: 'Finance — Head Office', processedAt: `${monthOffset(n - 1)}-06 11:00 AM` } : {}),
    };
  };
  return [current, past(1, 'Submitted'), past(2, 'Processed'), past(3, 'Processed')];
});

function emptyManualSeed(allowance: number): PayrollManual {
  return { overtime: 0, bonus: 0, commission: 0, allowance, deduction: 0, advance: 0, other: 0, remarks: '' };
}

// ── V/A demo: a Kathmandu client Ready for Visa Application with an outstanding balance ──
// Nirjala Acharya (fee paid) has her visa file marked ready by the V/A Officer, who also added
// a Rs 2,000 translation fee today (see SEED_FIN_TRANSACTIONS). Her balance doesn't block the
// visa stage — it's shown as a warning for the Front Desk to collect.
{
  const nirjala = SEED_APPLICATIONS.find((a) => a.branch === 'Kathmandu' && a.name === 'Nirjala Acharya');
  if (nirjala?.visaApplication) {
    nirjala.visaApplication = { ...nirjala.visaApplication, status: 'File Ready for Visa', fileReadyDate: isoDate(1), statusUpdatedAt: isoDate(1), statusUpdatedBy: 'Prakash Magar' };
  }
}

// ── Financial ledger ────────────────────────────────────────────────────────
// One ledger per branch, built around the branch's real clients. Scenarios (by client slot):
// 0 paid application fee, part-paid visa fee due this week · 1 payment plan with an overdue
// instalment · 2 visa fee part-paid by eSewa, due in ~3 weeks · 3 IELTS class paid today in
// cash · 4 application fee unpaid with a discount awaiting approval · 5 four-part plan, next
// instalment due in 3 days. Plus walk-in consultation fees today, a voided duplicate receipt,
// refunds at each stage and discounts at each stage.
export const SEED_FIN_TRANSACTIONS: FinTransaction[] = SEED_BRANCHES.flatMap((b, bi) => {
  const manager = b.manager ?? 'Branch Manager';
  const fd = SEED_STAFF.find((st) => st.branch === b.name && st.role === 'Front Desk Officer')?.name ?? manager;
  const code = ({ Kathmandu: 'KTM', Pokhara: 'PKR', Butwal: 'BTL', Chitwan: 'CTW' } as Record<string, string>)[b.name] ?? b.name.slice(0, 3).toUpperCase();
  const apps = SEED_APPLICATIONS.filter((a) => a.branch === b.name);
  const walkIns = SEED_COUNSELOR_STUDENTS.filter((c) => COUNSELOR_BRANCH[c.assignedCounselor] === b.name);
  if (apps.length === 0) return [];
  const client = (i: number) => {
    const a = apps[i % apps.length];
    return { clientId: a.clientId ?? `CSC-${a.id}`, clientName: a.name, counselor: a.counselor, country: a.country.split(',')[0].trim() };
  };
  const out: FinTransaction[] = [];
  let n = 0;
  const add = (t: Omit<FinTransaction, 'id' | 'branch'>) => { out.push({ ...t, id: `fin-${b.id}-${n++}`, branch: b.name }); return out[out.length - 1]; };
  const charge = (i: number, service: FinTransaction['service'], amount: number, dueAgo: number, extra: Partial<FinTransaction> = {}) =>
    add({ kind: 'Charge', ...client(i), service, amount, at: stamp(Math.max(dueAgo + 20, 1), 10, 0), by: client(i).counselor, dueDate: isoDate(dueAgo), ...extra });
  const pay = (i: number, service: FinTransaction['service'], amount: number, daysAgoN: number, h: number, m: number, method: FinTransaction['method'], extra: Partial<FinTransaction> = {}) =>
    add({ kind: 'Payment', ...client(i), service, amount, at: stamp(daysAgoN, h, m), by: fd, method, ...extra });

  // 0 — application fee paid last month; visa fee part-paid today, rest due in 5 days
  charge(0, 'Application Processing', 25000, 40);
  pay(0, 'Application Processing', 25000, 42, 11, 20, 'Bank', { methodNote: 'Nabil Bank transfer' });
  charge(0, 'Visa Processing', 35000, -5);
  pay(0, 'Visa Processing', 15000, 0, 10, 5, 'Cash');
  // 1 — 3-part plan: first paid, second overdue, third next month
  [30, 5, -25].forEach((d, k) => charge(1, 'Application Processing', 15000, d, { planId: `plan-${b.id}-1`, installment: k + 1, installments: 3 }));
  pay(1, 'Application Processing', 15000, 31, 14, 0, 'Bank', { planId: `plan-${b.id}-1`, installment: 1 });
  // 2 — visa fee part-paid by eSewa, balance due in ~3 weeks
  charge(2, 'Visa Processing', 35000, -20);
  pay(2, 'Visa Processing', 10000, 6, 15, 40, 'Other', { methodNote: 'eSewa' });
  // 3 — IELTS class paid today in cash
  charge(3, 'IELTS / PTE Class', 12000, 10);
  pay(3, 'IELTS / PTE Class', 12000, 0, 11, 45, 'Cash');
  // 4 — application fee unpaid, due in 12 days (discount requested below)
  charge(4, 'Application Processing', 25000, -12);
  // 5 — 4-part plan: two paid, next due in 3 days
  [60, 30, -3, -33].forEach((d, k) => charge(5, 'Visa Processing', 15000, d, { planId: `plan-${b.id}-5`, installment: k + 1, installments: 4 }));
  pay(5, 'Visa Processing', 15000, 61, 12, 10, 'Bank', { planId: `plan-${b.id}-5`, installment: 1 });
  pay(5, 'Visa Processing', 15000, 29, 16, 30, 'Other', { planId: `plan-${b.id}-5`, installment: 2, methodNote: 'Khalti' });

  // Walk-in consultation fees and a translation job today
  walkIns.slice(0, 3).forEach((w, k) => {
    const c = { clientId: w.clientId ?? `CSC-${w.id}`, clientName: w.name, counselor: w.assignedCounselor, country: w.country.split(',')[0].trim() };
    add({ kind: 'Charge', ...c, service: 'Consultation Fee', amount: 2000, at: stamp(0, 9 + k, 10), by: fd, dueDate: isoDate(0) });
    add({ kind: 'Payment', ...c, service: 'Consultation Fee', amount: 2000, at: stamp(0, 9 + k, 15), by: fd, method: k === 1 ? 'Other' : 'Cash', methodNote: k === 1 ? 'Fonepay QR' : undefined });
  });
  charge(2, 'Document Translation', 3000, 0);
  pay(2, 'Document Translation', 3000, 0, 13, 30, 'Bank', { methodNote: 'Card' });

  // Document charge added by the V/A Officer today (Kathmandu's Ready-for-Visa demo client)
  const ready = apps.findIndex((a) => a.name === 'Nirjala Acharya');
  if (ready >= 0) {
    const va = SEED_STAFF.find((st) => st.branch === b.name && st.role === 'V/A Officer' && st.status === 'Active')?.name ?? manager;
    add({ kind: 'Charge', ...client(ready), service: 'Document Translation', title: 'Translation Fee', amount: 2000, at: stamp(0, 11, 5), by: va, dueDate: isoDate(0), reason: 'Translation of 4 academic transcripts (Nepali → English) for the visa file.' });
  }

  // A duplicate entered yesterday and voided — kept on record, excluded from totals
  pay(3, 'IELTS / PTE Class', 12000, 1, 16, 50, 'Cash', { void: { reason: 'Entered twice — duplicate of the same cash payment.', by: manager, at: stamp(1, 17, 5) } });

  // Earlier collections this month and last month (revenue report)
  pay(0, 'Consultation Fee', 2000, 18, 10, 0, 'Cash'); charge(0, 'Consultation Fee', 2000, 18);
  pay(4, 'Document Translation', 3000, 12, 12, 0, 'Bank'); charge(4, 'Document Translation', 3000, 12);
  pay(1, 'IELTS / PTE Class', 12000, 36, 11, 0, 'Cash'); charge(1, 'IELTS / PTE Class', 12000, 36);

  // Refunds — original payments are never changed
  const refused = apps.findIndex((a) => a.visaApplication?.status === 'Visa Refused');
  const refundSlot = refused >= 0 ? refused : 2;
  charge(refundSlot, 'Visa Processing', 35000, 50, { at: stamp(70, 10, 0) });
  const visaPaid = pay(refundSlot, 'Visa Processing', 35000, 55, 11, 0, 'Bank');
  add({ kind: 'Refund', ...client(refundSlot), service: 'Visa Processing', amount: 15000, at: stamp(1, 15, 20), by: client(refundSlot).counselor, status: 'Pending Approval', reason: 'Visa refused — partial refund of the visa processing fee under the refund policy.', refOf: visaPaid.id });
  const ielts = out.find((t) => t.kind === 'Payment' && t.service === 'IELTS / PTE Class' && !t.void)!;
  add({ kind: 'Refund', ...client(1), service: 'IELTS / PTE Class', amount: 4000, at: stamp(4, 12, 0), by: fd, status: 'Approved', reason: 'Weekend batch cancelled — refund for the missed month.', refOf: ielts.id, decidedBy: manager, decidedAt: stamp(3, 10, 0) });
  const consult = out.find((t) => t.kind === 'Payment' && t.service === 'Consultation Fee' && t.clientId === client(0).clientId)!;
  add({ kind: 'Refund', ...client(0), service: 'Consultation Fee', amount: 2000, at: stamp(16, 12, 0), by: fd, status: 'Processed', reason: 'Consultation fee waived after enrolment.', refOf: consult.id, decidedBy: manager, decidedAt: stamp(15, 10, 0), processedBy: 'Finance — Head Office', processedAt: stamp(13, 11, 0) });
  // A large refund that needs Head Office eyes (Super Admin → Today's Attention): a tuition
  // deposit held in trust, to be returned after the institution withdrew the offer.
  if (bi < 2) {
    const title = 'Tuition deposit (held in trust)';
    charge(4, 'Other Charge', 120000, 21, { title });
    const deposit = pay(4, 'Other Charge', 120000, 20, 14, 0, 'Bank', { title, methodNote: 'Deposit account' });
    add({ kind: 'Refund', ...client(4), service: 'Other Charge', title, amount: 120000, at: stamp(2, 11, 40), by: manager, status: 'Pending Approval', reason: 'Institution withdrew the offer — the full deposit goes back to the client.', refOf: deposit.id });
  }

  // Discounts — requested by staff, approved or rejected by the manager
  add({ kind: 'Discount', ...client(4), service: 'Application Processing', amount: 5000, standardFee: 25000, at: stamp(0, 10, 30), by: client(4).counselor, status: 'Pending Approval', reason: 'Sibling of an existing client — family discount.' });
  add({ kind: 'Discount', ...client(2), service: 'Visa Processing', amount: 3000, standardFee: 35000, at: stamp(2, 16, 0), by: client(2).counselor, status: 'Pending Approval', reason: 'Referred two new clients this month.' });
  add({ kind: 'Discount', ...client(0), service: 'Application Processing', amount: 2500, standardFee: 25000, at: stamp(41, 11, 0), by: client(0).counselor, status: 'Approved', reason: 'Early payment in full.', decidedBy: manager, decidedAt: stamp(40, 15, 0) });
  add({ kind: 'Discount', ...client(5), service: 'Visa Processing', amount: 10000, standardFee: 60000, at: stamp(20, 11, 0), by: client(5).counselor, status: 'Rejected', reason: 'Client asked for a lower fee.', decidedBy: manager, decidedAt: stamp(19, 15, 0), decisionNote: 'Already on a payment plan — no further discount.' });

  // Receipt numbers for every payment, in date order
  out.filter((t) => t.kind === 'Payment')
    .sort((x, y) => (parseSeedStamp(x.at) - parseSeedStamp(y.at)))
    .forEach((p, k) => { p.receiptNo = `RCP-${code}-${2026}-${String(1040 + bi * 400 + k).padStart(5, '0')}`; });
  return out;
});

function parseSeedStamp(s: string): number {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!m) return 0;
  const h = (Number(m[4]) % 12) + (m[6] === 'PM' ? 12 : 0);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, Number(m[5])).getTime();
}

// ── Expense claims ──────────────────────────────────────────────────────────
// One pending claim per branch (printer toner), plus decided history for the Approval Center.
export const SEED_EXPENSES: ExpenseRequest[] = SEED_BRANCHES.flatMap((b) => {
  const manager = b.manager ?? 'Branch Manager';
  const fd = SEED_STAFF.find((st) => st.branch === b.name && st.role === 'Front Desk Officer')?.name ?? manager;
  const va = SEED_STAFF.find((st) => st.branch === b.name && st.role === 'V/A Officer' && st.status === 'Active')?.name ?? fd;
  const co = SEED_STAFF.find((st) => st.branch === b.name && st.role === 'Counselor')?.name ?? fd;
  const e = (id: string, title: string, category: ExpenseRequest['category'], amount: number, reason: string, by: string, ago: number, status: ExpenseRequest['status'], note?: string): ExpenseRequest => ({
    id: `exp-${b.id}-${id}`, branch: b.name, title, category, amount, reason, requestedBy: by, requestedAt: stamp(ago, 11, 30), receiptAttached: status !== 'Pending' || id === 'toner',
    status, ...(status === 'Pending' ? {} : { decidedBy: manager, decidedAt: stamp(Math.max(0, ago - 1), 15, 10), decisionNote: note }),
  });
  return [
    e('toner', 'Printer toner cartridges (2)', 'Office Supplies', 4500, 'First-floor printer is out of toner — offer letters and receipts can’t be printed.', fd, 0, 'Pending'),
    e('courier', 'Courier — client documents to Kathmandu embassy', 'Client Service', 2800, 'Original academic documents for two visa files.', va, 6, 'Approved'),
    e('internet', 'Internet backup data pack', 'Utilities', 1500, 'Mobile hotspot while the office line was down.', fd, 11, 'Approved'),
    e('stationery', 'Stationery and client folders', 'Office Supplies', 3200, 'Monthly stationery restock.', fd, 18, 'Approved'),
    e('boost', 'Facebook ad boost — Canada intake', 'Marketing', 8000, 'Boost the September intake post locally.', co, 9, 'Rejected', 'Marketing spend is handled by Head Office — please route through the Marketing team.'),
  ];
});

// ── Communication log ───────────────────────────────────────────────────────
// A few interactions for the first clients, so the Communication Log has history to show.
const COMMUNICATION_TEMPLATES: Omit<CommunicationEntry, 'id' | 'clientKey' | 'clientName' | 'occurredAt' | 'loggedBy' | 'loggedByRole' | 'createdAt'>[] = [
  { channel: 'In-person', direction: 'Inbound', summary: 'Walked in to discuss study options. Shared academic transcripts and preferred intake.', outcome: 'Interested — moving forward', nextAction: 'Shortlist 3 institutions', nextActionDate: isoDate(-1) },
  { channel: 'WhatsApp', direction: 'Outbound', summary: 'Sent the document checklist and asked for passport scan and bank statement.', outcome: 'Documents requested', nextAction: 'Follow up on bank statement', nextActionDate: isoDate(-3) },
  { channel: 'Phone call', direction: 'Outbound', summary: 'Called to confirm course choice. No answer.', outcome: 'No answer' },
  { channel: 'Email', direction: 'Inbound', summary: 'Client emailed the passport scan and sponsorship letter.', outcome: 'Documents received' },
];

export const SEED_COMMUNICATIONS: CommunicationEntry[] = SEED_COUNSELOR_STUDENTS.slice(0, 8).flatMap((c, ci) =>
  COMMUNICATION_TEMPLATES.slice(0, 2 + (ci % 3)).map((t, ti): CommunicationEntry => {
    const byFrontDesk = t.channel === 'In-person';
    const author = byFrontDesk
      ? SEED_STAFF.find((st) => st.role === 'Front Desk Officer' && st.branch === COUNSELOR_BRANCH[c.assignedCounselor])?.name ?? c.assignedCounselor
      : c.assignedCounselor;
    return {
      ...t,
      id: `seed-cl-${c.id}-${ti}`,
      clientKey: c.clientId as string,
      clientName: c.name,
      occurredAt: pastIso(daysAgo(8 - ti * 2, 10 + ti, (ci * 11) % 60)),
      loggedBy: author,
      loggedByRole: byFrontDesk ? 'receptionist' : 'counselor',
      createdAt: pastIso(daysAgo(8 - ti * 2, 10 + ti, (ci * 11) % 60 + 5)),
    };
  })
);

// ── Marketing Department ────────────────────────────────────────────────────
// Leads flow Raw (inbox) → Qualified → Assigned (pushed to a branch queue); every lead
// carries a mandatory Source and Campaign tag. The Assigned rows point at the seeded
// marketing intakes (s13–s16, s19–s20) so Lead Monitoring and the ROI table follow them
// through the real branch pipeline.
const minsAgo = (m: number) => formatSubmittedAt(new Date(Date.now() - m * 60000));
const MKT = { manager: 'Priya Karki', leads: 'Sabina Gurung', planner: 'Srishti Shakya', designer: 'Rojan Maharjan' };

const rawLead = (
  id: string, name: string, phone: string, source: MarketingLead['source'], campaignId: string, message: string, mins: number,
  country?: string, program?: string,
): MarketingLead =>
  ({ id, name, phone, source, campaignId, message, receivedAt: minsAgo(mins), stage: 'Raw', preferredCountry: country, interestedProgram: program });

const qualifiedLead = (
  id: string, name: string, phone: string, source: MarketingLead['source'], campaignId: string,
  country: string, program: string, branch: string, mins: number,
): MarketingLead => ({
  id, name, phone, source, campaignId, receivedAt: minsAgo(mins + 180), stage: 'Qualified',
  preferredCountry: country, interestedProgram: program, preferredBranch: branch,
  qualifiedBy: MKT.leads, qualifiedAt: minsAgo(mins),
});

// Seeded marketing intakes → the lead each one came from.
const ASSIGNED_FROM: Record<string, { source: MarketingLead['source']; campaignId: string; program: string }> = {
  s13: { source: 'Website', campaignId: 'cmp4', program: 'Subsequent Work Permit' },
  s14: { source: 'TikTok', campaignId: 'cmp3', program: 'A-Level Foundation' },
  s15: { source: 'Facebook', campaignId: 'cmp6', program: 'Bachelor of Agriculture' },
  s16: { source: 'Instagram', campaignId: 'cmp2', program: 'College Diploma' },
  s19: { source: 'TikTok', campaignId: 'cmp3', program: 'Bachelor of Nursing' },
  s20: { source: 'Facebook', campaignId: 'cmp1', program: 'Diploma of Management' },
};
const assignedLeads: MarketingLead[] = SEED_STUDENTS.filter((s) => ASSIGNED_FROM[s.id]).map((s) => {
  const from = ASSIGNED_FROM[s.id];
  const at = s.broadcastAt ?? s.submittedAt;
  return {
    id: `mkl-${s.id}`,
    name: s.name,
    phone: s.phone,
    email: s.email,
    source: from.source,
    campaignId: from.campaignId,
    receivedAt: at,
    stage: 'Assigned',
    preferredCountry: s.country,
    interestedProgram: from.program,
    preferredBranch: s.branch || s.broadcastBranch || '',
    qualifiedBy: MKT.leads,
    qualifiedAt: at,
    assignedBy: MKT.leads,
    assignedAt: at,
    intakeId: s.id,
  };
});

// ── Marketing cases followed end-to-end through a branch ────────────────────
// Each case seeds the marketing lead AND the branch-side records the Leads Specialist
// watches read-only: the intake (claim = first contact), the counselor's consultation and,
// where it got that far, the application. Headline case: Aakriti Sherpa — Instagram,
// "Canada Jan 2027 Campaign", assigned to Chitwan, now at Offer Received.
interface MktCaseSeed {
  key: string; name: string; gender: string; phone: string; country: string; program: string; intake: string;
  academic: string; english: string; branch: string; counselor: string | null; source: MarketingLead['source'];
  campaignId: string; clientId: string;
  /** Days ago (fractional = hours) for each milestone. */
  received: number; assigned: number; contacted?: number;
  consultation?: { status: ConsultationStatus; outcome: ConsultationOutcome; completed?: number };
  offer?: { status: OfferStatus; enrolled: number; applied?: number; outcome?: number; institution: string };
  visa?: { status: VisaStageStatus; applied: number; outcome?: number };
  privateNote?: string;
}
const agoStamp = (days: number) => formatSubmittedAt(new Date(Date.now() - days * 86_400_000));
const MKT_CASE_SEEDS: MktCaseSeed[] = [
  {
    key: 'aakriti', name: 'Aakriti Sherpa', gender: 'Female', phone: '9842217765', country: 'Canada', program: 'PG Diploma — Health Informatics',
    intake: 'Jan 2027', academic: "Bachelor's in Public Health (3.4 GPA)", english: 'IELTS 7.0', branch: 'Chitwan', counselor: 'Manisha Joshi',
    source: 'Instagram', campaignId: 'cmp7', clientId: 'CSC-2026-1051', received: 34, assigned: 33.9, contacted: 33.6,
    consultation: { status: 'Consultation Complete', outcome: 'Proceeding', completed: 30 },
    offer: { status: 'Offer Received', enrolled: 28, applied: 21, outcome: 4, institution: 'Conestoga College' },
    privateNote: 'PRIVATE: sponsor is an uncle abroad — bank statement needs review.',
  },
  {
    key: 'bishal', name: 'Bishal Tamang', gender: 'Male', phone: '9806654321', country: 'Australia', program: 'Bachelor of Nursing',
    intake: 'Feb 2027', academic: '+2 Science (3.1 GPA)', english: 'Preparing for PTE', branch: 'Pokhara', counselor: 'Rohan Lama',
    source: 'Facebook', campaignId: 'cmp1', clientId: 'CSC-2026-1052', received: 14, assigned: 13.8, contacted: 12,
    consultation: { status: 'In Progress', outcome: 'Pending' },
  },
  {
    key: 'rupa', name: 'Rupa Gurung', gender: 'Female', phone: '9816602211', country: 'United Kingdom', program: 'MSc Business Analytics',
    intake: 'Jan 2027', academic: "Bachelor's in Business (3.0 GPA)", english: 'Not taken yet', branch: 'Kathmandu', counselor: 'Sneha Tamang',
    source: 'TikTok', campaignId: 'cmp3', clientId: 'CSC-2026-1053', received: 10, assigned: 9.9, contacted: 9,
    consultation: { status: 'Awaiting Consultation', outcome: 'Pending' },
  },
  {
    key: 'prabin', name: 'Prabin Thapa', gender: 'Male', phone: '9857033218', country: 'Australia', program: 'Master of Professional Accounting',
    intake: 'Feb 2027', academic: "Bachelor's in Business Studies (3.3 GPA)", english: 'PTE 65', branch: 'Butwal', counselor: 'Suman Basnet',
    source: 'Facebook', campaignId: 'cmp6', clientId: 'CSC-2026-1055', received: 88, assigned: 87.8, contacted: 87.5,
    consultation: { status: 'Consultation Complete', outcome: 'Proceeding', completed: 84 },
    offer: { status: 'Fee Paid', enrolled: 80, applied: 72, outcome: 55, institution: 'Deakin University' },
    visa: { status: 'Visa Approved', applied: 30, outcome: 3 },
  },
  {
    key: 'kabita', name: 'Kabita Rai', gender: 'Female', phone: '9861177045', country: 'Australia', program: 'Master of IT',
    intake: 'Jul 2027', academic: "Bachelor's in Computer Science", english: 'IELTS 6.5', branch: 'Kathmandu', counselor: null,
    source: 'Website', campaignId: 'cmp4', clientId: 'CSC-2026-1054', received: 0.4, assigned: 0.25,
  },
];

const MKT_CASES = MKT_CASE_SEEDS.map((c) => {
  const id = `s-mkt-${c.key}`;
  const base = SEED_STUDENTS[0];
  const intake: IntakeStudent = {
    ...base,
    id, name: c.name, gender: c.gender, phone: c.phone, email: `${c.key}.${c.name.split(' ')[1].toLowerCase()}@gmail.com`,
    country: c.country, purpose: 'Study', address: `${c.branch}, Nepal`,
    submittedAt: agoStamp(c.assigned), visitDateTime: agoStamp(c.assigned), addedBy: MKT.leads, referredThrough: 'Marketing',
    platformSource: c.source === 'TikTok' ? 'Tiktok' : c.source, broadcastBranch: c.branch, broadcastAt: agoStamp(c.assigned),
    claimedBy: c.counselor, claimedAt: c.contacted !== undefined ? agoStamp(c.contacted) : undefined,
    revisitedAt: undefined, visitHistory: undefined,
    status: c.counselor ? 'Assigned' : 'New', assignedCounselor: c.counselor, branch: c.branch,
  };
  const consultation: CounselorStudent | null = c.counselor && c.consultation ? {
    ...SEED_COUNSELOR_STUDENTS[0],
    id, clientId: c.clientId, name: intake.name, phone: intake.phone, email: intake.email, address: intake.address,
    country: c.country, purpose: 'Study', gender: c.gender, submittedAt: intake.submittedAt, addedBy: MKT.leads,
    visitDateTime: intake.visitDateTime, referredThrough: 'Marketing', platformSource: intake.platformSource,
    revisitedAt: undefined, visitHistory: undefined, enrolments: undefined,
    assignedDate: isoDate(Math.floor(c.contacted ?? 0)), assignedCounselor: c.counselor,
    consultationStatus: c.consultation.status, outcome: c.consultation.outcome,
    consultationNotes: c.privateNote ?? '',
    followUpDate: null, leadTemperature: undefined, followUpNote: undefined,
    completedDate: c.consultation.completed !== undefined ? isoDate(c.consultation.completed) : null,
  } : null;
  const application: ApplicationRecord | null = consultation && c.offer ? {
    ...SEED_APPLICATIONS[0],
    id: `a-mkt-${c.key}`, clientId: c.clientId, name: c.name, phone: c.phone, email: intake.email, address: intake.address,
    country: c.country, purpose: 'Study', gender: c.gender, counselor: c.counselor!, branch: c.branch,
    consultationDate: consultation.completedDate ?? isoDate(c.offer.enrolled), addedBy: MKT.leads, platformSource: intake.platformSource,
    visitDateTime: intake.visitDateTime, consultationNotes: c.privateNote ?? '',
    offerApplications: [{
      id: `o-mkt-${c.key}`, institution: c.offer.institution, country: c.country, course: c.program, intake: c.intake,
      status: c.offer.status, statusUpdatedAt: isoDate(c.offer.outcome ?? c.offer.applied ?? c.offer.enrolled),
      statusUpdatedBy: c.counselor!,
      enrolledDate: isoDate(c.offer.enrolled), enrolledBy: c.counselor!,
      appliedDate: c.offer.applied !== undefined ? isoDate(c.offer.applied) : undefined, appliedBy: c.offer.applied !== undefined ? c.counselor! : undefined,
      outcomeDate: c.offer.outcome !== undefined ? isoDate(c.offer.outcome) : undefined, outcomeBy: c.offer.outcome !== undefined ? c.counselor! : undefined,
      ...(c.offer.status === 'Fee Paid' ? { feePaidDate: isoDate((c.offer.outcome ?? 0) - 5), feePaidBy: c.counselor! } : {}),
    }],
    visaApplication: c.visa ? {
      ...(SEED_APPLICATIONS.find((a) => a.visaApplication)?.visaApplication ?? { checklist: {}, notes: '', statusUpdatedAt: isoDate(0) }),
      status: c.visa.status, preparingDocsDate: isoDate(c.visa.applied + 12), fileReadyDate: isoDate(c.visa.applied + 2),
      appliedDate: isoDate(c.visa.applied), outcomeDate: c.visa.outcome !== undefined ? isoDate(c.visa.outcome) : undefined,
      statusUpdatedAt: isoDate(c.visa.outcome ?? c.visa.applied), statusUpdatedBy: c.counselor!, notes: '',
      refundRequested: undefined, refundRequestedDate: undefined, refundFollowUpDate: undefined, refundFollowUpNote: undefined, refundFollowUpSetBy: undefined,
    } : null,
    withdrawn: false, withdrawnDate: undefined, previousEnrolments: undefined,
    notes: c.privateNote ? [{ id: `n-mkt-${c.key}`, text: c.privateNote, authorName: c.counselor!, authorRole: 'counselor', createdAt: agoStamp(20) }] : [],
    enrolmentChecklist: { marks: { academics: { by: c.counselor!, date: isoDate(c.offer.enrolled) }, passport: { by: c.counselor!, date: isoDate(c.offer.enrolled) } }, custom: [] },
  } : null;
  const lead: MarketingLead = {
    id: `mkl-${c.key}`, name: c.name, phone: c.phone, email: intake.email, source: c.source, campaignId: c.campaignId,
    message: `Interested in ${c.program}, ${c.country} — ${c.intake}.`, receivedAt: agoStamp(c.received), stage: 'Assigned',
    preferredCountry: c.country, interestedProgram: c.program, intake: c.intake, academicBackground: c.academic, englishTest: c.english,
    preferredBranch: c.branch, qualifiedBy: MKT.leads, qualifiedAt: agoStamp(c.assigned + 0.05),
    assignedBy: MKT.leads, assignedAt: agoStamp(c.assigned), intakeId: id,
  };
  return { lead, intake, consultation, application };
});
// Branch-side records join the shared seed lists the branch modules read from.
SEED_STUDENTS.push(...MKT_CASES.map((c) => c.intake));
SEED_COUNSELOR_STUDENTS.push(...MKT_CASES.flatMap((c) => (c.consultation ? [c.consultation] : [])));
SEED_APPLICATIONS.push(...MKT_CASES.flatMap((c) => (c.application ? [c.application] : [])));

// Front Desk content requests — reception is where clients collect visa grants, so Marketing
// asks the Front Desk for those photos. Every branch gets one pending visa-grant photo request;
// Kathmandu also has one delegated by its Branch Manager and one already submitted.
const frontDeskOf = (branch: string) => SEED_STAFF.find((s) => s.branch === branch && s.role === 'Front Desk Officer' && s.status === 'Active')?.name ?? '';
const visaGrantedAt = (branch: string, n: number, fallback: string) =>
  SEED_APPLICATIONS.filter((a) => a.branch === branch && a.visaApplication?.status === 'Visa Approved')[n]?.name ?? fallback;
const VISA_PHOTO_BRIEF = 'Please take a landscape photo of the client holding their visa grant letter in front of the branch logo. '
  + 'Get the signed photo-consent form first, keep the letter’s personal details covered, and ask for a one-line quote about their experience.';

const FRONT_DESK_REQUESTS: ContentRequest[] = [
  ...SEED_BRANCHES.map((b, i): ContentRequest => {
    const client = visaGrantedAt(b.name, 0, ['Anish Karki', 'Sarita Gurung', 'Dipesh Thapa', 'Kritika Shrestha'][i]);
    return {
      id: `cr-fd-${b.id}`,
      topic: `Visa Grant Photo for Client ${client}`,
      targetBranch: b.name,
      targetCounselor: frontDeskOf(b.name),
      needed: 'Landscape photo (2–3 shots) + client quote',
      deadline: isoDate(-(i + 1)),
      notes: `${client} is collecting their visa grant letter at reception this week. ${VISA_PHOTO_BRIEF}`,
      campaignId: 'cmp1',
      requestedBy: MKT.planner,
      requestedAt: stamp(1, 11, 20 + i),
      status: 'Waiting',
    };
  }),
  {
    id: 'cr-fd-b1-welcome',
    topic: 'Reception welcome clip for the Feb intake reel',
    targetBranch: 'Kathmandu',
    targetCounselor: frontDeskOf('Kathmandu'),
    needed: '15-second vertical video',
    deadline: isoDate(-4),
    notes: 'A short vertical clip greeting a walk-in client at reception, with the CSC logo wall in frame. No client faces without consent.',
    requestedBy: MKT.planner,
    requestedAt: stamp(2, 10, 5),
    status: 'Waiting',
    delegatedBy: 'Sujata Shrestha',
    delegatedAt: stamp(1, 15, 40),
    internalDue: isoDate(-2),
    delegationNote: 'Film before 11 AM when reception is quiet.',
  },
  {
    id: 'cr-fd-b1-done',
    topic: `Visa Grant Photo for Client ${visaGrantedAt('Kathmandu', 1, 'Srijana Bhattarai')}`,
    targetBranch: 'Kathmandu',
    targetCounselor: frontDeskOf('Kathmandu'),
    needed: 'Landscape photo (2–3 shots) + client quote',
    deadline: isoDate(3),
    notes: VISA_PHOTO_BRIEF,
    requestedBy: MKT.planner,
    requestedAt: stamp(7, 9, 50),
    status: 'Received',
    receivedAt: stamp(4, 14, 12),
    submittedBy: frontDeskOf('Kathmandu'),
    submittedFiles: [
      { id: 'fd-file-1', name: 'visa-grant-reception-1.jpg', size: 2_480_112, uploadedAt: stamp(4, 14, 10), by: frontDeskOf('Kathmandu') },
      { id: 'fd-file-2', name: 'visa-grant-reception-2.jpg', size: 2_311_904, uploadedAt: stamp(4, 14, 11), by: frontDeskOf('Kathmandu') },
    ],
    receivedNote: '“CSC Kathmandu guided me at every step — I can’t believe I’m going to Australia!” Consent form scanned to the shared folder.',
  },
];

export const SEED_MARKETING: MarketingStore = {
  campaigns: [
    { id: 'cmp1', name: 'Australia Feb 2027 Intake', platform: 'Facebook', objective: 'Lead Generation', target: 120, startDate: isoDate(40), endDate: isoDate(-20), budget: 150000, createdBy: MKT.manager },
    { id: 'cmp2', name: 'Canada Study Fair 2026', platform: 'Instagram', objective: 'Event Registration', target: 80, startDate: isoDate(25), endDate: isoDate(-5), budget: 90000, createdBy: MKT.manager },
    { id: 'cmp3', name: 'UK Scholarships Reels', platform: 'TikTok', objective: 'Lead Generation', target: 60, startDate: isoDate(30), endDate: isoDate(-30), budget: 60000, createdBy: MKT.manager },
    { id: 'cmp4', name: 'Website SEO Always-On', platform: 'Website', objective: 'Lead Generation', target: 40, startDate: isoDate(60), endDate: isoDate(-120), budget: 25000, createdBy: MKT.manager },
    { id: 'cmp5', name: 'NZ Spring Intake Teaser', platform: 'Multi-platform', objective: 'Brand Awareness', target: 30, startDate: isoDate(-7), endDate: isoDate(-37), budget: 50000, createdBy: MKT.manager },
    { id: 'cmp7', name: 'Canada Jan 2027 Campaign', platform: 'Instagram', objective: 'Lead Generation', target: 70, startDate: isoDate(50), endDate: isoDate(-10), budget: 80000, createdBy: MKT.manager },
    { id: 'cmp6', name: 'Summer IELTS Push', platform: 'Facebook', objective: 'Lead Generation', target: 50, startDate: isoDate(90), endDate: isoDate(45), budget: 40000, createdBy: MKT.manager },
  ],
  adSpend: [
    ['cmp1', 38, 18000, 'Nursing carousel'], ['cmp1', 24, 22000, 'Sydney campus video'], ['cmp1', 9, 15500, 'Lead form — Feb intake'], ['cmp1', 2, 6500, 'Retargeting'],
    ['cmp2', 22, 14000, 'Fair registration story'], ['cmp2', 10, 16000, 'Fair countdown'], ['cmp2', 1, 5000, 'Last-call reel'],
    ['cmp3', 28, 9000, 'Scholarship FAQ reel'], ['cmp3', 12, 11000, 'Student day-in-life'], ['cmp3', 3, 4000, 'Spark ads boost'],
    ['cmp4', 30, 6000, 'Google Search — Master of IT'], ['cmp4', 5, 4500, 'Google Search — Nursing'],
    ['cmp7', 45, 17000, 'Canada Jan 2027 — reels'], ['cmp7', 20, 14500, 'Canada lead form'],
    ['cmp6', 80, 21000, 'IELTS masterclass promo'], ['cmp6', 55, 17500, 'Free mock test'],
  ].map(([campaignId, days, amount, adName], i) => ({
    id: `ads${i + 1}`, campaignId: campaignId as string, date: isoDate(days as number), amount: amount as number, adName: adName as string, loggedBy: MKT.manager,
  })),
  leads: [
    rawLead('mkl-r1', 'Sagar Bhandari', '9841203311', 'Facebook', 'cmp1', 'Hi, I want to study nursing in Sydney. What is the process?', 25, 'Australia', 'Bachelor of Nursing'),
    rawLead('mkl-r2', 'Anusha Rai', '9803344120', 'Instagram', 'cmp2', 'Is the fair free? Can I come with my brother?', 64, 'Canada'),
    rawLead('mkl-r3', 'Bibek Khadka', '9818876502', 'TikTok', 'cmp3', 'scholarship for UK masters??', 130, 'United Kingdom', "Master's (any)"),
    rawLead('mkl-r4', 'Prerana Joshi', '9860012987', 'Website', 'cmp4', 'Enquiry form: Master of IT, Australia — July intake.', 190, 'Australia', 'Master of IT'),
    rawLead('mkl-r5', 'Roshan Thapa', '9812233007', 'Facebook', 'cmp1', 'price?', 300),
    rawLead('mkl-r6', 'Sunita Magar', '9846671230', 'Instagram', 'cmp2', "Canada PG diploma after a bachelor's in business — possible?", 480, 'Canada', 'PG Diploma — Business'),
    rawLead('mkl-r7', 'Aashish KC', '9851099812', 'TikTok', 'cmp3', 'UK January intake still open?', 1500, 'United Kingdom'),
    rawLead('mkl-r8', 'Mamata Shahi', '9869001234', 'Website', 'cmp4', 'Callback request from the Australia landing page.', 1650, 'Australia'),
    qualifiedLead('mkl-q1', 'Deepika Lama', '9841556610', 'Facebook', 'cmp1', 'Australia', 'Bachelor of Nursing', 'Kathmandu', 45),
    qualifiedLead('mkl-q2', 'Nabin Poudel', '9856023390', 'Instagram', 'cmp2', 'Canada', 'PG Diploma — Business', 'Pokhara', 120),
    qualifiedLead('mkl-q3', 'Srijana Adhikari', '9845120087', 'TikTok', 'cmp3', 'United Kingdom', 'MSc Data Science', 'Chitwan', 260),
    qualifiedLead('mkl-q4', 'Kiran Bohara', '9857044411', 'Website', 'cmp4', 'Australia', 'Master of IT', 'Butwal', 400),
    { ...rawLead('mkl-d1', 'Test Test', '9800000000', 'Facebook', 'cmp1', 'test', 2900), stage: 'Disqualified', disqualifyReason: 'Spam / test entry', qualifiedBy: MKT.leads, qualifiedAt: minsAgo(2800) },
    { ...rawLead('mkl-d2', 'Hari Prasad Oli', '9811223344', 'Instagram', 'cmp2', 'Looking for a job visa only.', 4300), stage: 'Disqualified', disqualifyReason: 'Not a study / visa service we offer', qualifiedBy: MKT.leads, qualifiedAt: minsAgo(4200) },
    ...assignedLeads,
    ...MKT_CASES.map((c) => c.lead),
  ],
  // One earlier "Ping Branch" so the Follow-up Status feed shows ping history.
  pings: [{ id: 'ping1', branch: 'Butwal', rule: 'uncontacted', leadIds: ['mkl-s19'], at: stamp(1, 16, 5), by: MKT.leads }],
  // Branch Requests: Waiting (on the counselor) → Received → Ready (sent to the designer).
  contentRequests: [
    { id: 'cr0', topic: 'Why choose Canada for January 2027?', targetBranch: 'Chitwan', targetCounselor: 'Rupesh Chaudhary', needed: '60-second video', deadline: isoDate(-3), notes: 'Talk about PG diplomas, co-op and the January intake timeline. Vertical, good light.', campaignId: 'cmp7', requestedBy: MKT.planner, requestedAt: stamp(1, 10, 30), status: 'Waiting' },
    { id: 'cr6', topic: 'Canada Jan 2027 Intro Video', targetBranch: 'Kathmandu', targetCounselor: 'Aarav Sharma', needed: '60-second intro video', deadline: isoDate(-2), notes: 'Introduce yourself and CSC Kathmandu, then 3 quick reasons to apply for the January 2027 Canada intake (PG diplomas, co-op work, scholarships). Record vertically (9:16), quiet room, face the window for light. End with: "Book a free consultation with us."', campaignId: 'cmp7', requestedBy: MKT.planner, requestedAt: stamp(0, 9, 15), status: 'Waiting' },
    { id: 'cr1', topic: 'Why Australia for nursing — counselor explainer', targetBranch: 'Chitwan', targetCounselor: 'Manisha Joshi', needed: '90-second explainer video', deadline: isoDate(-2), campaignId: 'cmp1', requestedBy: MKT.planner, requestedAt: stamp(3, 11, 0), status: 'Waiting' },
    { id: 'cr2', topic: 'UK scholarship FAQ in 60 seconds', targetBranch: 'Pokhara', targetCounselor: 'Rohan Lama', needed: '60-second video', deadline: isoDate(0), campaignId: 'cmp3', requestedBy: MKT.planner, requestedAt: stamp(2, 15, 30), status: 'Waiting' },
    { id: 'cr3', topic: 'Canada visa success story', targetBranch: 'Pokhara', targetCounselor: 'Asmita Khadka', needed: 'Client testimonial video (consent signed)', deadline: isoDate(1), campaignId: 'cmp2', requestedBy: MKT.planner, requestedAt: stamp(5, 10, 15), status: 'Waiting' },
    { id: 'cr4', topic: 'Branch office walkthrough', targetBranch: 'Butwal', targetCounselor: 'Suman Basnet', needed: '6–8 photos of the office and reception', deadline: isoDate(-1), requestedBy: MKT.planner, requestedAt: stamp(6, 9, 45), status: 'Received', receivedAt: stamp(0, 9, 20) },
    { id: 'cr5', topic: 'Feb intake reminder reel', targetBranch: 'Kathmandu', targetCounselor: 'Aarav Sharma', needed: 'Raw reel footage, 30 seconds', deadline: isoDate(2), campaignId: 'cmp1', requestedBy: MKT.planner, requestedAt: stamp(9, 14, 0), status: 'Ready', receivedAt: stamp(4, 16, 20), contentItemId: 'ci8' },
    ...FRONT_DESK_REQUESTS,
  ],
  // Content Calendar: Idea → In Progress → Ready → Scheduled → Published. Published rows form Content History.
  contentItems: [
    { id: 'ci1', title: 'Canada Jan 2027 — why apply now', platform: 'Instagram', assignee: MKT.planner, deadline: isoDate(-3), status: 'Idea', createdBy: MKT.planner },
    { id: 'ci2', title: 'Australia Feb intake carousel', platform: 'Facebook', assignee: MKT.designer, deadline: isoDate(0), status: 'In Progress', createdBy: MKT.planner },
    { id: 'ci3', title: 'UK scholarship reel cover', platform: 'TikTok', assignee: MKT.designer, deadline: isoDate(0), status: 'In Progress', createdBy: MKT.planner },
    { id: 'ci4', title: 'Canada fair countdown post', platform: 'Facebook', assignee: MKT.planner, deadline: isoDate(-1), status: 'Ready', createdBy: MKT.planner },
    { id: 'ci5', title: 'Nursing in Sydney explainer', platform: 'TikTok', assignee: MKT.planner, deadline: isoDate(0), status: 'Scheduled', branch: 'Chitwan', person: 'Manisha Joshi', createdBy: MKT.planner },
    { id: 'ci6', title: 'Meet the universities — Canada fair', platform: 'Instagram', assignee: MKT.planner, deadline: isoDate(-2), status: 'Scheduled', createdBy: MKT.planner },
    { id: 'ci7', title: 'Master of IT in Australia — 2027 guide', platform: 'Website', assignee: MKT.planner, deadline: isoDate(-4), status: 'In Progress', createdBy: MKT.planner },
    { id: 'ci8', title: 'Feb intake reminder reel', platform: 'Instagram', assignee: MKT.designer, deadline: isoDate(-3), status: 'In Progress', branch: 'Kathmandu', person: 'Aarav Sharma', requestId: 'cr5', createdBy: MKT.planner },
    { id: 'ci9', title: 'NZ spring intake teaser', platform: 'Instagram', assignee: MKT.designer, deadline: isoDate(-10), status: 'Idea', createdBy: MKT.manager },
    { id: 'ci10', title: 'IELTS vs PTE — which should you take?', platform: 'Facebook', assignee: MKT.planner, deadline: isoDate(-6), status: 'Idea', createdBy: MKT.planner },
    // Published — the searchable archive.
    { id: 'ch1', title: 'Feb 2027 intake: nursing, IT and business pathways', platform: 'Facebook', assignee: MKT.planner, deadline: isoDate(3), status: 'Published', publishedAt: isoDate(3), publishedLink: 'https://www.facebook.com/cscglobal/posts/feb-2027-pathways', createdBy: MKT.planner },
    { id: 'ch2', title: 'UK scholarships explained in 60 seconds', platform: 'TikTok', assignee: 'Manisha Joshi', deadline: isoDate(5), status: 'Published', branch: 'Chitwan', person: 'Manisha Joshi', publishedAt: isoDate(5), publishedLink: 'https://www.tiktok.com/@cscglobal/video/uk-scholarships-60s', createdBy: MKT.planner },
    { id: 'ch3', title: 'Canada fair is coming to Kathmandu and Pokhara', platform: 'Instagram', assignee: MKT.designer, deadline: isoDate(8), status: 'Published', publishedAt: isoDate(8), publishedLink: 'https://www.instagram.com/p/csc-canada-fair', createdBy: MKT.planner },
    { id: 'ch4', title: 'Nursing in Australia — entry requirements', platform: 'Website', assignee: MKT.planner, deadline: isoDate(12), status: 'Published', publishedAt: isoDate(12), publishedLink: 'https://cscglobal.com.np/blog/nursing-in-australia', createdBy: MKT.planner },
    { id: 'ch5', title: 'Visa success: Om Prakash, New Zealand', platform: 'Facebook', assignee: 'Rohan Lama', deadline: isoDate(15), status: 'Published', branch: 'Pokhara', person: 'Rohan Lama', publishedAt: isoDate(15), publishedLink: 'https://www.facebook.com/cscglobal/posts/visa-success-om-prakash', createdBy: MKT.planner },
    { id: 'ch6', title: 'Kathmandu office open house — photos', platform: 'Facebook', assignee: 'Aarav Sharma', deadline: isoDate(40), status: 'Published', branch: 'Kathmandu', person: 'Aarav Sharma', publishedAt: isoDate(40), createdBy: MKT.planner },
    { id: 'ch7', title: 'IELTS or PTE? Counselor answers', platform: 'Instagram', assignee: 'Sneha Tamang', deadline: isoDate(60), status: 'Published', branch: 'Kathmandu', person: 'Sneha Tamang', publishedAt: isoDate(60), publishedLink: 'https://www.instagram.com/reel/ielts-or-pte', createdBy: MKT.planner },
    { id: 'ch8', title: 'Why choose Canada? Counselor Q&A (Sept 2026 intake)', platform: 'Instagram', assignee: 'Asmita Khadka', deadline: isoDate(74), status: 'Published', branch: 'Pokhara', person: 'Asmita Khadka', publishedAt: isoDate(74), publishedLink: 'https://www.instagram.com/reel/why-choose-canada-qa', createdBy: MKT.planner },
    { id: 'ch9', title: 'Australia post-study work rights explained', platform: 'Website', assignee: MKT.planner, deadline: isoDate(95), status: 'Published', publishedAt: isoDate(95), publishedLink: 'https://cscglobal.com.np/blog/australia-post-study-work', createdBy: MKT.planner },
    { id: 'ch10', title: 'Canada study permit — document checklist', platform: 'TikTok', assignee: 'Sneha Tamang', deadline: isoDate(120), status: 'Published', branch: 'Kathmandu', person: 'Sneha Tamang', publishedAt: isoDate(120), publishedLink: 'https://www.tiktok.com/@cscglobal/video/canada-permit-checklist', createdBy: MKT.planner },
  ],
  // Graphics Designer queues. Static designs: Requested → In Progress → Ready for Review → Approved → Scheduled.
  designTasks: [
    {
      id: 'dt9', title: 'Study in Canada Webinar Poster', type: 'Poster', priority: 'High', platform: 'Facebook', dimensions: '1080×1350 (+ A3 print)',
      deadline: isoDate(-2), stage: 'Requested', requestedBy: MKT.planner, campaignId: 'cmp7',
      brief: 'Poster for the free Canada webinar. Speaker photo on the right, headline top-left, date/time in a navy band, QR code to the registration form bottom-right. Keep the print version CMYK with 3 mm bleed.',
      caption: 'FREE WEBINAR · Study in Canada — January 2027 intake. Sat 3 Oct, 4:00 PM (NPT) on Zoom. PG diplomas, co-op and scholarships explained. Register now — seats are limited.',
      references: ['https://www.instagram.com/p/csc-canada-fair', 'https://drive.google.com/file/d/uk-webinar-poster-2026'],
      assets: [
        { name: 'CSC brand kit (logos, fonts, colours)', url: 'https://drive.google.com/drive/folders/csc-brand-kit' },
        { name: 'Speaker photo — Rupesh Chaudhary.jpg', url: 'https://drive.google.com/file/d/speaker-rupesh' },
        { name: 'Registration QR code.png' },
      ],
    },
    { id: 'dt1', title: 'Australia Feb intake carousel', type: 'Post', priority: 'Medium', brief: '5-slide carousel: nursing, IT, business pathways + CTA to lead form.', caption: 'Feb 2027 intake is open 🇦🇺 Swipe for the 3 most popular pathways →', platform: 'Facebook', dimensions: '1080×1080', deadline: isoDate(0), stage: 'Requested', requestedBy: MKT.planner, campaignId: 'cmp1', contentItemId: 'ci2', assets: [{ name: 'Campus photos — Sydney (8)', url: 'https://drive.google.com/drive/folders/sydney-campus' }] },
    { id: 'dt2', title: 'Canada fair story set', type: 'Story', priority: 'High', brief: '3 stories: date/venue, universities attending, register link sticker.', platform: 'Instagram', dimensions: '1080×1920', deadline: isoDate(0), stage: 'Requested', requestedBy: MKT.planner, campaignId: 'cmp2' },
    { id: 'dt3', title: 'UK scholarship reel cover', type: 'Reel', priority: 'Medium', brief: 'Bold title "Up to £5,000 off" with counselor cut-out.', platform: 'TikTok', dimensions: '1080×1920', deadline: isoDate(0), stage: 'In Progress', requestedBy: MKT.planner, assignee: MKT.designer, campaignId: 'cmp3', contentItemId: 'ci3' },
    { id: 'dt4', title: 'Website hero — Master of IT', type: 'Post', priority: 'Low', brief: 'Hero banner for the Australia IT landing page, navy palette.', platform: 'Website', dimensions: '1920×600', deadline: isoDate(-3), stage: 'In Progress', requestedBy: MKT.manager, assignee: MKT.designer, campaignId: 'cmp4', reviewNote: 'Make the headline bigger and drop the stock laptop photo.' },
    { id: 'dt5', title: 'Visa success testimonial card', type: 'Post', priority: 'Medium', brief: 'Quote card with the client photo (consent on file) and visa grant month.', caption: '"CSC made the whole visa process simple." — Om Prakash, New Zealand', platform: 'Instagram', dimensions: '1080×1350', deadline: isoDate(-2), stage: 'Ready for Review', requestedBy: MKT.planner, assignee: MKT.designer, campaignId: 'cmp2', finalFiles: [{ id: 'f1', name: 'testimonial-om-prakash_v2.png', size: 1_840_000, uploadedAt: stamp(0, 10, 40), by: MKT.designer }] },
    { id: 'dt6', title: 'Fair countdown post', type: 'Post', priority: 'Medium', brief: '"3 days to go" countdown with the venue map.', platform: 'Facebook', dimensions: '1200×630', deadline: isoDate(-1), stage: 'Approved', requestedBy: MKT.planner, assignee: MKT.designer, campaignId: 'cmp2', contentItemId: 'ci4', finalFiles: [{ id: 'f2', name: 'fair-countdown-3days.png', size: 960_000, uploadedAt: stamp(1, 15, 10), by: MKT.designer }] },
    { id: 'dt7', title: 'Nursing in Sydney reel thumbnail', type: 'Reel', priority: 'Low', brief: 'Thumbnail for the counselor explainer reel.', platform: 'TikTok', dimensions: '1080×1920', deadline: isoDate(1), stage: 'Scheduled', requestedBy: MKT.planner, assignee: MKT.designer, campaignId: 'cmp1', contentItemId: 'ci5', finalFiles: [{ id: 'f3', name: 'nursing-sydney-thumb.jpg', size: 420_000, uploadedAt: stamp(2, 12, 0), by: MKT.designer }] },
    { id: 'dt8', title: 'NZ spring teaser static', type: 'Post', priority: 'Low', brief: 'Teaser visual — "Something big for NZ this spring".', platform: 'Instagram', dimensions: '1080×1080', deadline: isoDate(-10), stage: 'Requested', requestedBy: MKT.manager, campaignId: 'cmp5' },
  ],
  // Video editing: To Edit → In Progress → Ready for Review → Completed.
  videoTasks: [
    {
      id: 'v1', title: 'Canada Intake Reel', status: 'To Edit', priority: 'High', platform: 'Instagram', duration: '45–60 sec', deadline: isoDate(-1),
      sourceLink: 'https://drive.google.com/drive/folders/canada-intake-raw-footage', requestedBy: MKT.planner, assignee: MKT.designer,
      branch: 'Pokhara', person: 'Asmita Khadka',
      instructions: 'Hook in the first 3 seconds ("January 2027 is still open"). Burn-in English captions, CSC lower-third with the counselor name, end card: "Book a free consultation". Upbeat track from the brand library. Export 1080×1920, H.264.',
    },
    { id: 'v2', title: 'UK scholarship FAQ — 60 seconds', status: 'In Progress', priority: 'Medium', platform: 'TikTok', duration: '60 sec', deadline: isoDate(0), sourceLink: 'https://drive.google.com/drive/folders/uk-faq-raw', requestedBy: MKT.planner, assignee: MKT.designer, branch: 'Chitwan', person: 'Manisha Joshi', instructions: 'Split into 3 questions with title cards. Keep jump cuts tight; captions throughout.' },
    { id: 'v3', title: 'Feb intake reminder reel', status: 'In Progress', priority: 'Medium', platform: 'Instagram', duration: '30 sec', deadline: isoDate(-3), sourceLink: 'https://drive.google.com/drive/folders/feb-intake-reel-raw', requestedBy: MKT.planner, assignee: MKT.designer, branch: 'Kathmandu', person: 'Aarav Sharma', requestId: 'cr5', contentItemId: 'ci8', instructions: 'Countdown style — "Feb 2027 applications close soon". Add the 3 key dates as on-screen text.' },
    { id: 'v4', title: 'Visa success story — Om Prakash', status: 'Ready for Review', priority: 'Medium', platform: 'Facebook', duration: '90 sec', deadline: isoDate(-1), sourceLink: 'https://drive.google.com/drive/folders/visa-success-om-raw', requestedBy: MKT.planner, assignee: MKT.designer, branch: 'Pokhara', person: 'Rohan Lama', instructions: 'Interview cut-down. Keep the client consent card at the start. Soft background music.', finalFiles: [{ id: 'f4', name: 'visa-success-om-prakash_v2.mp4', size: 48_300_000, uploadedAt: stamp(0, 11, 5), by: MKT.designer }] },
    { id: 'v5', title: 'Nursing in Sydney explainer', status: 'Completed', priority: 'Medium', platform: 'TikTok', duration: '60 sec', deadline: isoDate(3), sourceLink: 'https://drive.google.com/drive/folders/nursing-sydney-raw', requestedBy: MKT.planner, assignee: MKT.designer, branch: 'Chitwan', person: 'Manisha Joshi', contentItemId: 'ci5', instructions: 'Explainer with B-roll of Sydney campuses.', completedAt: stamp(2, 17, 30), finalFiles: [{ id: 'f5', name: 'nursing-sydney-explainer_final.mp4', size: 36_900_000, uploadedAt: stamp(2, 16, 45), by: MKT.designer }] },
    { id: 'v6', title: 'Kathmandu office tour', status: 'To Edit', priority: 'Low', platform: 'YouTube', duration: '2–3 min', deadline: isoDate(-5), requestedBy: MKT.manager, branch: 'Kathmandu', person: 'Aarav Sharma', instructions: 'Walk-through from reception to counselling rooms. Waiting on the branch to share the footage.' },
  ],
  posts: [
    { id: 'p1', platform: 'Facebook', caption: 'Canada Study Fair — 3 days to go! Register free via the link.', scheduledAt: stamp(-1, 10, 0), status: 'Scheduled', campaignId: 'cmp2', designTaskId: 'dt6', createdBy: MKT.planner },
    { id: 'p2', platform: 'TikTok', caption: 'Nursing in Sydney: what nobody tells you.', scheduledAt: stamp(0, 18, 0), status: 'Scheduled', campaignId: 'cmp1', designTaskId: 'dt7', createdBy: MKT.planner },
    { id: 'p3', platform: 'Instagram', caption: 'Meet the universities coming to our Canada fair.', scheduledAt: stamp(-2, 12, 30), status: 'Scheduled', campaignId: 'cmp2', createdBy: MKT.planner },
    { id: 'p4', platform: 'Website', caption: 'Blog: Master of IT in Australia — 2027 guide.', scheduledAt: stamp(-4, 9, 0), status: 'Scheduled', campaignId: 'cmp4', createdBy: MKT.planner },
    { id: 'p5', platform: 'Facebook', caption: 'Feb 2027 intake: nursing, IT and business pathways.', scheduledAt: stamp(3, 10, 0), status: 'Published', publishedAt: stamp(3, 10, 0), campaignId: 'cmp1', createdBy: MKT.planner, reach: 18400, engagements: 1120, leads: 14 },
    { id: 'p6', platform: 'TikTok', caption: 'UK scholarships explained in 60s.', scheduledAt: stamp(5, 19, 0), status: 'Published', publishedAt: stamp(5, 19, 0), campaignId: 'cmp3', createdBy: MKT.planner, reach: 42600, engagements: 3890, leads: 9 },
    { id: 'p7', platform: 'Instagram', caption: 'Canada fair is coming to Kathmandu and Pokhara.', scheduledAt: stamp(8, 12, 0), status: 'Published', publishedAt: stamp(8, 12, 0), campaignId: 'cmp2', createdBy: MKT.planner, reach: 9700, engagements: 860, leads: 6 },
    { id: 'p8', platform: 'Website', caption: 'Blog: Nursing in Australia — entry requirements.', scheduledAt: stamp(12, 9, 0), status: 'Published', publishedAt: stamp(12, 9, 0), campaignId: 'cmp4', createdBy: MKT.planner, reach: 3100, engagements: 240, leads: 4 },
    { id: 'p9', platform: 'Facebook', caption: 'Client visa success: Om Prakash, New Zealand.', scheduledAt: stamp(15, 11, 0), status: 'Published', publishedAt: stamp(15, 11, 0), createdBy: MKT.planner, reach: 12800, engagements: 1540, leads: 3 },
  ],
  seoTasks: [
    { id: 'seo1', title: 'Publish "Master of IT in Australia" guide', type: 'Blog Post', keyword: 'master of it australia', url: '/blog/master-of-it-australia', assignee: MKT.planner, due: isoDate(-4), status: 'In Progress' },
    { id: 'seo2', title: 'Fix duplicate meta titles on country pages', type: 'On-page', url: '/study-in/*', assignee: MKT.planner, due: isoDate(-2), status: 'To Do' },
    { id: 'seo3', title: 'Compress hero images (LCP > 4s on mobile)', type: 'Technical', url: '/', assignee: MKT.designer, due: isoDate(1), status: 'To Do' },
    { id: 'seo4', title: 'Keyword map for Canada PG diploma pages', type: 'Keyword Research', keyword: 'pg diploma canada', assignee: MKT.planner, due: isoDate(3), status: 'Done' },
    { id: 'seo5', title: 'Guest post outreach — 3 education blogs', type: 'Backlinks', assignee: MKT.manager, due: isoDate(-7), status: 'In Progress' },
  ],
  keywords: [
    { keyword: 'study in australia from nepal', position: 4, previous: 7, monthlySearches: 5400, url: '/study-in/australia' },
    { keyword: 'nursing in australia', position: 9, previous: 12, monthlySearches: 2900, url: '/blog/nursing-in-australia' },
    { keyword: 'uk scholarship for nepali students', position: 6, previous: 5, monthlySearches: 1900, url: '/scholarships/uk' },
    { keyword: 'pg diploma canada', position: 14, previous: 21, monthlySearches: 3600, url: '/study-in/canada' },
    { keyword: 'education consultancy kathmandu', position: 3, previous: 3, monthlySearches: 8100, url: '/' },
    { keyword: 'master of it australia', position: 18, previous: 26, monthlySearches: 1300, url: '/blog/master-of-it-australia' },
  ],
};

// ── Branch Manager Workspace ────────────────────────────────────────────────
// Every branch gets the same spread of records so any Branch Manager login shows each state:
// content requests at every pipeline step, support asks, IT tickets, and inter-branch transfers
// both into and out of the branch (pending, approved and rejected).
const IT_ENGINEERS = ['Suraj KC', 'Nabin Shahi'];

const clientsOfBranch = (branch: string) =>
  SEED_COUNSELOR_STUDENTS.filter((c) => (SEED_STUDENTS.find((s) => s.id === c.id)?.branch ?? COUNSELOR_BRANCH[c.assignedCounselor]) === branch);
const counselorsOf = (branch: string) => SEED_STAFF.filter((s) => s.branch === branch && s.role === 'Counselor' && s.status === 'Active').map((s) => s.name);

const seedContentRequests: BranchContentRequest[] = SEED_BRANCHES.flatMap((b, bi) => {
  const manager = b.manager ?? 'Branch Manager';
  return ([
    ['Social Reel', 'Jan 2027', 'Canada', 'Counselor-led reel on PG diploma + co-op for our walk-in crowd. Mention the branch address at the end.', -9, 0, 'Requested'],
    ['Flyer', 'Feb 2027', 'Australia', 'A5 flyer for the college fair — nursing and IT pathways, scholarship highlights, QR to the booking form.', -4, 3, 'In Production'],
    ['Event Banner', 'Feb 2027', 'Multiple', '6×3 ft roll-up banner for the Saturday education expo at the city hall.', -2, 6, 'Review'],
    ['Poster', 'Sep 2027', 'United Kingdom', 'UK Sep intake poster for the reception window, English + Nepali.', 8, 14, 'Delivered'],
  ] as const).map(([type, intake, country, notes, neededIn, askedDaysAgo, status], i): BranchContentRequest => ({
    id: `bcr-${b.id}-${i}`,
    code: `MKR-2026-${String(140 + bi * 4 + i).padStart(4, '0')}`,
    branch: b.name,
    type,
    intake,
    country,
    notes,
    neededBy: isoDate(neededIn),
    requestedBy: manager,
    requestedAt: stamp(askedDaysAgo, 10 + i, 5),
    status,
    updatedAt: status === 'Requested' ? undefined : stamp(Math.max(0, askedDaysAgo - 2), 15, 30),
    marketingNote: status === 'Review' ? 'Draft v2 uploaded — please confirm the expo date and stall number.' : status === 'Delivered' ? 'Print-ready PDF and a social crop are in the shared folder.' : undefined,
    deliveredLink: status === 'Delivered' ? 'https://drive.google.com/drive/folders/csc-uk-sep-2027' : undefined,
  }));
});

const seedSupportRequests: MarketingSupportRequest[] = SEED_BRANCHES.flatMap((b, bi) => {
  const manager = b.manager ?? 'Branch Manager';
  return ([
    ['Local Ad Boost', `Boost “Study in Canada” posts around ${b.name}`, 15000, -2, -16, `Clients within 25 km of ${b.name}, age 18–30`, 'Walk-ins dropped 18% this month; last boost brought 40+ enquiries in a week.', 1, 'Under Review'],
    ['Event Sponsorship', `${b.name} College Education Fair stall`, 35000, -12, -13, 'Grade 12 graduates and their parents', 'Stall + banner at the district’s biggest fair; three partner colleges will join us.', 6, 'Approved'],
    ['Regional Campaign Drive', 'Australia Feb intake — regional push', 60000, -20, -45, 'Nursing and IT aspirants in the region', 'Competitors are running heavy campaigns; we need a coordinated push before the Nov deadlines.', 10, 'Declined'],
  ] as const).map(([kind, title, budget, startIn, endIn, audience, justification, askedDaysAgo, status], i): MarketingSupportRequest => ({
    id: `msr-${b.id}-${i}`,
    code: `MSR-2026-${String(60 + bi * 3 + i).padStart(4, '0')}`,
    branch: b.name,
    kind,
    title,
    budget,
    startDate: isoDate(startIn),
    endDate: isoDate(endIn),
    audience,
    justification,
    requestedBy: manager,
    requestedAt: stamp(askedDaysAgo, 11, 40),
    status,
    responseNote: status === 'Approved' ? 'Approved — Marketing will ship banners and brochures by Thursday.' : status === 'Declined' ? 'Declined for this quarter — the regional budget is committed. Resubmit in January.' : undefined,
  }));
});

const seedItTickets: ItTicket[] = SEED_BRANCHES.flatMap((b, bi) => {
  const manager = b.manager ?? 'Branch Manager';
  return ([
    ['Network/VoIP', 'High', 'Desk phones drop calls after ~2 minutes', 'Both counselor desk phones cut out mid-call since Monday. The internet itself is fine.', ['call-log.png'], 0, 'Open'],
    ['CRM Issue', 'Medium', 'Receipt PDF shows the old branch address', 'Receipts generated from Financial Management still print the previous address.', ['receipt-sample.pdf'], 2, 'In Progress'],
    ['Software Access', 'Low', 'Canva Pro seat for the new counselor', 'New joiner needs a Canva Pro seat to prepare client presentations.', [], 4, 'Resolved'],
    ['Hardware', 'High', 'Reception PC will not boot', 'Front desk PC shows a black screen after the logo. Visitor log is being written on paper meanwhile.', ['boot-screen.jpg'], 7, 'Resolved'],
  ] as const).map(([category, priority, subject, description, attachments, daysAgoN, status], i): ItTicket => {
    const raisedAt = stamp(daysAgoN, 9 + i, 25);
    const engineer = IT_ENGINEERS[(bi + i) % IT_ENGINEERS.length];
    const history = [{ at: raisedAt, by: manager, text: 'Ticket raised' }];
    if (status !== 'Open') history.push({ at: stamp(Math.max(0, daysAgoN - 1), 13, 10), by: engineer, text: `Picked up by ${engineer}` });
    const resolution = status === 'Resolved'
      ? category === 'Hardware' ? 'Replaced the failed SSD and restored the profile from backup. Visitor log re-entered.' : 'Seat assigned under the branch workspace. Login details sent by email.'
      : undefined;
    if (resolution) history.push({ at: stamp(Math.max(0, daysAgoN - 2), 16, 45), by: engineer, text: 'Resolved' });
    return {
      id: `it-${b.id}-${i}`,
      code: `IT-2026-${String(310 + bi * 4 + i).padStart(4, '0')}`,
      branch: b.name, category, priority, subject, description, attachments: [...attachments],
      raisedBy: manager, raisedAt, status,
      assignee: status === 'Open' ? undefined : engineer,
      resolution,
      resolvedAt: resolution ? stamp(Math.max(0, daysAgoN - 2), 16, 45) : undefined,
      history,
    };
  });
});

// For each branch: one pending request OUT of it (for its manager to decide), and — via the
// neighbouring branches — one pending request INTO it, plus an approved and a rejected record.
let transferSeq = 17;
const seedTransfers: BranchTransfer[] = SEED_BRANCHES.flatMap((from, bi) => {
  const to = SEED_BRANCHES[(bi + 1) % SEED_BRANCHES.length];
  const out: BranchTransfer[] = [];
  const mine = clientsOfBranch(from.name);
  const theirs = clientsOfBranch(to.name);
  const toCounselor = counselorsOf(to.name)[0] ?? to.manager ?? '';
  const make = (c: CounselorStudent, fromB: string, toB: string, status: BranchTransfer['status'], daysAgoN: number, reason: string, fromCounselor = c.assignedCounselor): BranchTransfer => {
    const toManager = SEED_BRANCHES.find((x) => x.name === toB)?.manager ?? 'Branch Manager';
    const fromManager = SEED_BRANCHES.find((x) => x.name === fromB)?.manager ?? 'Branch Manager';
    const requestedAt = stamp(daysAgoN, 11, 15);
    const decidedAt = status === 'Pending' ? undefined : stamp(Math.max(0, daysAgoN - 1), 14, 5);
    const receiving = counselorsOf(toB)[0] ?? toManager;
    const decisionNote = status === 'Rejected' ? 'Client has an unpaid balance and a visa file mid-lodgement here — finish lodgement first, then re-request.' : status === 'Approved' ? 'Approved — files handed over.' : undefined;
    return {
      id: `trf-${transferSeq}`,
      code: `TRF-2026-${String(transferSeq++).padStart(4, '0')}`,
      clientKey: c.id, clientId: c.clientId ?? '—', clientName: c.name,
      fromBranch: fromB, toBranch: toB, fromCounselor, toCounselor: receiving,
      reason, visitDate: isoDate(daysAgoN), requestedBy: toManager, requestedAt,
      status, decidedBy: status === 'Pending' ? undefined : fromManager, decidedAt, decisionNote,
      log: [
        { at: requestedAt, by: toManager, role: `Branch Manager · ${toB}`, text: `Requested transfer ${fromB} → ${toB}. Reason: ${reason}` },
        ...(decidedAt ? [{ at: decidedAt, by: fromManager, role: `Branch Manager · ${fromB}`, text: `${status === 'Approved' ? 'Approved' : 'Rejected'} transfer.${decisionNote ? ` Note: ${decisionNote}` : ''}` }] : []),
        ...(status === 'Approved' ? [{ at: decidedAt!, by: 'System', role: 'Audit', text: `Primary branch changed ${fromB} → ${toB}; counselor ${fromCounselor} → ${receiving}.` }] : []),
      ],
    };
  };
  if (mine[0] && toCounselor) out.push(make(mine[0], from.name, to.name, 'Pending', 0, `Client moved to ${to.name} for work and visited the branch to continue the file there.`));
  if (mine[1]) out.push(make(mine[1], from.name, to.name, 'Rejected', 9, 'Client prefers the counselor at our branch after attending our seminar.'));
  // Already moved: the client now sits at `to`, so the record reads as approved history.
  const moved = theirs[theirs.length - 1];
  if (moved && theirs.length > 1) out.push(make(moved, from.name, to.name, 'Approved', 21, 'Family relocated; client wants in-person support nearer home.', counselorsOf(from.name)[0] ?? moved.assignedCounselor));
  return out;
});

export const SEED_WORKSPACE: ManagerWorkspaceStore = {
  contentRequests: seedContentRequests,
  supportRequests: seedSupportRequests,
  itTickets: seedItTickets,
  transfers: seedTransfers,
};

// ── Super Admin override audit log ──────────────────────────────────────────
export const SEED_AUDIT: AuditOverrideEntry[] = [
  {
    id: 'ovr-seed-1', at: stamp(6, 16, 5), by: 'Milan Gurung', record: 'Task · Prepare monthly partner-college visit report (Butwal)',
    field: 'Status', from: 'To Do', to: 'Done', reason: 'Report was emailed to Head Office directly; the branch forgot to close the task.',
  },
  {
    id: 'ovr-seed-2', at: stamp(12, 11, 30), by: 'Milan Gurung', record: 'Task · Renew printer service contract (Chitwan)',
    field: 'Status', from: 'Done', to: 'To Do', reason: 'Vendor rejected the renewal form — reopened so the branch follows up.',
  },
];

// ── Country routes on the Status Tracker (demo) ─────────────────────────────
// After "Offer Received" the counselor chooses the offer (country) to process; Australia / UK /
// New Zealand / USA then follow their own route, Canada the standard one. Files already past that
// point resolve from their offer and visa status. Two files are set up by hand:
// - Aayush Neupane chose his Australian offer and GS is approved, so Fee Paid is next and needs
//   the University Client ID;
// - Aakriti Sherpa holds offers in Canada and Australia and hasn't chosen yet.
(() => {
  const a = SEED_APPLICATIONS.find((x) => x.id === 'a1');
  const offer = a?.offerApplications[0];
  if (!a || !offer) return;
  offer.status = 'Offer Received';
  offer.appliedDate = offer.appliedDate ?? isoDate(18);
  offer.outcomeDate = isoDate(12);
  offer.statusUpdatedAt = isoDate(12);
  offer.country = offer.country ?? 'Australia';
  a.processingOfferId = offer.id;
  const at = (d: number) => stamp(d, 11, 0);
  const tick = (k: string) => Object.fromEntries(CHECKLISTS[k].items.map((it) => [it.key, true]));
  a.countryPipeline = {
    country: 'Australia',
    steps: {
      counseling: { doneAt: at(25), doneBy: a.counselor }, documents: { doneAt: at(20), doneBy: a.counselor },
      submitted: { doneAt: at(18), doneBy: a.counselor }, offer: { doneAt: at(12), doneBy: a.counselor, value: 'Conditional' },
      'gs-prep': { doneAt: at(9), doneBy: a.counselor }, 'gs-submitted': { doneAt: at(6), doneBy: a.counselor }, 'gs-approved': { doneAt: at(1), doneBy: a.counselor },
    },
    checklists: { documents: tick('documents'), 'au-gs': tick('au-gs') },
    log: [
      { at: at(9), by: a.counselor, text: 'GS Preparation completed' },
      { at: at(6), by: a.counselor, text: 'GS Submitted completed' },
      { at: at(1), by: a.counselor, text: 'GS Approved completed' },
      { at: at(1), by: 'System', text: 'GS approved — Fee Paid unlocked.' },
    ],
  };
})();

(() => {
  const a = SEED_APPLICATIONS.find((x) => x.id === 'a-mkt-aakriti');
  if (!a || a.offerApplications.some((o) => o.country === 'Australia')) return;
  a.offerApplications.forEach((o) => { o.country = o.country ?? 'Canada'; });
  a.offerApplications.push({
    id: 'off-aakriti-au', institution: 'University of Tasmania', country: 'Australia', course: 'Master of Health Informatics',
    intake: 'Feb 2027', status: 'Offer Received', enrolledDate: isoDate(20), appliedDate: isoDate(15), outcomeDate: isoDate(3),
    statusUpdatedAt: isoDate(3), outcomeBy: a.counselor,
  });
})();

// ── Service Charges (demo price list) ───────────────────────────────────────
// Different fees per visa type and destination country, with "All countries" fallbacks. Canada
// Student Visa shows a fee change (history kept) and IELTS a price scheduled for next month.
export const SEED_SERVICE_PRICES: ServicePrice[] = (() => {
  const SA = 'Milan Gurung';
  let i = 0;
  const p = (name: string, category: ServicePrice['category'], country: string, fee: number, effectiveFrom = '2026-01-01', extra: Partial<ServicePrice> = {}): ServicePrice => ({
    id: `price-${++i}`, name, category, country, fee, currency: 'NPR', effectiveFrom, active: true, setBy: SA, setAt: `${effectiveFrom} 10:00 AM`, ...extra,
  });
  const nextMonth = isoDate(-30);
  return [
    p('Student Visa', 'Visa Processing', 'All countries', 35000),
    p('Student Visa', 'Visa Processing', 'Australia', 35000),
    p('Student Visa', 'Visa Processing', 'United Kingdom', 40000),
    p('Student Visa', 'Visa Processing', 'Canada', 40000),
    p('Student Visa', 'Visa Processing', 'Canada', 45000, '2026-09-01', { note: 'IRCC fee increase' }),
    p('Student Visa', 'Visa Processing', 'USA', 50000),
    p('Student Visa', 'Visa Processing', 'New Zealand', 35000),
    p('Student Visa + SOWP', 'Visa Processing', 'Australia', 55000),
    p('Student Visa + SOWP', 'Visa Processing', 'Canada', 60000),
    p('SOWP', 'Visa Processing', 'All countries', 30000),
    p('Visitor Visa', 'Visa Processing', 'All countries', 15000),
    p('Visitor Visa', 'Visa Processing', 'USA', 20000),
    p('Application Processing', 'Application Processing', 'All countries', 25000),
    p('Consultation', 'Consultation Fee', 'All countries', 2000),
    p('IELTS / PTE Class', 'IELTS / PTE Class', 'All countries', 12000),
    p('IELTS / PTE Class', 'IELTS / PTE Class', 'All countries', 13500, nextMonth, { setAt: stamp(1, 16, 0), note: 'New batch pricing' }),
  ];
})();
