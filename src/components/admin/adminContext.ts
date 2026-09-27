// Super Admin Command Center — routes, the sidebar ↔ route mapping, and the context every routed
// page reads through the layout's <Outlet context>.
import { useOutletContext } from 'react-router-dom';
import { NavIntent, ServicePrice } from '../../types';
import { BuiltRows, CommandSources, DatasetKey, GlobalFilters } from '../../superAdmin';
import { ScaffoldInfo } from '../../branchManagerPages';

export interface AdminContext {
  sources: CommandSources;
  rows: BuiltRows;
  filters: GlobalFilters;
  setFilters: (f: GlobalFilters) => void;
  me: string;
  /** Leave the module for another CRM page. */
  navigateApp: (key: string, intent?: NavIntent) => void;
  onOverrideTask: (taskId: string, status: 'To Do' | 'Done', reason: string) => void;
  /** Save a new Service Charges price version (Super Admin only — re-checked in App.tsx). */
  onAddPrice: (price: ServicePrice) => void;
  flash: (message: string) => void;
}

export const useAdmin = () => useOutletContext<AdminContext>();

export const ADMIN_BASE = '/admin';

/** Datasets with their own sidebar tab. Everything else opens under Reports & Analytics. */
const DATASET_NAV: Partial<Record<DatasetKey, string>> = {
  leads: 'sa-leads', visa: 'sa-visa', finance: 'sa-finance', approvals: 'sa-approvals', tasks: 'sa-tasks', issues: 'sa-issues',
};

/** Sidebar keys rendered by this module, and their start routes. */
export const ADMIN_NAV_ROUTES: Record<string, string> = {
  overview: ADMIN_BASE,
  reports: `${ADMIN_BASE}/reports`,
  'sa-search': `${ADMIN_BASE}/search`,
  'sa-system': `${ADMIN_BASE}/system`,
  ...Object.fromEntries(Object.entries(DATASET_NAV).map(([k, nav]) => [nav, `${ADMIN_BASE}/sheet/${k}`])),
  // Finance opens on Service Charges; its Finance Ledger tab is the finance sheet.
  'sa-finance': `${ADMIN_BASE}/finance`,
};
export const ADMIN_NAV_KEYS = Object.keys(ADMIN_NAV_ROUTES);

export const sheetPath = (key: DatasetKey, params?: Record<string, string | undefined>) => {
  const q = new URLSearchParams(Object.entries(params ?? {}).filter((e): e is [string, string] => Boolean(e[1])));
  return `${ADMIN_BASE}/sheet/${key}${q.toString() ? `?${q}` : ''}`;
};

/** Sidebar key a route belongs to. */
export function adminNavKeyFor(pathname: string): string {
  const m = pathname.match(/^\/admin\/sheet\/([a-z]+)/);
  if (m) return DATASET_NAV[m[1] as DatasetKey] ?? 'reports';
  if (pathname.startsWith(`${ADMIN_BASE}/reports`)) return 'reports';
  if (pathname.startsWith(`${ADMIN_BASE}/finance`)) return 'sa-finance';
  if (pathname.startsWith(`${ADMIN_BASE}/search`)) return 'sa-search';
  if (pathname.startsWith(`${ADMIN_BASE}/system`)) return 'sa-system';
  return 'overview';
}

export function adminStartPath(navKey: string, path?: string): string {
  if (path && path.startsWith(ADMIN_BASE)) return path;
  return ADMIN_NAV_ROUTES[navKey] ?? ADMIN_BASE;
}

/** Sidebar sections still being built — shown as a planned-features page. */
export const SA_SCAFFOLDS: Record<string, ScaffoldInfo> = {
  'sa-organization': {
    description: 'Company structure — legal entity, departments, reporting lines and branch hierarchy.',
    features: ['Company profile & registration', 'Departments and heads', 'Reporting lines', 'Branch hierarchy & regions', 'Working hours & policies'],
  },
  'sa-marketing': {
    description: 'Company-wide marketing oversight — campaigns, spend and lead flow into every branch.',
    features: ['Campaign spend vs. leads', 'Lead routing by branch', 'Content pipeline status', 'Branch marketing requests', 'Channel comparison'],
  },
  'sa-operations': {
    description: 'Day-to-day branch operations across the company.',
    features: ['Branch opening & closing checklists', 'Front desk activity', 'Visitor volumes', 'Branch handovers', 'Operational incidents'],
  },
  'sa-hrm': {
    description: 'People operations across all branches.',
    features: ['Headcount by branch & department', 'Attendance & leave overview', 'Onboarding & offboarding cases', 'Payroll inputs status', 'HR reports'],
  },
  'sa-communications': {
    description: 'Company-wide notices and communication history.',
    features: ['Company announcements', 'Branch notice read-rates', 'Client communication logs', 'Templates', 'Escalation broadcasts'],
  },
  'sa-notifications': {
    description: 'Notification rules and delivery across roles.',
    features: ['Alert rules by role', 'Escalation thresholds', 'Delivery log', 'Quiet hours', 'Email / SMS channels'],
  },
};
