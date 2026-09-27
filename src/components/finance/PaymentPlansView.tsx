import { Check } from 'lucide-react';
import { DUE_STYLES, finDayLabel, planSummaries, rs } from '../../finance';
import { useFinance } from './financeContext';
import { ClientCell, TableBox, Td, Th, ViewHeader } from './FinanceShared';

// 5 — Client Payment Plans. A plan is its instalment charges in the ledger; paid amounts are the
// payments recorded against each instalment.
export default function PaymentPlansView() {
  const { transactions, today } = useFinance();
  const plans = planSummaries(transactions, today);

  return (
    <div className="space-y-4">
      <ViewHeader description="Fees split into instalments. Chip colours show each instalment’s status." />
      <TableBox min={900}>
        <thead><tr className="bg-grey-bg"><Th>Client</Th><Th right>Total Amount</Th><Th right>Instalments</Th><Th right>Per Instalment</Th><Th>Due Dates</Th><Th>Paid vs Remaining</Th></tr></thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.planId} className="border-t border-grey-border align-top">
              <Td><ClientCell t={p} /><span className="block text-[11px] text-gray-400">{p.service}</span></Td>
              <Td right className="text-navy">{rs(p.total)}</Td>
              <Td right className="text-gray-600">{p.count}</Td>
              <Td right className="text-gray-600">{rs(p.perInstallment)}</Td>
              <Td>
                <span className="flex flex-wrap gap-1">
                  {p.installments.map((i) => (
                    <span key={i.no} title={`Instalment ${i.no}: ${rs(i.amount)} · paid ${rs(i.paid)}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${DUE_STYLES[i.status]}`}>
                      {i.status === 'Settled' && <Check size={10} />}{i.no}. {finDayLabel(i.due).replace(/ \d{4}$/, '')}
                    </span>
                  ))}
                </span>
              </Td>
              <Td>
                <div className="h-1.5 w-40 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(p.paid / p.total) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-gray-600"><b className="text-emerald-700">{rs(p.paid)}</b> paid · <b className="text-navy">{rs(p.remaining)}</b> remaining</p>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableBox>
      {plans.length === 0 && <p className="text-center text-sm text-gray-400">No payment plans.</p>}
    </div>
  );
}
