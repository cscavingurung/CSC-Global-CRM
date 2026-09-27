import { Role, NavConfig, NavItem, StaffRole } from './types';

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  marketing: 'Marketing',
  branch_manager: 'Branch Manager',
  receptionist: 'Front Desk Officer',
  counselor: 'Counselor',
  application_officer: 'V/A Officer',
};

// Soft-tinted author-role badge on Branch Staff Notes — one distinct tint per role, never
// a solid fill, matching the rest of the app's badge styling.
export const ROLE_BADGE_STYLES: Record<Role, string> = {
  super_admin: 'bg-navy/10 text-navy',
  marketing: 'bg-pink-100 text-pink-700',
  branch_manager: 'bg-purple-100 text-purple-700',
  receptionist: 'bg-orange-100 text-orange-700',
  counselor: 'bg-blue-100 text-blue-700',
  application_officer: 'bg-teal-100 text-teal-700',
};

// Maps a `staff` table row's role (Title Case, as entered in Staff Management) to the
// app's internal `Role` (snake_case, used for nav/permissions) — used by Login to build a
// `MockUser` from the `StaffMember` a credential check matches.
export const STAFF_ROLE_TO_ROLE: Record<StaffRole, Role> = {
  'Super Admin': 'super_admin',
  Marketing: 'marketing',
  'Branch Manager': 'branch_manager',
  'Front Desk Officer': 'receptionist',
  Counselor: 'counselor',
  'V/A Officer': 'application_officer',
};

// Counselors, V/A Officers and Front Desk share a "Branch Hub" with the staff-facing side of
// Branch Operations Control (attendance), Issue & Escalation Management (Help Desk) and the
// Branch Communication Center (Noticeboard).
export const NAV_CONFIG: NavConfig = {
  // Super Admin Command Center — 21 master links. Dashboard, Leads, Visa, Finance, Approvals,
  // Tasks, Issues, Reports, Global Search and System Administration open the routed Command Center
  // (components/admin); Branches, People, Clients, Applications and Partners keep their pages.
  super_admin: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    { key: 'sa-organization', label: 'Organization', icon: 'Network' },
    { key: 'branches', label: 'Branches', icon: 'Building2' },
    { key: 'staff', label: 'People', icon: 'Users' },
    { key: 'sa-leads', label: 'Leads', icon: 'Target' },
    { key: 'students', label: 'Clients', icon: 'GraduationCap' },
    { key: 'applications', label: 'Applications', icon: 'FileText' },
    { key: 'sa-visa', label: 'Visa', icon: 'Plane' },
    { key: 'sa-finance', label: 'Finance', icon: 'Wallet' },
    { key: 'sa-marketing', label: 'Marketing', icon: 'Megaphone' },
    { key: 'sa-operations', label: 'Operations', icon: 'Briefcase' },
    { key: 'sa-hrm', label: 'HRM', icon: 'UserCheck' },
    { key: 'partners', label: 'Partners/Institutions', icon: 'Landmark' },
    { key: 'sa-approvals', label: 'Approvals', icon: 'ClipboardCheck' },
    { key: 'sa-tasks', label: 'Tasks', icon: 'ListChecks' },
    { key: 'sa-issues', label: 'Issues', icon: 'AlertTriangle' },
    { key: 'sa-communications', label: 'Communications', icon: 'MessagesSquare' },
    { key: 'reports', label: 'Reports & Analytics', icon: 'BarChart3' },
    { key: 'sa-notifications', label: 'Notifications', icon: 'Bell' },
    { key: 'sa-search', label: 'Global Search', icon: 'Search' },
    { key: 'sa-system', label: 'System Administration', icon: 'Settings' },
  ],

  // Marketing Department — one nav for every marketing sub-role; the Dashboard renders a
  // different layout per sub-role. Deliberately no HR, attendance, payroll, expense or
  // Branch Hub entries: the department's data boundary starts at the sidebar.
  marketing: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    {
      key: 'mkt-leads', label: 'Leads', icon: 'Target', children: [
        { key: 'mkt-inbox', label: 'Inbox', icon: 'Inbox' },
        { key: 'ls-add-lead', label: 'Add Lead', icon: 'UserPlus' },
        { key: 'mkt-qualification', label: 'Qualification', icon: 'Filter' },
        { key: 'mkt-assignment', label: 'Assignment', icon: 'Send' },
        { key: 'mkt-monitoring', label: 'Lead Monitoring', icon: 'Activity', viewOnly: true },
        { key: 'ls-followups', label: 'Follow-up Status', icon: 'AlertTriangle' },
      ],
    },
    {
      key: 'mkt-content', label: 'Content', icon: 'Palette', children: [
        { key: 'mkt-calendar', label: 'Content Calendar', icon: 'CalendarDays' },
        { key: 'mkt-requests', label: 'Content Requests', icon: 'ClipboardList' },
        { key: 'mkt-production', label: 'Production Queue', icon: 'SquareKanban' },
        { key: 'mkt-library', label: 'Content Library', icon: 'FolderOpen' },
      ],
    },
    {
      key: 'mkt-campaigns', label: 'Campaigns', icon: 'Megaphone', children: [
        { key: 'mkt-campaign-list', label: 'Campaigns', icon: 'Megaphone' },
        { key: 'mkt-advertising', label: 'Advertising', icon: 'Wallet' },
        { key: 'mkt-performance', label: 'Campaign Performance', icon: 'TrendingUp', viewOnly: true },
      ],
    },
    {
      key: 'mkt-social', label: 'Social Media', icon: 'Share2', children: [
        { key: 'mkt-scheduled', label: 'Scheduled Posts', icon: 'CalendarClock' },
        { key: 'mkt-published', label: 'Published Posts', icon: 'CheckCircle2' },
      ],
    },
    {
      key: 'mkt-seo', label: 'SEO', icon: 'Globe', children: [
        { key: 'mkt-seo-dashboard', label: 'SEO Dashboard', icon: 'Search' },
        { key: 'mkt-seo-tasks', label: 'SEO Tasks', icon: 'ListChecks' },
      ],
    },
    {
      key: 'mkt-reports', label: 'Reports', icon: 'BarChart3', children: [
        { key: 'mkt-report-leads', label: 'Lead Reports', icon: 'BarChart3', viewOnly: true },
        { key: 'mkt-report-campaigns', label: 'Campaign Reports', icon: 'TrendingUp', viewOnly: true },
        { key: 'mkt-report-branches', label: 'Branch Conversion', icon: 'Building2', viewOnly: true },
      ],
    },
  ],
  // Two-tier navigation: each Main Tab reveals its Sub-tabs. Sub-tab keys reuse the existing
  // page keys where a real page already exists (overview, students, applications, staff) so
  // dashboard redirects and notification links keep working.
  branch_manager: [
    { key: 'bm-dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    {
      key: 'ops', label: 'Operation Management', icon: 'Briefcase',
      children: [
        { key: 'overview', label: 'Branch Dashboard', icon: 'LayoutDashboard' },
        { key: 'daily-tasks', label: 'Daily Task Board', icon: 'ListChecks' },
        { key: 'students', label: 'Lead & Visitor Management', icon: 'GraduationCap' },
        { key: 'front-desk-control', label: 'Front Desk Control Center', icon: 'MonitorCheck' },
        { key: 'applications', label: 'Application Operations Monitor', icon: 'FileText' },
        { key: 'branch-communication', label: 'Branch Communication Center', icon: 'Megaphone' },
        { key: 'issues-escalations', label: 'Issue & Escalation Management', icon: 'AlertTriangle' },
        { key: 'branch-attendance', label: 'Branch Operations Control', icon: 'DoorOpen' },
      ],
    },
    {
      key: 'hrm', label: 'HRM', icon: 'Users',
      children: [
        { key: 'hr-dashboard', label: 'HR Dashboard', icon: 'LayoutDashboard' },
        { key: 'staff', label: 'Employees', icon: 'Users' },
        { key: 'hr-onboarding', label: 'Employee Onboarding & Offboarding', icon: 'UserPlus' },
        {
          key: 'hr-attendance-group', label: 'Attendance', icon: 'Clock',
          children: [
            { key: 'hr-attendance', label: 'Attendance Dashboard', icon: 'LayoutDashboard' },
            { key: 'hr-att-today', label: 'Today’s Attendance', icon: 'Clock' },
            { key: 'hr-att-history', label: 'Attendance History', icon: 'CalendarDays' },
            { key: 'hr-att-late', label: 'Late & Absence', icon: 'AlertTriangle' },
            { key: 'hr-att-corrections', label: 'Correction Requests', icon: 'ClipboardCheck' },
            { key: 'hr-att-employee', label: 'Employee Attendance', icon: 'UserCheck' },
          ],
        },
        { key: 'hr-leave', label: 'Leave Management', icon: 'CalendarDays' },
        { key: 'hr-holidays', label: 'Holidays', icon: 'CalendarDays' },
        { key: 'hr-performance', label: 'Performance', icon: 'BarChart3' },
        { key: 'hr-payroll', label: 'Payroll Inputs', icon: 'Wallet' },
        { key: 'hr-reports', label: 'HR Reports', icon: 'BarChart3' },
      ],
    },
    {
      // Each sub-tab opens the matching nested route of the finance module (components/finance).
      key: 'fin', label: 'Financial Management', icon: 'Wallet',
      children: [
        { key: 'fin-dashboard', label: 'Branch Financial Dashboard', icon: 'BarChart3' },
        { key: 'fin-collections', label: 'Daily Collection Register', icon: 'FileText' },
        { key: 'fin-receipts', label: 'Automated Receipt Generation', icon: 'FileCheck' },
        { key: 'fin-outstanding', label: 'Outstanding Payment Dashboard', icon: 'Clock' },
        { key: 'fin-payment-plans', label: 'Client Payment Plans', icon: 'CalendarDays' },
        { key: 'fin-revenue-counselor', label: 'Revenue by Counselor', icon: 'DollarSign' },
        { key: 'fin-refunds', label: 'Refund Management', icon: 'RefreshCw' },
        { key: 'fin-discounts', label: 'Discount Control', icon: 'Percent' },
      ],
    },
    // Branch Manager Workspace — one routed module (components/manager); each tab opens its section.
    { key: 'bm-marketing', label: 'Marketing', icon: 'Megaphone' },
    { key: 'bm-transfers', label: 'Client Transfers', icon: 'ArrowRightLeft' },
    { key: 'bm-operations', label: 'IT Support & Task Oversight', icon: 'LifeBuoy' },
    { key: 'approvals', label: 'Manager Approval Center', icon: 'ClipboardCheck' },
    { key: 'bm-commissions', label: 'Commission Section', icon: 'DollarSign' },
  ],
  receptionist: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    { key: 'new-intake', label: 'Add New Lead', icon: 'UserPlus' },
    { key: 'assign-counselor', label: 'Assign Counselor', icon: 'UserCheck' },
    { key: 'assigned', label: 'Assigned Clients', icon: 'Users' },
    { key: 'students', label: 'Clients', icon: 'GraduationCap' },
    { key: 'visitors', label: 'Visitors', icon: 'PhoneCall' },
    { key: 'fd-payments', label: 'Payments', icon: 'Wallet' },
    { key: 'daily-tasks', label: 'Daily Tasks', icon: 'ListChecks' },
    // Content requests from Marketing (direct, or delegated by the Branch Manager).
    { key: 'fd-marketing', label: 'Marketing Requests', icon: 'Megaphone' },
    {
      key: 'branch-hub', label: 'Branch Hub', icon: 'DoorOpen',
      children: [
        { key: 'hub-attendance', label: 'Time & Attendance', icon: 'Clock' },
        { key: 'hub-leave', label: 'Leave', icon: 'CalendarDays' },
        { key: 'hub-holidays', label: 'Holidays', icon: 'CalendarDays' },
        { key: 'hub-helpdesk', label: 'Help Desk', icon: 'LifeBuoy' },
        { key: 'hub-noticeboard', label: 'Noticeboard', icon: 'Megaphone' },
      ],
    },
  ],
  counselor: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    { key: 'new-intake', label: 'Add Client', icon: 'UserPlus' },
    { key: 'my-students', label: 'Clients', icon: 'GraduationCap' },
    { key: 'consultations', label: 'Enrolled', icon: 'CalendarDays' },
    { key: 'follow-ups', label: 'Follow Ups', icon: 'PhoneCall' },
    { key: 'smart-match', label: 'Smart Client Matching', icon: 'Compass' },
    { key: 'visa-approved', label: 'Visa Approved', icon: 'BadgeCheck' },
    { key: 'archive', label: 'Archive', icon: 'Archive' },
    // Content requests from the Marketing Department (routed module: /counselor/marketing).
    { key: 'co-marketing', label: 'Marketing', icon: 'Megaphone' },
    { key: 'daily-tasks', label: 'Daily Tasks', icon: 'ListChecks' },
    {
      key: 'branch-hub', label: 'Branch Hub', icon: 'DoorOpen',
      children: [
        { key: 'hub-attendance', label: 'Time & Attendance', icon: 'Clock' },
        { key: 'hub-leave', label: 'Leave', icon: 'CalendarDays' },
        { key: 'hub-holidays', label: 'Holidays', icon: 'CalendarDays' },
        { key: 'hub-helpdesk', label: 'Help Desk', icon: 'LifeBuoy' },
        { key: 'hub-noticeboard', label: 'Noticeboard', icon: 'Megaphone' },
      ],
    },
  ],
  application_officer: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    { key: 'applications', label: 'Clients', icon: 'FileText' },
    { key: 'offer-applications', label: 'Offer Applications', icon: 'Building2' },
    { key: 'visa-applications', label: 'Visa Applications', icon: 'Stamp' },
    { key: 'daily-tasks', label: 'Daily Tasks', icon: 'ListChecks' },
    {
      key: 'branch-hub', label: 'Branch Hub', icon: 'DoorOpen',
      children: [
        { key: 'hub-attendance', label: 'Time & Attendance', icon: 'Clock' },
        { key: 'hub-leave', label: 'Leave', icon: 'CalendarDays' },
        { key: 'hub-holidays', label: 'Holidays', icon: 'CalendarDays' },
        { key: 'hub-helpdesk', label: 'Help Desk', icon: 'LifeBuoy' },
        { key: 'hub-noticeboard', label: 'Noticeboard', icon: 'Megaphone' },
      ],
    },
  ],
};

export interface NavEntry {
  item: NavItem;
  /** Closest group, or null for a top-level page. */
  parent: NavItem | null;
  /** Every group above the page, outermost first — [Main Tab, nested group, …]. */
  ancestors: NavItem[];
}

/** Every navigable page (leaf) in a role's menu, at any nesting depth, with the groups above it. */
export function flattenNav(items: NavItem[], ancestors: NavItem[] = []): NavEntry[] {
  return items.flatMap((item): NavEntry[] =>
    item.children
      ? flattenNav(item.children, [...ancestors, item])
      : [{ item, parent: ancestors[ancestors.length - 1] ?? null, ancestors }]
  );
}

export function findNavEntry(items: NavItem[], key: string): NavEntry | undefined {
  return flattenNav(items).find((entry) => entry.item.key === key);
}

/** The first page inside a group — where clicking a Main Tab lands. */
export function firstLeaf(item: NavItem): NavItem {
  return item.children?.length ? firstLeaf(item.children[0]) : item;
}

export const COUNTRIES = ['Australia', 'Canada', 'United Kingdom', 'USA', 'New Zealand'];

// A client's `country` field can hold more than one country of interest, comma-separated
// (e.g. "Canada, Australia") — this splits it back out for matching/filtering.
export function splitCountries(country: string): string[] {
  return country.split(',').map((c) => c.trim()).filter(Boolean);
}

// Intake period is picked as separate Month + Year selects (joined as "Jan 2027") rather
// than one combined dropdown — every month is offered since intake timing varies by
// institution and country, so nothing is hardcoded to fixed seasons.
export const INTAKE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// `yearsBack` lets filters (which need to match intakes already recorded in the past) reach
// further back than the picker in the Enrolment Details modal, which only offers the future.
export function generateIntakeYears(yearsAhead = 5, yearsBack = 0, from = new Date()): string[] {
  const startYear = from.getFullYear() - yearsBack;
  return Array.from({ length: yearsAhead + yearsBack }, (_, i) => String(startYear + i));
}

export const PURPOSES = ['Study', 'SOWP', 'Tourist', 'PR'];

// Leads Specialist — the Marketing Department's intake and routing workspace. Replaces the shared
// marketing nav for that sub-role: no campaigns/spend, content or finance-bearing reports.
export const LEADS_SPECIALIST_NAV: NavItem[] = [
  { key: 'overview', label: 'Leads Dashboard', icon: 'LayoutDashboard' },
  { key: 'mkt-inbox', label: 'Lead Inbox', icon: 'Inbox' },
  { key: 'ls-add-lead', label: 'Add Lead', icon: 'UserPlus' },
  { key: 'ls-my-leads', label: 'My Assigned Leads', icon: 'Send' },
  { key: 'mkt-monitoring', label: 'Lead Monitoring', icon: 'Activity', viewOnly: true },
  { key: 'ls-followups', label: 'Follow-up Status', icon: 'AlertTriangle' },
  { key: 'mkt-report-leads', label: 'Lead Reports', icon: 'BarChart3', viewOnly: true },
];

// Content Planner & Branch Coordinator — four tabs: plan, ask branches, track, look back.
export const CONTENT_PLANNER_NAV: NavItem[] = [
  { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
  { key: 'cp-calendar', label: 'Content Calendar', icon: 'CalendarDays' },
  { key: 'cp-requests', label: 'Content Requests', icon: 'ClipboardList' },
  { key: 'cp-history', label: 'Content History', icon: 'FolderOpen', viewOnly: true },
];

// Graphics Designer — a production workspace only (no leads, clients, finance, HR or budgets).
// Each tab is a nested route in DesignerModule (/marketing/designer/…); keys match DESIGNER_ROUTES.
export const DESIGNER_NAV: NavItem[] = [
  { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
  { key: 'gd-designs', label: 'Design Queue', icon: 'Palette' },
  { key: 'gd-videos', label: 'Video Editing', icon: 'Film' },
  { key: 'gd-scheduled', label: 'Scheduled Posts', icon: 'CalendarClock', viewOnly: true },
  { key: 'gd-history', label: 'Content History', icon: 'FolderOpen', viewOnly: true },
];
