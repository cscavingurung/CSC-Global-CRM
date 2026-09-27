import { FinTransaction } from '../../types';
import { rs, stampMs } from '../../finance';
import { formatSubmittedAt } from '../../dateTime';
import { useFinance } from './financeContext';
import { ClientCell, Pill, TableBox, Td, Th, ViewHeader } from './FinanceShared';
import ApprovalButtons from './ApprovalButtons';

// 8 — Discount Control. Staff can't change a standard fee; they request a discount, which only
// reduces what the client owes once the manager approves it here.
export default function DiscountsView() {
  const { transactions, currentUser, onSave, flash } = useFinance();
  const discounts = transactions.filter((t) => t.kind === 'Discount').sort((a, b) => stampMs(b.at) - stampMs(a.at));

  const decide = (d: FinTransaction, status: 'Approved' | 'Rejected', note?: string) => {
    onSave({ ...d, status, decidedBy: currentUser.name, decidedAt: formatSubmittedAt(new Date()), decisionNote: note || undefined });
    flash(`Discount for ${d.clientName} ${status.toLowerCase()}.`);
  };

  return (
    <div className="space-y-4">
      <ViewHeader description="Standard fees can’t be changed by staff — only approved discounts reduce what a client owes." />
      <TableBox min={1100}>
        <thead><tr className="bg-grey-bg"><Th>Client</Th><Th>Service</Th><Th right>Standard Fee</Th><Th right>Requested Discount</Th><Th right>Final Amount</Th><Th>Reason</Th><Th>Requested By</Th><Th>Status</Th><Th right>Action</Th></tr></thead>
        <tbody>
          {discounts.map((d) => (
            <tr key={d.id} className="border-t border-grey-border align-top">
              <Td><ClientCell t={d} /></Td>
              <Td className="text-gray-600">{d.service}</Td>
              <Td right className="text-gray-600">{rs(d.standardFee ?? 0)}</Td>
              <Td right className="text-red-700">−{rs(d.amount)}<span className="block text-[11px] text-gray-400">{d.standardFee ? `${Math.round((d.amount / d.standardFee) * 100)}%` : ''}</span></Td>
              <Td right className="font-semibold text-navy">{rs((d.standardFee ?? 0) - d.amount)}</Td>
              <Td className="max-w-xs text-xs text-gray-600">{d.reason}</Td>
              <Td className="text-gray-600">{d.by}<span className="block text-[11px] text-gray-400">{d.at}</span></Td>
              <Td><Pill text={d.status ?? ''} />{d.decisionNote && <span className="block text-[11px] text-gray-400">“{d.decisionNote}”</span>}</Td>
              <Td right>
                {d.status === 'Pending Approval'
                  ? <ApprovalButtons onApprove={() => decide(d, 'Approved')} onReject={(note) => decide(d, 'Rejected', note)} />
                  : <span className="text-[11px] text-gray-400">{d.decidedBy ? `by ${d.decidedBy}` : '—'}</span>}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableBox>
    </div>
  );
}
