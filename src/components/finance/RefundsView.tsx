import { FinTransaction } from '../../types';
import { rs, serviceLabel, stampMs } from '../../finance';
import { formatSubmittedAt } from '../../dateTime';
import { useFinance } from './financeContext';
import { ClientCell, Pill, TableBox, Td, Th, ViewHeader } from './FinanceShared';
import ApprovalButtons from './ApprovalButtons';

// 7 — Refund Management. A refund is its own ledger row that references the original payment
// (`refOf`). Approving or processing a refund NEVER edits or deletes the original payment — the
// payment stays exactly as received, and balances subtract the refund once it's Processed.
export default function RefundsView() {
  const { transactions, currentUser, onSave, flash } = useFinance();
  const refunds = transactions.filter((t) => t.kind === 'Refund').sort((a, b) => stampMs(b.at) - stampMs(a.at));
  const byId = new Map(transactions.map((t) => [t.id, t]));

  const decide = (r: FinTransaction, status: 'Approved' | 'Rejected', note?: string) => {
    onSave({ ...r, status, decidedBy: currentUser.name, decidedAt: formatSubmittedAt(new Date()), decisionNote: note || undefined });
    flash(`Refund for ${r.clientName} ${status.toLowerCase()}${status === 'Approved' ? ' — the original payment is unchanged' : ''}.`);
  };
  const process = (r: FinTransaction) => {
    onSave({ ...r, status: 'Processed', processedBy: currentUser.name, processedAt: formatSubmittedAt(new Date()) });
    flash(`Refund to ${r.clientName} marked processed.`);
  };

  return (
    <div className="space-y-4">
      <ViewHeader description="Approve or reject refund requests. Finance marks approved refunds Processed once the money is paid out." />
      <p className="rounded-lg bg-grey-bg px-3 py-2 text-xs text-gray-600">Approving a refund never changes or deletes the original payment — the refund is its own ledger entry that references it.</p>
      <TableBox min={1000}>
        <thead><tr className="bg-grey-bg"><Th>Client</Th><Th>Original Payment</Th><Th right>Refund Amount</Th><Th>Reason</Th><Th>Requested By</Th><Th>Status</Th><Th right>Action</Th></tr></thead>
        <tbody>
          {refunds.map((r) => {
            const orig = r.refOf ? byId.get(r.refOf) : undefined;
            return (
              <tr key={r.id} className="border-t border-grey-border align-top">
                <Td><ClientCell t={r} /></Td>
                <Td className="text-gray-600">{orig ? <>{rs(orig.amount)}<span className="block text-[11px] text-gray-400">{orig.receiptNo} · {serviceLabel(orig)}</span></> : '—'}</Td>
                <Td right className="font-semibold text-red-700">−{rs(r.amount)}</Td>
                <Td className="max-w-xs text-xs text-gray-600">{r.reason}</Td>
                <Td className="text-gray-600">{r.by}<span className="block text-[11px] text-gray-400">{r.at}</span></Td>
                <Td>
                  <Pill text={r.status ?? ''} />
                  {r.decidedBy && <span className="block text-[11px] text-gray-400">{r.status === 'Rejected' ? 'Rejected' : 'Approved'} by {r.decidedBy}</span>}
                  {r.decisionNote && <span className="block text-[11px] text-gray-400">“{r.decisionNote}”</span>}
                </Td>
                <Td right>
                  {r.status === 'Pending Approval' ? (
                    <ApprovalButtons onApprove={() => decide(r, 'Approved')} onReject={(note) => decide(r, 'Rejected', note)} />
                  ) : r.status === 'Approved' ? (
                    <button type="button" onClick={() => process(r)} className="rounded-md border border-navy px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy hover:text-white">Mark processed</button>
                  ) : (
                    <span className="text-[11px] text-gray-400">{r.processedAt ? `Paid out ${r.processedAt}` : '—'}</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </TableBox>
    </div>
  );
}
