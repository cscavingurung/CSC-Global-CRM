// Branch Manager Workspace — route table, the data/actions every routed page reads through the
// layout's <Outlet context>, and the sidebar ↔ route mapping.
import { useOutletContext } from 'react-router-dom';
import {
  ApplicationRecord, BranchContentRequest, ContentRequest, CounselorStudent, DailyTask, FinTransaction, IntakeStudent,
  ItTicket, MarketingSupportRequest, ManagerWorkspaceStore, NavIntent, StaffMember,
} from '../../types';
import { TransferCandidate } from '../../managerWorkspace';

/** Everything here is already scoped to the manager's branch by App.tsx — except `candidates`,
 * the identity-only projection of other branches' clients used to request a transfer in. */
export interface WorkspaceData {
  branch: string;
  me: string;
  intakes: IntakeStudent[];
  consultations: CounselorStudent[];
  applications: ApplicationRecord[];
  transactions: FinTransaction[];
  /** Branch staff (all statuses). */
  staff: StaffMember[];
  tasks: DailyTask[];
  /** Central Marketing's content requests addressed to this branch. */
  directives: ContentRequest[];
  /** Branch requests + IT tickets for this branch; transfers into or out of it. */
  store: ManagerWorkspaceStore;
  candidates: TransferCandidate[];
}

export type NewContentRequest = Pick<BranchContentRequest, 'type' | 'intake' | 'country' | 'notes' | 'neededBy'>;
export type NewSupportRequest = Pick<MarketingSupportRequest, 'kind' | 'title' | 'budget' | 'startDate' | 'endDate' | 'audience' | 'justification'>;
export type NewItTicket = Pick<ItTicket, 'category' | 'priority' | 'subject' | 'description' | 'attachments'>;

/** Every write goes through App.tsx, which re-checks role and branch before applying it. */
export interface WorkspaceActions {
  addContentRequest: (input: NewContentRequest) => void;
  cancelContentRequest: (id: string) => void;
  addSupportRequest: (input: NewSupportRequest) => void;
  delegateDirective: (id: string, to: string, internalDue: string, note: string) => void;
  handover: (clientKey: string, to: string, reason: string, handoverDate: string) => void;
  requestTransfer: (input: { clientKey: string; toCounselor: string; reason: string; visitDate: string }) => void;
  decideTransfer: (id: string, decision: 'Approved' | 'Rejected', note: string) => void;
  reassignTask: (id: string, assignee: string) => void;
  addItTicket: (input: NewItTicket) => void;
  reopenItTicket: (id: string, note: string) => void;
}

export interface WorkspaceContext {
  data: WorkspaceData;
  actions: WorkspaceActions;
  flash: (message: string) => void;
  /** Leave the workspace for another CRM page. */
  navigateApp: (key: string, intent?: NavIntent) => void;
}

export const useWorkspace = () => useOutletContext<WorkspaceContext>();

export const WORKSPACE_BASE = '/manager';

export interface WorkspaceTab {
  /** Relative to the section ('' = the section's index route). */
  path: string;
  label: string;
}

export interface WorkspaceSection {
  key: 'marketing' | 'transfers' | 'operations';
  /** Matching sidebar key. */
  navKey: string;
  title: string;
  intro: string;
  tabs: WorkspaceTab[];
}

export const WORKSPACE_SECTIONS: WorkspaceSection[] = [
  {
    key: 'marketing', navKey: 'bm-marketing', title: 'Marketing',
    intro: 'How marketing leads perform at your branch, what you’ve asked Marketing for, and what Marketing needs from your team.',
    tabs: [
      { path: '', label: 'Summary Report' },
      { path: 'clients', label: 'Marketing Clients' },
      { path: 'requests', label: 'Content & Support Requests' },
      { path: 'directives', label: 'Inbound Directives' },
    ],
  },
  {
    key: 'transfers', navKey: 'bm-transfers', title: 'Client Transfers',
    intro: 'Move clients between counselors in your branch, or between branches when a client continues elsewhere.',
    tabs: [
      { path: '', label: 'Internal Handover' },
      { path: 'inter-branch', label: 'Inter-Branch Transfers' },
    ],
  },
  {
    key: 'operations', navKey: 'bm-operations', title: 'IT Support & Task Oversight',
    intro: 'Every open task across your staff, and your IT requests to Head Office.',
    tabs: [
      { path: '', label: 'Task Oversight' },
      { path: 'it-support', label: 'IT Support' },
    ],
  },
];

export const WORKSPACE_NAV_KEYS = WORKSPACE_SECTIONS.map((s) => s.navKey);

export const sectionPath = (section: WorkspaceSection['key'], tab = '') =>
  `${WORKSPACE_BASE}/${section}${tab ? `/${tab}` : ''}`;

/** Start route for a sidebar key, or an explicit path from a NavIntent. */
export function workspaceStartPath(navKey: string, path?: string): string {
  if (path && WORKSPACE_SECTIONS.some((s) => path.startsWith(sectionPath(s.key)))) return path;
  return sectionPath(WORKSPACE_SECTIONS.find((s) => s.navKey === navKey)?.key ?? 'marketing');
}

export const sectionForPath = (pathname: string) =>
  WORKSPACE_SECTIONS.find((s) => pathname.startsWith(sectionPath(s.key))) ?? WORKSPACE_SECTIONS[0];
