import { useState } from 'react';
import { CheckCircle, FilePlus2, Plus, X } from 'lucide-react';
import { FinService, FinTransaction, MockUser } from '../types';
import { useFinanceLedger } from '../financeLedger';
import { clientBalances, finDayLabel, rs, serviceLabel } from '../finance';
import { dateKey, formatSubmittedAt } from '../dateTime';

// ─── Client Profile · Financials · Document & Processing Charges (V/A Officer) ──
// Procedural fees the V/A Officer adds without Branch Manager approval. Adding one appends a new
// Charge line to the client's finance ledger, which raises their Outstanding Balance straight
// away — so it appears for the Front Desk to collect (Record Payment, Clients Waiting for
// Payment) and in Financial Management.

interface DocumentChargesPanelProps {
  clientId: string;
  clientName: string;
  counselor: string;
  country: string;
  currentUser: MockUser;
}

// Suggestions only — the V/A Officer can type any charge title.
const CHARGE_SUGGESTIONS = ['Translation Fee', 'Courier Fee', 'Notary Fee', 'Legalization Fee', 'Police Report Fee', 'Embassy Appointment Fee'];

/** Ledger service for a typed title: known document fees keep their own service (so reports
 * group them), anything else is an "Other Charge" carrying the typed title. */
function serviceForTitle(title: string): FinService {
  const t = title.toLowerCase();
  if (t.includes('translat')) return 'Document Translation';
  if (t.includes('courier')) return 'Courier Fee';
  if (t.includes('notar')) return 'Notary Fee';
  if (t.includes('legali')) return 'Legalization Fee';
  return 'Other Charge';
}
const DOC_SERVICES = new Set<FinService>(['Document Translation', 'Courier Fee', 'Notary Fee', 'Legalization Fee', 'Other Charge']);

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

export default function DocumentChargesPanel({ clientId, clientName, counselor, country, currentUser }: DocumentChargesPanelProps) {
  const { transactions, addTransaction } = useFinanceLedger();
  const today = dateKey(new Date());
  const ledger = transactions.filter((t) => t.clientId === clientId);
  const outstanding = clientBalances(ledger, today)[0]?.outstanding ?? 0;
  const charges = ledger.filter((t) => t.kind === 'Charge' && DOC_SERVICES.has(t.service)).sort((a, b) => b.at.localeCompare(a.at));
  const [form, setForm] = useState<{ title: string; amount: string; notes: string } | null>(null);
  const [toast, setToast] = useState('');

  const addCharge = () => {
    const title = form?.title.trim() ?? '';
    const amount = Number(form?.amount) || 0;
    if (!form || !title || amount <= 0) return;
    const charge: FinTransaction = {
      id: `fin-doc-${Date.now()}`, branch: currentUser.branch, kind: 'Charge', clientId, clientName, counselor, country,
      service: serviceForTitle(title), title, amount, at: formatSubmittedAt(new Date()), by: currentUser.name, dueDate: today,
      reason: form.notes.trim() || undefined,
    };
    addTransaction(charge);
    setForm(null);
    setToast(`${title} (${rs(amount)}) added to ${clientName}’s ledger — Outstanding Balance is now ${rs(outstanding + amount)} for the Front Desk to collect.`);
    window.setTimeout(() => setToast(''), 4000);
  };

  return (
    <section className="rounded-xl border border-grey-border bg-white">
      <div className="flex items-center gap-2 border-b border-grey-border px-5 py-3">
        <FilePlus2 size={16} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-navy">Document &amp; Processing Charges</h3>
        {!form && (
          <button type="button" onClick={() => setForm({ title: '', amount: '', notes: '' })} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-navy px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy hover:text-white">
            <Plus size={13} /> Add New Charge
          </button>
        )}
      </div>
      {form && (
        <div className="dissolve-in grid grid-cols-1 gap-2 border-b border-grey-border bg-grey-bg/40 px-5 py-3 sm:grid-cols-[220px_130px_minmax(0,1fr)_auto]">
          <input
            autoFocus
            list="doc-charge-suggestions"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Charge title, e.g. Translation Fee"
            aria-label="Charge title"
            maxLength={60}
            className={inputClass}
          />
          <datalist id="doc-charge-suggestions">
            {CHARGE_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>
          <input type="number" min={0} step={100} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount (Rs)" aria-label="Amount" className={inputClass} />
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes, e.g. 4 transcripts — Nepali to English" aria-label="Notes" className={inputClass} />
          <div className="flex gap-2">
            <button type="button" onClick={addCharge} disabled={!form.title.trim() || !(Number(form.amount) > 0)} className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40">Add</button>
            <button type="button" onClick={() => setForm(null)} aria-label="Cancel" className="rounded-lg border border-grey-border px-2 text-gray-400 hover:text-navy"><X size={15} /></button>
          </div>
          <p className="text-[11px] text-gray-500 sm:col-span-4">Added straight to the client’s ledger (no approval needed) and raises their outstanding balance for the Front Desk to collect.</p>
        </div>
      )}
      {charges.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400">No document or processing charges yet.</p>
      ) : (
        <ul className="divide-y divide-grey-border">
          {charges.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="text-navy">{serviceLabel(c)}</span>
                <span className="block text-[11px] text-gray-400">added by {c.by} · {c.at}{c.reason ? ` · ${c.reason}` : ''}</span>
              </span>
              <span className="text-xs text-gray-500">due {c.dueDate ? finDayLabel(c.dueDate) : '—'}</span>
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
