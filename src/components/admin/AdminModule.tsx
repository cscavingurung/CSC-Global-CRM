import { useCallback, useEffect, useMemo, useState } from 'react';
import { MemoryRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { NavIntent } from '../../types';
import { CommandSources, GlobalFilters, buildAll } from '../../superAdmin';
import { ADMIN_BASE, AdminContext, adminNavKeyFor, adminStartPath } from './adminContext';
import CommandCenter from './CommandCenter';
import SheetView from './SheetView';
import { GlobalSearchPage, ReportsHub, SystemAdmin } from './AdminPages';
import ServiceChargesPage from './ServiceChargesPage';

// ─── Super Admin Command Center ─────────────────────────────────────────────
// Dashboard, Excel views, Reports, Global Search and System Administration as nested routes under
// /admin. Like the CRM's other routed modules this is a MemoryRouter scoped to the module: the
// sidebar key picks the start route, and moving to a route owned by another sidebar tab reports
// back so the sidebar highlight follows. Filters live in App state so they survive that hop.

interface AdminModuleProps {
  sources: CommandSources;
  filters: GlobalFilters;
  setFilters: (f: GlobalFilters) => void;
  me: string;
  navKey: string;
  /** Exact route (with query), e.g. from a Global Search submit. */
  startPath?: string;
  onRouteChange: (navKey: string, path: string) => void;
  onNavigateApp: (key: string, intent?: NavIntent) => void;
  onOverrideTask: AdminContext['onOverrideTask'];
  onAddPrice: AdminContext['onAddPrice'];
}

function AdminLayout({ sources, filters, setFilters, me, startPath, onRouteChange, onNavigateApp, onOverrideTask, onAddPrice }: Omit<AdminModuleProps, 'navKey'> & { startPath: string }) {
  const location = useLocation();
  const full = `${location.pathname}${location.search}`;
  const startKey = adminNavKeyFor(startPath);
  const here = adminNavKeyFor(location.pathname);
  useEffect(() => {
    if (here !== startKey) onRouteChange(here, full);
  }, [here, startKey, full, onRouteChange]);

  const rows = useMemo(() => buildAll(sources), [sources]);
  const [toast, setToast] = useState('');
  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 3200);
  }, []);
  const ctx: AdminContext = { sources, rows, filters, setFilters, me, navigateApp: onNavigateApp, onOverrideTask, onAddPrice, flash };

  return (
    <>
      <div key={location.pathname} className="dissolve-in">
        <Outlet context={ctx} />
      </div>
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[80] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" /> {toast}
        </div>
      )}
    </>
  );
}

export default function AdminModule(props: AdminModuleProps) {
  const start = adminStartPath(props.navKey, props.startPath);
  return (
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path={ADMIN_BASE} element={<AdminLayout {...props} startPath={start} />}>
          <Route index element={<CommandCenter />} />
          <Route path="sheet/:key" element={<SheetView />} />
          <Route path="reports" element={<ReportsHub />} />
          <Route path="finance" element={<ServiceChargesPage />} />
          <Route path="search" element={<GlobalSearchPage />} />
          <Route path="system" element={<SystemAdmin />} />
        </Route>
        <Route path="*" element={<Navigate to={ADMIN_BASE} replace />} />
      </Routes>
    </MemoryRouter>
  );
}
