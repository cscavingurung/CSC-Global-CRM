import { useNavigate } from 'react-router-dom';
import { clientBalances, finMonthLabel, isLivePayment, methodText, methodTotals, monthOf, planSummaries, rs, serviceLabel, stampMs, txStatus } from '../../finance';
import { useFinance } from './financeContext';
import { ClientCell, Pill, TableBox, Td, Th, ViewHeader } from './FinanceShared';

// 1 — Branch Financial Dashboard (default route).
export default function DashboardView() {
  const { transactions, today } = useFinance();
  const navigate = useNavigate();
  const thisMonth = today.slice(0, 7);
  const payments = transactions.filter((t) => t.kind === 'Payment');
  const todays = payments.filter((p) => p.at.startsWith(today));
  const month = payments.filter((p) => monthOf(p.at) === thisMonth);
  const balances = clientBalances(transactions, today);
  const pendingRefunds = transactions.filter((t) => t.kind === 'Refund' && t.status === 'Pending Approval');
  const pendingDiscounts = transactions.filter((t) => t.kind === 'Discount' && t.status === 'Pending Approval');
  const plansDue = planSummaries(transactions, today).flatMap((p) => p.installments.filter((i) => i.status === 'Overdue' || i.status === 'Due'));

  const cards = [
    { label: 'Today’s Collection', value: rs(methodTotals(todays).total), hint: `${todays.filter(isLivePayment).length} payments`, to: 'collections' },
    { label: 'This Month’s Collection', value: rs(methodTotals(month).total), hint: finMonthLabel(thisMonth), to: 'counselor-revenue' },
    { label: 'Outstanding', value: rs(balances.reduce((n, b) => n + b.outstanding, 0)), hint: `${balances.filter((b) => b.status === 'Overdue').length} overdue`, to: 'outstanding', tone: 'text-red-600' },
    { label: 'Pending Refunds', value: String(pendingRefunds.length), hint: rs(pendingRefunds.reduce((n, r) => n + r.amount, 0)), to: 'refunds', tone: 'text-amber-600' },
    { label: 'Pending Discounts', value: String(pendingDiscounts.length), hint: rs(pendingDiscounts.reduce((n, d) => n + d.amount, 0)), to: 'discounts', tone: 'text-amber-600' },
    { label: 'Payment Plans Due', value: String(plansDue.length), hint: 'instalments due / overdue', to: 'payment-plans', tone: 'text-amber-600' },
  ];

  return (
    <div className="space-y-4">
      <ViewHeader description="Today and this month at a glance. Each card opens its section." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <button key={c.label} type="button" onClick={() => navigate(`/${c.to}`)} className="rounded-xl border border-grey-border bg-white px-4 py-3 text-left transition-colors hover:border-navy-light/40">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`mt-0.5 text-xl font-semibold tabular-nums ${c.tone ?? 'text-navy'}`}>{c.value}</p>
            <p className="text-[11px] text-gray-400">{c.hint}</p>
          </button>
        ))}
      </div>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-navy">Recent transactions</h3>
        <TableBox>
          <thead><tr className="bg-grey-bg"><Th>Client</Th><Th>Type</Th><Th right>Amount</Th><Th>Payment Method</Th><Th>Staff</Th><Th>Status</Th></tr></thead>
          <tbody>
            {[...transactions].filter((t) => t.kind !== 'Exception').sort((a, b) => stampMs(b.at) - stampMs(a.at)).slice(0, 12).map((t) => {
              const negative = t.kind === 'Refund' || t.kind === 'Discount';
              return (
                <tr key={t.id} className="border-t border-grey-border">
                  <Td><ClientCell t={t} /></Td>
                  <Td className="text-gray-600">{t.kind}<span className="block text-[11px] text-gray-400">{serviceLabel(t)}</span></Td>
                  <Td right className={negative ? 'text-red-700' : t.void ? 'text-gray-400 line-through' : 'text-navy'}>{negative ? `−${rs(t.amount)}` : rs(t.amount)}</Td>
                  <Td className="text-gray-600">{methodText(t)}</Td>
                  <Td className="text-gray-600">{t.by}<span className="block text-[11px] text-gray-400">{t.at}</span></Td>
                  <Td><Pill text={txStatus(t)} /></Td>
                </tr>
              );
            })}
          </tbody>
        </TableBox>
      </section>
    </div>
  );
}
