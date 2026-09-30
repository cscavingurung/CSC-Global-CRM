import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle, Eye, Info, Lock, Percent, Receipt, Send, X } from 'lucide-react';
import { FinTransaction, MockUser } from '../types';
import { useFinanceLedger } from '../financeLedger';
import {
  DUE_STYLES, DueStatus, chargeLines, clientBalances, dueStatus, finDayLabel, methodText, rs, serviceLabel, stampMs, txStatus,
} from '../finance';
import { dateKey, formatSubmittedAt } from '../dateTime';
import DateInput from './DateInput';
import DocumentChargesPanel from './DocumentChargesPanel';
import ServiceFeesPanel from './ServiceFeesPanel';

// ─── Client Profile · Financials ────────────────────────────────────────────
// What a counselor sees about a client's money — all read from the branch finance ledger.
// Counselors are sales, not finance: they can VIEW balances, plans and receipts and REQUEST a
// discount or a payment exception. They can't approve, edit payments, void or delete receipts
// or process refunds — requests go to the Branch Manager's Approval Center. The V/A Officer
// additionally adds document & processing charges here (no approval needed).

interface ClientFinancialsProps {
  clientId: string;
  clientName: string;
  counselor: string;
  country: string;
  currentUser: MockUser;
}

type RowStatus = 'Paid' | DueStatus;
const ROW_STYLES: Record<string, string> = { ...DUE_STYLES, Paid: 'bg-emerald-50 text-emerald-700' };

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

function Locked({ label, value, tone = 'text-navy' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-grey-border bg-white px-5 py-4" title="Read-only — managed by Finance">
      <p className="flex items-center gap-1.5 text-xs text-gray-500"><Lock size={12} className="text-gray-400" aria-label="Read-only" /> {label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className="dissolve-in relative w-full max-w-md rounded-2xl border border-grey-border bg-white">
        <div className="flex items-center justify-between border-b border-grey-border px-6 py-4">
          <h3 className="text-base font-semibold text-navy">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
        </div>
        <div className="space-y-4 px-6 py-5">{children}</div>
        <div className="flex gap-3 border-t border-grey-border px-6 py-4">{footer}</div>
      </div>
    </div>
  );
}

export default function ClientFinancials({ clientId, clientName, counselor, country, currentUser }: ClientFinancialsProps) {
  const { transactions: ledger, addTransaction } = useFinanceLedger();
  const today = dateKey(new Date());
  const canRequest = currentUser.role === 'counselor';
  const tx = useMemo(() => ledger.filter((t) => t.clientId === clientId), [ledger, clientId]);
  const balance = clientBalances(tx, today)[0];
  const charges = tx.filter((t) => t.kind === 'Charge').sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const payments = tx.filter((t) => t.kind === 'Payment').sort((a, b) => stampMs(b.at) - stampMs(a.at));
  const pendingDiscounts = tx.filter((t) => t.kind === 'Discount' && t.status === 'Pending Approval');
  const pendingExceptions = tx.filter((t) => t.kind === 'Exception' && t.status === 'Pending Approval');
  const decidedRequests = tx.filter((t) => (t.kind === 'Discount' || t.kind === 'Exception') && t.status !== 'Pending Approval').sort((a, b) => stampMs(b.at) - stampMs(a.at));

  // Paid against each charge — the same allocation rule receipts and balances use.
  const rows = useMemo(() => chargeLines(tx).map(({ charge: c, paid, remaining }) => {
    const status: RowStatus = remaining <= 0 ? 'Paid' : dueStatus(c.dueDate, remaining, today);
    return { c, paid, remaining, status };
  }), [tx, today]);

  // ── Requests ──
  const services = [...new Set(charges.map((c) => c.service))];
  const standardFeeFor = (service: string) => charges.filter((c) => c.service === service).reduce((n, c) => n + c.amount, 0);
  const [discount, setDiscount] = useState<{ service: string; amount: string; reason: string } | null>(null);
  const [exception, setException] = useState<{ type: 'Custom payment plan' | 'Due date extension'; dueDate: string; details: string } | null>(null);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 3500); };

  const base = (service: FinTransaction['service']) => ({
    id: `fin-req-${Date.now()}`, branch: currentUser.branch, clientId, clientName, counselor, country, service,
    at: formatSubmittedAt(new Date()), by: currentUser.name, status: 'Pending Approval' as const,
  });

  const discountFee = discount ? standardFeeFor(discount.service) : 0;
  const discountAmount = discount ? Number(discount.amount) || 0 : 0;
  const discountError = !discount ? null
    : pendingDiscounts.some((d) => d.service === discount.service) ? 'A discount for this service is already waiting for approval.'
      : discountAmount <= 0 ? 'Enter the discount amount.'
        : discountAmount >= discountFee ? 'The discount must be less than the standard fee.'
          : !discount.reason.trim() ? 'Add a reason or justification.' : null;
  const submitDiscount = () => {
    if (!discount || discountError) return;
    addTransaction({ ...base(discount.service as FinTransaction['service']), kind: 'Discount', amount: discountAmount, standardFee: discountFee, reason: discount.reason.trim() });
    setDiscount(null);
    flash('Discount request sent to the Branch Manager’s Approval Center.');
  };
  const submitException = () => {
    if (!exception || !exception.details.trim()) return;
    addTransaction({
      ...base((charges.find((c) => rows.find((r) => r.c.id === c.id && r.remaining > 0)) ?? charges[0])?.service ?? 'Consultation Fee'),
      kind: 'Exception', amount: balance?.outstanding ?? 0, exceptionType: exception.type,
      requestedDueDate: exception.type === 'Due date extension' && exception.dueDate ? exception.dueDate : undefined,
      reason: exception.details.trim(),
    });
    setException(null);
    flash('Exception request sent to management for a decision.');
  };

  // Who adds charges: the client's counselor or the Branch Manager sets the service fee; the V/A
  // Officer adds document & processing extras. Everyone else sees the ledger read-only.
  const canSetServiceFee = (currentUser.role === 'counselor' && currentUser.name === counselor) || currentUser.role === 'branch_manager';
  const chargesPanel = currentUser.role === 'application_officer'
    ? <DocumentChargesPanel clientId={clientId} clientName={clientName} counselor={counselor} country={country} currentUser={currentUser} />
    : canSetServiceFee
      ? <ServiceFeesPanel clientId={clientId} clientName={clientName} counselor={counselor} country={country} currentUser={currentUser} />
      : null;

  if (!balance && tx.length === 0) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-grey-border bg-white px-5 py-10 text-center text-sm text-gray-400">
          No fees or payments recorded for {clientName} yet.{canSetServiceFee ? ' Add the client’s service below to set their fee.' : ' Their counselor sets the service fee.'}
        </div>
        {chargesPanel}
      </div>
    );
  }

  const nextDue = rows.find((r) => r.remaining > 0);

  return (
    <div className="space-y-5">
      {/* Read-only summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Locked label="Total Service Fee" value={rs((balance?.totalFee ?? 0) - (balance?.discounts ?? 0) - (balance?.refunded ?? 0))} />
        <Locked label="Amount Paid" value={rs((balance?.paid ?? 0) - (balance?.refunded ?? 0))} tone="text-emerald-700" />
        <Locked label="Outstanding Balance" value={rs(balance?.outstanding ?? 0)} tone={(balance?.outstanding ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'} />
      </div>

      {/* Status + request actions */}
      <div className="flex flex-col gap-3 rounded-xl border border-grey-border bg-white px-5 py-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
          {balance && balance.outstanding > 0 && nextDue ? (
            <span className="text-gray-600">Next due: <b className="text-navy">{rs(nextDue.remaining)}</b> on {finDayLabel(nextDue.c.dueDate ?? today)}</span>
          ) : <span className="text-gray-600">Fully paid — nothing outstanding.</span>}
          {balance && balance.outstanding > 0 && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DUE_STYLES[balance.status]}`}>{balance.status}</span>}
          {balance?.discounts ? <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{rs(balance.discounts)} discount applied</span> : null}
          {pendingDiscounts.map((d) => (
            <span key={d.id} className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700" title={`${d.service} · requested by ${d.by} ${d.at}`}>
              Discount Requested (Pending) · {rs(d.amount)}
            </span>
          ))}
          {pendingExceptions.map((e) => (
            <span key={e.id} className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700" title={e.reason}>
              {e.exceptionType} Requested (Pending)
            </span>
          ))}
        </div>
        {canRequest ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setDiscount({ service: services[0] ?? '', amount: '', reason: '' })} disabled={services.length === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-40">
              <Percent size={14} /> Request Discount
            </button>
            <button type="button" onClick={() => setException({ type: 'Due date extension', dueDate: '', details: '' })} className="inline-flex items-center gap-1.5 rounded-lg border border-navy px-3 py-2 text-sm font-semibold text-navy hover:bg-navy hover:text-white">
              <CalendarClock size={14} /> Request Exception
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-gray-500"><Info size={13} /> Requests are raised by the client’s counselor and decided in the Manager Approval Center.</p>
        )}
      </div>

      {/* V/A Officer: document & processing charges */}
      {chargesPanel}

      {/* Payment history & plan */}
      <section className="rounded-xl border border-grey-border bg-white">
        <h3 className="flex items-center gap-2 border-b border-grey-border px-5 py-3 text-sm font-semibold text-navy"><Lock size={13} className="text-gray-400" /> Payment History &amp; Plan</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-grey-bg text-left">
                {['Item', 'Due Date', 'Amount', 'Paid', 'Status'].map((h) => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 ${h === 'Amount' || h === 'Paid' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, paid, status }) => (
                <tr key={c.id} className="border-t border-grey-border">
                  <td className="px-4 py-2.5 text-navy">{serviceLabel(c)}{c.planId && <span className="block text-[11px] text-gray-400">Instalment {c.installment} of {c.installments}</span>}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{c.dueDate ? finDayLabel(c.dueDate) : '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{rs(c.amount)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{paid ? rs(paid) : '—'}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROW_STYLES[status]}`}>{status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Receipts */}
      <section className="rounded-xl border border-grey-border bg-white">
        <h3 className="flex items-center gap-2 border-b border-grey-border px-5 py-3 text-sm font-semibold text-navy"><Receipt size={14} className="text-gray-400" /> Receipts</h3>
        {payments.length === 0 ? <p className="px-5 py-6 text-sm text-gray-400">No payments yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-grey-bg text-left">
                  {['Receipt #', 'Date', 'Service', 'Amount', 'Method', 'Status', ''].map((h) => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-grey-border">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-navy">{p.receiptNo}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{p.at}</td>
                    <td className="px-4 py-2.5 text-gray-600">{serviceLabel(p)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${p.void ? 'text-gray-400 line-through' : 'text-navy'}`}>{rs(p.amount)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{methodText(p)}</td>
                    <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.void ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>{txStatus(p)}</span></td>
                    <td className="px-4 py-2.5 text-right">
                      {/* View / Download only — counselors can't void or delete receipts. */}
                      <button type="button" onClick={() => flash(`PDF download isn’t connected yet — ${p.receiptNo} would download here.`)} className="inline-flex items-center gap-1 rounded-md border border-grey-border px-2.5 py-1 text-xs font-medium text-navy hover:border-navy-light">
                        <Eye size={12} /> View / Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* My requests */}
      {decidedRequests.length > 0 && (
        <section className="rounded-xl border border-grey-border bg-white px-5 py-3">
          <p className="mb-2 text-xs font-semibold text-gray-500">Earlier requests</p>
          <ul className="space-y-1.5">
            {decidedRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span className={`rounded-full px-2 py-0.5 font-medium ${r.status === 'Approved' || r.status === 'Processed' ? 'bg-emerald-50 text-emerald-700' : r.status === 'Returned' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>{r.status === 'Returned' ? 'Changes requested' : r.status}</span>
                {r.kind === 'Discount' ? `Discount ${rs(r.amount)} on ${r.service}` : r.exceptionType}
                {r.decidedBy && <span className="text-gray-400">· {r.decidedBy}</span>}
                {r.decisionNote && <span className="text-gray-400">· “{r.decisionNote}”</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Request Discount */}
      {discount && (
        <Modal
          title="Request Discount"
          onClose={() => setDiscount(null)}
          footer={<>
            <button type="button" onClick={() => setDiscount(null)} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
            <button type="button" onClick={submitDiscount} disabled={!!discountError} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40"><Send size={14} /> Send request</button>
          </>}
        >
          <p className="flex gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
            <Info size={16} className="mt-0.5 flex-shrink-0" /> This request will be sent to the Branch Manager’s Approval Center. The fee will not change until approved.
          </p>
          <div>
            <label htmlFor="disc-service" className="mb-1.5 block text-xs font-semibold text-navy">Service</label>
            <select id="disc-service" value={discount.service} onChange={(e) => setDiscount({ ...discount, service: e.target.value })} className={inputClass}>
              {services.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-grey-bg px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm text-gray-600"><Lock size={12} /> Standard Fee</span>
            <span className="text-lg font-semibold tabular-nums text-navy">{rs(discountFee)}</span>
          </div>
          <div>
            <label htmlFor="disc-amount" className="mb-1.5 block text-xs font-semibold text-navy">Requested Discount Amount (Rs)</label>
            <input id="disc-amount" type="number" min={0} step={500} value={discount.amount} onChange={(e) => setDiscount({ ...discount, amount: e.target.value })} className={inputClass} />
            {discountAmount > 0 && discountAmount < discountFee && (
              <p className="mt-1 text-xs text-gray-500">Final amount if approved: <b className="text-navy">{rs(discountFee - discountAmount)}</b> ({Math.round((discountAmount / discountFee) * 100)}% off)</p>
            )}
          </div>
          <div>
            <label htmlFor="disc-reason" className="mb-1.5 block text-xs font-semibold text-navy">Reason / Justification</label>
            <textarea id="disc-reason" value={discount.reason} onChange={(e) => setDiscount({ ...discount, reason: e.target.value })} rows={3} className={`${inputClass} resize-y`} placeholder="e.g. Sibling of an existing client" />
          </div>
          {discountError && (discount.amount || discount.reason) && <p className="text-xs text-red-600">{discountError}</p>}
        </Modal>
      )}

      {/* Request Exception */}
      {exception && (
        <Modal
          title="Request Exception"
          onClose={() => setException(null)}
          footer={<>
            <button type="button" onClick={() => setException(null)} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
            <button type="button" onClick={submitException} disabled={!exception.details.trim()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40"><Send size={14} /> Send to management</button>
          </>}
        >
          <p className="text-sm text-gray-600">Ask management for a custom payment plan or more time to pay. Nothing changes until it’s approved.</p>
          <div className="grid grid-cols-2 gap-2">
            {(['Due date extension', 'Custom payment plan'] as const).map((t) => (
              <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${exception.type === t ? 'border-navy-light bg-navy/5 text-navy' : 'border-grey-border text-gray-600'}`}>
                <input type="radio" name="exc-type" checked={exception.type === t} onChange={() => setException({ ...exception, type: t })} className="accent-navy" /> {t}
              </label>
            ))}
          </div>
          {exception.type === 'Due date extension' && (
            <div>
              <label htmlFor="exc-date" className="mb-1.5 block text-xs font-semibold text-navy">Proposed new due date <span className="font-normal text-gray-400">(optional)</span></label>
              <DateInput id="exc-date" value={exception.dueDate} min={today} onChange={(dueDate) => setException({ ...exception, dueDate })} className="w-full" />
            </div>
          )}
          <div>
            <label htmlFor="exc-details" className="mb-1.5 block text-xs font-semibold text-navy">Details</label>
            <textarea id="exc-details" value={exception.details} onChange={(e) => setException({ ...exception, details: e.target.value })} rows={4} className={`${inputClass} resize-y`} placeholder="e.g. Client’s family is paying after the harvest — 3 monthly instalments of Rs 10,000 from November." />
          </div>
        </Modal>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[80] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
}
