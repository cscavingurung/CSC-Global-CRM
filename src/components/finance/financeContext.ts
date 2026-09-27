// Financial Management routes — the route table and the shared ledger context. Every route reads
// the same `transactions` (the branch ledger) from the layout's <Outlet context>, so no view has
// its own copy of the data.
import { useOutletContext } from 'react-router-dom';
import { FinTransaction, MockUser } from '../../types';

export interface FinanceContext {
  currentUser: MockUser;
  /** The branch ledger — charges, payments, refunds and discounts. */
  transactions: FinTransaction[];
  /** Writes a decision back to an existing ledger row (void, approve, reject, process). */
  onSave: (t: FinTransaction) => void;
  flash: (message: string) => void;
  today: string;
}

export const useFinance = () => useOutletContext<FinanceContext>();

/** Sub-tabs, in order. `path` is relative to the module ('' is the index route); `navKey` is the
 * matching sidebar sub-tab under Financial Management. */
export const FIN_ROUTES = [
  { path: '', navKey: 'fin-dashboard', label: 'Dashboard', title: 'Branch Financial Dashboard' },
  { path: 'collections', navKey: 'fin-collections', label: 'Daily Collection', title: 'Daily Collection Register' },
  { path: 'receipts', navKey: 'fin-receipts', label: 'Receipts', title: 'Automated Receipt Generation' },
  { path: 'outstanding', navKey: 'fin-outstanding', label: 'Outstanding', title: 'Outstanding Payment Dashboard' },
  { path: 'payment-plans', navKey: 'fin-payment-plans', label: 'Payment Plans', title: 'Client Payment Plans' },
  { path: 'counselor-revenue', navKey: 'fin-revenue-counselor', label: 'Counselor Revenue', title: 'Revenue by Counselor' },
  { path: 'refunds', navKey: 'fin-refunds', label: 'Refunds', title: 'Refund Management' },
  { path: 'discounts', navKey: 'fin-discounts', label: 'Discounts', title: 'Discount Control' },
] as const;

export const FIN_NAV_KEYS: string[] = FIN_ROUTES.map((r) => r.navKey);

/** Route path for a sidebar key, label or path (e.g. "fin-refunds", "Counselor Revenue"). */
export function finPathFor(view?: string): string {
  const r = FIN_ROUTES.find((x) => x.navKey === view || x.label === view || x.title === view || x.path === view);
  return `/${r?.path ?? ''}`;
}

/** Sidebar key for a route path. */
export const finNavKeyFor = (pathname: string) =>
  FIN_ROUTES.find((r) => `/${r.path}` === pathname)?.navKey ?? 'fin-dashboard';
