import { useState, useMemo, useEffect, useCallback } from 'react';
import Login from './components/Login';
import { resolveStaffUser } from './lib/sessionUser';
import DashboardShell from './components/DashboardShell';
import { CurrentUserContext } from './currentUser';
import OverviewPage from './components/OverviewPage';
import BranchManagerOverview from './components/BranchManagerOverview';
import ReceptionistOverview from './components/ReceptionistOverview';
import CounselorOverview from './components/CounselorOverview';
import ApplicationOfficerOverview from './components/ApplicationOfficerOverview';
import AllBranches from './components/AllBranches';
import PartnersPage from './components/PartnersPage';
import CommissionsPage from './components/CommissionsPage';
import ComingSoon from './components/ComingSoon';
import NewIntakeForm, { IntakeFormData } from './components/NewIntakeForm';
import StudentList from './components/StudentList';
import AssignCounselorPage from './components/AssignCounselorPage';
import AssignedClientsPage from './components/AssignedClientsPage';
import VisitorsPage from './components/VisitorsPage';
import EnrolledQueuePage from './components/EnrolledQueuePage';
import CounselorClientsPage from './components/CounselorClientsPage';
import ConsultationsPage from './components/ConsultationsPage';
import ApplicationsList from './components/ApplicationsList';
import StaffManagement from './components/StaffManagement';
import ArchivePage from './components/ArchivePage';
import FollowUpsPage from './components/FollowUpsPage';
import MarketingModule from './components/marketing/MarketingModule';
import { MARKETING_PAGES } from './components/marketing/mktPages';
import DesignerModule from './components/designer/DesignerModule';
import CounselorMarketing from './components/counselor/CounselorMarketing';
import CityLeadPool from './components/counselor/CityLeadPool';
import { CityPoolLead } from './cityLeadPool';
import { assignedContentRequests } from './counselorMarketing';
import { chargeLines, clientBalances } from './finance';
import { formatInterview, newlyScheduledInterview } from './countryPipeline';
import ManagerWorkspace from './components/manager/ManagerWorkspace';
import BranchDashboard from './components/manager/BranchDashboard';
import AdminModule from './components/admin/AdminModule';
import HeaderSearch from './components/admin/HeaderSearch';
import { ADMIN_NAV_KEYS, SA_SCAFFOLDS } from './components/admin/adminContext';
import { CommandSources, DEFAULT_FILTERS, GlobalFilters } from './superAdmin';
import { WORKSPACE_NAV_KEYS, WorkspaceActions } from './components/manager/workspaceContext';
import { branchOfClient, nextCode, transferCandidates } from './managerWorkspace';
import { DesignerActions } from './components/designer/designerContext';
import { designerView } from './designerData';
import { trackMarketingLeads } from './marketingDept';
import DailyTaskBoard from './components/DailyTaskBoard';
import BranchCommunicationCenter from './components/BranchCommunicationCenter';
import IssueEscalationCenter from './components/IssueEscalationCenter';
import BranchOperationsControl from './components/BranchOperationsControl';
import TimeAttendancePage from './components/TimeAttendancePage';
import HelpDeskPage from './components/HelpDeskPage';
import OnboardingOffboardingPage from './components/OnboardingOffboardingPage';
import MyOnboardingPage from './components/MyOnboardingPage';
import AttendanceDashboard from './components/AttendanceDashboard';
import TodaysAttendance from './components/TodaysAttendance';
import AttendanceHistory from './components/AttendanceHistory';
import CorrectionRequests from './components/CorrectionRequests';
import EmployeeAttendance from './components/EmployeeAttendance';
import LateAbsencePage from './components/LateAbsencePage';
import LeaveManagementPage from './components/LeaveManagementPage';
import HolidaysPage from './components/HolidaysPage';
import PerformancePage from './components/PerformancePage';
import PayrollInputsPage from './components/PayrollInputsPage';
import HrReportsPage from './components/HrReportsPage';
import HrDashboardPage from './components/HrDashboardPage';
import FinanceModule from './components/finance/FinanceModule';
import ManagerApprovalCenter from './components/ManagerApprovalCenter';
import FrontDeskPaymentsPage from './components/FrontDeskPaymentsPage';
import { FIN_NAV_KEYS } from './components/finance/financeContext';
import { holidaysFor } from './holidays';
import LeadVisitorManagement from './components/LeadVisitorManagement';
import ScaffoldPage from './components/ScaffoldPage';
import SmartClientMatching from './components/SmartClientMatching';
import VisaApprovedPage from './components/VisaApprovedPage';
import { BM_SCAFFOLDS } from './branchManagerPages';
import { MockUser, NavIntent, DailyTask, BranchNotice, BranchIssue, AttendanceRecord, AttendanceCorrection, BranchDayLog, OnboardingCase, OffboardingCase, LeaveRecord, AttendanceExplanation, Holiday, PerformanceReview, PayProfile, PayrollRun, FinTransaction, ExpenseRequest, CommunicationEntry, IntakeStudent, CounselorStudent, ApplicationRecord, OfferApplication, StaffMember, Branch, CommissionRecord, Partner, AppNotification, Counselor, MarketingStore, MarketingLead, ContentRequest, BranchPing, DeliveredFile, ClientAuditEntry, ManagerWorkspaceStore, BranchTransfer, AuditOverrideEntry, ServicePrice, BranchContentRequest, MarketingSupportRequest, ItTicket } from './types';
import { isStudyCase, getClientStatusLabel } from './clientPipeline';
import { clientIdFor, generateClientId } from './clientId';
import { STAFF_ROLE_TO_ROLE, NAV_CONFIG, LEADS_SPECIALIST_NAV, CONTENT_PLANNER_NAV, DESIGNER_NAV, findNavEntry } from './mockData';
import { createIntakeNotification, createAssignmentNotification, createConsultationReadyNotification, createBranchManagerNotification, createLeadBroadcastNotification, createCityLeadBroadcastNotification, createStatusUpdateNotification } from './notifications';
import { dateKey, formatSubmittedAt } from './dateTime';
import { fetchNotifications, insertNotification, markNotificationRead, markNotificationsRead, fromRow as notificationFromRow, NotificationRow } from './lib/notificationsApi';
import { fetchCounselorStudents, updateCounselorStudent, upsertCounselorStudent, insertNewCounselorStudent, fromRow as counselorStudentFromRow, CounselorStudentRow } from './lib/counselorStudentsApi';
import { fetchStudents, insertStudent, updateStudent, claimStudent, fromRow as studentFromRow, StudentRow } from './lib/studentsApi';
import { fetchCounselors, insertCounselor, deleteCounselor, fromRow as counselorFromRow, CounselorRow } from './lib/counselorsApi';
import { fetchApplications, updateApplication, insertApplication, fromRow as applicationFromRow, ApplicationRow } from './lib/applicationsApi';
import { fetchStaff, insertStaff, updateStaff, deleteStaff, fromRow as staffFromRow, StaffRow } from './lib/staffApi';
import { supabase } from './lib/supabaseClient';
import { createStaffAccount, resetStaffPassword, updateStaffEmail, deleteStaffAccount } from './lib/adminStaffFunction';
import { fetchBranches, insertBranch, updateBranch, deleteBranch, fromRow as branchFromRow, BranchRow } from './lib/branchesApi';
import { fetchCommissions, updateCommission, fromRow as commissionFromRow, CommissionRow } from './lib/commissionsApi';
import { fetchPartners, insertPartner, updatePartner, deletePartner, fromRow as partnerFromRow, PartnerRow } from './lib/partnersApi';
import { subscribeToTable, applyRealtimeChange } from './lib/realtimeSubscribe';
import { fetchServicePrices, insertServicePrice, fromRow as servicePriceFromRow, ServicePriceRow } from './lib/servicePricesApi';
import { fetchCommunications, insertCommunication, fromRow as communicationFromRow, CommunicationRow } from './lib/ops/communicationsApi';
import { fetchTasks, insertTask, updateTask, deleteTask, fromRow as taskFromRow, TaskRow } from './lib/ops/tasksApi';
import { fetchBranchNotices, insertBranchNotice, updateBranchNotice, fromRow as branchNoticeFromRow, BranchNoticeRow } from './lib/ops/branchNoticesApi';
import { fetchBranchIssues, insertBranchIssue, updateBranchIssue, fromRow as branchIssueFromRow, BranchIssueRow } from './lib/ops/branchIssuesApi';
import { fetchAttendance, upsertAttendance, fromRow as attendanceFromRow, AttendanceRow } from './lib/hr/attendanceApi';
import { fetchAttendanceCorrections, insertAttendanceCorrection, updateAttendanceCorrection, fromRow as attendanceCorrectionFromRow, AttendanceCorrectionRow } from './lib/hr/attendanceCorrectionsApi';
import { fetchAttendanceExplanations, upsertAttendanceExplanation, fromRow as attendanceExplanationFromRow, AttendanceExplanationRow } from './lib/hr/attendanceExplanationsApi';
import { fetchBranchDayLogs, upsertBranchDayLog, fromRow as branchDayLogFromRow, BranchDayLogRow } from './lib/ops/branchDayLogsApi';
import { fetchLeave, insertLeave, updateLeave, fromRow as leaveFromRow, LeaveRecordRow } from './lib/hr/leaveApi';
import { fetchHolidays, upsertHoliday, deleteHoliday, fromRow as holidayFromRow, HolidayRow } from './lib/hr/holidaysApi';
import { fetchPerformanceReviews, upsertPerformanceReview, fromRow as performanceReviewFromRow, PerformanceReviewRow } from './lib/hr/performanceReviewsApi';
import { fetchPayProfiles, upsertPayProfile, fromRow as payProfileFromRow, PayProfileRow } from './lib/hr/payProfilesApi';
import { fetchPayrollRuns, upsertPayrollRun, fromRow as payrollRunFromRow, PayrollRunRow } from './lib/hr/payrollRunsApi';
import { fetchOnboardingCases, insertOnboardingCase, updateOnboardingCase, fromRow as onboardingCaseFromRow, OnboardingCaseRow } from './lib/hr/onboardingApi';
import { fetchOffboardingCases, insertOffboardingCase, updateOffboardingCase, fromRow as offboardingCaseFromRow, OffboardingCaseRow } from './lib/hr/offboardingApi';
import { fetchAuditLog, insertAuditLogEntry, fromRow as auditLogFromRow, AuditLogRow } from './lib/auditLogApi';
import { fetchFinTransactions, upsertFinTransaction, fromRow as finTransactionFromRow, FinTransactionRow } from './lib/finance/finTransactionsApi';
import { fetchExpenseRequests, updateExpenseRequest, fromRow as expenseRequestFromRow, ExpenseRequestRow } from './lib/finance/expenseRequestsApi';
import { fetchMarketingLeads, upsertMarketingLead, deleteMarketingLead, fromRow as marketingLeadFromRow, MarketingLeadRow } from './lib/marketing/marketingLeadsApi';
import { fetchMarketingCampaigns, upsertMarketingCampaign, deleteMarketingCampaign, fromRow as marketingCampaignFromRow, CampaignRow as MarketingCampaignRow } from './lib/marketing/marketingCampaignsApi';
import { fetchMarketingAdSpend, upsertMarketingAdSpend, deleteMarketingAdSpend, fromRow as marketingAdSpendFromRow, AdSpendRow as MarketingAdSpendRow } from './lib/marketing/marketingAdSpendApi';
import { fetchMarketingContentRequests, upsertMarketingContentRequest, deleteMarketingContentRequest, fromRow as marketingContentRequestFromRow, ContentRequestRow as MarketingContentRequestRow } from './lib/marketing/marketingContentRequestsApi';
import { fetchMarketingContentItems, upsertMarketingContentItem, deleteMarketingContentItem, fromRow as marketingContentItemFromRow, ContentItemRow as MarketingContentItemRow } from './lib/marketing/marketingContentItemsApi';
import { fetchMarketingDesignTasks, upsertMarketingDesignTask, deleteMarketingDesignTask, fromRow as marketingDesignTaskFromRow, DesignTaskRow as MarketingDesignTaskRow } from './lib/marketing/marketingDesignTasksApi';
import { fetchMarketingVideoTasks, upsertMarketingVideoTask, deleteMarketingVideoTask, fromRow as marketingVideoTaskFromRow, VideoTaskRow as MarketingVideoTaskRow } from './lib/marketing/marketingVideoTasksApi';
import { fetchMarketingPosts, upsertMarketingPost, deleteMarketingPost, fromRow as marketingPostFromRow, SocialPostRow as MarketingPostRow } from './lib/marketing/marketingPostsApi';
import { fetchMarketingSeoTasks, upsertMarketingSeoTask, deleteMarketingSeoTask, fromRow as marketingSeoTaskFromRow, SeoTaskRow as MarketingSeoTaskRow } from './lib/marketing/marketingSeoTasksApi';
import { fetchMarketingSeoKeywords, upsertMarketingSeoKeyword, deleteMarketingSeoKeyword, fromRow as marketingSeoKeywordFromRow } from './lib/marketing/marketingSeoKeywordsApi';
import { fetchMarketingPings, upsertMarketingPing, deleteMarketingPing, fromRow as marketingPingFromRow, BranchPingRow as MarketingPingRow } from './lib/marketing/marketingPingsApi';
import { fetchMarketingTrackedIntakes, fetchMarketingTrackedConsultations, fetchMarketingTrackedApplications, fetchMarketingTrackedRevenue, TrackedIntake, TrackedConsultation, TrackedApplication, TrackedRevenueTransaction } from './lib/marketing/marketingTrackingApi';
import { fetchBranchContentRequests, insertBranchContentRequest, updateBranchContentRequest, deleteBranchContentRequest, fromRow as branchContentRequestFromRow, BranchContentRequestRow } from './lib/ops/branchContentRequestsApi';
import { fetchMarketingSupportRequests, insertMarketingSupportRequest, updateMarketingSupportRequest, fromRow as marketingSupportRequestFromRow, MarketingSupportRequestRow } from './lib/marketing/marketingSupportRequestsApi';
import { fetchItTickets, insertItTicket, updateItTicket, fromRow as itTicketFromRow, ItTicketRow } from './lib/ops/itTicketsApi';
import { fetchBranchTransfers, insertBranchTransfer, updateBranchTransfer, fromRow as branchTransferFromRow, BranchTransferRow } from './lib/ops/branchTransfersApi';
import { CommunicationsContext } from './communications';
import { FinanceLedgerContext } from './financeLedger';

// Every store reflects real Supabase state only — no demo/seed fallback. Composite stores
// (Marketing, Manager Workspace) start from these empty shapes until their tables load.
const EMPTY_MARKETING: MarketingStore = { pings: [], leads: [], campaigns: [], adSpend: [], contentRequests: [], contentItems: [], designTasks: [], videoTasks: [], posts: [], seoTasks: [], keywords: [] };
const EMPTY_WORKSPACE: ManagerWorkspaceStore = { contentRequests: [], supportRequests: [], itTickets: [], transfers: [] };

// The Marketing store is mutated in dozens of places (named handlers here, and deep inside
// MarketingModule's own subtree via its `setStore` prop) — too many call sites to hand-wire
// individually. Instead, every one of its 11 arrays gets diffed against its previous value
// whenever `setMarketing` runs, and whatever changed is pushed to the matching Supabase table.
// This makes every existing/future `setMarketing(...)` call persist automatically.
function syncMarketingArray<T>(
  prevArr: T[],
  nextArr: T[],
  getKey: (item: T) => string,
  upsert: (item: T) => Promise<void>,
  del: (key: string) => Promise<void>,
  label: string
) {
  if (prevArr === nextArr) return;
  const prevByKey = new Map(prevArr.map((item) => [getKey(item), item] as const));
  const nextByKey = new Map(nextArr.map((item) => [getKey(item), item] as const));
  nextByKey.forEach((item, key) => {
    const prevItem = prevByKey.get(key);
    if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(item)) {
      upsert(item).catch((err) => console.error(`Failed to sync marketing.${label} to Supabase`, err));
    }
  });
  prevByKey.forEach((_item, key) => {
    if (!nextByKey.has(key)) {
      del(key).catch((err) => console.error(`Failed to sync marketing.${label} delete to Supabase`, err));
    }
  });
}

function persistMarketingDiff(prev: MarketingStore, next: MarketingStore) {
  syncMarketingArray(prev.leads, next.leads, (x) => x.id, upsertMarketingLead, deleteMarketingLead, 'leads');
  syncMarketingArray(prev.campaigns, next.campaigns, (x) => x.id, upsertMarketingCampaign, deleteMarketingCampaign, 'campaigns');
  syncMarketingArray(prev.adSpend, next.adSpend, (x) => x.id, upsertMarketingAdSpend, deleteMarketingAdSpend, 'adSpend');
  syncMarketingArray(prev.contentRequests, next.contentRequests, (x) => x.id, upsertMarketingContentRequest, deleteMarketingContentRequest, 'contentRequests');
  syncMarketingArray(prev.contentItems, next.contentItems, (x) => x.id, upsertMarketingContentItem, deleteMarketingContentItem, 'contentItems');
  syncMarketingArray(prev.designTasks, next.designTasks, (x) => x.id, upsertMarketingDesignTask, deleteMarketingDesignTask, 'designTasks');
  syncMarketingArray(prev.videoTasks, next.videoTasks, (x) => x.id, upsertMarketingVideoTask, deleteMarketingVideoTask, 'videoTasks');
  syncMarketingArray(prev.posts, next.posts, (x) => x.id, upsertMarketingPost, deleteMarketingPost, 'posts');
  syncMarketingArray(prev.seoTasks, next.seoTasks, (x) => x.id, upsertMarketingSeoTask, deleteMarketingSeoTask, 'seoTasks');
  syncMarketingArray(prev.keywords, next.keywords, (x) => x.keyword, upsertMarketingSeoKeyword, deleteMarketingSeoKeyword, 'keywords');
  syncMarketingArray(prev.pings, next.pings, (x) => x.id, upsertMarketingPing, deleteMarketingPing, 'pings');
}

export default function App() {
  const isIntakeForm = window.location.pathname === '/intake';

  const [user, setUser] = useState<MockUser | null>(null);
  // True while a session kept from before a refresh is being checked — holds off the Login
  // screen so it doesn't flash before the user is restored.
  const [restoringSession, setRestoringSession] = useState(true);
  // A write to Supabase failed (e.g. blocked by RLS) — surfaced here so it's never silent:
  // the optimistic local state still shows the change, but this tells the user it didn't
  // actually save, instead of them finding out only after a refresh/relogin loses it.
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    if (!saveError) return undefined;
    const t = setTimeout(() => setSaveError(null), 8000);
    return () => clearTimeout(t);
  }, [saveError]);
  const [activeKey, setActiveKey] = useState<string>('overview');
  // Bumped on every sidebar click so the page remounts — this closes any open client
  // profile instead of leaving it on top of the newly selected page.
  const [navSeq, setNavSeq] = useState(0);
  const [navIntent, setNavIntent] = useState<NavIntent | null>(null);
  const [lastLoginAt, setLastLoginAt] = useState<Date | null>(null);
  const [students, setStudents] = useState<IntakeStudent[]>([]);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [counselorStudents, setCounselorStudents] = useState<CounselorStudent[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // Daily Task Board.
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  // Branch Communication Center.
  const [notices, setNotices] = useState<BranchNotice[]>([]);
  // Issue & Escalation Management.
  const [issues, setIssues] = useState<BranchIssue[]>([]);
  // Branch Operations Control.
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [dayLogs, setDayLogs] = useState<BranchDayLog[]>([]);
  // Leave requests (all statuses). Attendance reads the Approved ones from this same list, so
  // approving a request in Leave Management is immediately reflected there.
  const [leave, setLeave] = useState<LeaveRecord[]>([]);
  const handleAddLeave = (l: LeaveRecord) => {
    setLeave((prev) => [...prev, l]);
    insertLeave(l).catch((err) => console.error('Failed to insert leave record in Supabase', err));
  };
  // Holidays — Attendance and Leave read these (filtered to the user's branch) to decide what
  // counts as a working day, so saving one here updates both immediately.
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const handleSaveHoliday = (h: Holiday) => {
    setHolidays((prev) => (prev.some((x) => x.id === h.id) ? prev.map((x) => (x.id === h.id ? h : x)) : [...prev, h]));
    upsertHoliday(h).catch((err) => console.error('Failed to save holiday in Supabase', err));
  };
  const handleRemoveHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    deleteHoliday(id).catch((err) => console.error('Failed to delete holiday in Supabase', err));
  };
  // Performance reviews — written by the Branch Manager; the numbers beside them come from the CRM.
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  // Payroll inputs — fixed inputs per employee and one run per branch per month.
  const [payProfiles, setPayProfiles] = useState<PayProfile[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const handleSavePayProfile = (p: PayProfile) => {
    setPayProfiles((prev) => (prev.some((x) => x.staffName === p.staffName && x.branch === p.branch)
      ? prev.map((x) => (x.staffName === p.staffName && x.branch === p.branch ? p : x)) : [...prev, p]));
    upsertPayProfile(p).catch((err) => console.error('Failed to save pay profile in Supabase', err));
  };
  const handleSavePayrollRun = (r: PayrollRun) => {
    setPayrollRuns((prev) => (prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r]));
    upsertPayrollRun(r).catch((err) => console.error('Failed to save payroll run in Supabase', err));
  };
  // Financial Management — one ledger per branch that every finance view reads.
  const [finTransactions, setFinTransactions] = useState<FinTransaction[]>([]);
  // Marketing Department — leads, campaigns, content, social and SEO. `setMarketing` wraps the
  // raw setter so every change (named handlers below, or deep inside MarketingModule's own
  // subtree) is diffed and persisted to Supabase automatically — see persistMarketingDiff above.
  const [marketing, setMarketingState] = useState<MarketingStore>(EMPTY_MARKETING);
  const setMarketing: typeof setMarketingState = (update) => {
    setMarketingState((prev) => {
      const next = typeof update === 'function' ? (update as (p: MarketingStore) => MarketingStore)(prev) : update;
      persistMarketingDiff(prev, next);
      return next;
    });
  };
  const handleSaveFinTransaction = (t: FinTransaction) => {
    setFinTransactions((prev) => (prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [...prev, t]));
    upsertFinTransaction(t).catch((err) => console.error('Failed to save fin_transaction in Supabase', err));
  };
  // Lead Monitoring's read-only view into the branch pipeline for Marketing — `students`/
  // `counselorStudents`/`applications` above are always empty for a Marketing session (RLS
  // denies Marketing any select on those tables), so this comes from narrow RPCs instead
  // (2026-09-30-marketing-lead-tracking.sql) that return only the whitelisted columns
  // trackMarketingLeads needs. Each RPC returns no rows for a non-Marketing caller.
  const [marketingTrackedIntakes, setMarketingTrackedIntakes] = useState<TrackedIntake[]>([]);
  const [marketingTrackedConsultations, setMarketingTrackedConsultations] = useState<TrackedConsultation[]>([]);
  const [marketingTrackedApplications, setMarketingTrackedApplications] = useState<TrackedApplication[]>([]);
  // Same gap, same fix, for the revenue figure Lead Monitoring shows the Marketing Manager
  // (2026-09-30-marketing-lead-revenue.sql) — `fin_transactions` above is likewise always
  // empty for Marketing, since RLS denies it entirely.
  const [marketingTrackedRevenue, setMarketingTrackedRevenue] = useState<TrackedRevenueTransaction[]>([]);
  // Service Charges price list — set by the Super Admin (Finance → Service Charges), saved in
  // `service_prices`. Append-only: every change is a new version.
  const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
  // Shared with every Client Profile (Financials tab) through context.
  const financeLedgerValue = useMemo(() => ({
    transactions: finTransactions,
    addTransaction: (t: FinTransaction) => {
      setFinTransactions((prev) => [...prev, t]);
      upsertFinTransaction(t).catch((err) => console.error('Failed to insert fin_transaction in Supabase', err));
    },
    servicePrices,
    counselorOf: (clientId: string) => counselorStudents.find((c) => c.clientId === clientId)?.assignedCounselor
      ?? applications.find((a) => a.clientId === clientId)?.counselor,
  }), [finTransactions, servicePrices, counselorStudents, applications]);
  // Expense claims — decided in the Manager Approval Center.
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  // Branch Manager Workspace — branch requests to Head Office (content, marketing support, IT)
  // and inter-branch client transfers.
  const [workspace, setWorkspace] = useState<ManagerWorkspaceStore>(EMPTY_WORKSPACE);
  // Super Admin Command Center — its global filters (kept here so they survive moving between
  // sidebar tabs) and the append-only log of administrative overrides.
  const [adminFilters, setAdminFilters] = useState<GlobalFilters>(DEFAULT_FILTERS);
  const [auditLog, setAuditLog] = useState<AuditOverrideEntry[]>([]);
  const handleSaveExpense = (e: ExpenseRequest) => {
    setExpenses((prev) => prev.map((x) => (x.id === e.id ? e : x)));
    updateExpenseRequest(e.id, e).catch((err) => console.error('Failed to update expense_request in Supabase', err));
  };
  const handleSaveReview = (r: PerformanceReview) => {
    setReviews((prev) => (prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r]));
    upsertPerformanceReview(r).catch((err) => console.error('Failed to save performance review in Supabase', err));
  };
  const handleUpdateLeave = (id: string, updates: Partial<LeaveRecord>) => {
    setLeave((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    updateLeave(id, updates).catch((err) => console.error('Failed to update leave record in Supabase', err));
  };
  // Late / absence explanations — requested by the manager, submitted by staff.
  const [explanations, setExplanations] = useState<AttendanceExplanation[]>([]);
  const handleSaveExplanation = (e: AttendanceExplanation) => {
    setExplanations((prev) => (prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [...prev, e]));
    upsertAttendanceExplanation(e).catch((err) => console.error('Failed to save attendance explanation in Supabase', err));
  };
  // Employee Onboarding & Offboarding.
  const [onboarding, setOnboarding] = useState<OnboardingCase[]>([]);
  const [offboarding, setOffboarding] = useState<OffboardingCase[]>([]);
  const [communications, setCommunications] = useState<CommunicationEntry[]>([]);

  // Each table loads in full once on mount, then stays in sync via realtime — but instead of
  // refetching the whole table on every INSERT/UPDATE/DELETE (which used to mean one staff
  // member's status update made every other open tab re-download the entire table), each
  // change is applied to the local list in place via applyRealtimeChange. The `sortBy` passed
  // to each call re-applies the same ordering the initial fetch's `.order(...)` used, so lists
  // don't drift out of order as changes come in from other staff.
  useEffect(() => {
    fetchCounselorStudents()
      .then(setCounselorStudents)
      .catch((err) => console.error('Failed to fetch counselor_students from Supabase', err));
    return subscribeToTable<CounselorStudentRow>('counselor_students', (change) => {
      setCounselorStudents((prev) => applyRealtimeChange(prev, change, counselorStudentFromRow,
        (a, b) => (a.assignedDate < b.assignedDate ? -1 : a.assignedDate > b.assignedDate ? 1 : 0)));
    });
  }, [user]);

  useEffect(() => {
    fetchStudents()
      .then(setStudents)
      .catch((err) => console.error('Failed to fetch students from Supabase', err));
    return subscribeToTable<StudentRow>('students', (change) => {
      setStudents((prev) => applyRealtimeChange(prev, change, studentFromRow,
        (a, b) => (a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : 0)));
    });
  }, [user]);

  useEffect(() => {
    fetchCounselors()
      .then(setCounselors)
      .catch((err) => console.error('Failed to fetch counselors from Supabase', err));
    return subscribeToTable<CounselorRow>('counselors', (change) => {
      setCounselors((prev) => applyRealtimeChange(prev, change, counselorFromRow,
        (a, b) => a.name.localeCompare(b.name)));
    });
  }, [user]);

  useEffect(() => {
    fetchApplications()
      .then(setApplications)
      .catch((err) => console.error('Failed to fetch applications from Supabase', err));
    return subscribeToTable<ApplicationRow>('applications', (change) => {
      setApplications((prev) => applyRealtimeChange(prev, change, applicationFromRow,
        (a, b) => (a.consultationDate < b.consultationDate ? 1 : a.consultationDate > b.consultationDate ? -1 : 0)));
    });
  }, [user]);

  // No realtime here — these RPCs aren't table changefeeds, and Marketing couldn't receive
  // postgres_changes on students/counselor_students/applications anyway (Realtime honors the
  // same RLS that denies Marketing a direct select). Refetches on every login instead.
  useEffect(() => {
    if (user?.role !== 'marketing') return;
    fetchMarketingTrackedIntakes().then(setMarketingTrackedIntakes)
      .catch((err) => console.error('Failed to fetch marketing_tracked_intakes from Supabase', err));
    fetchMarketingTrackedConsultations().then(setMarketingTrackedConsultations)
      .catch((err) => console.error('Failed to fetch marketing_tracked_consultations from Supabase', err));
    fetchMarketingTrackedApplications().then(setMarketingTrackedApplications)
      .catch((err) => console.error('Failed to fetch marketing_tracked_applications from Supabase', err));
    // The RPC itself is gated to Marketing Manager (is_marketing_manager()) and returns no rows
    // for any other sub-role — this check just skips the pointless call for them.
    if ((user.marketingRole ?? 'Marketing Manager') === 'Marketing Manager') {
      fetchMarketingTrackedRevenue().then(setMarketingTrackedRevenue)
        .catch((err) => console.error('Failed to fetch marketing_tracked_revenue from Supabase', err));
    }
  }, [user]);

  useEffect(() => {
    fetchStaff()
      .then(setStaff)
      .catch((err) => console.error('Failed to fetch staff from Supabase', err));
    return subscribeToTable<StaffRow>('staff', (change) => {
      setStaff((prev) => applyRealtimeChange(prev, change, staffFromRow,
        (a, b) => a.name.localeCompare(b.name)));
    });
  }, [user]);

  useEffect(() => {
    fetchBranches()
      .then(setBranches)
      .catch((err) => console.error('Failed to fetch branches from Supabase', err));
    return subscribeToTable<BranchRow>('branches', (change) => {
      setBranches((prev) => applyRealtimeChange(prev, change, branchFromRow,
        (a, b) => a.name.localeCompare(b.name)));
    });
  }, [user]);

  useEffect(() => {
    fetchNotifications()
      .then(setNotifications)
      .catch((err) => console.error('Failed to fetch notifications from Supabase', err));
    return subscribeToTable<NotificationRow>('notifications', (change) => {
      setNotifications((prev) => applyRealtimeChange(prev, change, notificationFromRow,
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    });
  }, [user]);

  useEffect(() => {
    fetchCommissions()
      .then(setCommissions)
      .catch((err) => console.error('Failed to fetch commissions from Supabase', err));
    return subscribeToTable<CommissionRow>('commissions', (change) => {
      setCommissions((prev) => applyRealtimeChange(prev, change, commissionFromRow,
        (a, b) => a.studentName.localeCompare(b.studentName)));
    });
  }, [user]);

  useEffect(() => {
    fetchPartners()
      .then(setPartners)
      .catch((err) => console.error('Failed to fetch partners from Supabase', err));
    return subscribeToTable<PartnerRow>('partners', (change) => {
      setPartners((prev) => applyRealtimeChange(prev, change, partnerFromRow,
        (a, b) => a.name.localeCompare(b.name)));
    });
  }, [user]);

  useEffect(() => {
    fetchServicePrices()
      .then(setServicePrices)
      .catch((err) => console.error('Failed to fetch service prices from Supabase', err));
    return subscribeToTable<ServicePriceRow>('service_prices', (change) => {
      setServicePrices((prev) => applyRealtimeChange(prev, change, servicePriceFromRow, (a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)));
    });
  }, [user]);

  /** Super Admin sets or changes a service charge — always a new version, never an edit. */
  const handleAddServicePrice = (price: ServicePrice) => {
    if (!user || user.role !== 'super_admin' || !price.name.trim() || price.fee < 0 || !price.effectiveFrom) return;
    setServicePrices((prev) => [price, ...prev]);
    insertServicePrice(price).catch((err) => console.error('Failed to save service price in Supabase', err));
  };

  /** Tags a notification with the signed-in staff member who caused it. */
  const withActor = (n: AppNotification): AppNotification => ({ ...n, actorName: n.actorName ?? user?.name });

  useEffect(() => {
    fetchCommunications()
      .then(setCommunications)
      .catch((err) => console.error('Failed to fetch communication_logs from Supabase', err));
    return subscribeToTable<CommunicationRow>('communication_logs', (change) => {
      setCommunications((prev) => applyRealtimeChange(prev, change, communicationFromRow,
        (a, b) => b.occurredAt.localeCompare(a.occurredAt)));
    });
  }, [user]);

  useEffect(() => {
    fetchTasks()
      .then(setTasks)
      .catch((err) => console.error('Failed to fetch tasks from Supabase', err));
    return subscribeToTable<TaskRow>('tasks', (change) => {
      setTasks((prev) => applyRealtimeChange(prev, change, taskFromRow,
        (a, b) => a.date.localeCompare(b.date)));
    });
  }, [user]);

  useEffect(() => {
    fetchBranchNotices()
      .then(setNotices)
      .catch((err) => console.error('Failed to fetch branch_notices from Supabase', err));
    return subscribeToTable<BranchNoticeRow>('branch_notices', (change) => {
      setNotices((prev) => applyRealtimeChange(prev, change, branchNoticeFromRow,
        (a, b) => b.postedAt.localeCompare(a.postedAt)));
    });
  }, [user]);

  useEffect(() => {
    fetchBranchIssues()
      .then(setIssues)
      .catch((err) => console.error('Failed to fetch branch_issues from Supabase', err));
    return subscribeToTable<BranchIssueRow>('branch_issues', (change) => {
      setIssues((prev) => applyRealtimeChange(prev, change, branchIssueFromRow,
        (a, b) => b.reportedAt.localeCompare(a.reportedAt)));
    });
  }, [user]);

  useEffect(() => {
    fetchAttendance()
      .then(setAttendance)
      .catch((err) => console.error('Failed to fetch attendance from Supabase', err));
    return subscribeToTable<AttendanceRow>('attendance', (change) => {
      setAttendance((prev) => applyRealtimeChange(prev, change, attendanceFromRow,
        (a, b) => b.date.localeCompare(a.date)));
    });
  }, [user]);

  useEffect(() => {
    fetchAttendanceCorrections()
      .then(setCorrections)
      .catch((err) => console.error('Failed to fetch attendance_corrections from Supabase', err));
    return subscribeToTable<AttendanceCorrectionRow>('attendance_corrections', (change) => {
      setCorrections((prev) => applyRealtimeChange(prev, change, attendanceCorrectionFromRow,
        (a, b) => b.requestedAt.localeCompare(a.requestedAt)));
    });
  }, [user]);

  useEffect(() => {
    fetchAttendanceExplanations()
      .then(setExplanations)
      .catch((err) => console.error('Failed to fetch attendance_explanations from Supabase', err));
    return subscribeToTable<AttendanceExplanationRow>('attendance_explanations', (change) => {
      setExplanations((prev) => applyRealtimeChange(prev, change, attendanceExplanationFromRow,
        (a, b) => b.date.localeCompare(a.date)));
    });
  }, [user]);

  useEffect(() => {
    fetchBranchDayLogs()
      .then(setDayLogs)
      .catch((err) => console.error('Failed to fetch branch_day_logs from Supabase', err));
    return subscribeToTable<BranchDayLogRow>('branch_day_logs', (change) => {
      setDayLogs((prev) => applyRealtimeChange(prev, change, branchDayLogFromRow,
        (a, b) => b.date.localeCompare(a.date)));
    });
  }, [user]);

  useEffect(() => {
    fetchLeave()
      .then(setLeave)
      .catch((err) => console.error('Failed to fetch leave_records from Supabase', err));
    return subscribeToTable<LeaveRecordRow>('leave_records', (change) => {
      setLeave((prev) => applyRealtimeChange(prev, change, leaveFromRow,
        (a, b) => b.from.localeCompare(a.from)));
    });
  }, [user]);

  useEffect(() => {
    fetchHolidays()
      .then(setHolidays)
      .catch((err) => console.error('Failed to fetch holidays from Supabase', err));
    return subscribeToTable<HolidayRow>('holidays', (change) => {
      setHolidays((prev) => applyRealtimeChange(prev, change, holidayFromRow,
        (a, b) => b.from.localeCompare(a.from)));
    });
  }, [user]);

  useEffect(() => {
    fetchPerformanceReviews()
      .then(setReviews)
      .catch((err) => console.error('Failed to fetch performance_reviews from Supabase', err));
    return subscribeToTable<PerformanceReviewRow>('performance_reviews', (change) => {
      setReviews((prev) => applyRealtimeChange(prev, change, performanceReviewFromRow,
        (a, b) => b.reviewedAt.localeCompare(a.reviewedAt)));
    });
  }, [user]);

  // PayProfile has no `id` (it's keyed by staffName+branch), so this merges by that pair
  // instead of using applyRealtimeChange (which requires an `id`).
  useEffect(() => {
    fetchPayProfiles()
      .then(setPayProfiles)
      .catch((err) => console.error('Failed to fetch pay_profiles from Supabase', err));
    return subscribeToTable<PayProfileRow>('pay_profiles', (change) => {
      setPayProfiles((prev) => {
        if (change.eventType === 'DELETE') {
          const old = change.old as Partial<PayProfileRow> | null;
          if (!old?.staff_name || !old.branch) return prev;
          return prev.filter((p) => !(p.staffName === old.staff_name && p.branch === old.branch));
        }
        if (!change.new) return prev;
        const record = payProfileFromRow(change.new);
        const exists = prev.some((p) => p.staffName === record.staffName && p.branch === record.branch);
        return exists
          ? prev.map((p) => (p.staffName === record.staffName && p.branch === record.branch ? record : p))
          : [...prev, record];
      });
    });
  }, [user]);

  useEffect(() => {
    fetchPayrollRuns()
      .then(setPayrollRuns)
      .catch((err) => console.error('Failed to fetch payroll_runs from Supabase', err));
    return subscribeToTable<PayrollRunRow>('payroll_runs', (change) => {
      setPayrollRuns((prev) => applyRealtimeChange(prev, change, payrollRunFromRow,
        (a, b) => b.month.localeCompare(a.month)));
    });
  }, [user]);

  useEffect(() => {
    fetchOnboardingCases()
      .then(setOnboarding)
      .catch((err) => console.error('Failed to fetch onboarding_cases from Supabase', err));
    return subscribeToTable<OnboardingCaseRow>('onboarding_cases', (change) => {
      setOnboarding((prev) => applyRealtimeChange(prev, change, onboardingCaseFromRow,
        (a, b) => b.createdAt.localeCompare(a.createdAt)));
    });
  }, [user]);

  useEffect(() => {
    fetchOffboardingCases()
      .then(setOffboarding)
      .catch((err) => console.error('Failed to fetch offboarding_cases from Supabase', err));
    return subscribeToTable<OffboardingCaseRow>('offboarding_cases', (change) => {
      setOffboarding((prev) => applyRealtimeChange(prev, change, offboardingCaseFromRow,
        (a, b) => b.createdAt.localeCompare(a.createdAt)));
    });
  }, [user]);

  useEffect(() => {
    fetchAuditLog()
      .then(setAuditLog)
      .catch((err) => console.error('Failed to fetch audit_log from Supabase', err));
    return subscribeToTable<AuditLogRow>('audit_log', (change) => {
      setAuditLog((prev) => applyRealtimeChange(prev, change, auditLogFromRow,
        (a, b) => b.at.localeCompare(a.at)));
    });
  }, [user]);

  useEffect(() => {
    fetchFinTransactions()
      .then(setFinTransactions)
      .catch((err) => console.error('Failed to fetch fin_transactions from Supabase', err));
    return subscribeToTable<FinTransactionRow>('fin_transactions', (change) => {
      setFinTransactions((prev) => applyRealtimeChange(prev, change, finTransactionFromRow,
        (a, b) => b.at.localeCompare(a.at)));
    });
  }, [user]);

  useEffect(() => {
    fetchExpenseRequests()
      .then(setExpenses)
      .catch((err) => console.error('Failed to fetch expense_requests from Supabase', err));
    return subscribeToTable<ExpenseRequestRow>('expense_requests', (change) => {
      setExpenses((prev) => applyRealtimeChange(prev, change, expenseRequestFromRow,
        (a, b) => b.requestedAt.localeCompare(a.requestedAt)));
    });
  }, [user]);

  // Marketing — 11 tables, one per MarketingStore array. Loaded with the RAW setter
  // (setMarketingState), not the diffing `setMarketing` wrapper above: this is data coming
  // FROM the database, not a local edit that needs to be pushed back to it.
  useEffect(() => {
    fetchMarketingLeads()
      .then((rows) => setMarketingState((prev) => ({ ...prev, leads: rows })))
      .catch((err) => console.error('Failed to fetch marketing_leads from Supabase', err));
    return subscribeToTable<MarketingLeadRow>('marketing_leads', (change) => {
      setMarketingState((prev) => ({ ...prev, leads: applyRealtimeChange(prev.leads, change, marketingLeadFromRow,
        (a, b) => b.receivedAt.localeCompare(a.receivedAt)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchMarketingCampaigns()
      .then((rows) => setMarketingState((prev) => ({ ...prev, campaigns: rows })))
      .catch((err) => console.error('Failed to fetch marketing_campaigns from Supabase', err));
    return subscribeToTable<MarketingCampaignRow>('marketing_campaigns', (change) => {
      setMarketingState((prev) => ({ ...prev, campaigns: applyRealtimeChange(prev.campaigns, change, marketingCampaignFromRow,
        (a, b) => b.startDate.localeCompare(a.startDate)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchMarketingAdSpend()
      .then((rows) => setMarketingState((prev) => ({ ...prev, adSpend: rows })))
      .catch((err) => console.error('Failed to fetch marketing_ad_spend from Supabase', err));
    return subscribeToTable<MarketingAdSpendRow>('marketing_ad_spend', (change) => {
      setMarketingState((prev) => ({ ...prev, adSpend: applyRealtimeChange(prev.adSpend, change, marketingAdSpendFromRow,
        (a, b) => b.date.localeCompare(a.date)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchMarketingContentRequests()
      .then((rows) => setMarketingState((prev) => ({ ...prev, contentRequests: rows })))
      .catch((err) => console.error('Failed to fetch marketing_content_requests from Supabase', err));
    return subscribeToTable<MarketingContentRequestRow>('marketing_content_requests', (change) => {
      setMarketingState((prev) => ({ ...prev, contentRequests: applyRealtimeChange(prev.contentRequests, change, marketingContentRequestFromRow,
        (a, b) => b.requestedAt.localeCompare(a.requestedAt)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchMarketingContentItems()
      .then((rows) => setMarketingState((prev) => ({ ...prev, contentItems: rows })))
      .catch((err) => console.error('Failed to fetch marketing_content_items from Supabase', err));
    return subscribeToTable<MarketingContentItemRow>('marketing_content_items', (change) => {
      setMarketingState((prev) => ({ ...prev, contentItems: applyRealtimeChange(prev.contentItems, change, marketingContentItemFromRow,
        (a, b) => b.deadline.localeCompare(a.deadline)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchMarketingDesignTasks()
      .then((rows) => setMarketingState((prev) => ({ ...prev, designTasks: rows })))
      .catch((err) => console.error('Failed to fetch marketing_design_tasks from Supabase', err));
    return subscribeToTable<MarketingDesignTaskRow>('marketing_design_tasks', (change) => {
      setMarketingState((prev) => ({ ...prev, designTasks: applyRealtimeChange(prev.designTasks, change, marketingDesignTaskFromRow,
        (a, b) => b.deadline.localeCompare(a.deadline)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchMarketingVideoTasks()
      .then((rows) => setMarketingState((prev) => ({ ...prev, videoTasks: rows })))
      .catch((err) => console.error('Failed to fetch marketing_video_tasks from Supabase', err));
    return subscribeToTable<MarketingVideoTaskRow>('marketing_video_tasks', (change) => {
      setMarketingState((prev) => ({ ...prev, videoTasks: applyRealtimeChange(prev.videoTasks, change, marketingVideoTaskFromRow,
        (a, b) => b.deadline.localeCompare(a.deadline)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchMarketingPosts()
      .then((rows) => setMarketingState((prev) => ({ ...prev, posts: rows })))
      .catch((err) => console.error('Failed to fetch marketing_posts from Supabase', err));
    return subscribeToTable<MarketingPostRow>('marketing_posts', (change) => {
      setMarketingState((prev) => ({ ...prev, posts: applyRealtimeChange(prev.posts, change, marketingPostFromRow,
        (a, b) => b.scheduledAt.localeCompare(a.scheduledAt)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchMarketingSeoTasks()
      .then((rows) => setMarketingState((prev) => ({ ...prev, seoTasks: rows })))
      .catch((err) => console.error('Failed to fetch marketing_seo_tasks from Supabase', err));
    return subscribeToTable<MarketingSeoTaskRow>('marketing_seo_tasks', (change) => {
      setMarketingState((prev) => ({ ...prev, seoTasks: applyRealtimeChange(prev.seoTasks, change, marketingSeoTaskFromRow,
        (a, b) => a.due.localeCompare(b.due)) }));
    });
  }, [user]);

  // No `id` column on marketing_seo_keywords (keyed by `keyword`), so this can't use the
  // shared applyRealtimeChange helper (requires `{ id: string }`) — merged by hand instead.
  useEffect(() => {
    fetchMarketingSeoKeywords()
      .then((rows) => setMarketingState((prev) => ({ ...prev, keywords: rows })))
      .catch((err) => console.error('Failed to fetch marketing_seo_keywords from Supabase', err));
    return subscribeToTable<{ keyword: string }>('marketing_seo_keywords', (change) => {
      setMarketingState((prev) => {
        if (change.eventType === 'DELETE') {
          const key = change.old?.keyword;
          return key ? { ...prev, keywords: prev.keywords.filter((k) => k.keyword !== key) } : prev;
        }
        if (!change.new) return prev;
        const record = marketingSeoKeywordFromRow(change.new as Parameters<typeof marketingSeoKeywordFromRow>[0]);
        const exists = prev.keywords.some((k) => k.keyword === record.keyword);
        return { ...prev, keywords: exists ? prev.keywords.map((k) => (k.keyword === record.keyword ? record : k)) : [...prev.keywords, record] };
      });
    });
  }, [user]);

  useEffect(() => {
    fetchMarketingPings()
      .then((rows) => setMarketingState((prev) => ({ ...prev, pings: rows })))
      .catch((err) => console.error('Failed to fetch marketing_pings from Supabase', err));
    return subscribeToTable<MarketingPingRow>('marketing_pings', (change) => {
      setMarketingState((prev) => ({ ...prev, pings: applyRealtimeChange(prev.pings, change, marketingPingFromRow,
        (a, b) => b.at.localeCompare(a.at)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchBranchContentRequests()
      .then((rows) => setWorkspace((prev) => ({ ...prev, contentRequests: rows })))
      .catch((err) => console.error('Failed to fetch branch_content_requests from Supabase', err));
    return subscribeToTable<BranchContentRequestRow>('branch_content_requests', (change) => {
      setWorkspace((prev) => ({ ...prev, contentRequests: applyRealtimeChange(prev.contentRequests, change, branchContentRequestFromRow,
        (a, b) => b.requestedAt.localeCompare(a.requestedAt)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchMarketingSupportRequests()
      .then((rows) => setWorkspace((prev) => ({ ...prev, supportRequests: rows })))
      .catch((err) => console.error('Failed to fetch marketing_support_requests from Supabase', err));
    return subscribeToTable<MarketingSupportRequestRow>('marketing_support_requests', (change) => {
      setWorkspace((prev) => ({ ...prev, supportRequests: applyRealtimeChange(prev.supportRequests, change, marketingSupportRequestFromRow,
        (a, b) => b.requestedAt.localeCompare(a.requestedAt)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchItTickets()
      .then((rows) => setWorkspace((prev) => ({ ...prev, itTickets: rows })))
      .catch((err) => console.error('Failed to fetch it_tickets from Supabase', err));
    return subscribeToTable<ItTicketRow>('it_tickets', (change) => {
      setWorkspace((prev) => ({ ...prev, itTickets: applyRealtimeChange(prev.itTickets, change, itTicketFromRow,
        (a, b) => b.raisedAt.localeCompare(a.raisedAt)) }));
    });
  }, [user]);

  useEffect(() => {
    fetchBranchTransfers()
      .then((rows) => setWorkspace((prev) => ({ ...prev, transfers: rows })))
      .catch((err) => console.error('Failed to fetch branch_transfers from Supabase', err));
    return subscribeToTable<BranchTransferRow>('branch_transfers', (change) => {
      setWorkspace((prev) => ({ ...prev, transfers: applyRealtimeChange(prev.transfers, change, branchTransferFromRow,
        (a, b) => b.requestedAt.localeCompare(a.requestedAt)) }));
    });
  }, [user]);

  const communicationsValue = useMemo(() => ({
    entries: communications,
    addEntry: (entry: CommunicationEntry) => {
      setCommunications((prev) => [entry, ...prev]);
      insertCommunication(entry).catch((err) => console.error('Failed to insert communication in Supabase', err));
    },
  }), [communications]);

  const handleLogin = (mockUser: MockUser) => {
    setUser(mockUser);
    // Branch Managers land on their Overall Dashboard; everyone else on their own dashboard.
    setActiveKey(mockUser.role === 'branch_manager' ? 'bm-dashboard' : 'overview');
    // Remember the previous sign-in so dashboards can flag what's new since then.
    const storageKey = `csc:lastLogin:${mockUser.email}`;
    try {
      const previous = window.localStorage.getItem(storageKey);
      setLastLoginAt(previous ? new Date(previous) : null);
      window.localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      setLastLoginAt(null);
    }
  };

  // Session rehydration on refresh: the Supabase session lives in this tab's sessionStorage
  // (src/lib/supabaseClient.ts). Role/branch are re-read from the staff table, never trusted
  // from the browser, and an inactive or unlinked account is signed out.
  useEffect(() => {
    if (!supabase) { setRestoringSession(false); return; }
    const client = supabase;
    client.auth.getSession().then(async ({ data }) => {
      const authUserId = data.session?.user.id;
      if (authUserId) {
        const result = await resolveStaffUser(authUserId);
        if ('user' in result) {
          setUser(result.user);
          setActiveKey(result.user.role === 'branch_manager' ? 'bm-dashboard' : 'overview');
        } else {
          await client.auth.signOut();
        }
      }
      setRestoringSession(false);
    });
  }, []);

  // External sign-out (token expiry, another tab) clears the local session too.
  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setActiveKey('overview');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // A deactivated (or removed) employee loses access immediately, including an open session —
  // the staff table is realtime, so this fires as soon as Staff Management saves the change.
  useEffect(() => {
    if (!user || staff.length === 0) return;
    const me = staff.find((s) => s.email.trim().toLowerCase() === user.email.trim().toLowerCase());
    if (!me || me.status !== 'Active') {
      setUser(null);
      setActiveKey('overview');
    }
  }, [staff, user]);

  const handleLogout = () => {
    setUser(null);
    setActiveKey('overview');
    supabase?.auth.signOut().catch((err) => console.error('Failed to sign out of Supabase', err));
  };

  const handleNavigate = (key: string, intent?: NavIntent) => {
    setActiveKey(key);
    setNavIntent(intent ?? null);
    setNavSeq((seq) => seq + 1);
  };

  /** The database may issue a different Client ID than the optimistic local one — show the saved one. */
  const syncIssuedClientId = (saved: CounselorStudent) =>
    setCounselorStudents((prev) => prev.map((cs) => (cs.id === saved.id ? { ...cs, clientId: saved.clientId } : cs)));

  const handleAddStudent = (data: IntakeFormData) => {
    // A counselor adding their own client (Counselor's "Add Client") is already that
    // client's counselor — self-assign immediately instead of dropping them into the
    // unassigned pool, where a Receptionist/Branch Manager could hand them to someone else.
    const isCounselorAdding = user?.role === 'counselor';
    const stamp = formatSubmittedAt(new Date());
    const newStudent: IntakeStudent = {
      id: `s${Date.now()}`,
      ...data,
      submittedAt: stamp,
      addedBy: user?.name ?? 'Online Intake',
      visitDateTime: stamp,
      status: isCounselorAdding ? 'Assigned' : 'New',
      assignedCounselor: isCounselorAdding ? user!.name : null,
      branch: user?.branch ?? '',
    };
    setStudents((prev) => [newStudent, ...prev]);
    insertStudent(newStudent).catch((err) => {
      console.error('Failed to insert student in Supabase', err);
      setSaveError(`Couldn't save ${newStudent.name} — it will disappear on refresh. Try again or check your connection.`);
    });

    if (isCounselorAdding && user) {
      const newCounselorStudent: CounselorStudent = {
        id: newStudent.id,
        clientId: generateClientId([...counselorStudents.map((c) => c.clientId), ...applications.map((a) => a.clientId)]),
        name: newStudent.name,
        phone: newStudent.phone,
        email: newStudent.email,
        address: newStudent.address,
        country: newStudent.country,
        purpose: newStudent.purpose,
        dob: newStudent.dob,
        gender: newStudent.gender,
        maritalStatus: newStudent.maritalStatus,
        academics: newStudent.academics,
        ieltsPte: newStudent.ieltsPte,
        workExperience: newStudent.workExperience,
        submittedAt: newStudent.submittedAt,
        addedBy: newStudent.addedBy,
        visitDateTime: newStudent.visitDateTime,
        assignedDate: new Date().toISOString().slice(0, 10),
        assignedCounselor: user.name,
        consultationStatus: 'Awaiting Consultation',
        consultationNotes: '',
        followUpDate: null,
        completedDate: null,
        outcome: 'Pending',
      };
      setCounselorStudents((prev) => [newCounselorStudent, ...prev]);
      insertNewCounselorStudent(newCounselorStudent).then(syncIssuedClientId).catch((err) => {
        console.error('Failed to upsert counselor_students in Supabase', err);
        setSaveError(`${newCounselorStudent.name} didn't save to your client list — it will disappear on refresh. Try again or check your connection.`);
      });
      return;
    }

    const notification = withActor(createIntakeNotification(newStudent.name, newStudent.country, newStudent.purpose, newStudent.branch));
    const managerNotification = withActor(createBranchManagerNotification(
      'new-intake', newStudent.name, 'New lead from ', ` — ${newStudent.country}, ${newStudent.purpose}`, newStudent.branch, 'students'
    ));
    setNotifications((prev) => [managerNotification, notification, ...prev]);
    insertNotification(notification).catch((err) => console.error('Failed to insert notification in Supabase', err));
    insertNotification(managerNotification).catch((err) => console.error('Failed to insert notification in Supabase', err));
  };

  /** Marketing "Assign to Branch": the qualified lead becomes a New lead in that branch's CRM
   * queue (front desk / branch manager lists) and is offered to the branch's counselors to claim.
   * Returns the new intake id so Marketing can follow the lead read-only from then on. */
  const handleMarketingPush = (lead: MarketingLead, branch: string): string => {
    const stamp = formatSubmittedAt(new Date());
    const intake: IntakeStudent = {
      id: `ml${Date.now()}`,
      name: lead.name,
      phone: lead.phone,
      email: lead.email ?? '',
      // Leads logged through Add Lead carry the full Front Desk profile; inbox leads fill what they have.
      address: lead.address ?? '',
      country: lead.preferredCountry ?? '',
      purpose: lead.purpose ?? 'Study',
      dob: lead.dob ?? '',
      gender: lead.gender ?? '',
      maritalStatus: lead.maritalStatus ?? '',
      academics: lead.academics ?? [],
      ieltsPte: lead.englishTest ?? '',
      workExperience: lead.workExperience ?? (lead.interestedProgram ? `Interested in: ${lead.interestedProgram}` : ''),
      submittedAt: stamp,
      addedBy: user?.name ?? 'Marketing',
      visitDateTime: stamp,
      referredThrough: 'Marketing',
      // Branch screens spell it "Tiktok" (PLATFORM_SOURCES).
      platformSource: lead.source === 'TikTok' ? 'Tiktok' : lead.source,
      broadcastBranch: branch,
      broadcastAt: stamp,
      claimedBy: null,
      status: 'New',
      assignedCounselor: null,
      branch,
    };
    setStudents((prev) => [intake, ...prev]);
    insertStudent(intake).catch((err) => console.error('Failed to insert student in Supabase', err));
    const counselorPing = withActor(createLeadBroadcastNotification(intake.id, intake.country || 'Any country', lead.interestedProgram || intake.purpose, branch));
    const managerPing = withActor(createBranchManagerNotification(
      'new-intake', intake.name, 'Marketing assigned a new lead: ', ` — ${lead.interestedProgram ?? intake.purpose}, ${intake.country} (${lead.source})`, branch, 'students'
    ));
    setNotifications((prev) => [managerPing, counselorPing, ...prev]);
    insertNotification(counselorPing).catch((err) => console.error('Failed to insert notification in Supabase', err));
    insertNotification(managerPing).catch((err) => console.error('Failed to insert notification in Supabase', err));
    return intake.id;
  };

  /** Marketing "Assign to City Pool": the qualified lead becomes a New lead visible to every
   * branch in `city` (branches.location) instead of one branch — `branch` stays '' until a
   * counselor claims it (see handleAcceptLead). Returns the new intake id. */
  const handleMarketingPushToCityPool = (lead: MarketingLead, city: string): string => {
    const stamp = formatSubmittedAt(new Date());
    const intake: IntakeStudent = {
      id: `ml${Date.now()}`,
      name: lead.name,
      phone: lead.phone,
      email: lead.email ?? '',
      address: lead.address ?? '',
      country: lead.preferredCountry ?? '',
      purpose: lead.purpose ?? 'Study',
      dob: lead.dob ?? '',
      gender: lead.gender ?? '',
      maritalStatus: lead.maritalStatus ?? '',
      academics: lead.academics ?? [],
      ieltsPte: lead.englishTest ?? '',
      workExperience: lead.workExperience ?? (lead.interestedProgram ? `Interested in: ${lead.interestedProgram}` : ''),
      submittedAt: stamp,
      addedBy: user?.name ?? 'Marketing',
      visitDateTime: stamp,
      referredThrough: 'Marketing',
      platformSource: lead.source === 'TikTok' ? 'Tiktok' : lead.source,
      broadcastCity: city,
      broadcastAt: stamp,
      claimedBy: null,
      status: 'New',
      assignedCounselor: null,
      branch: '',
    };
    setStudents((prev) => [intake, ...prev]);
    insertStudent(intake).catch((err) => console.error('Failed to insert student in Supabase', err));
    const cityBranches = branches.filter((b) => b.location === city).map((b) => b.name);
    const pings = cityBranches.flatMap((branch) => [
      withActor(createCityLeadBroadcastNotification(intake.id, city, intake.country || 'Any country', lead.interestedProgram || intake.purpose, branch)),
      withActor(createBranchManagerNotification(
        'city-lead-broadcast', intake.name, `Marketing added a lead to the ${city} City Pool: `,
        ` — ${lead.interestedProgram ?? intake.purpose}, ${intake.country} (${lead.source})`, branch, 'co-city-pool'
      )),
    ]);
    setNotifications((prev) => [...pings, ...prev]);
    pings.forEach((n) => insertNotification(n).catch((err) => console.error('Failed to insert notification in Supabase', err)));
    return intake.id;
  };

  /** Content requests go to counselors and Front Desk Officers — notify them in their own role,
   * pointing at their own Marketing inbox. */
  const contributorRole = (name: string) => {
    const role = staff.find((s) => s.name === name)?.role;
    return role === 'Front Desk Officer' ? STAFF_ROLE_TO_ROLE[role] : 'counselor';
  };
  const marketingInboxKey = (name: string) => (contributorRole(name) === 'receptionist' ? 'fd-marketing' : 'co-marketing');

  /** Counselor or Front Desk submits requested content from their Marketing tab → it's Received for the planner. */
  const handleBranchContentSubmit = (id: string, files: DeliveredFile[], note: string) => {
    const req = marketing.contentRequests.find((r) => r.id === id);
    // Only the person it was asked of, and only while it's still waiting.
    if (!req || !user || (user.role !== 'counselor' && user.role !== 'receptionist')
      || req.targetCounselor !== user.name || req.status !== 'Waiting' || files.length === 0) return;
    const stamp = formatSubmittedAt(new Date());
    const link = files.find((f) => f.url && /^https?:/.test(f.url))?.url;
    setMarketing((m) => ({
      ...m,
      contentRequests: m.contentRequests.map((r) => (r.id !== id ? r : {
        ...r, status: 'Received', receivedAt: stamp, submittedFiles: files, submittedBy: user.name,
        receivedNote: note || undefined, materialLink: link ?? r.materialLink,
      })),
    }));
    const ping: AppNotification = {
      ...withActor(createBranchManagerNotification('status-update', req.topic, `${user.name} (${user.branch}) submitted `, ` — ${files.length} file${files.length === 1 ? '' : 's'}. Ready to send to the designer.`, '', 'cp-requests')),
      role: 'marketing', branch: undefined, recipientName: req.requestedBy,
    };
    setNotifications((prev) => [ping, ...prev]);
    insertNotification(ping).catch((err) => console.error('Failed to insert notification in Supabase', err));
  };

  const pushNotification = (n: AppNotification) => {
    setNotifications((prev) => [n, ...prev]);
    insertNotification(n).catch((err) => console.error('Failed to insert notification in Supabase', err));
  };

  /** Move a client to another counselor — and, for an approved inter-branch transfer, another
   * branch — across the intake, counselor and application records.
   * AUDIT: the same entry is appended to the counselor record and (when one exists) the
   * application, so either profile shows it. Entries are never edited or removed. */
  const reassignClient = (client: CounselorStudent, to: string, entry: ClientAuditEntry, toBranch?: string) => {
    const branchMove = toBranch ? { branch: toBranch } : {};
    handleUpdateCounselorStudent(client.id, { assignedCounselor: to, auditLog: [...(client.auditLog ?? []), entry] });
    setStudents((prev) => prev.map((s) => (s.id === client.id ? { ...s, assignedCounselor: to, ...branchMove } : s)));
    updateStudent(client.id, { assignedCounselor: to, ...branchMove }).catch((err) => console.error('Failed to update student in Supabase', err));
    const app = client.clientId ? applications.find((a) => a.clientId === client.clientId) : undefined;
    if (app) handleUpdateApplication(app.id, { counselor: to, ...branchMove, auditLog: [...(app.auditLog ?? []), entry] });
  };

  /** Counselor → counselor case handover (Client Profile → "Handover Client"). */
  const handleHandoverClient = (clientId: string, to: string, reason: string) => {
    const client = counselorStudents.find((c) => c.id === clientId);
    const target = staff.find((s) => s.name === to && s.role === 'Counselor' && s.status === 'Active');
    // Only the client's own counselor can hand them over, to an active counselor in the same branch.
    if (!client || !user || client.assignedCounselor !== user.name || !target || target.branch !== user.branch || to === user.name || !reason.trim()) return;
    const at = formatSubmittedAt(new Date());
    const entry: ClientAuditEntry = {
      id: `audit-${Date.now()}`, at, by: user.name, action: 'Handover', from: user.name, to, reason: reason.trim(),
      text: `Transferred from ${user.name} to ${to}. Reason: ${reason.trim()}`,
    };
    reassignClient(client, to, entry);
    pushNotification({
      ...withActor(createBranchManagerNotification('assigned-to-counselor', client.name, '', ` was handed over to you by ${user.name} — ${reason.trim()}`, user.branch, 'my-students')),
      role: 'counselor', branch: undefined, recipientName: to,
    });
    pushNotification(withActor(createBranchManagerNotification('assigned-to-counselor', client.name, '', ` handed over from ${user.name} to ${to} — ${reason.trim()}`, user.branch, 'students')));
  };

  /** Designer submitted work → tell the Marketing Manager it's ready to review. */
  const notifyReviewReady = (title: string, kind: 'design' | 'video') => {
    const manager = staff.find((s) => s.role === 'Marketing' && s.status === 'Active' && (s.marketingRole ?? 'Marketing Manager') === 'Marketing Manager');
    if (!manager) return;
    const ping: AppNotification = {
      ...withActor(createBranchManagerNotification('status-update', title, `${user?.name ?? 'The designer'} submitted `, ` (${kind}) for review.`, '', 'mkt-production')),
      role: 'marketing', branch: undefined, recipientName: manager.name,
    };
    setNotifications((prev) => [ping, ...prev]);
    insertNotification(ping).catch((err) => console.error('Failed to insert notification in Supabase', err));
  };

  // The designer can only move their own work forward (start → submit) and deliver files. Approving
  // and scheduling belong to reviewers, so those stages are rejected here even if the UI were bypassed.
  const designerActions: DesignerActions = {
    updateDesign: (id, patch) => {
      const task = marketing.designTasks.find((t) => t.id === id);
      if (!task || task.stage === 'Approved' || task.stage === 'Scheduled') return;
      if (patch.stage === 'Ready for Review' && !(patch.finalFiles ?? task.finalFiles)?.length) return;
      setMarketing((m) => ({
        ...m,
        designTasks: m.designTasks.map((t) => (t.id !== id ? t : {
          ...t,
          ...(patch.stage ? { stage: patch.stage } : {}),
          ...(patch.finalFiles && t.stage !== 'Ready for Review' ? { finalFiles: patch.finalFiles } : {}),
          assignee: t.assignee ?? user?.name,
        })),
      }));
      if (patch.stage === 'Ready for Review') notifyReviewReady(task.title, 'design');
    },
    updateVideo: (id, patch) => {
      const task = marketing.videoTasks.find((t) => t.id === id);
      if (!task || task.status === 'Completed') return;
      if (patch.status === 'Ready for Review' && !(patch.finalFiles ?? task.finalFiles)?.length) return;
      setMarketing((m) => ({
        ...m,
        videoTasks: m.videoTasks.map((t) => (t.id !== id ? t : {
          ...t,
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.finalFiles && t.status !== 'Ready for Review' ? { finalFiles: patch.finalFiles } : {}),
          assignee: t.assignee ?? user?.name,
        })),
      }));
      if (patch.status === 'Ready for Review') notifyReviewReady(task.title, 'video');
    },
  };

  /** Marketing Manager sent a design/video task to a team member → tell them to start work. */
  const handleTaskAssigned = (kind: 'design' | 'video', title: string, assignee: string, deadline: string) => {
    if (!staff.some((s) => s.name === assignee && s.status === 'Active')) return;
    const ping: AppNotification = {
      ...withActor(createBranchManagerNotification('status-update', title, `${user?.name ?? 'Marketing'} assigned you a ${kind} task — `, `, due ${deadline}.`, '', 'mkt-production')),
      role: 'marketing', branch: undefined, recipientName: assignee,
    };
    setNotifications((prev) => [ping, ...prev]);
    insertNotification(ping).catch((err) => console.error('Failed to insert notification in Supabase', err));
  };

  /** A design/video task was approved/marked complete → tell the assignee it's done. */
  const handleTaskDone = (kind: 'design' | 'video', title: string, assignee: string) => {
    if (!staff.some((s) => s.name === assignee && s.status === 'Active')) return;
    const ping: AppNotification = {
      ...withActor(createBranchManagerNotification('status-update', title, '', ` — your ${kind} was approved${user ? ` by ${user.name}` : ''}. Nice work!`, '', 'mkt-production')),
      role: 'marketing', branch: undefined, recipientName: assignee,
    };
    setNotifications((prev) => [ping, ...prev]);
    insertNotification(ping).catch((err) => console.error('Failed to insert notification in Supabase', err));
  };

  /** Leads Specialist "Flag / Ping Branch" → alert that branch's Branch Manager. */
  const handleMarketingPing = (ping: BranchPing, message: string) => {
    const managerPing = withActor(createBranchManagerNotification(
      'status-update', 'Marketing', '', ` flagged stuck leads: ${message}`, ping.branch, 'students'
    ));
    setNotifications((prev) => [managerPing, ...prev]);
    insertNotification(managerPing).catch((err) => console.error('Failed to insert notification in Supabase', err));
  };

  /** Marketing content request → notify the target Branch Manager and the counselor. */
  const handleContentRequest = (req: ContentRequest, kind: 'new' | 'reminder' | 'reopened' = 'new') => {
    const detail = `: ${req.needed} — "${req.topic}", due ${req.deadline}`;
    const managerLead = kind === 'reminder' ? 'Reminder — Marketing is still waiting on ' : kind === 'reopened' ? 'Marketing asked again for content from ' : 'Marketing requested content from ';
    const counselorAfter = kind === 'reminder' ? ` still owe Marketing content${detail}`
      : kind === 'reopened' ? ` need to redo content${detail}${req.reopenReason ? ` (${req.reopenReason})` : ''}`
        : ` have been asked for content${detail}`;
    const managerPing = withActor(createBranchManagerNotification(
      'status-update', req.targetCounselor, managerLead, detail, req.targetBranch, 'bm-dashboard'
    ));
    const counselorPing: AppNotification = {
      ...withActor(createBranchManagerNotification('status-update', 'You', kind === 'reminder' ? 'Reminder — ' : 'Marketing request — ', counselorAfter, req.targetBranch, marketingInboxKey(req.targetCounselor))),
      role: contributorRole(req.targetCounselor),
      branch: undefined,
      recipientName: req.targetCounselor,
    };
    setNotifications((prev) => [managerPing, counselorPing, ...prev]);
    insertNotification(managerPing).catch((err) => console.error('Failed to insert notification in Supabase', err));
    insertNotification(counselorPing).catch((err) => console.error('Failed to insert notification in Supabase', err));
  };

  /** First counselor to accept a broadcast lead (single-branch or City Pool) claims it. The race
   * is decided by claimStudent's atomic `UPDATE ... WHERE claimed_by IS NULL`, not by this
   * function — a lost race returns `false` and this is a no-op. City Pool claims go to the
   * claiming counselor's own branch; single-branch broadcasts keep the broadcast branch. Returns
   * whether this call actually won the claim, so callers (e.g. the City Lead Pool tab) can tell
   * a lost race from a win without re-reading possibly-stale state. */
  const handleAcceptLead = async (leadId: string): Promise<boolean> => {
    const lead = students.find((s) => s.id === leadId);
    if (!lead || lead.claimedBy || !user) return false;
    const stamp = formatSubmittedAt(new Date());
    const targetBranch = lead.broadcastCity ? user.branch : (lead.broadcastBranch || lead.branch);
    const claimed = await claimStudent(leadId, { claimedBy: user.name, claimedAt: stamp, branch: targetBranch, assignedCounselor: user.name });
    if (!claimed) return false;
    setStudents((prev) => prev.map((s) => (s.id === leadId ? claimed : s)));
    handleAssign(leadId, user.name);
    return true;
  };

  const handleAssign = (studentId: string, counselorName: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, status: 'Assigned', assignedCounselor: counselorName }
          : s
      )
    );
    updateStudent(studentId, { status: 'Assigned', assignedCounselor: counselorName }).catch((err) => {
      console.error('Failed to update student in Supabase', err);
      setSaveError(`Couldn't save the assignment to ${counselorName} — it will revert on refresh. Try again or check your connection.`);
    });
    const student = students.find((s) => s.id === studentId);
    if (student) {
      const notification = withActor(createAssignmentNotification(student.name, student.country, student.purpose, counselorName));
      const managerNotification = withActor(createBranchManagerNotification(
        'assigned-to-counselor', student.name, '', ` assigned to ${counselorName} — ${student.country}, ${student.purpose}`, student.branch, 'students'
      ));
      setNotifications((prev) => [managerNotification, notification, ...prev]);
      insertNotification(notification).catch((err) => console.error('Failed to insert notification in Supabase', err));
      insertNotification(managerNotification).catch((err) => console.error('Failed to insert notification in Supabase', err));

      const existingCs = counselorStudents.find((cs) => cs.id === student.id);
      const newCounselorStudent: CounselorStudent = existingCs
        ? { ...existingCs, assignedCounselor: counselorName, assignedDate: new Date().toISOString().slice(0, 10) }
        : {
            id: student.id,
            clientId: generateClientId([...counselorStudents.map((c) => c.clientId), ...applications.map((a) => a.clientId)]),
            name: student.name,
            phone: student.phone,
            email: student.email,
            address: student.address,
            country: student.country,
            purpose: student.purpose,
            dob: student.dob,
            gender: student.gender,
            maritalStatus: student.maritalStatus,
            academics: student.academics,
            ieltsPte: student.ieltsPte,
            workExperience: student.workExperience,
            submittedAt: student.submittedAt,
            addedBy: student.addedBy,
            platformSource: student.platformSource,
            visitDateTime: student.visitDateTime ?? formatSubmittedAt(new Date()),
            assignedDate: new Date().toISOString().slice(0, 10),
            assignedCounselor: counselorName,
            consultationStatus: 'Awaiting Consultation',
            consultationNotes: '',
            followUpDate: null,
            completedDate: null,
            outcome: 'Pending',
          };
      setCounselorStudents((prev) =>
        prev.some((cs) => cs.id === newCounselorStudent.id)
          ? prev.map((cs) => (cs.id === newCounselorStudent.id ? newCounselorStudent : cs))
          : [newCounselorStudent, ...prev]
      );
      (existingCs ? upsertCounselorStudent(newCounselorStudent) : insertNewCounselorStudent(newCounselorStudent).then(syncIssuedClientId)).catch((err) => {
        console.error('Failed to upsert counselor_students in Supabase', err);
        setSaveError(`${newCounselorStudent.name} didn't save to ${counselorName}'s client list — it will revert on refresh. Try again or check your connection.`);
      });

      // activeAssignments is now derived live from counselor_students — no DB write needed.
    }
  };

  /** Front desk logs a returning client's visit — stamped on whichever record(s) exist. */
  const handleLogRevisit = (clientId: string) => {
    const stamp = formatSubmittedAt(new Date());

    const student = students.find((s) => s.id === clientId);
    if (student) {
      // Push the visit being replaced onto history first, so logging a new visit never
      // erases the only record of when the client was last seen.
      const previousVisit = student.revisitedAt ?? student.visitDateTime ?? student.submittedAt;
      const updates = { revisitedAt: stamp, visitHistory: [...(student.visitHistory ?? []), previousVisit] };
      setStudents((prev) => prev.map((s) => (s.id === clientId ? { ...s, ...updates } : s)));
      updateStudent(clientId, updates).catch((err) => console.error('Failed to update student in Supabase', err));
    }

    const counselorStudent = counselorStudents.find((c) => c.id === clientId);
    if (counselorStudent) {
      const previousVisit = counselorStudent.revisitedAt ?? counselorStudent.visitDateTime ?? counselorStudent.submittedAt;
      const updates = { revisitedAt: stamp, visitHistory: [...(counselorStudent.visitHistory ?? []), previousVisit] };
      setCounselorStudents((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c)));
      updateCounselorStudent(clientId, updates).catch((err) => console.error('Failed to update counselor_students in Supabase', err));
    }
  };

  const handleUpdateCounselorStudent = (id: string, updates: Partial<CounselorStudent>) => {
    setCounselorStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
    updateCounselorStudent(id, updates).catch((err) => {
      console.error('Failed to update counselor_students in Supabase', err);
      setSaveError("Couldn't save that change — it will revert on refresh. Try again or check your connection.");
    });
    if (updates.outcome === 'Proceeding') {
      const student = counselorStudents.find((s) => s.id === id);
      if (student) {
        const notification = withActor(createConsultationReadyNotification(student.name, user?.branch ?? ''));
        const managerNotification = withActor(createBranchManagerNotification(
          'consultation-ready', student.name, '', ' ready for application — consultation complete', user?.branch ?? '', 'applications'
        ));
        setNotifications((prev) => [managerNotification, notification, ...prev]);
        insertNotification(notification).catch((err) => console.error('Failed to insert notification in Supabase', err));
        insertNotification(managerNotification).catch((err) => console.error('Failed to insert notification in Supabase', err));

        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        // Each university the counselor entered becomes its own offer application, so a
        // client applying to three colleges shows as three rows on the Offer queue.
        const enrolments = updates.enrolments ?? student.enrolments ?? [];
        const offerApplications: OfferApplication[] = isStudyCase(student.purpose)
          ? enrolments.map((e, i) => ({
              id: `o${Date.now()}${i}`,
              institution: e.institution,
              country: e.country,
              course: e.program,
              intake: e.intake,
              status: 'Enrolled' as const,
              statusUpdatedAt: date,
              statusUpdatedTime: now.toISOString(),
              statusUpdatedBy: user?.name,
              enrolledDate: date,
              enrolledBy: student.assignedCounselor,
            }))
          : [];
        const newApplication: ApplicationRecord = {
          id: `a${Date.now()}`,
          clientId: student.clientId ?? clientIdFor(student),
          name: student.name,
          phone: student.phone,
          email: student.email,
          address: student.address,
          country: student.country,
          purpose: student.purpose,
          dob: student.dob,
          gender: student.gender,
          maritalStatus: student.maritalStatus,
          academics: student.academics,
          ieltsPte: student.ieltsPte,
          workExperience: student.workExperience,
          counselor: student.assignedCounselor,
          consultationDate: student.completedDate ?? now.toISOString().slice(0, 10),
          addedBy: student.addedBy,
          visitDateTime: student.visitDateTime ?? student.submittedAt,
          consultationNotes: student.consultationNotes,
          branch: user?.branch ?? '',
          offerApplications,
          visaApplication: null,
          withdrawn: false,
          notes: [],
        };
        setApplications((prev) => [newApplication, ...prev]);
        insertApplication(newApplication).catch((err) => console.error('Failed to insert application in Supabase', err));
      }
    }
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    markNotificationRead(id).catch((err) => console.error('Failed to mark notification read in Supabase', err));
  };

  const handleMarkAllNotificationsRead = (ids: string[]) => {
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    markNotificationsRead(ids).catch((err) => console.error('Failed to mark notifications read in Supabase', err));
  };

  // Every offer / visa status change is stamped with the exact time and who made it, here in
  // one place, so dashboard activity feeds can show "time · by" whichever page made the change.
  // Profiles send back their own copy of the offers, so an unchanged status keeps its stamp.
  const stampStatusChanges = (prev: ApplicationRecord | undefined, updates: Partial<ApplicationRecord>): Partial<ApplicationRecord> => {
    const now = new Date().toISOString();
    const by = user?.name;
    const next = { ...updates };
    if (updates.offerApplications) {
      next.offerApplications = updates.offerApplications.map((o) => {
        const before = prev?.offerApplications.find((p) => p.id === o.id);
        if (!before || before.status !== o.status) return { ...o, statusUpdatedTime: now, statusUpdatedBy: by };
        return { ...o, statusUpdatedTime: o.statusUpdatedTime ?? before.statusUpdatedTime, statusUpdatedBy: o.statusUpdatedBy ?? before.statusUpdatedBy };
      });
    }
    if (updates.visaApplication) {
      const v = updates.visaApplication;
      const before = prev?.visaApplication;
      const changed = !before || before.status !== v.status || (before.history?.length ?? 0) !== (v.history?.length ?? 0);
      next.visaApplication = changed
        ? { ...v, statusUpdatedTime: now, statusUpdatedBy: by }
        : { ...v, statusUpdatedTime: v.statusUpdatedTime ?? before?.statusUpdatedTime, statusUpdatedBy: v.statusUpdatedBy ?? before?.statusUpdatedBy };
    }
    return next;
  };

  const handleUpdateApplication = (id: string, rawUpdates: Partial<ApplicationRecord>) => {
    const updates = stampStatusChanges(applications.find((a) => a.id === id), rawUpdates);
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
    updateApplication(id, updates).catch((err) =>
      console.error('Failed to update application in Supabase', err)
    );

    const prevApp = applications.find((a) => a.id === id);

    // Country pipeline automation (USA): scheduling the visa interview assigns the counselor an
    // interview-prep task on the Daily Task Board, due before the interview, and notifies them.
    const interviewAt = prevApp ? newlyScheduledInterview(prevApp.countryPipeline, updates.countryPipeline) : null;
    if (prevApp && interviewAt) {
      const interview = new Date(interviewAt);
      const due = new Date(Math.max(Date.now(), interview.getTime() - 2 * 86_400_000));
      const interviewPrepTask: DailyTask = {
        id: `task-usa-prep-${prevApp.id}-${Date.now()}`,
        title: `Schedule USA Interview Prep with Client — ${prevApp.name}`,
        notes: `US visa interview on ${formatInterview(interviewAt)}. Run a mock interview and check the DS-160, I-20 and financial documents.`,
        category: 'Client Follow-up',
        branch: prevApp.branch,
        assignedRole: 'Counselor',
        assignee: prevApp.counselor,
        date: dateKey(due),
        priority: 'High',
        status: 'To Do',
        createdBy: 'System · Country Pipeline',
      };
      setTasks((prev) => [interviewPrepTask, ...prev]);
      insertTask(interviewPrepTask).catch((err) => console.error('Failed to insert task in Supabase', err));
      const ping: AppNotification = {
        ...withActor(createBranchManagerNotification('status-update', prevApp.name, 'US visa interview scheduled for ', ` on ${formatInterview(interviewAt)} — an interview-prep task was added to your Daily Tasks.`, prevApp.branch, 'daily-tasks')),
        role: 'counselor', branch: undefined, recipientName: prevApp.counselor,
      };
      setNotifications((prev) => [ping, ...prev]);
      insertNotification(ping).catch((err) => console.error('Failed to insert notification in Supabase', err));
    }

    // Surface offer/visa status tracker moves to the branch manager's Today's Activity —
    // compare the unified status label before and after rather than diffing individual
    // fields, so unrelated edits (notes, checklist ticks, deferred intake) stay silent.
    if (prevApp) {
      const prevLabel = getClientStatusLabel(prevApp);
      const nextLabel = getClientStatusLabel({ ...prevApp, ...updates });
      if (nextLabel !== prevLabel) {
        const notification = withActor(createStatusUpdateNotification(prevApp.name, nextLabel, prevApp.branch));
        setNotifications((prev) => [notification, ...prev]);
        insertNotification(notification).catch((err) => console.error('Failed to insert notification in Supabase', err));
      }
    }
  };

  const handleAddStaff = async (member: StaffMember, password: string, counselorCountries?: string[]) => {
    const authUserId = await createStaffAccount(member.email, password, member.branch);
    const withAuth: StaffMember = { ...member, authUserId };
    // Awaited so a failed save shows in the form instead of a login with no staff row; retrying
    // the same email then reuses that login (see the admin-staff function).
    await insertStaff(withAuth);
    setStaff((prev) => [...prev, withAuth]);
    if (member.role === 'Branch Manager') {
      setBranches((prev) =>
        prev.map((b) => (b.name === member.branch ? { ...b, manager: member.name } : b))
      );
      const target = branches.find((b) => b.name === member.branch);
      if (target) {
        updateBranch(target.id, { manager: member.name }).catch((err) =>
          console.error('Failed to update branch manager in Supabase', err)
        );
      }
    }
    if (member.role === 'Counselor') {
      const newCounselor: Counselor = {
        id: `c${Date.now()}`,
        name: member.name,
        countries: counselorCountries ?? [],
        activeAssignments: 0,
        availability: 'Available',
      };
      setCounselors((prev) => [...prev, newCounselor]);
      insertCounselor(newCounselor).catch((err) => console.error('Failed to insert counselor in Supabase', err));
    }
  };

  const handleUpdateStaff = async (id: string, updates: Partial<StaffMember>, password?: string) => {
    const target = staff.find((s) => s.id === id);
    if (target?.authUserId) {
      if (password) await resetStaffPassword(target.authUserId, password);
      if (updates.email !== undefined && updates.email !== target.email) await updateStaffEmail(target.authUserId, updates.email);
    }
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    updateStaff(id, updates).catch((err) => console.error('Failed to update staff in Supabase', err));
  };

  const handleRemoveStaff = (id: string) => {
    const target = staff.find((s) => s.id === id);
    setStaff((prev) => prev.filter((s) => s.id !== id));
    // The login goes first: the admin-staff function checks the staff row's branch before
    // deleting it, so removing the row first left the login behind.
    const deleteLogin = target?.authUserId
      ? deleteStaffAccount(target.authUserId).catch((err) => console.error('Failed to delete staff Auth account', err))
      : Promise.resolve();
    deleteLogin
      .then(() => deleteStaff(id))
      .catch((err) => console.error('Failed to delete staff in Supabase', err));
    if (target?.role === 'Branch Manager') {
      setBranches((prev) =>
        prev.map((b) => (b.manager === target.name ? { ...b, manager: null } : b))
      );
      const targetBranch = branches.find((b) => b.manager === target.name);
      if (targetBranch) {
        updateBranch(targetBranch.id, { manager: null }).catch((err) =>
          console.error('Failed to update branch manager in Supabase', err)
        );
      }
    }
    if (target?.role === 'Counselor') {
      const targetCounselor = counselors.find((c) => c.name === target.name);
      setCounselors((prev) => prev.filter((c) => c.name !== target.name));
      if (targetCounselor) {
        deleteCounselor(targetCounselor.id).catch((err) =>
          console.error('Failed to delete counselor in Supabase', err)
        );
      }
    }
  };

  const handleAddBranch = (branch: Branch) => {
    setBranches((prev) => [...prev, branch]);
    insertBranch(branch).catch((err) => console.error('Failed to insert branch in Supabase', err));
  };

  const handleDeleteBranch = (id: string) => {
    setBranches((prev) => prev.filter((b) => b.id !== id));
    deleteBranch(id).catch((err) => console.error('Failed to delete branch in Supabase', err));
  };

  const handleAddPartner = (partner: Partner) => {
    setPartners((prev) => [...prev, partner]);
    insertPartner(partner).catch((err) => console.error('Failed to insert partner in Supabase', err));
  };

  const handleUpdatePartner = (id: string, updates: Partial<Partner>) => {
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    updatePartner(id, updates).catch((err) => console.error('Failed to update partner in Supabase', err));
  };

  const handleDeletePartner = (id: string) => {
    setPartners((prev) => prev.filter((p) => p.id !== id));
    deletePartner(id).catch((err) => console.error('Failed to delete partner in Supabase', err));
  };

  const handleUpdateCommission = (id: string, updates: Partial<CommissionRecord>) => {
    setCommissions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
    updateCommission(id, updates).catch((err) => console.error('Failed to update commission in Supabase', err));
  };

  const handleAddTask = (task: DailyTask) => {
    setTasks((prev) => [task, ...prev]);
    insertTask(task).catch((err) => console.error('Failed to insert task in Supabase', err));
  };
  const handleUpdateTask = (id: string, updates: Partial<DailyTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    updateTask(id, updates).catch((err) => console.error('Failed to update task in Supabase', err));
  };
  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteTask(id).catch((err) => console.error('Failed to delete task in Supabase', err));
  };
  // Insert-or-replace by id — check-in creates a record, check-out and corrections update it.
  const upsert = <T extends { id: string }>(item: T) => (prev: T[]) =>
    prev.some((x) => x.id === item.id) ? prev.map((x) => (x.id === item.id ? item : x)) : [...prev, item];
  // Strictly one record per employee per day: a save for a day that already has a record
  // (even under a different id) replaces that record rather than adding a second one.
  const handleSaveAttendance = (record: AttendanceRecord) =>
    setAttendance((prev) => {
      const existing = prev.find((r) => r.id === record.id || (r.staffName === record.staffName && r.date === record.date));
      const resolved = existing ? { ...record, id: existing.id } : record;
      upsertAttendance(resolved).catch((err) => console.error('Failed to save attendance record in Supabase', err));
      return existing ? prev.map((r) => (r === existing ? resolved : r)) : [...prev, resolved];
    });
  const handleSaveDayLog = (log: BranchDayLog) => {
    setDayLogs(upsert(log));
    upsertBranchDayLog(log).catch((err) => console.error('Failed to save branch day log in Supabase', err));
  };
  const handleAddCorrection = (c: AttendanceCorrection) => {
    setCorrections((prev) => [...prev, c]);
    insertAttendanceCorrection(c).catch((err) => console.error('Failed to insert attendance correction in Supabase', err));
  };
  const handleUpdateCorrection = (id: string, updates: Partial<AttendanceCorrection>) => {
    setCorrections((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    updateAttendanceCorrection(id, updates).catch((err) => console.error('Failed to update attendance correction in Supabase', err));
  };
  // Case updates take a function of the latest case, so several quick changes (e.g. a bulk
  // handover logging one transfer per category) never overwrite each other.
  const handleUpdateOnboarding = (id: string, update: (c: OnboardingCase) => Partial<OnboardingCase>) =>
    setOnboarding((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const updates = update(c);
      updateOnboardingCase(id, updates).catch((err) => console.error('Failed to update onboarding case in Supabase', err));
      return { ...c, ...updates };
    }));
  const handleUpdateOffboarding = (id: string, update: (c: OffboardingCase) => Partial<OffboardingCase>) =>
    setOffboarding((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const updates = update(c);
      updateOffboardingCase(id, updates).catch((err) => console.error('Failed to update offboarding case in Supabase', err));
      return { ...c, ...updates };
    }));
  const handleAddIssue = (issue: BranchIssue) => {
    setIssues((prev) => [issue, ...prev]);
    insertBranchIssue(issue).catch((err) => console.error('Failed to insert branch issue in Supabase', err));
  };
  const handleUpdateIssue = (id: string, updates: Partial<BranchIssue>) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    updateBranchIssue(id, updates).catch((err) => console.error('Failed to update branch issue in Supabase', err));
  };
  const handleAddNotice = (notice: BranchNotice) => {
    setNotices((prev) => [notice, ...prev]);
    insertBranchNotice(notice).catch((err) => console.error('Failed to insert branch notice in Supabase', err));
  };
  const handleUpdateNotice = useCallback((id: string, updates: Partial<BranchNotice>) => {
    setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
    updateBranchNotice(id, updates).catch((err) => console.error('Failed to update branch notice in Supabase', err));
  }, []);

  const branchNames = useMemo(() => branches.map((b) => b.name), [branches]);

  // ── Branch Manager Workspace ──────────────────────────────────────────────
  // Every action re-checks the role and the branch here, not just in the UI: a manager only
  // writes their own branch's requests, only hands over their own branch's clients, and only
  // decides transfers OUT of their own branch.
  const activeCounselorIn = (name: string, branch: string) =>
    staff.some((s) => s.name === name && s.role === 'Counselor' && s.status === 'Active' && s.branch === branch);
  /** Marketing content can be delegated to counselors and the Front Desk — the two roles with a Marketing inbox. */
  const activeContributorIn = (name: string, branch: string) =>
    staff.some((s) => s.name === name && (s.role === 'Counselor' || s.role === 'Front Desk Officer') && s.status === 'Active' && s.branch === branch);
  const pendingTransferFor = (clientKey: string) => workspace.transfers.some((t) => t.clientKey === clientKey && t.status === 'Pending');
  const notifyMarketingManager = (subject: string, before: string, after: string) => {
    const manager = staff.find((s) => s.role === 'Marketing' && s.status === 'Active' && (s.marketingRole ?? 'Marketing Manager') === 'Marketing Manager');
    if (!manager) return;
    pushNotification({ ...withActor(createBranchManagerNotification('status-update', subject, before, after, '', 'overview')), role: 'marketing', branch: undefined, recipientName: manager.name });
  };

  /** Super Admin override of a task's status — applied, then written to the audit log for good. */
  const handleOverrideTask = (taskId: string, status: 'To Do' | 'Done', reason: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!user || user.role !== 'super_admin' || !task || task.status === status || reason.trim().length < 10) return;
    const at = formatSubmittedAt(new Date());
    handleUpdateTask(taskId, { status, updatedBy: user.name, updatedAt: at });
    const entry: AuditOverrideEntry = {
      id: `ovr-${Date.now()}`, at, by: user.name, record: `Task · ${task.title} (${task.branch})`, field: 'Status', from: task.status, to: status, reason: reason.trim(),
    };
    setAuditLog((prev) => [entry, ...prev]);
    insertAuditLogEntry(entry).catch((err) => console.error('Failed to insert audit log entry in Supabase', err));
  };

  const workspaceActions: WorkspaceActions = {
    addContentRequest: (input) => {
      if (!user || user.role !== 'branch_manager' || input.neededBy < dateKey(new Date())) return;
      const code = nextCode('MKR', workspace.contentRequests.map((r) => r.code));
      const newRequest: BranchContentRequest = { ...input, id: `bcr-${Date.now()}`, code, branch: user.branch, requestedBy: user.name, requestedAt: formatSubmittedAt(new Date()), status: 'Requested' };
      setWorkspace((w) => ({ ...w, contentRequests: [newRequest, ...w.contentRequests] }));
      insertBranchContentRequest(newRequest).catch((err) => console.error('Failed to insert branch_content_request in Supabase', err));
      notifyMarketingManager(`${user.branch} branch`, '', ` requested a ${input.type.toLowerCase()} for ${input.country} (${input.intake}) — needed by ${input.neededBy}.`);
    },
    cancelContentRequest: (id) => {
      const r = workspace.contentRequests.find((x) => x.id === id);
      // Only while Marketing hasn't started on it.
      if (!user || user.role !== 'branch_manager' || !r || r.branch !== user.branch || r.status !== 'Requested') return;
      setWorkspace((w) => ({ ...w, contentRequests: w.contentRequests.filter((x) => x.id !== id) }));
      deleteBranchContentRequest(id).catch((err) => console.error('Failed to delete branch_content_request in Supabase', err));
    },
    addSupportRequest: (input) => {
      if (!user || user.role !== 'branch_manager' || input.budget < 0) return;
      const code = nextCode('MSR', workspace.supportRequests.map((r) => r.code));
      const newRequest: MarketingSupportRequest = { ...input, id: `msr-${Date.now()}`, code, branch: user.branch, requestedBy: user.name, requestedAt: formatSubmittedAt(new Date()), status: 'Submitted' };
      setWorkspace((w) => ({ ...w, supportRequests: [newRequest, ...w.supportRequests] }));
      insertMarketingSupportRequest(newRequest).catch((err) => console.error('Failed to insert marketing_support_request in Supabase', err));
      notifyMarketingManager(`${user.branch} branch`, '', ` asked for marketing support: ${input.kind} — “${input.title}”.`);
    },
    delegateDirective: (id, to, internalDue, note) => {
      const req = marketing.contentRequests.find((r) => r.id === id);
      if (!user || user.role !== 'branch_manager' || !req || req.targetBranch !== user.branch || req.status !== 'Waiting'
        || !activeContributorIn(to, user.branch) || internalDue < dateKey(new Date())) return;
      const at = formatSubmittedAt(new Date());
      setMarketing((m) => ({
        ...m,
        contentRequests: m.contentRequests.map((r) => (r.id !== id ? r : {
          ...r, targetCounselor: to, internalDue, delegatedBy: user.name, delegatedAt: at, delegationNote: note || undefined,
        })),
      }));
      pushNotification({
        ...withActor(createBranchManagerNotification('status-update', 'You', `${user.name} assigned you a Marketing request — `, `: ${req.needed} — “${req.topic}”, due ${internalDue}${note ? ` (${note})` : ''}`, user.branch, marketingInboxKey(to))),
        role: contributorRole(to), branch: undefined, recipientName: to,
      });
      if (req.targetCounselor && req.targetCounselor !== to) {
        pushNotification({
          ...withActor(createBranchManagerNotification('status-update', req.topic, '', ` was moved from ${req.targetCounselor} to ${to} by the ${user.branch} Branch Manager.`, '', 'cp-requests')),
          role: 'marketing', branch: undefined, recipientName: req.requestedBy,
        });
      }
    },
    handover: (clientKey, to, reason, handoverDate) => {
      const client = branchCounselorStudents.find((c) => c.id === clientKey);
      if (!user || user.role !== 'branch_manager' || !client || client.assignedCounselor === to || !activeCounselorIn(to, user.branch)
        || reason.trim().length < 5 || handoverDate < dateKey(new Date()) || pendingTransferFor(clientKey)) return;
      const from = client.assignedCounselor;
      const entry: ClientAuditEntry = {
        id: `audit-${Date.now()}`, at: formatSubmittedAt(new Date()), by: user.name, action: 'Handover', from, to, reason: reason.trim(),
        text: `Transferred from ${from} to ${to} by ${user.name} (Branch Manager), effective ${handoverDate}. Reason: ${reason.trim()}`,
      };
      reassignClient(client, to, entry);
      pushNotification({
        ...withActor(createBranchManagerNotification('assigned-to-counselor', client.name, '', ` was handed over to you from ${from} by ${user.name} — ${reason.trim()}`, user.branch, 'my-students')),
        role: 'counselor', branch: undefined, recipientName: to,
      });
      pushNotification({
        ...withActor(createBranchManagerNotification('assigned-to-counselor', client.name, '', ` was moved to ${to} by ${user.name} — ${reason.trim()}`, user.branch, 'my-students')),
        role: 'counselor', branch: undefined, recipientName: from,
      });
    },
    requestTransfer: ({ clientKey, toCounselor, reason, visitDate }) => {
      const client = counselorStudents.find((c) => c.id === clientKey);
      if (!user || user.role !== 'branch_manager' || !client) return;
      const fromBranch = branchOfClient(client, students, staff);
      if (!fromBranch || fromBranch === user.branch || pendingTransferFor(clientKey) || !activeCounselorIn(toCounselor, user.branch)
        || reason.trim().length < 10 || visitDate > dateKey(new Date())) return;
      const at = formatSubmittedAt(new Date());
      const transfer: BranchTransfer = {
        id: `trf-${Date.now()}`, code: nextCode('TRF', workspace.transfers.map((t) => t.code)),
        clientKey, clientId: client.clientId ?? '—', clientName: client.name,
        fromBranch, toBranch: user.branch, fromCounselor: client.assignedCounselor, toCounselor,
        reason: reason.trim(), visitDate, requestedBy: user.name, requestedAt: at, status: 'Pending',
        log: [{ at, by: user.name, role: `Branch Manager · ${user.branch}`, text: `Requested transfer ${fromBranch} → ${user.branch}. Reason: ${reason.trim()}` }],
      };
      setWorkspace((w) => ({ ...w, transfers: [transfer, ...w.transfers] }));
      insertBranchTransfer(transfer).catch((err) => console.error('Failed to insert branch_transfer in Supabase', err));
      pushNotification(withActor(createBranchManagerNotification('status-update', client.name, `${user.branch} asked to take over `, ` — Transfer Pending Approval (${fromBranch} → ${user.branch}).`, fromBranch, 'approvals')));
    },
    decideTransfer: (id, decision, note) => {
      const t = workspace.transfers.find((x) => x.id === id);
      // Only the ORIGIN branch's manager decides, and only once.
      if (!user || user.role !== 'branch_manager' || !t || t.fromBranch !== user.branch || t.status !== 'Pending') return;
      if (decision === 'Rejected' && note.trim().length < 5) return;
      const client = counselorStudents.find((c) => c.id === t.clientKey);
      if (decision === 'Approved' && (!client || !activeCounselorIn(t.toCounselor, t.toBranch))) return;
      const at = formatSubmittedAt(new Date());
      const log = [...t.log, {
        at, by: user.name, role: `Branch Manager · ${user.branch}`,
        text: `${decision === 'Approved' ? 'Approved' : 'Rejected'} transfer.${note.trim() ? ` Note: ${note.trim()}` : ''}`,
      }];
      if (decision === 'Approved' && client) {
        const entry: ClientAuditEntry = {
          id: `audit-${Date.now()}`, at, by: user.name, action: 'Branch Transfer', from: client.assignedCounselor, to: t.toCounselor, reason: t.reason,
          text: `Transferred ${t.fromBranch} → ${t.toBranch} (${t.code}); counselor ${client.assignedCounselor} → ${t.toCounselor}. Approved by ${user.name}.`,
        };
        reassignClient(client, t.toCounselor, entry, t.toBranch);
        // "Who collects it keeps it": money already collected stays with the old branch; the unpaid
        // balance moves with the client — a Transfer credit here, a matching Charge there. Nothing
        // existing is edited.
        const oldRows = finTransactions.filter((x) => x.clientId === client.clientId && x.branch === t.fromBranch);
        const owed = clientBalances(oldRows, dateKey(new Date()))[0]?.outstanding ?? 0;
        if (owed > 0 && client.clientId) {
          const open = chargeLines(oldRows).find((l) => l.remaining > 0)?.charge;
          const meta = { code: t.code, from: t.fromBranch, to: t.toBranch };
          const base = { clientId: client.clientId, clientName: client.name, country: open?.country ?? client.country, service: open?.service ?? 'Other Charge' as const, amount: owed, at, by: user.name, transfer: meta };
          const transferOut: FinTransaction = { ...base, id: `fin-trf-out-${Date.now()}`, branch: t.fromBranch, kind: 'Transfer', counselor: client.assignedCounselor, title: `Balance transferred to ${t.toBranch} (${t.code})` };
          const transferIn: FinTransaction = { ...base, id: `fin-trf-in-${Date.now()}`, branch: t.toBranch, kind: 'Charge', counselor: t.toCounselor, title: `Balance transferred from ${t.fromBranch} (${t.code})`, dueDate: dateKey(new Date()) };
          setFinTransactions((prev) => [...prev, transferOut, transferIn]);
          upsertFinTransaction(transferOut).catch((err) => console.error('Failed to insert fin_transaction in Supabase', err));
          upsertFinTransaction(transferIn).catch((err) => console.error('Failed to insert fin_transaction in Supabase', err));
          log.push({ at, by: 'System', role: 'Finance', text: `Unpaid balance moved to ${t.toBranch}; payments already collected stay with ${t.fromBranch}.` });
        }
        log.push({ at, by: 'System', role: 'Audit', text: `Primary branch changed ${t.fromBranch} → ${t.toBranch}; counselor ${client.assignedCounselor} → ${t.toCounselor}.` });
        pushNotification({
          ...withActor(createBranchManagerNotification('assigned-to-counselor', client.name, '', ` transferred to you from ${t.fromBranch} (${t.code}).`, t.toBranch, 'my-students')),
          role: 'counselor', branch: undefined, recipientName: t.toCounselor,
        });
      }
      const decidedNote = note.trim() || undefined;
      setWorkspace((w) => ({
        ...w,
        transfers: w.transfers.map((x) => (x.id !== id ? x : { ...x, status: decision, decidedBy: user.name, decidedAt: at, decisionNote: decidedNote, log })),
      }));
      updateBranchTransfer(id, { status: decision, decidedBy: user.name, decidedAt: at, decisionNote: decidedNote, log }).catch((err) => console.error('Failed to update branch_transfer in Supabase', err));
      pushNotification(withActor(createBranchManagerNotification('status-update', t.clientName, `${user.branch} ${decision.toLowerCase()} the transfer of `, decision === 'Rejected' ? ` — ${note.trim()}` : ` — now registered at ${t.toBranch}.`, t.toBranch, 'bm-transfers')));
    },
    reassignTask: (id, assignee) => {
      const task = tasks.find((t) => t.id === id);
      const person = staff.find((s) => s.name === assignee && s.status === 'Active');
      if (!user || user.role !== 'branch_manager' || !task || task.branch !== user.branch || task.status === 'Done' || !person || person.branch !== user.branch
        || (task.assignedRole !== 'Anyone' && person.role !== task.assignedRole)) return;
      handleUpdateTask(id, { assignee, updatedBy: user.name, updatedAt: formatSubmittedAt(new Date()) });
    },
    addItTicket: (input) => {
      if (!user || user.role !== 'branch_manager') return;
      const at = formatSubmittedAt(new Date());
      const newTicket: ItTicket = {
        ...input, id: `it-${Date.now()}`, code: nextCode('IT', workspace.itTickets.map((t) => t.code)), branch: user.branch,
        raisedBy: user.name, raisedAt: at, status: 'Open', history: [{ at, by: user.name, text: 'Ticket raised' }],
      };
      setWorkspace((w) => ({ ...w, itTickets: [newTicket, ...w.itTickets] }));
      insertItTicket(newTicket).catch((err) => console.error('Failed to insert it_ticket in Supabase', err));
    },
    reopenItTicket: (id, note) => {
      const t = workspace.itTickets.find((x) => x.id === id);
      if (!user || user.role !== 'branch_manager' || !t || t.branch !== user.branch || t.status !== 'Resolved' || note.trim().length < 5) return;
      const at = formatSubmittedAt(new Date());
      const history = [...t.history, { at, by: user.name, text: `Reopened: ${note.trim()}` }];
      setWorkspace((w) => ({
        ...w,
        itTickets: w.itTickets.map((x) => (x.id !== id ? x : { ...x, status: 'Open', resolvedAt: undefined, history })),
      }));
      updateItTicket(id, { status: 'Open', resolvedAt: undefined, history }).catch((err) => console.error('Failed to update it_ticket in Supabase', err));
    },
  };

  // Branch Manager's Staff page is scoped to their own branch and to branch-level roles —
  // company-wide roles (Super Admin/Marketing/Finance) never belong to a single branch, so
  // they're excluded even in the unlikely case their `branch` value collides with this one.
  const branchStaff = useMemo(() => {
    if (!user || user.role !== 'branch_manager') return staff;
    return staff.filter(
      (s) => s.branch === user.branch && s.role !== 'Super Admin' && s.role !== 'Marketing'
    );
  }, [staff, user]);

  // Every non-Super-Admin role's Students/Applications/Assign Counselor pages are scoped to
  // their own branch — StudentList and ApplicationsList only render a branch filter dropdown
  // for Super Admin (showBranchFilter), so without pre-filtering here a Branch Manager,
  // Front Desk Officer or V/A Officer would see every branch's data.
  const branchStudents = useMemo(() => {
    if (!user || user.role === 'super_admin') return students;
    return students.filter((s) => s.branch === user.branch);
  }, [students, user]);

  const branchApplications = useMemo(() => {
    if (!user || user.role === 'super_admin') return applications;
    return applications.filter((a) => a.branch === user.branch);
  }, [applications, user]);

  // A counselor reaching the Offer/Visa Applications queues only ever sees their own
  // assigned clients, still within their own branch.
  const stageScopedApplications = useMemo(() => {
    if (!user || user.role !== 'counselor') return branchApplications;
    return branchApplications.filter((a) => a.counselor === user.name);
  }, [branchApplications, user]);

  // Recompute activeAssignments live from counselor_students so the count always reflects
  // real data rather than the stale integer stored in the counselors table.
  const counselorsWithLiveCounts = useMemo(() => {
    return counselors.map((c) => ({
      ...c,
      activeAssignments: counselorStudents.filter(
        (s) => s.assignedCounselor === c.name && s.consultationStatus !== 'Consultation Complete'
      ).length,
    }));
  }, [counselors, counselorStudents]);

  // Counselor rows carry no `branch` of their own — resolved via their staff record
  // (matched by name), same technique used in computeBranchOverviewStats.
  const branchCounselors = useMemo(() => {
    if (!user || user.role === 'super_admin') return counselorsWithLiveCounts;
    const counselorBranchByName = new Map(staff.filter((s) => s.role === 'Counselor').map((s) => [s.name, s.branch]));
    return counselorsWithLiveCounts.filter((c) => counselorBranchByName.get(c.name) === user.branch);
  }, [counselorsWithLiveCounts, staff, user]);

  // Same branch resolution as branchCounselors, applied to counselor_students rows —
  // used wherever a branch-scoped role (Receptionist, Branch Manager) needs the raw list of
  // assigned clients rather than just aggregate counts, so no other branch's clients leak in.
  const branchCounselorStudents = useMemo(() => {
    if (!user || user.role === 'super_admin') return counselorStudents;
    const counselorBranchByName = new Map(staff.filter((s) => s.role === 'Counselor').map((s) => [s.name, s.branch]));
    return counselorStudents.filter((cs) => counselorBranchByName.get(cs.assignedCounselor) === user.branch);
  }, [counselorStudents, staff, user]);


  const upcomingConsultations = useMemo(() => {
    const pending = counselorStudents.filter((s) => s.consultationStatus !== 'Consultation Complete');
    if (user?.role === 'counselor') {
      return pending.filter((s) => s.assignedCounselor === user.name);
    }
    return pending;
  }, [counselorStudents, user]);

  // A counselor's Assigned Clients/Enrolled/Archive pages are scoped to their own clients —
  // without this, App.tsx would hand every counselor's full counselor_students list down.
  const myCounselorStudents = useMemo(() => {
    if (!user || user.role !== 'counselor') return counselorStudents;
    return counselorStudents.filter((s) => s.assignedCounselor === user.name);
  }, [counselorStudents, user]);

  // City Lead Pool: the counselor's own branch's city (branches.location), and every unclaimed
  // (or self-claimed) broadcast-city lead — RLS already limits `students` to rows this counselor
  // may see, so this is just shaping them into CityPoolLead cards.
  const myCity = useMemo(() => branches.find((b) => b.name === user?.branch)?.location, [branches, user]);
  const cityPoolLeads = useMemo((): CityPoolLead[] => {
    if (!user || user.role !== 'counselor' || !myCity) return [];
    return students
      .filter((s) => s.broadcastCity === myCity && (!s.claimedBy || s.claimedBy === user.name))
      .map((s): CityPoolLead => {
        const interested = s.workExperience?.startsWith('Interested in: ') ? s.workExperience.slice('Interested in: '.length) : undefined;
        return {
          id: s.id,
          city: s.broadcastCity!,
          fullName: s.name,
          fullPhone: s.phone,
          email: s.email || undefined,
          interestedCountry: s.country,
          targetProgram: interested ?? s.purpose,
          source: s.platformSource === 'Tiktok' ? 'TikTok' : ((s.platformSource ?? 'Website') as CityPoolLead['source']),
          notes: interested ? undefined : (s.workExperience || undefined),
          enteredPoolAt: s.broadcastAt ?? s.submittedAt,
          claim: s.claimedBy ? { counselorName: s.claimedBy, branch: s.branch, claimedAt: s.claimedAt ?? '' } : undefined,
        };
      });
  }, [students, user, myCity]);
  /** Resolves once the claim (or its rejection by another counselor's earlier claim) is durable. */
  const handleClaimCityPoolLead = async (leadId: string): Promise<'claimed' | 'already-claimed'> =>
    (await handleAcceptLead(leadId)) ? 'claimed' : 'already-claimed';

  // Marketing data boundary: the department only ever receives these whitelisted rows —
  // never the raw intake / consultation / application / ledger records (see marketingDept.ts).
  // The Leads Specialist sees outcomes only — the finance ledger isn't even passed in, so no
  // revenue figure exists in their rows.
  // Only the Marketing Manager sees marketing-attributed revenue; no other sub-role gets the ledger.
  const marketingSeesRevenue = user?.role === 'marketing' && (user.marketingRole ?? 'Marketing Manager') === 'Marketing Manager';
  // Graphics Designer data boundary: a production-queue projection, nothing else (designerData.ts).
  const designerData = useMemo(() => designerView(marketing), [marketing]);
  const marketingTracks = useMemo(
    () => trackMarketingLeads(
      marketing.leads, marketingTrackedIntakes, marketingTrackedConsultations, marketingTrackedApplications,
      marketingSeesRevenue ? marketingTrackedRevenue : null,
    ),
    [marketing.leads, marketingTrackedIntakes, marketingTrackedConsultations, marketingTrackedApplications, marketingTrackedRevenue, marketingSeesRevenue]
  );
  const marketingTeam = useMemo(() => staff
    .filter((s) => s.role === 'Marketing' && s.status === 'Active')
    .map((s) => ({ name: s.name, role: s.marketingRole ?? 'Marketing Manager' as const })), [staff]);
  // Who Marketing can ask for branch content: counselors and Front Desk Officers.
  const contributorsByBranch = useMemo(() => {
    const map: Record<string, { name: string; role: string }[]> = {};
    staff.filter((s) => (s.role === 'Counselor' || s.role === 'Front Desk Officer') && s.status === 'Active')
      .forEach((s) => { (map[s.branch] ??= []).push({ name: s.name, role: s.role }); });
    return map;
  }, [staff]);

  // Everything the Super Admin Command Center reads — company-wide, no branch scoping.
  const commandSources = useMemo<CommandSources>(() => ({
    branches, staff, intakes: students, consultations: counselorStudents, applications, transactions: finTransactions, expenses,
    marketingLeads: marketing.leads, issues, tasks, attendance, dayLogs, leave, corrections, holidays, transfers: workspace.transfers, audit: auditLog, servicePrices,
  }), [branches, staff, students, counselorStudents, applications, finTransactions, expenses, marketing.leads, issues, tasks, attendance, dayLogs, leave, corrections, holidays, workspace.transfers, auditLog, servicePrices]);

  if (isIntakeForm) {
    return <NewIntakeForm />;
  }

  if (!user && restoringSession) return null;
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // A new hire with an open onboarding case gets "My Onboarding" at the top of Branch Hub.
  const openOnboarding = onboarding.some((c) => c.employeeName === user.name && !c.completedAt);
  const baseNav = user.role === 'marketing' && user.marketingRole === 'Leads Specialist' ? LEADS_SPECIALIST_NAV
    : user.role === 'marketing' && user.marketingRole === 'Content Planner' ? CONTENT_PLANNER_NAV
      : user.role === 'marketing' && user.marketingRole === 'Graphics Designer' ? DESIGNER_NAV
        : NAV_CONFIG[user.role];
  const navItems = openOnboarding
    ? baseNav.map((n) =>
      n.key === 'branch-hub' && n.children
        ? { ...n, children: [{ key: 'hub-onboarding', label: 'My Onboarding', icon: 'UserPlus' }, ...n.children] }
        : n)
    : baseNav;
  const activeEntry = findNavEntry(navItems, activeKey);
  const activeItem = activeEntry?.item;
  const isSuperAdmin = user.role === 'super_admin';

  const intent = navIntent ?? undefined;

  const branchHolidays = holidaysFor(holidays, user.branch);

  const renderPage = () => {
    // Graphics Designer — its own routed workspace, fed only the designer projection. It never
    // mounts MarketingModule, so lead tracking, clients and campaign/budget data can't reach it.
    if (user.role === 'marketing' && user.marketingRole === 'Graphics Designer')
      return (
        <DesignerModule
          me={user.name}
          data={designerData}
          actions={designerActions}
          initialView={activeEntry ? activeKey : 'overview'}
          openId={intent?.marketingPreset}
          onRouteChange={(navKey, openId) => handleNavigate(navKey, openId ? { marketingPreset: openId } : undefined)}
        />
      );
    // Marketing only ever renders pages from its own (sub-role) nav — any other key falls back
    // to the dashboard, so no branch page can be reached from a Marketing session.
    if (user.role === 'marketing')
      return (
        <MarketingModule
          activeKey={activeEntry && MARKETING_PAGES[activeKey] ? activeKey : 'overview'}
          me={user.name}
          role={user.marketingRole}
          store={marketing}
          setStore={setMarketing}
          tracks={marketingTracks}
          branches={branchNames}
          contributorsByBranch={contributorsByBranch}
          team={marketingTeam}
          onPushToBranch={handleMarketingPush}
          onPushToCityPool={handleMarketingPushToCityPool}
          onContentRequest={handleContentRequest}
          onPingBranch={handleMarketingPing}
          onTaskAssigned={handleTaskAssigned}
          onTaskDone={handleTaskDone}
          onNavigate={handleNavigate}
          preset={intent?.marketingPreset}
        />
      );
    // Super Admin Command Center — dashboard, Excel views, reports, search and system admin.
    if (isSuperAdmin && ADMIN_NAV_KEYS.includes(activeKey))
      return (
        <AdminModule
          sources={commandSources}
          filters={adminFilters}
          setFilters={setAdminFilters}
          me={user.name}
          navKey={activeKey}
          startPath={intent?.adminPath}
          onRouteChange={(navKey, path) => handleNavigate(navKey, { adminPath: path })}
          onNavigateApp={handleNavigate}
          onOverrideTask={handleOverrideTask}
          onAddPrice={handleAddServicePrice}
        />
      );
    if (isSuperAdmin && SA_SCAFFOLDS[activeKey])
      return <ScaffoldPage title={activeItem?.label ?? ''} section="Super Admin" info={SA_SCAFFOLDS[activeKey]} />;
    if (activeKey === 'overview') {
      if (user.role === 'branch_manager')
        return (
          <BranchManagerOverview
            branch={user.branch}
            students={branchStudents}
            counselorStudents={branchCounselorStudents}
            applications={branchApplications}
            counselors={branchCounselors}
            staff={staff}
            notifications={notifications}
            onNavigate={handleNavigate}
          />
        );
      if (user.role === 'receptionist')
        return (
          <ReceptionistOverview
            students={branchStudents}
            upcomingConsultations={upcomingConsultations}
            counselors={branchCounselors}
            onNavigate={handleNavigate}
          />
        );
      if (user.role === 'counselor')
        return (
          <CounselorOverview
            counselorName={user.name}
            counselorStudents={counselorStudents}
            applications={applications}
            lastLoginAt={lastLoginAt}
            marketingRequests={assignedContentRequests(marketing, user.name, (n) => staff.find((s) => s.name === n)?.marketingRole ?? 'Marketing')}
            onNavigate={handleNavigate}
          />
        );
      if (user.role === 'application_officer')
        return <ApplicationOfficerOverview branch={user.branch} applications={applications} onNavigate={handleNavigate} />;
      return <OverviewPage upcomingConsultations={upcomingConsultations} onNavigate={handleNavigate} />;
    }
    if (activeKey === 'branches')
      return (
        <AllBranches
          branches={branches}
          staff={staff}
          students={students}
          applications={applications}
          onAddBranch={handleAddBranch}
          onDeleteBranch={handleDeleteBranch}
          intent={intent}
        />
      );
    if (activeKey === 'new-intake')
      return <NewIntakeForm embedded onSubmit={handleAddStudent} />;
    if (activeKey === 'students' && user.role === 'branch_manager')
      return (
        <LeadVisitorManagement
          clients={
            <StudentList
              students={branchStudents}
              applications={branchApplications}
              counselors={branchCounselors}
              counselorStudents={counselorStudents}
              onAssign={handleAssign}
              intent={intent}
            />
          }
          visitors={<VisitorsPage students={branchStudents} counselorStudents={counselorStudents} onLogRevisit={handleLogRevisit} />}
          addLead={<NewIntakeForm embedded onSubmit={handleAddStudent} />}
        />
      );
    if (activeKey === 'visa-approved')
      return (
        <VisaApprovedPage
          applications={stageScopedApplications}
          partners={partners}
          currentUser={user}
          onUpdateApplication={handleUpdateApplication}
          intent={intent}
        />
      );
    if (activeKey === 'smart-match')
      return <SmartClientMatching clients={myCounselorStudents} applications={applications} />;
    // Branch Manager Dashboard — today's routing hub; every figure opens the page behind it.
    if (activeKey === 'bm-dashboard' && user.role === 'branch_manager')
      return (
        <BranchDashboard
          managerName={user.name}
          onNavigateApp={handleNavigate}
          sources={{
            branch: user.branch,
            intakes: branchStudents,
            consultations: branchCounselorStudents,
            applications: branchApplications,
            staff: branchStaff,
            tasks: tasks.filter((t) => t.branch === user.branch),
            attendance: attendance.filter((r) => r.branch === user.branch),
            leave: leave.filter((l) => l.branch === user.branch),
            corrections: corrections.filter((c) => c.branch === user.branch),
            dayLogs: dayLogs.filter((l) => l.branch === user.branch),
            holidays: branchHolidays,
            transactions: finTransactions.filter((t) => t.branch === user.branch),
            expenses: expenses.filter((e) => e.branch === user.branch),
            issues: issues.filter((i) => i.branch === user.branch),
            directives: marketing.contentRequests.filter((r) => r.targetBranch === user.branch),
            transfers: workspace.transfers.filter((t) => t.fromBranch === user.branch || t.toBranch === user.branch),
          }}
        />
      );
    if (activeKey === 'daily-tasks')
      return (
        <DailyTaskBoard
          key={intent?.taskDate ?? 'today'}
          initialDate={intent?.taskDate}
          tasks={tasks.filter((t) => t.branch === user.branch)}
          currentUser={user}
          staff={staff.filter((s) => s.branch === user.branch)}
          canManage={user.role === 'branch_manager'}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      );
    if (activeKey === 'front-desk-control')
      return (
        <ReceptionistOverview
          students={branchStudents}
          upcomingConsultations={branchCounselorStudents.filter((s) => s.consultationStatus !== 'Consultation Complete')}
          counselors={branchCounselors}
          // Front-desk pages live under Lead & Visitor Management for the Branch Manager.
          onNavigate={(key, navTo) =>
            handleNavigate('students', {
              ...navTo,
              clientStage: key === 'assign-counselor' ? 'New' : key === 'assigned' ? 'Assigned' : undefined,
            })
          }
        />
      );
    // Branch Hub — staff-facing side of Branch Operations Control, Issues and Communications.
    if (activeKey === 'hub-attendance')
      return (
        <TimeAttendancePage
          currentUser={user}
          records={attendance.filter((r) => r.staffName === user.name)}
          corrections={corrections.filter((c) => c.staffName === user.name)}
          leave={leave.filter((l) => l.staffName === user.name)}
          holidays={branchHolidays}
          explanations={explanations.filter((e) => e.staffName === user.name)}
          onSaveExplanation={handleSaveExplanation}
          onSaveAttendance={handleSaveAttendance}
          onAddCorrection={handleAddCorrection}
        />
      );
    if (activeKey === 'hub-helpdesk')
      return (
        <HelpDeskPage
          currentUser={user}
          issues={issues.filter((i) => i.branch === user.branch)}
          onAddIssue={handleAddIssue}
          onUpdateIssue={handleUpdateIssue}
        />
      );
    if (activeKey === 'hub-onboarding') {
      const mine = onboarding.find((c) => c.employeeName === user.name);
      if (mine)
        return (
          <MyOnboardingPage
            onbCase={mine}
            onToggle={(task) => {
              if (task.owner !== 'Employee') return;
              const at = formatSubmittedAt(new Date());
              handleUpdateOnboarding(mine.id, (c) => ({
                tasks: c.tasks.map((t) => (t.id === task.id ? { ...t, doneAt: t.doneAt ? undefined : at, doneBy: t.doneAt ? undefined : user.name } : t)),
                log: [...c.log, { id: `l-${Date.now()}`, at, by: user.name, text: `${task.doneAt ? 'reopened' : 'completed'} “${task.label}”` }],
              }));
            }}
          />
        );
    }
    // HRM → Attendance: five views over the same records, corrections and leave.
    const ATTENDANCE_VIEWS: Record<string, typeof AttendanceDashboard> = {
      'hr-attendance': AttendanceDashboard,
      'hr-att-today': TodaysAttendance,
      'hr-att-history': AttendanceHistory,
      'hr-att-corrections': CorrectionRequests,
      'hr-att-employee': EmployeeAttendance,
    };
    // Front Desk — record payments and view their own receipts (no edit / void / refund / discount).
    if (activeKey === 'fd-payments') return <FrontDeskPaymentsPage currentUser={user} />;
    // Manager Approval Center — one decision inbox over Leave, Attendance corrections, Finance
    // (discounts, refunds) and Expense claims; decisions are written back to each module.
    if (activeKey === 'approvals')
      return (
        <ManagerApprovalCenter
          currentUser={user}
          leave={leave.filter((l) => l.branch === user.branch)}
          corrections={corrections.filter((c) => c.branch === user.branch)}
          attendance={attendance.filter((r) => r.branch === user.branch)}
          transactions={finTransactions.filter((t) => t.branch === user.branch)}
          expenses={expenses.filter((e) => e.branch === user.branch)}
          holidays={branchHolidays}
          transfers={workspace.transfers.filter((t) => t.fromBranch === user.branch)}
          onDecideTransfer={workspaceActions.decideTransfer}
          onUpdateLeave={handleUpdateLeave}
          onUpdateCorrection={handleUpdateCorrection}
          onSaveAttendance={handleSaveAttendance}
          onSaveTransaction={handleSaveFinTransaction}
          onSaveExpense={handleSaveExpense}
          onNavigate={handleNavigate}
        />
      );
    // Financial Management — each sidebar sub-tab opens the finance module on its own route.
    if (FIN_NAV_KEYS.includes(activeKey))
      return (
        <FinanceModule
          currentUser={user}
          transactions={finTransactions.filter((t) => t.branch === user.branch)}
          onSave={handleSaveFinTransaction}
          initialView={activeKey}
          onRouteChange={(navKey) => handleNavigate(navKey)}
        />
      );
    if (activeKey === 'hr-dashboard')
      return (
        <HrDashboardPage
          staff={staff.filter((s) => s.branch === user.branch)}
          attendance={attendance.filter((r) => r.branch === user.branch)}
          corrections={corrections.filter((c) => c.branch === user.branch)}
          explanations={explanations.filter((e) => e.branch === user.branch)}
          leave={leave.filter((l) => l.branch === user.branch)}
          holidays={branchHolidays}
          onboarding={onboarding.filter((c) => c.branch === user.branch)}
          offboarding={offboarding.filter((c) => c.branch === user.branch)}
          runs={payrollRuns.filter((r) => r.branch === user.branch)}
          sources={{
            counselorStudents: branchCounselorStudents,
            applications: branchApplications,
            tasks: tasks.filter((t) => t.branch === user.branch),
            issues: issues.filter((i) => i.branch === user.branch),
          }}
          onNavigate={handleNavigate}
        />
      );
    if (activeKey === 'hr-reports')
      return (
        // Scoped to the manager's own branch — no other branch's staff, leave or payroll data.
        <HrReportsPage
          currentUser={user}
          staff={staff.filter((s) => s.branch === user.branch)}
          joinDates={Object.fromEntries(staff.filter((s) => s.joinDate).map((s) => [s.name, s.joinDate!]))}
          onboarding={onboarding.filter((c) => c.branch === user.branch)}
          attendance={attendance.filter((r) => r.branch === user.branch)}
          leave={leave.filter((l) => l.branch === user.branch)}
          holidays={branchHolidays}
          profiles={payProfiles.filter((p) => p.branch === user.branch)}
          runs={payrollRuns.filter((r) => r.branch === user.branch)}
        />
      );
    if (activeKey === 'hr-payroll')
      return (
        <PayrollInputsPage
          currentUser={user}
          staff={staff.filter((s) => s.branch === user.branch)}
          profiles={payProfiles.filter((p) => p.branch === user.branch)}
          runs={payrollRuns.filter((r) => r.branch === user.branch)}
          attendance={attendance.filter((r) => r.branch === user.branch)}
          leave={leave.filter((l) => l.branch === user.branch)}
          holidays={branchHolidays}
          onSaveProfile={handleSavePayProfile}
          onSaveRun={handleSavePayrollRun}
        />
      );
    if (activeKey === 'hr-performance')
      return (
        <PerformancePage
          currentUser={user}
          staff={staff.filter((s) => s.branch === user.branch)}
          sources={{
            counselorStudents: branchCounselorStudents,
            students: branchStudents,
            applications: branchApplications,
            communications,
            tasks: tasks.filter((t) => t.branch === user.branch),
          }}
          reviews={reviews.filter((r) => r.branch === user.branch)}
          onboarding={onboarding.filter((c) => c.branch === user.branch)}
          onSaveReview={handleSaveReview}
        />
      );
    if (activeKey === 'hr-holidays' || activeKey === 'hub-holidays')
      return (
        <HolidaysPage
          currentUser={user}
          mode={activeKey === 'hr-holidays' ? 'manager' : 'employee'}
          holidays={holidays}
          branches={branchNames}
          onSave={handleSaveHoliday}
          onRemove={handleRemoveHoliday}
        />
      );
    if (activeKey === 'hr-leave' || activeKey === 'hub-leave')
      return (
        <LeaveManagementPage
          currentUser={user}
          mode={activeKey === 'hr-leave' ? 'manager' : 'employee'}
          staff={staff.filter((s) => s.branch === user.branch)}
          leave={leave.filter((l) => l.branch === user.branch)}
          holidays={branchHolidays}
          onAddLeave={handleAddLeave}
          onUpdateLeave={handleUpdateLeave}
          onNavigate={handleNavigate}
        />
      );
    if (activeKey === 'hr-att-late')
      return (
        <LateAbsencePage
          currentUser={user}
          staff={staff.filter((s) => s.branch === user.branch)}
          attendance={attendance.filter((r) => r.branch === user.branch)}
          corrections={corrections.filter((c) => c.branch === user.branch)}
          leave={leave.filter((l) => l.branch === user.branch)}
          holidays={branchHolidays}
          explanations={explanations.filter((e) => e.branch === user.branch)}
          onSaveExplanation={handleSaveExplanation}
          intent={intent}
          onSaveAttendance={handleSaveAttendance}
          onAddCorrection={handleAddCorrection}
          onUpdateCorrection={handleUpdateCorrection}
          onNavigate={handleNavigate}
        />
      );
    if (ATTENDANCE_VIEWS[activeKey]) {
      const View = ATTENDANCE_VIEWS[activeKey];
      return (
        <View
          currentUser={user}
          staff={staff.filter((s) => s.branch === user.branch)}
          attendance={attendance.filter((r) => r.branch === user.branch)}
          corrections={corrections.filter((c) => c.branch === user.branch)}
          leave={leave.filter((l) => l.branch === user.branch)}
          holidays={branchHolidays}
          intent={intent}
          onSaveAttendance={handleSaveAttendance}
          onAddCorrection={handleAddCorrection}
          onUpdateCorrection={handleUpdateCorrection}
          onNavigate={handleNavigate}
        />
      );
    }
    if (activeKey === 'hr-onboarding')
      return (
        <OnboardingOffboardingPage
          currentUser={user}
          staff={staff.filter((s) => s.branch === user.branch)}
          onboarding={onboarding.filter((c) => c.branch === user.branch)}
          offboarding={offboarding.filter((c) => c.branch === user.branch)}
          sources={{
            counselorStudents: branchCounselorStudents,
            applications: branchApplications,
            tasks: tasks.filter((t) => t.branch === user.branch),
            issues: issues.filter((i) => i.branch === user.branch),
          }}
          onAddOnboarding={(c) => {
            setOnboarding((prev) => [c, ...prev]);
            insertOnboardingCase(c).catch((err) => console.error('Failed to insert onboarding case in Supabase', err));
          }}
          onUpdateOnboarding={handleUpdateOnboarding}
          onAddOffboarding={(c) => {
            setOffboarding((prev) => [c, ...prev]);
            insertOffboardingCase(c).catch((err) => console.error('Failed to insert offboarding case in Supabase', err));
          }}
          onUpdateOffboarding={handleUpdateOffboarding}
          onCreateAccount={(c) => {
            if (staff.some((s) => s.name === c.employeeName && s.branch === c.branch)) return;
            handleAddStaff({ id: `st${Date.now()}`, name: c.employeeName, email: c.email, role: c.role, status: 'Active', branch: c.branch }, 'Test12345')
              .catch((err) => console.error('Failed to create staff account from onboarding', err));
          }}
          // Never delete: the leaver stays on record as Inactive so client history keeps its author.
          onMarkInactive={(name) => {
            const member = staff.find((s) => s.name === name && s.branch === user.branch);
            if (member) handleUpdateStaff(member.id, { status: 'Inactive' });
          }}
          onUpdateCounselorStudent={handleUpdateCounselorStudent}
          onUpdateApplication={handleUpdateApplication}
          onUpdateTask={handleUpdateTask}
          onUpdateIssue={handleUpdateIssue}
        />
      );
    if (activeKey === 'hub-noticeboard')
      return (
        <BranchCommunicationCenter
          notices={notices.filter((n) => n.branch === user.branch)}
          currentUser={user}
          staff={staff.filter((s) => s.branch === user.branch)}
          tasks={tasks.filter((t) => t.branch === user.branch)}
          onAddNotice={handleAddNotice}
          onUpdateNotice={handleUpdateNotice}
          onAddTask={handleAddTask}
          onOpenTaskBoard={(date) => handleNavigate('daily-tasks', { taskDate: date })}
        />
      );
    if (activeKey === 'branch-attendance') {
      const today = dateKey(new Date());
      return (
        <BranchOperationsControl
          currentUser={user}
          staff={staff.filter((s) => s.branch === user.branch)}
          attendance={attendance.filter((r) => r.branch === user.branch)}
          corrections={corrections.filter((c) => c.branch === user.branch)}
          dayLogs={dayLogs.filter((l) => l.branch === user.branch)}
          leave={leave.filter((l) => l.branch === user.branch)}
          holidays={branchHolidays}
          issues={issues.filter((i) => i.branch === user.branch)}
          tasks={tasks.filter((t) => t.branch === user.branch)}
          clientFollowUpsDue={branchCounselorStudents.filter((s) => s.consultationStatus === 'Follow Up' && !!s.followUpDate && s.followUpDate <= today).length}
          onSaveAttendance={handleSaveAttendance}
          onAddCorrection={handleAddCorrection}
          onUpdateCorrection={handleUpdateCorrection}
          onSaveDayLog={handleSaveDayLog}
          onAddIssue={handleAddIssue}
          onAddTask={handleAddTask}
          onNavigate={handleNavigate}
        />
      );
    }
    if (activeKey === 'issues-escalations')
      return (
        <IssueEscalationCenter
          key={intent?.openIssueId ?? 'list'}
          initialIssueId={intent?.openIssueId}
          issues={issues.filter((i) => i.branch === user.branch)}
          currentUser={user}
          staff={staff.filter((s) => s.branch === user.branch)}
          onAddIssue={handleAddIssue}
          onUpdateIssue={handleUpdateIssue}
        />
      );
    if (activeKey === 'branch-communication')
      return (
        <BranchCommunicationCenter
          notices={notices.filter((n) => n.branch === user.branch)}
          currentUser={user}
          staff={staff.filter((s) => s.branch === user.branch)}
          tasks={tasks.filter((t) => t.branch === user.branch)}
          onAddNotice={handleAddNotice}
          onUpdateNotice={handleUpdateNotice}
          onAddTask={handleAddTask}
          onOpenTaskBoard={(date) => handleNavigate('daily-tasks', { taskDate: date })}
        />
      );
    if (activeKey === 'bm-commissions') return <ComingSoon pageName="Commission Section" />;
    if (BM_SCAFFOLDS[activeKey])
      return <ScaffoldPage title={activeItem?.label ?? ''} section={activeEntry?.ancestors.map((a) => a.label).join(' · ')} info={BM_SCAFFOLDS[activeKey]} />;
    if (activeKey === 'students')
      return (
        <StudentList
          students={branchStudents}
          applications={branchApplications}
          counselors={branchCounselors}
          counselorStudents={counselorStudents}
          onAssign={handleAssign}
          branches={branchNames}
          showBranchFilter={isSuperAdmin}
          intent={intent}
        />
      );
    if (activeKey === 'assign-counselor')
      return <AssignCounselorPage students={branchStudents} counselors={branchCounselors} onAssign={handleAssign} />;
    if (activeKey === 'assigned')
      return <AssignedClientsPage counselorStudents={branchCounselorStudents} intent={intent} />;
    if (activeKey === 'visitors')
      return <VisitorsPage students={branchStudents} counselorStudents={counselorStudents} onLogRevisit={handleLogRevisit} />;
    if (activeKey === 'partners')
      return (
        <PartnersPage
          partners={partners}
          onAddPartner={handleAddPartner}
          onUpdatePartner={handleUpdatePartner}
          onDeletePartner={handleDeletePartner}
        />
      );
    // Branch Manager Workspace — Marketing, Client Transfers and IT/Task Oversight as one routed module.
    if (WORKSPACE_NAV_KEYS.includes(activeKey) && user.role === 'branch_manager')
      return (
        <ManagerWorkspace
          navKey={activeKey}
          startPath={intent?.workspacePath}
          onSectionChange={(navKey, path) => handleNavigate(navKey, { workspacePath: path })}
          onNavigateApp={handleNavigate}
          actions={workspaceActions}
          data={{
            branch: user.branch,
            me: user.name,
            intakes: branchStudents,
            consultations: branchCounselorStudents,
            applications: branchApplications,
            transactions: finTransactions.filter((t) => t.branch === user.branch),
            staff: branchStaff,
            tasks: tasks.filter((t) => t.branch === user.branch),
            directives: marketing.contentRequests.filter((r) => r.targetBranch === user.branch),
            store: {
              contentRequests: workspace.contentRequests.filter((r) => r.branch === user.branch),
              supportRequests: workspace.supportRequests.filter((r) => r.branch === user.branch),
              itTickets: workspace.itTickets.filter((t) => t.branch === user.branch),
              transfers: workspace.transfers.filter((t) => t.fromBranch === user.branch || t.toBranch === user.branch),
            },
            candidates: transferCandidates(counselorStudents, students, staff, user.branch),
          }}
        />
      );
    // Marketing inbox — counselors and the Front Desk only ever get the requests addressed to them.
    if ((activeKey === 'co-marketing' && user.role === 'counselor') || (activeKey === 'fd-marketing' && user.role === 'receptionist'))
      return (
        <CounselorMarketing
          variant={user.role === 'receptionist' ? 'frontDesk' : 'counselor'}
          me={user.name}
          requests={assignedContentRequests(marketing, user.name, (n) => staff.find((s) => s.name === n)?.marketingRole ?? 'Marketing')}
          onSubmit={handleBranchContentSubmit}
        />
      );
    // City-Wide Lead Pool — leads Marketing routed to the whole city instead of one branch.
    if (activeKey === 'co-city-pool' && user.role === 'counselor')
      return myCity
        ? <CityLeadPool city={myCity} me={{ name: user.name, branch: user.branch }} leads={cityPoolLeads} onClaim={handleClaimCityPoolLead} />
        : <p className="text-sm text-gray-500">Your branch has no city set yet — ask a Super Admin to fill in its location in Branch Management.</p>;
    if (activeKey === 'my-students')
      return (
        <CounselorClientsPage
          clients={myCounselorStudents}
          onUpdateClient={handleUpdateCounselorStudent}
          intent={intent}
          handoverCounselors={staff.filter((s) => s.role === 'Counselor' && s.status === 'Active' && s.branch === user.branch && s.name !== user.name).map((s) => s.name)}
          onHandover={user.role === 'counselor' ? handleHandoverClient : undefined}
        />
      );
    if (activeKey === 'consultations')
      return (
        <ConsultationsPage
          students={myCounselorStudents}
          applications={applications}
          partners={partners}
          currentUser={user}
          onUpdateStudent={handleUpdateCounselorStudent}
          onUpdateApplication={handleUpdateApplication}
          intent={intent}
        />
      );
    if (activeKey === 'follow-ups')
      return (
        <FollowUpsPage
          students={myCounselorStudents}
          onUpdateStudent={handleUpdateCounselorStudent}
          intent={intent}
        />
      );
    if (activeKey === 'archive')
      return <ArchivePage students={myCounselorStudents} onUpdateStudent={handleUpdateCounselorStudent} />;
    if (activeKey === 'applications')
      return (
        <ApplicationsList
          applications={branchApplications}
          onUpdateApplication={handleUpdateApplication}
          branches={branchNames}
          showBranchFilter={isSuperAdmin}
          partners={partners}
          currentUser={user}
          intent={intent}
        />
      );
    if (activeKey === 'enrolled-queue')
      return (
        <EnrolledQueuePage
          applications={branchApplications}
          partners={partners}
          currentUser={user}
          onUpdateApplication={handleUpdateApplication}
        />
      );
    if (activeKey === 'offer-applications')
      return (
        <ApplicationsList
          applications={stageScopedApplications}
          onUpdateApplication={handleUpdateApplication}
          partners={partners}
          currentUser={user}
          stageScope="Offer"
          excludePendingOffers={user.role === 'application_officer'}
          intent={intent}
        />
      );
    if (activeKey === 'visa-applications')
      return (
        <ApplicationsList
          applications={stageScopedApplications}
          onUpdateApplication={handleUpdateApplication}
          partners={partners}
          currentUser={user}
          stageScope="Visa"
          intent={intent}
        />
      );
    if (activeKey === 'commissions')
      return (
        <CommissionsPage
          commissions={commissions}
          partners={partners}
          onUpdateCommission={handleUpdateCommission}
        />
      );
    if (activeKey === 'staff')
      return (
        <StaffManagement
          staff={branchStaff}
          onAddStaff={handleAddStaff}
          onUpdateStaff={handleUpdateStaff}
          onRemoveStaff={handleRemoveStaff}
          branches={branchNames}
          showBranchFilter={isSuperAdmin}
          currentUserEmail={user.email}
          counselorStudents={branchCounselorStudents}
          applications={branchApplications}
          showActivity={user.role === 'branch_manager'}
          partners={partners}
          currentUser={user}
          onUpdateApplication={handleUpdateApplication}
          intent={intent}
        />
      );
    return <ComingSoon pageName={activeItem?.label || 'This page'} />;
  };

  return (
    <CurrentUserContext.Provider value={user}>
      <CommunicationsContext.Provider value={communicationsValue}>
      <FinanceLedgerContext.Provider value={financeLedgerValue}>
      <DashboardShell
        user={user}
        navItems={navItems}
        activeKey={activeKey}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        leads={students}
        onAcceptLead={handleAcceptLead}
        headerSearch={user.role === 'super_admin'
          ? <HeaderSearch onSearch={(q) => handleNavigate('sa-search', { adminPath: `/admin/search?q=${encodeURIComponent(q)}` })} />
          : undefined}
      >
        <div key={`${activeKey}-${navSeq}`} className="dissolve-in">{renderPage()}</div>
      </DashboardShell>
      {saveError && (
        <div className="dissolve-in fixed bottom-4 right-4 z-[100] flex max-w-sm items-start gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm text-white shadow-lg">
          <p className="flex-1">{saveError}</p>
          <button type="button" onClick={() => setSaveError(null)} aria-label="Dismiss" className="-mr-1 -mt-0.5 text-white/80 hover:text-white">×</button>
        </div>
      )}
      </FinanceLedgerContext.Provider>
      </CommunicationsContext.Provider>
    </CurrentUserContext.Provider>
  );
}
