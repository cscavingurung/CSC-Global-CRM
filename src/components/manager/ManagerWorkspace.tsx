import { useCallback, useEffect, useState } from 'react';
import { MemoryRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { NavIntent } from '../../types';
import {
  WORKSPACE_BASE, WORKSPACE_SECTIONS, WorkspaceActions, WorkspaceContext, WorkspaceData, sectionForPath, sectionPath, workspaceStartPath,
} from './workspaceContext';
import { InboundDirectives, MarketingClients, MarketingRequests, MarketingSummary } from './MarketingTab';
import { InterBranchTransfers, InternalHandover } from './TransfersTab';
import { ItSupport, TaskOversight } from './OperationsTab';

// ─── Branch Manager Workspace ───────────────────────────────────────────────
// Marketing, Client Transfers and IT/Task Oversight as nested routes under /manager, inside one
// layout (section sub-tabs + <Outlet />). Like the other routed modules, the router is a
// MemoryRouter scoped to this module: the sidebar key picks the starting section, and when a link
// inside moves to another section the module reports it so the sidebar highlight stays in step.

interface ManagerWorkspaceProps {
  data: WorkspaceData;
  actions: WorkspaceActions;
  /** Sidebar key the manager clicked (bm-marketing / bm-transfers / bm-operations). */
  navKey: string;
  /** Optional exact sub-route, e.g. from an Approval Center link. */
  startPath?: string;
  onSectionChange: (navKey: string, path: string) => void;
  onNavigateApp: (key: string, intent?: NavIntent) => void;
}

function WorkspaceLayout({ data, actions, startPath, onSectionChange, onNavigateApp }: Omit<ManagerWorkspaceProps, 'navKey'> & { startPath: string }) {
  const location = useLocation();
  const section = sectionForPath(location.pathname);
  const startSection = sectionForPath(startPath);
  useEffect(() => {
    if (section.key !== startSection.key) onSectionChange(section.navKey, location.pathname);
  }, [section, startSection, location.pathname, onSectionChange]);

  const [toast, setToast] = useState('');
  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  // Badges on the sub-tabs: work waiting on the manager.
  const counts: Record<string, number> = {
    'marketing/directives': data.directives.filter((r) => r.status === 'Waiting' && !r.delegatedBy).length,
    'transfers/inter-branch': data.store.transfers.filter((t) => t.fromBranch === data.branch && t.status === 'Pending').length,
    'operations/it-support': data.store.itTickets.filter((t) => t.status === 'Open').length,
  };
  const context: WorkspaceContext = { data, actions, flash, navigateApp: onNavigateApp };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-navy">{section.title}</h2>
        <p className="text-sm text-gray-500">{section.intro}</p>
      </div>
      <nav aria-label={`${section.title} sections`} className="-mx-1 flex gap-1 overflow-x-auto border-b border-grey-border px-1">
        {section.tabs.map((t) => (
          <NavLink
            key={t.path}
            to={sectionPath(section.key, t.path)}
            end
            className={({ isActive }) => `-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-navy-light'}`}
          >
            {t.label}
            {!!counts[`${section.key}/${t.path}`] && <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{counts[`${section.key}/${t.path}`]}</span>}
          </NavLink>
        ))}
      </nav>
      <div key={location.pathname} className="dissolve-in">
        <Outlet context={context} />
      </div>
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
}

// Flat child routes: every page is a direct child of the layout, so each reads its <Outlet context>.
const PAGES: { path: string; element: React.ReactNode }[] = [
  { path: 'marketing', element: <MarketingSummary /> },
  { path: 'marketing/clients', element: <MarketingClients /> },
  { path: 'marketing/requests', element: <MarketingRequests /> },
  { path: 'marketing/directives', element: <InboundDirectives /> },
  { path: 'transfers', element: <InternalHandover /> },
  { path: 'transfers/inter-branch', element: <InterBranchTransfers /> },
  { path: 'operations', element: <TaskOversight /> },
  { path: 'operations/it-support', element: <ItSupport /> },
];

export default function ManagerWorkspace({ data, actions, navKey, startPath, onSectionChange, onNavigateApp }: ManagerWorkspaceProps) {
  const start = workspaceStartPath(navKey, startPath);
  return (
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path={WORKSPACE_BASE} element={<WorkspaceLayout data={data} actions={actions} startPath={start} onSectionChange={onSectionChange} onNavigateApp={onNavigateApp} />}>
          <Route index element={<Navigate to={sectionPath(WORKSPACE_SECTIONS[0].key)} replace />} />
          {PAGES.map((p) => <Route key={p.path} path={p.path} element={p.element} />)}
        </Route>
        <Route path="*" element={<Navigate to={start} replace />} />
      </Routes>
    </MemoryRouter>
  );
}
