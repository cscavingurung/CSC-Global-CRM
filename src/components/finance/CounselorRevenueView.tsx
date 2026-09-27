import { useState } from 'react';
import { FinTransaction } from '../../types';
import { SERVICES, finMonthLabel, isLivePayment, monthOf, rs } from '../../finance';
import { useFinance } from './financeContext';
import { Select, TableBox, Td, Th, ViewHeader } from './FinanceShared';

// 6 — Revenue by Counselor (read-only): payments (excluding voided) minus processed refunds,
// attributed to the client's counselor.
export default function CounselorRevenueView() {
  const { transactions, today } = useFinance();
  const [f, setF] = useState({ month: today.slice(0, 7), country: '', service: '' });

  const payments = transactions.filter(isLivePayment);
  const refunds = transactions.filter((t) => t.kind === 'Refund' && t.status === 'Processed');
  const months = [...new Set([today.slice(0, 7), ...transactions.filter((t) => t.kind === 'Payment').map((p) => monthOf(p.at))])].sort().reverse();
  const countries = [...new Set(transactions.map((t) => t.country))].sort();
  const match = (t: FinTransaction) => monthOf(t.at) === f.month && (!f.country || t.country === f.country) && (!f.service || t.service === f.service);
  const rows = [...new Set(transactions.map((t) => t.counselor))]
    .map((c) => {
      const pays = payments.filter((p) => p.counselor === c && match(p));
      const back = refunds.filter((r) => r.counselor === c && match(r));
      return { c, clients: new Set(pays.map((p) => p.clientId)).size, revenue: pays.reduce((n, p) => n + p.amount, 0) - back.reduce((n, r) => n + r.amount, 0) };
    })
    .filter((r) => r.clients > 0 || r.revenue !== 0)
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-4">
      <ViewHeader description="Read-only · payments (excluding voided receipts) minus processed refunds, attributed to each client’s counselor." />
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
        <Select label="Month" value={f.month} onChange={(v) => setF({ ...f, month: v })}>{months.map((m) => <option key={m} value={m}>{finMonthLabel(m)}</option>)}</Select>
        <Select label="Country" value={f.country} onChange={(v) => setF({ ...f, country: v })}><option value="">All countries</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        <Select label="Service" value={f.service} onChange={(v) => setF({ ...f, service: v })}><option value="">All services</option>{SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
      </div>
      <TableBox min={560}>
        <thead><tr className="bg-grey-bg"><Th>Counselor Name</Th><Th right>Total Clients</Th><Th right>Total Revenue Attributed</Th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.c} className="border-t border-grey-border">
              <Td className="font-medium text-navy">{r.c}</Td>
              <Td right className="text-gray-600">{r.clients}</Td>
              <Td right className="font-semibold text-navy">{rs(r.revenue)}</Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-grey-border bg-grey-bg/60 font-semibold text-navy">
            <Td>Total</Td>
            <Td right>{rows.reduce((n, r) => n + r.clients, 0)}</Td>
            <Td right>{rs(rows.reduce((n, r) => n + r.revenue, 0))}</Td>
          </tr>
        </tfoot>
      </TableBox>
      {rows.length === 0 && <p className="text-center text-sm text-gray-400">No revenue for these filters.</p>}
    </div>
  );
}
