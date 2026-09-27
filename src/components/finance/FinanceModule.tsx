import { useCallback, useEffect, useState } from 'react';
import { MemoryRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { CheckCircle, Database } from 'lucide-react';
import { FinTransaction, MockUser } from '../../types';
import { dateKey } from '../../dateTime';
import { FIN_ROUTES, FinanceContext, finNavKeyFor, finPathFor } from './financeContext';
import DashboardView from './DashboardView';
import DailyCollectionView from './DailyCollectionView';
import ReceiptsView from './ReceiptsView';
import OutstandingView from './OutstandingView';
import PaymentPlansView from './PaymentPlansView';
import CounselorRevenueView from './CounselorRevenueView';
import RefundsView from './RefundsView';
import DiscountsView from './DiscountsView';

// ─── Financial Management (Branch Manager) ──────────────────────────────────
// Eight sections as nested React Router routes under one layout. They're reached from the
// Financial Management sub-tabs in the sidebar: the sidebar key picks the starting route, and
// when a link inside a section moves to another route (e.g. a dashboard card) the module tells
// the app, so the sidebar highlight always matches the section on screen. The rest of the CRM
// switches pages by key, so the router here is a MemoryRouter — the browser URL isn't touched.
//
// Every route reads the same branch ledger (FinTransaction[]) through the layout's
// <Outlet context> — charges, payments, refunds and discounts in one place, no duplicate data.

interface FinanceModuleProps {
  currentUser: MockUser;
  /** The branch ledger. */
  transactions: FinTransaction[];
  onSave: (t: FinTransaction) => void;
  /** Section to open — a sidebar key such as "fin-refunds", a label or a route path. */
  initialView?: string;
  /** Called when a link inside a section moves to another route, with that route's sidebar key. */
  onRouteChange?: (navKey: string) => void;
}

const ROUTE_ELEMENTS: Record<string, React.ReactNode> = {
  '': <DashboardView />,
  collections: <DailyCollectionView />,
  receipts: <ReceiptsView />,
  outstanding: <OutstandingView />,
  'payment-plans': <PaymentPlansView />,
  'counselor-revenue': <CounselorRevenueView />,
  refunds: <RefundsView />,
  discounts: <DiscountsView />,
};

function FinanceLayout({ currentUser, transactions, onSave, startPath, onRouteChange }: Omit<FinanceModuleProps, 'initialView'> & { startPath: string }) {
  const location = useLocation();
  // Keep the sidebar in step when a section links to another (the starting route is skipped).
  useEffect(() => {
    if (location.pathname !== startPath) onRouteChange?.(finNavKeyFor(location.pathname));
  }, [location.pathname, startPath, onRouteChange]);
  const [toast, setToast] = useState('');
  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 3500);
  }, []);

  const pending = {
    refunds: transactions.filter((t) => t.kind === 'Refund' && t.status === 'Pending Approval').length,
    discounts: transactions.filter((t) => t.kind === 'Discount' && t.status === 'Pending Approval').length,
  };
  const context: FinanceContext = { currentUser, transactions, onSave, flash, today: dateKey(new Date()) };

  return (
    <div className="space-y-5">
      {/* Navigation lives in the sidebar (Financial Management sub-tabs); this badge shows that
          every sub-tab reads the same ledger. */}
      <div className="flex justify-end">
        <p
          className="flex items-center gap-1.5 rounded-full border border-grey-border bg-white px-3 py-1 text-xs text-gray-500"
          title="Charges, payments, refunds and discounts live in one ledger; every sub-tab reads from it."
        >
          <Database size={13} className="text-navy-light" /> Branch ledger · <b className="tabular-nums text-navy">{transactions.length}</b> transactions · single source
          {pending.refunds + pending.discounts > 0 && (
            <span className="ml-1 rounded-full bg-amber-50 px-1.5 font-semibold text-amber-700">{pending.refunds + pending.discounts} awaiting approval</span>
          )}
        </p>
      </div>

      {/* Fade on every sub-tab change */}
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

export default function FinanceModule({ currentUser, transactions, onSave, initialView, onRouteChange }: FinanceModuleProps) {
  const startPath = finPathFor(initialView);
  return (
    <MemoryRouter initialEntries={[startPath]}>
      <Routes>
        <Route path="/" element={<FinanceLayout currentUser={currentUser} transactions={transactions} onSave={onSave} startPath={startPath} onRouteChange={onRouteChange} />}>
          {FIN_ROUTES.map((r) =>
            r.path === ''
              ? <Route key="index" index element={ROUTE_ELEMENTS['']} />
              : <Route key={r.path} path={r.path} element={ROUTE_ELEMENTS[r.path]} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
