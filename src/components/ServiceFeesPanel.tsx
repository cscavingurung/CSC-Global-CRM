import { useState } from 'react';
import { CheckCircle, ChevronDown, Plus, Receipt, X } from 'lucide-react';
import { FinTransaction, MockUser } from '../types';
import { useFinanceLedger } from '../financeLedger';
import { CLIENT_SERVICES, finDayLabel, rs } from '../finance';
import { ALL_COUNTRIES, servicesFor } from '../servicePricing';
import { clampDateInput, dateKey, formatSubmittedAt } from '../dateTime';

// ─── Client Profile · Financials · Service Fees ──────────────────────────────
// Where a client's service fee is applied. The client's counselor (or the Branch Manager) picks the
// service; the fee is the Super Admin's current price for that service in the client's destination
// country (else the "All countries" price) from Finance → Service Charges. The fee is copied onto
// the charge with the price version it came from, so later price changes never alter an existing
// client. A special price goes through "Request Discount" and the Branch Manager's approval —
// nobody types a fee in here.

interface ServiceFeesPanelProps {
  clientId: string;
  clientName: string;
  counselor: string;
  /** The client's destination country (the one being processed, when chosen). */
  country: string;
  currentUser: MockUser;
}

const inputClass =
  'w-full appearance-none border border-grey-border rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

export default function ServiceFeesPanel({ clientId, clientName, counselor, country, currentUser }: ServiceFeesPanelProps) {
  const { transactions, addTransaction, servicePrices } = useFinanceLedger();
  const today = dateKey(new Date());
  const charges = transactions
    .filter((t) => t.clientId === clientId && t.kind === 'Charge' && (t.priceId || CLIENT_SERVICES.includes(t.service)))
    .sort((a, b) => b.at.localeCompare(a.at));
  const countries = [...new Set([country, ...servicePrices.map((p) => p.country)].filter((c) => c && c !== ALL_COUNTRIES))].sort();
  const [form, setForm] = useState<{ country: string; service: string; dueDate: string; confirmRepeat: boolean } | null>(null);
  const [toast, setToast] = useState('');

  const options = form ? servicesFor(servicePrices, form.country, today) : [];
  const chosen = options.find((o) => o.name === form?.service) ?? null;
  const title = chosen && form ? `${chosen.name} — ${form.country}` : '';
  const already = chosen ? charges.filter((c) => c.title === title) : [];
  const valid = !!form && !!chosen && form.dueDate >= today && (already.length === 0 || form.confirmRepeat);

  const open = () => {
    const first = servicesFor(servicePrices, country, today)[0]?.name ?? '';
    setForm({ country, service: first, dueDate: today, confirmRepeat: false });
  };

  const add = () => {
    if (!form || !chosen || !valid) return;
    const charge: FinTransaction = {
      id: `fin-svc-${Date.now()}`, branch: currentUser.branch, kind: 'Charge', clientId, clientName, counselor, country: form.country,
      service: chosen.price.category, title, amount: chosen.price.fee, standardFee: chosen.price.fee, priceId: chosen.price.id,
      at: formatSubmittedAt(new Date()), by: currentUser.name, dueDate: form.dueDate,
    };
    addTransaction(charge);
    setForm(null);
    setToast(`${title} (${rs(chosen.price.fee)}) added to ${clientName}’s account — the Front Desk can now collect it.`);
    window.setTimeout(() => setToast(''), 3500);
  };

  return (
    <section className="rounded-xl border border-grey-border bg-white">
      <div className="flex items-center gap-2 border-b border-grey-border px-5 py-3">
        <Receipt size={16} className="text-navy" />
        <h3 className="flex-1 text-sm font-semibold text-navy">Service Fees</h3>
        {!form && (
          <button type="button" onClick={open} className="inline-flex items-center gap-1.5 rounded-lg border border-navy px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy hover:text-white">
            <Plus size={13} /> Add Service
          </button>
        )}
      </div>
      {form && (
        <div className="space-y-3 border-b border-grey-border bg-grey-bg/40 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Country</span>
              <span className="relative block">
                <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value, service: servicesFor(servicePrices, e.target.value, today)[0]?.name ?? '', confirmRepeat: false })} className={inputClass}>
                  {countries.map((c) => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </span>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-gray-600">Service</span>
              <span className="relative block">
                <select value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value, confirmRepeat: false })} className={inputClass} disabled={options.length === 0}>
                  {options.length === 0 && <option value="">No priced services</option>}
                  {options.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Due date</span>
              <input type="date" min={today} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} onBlur={(e) => { const c = clampDateInput(e.target.value, { min: today }); if (c) setForm({ ...form, dueDate: c }); }} className={inputClass} />
            </label>
          </div>
          {chosen ? (
            <p className="rounded-lg bg-white px-3 py-2 text-sm text-navy">
              Fee: <b className="tabular-nums">{rs(chosen.price.fee)}</b>
              <span className="ml-2 text-xs text-gray-500">
                {chosen.price.country === ALL_COUNTRIES ? `standard price for all countries` : `${chosen.price.country} price`} · set by {chosen.price.setBy}, from {finDayLabel(chosen.price.effectiveFrom)}
              </span>
            </p>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">The Super Admin hasn’t set a service charge for {form.country} yet (Finance → Service Charges).</p>
          )}
          <p className="text-[11px] text-gray-500">Prices are set by the Super Admin. A different price for this client? Add the service, then use <b>Request Discount</b> — the Branch Manager approves it.</p>
          {already.length > 0 && (
            <label className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <input type="checkbox" checked={form.confirmRepeat} onChange={(e) => setForm({ ...form, confirmRepeat: e.target.checked })} className="mt-0.5 accent-navy" />
              {clientName} already has {title} ({rs(already[0].amount)}, added {finDayLabel(already[0].at.slice(0, 10))} by {already[0].by}). Tick to add it again as a separate service.
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="inline-flex items-center gap-1 rounded-lg border border-grey-border px-3 py-2 text-sm font-medium text-navy hover:bg-grey-bg"><X size={14} /> Cancel</button>
            <button type="button" onClick={add} disabled={!valid} className="rounded-lg bg-navy px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40">
              {chosen ? `Add ${rs(chosen.price.fee)} charge` : 'Add charge'}
            </button>
          </div>
        </div>
      )}
      {charges.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400">No service assigned yet — add one so the fee can be collected.</p>
      ) : (
        <ul className="divide-y divide-grey-border">
          {charges.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="flex-1 text-navy">{c.title ?? c.service}</span>
              <span className="text-xs text-gray-400">{c.by} · {c.at.slice(0, 10)}{c.dueDate ? ` · due ${finDayLabel(c.dueDate)}` : ''}</span>
              <span className="w-24 text-right font-semibold tabular-nums text-navy">{rs(c.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[80] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" /> {toast}
        </div>
      )}
    </section>
  );
}
