import { useCallback, useEffect, useState } from 'react';
import { MemoryRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Film, History, LayoutDashboard, PenTool, CalendarClock } from 'lucide-react';
import { DesignerData } from '../../designerData';
import {
  DESIGNER_BASE, DESIGNER_ROUTES, DesignerActions, DesignerContext, designerNavKeyFor, designerPath, designerPathFor,
} from './designerContext';
import DesignerDashboard from './DesignerDashboard';
import DesignQueue from './DesignQueue';
import VideoQueue from './VideoQueue';
import ScheduledPostsView from './ScheduledPostsView';
import DesignHistory from './DesignHistory';

// ─── Graphics Designer workspace ────────────────────────────────────────────
// Five sections as nested React Router routes under /marketing/designer, inside one layout
// wrapper (sub-tabs + <Outlet />). Like Financial Management, the router is a MemoryRouter scoped
// to this module — the rest of the CRM switches pages by sidebar key, so the sidebar tabs pick the
// starting route and the module reports route changes back so the sidebar highlight stays in step.
//
// DATA BOUNDARY: the module only ever receives `DesignerData` (see designerData.ts) — a production
// queue. No leads, clients, applications, visas, finance, HR, analytics or ad budgets.

interface DesignerModuleProps {
  me: string;
  data: DesignerData;
  actions: DesignerActions;
  /** Sidebar key (or sub-path) to open on. */
  initialView?: string;
  /** Task to open on arrival. */
  openId?: string;
  /** A link inside the module moved to another section: its sidebar key, and a task to open there. */
  onRouteChange?: (navKey: string, openId?: string) => void;
}

const ICONS: Record<string, React.ReactNode> = {
  '': <LayoutDashboard size={14} />, designs: <PenTool size={14} />, videos: <Film size={14} />,
  scheduled: <CalendarClock size={14} />, history: <History size={14} />,
};

function DesignerLayout({ me, data, actions, openId, startPath, onRouteChange }: Omit<DesignerModuleProps, 'initialView'> & { startPath: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.pathname !== startPath) onRouteChange?.(designerNavKeyFor(location.pathname), (location.state as { open?: string } | null)?.open);
  }, [location.pathname, location.state, startPath, onRouteChange]);

  const [toast, setToast] = useState('');
  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 3200);
  }, []);
  const go = useCallback((sub: string, open?: string) => navigate(designerPath(sub), { state: open ? { open } : undefined }), [navigate]);

  const counts: Record<string, number> = {
    designs: data.designTasks.filter((d) => d.stage === 'Requested' || d.stage === 'In Progress').length,
    videos: data.videoTasks.filter((v) => v.status === 'To Edit' || v.status === 'In Progress').length,
  };
  const context: DesignerContext = { me, data, actions, go, openId: (location.state as { open?: string } | null)?.open ?? openId, flash };

  return (
    <div className="space-y-5">
      {/* Sub-navigation — each tab is its own route. */}
      <nav aria-label="Designer sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-grey-border px-1">
        {DESIGNER_ROUTES.map((r) => (
          <NavLink
            key={r.path}
            to={designerPath(r.path)}
            end
            className={({ isActive }) => `-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-navy-light'}`}
          >
            {ICONS[r.path]} {r.label}
            {!!counts[r.path] && <span className="rounded-full bg-amber-50 px-1.5 text-[11px] font-semibold text-amber-700">{counts[r.path]}</span>}
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

const ELEMENTS: Record<string, React.ReactNode> = {
  designs: <DesignQueue />,
  videos: <VideoQueue />,
  scheduled: <ScheduledPostsView />,
  history: <DesignHistory />,
};

export default function DesignerModule({ me, data, actions, initialView, openId, onRouteChange }: DesignerModuleProps) {
  const startPath = designerPathFor(initialView);
  return (
    <MemoryRouter initialEntries={[startPath]}>
      <Routes>
        <Route path={DESIGNER_BASE} element={<DesignerLayout me={me} data={data} actions={actions} openId={openId} startPath={startPath} onRouteChange={onRouteChange} />}>
          <Route index element={<DesignerDashboard />} />
          {DESIGNER_ROUTES.filter((r) => r.path).map((r) => <Route key={r.path} path={r.path} element={ELEMENTS[r.path]} />)}
        </Route>
        <Route path="*" element={<Navigate to={DESIGNER_BASE} replace />} />
      </Routes>
    </MemoryRouter>
  );
}
