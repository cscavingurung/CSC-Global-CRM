import { Role, NavConfig, StaffRole } from './types';

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  marketing: 'Marketing',
  finance: 'Finance',
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
  finance: 'bg-amber-100 text-amber-700',
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
  Finance: 'finance',
  'Branch Manager': 'branch_manager',
  'Front Desk Officer': 'receptionist',
  Counselor: 'counselor',
  'V/A Officer': 'application_officer',
};

export const NAV_CONFIG: NavConfig = {
  super_admin: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    { key: 'branches', label: 'All Branches', icon: 'Building2' },
    { key: 'students', label: 'Clients', icon: 'GraduationCap' },
    { key: 'applications', label: 'Applications', icon: 'FileText' },
    { key: 'partners', label: 'Partners', icon: 'Landmark' },
    { key: 'commissions', label: 'Commissions', icon: 'DollarSign' },
    { key: 'staff', label: 'Staff', icon: 'Users' },
    { key: 'reports', label: 'Reports', icon: 'BarChart3' },
  ],
  marketing: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    { key: 'marketing-add-lead', label: 'Add New Leads', icon: 'UserPlus' },
    { key: 'marketing-broadcast', label: 'Assign Clients', icon: 'Radar' },
    { key: 'marketing-clients', label: 'Clients', icon: 'GraduationCap', viewOnly: true },
  ],
  finance: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    { key: 'commissions', label: 'Commissions', icon: 'DollarSign' },
    { key: 'applications', label: 'Applications', icon: 'FileText', viewOnly: true },
    { key: 'reports', label: 'Reports', icon: 'BarChart3' },
  ],
  branch_manager: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    { key: 'students', label: 'Clients', icon: 'GraduationCap' },
    { key: 'new-intake', label: 'Add Client', icon: 'UserPlus' },
    { key: 'applications', label: 'Applications', icon: 'FileText' },
    { key: 'staff', label: 'Staff', icon: 'Users' },
    { key: 'reports', label: 'Reports', icon: 'BarChart3' },
  ],
  receptionist: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    { key: 'new-intake', label: 'Leads', icon: 'UserPlus' },
    { key: 'assign-counselor', label: 'Assign Counselor', icon: 'UserCheck' },
    { key: 'assigned', label: 'Assigned Clients', icon: 'Users' },
    { key: 'students', label: 'Clients', icon: 'GraduationCap' },
    { key: 'visitors', label: 'Visitors', icon: 'PhoneCall' },
  ],
  counselor: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    { key: 'my-students', label: 'Clients', icon: 'GraduationCap' },
    { key: 'new-intake', label: 'Add Client', icon: 'UserPlus' },
    { key: 'consultations', label: 'Enrolled', icon: 'CalendarDays' },
    { key: 'follow-ups', label: 'Follow Ups', icon: 'PhoneCall' },
    { key: 'offer-applications', label: 'Offer Applications', icon: 'Building2' },
    { key: 'visa-applications', label: 'Visa Applications', icon: 'Stamp' },
    { key: 'archive', label: 'Archive', icon: 'Archive' },
  ],
  application_officer: [
    { key: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
    { key: 'applications', label: 'Clients', icon: 'FileText' },
    { key: 'offer-applications', label: 'Offer Applications', icon: 'Building2' },
    { key: 'visa-applications', label: 'Visa Applications', icon: 'Stamp' },
  ],
};

export const COUNTRIES = ['Australia', 'Canada', 'United Kingdom', 'USA', 'New Zealand'];

export const PURPOSES = ['Study', 'SOWP', 'Tourist', 'PR'];
