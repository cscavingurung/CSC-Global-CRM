import { ReceiptData, amountInWords } from '../receipt';
import { finDayLabel, rs } from '../finance';

// On-screen version of the printed receipt: what the payment covered, and what's left.
export default function ReceiptPreview({ receipt: r, branch }: { receipt: ReceiptData; branch: string }) {
  const p = r.payment;
  return (
    <div className="rounded-xl border border-grey-border bg-white px-5 py-4 text-sm">
      <div className="mb-3 flex items-start justify-between border-b-2 border-navy pb-2">
        <div>
          <p className="text-base font-bold text-navy">CSC Global</p>
          <p className="text-[11px] text-gray-500">{branch} branch · Official payment receipt</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-navy">{p.receiptNo}</p>
          <p className="text-[11px] text-gray-500">{p.at}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.void ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>{p.void ? 'VOIDED' : 'PAID'}</span>
        </div>
      </div>
      {p.void && <p className="mb-2 rounded-md bg-gray-100 px-3 py-1.5 text-xs text-gray-600">Voided by {p.void.by}: {p.void.reason}</p>}
      <dl className="space-y-1">
        {[
          ['Received from', `${p.clientName} (${p.clientId})`],
          ['Payment method', `${p.method}${p.methodNote ? ` · ${p.methodNote}` : ''}`],
          ['Received by', p.by],
          ...(p.note ? [['Note', p.note]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3"><dt className="text-gray-500">{k}</dt><dd className="text-right text-navy">{v}</dd></div>
        ))}
      </dl>

      <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Paid for</p>
      <ul className="divide-y divide-grey-border rounded-lg border border-grey-border">
        {r.lines.map((l) => (
          <li key={l.label} className="flex items-start gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-navy">{l.label}</span>
              <span className="block text-[11px] text-gray-400">
                Charge {rs(l.amount)}{l.paidBefore ? ` · paid before ${rs(l.paidBefore)}` : ''}{l.due ? ` · due ${finDayLabel(l.due)}` : ''}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-semibold tabular-nums text-navy">{rs(l.thisPayment)}</span>
              <span className={`block text-[11px] ${l.remaining ? 'text-amber-700' : 'text-emerald-700'}`}>{l.remaining ? `${rs(l.remaining)} left` : 'Paid in full'}</span>
            </span>
          </li>
        ))}
        {r.lines.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">No charges matched this payment.</li>}
      </ul>

      <dl className="ml-auto mt-3 w-full space-y-1 sm:w-3/4">
        <div className="flex justify-between"><dt className="text-gray-500">Total fees</dt><dd className="tabular-nums">{rs(r.totalFees)}</dd></div>
        {r.discounts > 0 && <div className="flex justify-between"><dt className="text-gray-500">Approved discounts</dt><dd className="tabular-nums">−{rs(r.discounts)}</dd></div>}
        <div className="flex justify-between"><dt className="text-gray-500">Paid previously</dt><dd className="tabular-nums">{rs(r.paidBefore)}</dd></div>
        <div className="flex justify-between font-semibold text-navy"><dt>This payment</dt><dd className="tabular-nums">{rs(r.thisPayment)}</dd></div>
        <div className="flex justify-between border-t-2 border-navy pt-1.5 text-base font-bold text-navy"><dt>Balance remaining</dt><dd className="tabular-nums">{rs(r.balanceAfter)}</dd></div>
      </dl>
      <p className="mt-3 rounded-lg bg-grey-bg px-3 py-2 text-xs text-gray-600">In words: <b className="text-navy">{amountInWords(r.thisPayment)}</b></p>
      {r.nextDue ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Next payment: <b>{rs(r.nextDue.amount)}</b> for {r.nextDue.label}{r.nextDue.date ? ` · due ${finDayLabel(r.nextDue.date)}` : ''}
        </p>
      ) : (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">All fees are fully paid.</p>
      )}
    </div>
  );
}
