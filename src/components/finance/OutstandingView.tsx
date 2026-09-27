import { DUE_STYLES, DueStatus, clientBalances, finDayLabel, rs } from '../../finance';
import { useFinance } from './financeContext';
import { ClientCell, Pill, TableBox, Td, Th, ViewHeader } from './FinanceShared';

// 4 — Outstanding Payments Dashboard. Balances are calculated from the ledger, never stored:
// Outstanding = Total Fee − approved discounts − (payments − processed refunds).
const ORDER: DueStatus[] = ['Overdue', 'Due', 'Due Soon', 'Scheduled'];

export default function OutstandingView() {
  const { transactions, today } = useFinance();
  const list = clientBalances(transactions, today)
    .filter((b) => b.outstanding > 0)
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.nextDue ?? '').localeCompare(b.nextDue ?? ''));

  return (
    <div className="space-y-4">
      <ViewHeader description="Every client with money still owed, most urgent first." />
      <div className="flex flex-wrap gap-2">
        {ORDER.map((s) => {
          const rows = list.filter((b) => b.status === s);
          return <span key={s} className={`rounded-full px-3 py-1 text-xs font-medium ${DUE_STYLES[s]}`}>{s} · {rows.length} · {rs(rows.reduce((n, b) => n + b.outstanding, 0))}</span>;
        })}
      </div>
      <TableBox>
        <thead><tr className="bg-grey-bg"><Th>Client</Th><Th right>Total Fee</Th><Th right>Paid Amount</Th><Th right>Outstanding</Th><Th>Due Date</Th><Th>Status</Th></tr></thead>
        <tbody>
          {list.map((b) => (
            <tr key={b.clientId} className="border-t border-grey-border">
              <Td><ClientCell t={b} /></Td>
              <Td right className="text-gray-600">{rs(b.totalFee)}{b.discounts > 0 && <span className="block text-[11px] text-emerald-700">−{rs(b.discounts)} discount</span>}</Td>
              <Td right className="text-gray-600">{rs(b.paid - b.refunded)}{b.refunded > 0 && <span className="block text-[11px] text-gray-400">after {rs(b.refunded)} refunded</span>}</Td>
              <Td right className="font-semibold text-navy">{rs(b.outstanding)}</Td>
              <Td className="whitespace-nowrap text-gray-600">{b.nextDue ? finDayLabel(b.nextDue) : '—'}</Td>
              <Td><Pill text={b.status} cls={DUE_STYLES[b.status]} /></Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-grey-border bg-grey-bg/60 font-semibold text-navy">
            <Td>{list.length} clients</Td>
            <Td right>{rs(list.reduce((n, b) => n + b.totalFee, 0))}</Td>
            <Td right>{rs(list.reduce((n, b) => n + b.paid - b.refunded, 0))}</Td>
            <Td right>{rs(list.reduce((n, b) => n + b.outstanding, 0))}</Td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </TableBox>
      <p className="text-[11px] text-gray-400">Due date is the earliest charge not yet covered. Due = within 7 days · Due Soon = within 30 days · Overdue = past due.</p>
    </div>
  );
}
