import { useState } from 'react';
import { METHODS, finDayLabel, methodText, methodTotals, rs, serviceLabel, stampMs, timeOnly, txStatus } from '../../finance';
import { clampDateInput } from '../../dateTime';
import { useFinance } from './financeContext';
import { Pill, TableBox, Td, Th, ViewHeader } from './FinanceShared';

// 2 — Daily Collection Register: every payment on a day, with totals by payment method.
export default function DailyCollectionView() {
  const { transactions, today } = useFinance();
  const [date, setDate] = useState(today);
  const day = transactions.filter((t) => t.kind === 'Payment' && t.at.startsWith(date)).sort((a, b) => stampMs(a.at) - stampMs(b.at));
  const totals = methodTotals(day);

  return (
    <div className="space-y-4">
      <ViewHeader description={`${finDayLabel(date)}${date === today ? ' · today' : ''} · ${day.length} entries`}>
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} onBlur={(e) => { const c = clampDateInput(e.target.value, { max: today }); if (c) setDate(c); }} aria-label="Date" className="rounded-lg border border-grey-border bg-white px-3 py-2 text-sm text-navy" />
      </ViewHeader>
      <TableBox min={1000}>
        <thead><tr className="bg-grey-bg"><Th>Date / Time</Th><Th>Client</Th><Th>Client ID</Th><Th>Service</Th><Th right>Amount</Th><Th>Payment Method</Th><Th>Received By</Th><Th>Receipt No.</Th><Th>Status</Th></tr></thead>
        <tbody>
          {day.map((p) => (
            <tr key={p.id} className={`border-t border-grey-border ${p.void ? 'bg-grey-bg/40' : ''}`}>
              <Td className="whitespace-nowrap tabular-nums text-gray-600">{timeOnly(p.at)}</Td>
              <Td className="font-medium text-navy">{p.clientName}</Td>
              <Td className="text-gray-500">{p.clientId}</Td>
              <Td className="text-gray-600">{serviceLabel(p)}{p.planId && <span className="block text-[11px] text-gray-400">Instalment {p.installment}</span>}</Td>
              <Td right className={p.void ? 'text-gray-400 line-through' : 'font-semibold text-navy'}>{rs(p.amount)}</Td>
              <Td className="text-gray-600">{methodText(p)}{p.note && <span className="block text-[11px] text-gray-400">{p.note}</span>}</Td>
              <Td className="text-gray-600">{p.by}</Td>
              <Td className="whitespace-nowrap text-xs text-gray-500">{p.receiptNo}</Td>
              <Td><Pill text={txStatus(p)} />{p.void && <span className="block text-[11px] text-gray-400">{p.void.reason}</span>}</Td>
            </tr>
          ))}
        </tbody>
        {/* Totals are calculated from the rows above, never typed in; voided receipts are excluded. */}
        <tfoot className="sticky bottom-0">
          <tr className="border-t-2 border-navy/20 bg-grey-bg text-sm">
            <td colSpan={9} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                {METHODS.map((m) => <span key={m} className="text-gray-600">{m}: <b className="tabular-nums text-navy">{rs(totals[m])}</b></span>)}
                <span className="ml-auto text-navy">Total: <b className="text-base tabular-nums">{rs(totals.total)}</b></span>
              </div>
              {day.some((p) => p.void) && <p className="mt-1 text-[11px] text-gray-400">Voided receipts are listed but not counted.</p>}
            </td>
          </tr>
        </tfoot>
      </TableBox>
      {day.length === 0 && <p className="text-center text-sm text-gray-400">No collections recorded on this day.</p>}
    </div>
  );
}
