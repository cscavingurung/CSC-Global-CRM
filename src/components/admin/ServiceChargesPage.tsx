import { Fragment, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Ban, ChevronDown, Download, History, Pencil, Plus, RotateCcw, Search, X } from 'lucide-react';
import { FinService, ServicePrice } from '../../types';
import { ALL_COUNTRIES, PRICE_CATEGORIES, PriceRow, SUGGESTED_SERVICES, priceRows } from '../../servicePricing';
import { COUNTRIES } from '../../mockData';
import { finDayLabel, rs } from '../../finance';
import { clampDateInput, dateKey, formatSubmittedAt } from '../../dateTime';
import { downloadWorkbook } from '../../xlsxExport';
import { ADMIN_BASE, useAdmin } from './adminContext';

// ─── Super Admin · Finance · Service Charges ────────────────────────────────
// The price list every client fee comes from: a fee per service (visa type) and destination
// country, with an "All countries" price as the fallback. Changing a fee or retiring a service
// saves a new version from a chosen date — existing clients keep the fee they were charged, and
// the full history stays visible. Counselors and Branch Managers only apply these prices; special
// prices go through discount approval by the Branch Manager.

export function FinanceTabs() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `-mb-px inline-flex shrink-0 items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-navy-light'}`;
  return (
    <nav aria-label="Finance sections" className="flex gap-1 border-b border-grey-border">
      <NavLink to={`${ADMIN_BASE}/finance`} end className={tab}>Service Charges</NavLink>
      <NavLink to={`${ADMIN_BASE}/sheet/finance`} className={tab}>Finance Ledger</NavLink>
    </nav>
  );
}

type Draft = { mode: 'add' | 'change' | 'retire' | 'restore'; name: string; category: FinService; country: string; fee: string; effectiveFrom: string; note: string };

const inputCls = 'w-full rounded-lg border border-grey-border bg-white px-3 py-2.5 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light';

export default function ServiceChargesPage() {
  const { sources, me, onAddPrice, flash } = useAdmin();
  const prices = sources.servicePrices;
  const today = dateKey(new Date());
  const rows = useMemo(() => priceRows(prices, today), [prices, today]);
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('');
  const [showRetired, setShowRetired] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const countryOptions = [...new Set([...COUNTRIES, ...prices.map((p) => p.country)].filter((c) => c !== ALL_COUNTRIES))].sort();
  const serviceNames = [...new Set([...SUGGESTED_SERVICES, ...prices.map((p) => p.name)])].sort();
  const categoryOf = (r: PriceRow) => (r.current ?? r.history[0]).category;
  const visible = rows.filter((r) => (showRetired || r.current || r.upcoming)
    && (!country || r.country === country) && (!category || categoryOf(r) === category)
    && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())));
  const priced = rows.filter((r) => r.current);
  const scheduled = rows.filter((r) => r.upcoming).length;
  const retired = rows.filter((r) => !r.current && !r.upcoming).length;

  const start = (mode: Draft['mode'], r?: PriceRow) => {
    setError('');
    const base = r?.current ?? r?.history[0];
    setDraft({
      mode, name: r?.name ?? '', category: base?.category ?? 'Visa Processing', country: r?.country ?? ALL_COUNTRIES,
      fee: base ? String(base.fee) : '', effectiveFrom: today, note: '',
    });
  };

  const save = () => {
    if (!draft) return;
    const fee = Number(draft.fee);
    if (!draft.name.trim()) { setError('Enter the service name.'); return; }
    if (!(fee >= 0) || draft.fee === '') { setError('Enter the fee.'); return; }
    if (!draft.effectiveFrom || draft.effectiveFrom < today) { setError('Choose today or a later date — past fees stay as charged.'); return; }
    if ((draft.mode === 'retire' || draft.mode === 'change') && !draft.note.trim()) { setError('Add a short reason — it’s kept in the price history.'); return; }
    const existing = rows.find((r) => r.name.toLowerCase() === draft.name.trim().toLowerCase() && r.country.toLowerCase() === draft.country.toLowerCase());
    if (draft.mode === 'add' && existing?.current) { setError(`${draft.name} for ${draft.country} already has a price — use “Change fee”.`); return; }
    const price: ServicePrice = {
      id: `price-${Date.now()}`, name: draft.name.trim(), category: draft.category, country: draft.country, fee, currency: 'NPR',
      effectiveFrom: draft.effectiveFrom, active: draft.mode !== 'retire', note: draft.note.trim() || undefined, setBy: me, setAt: formatSubmittedAt(new Date()),
    };
    onAddPrice(price);
    flash(draft.mode === 'retire' ? `${price.name} (${price.country}) retired from ${finDayLabel(price.effectiveFrom)}.`
      : `${price.name} (${price.country}) set to ${rs(fee)} from ${finDayLabel(price.effectiveFrom)}.`);
    setDraft(null);
  };

  const download = () => {
    downloadWorkbook(`CSC-Service-Charges-${today}`, [
      {
        name: 'Current prices',
        headers: ['Service', 'Country', 'Category', 'Fee (NPR)', 'Effective from', 'Set by', 'Next change'],
        rows: priced.map((r) => [r.name, r.country, r.current!.category, r.current!.fee, r.current!.effectiveFrom, r.current!.setBy,
          r.upcoming ? `${r.upcoming.active ? r.upcoming.fee : 'Retired'} from ${r.upcoming.effectiveFrom}` : '']),
      },
      {
        name: 'History',
        headers: ['Service', 'Country', 'Category', 'Fee (NPR)', 'Status', 'Effective from', 'Set by', 'Set at', 'Reason'],
        rows: [...prices].sort((a, b) => a.name.localeCompare(b.name) || a.country.localeCompare(b.country) || b.effectiveFrom.localeCompare(a.effectiveFrom))
          .map((p) => [p.name, p.country, p.category, p.fee, p.active ? 'Active' : 'Retired', p.effectiveFrom, p.setBy, p.setAt, p.note ?? '']),
      },
    ]);
    flash('Service charges downloaded to Excel.');
  };

  const title = draft?.mode === 'add' ? 'Add Service Charge' : draft?.mode === 'change' ? 'Change Fee' : draft?.mode === 'retire' ? 'Retire Service' : 'Re-activate Service';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-navy">Finance</h2>
        <p className="text-sm text-gray-500">Set the fee for each service and destination country. Counselors apply these prices to clients; Branch Managers approve discounts.</p>
      </div>
      <FinanceTabs />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Services priced', priced.length, 'service + country prices in effect'],
          ['Countries with own prices', new Set(priced.map((r) => r.country).filter((c) => c !== ALL_COUNTRIES)).size, 'others use the All countries price'],
          ['Changes scheduled', scheduled, 'future-dated fees'],
          ['Retired', retired, 'kept in history'],
        ].map(([label, value, hint]) => (
          <div key={label as string} className="rounded-xl border border-grey-border bg-white px-4 py-3">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-navy">{value}</p>
            <p className="text-[11px] text-gray-400">{hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="relative min-w-[200px] flex-1 sm:flex-none">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services…" className="h-9 w-full rounded-lg border border-grey-border pl-9 pr-3 text-sm text-navy focus:border-navy-light focus:outline-none sm:w-56" />
        </label>
        {[
          { v: country, set: setCountry, all: 'All Countries', opts: [ALL_COUNTRIES, ...countryOptions] },
          { v: category, set: setCategory, all: 'All Categories', opts: PRICE_CATEGORIES as string[] },
        ].map((f) => (
          <div key={f.all} className="relative">
            <select value={f.v} onChange={(e) => f.set(e.target.value)} className="h-9 appearance-none rounded-lg border border-grey-border bg-white pl-3 pr-8 text-sm font-medium text-navy focus:border-navy-light focus:outline-none">
              <option value="">{f.all}</option>
              {f.opts.map((o) => <option key={o}>{o}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        ))}
        <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-grey-border bg-white px-3 text-sm text-navy">
          <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} className="accent-navy" /> Show retired
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={download} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-grey-border px-3 text-sm font-medium text-navy hover:border-navy-light"><Download size={14} /> Excel</button>
          <button type="button" onClick={() => start('add')} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy px-3.5 text-sm font-semibold text-white hover:bg-navy-light"><Plus size={15} /> Add Service Charge</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-grey-bg">
            <tr>
              {['Service', 'Country', 'Category', 'Fee', 'Effective from', 'Set by', 'Next change', ''].map((h) => (
                <th key={h} className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-gray-500 ${h === 'Fee' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-400">{prices.length ? 'No service charges match these filters.' : 'No service charges yet — add the first one.'}</td></tr>}
            {visible.map((r) => {
              const v = r.current ?? r.history[0];
              const isOpen = openKey === r.key;
              return (
                <Fragment key={r.key}>
                  <tr className={`border-t border-grey-border ${r.current ? '' : 'text-gray-400'}`}>
                    <td className="px-4 py-2.5 font-medium text-navy">{r.name}</td>
                    <td className="px-4 py-2.5">
                      {r.country === ALL_COUNTRIES ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">All countries</span> : r.country}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{v.category}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-navy">
                      {r.current ? rs(r.current.fee) : <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">Retired</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{r.current ? finDayLabel(r.current.effectiveFrom) : '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{v.setBy}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {r.upcoming
                        ? <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">{r.upcoming.active ? rs(r.upcoming.fee) : 'Retires'} from {finDayLabel(r.upcoming.effectiveFrom)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-3">
                        {r.current ? (
                          <>
                            <button type="button" onClick={() => start('change', r)} className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-navy-light"><Pencil size={12} /> Change fee</button>
                            <button type="button" onClick={() => start('retire', r)} className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"><Ban size={12} /> Retire</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => start('restore', r)} className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-navy-light"><RotateCcw size={12} /> Re-activate</button>
                        )}
                        <button type="button" onClick={() => setOpenKey(isOpen ? null : r.key)} aria-expanded={isOpen} className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-navy">
                          <History size={12} /> {r.history.length}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-grey-bg/50">
                      <td colSpan={8} className="px-4 py-3">
                        <ol className="space-y-1.5">
                          {r.history.map((h) => (
                            <li key={h.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                              <span className="w-28 font-medium text-navy">from {finDayLabel(h.effectiveFrom)}</span>
                              <span className="w-24 tabular-nums">{h.active ? rs(h.fee) : 'Retired'}</span>
                              <span>{h.setBy} · {h.setAt}</span>
                              {h.note && <span className="text-gray-400">— {h.note}</span>}
                              {h === r.current && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">In effect</span>}
                              {h === r.upcoming && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">Scheduled</span>}
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400">A client’s fee is the price for their destination country, else the All countries price. It’s copied onto the client’s charge when assigned — changing a price here never changes existing clients.</p>

      {draft && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setDraft(null)} />
          <div role="dialog" aria-modal="true" aria-label={title} className="dissolve-in relative w-full max-w-md rounded-2xl border border-grey-border bg-white">
            <div className="flex items-center justify-between border-b border-grey-border px-6 py-4">
              <h3 className="text-base font-semibold text-navy">{title}</h3>
              <button type="button" onClick={() => setDraft(null)} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
            </div>
            <div className="space-y-3 px-6 py-5">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Service (visa / application type)</span>
                <input list="service-names" value={draft.name} disabled={draft.mode !== 'add'} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Student Visa + SOWP" className={`${inputCls} disabled:bg-grey-bg`} />
                <datalist id="service-names">{serviceNames.map((n) => <option key={n} value={n} />)}</datalist>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Country</span>
                  <select value={draft.country} disabled={draft.mode !== 'add'} onChange={(e) => setDraft({ ...draft, country: e.target.value })} className={`${inputCls} disabled:bg-grey-bg`}>
                    <option>{ALL_COUNTRIES}</option>
                    {countryOptions.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Category (for reports)</span>
                  <select value={draft.category} disabled={draft.mode !== 'add'} onChange={(e) => setDraft({ ...draft, category: e.target.value as FinService })} className={`${inputCls} disabled:bg-grey-bg`}>
                    {PRICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {draft.mode !== 'retire' && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Fee (NPR)</span>
                    <input type="number" min={0} step={500} value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} className={inputCls} />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">{draft.mode === 'retire' ? 'Retire from' : 'Effective from'}</span>
                  <input type="date" min={today} value={draft.effectiveFrom} onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })} onBlur={(e) => { const c = clampDateInput(e.target.value, { min: today }); if (c) setDraft({ ...draft, effectiveFrom: c }); }} className={inputCls} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Reason {draft.mode === 'change' || draft.mode === 'retire' ? '(required)' : '(optional)'}</span>
                <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. Embassy fee increase" className={inputCls} />
              </label>
              {draft.mode !== 'add' && <p className="text-[11px] text-gray-500">Saved as a new version — the current price stays in the history, and clients already charged keep their fee.</p>}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex gap-2 border-t border-grey-border px-6 py-4">
              <button type="button" onClick={() => setDraft(null)} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
              <button type="button" onClick={save} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ${draft.mode === 'retire' ? 'bg-red-600 hover:bg-red-700' : 'bg-navy hover:bg-navy-light'}`}>
                {draft.mode === 'retire' ? 'Retire Service' : 'Save Price'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
