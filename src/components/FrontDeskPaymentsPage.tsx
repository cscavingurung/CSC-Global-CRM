import { useMemo, useState } from 'react';
import { Banknote, CalendarDays, CheckCircle, Clock, Download, Eye, History, Lock, Printer, Receipt, Search, Share2, Wallet, X } from 'lucide-react';
import { FinTransaction, MockUser } from '../types';
import { useFinanceLedger } from '../financeLedger';
import { DUE_STYLES, chargeLines, clientBalances, finDayLabel, isLivePayment, methodText, methodTotals, nextReceiptNo, rs, serviceLabel, stampMs } from '../finance';
import { ReceiptData, buildReceipt, downloadReceipt, printReceipt, shareReceipt } from '../receipt';
import { dateKey, formatSubmittedAt } from '../dateTime';
import ReceiptPreview from './ReceiptPreview';

// ─── Front Desk · Payments ──────────────────────────────────────────────────
// Record a payment and issue its receipt, and look back over receipts this officer issued.
//
// SECURITY — intentionally omitted, by design: there is no edit-payment, void/delete-receipt,
// refund, discount or balance-change action (or hook to one) anywhere in this page, and no
// "more actions" menus. The Front Desk can only ADD a payment against the amount Finance says
// is due, and view / print / download / share receipts they issued themselves. Voids are a
// Branch Manager action in Financial Management; discounts and refunds go through the
// Manager Approval Center.

type View = 'Record Payment' | 'Receipt History';
type Method = 'Cash' | 'Bank Transfer' | 'Card' | 'Online';
const METHOD_OPTIONS: Method[] = ['Cash', 'Bank Transfer', 'Card', 'Online'];
/** How each method is stored in the ledger (Cash / Bank / Other, with a note). */
const METHOD_TO_LEDGER: Record<Method, Pick<FinTransaction, 'method' | 'methodNote'>> = {
  Cash: { method: 'Cash' },
  'Bank Transfer': { method: 'Bank', methodNote: 'Bank transfer' },
  Card: { method: 'Bank', methodNote: 'Card' },
  Online: { method: 'Other', methodNote: 'Online (eSewa / Khalti / Fonepay)' },
};

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

/** View / Print / Download / Share for one receipt — and nothing else. */
function ReceiptActions({ receipt, branch, onView, flash }: { receipt: ReceiptData; branch: string; onView?: () => void; flash: (m: string) => void }) {
  const btn = 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-grey-border py-2 text-sm font-medium text-navy hover:border-navy-light hover:text-navy-light';
  return (
    <div className="flex flex-wrap gap-2">
      {onView && <button type="button" onClick={onView} className={btn}><Eye size={14} /> View</button>}
      <button type="button" onClick={() => { if (!printReceipt(receipt, branch)) flash('The print window was blocked — allow pop-ups for this site.'); }} className={`${btn} border-navy bg-navy text-white hover:bg-navy-light hover:text-white`}>
        <Printer size={14} /> Print
      </button>
      <button type="button" onClick={() => { downloadReceipt(receipt, branch); flash(`${receipt.payment.receiptNo} downloaded.`); }} className={btn}><Download size={14} /> Download</button>
      <button
        type="button"
        onClick={async () => {
          const r = await shareReceipt(receipt, branch);
          flash(r === 'shared' ? 'Receipt shared.' : r === 'copied' ? 'Receipt summary copied — paste it into WhatsApp, SMS or email.' : 'Couldn’t share on this device.');
        }}
        className={btn}
      >
        <Share2 size={14} /> {onView ? 'Re-share' : 'Share'}
      </button>
    </div>
  );
}

export default function FrontDeskPaymentsPage({ currentUser }: { currentUser: MockUser }) {
  const { transactions, addTransaction, counselorOf } = useFinanceLedger();
  const today = dateKey(new Date());
  const [view, setView] = useState<View>('Record Payment');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 3500); };

  const branchTx = useMemo(() => transactions.filter((t) => t.branch === currentUser.branch), [transactions, currentUser.branch]);
  const balances = useMemo(() => clientBalances(branchTx, today), [branchTx, today]);
  const receiptFor = (p: FinTransaction) => buildReceipt(branchTx.filter((t) => t.clientId === p.clientId), p);

  // ── Record Payment ──
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('Cash');
  const [note, setNote] = useState('');
  const [issued, setIssued] = useState<ReceiptData | null>(null);

  const client = balances.find((b) => b.clientId === clientId);
  const clientTx = useMemo(() => (client ? branchTx.filter((t) => t.clientId === client.clientId) : []), [client, branchTx]);
  const owed = useMemo(() => chargeLines(clientTx).filter((l) => l.remaining > 0), [clientTx]);
  const term = query.trim().toLowerCase();
  const matches = term ? balances.filter((b) => `${b.clientName} ${b.clientId}`.toLowerCase().includes(term)).slice(0, 8) : [];
  const waiting = balances.filter((b) => b.outstanding > 0 && (b.status === 'Overdue' || b.status === 'Due'));
  const received = Number(amount) || 0;
  const error = !client ? null
    : client.outstanding <= 0 ? 'Nothing is due for this client.'
      : received > client.outstanding ? `That’s more than the ${rs(client.outstanding)} due — take the amount due only.` : null;

  const pick = (id: string) => { setClientId(id); setQuery(''); setAmount(''); setNote(''); };
  const reset = () => { setClientId(null); setAmount(''); setNote(''); setMethod('Cash'); };

  const record = () => {
    const first = owed[0]?.charge;
    if (!client || !first || received <= 0 || error) return;
    const payment: FinTransaction = {
      id: `fin-pay-${Date.now()}`, branch: currentUser.branch, kind: 'Payment',
      // Credited to whoever holds the client now — "who collects it keeps it".
      clientId: client.clientId, clientName: client.clientName, counselor: counselorOf(client.clientId) ?? client.counselor, country: first.country,
      service: first.service, title: first.title, amount: received, at: formatSubmittedAt(new Date()), by: currentUser.name,
      ...METHOD_TO_LEDGER[method], note: note.trim() || undefined, planId: first.planId, installment: first.installment,
      receiptNo: nextReceiptNo(branchTx, currentUser.branch, new Date().getFullYear()),
    };
    addTransaction(payment);
    setIssued(buildReceipt([...clientTx, payment], payment));
    reset();
  };

  // ── Receipt History (this officer's receipts only) ──
  const [hq, setHq] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const mine = useMemo(() => branchTx
    .filter((t) => t.kind === 'Payment' && t.by === currentUser.name && t.receiptNo)
    .filter((t) => !hq.trim() || `${t.receiptNo} ${t.clientName} ${t.clientId}`.toLowerCase().includes(hq.trim().toLowerCase()))
    .sort((a, b) => stampMs(b.at) - stampMs(a.at)), [branchTx, currentUser.name, hq]);
  const open = mine.find((t) => t.id === openId);

  // ── Payment summary (this officer's collections; pending is branch-wide) ──
  const allMine = useMemo(() => branchTx.filter((t) => t.kind === 'Payment' && t.by === currentUser.name), [branchTx, currentUser.name]);
  const todayMine = allMine.filter((t) => t.at.startsWith(today));
  const todayTotals = methodTotals(todayMine);
  const monthMine = allMine.filter((t) => isLivePayment(t) && t.at.startsWith(today.slice(0, 7)));
  const lastPayment = [...todayMine].filter(isLivePayment).sort((a, b) => stampMs(b.at) - stampMs(a.at))[0];
  const overdue = waiting.filter((b) => b.status === 'Overdue');

  return (
    <div className="space-y-5">
      {/* Payment summary */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-base font-semibold text-navy">Payment Summary</h2>
          <span className="text-xs text-gray-400">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · your collections</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Today’s Collection', value: rs(todayTotals.total), hint: lastPayment ? `last at ${lastPayment.at.split(' ').slice(1).join(' ')}` : 'nothing yet today', icon: <Wallet size={15} />, tone: 'text-navy' },
            { label: 'Receipts Issued Today', value: String(todayMine.filter(isLivePayment).length), hint: todayMine.some((t) => t.void) ? `${todayMine.filter((t) => t.void).length} voided by manager` : 'by you', icon: <Receipt size={15} />, tone: 'text-navy' },
            { label: 'This Month', value: rs(monthMine.reduce((n, t) => n + t.amount, 0)), hint: `${monthMine.length} receipt${monthMine.length === 1 ? '' : 's'} by you`, icon: <CalendarDays size={15} />, tone: 'text-navy' },
            { label: 'Pending Payments', value: String(waiting.length), hint: `${rs(waiting.reduce((n, b) => n + b.outstanding, 0))} due now${overdue.length ? ` · ${overdue.length} overdue` : ''}`, icon: <Clock size={15} />, tone: waiting.length ? 'text-amber-600' : 'text-gray-300' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-grey-border bg-white px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs text-gray-500">{c.icon}{c.label}</p>
              <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${c.tone}`}>{c.value}</p>
              <p className="text-[11px] text-gray-400">{c.hint}</p>
            </div>
          ))}
        </div>
        {/* Today by payment method — what the cash drawer and bank should show */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-xl border border-grey-border bg-white px-4 py-2.5 text-sm">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500"><Banknote size={14} /> Today by method</span>
          <span className="text-gray-600">Cash <b className="tabular-nums text-navy">{rs(todayTotals.Cash)}</b></span>
          <span className="text-gray-600">Bank transfer / Card <b className="tabular-nums text-navy">{rs(todayTotals.Bank)}</b></span>
          <span className="text-gray-600">Online <b className="tabular-nums text-navy">{rs(todayTotals.Other)}</b></span>
          <span className="flex items-center gap-1 text-[11px] text-gray-400 sm:ml-auto"><Lock size={11} /> Read-only · hand over cash totals to the Branch Manager at close</span>
        </div>
      </section>

      {/* View toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex self-start rounded-lg border border-grey-border bg-white p-0.5" role="tablist" aria-label="Payments">
          {(['Record Payment', 'Receipt History'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${view === v ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy-light'}`}
            >
              {v === 'Record Payment' ? <Receipt size={15} /> : <History size={15} />} {v}
            </button>
          ))}
        </div>
      </div>

      <div key={view} className="dissolve-in">
        {view === 'Record Payment' ? (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="space-y-5 rounded-xl border border-grey-border bg-white p-5">
              {/* Client search */}
              {!client ? (
                <div>
                  <label htmlFor="fd-search" className="mb-1.5 block text-sm font-semibold text-navy">Find the client</label>
                  <div className="relative">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input id="fd-search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by client name or Client ID" className={`${inputClass} py-3 pl-11 text-base`} />
                  </div>
                  {term && (
                    <ul className="mt-2 divide-y divide-grey-border rounded-lg border border-grey-border">
                      {matches.map((b) => (
                        <li key={b.clientId}>
                          <button type="button" onClick={() => pick(b.clientId)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-grey-bg">
                            <span className="min-w-0 flex-1"><span className="block text-sm text-navy">{b.clientName}</span><span className="block text-[11px] text-gray-400">{b.clientId}</span></span>
                            {b.outstanding > 0 ? <span className="text-xs font-semibold tabular-nums text-navy">{rs(b.outstanding)} due</span> : <span className="text-xs text-gray-400">Nothing due</span>}
                          </button>
                        </li>
                      ))}
                      {matches.length === 0 && <li className="px-3 py-3 text-sm text-gray-400">No client with fees on record matches “{query}”.</li>}
                    </ul>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-navy-light/40 bg-navy/5 px-4 py-3">
                    <span>
                      <span className="block text-base font-semibold text-navy">{client.clientName}</span>
                      <span className="block text-xs text-gray-500">{client.clientId} · counselor {client.counselor}</span>
                    </span>
                    <button type="button" onClick={reset} className="text-sm font-medium text-navy-light hover:text-navy">Change client</button>
                  </div>

                  {/* Amount due — read-only */}
                  <div className="rounded-xl border border-grey-border bg-grey-bg/60 px-5 py-4" title="Set by Finance — can’t be changed here">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500"><Lock size={12} /> Amount Due</p>
                    <p className="mt-0.5 text-3xl font-semibold tabular-nums text-navy">{rs(client.outstanding)}</p>
                    {client.outstanding > 0 && <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${DUE_STYLES[client.status]}`}>{client.status}</span>}
                    {owed.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-grey-border pt-2">
                        {owed.map((l) => (
                          <li key={l.charge.id} className="flex items-center gap-3 text-xs">
                            <span className="min-w-0 flex-1 text-navy">
                              {serviceLabel(l.charge)}{l.charge.planId ? ` — instalment ${l.charge.installment} of ${l.charge.installments}` : ''}
                              <span className="text-gray-400"> · due {l.charge.dueDate ? finDayLabel(l.charge.dueDate) : '—'}</span>
                            </span>
                            <span className="font-semibold tabular-nums text-navy">{rs(l.remaining)}</span>
                          </li>
                        ))}
                        <li className="pt-1 text-[11px] text-gray-400">A payment covers these in order, oldest due first.</li>
                      </ul>
                    )}
                  </div>

                  {/* Payment entry */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="fd-amount" className="mb-1.5 block text-xs font-semibold text-navy">Amount Received (Rs)</label>
                      <input id="fd-amount" type="number" min={0} step={100} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={client.outstanding <= 0} className={`${inputClass} text-base`} />
                      {client.outstanding > 0 && <button type="button" onClick={() => setAmount(String(client.outstanding))} className="mt-1 text-[11px] font-medium text-navy-light hover:text-navy">Full amount due</button>}
                    </div>
                    <div>
                      <label htmlFor="fd-method" className="mb-1.5 block text-xs font-semibold text-navy">Payment Method</label>
                      <select id="fd-method" value={method} onChange={(e) => setMethod(e.target.value as Method)} className={`${inputClass} text-base`}>
                        {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="fd-note" className="mb-1.5 block text-xs font-semibold text-navy">Note <span className="font-normal text-gray-400">(optional — printed on the receipt)</span></label>
                      <input id="fd-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="e.g. Paid to CSC Global Laxmi Bank account" className={inputClass} />
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  {received > 0 && !error && received < client.outstanding && <p className="text-xs text-gray-500">Part payment — {rs(client.outstanding - received)} will still be due.</p>}

                  <button
                    type="button"
                    onClick={record}
                    disabled={received <= 0 || !!error || owed.length === 0}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy py-3 text-base font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Receipt size={18} /> Record Payment &amp; Generate Receipt
                  </button>
                </>
              )}
            </section>

            {/* Quick picks */}
            <aside className="rounded-xl border border-grey-border bg-white">
              <p className="border-b border-grey-border px-4 py-3 text-sm font-semibold text-navy">Clients waiting for payment</p>
              {waiting.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-400">No payments due right now.</p>
              ) : (
                <ul className="divide-y divide-grey-border">
                  {waiting.map((b) => (
                    <li key={b.clientId}>
                      <button type="button" onClick={() => pick(b.clientId)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-grey-bg">
                        <span className="min-w-0 flex-1"><span className="block text-sm text-navy">{b.clientName}</span><span className="block text-[11px] text-gray-400">{b.nextDue ? `due ${finDayLabel(b.nextDue)}` : b.clientId}</span></span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DUE_STYLES[b.status]}`}>{b.status}</span>
                        <span className="text-xs font-semibold tabular-nums text-navy">{rs(b.outstanding)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        ) : (
          /* Receipt History — read-only, this officer's receipts only */
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={hq} onChange={(e) => setHq(e.target.value)} placeholder="Search receipt no., client or Client ID" className={`${inputClass} pl-9`} />
              </div>
              <p className="flex items-center gap-1 text-xs text-gray-400"><Lock size={11} /> Receipts you issued · read-only</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-grey-bg text-left">
                    {['Receipt No.', 'Client', 'Amount', 'Method', 'Date', 'Status'].map((h) => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mine.map((t) => (
                    <tr key={t.id} onClick={() => setOpenId(t.id)} className="cursor-pointer border-t border-grey-border hover:bg-grey-bg/50">
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-navy">{t.receiptNo}</td>
                      <td className="px-4 py-2.5 text-navy">{t.clientName}<span className="block text-[11px] text-gray-400">{t.clientId} · {serviceLabel(t)}</span></td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${t.void ? 'text-gray-400 line-through' : 'font-semibold text-navy'}`}>{rs(t.amount)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{methodText(t)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{t.at}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${t.void ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>{t.void ? 'Voided' : 'Issued'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mine.length === 0 && <p className="py-10 text-center text-sm text-gray-400">{hq ? 'No receipts match.' : 'You haven’t issued any receipts yet.'}</p>}
            </div>
            {mine.some((t) => t.void) && <p className="text-[11px] text-gray-400">“Voided” receipts were voided by the Branch Manager; they stay listed for the record.</p>}
          </div>
        )}
      </div>

      {/* Success — the receipt just issued */}
      {issued && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setIssued(null)} />
          <div className="dissolve-in relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-grey-border bg-white">
            <div className="flex items-center justify-between border-b border-grey-border px-6 py-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-navy"><CheckCircle size={18} className="text-emerald-600" /> Receipt {issued.payment.receiptNo} issued</h3>
              <button type="button" onClick={() => setIssued(null)} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <ReceiptPreview receipt={issued} branch={currentUser.branch} />
              <ReceiptActions receipt={issued} branch={currentUser.branch} flash={flash} />
              <button type="button" onClick={() => setIssued(null)} className="w-full text-sm font-medium text-navy-light hover:text-navy">Record another payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt view panel — View / Print / Download / Re-share only */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-navy-dark/30" onClick={() => setOpenId(null)} />
          <aside className="dissolve-in relative flex h-full w-full max-w-md flex-col border-l border-grey-border bg-white">
            <div className="flex items-center justify-between border-b border-grey-border px-5 py-4">
              <p className="text-base font-semibold text-navy">{open.receiptNo}</p>
              <button type="button" onClick={() => setOpenId(null)} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ReceiptPreview receipt={receiptFor(open)} branch={currentUser.branch} />
            </div>
            <div className="border-t border-grey-border px-5 py-4">
              <ReceiptActions
                receipt={receiptFor(open)}
                branch={currentUser.branch}
                onView={() => { if (!printReceipt(receiptFor(open), currentUser.branch, false)) flash('The receipt window was blocked — allow pop-ups for this site.'); }}
                flash={flash}
              />
            </div>
          </aside>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[80] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
}
