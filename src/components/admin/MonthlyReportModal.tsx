import { useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, X } from 'lucide-react';
import { monthlyReport } from '../../superAdmin';
import { dateKey } from '../../dateTime';
import { downloadWorkbook } from '../../xlsxExport';
import { useAdmin } from './adminContext';

// One click → one Excel workbook for a month: Summary, Branch Performance, Attention, then the
// month's Leads, Clients, Applications, Visa, Finance, Outstanding, Approvals, Tasks and Issues.

const SHEETS = ['Summary', 'Branch Performance', 'Attention', 'Leads', 'Converted Clients', 'Applications', 'Visa Cases', 'Finance Ledger', 'Outstanding Balances', 'Approvals', 'Tasks', 'Issues'];

export default function MonthlyReportModal({ onClose }: { onClose: () => void }) {
  const { rows, sources, filters, flash } = useAdmin();
  const thisMonth = dateKey(new Date()).slice(0, 7);
  const last = new Date();
  last.setDate(1);
  last.setMonth(last.getMonth() - 1);
  const lastMonth = dateKey(last).slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [branch, setBranch] = useState(filters.branch);
  const branches = sources.branches.map((b) => b.name);
  const label = month ? new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '';

  const download = () => {
    const report = monthlyReport(rows, month, branch, branches);
    downloadWorkbook(report.filename, report.sheets);
    flash(`${label} report downloaded — ${report.sheets.length} sheets.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Monthly Report" className="dissolve-in relative w-full max-w-md rounded-2xl border border-grey-border bg-white">
        <div className="flex items-center justify-between border-b border-grey-border px-6 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-navy"><FileSpreadsheet size={18} /> Download Monthly Report</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 transition-colors hover:text-navy-light"><X size={18} /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">Month</span>
            <div className="flex flex-wrap items-center gap-2">
              {[{ v: thisMonth, l: 'This month' }, { v: lastMonth, l: 'Last month' }].map((o) => (
                <button key={o.v} type="button" onClick={() => setMonth(o.v)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${month === o.v ? 'border-navy bg-navy text-white' : 'border-grey-border text-gray-600 hover:bg-grey-bg'}`}>{o.l}</button>
              ))}
              <input type="month" value={month} max={thisMonth} onChange={(e) => setMonth(e.target.value)}
                className="h-9 rounded-lg border border-grey-border px-3 text-sm text-navy focus:border-navy-light focus:outline-none" />
            </div>
            {month === thisMonth && <p className="mt-1 text-[11px] text-gray-400">Month to date — figures up to today.</p>}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Branch</span>
            <div className="relative">
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className="h-10 w-full appearance-none rounded-lg border border-grey-border bg-white pl-3 pr-9 text-sm font-medium text-navy focus:border-navy-light focus:outline-none">
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b}>{b}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </label>
          <div className="rounded-xl bg-grey-bg px-4 py-3">
            <p className="mb-1.5 text-xs font-medium text-gray-500">One Excel file with {SHEETS.length} sheets</p>
            <p className="text-xs leading-relaxed text-gray-600">{SHEETS.join(' · ')}</p>
          </div>
        </div>
        <div className="flex gap-2 border-t border-grey-border px-6 py-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy transition-colors hover:border-navy-light">Cancel</button>
          <button type="button" onClick={download} disabled={!month} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light disabled:opacity-40">
            <Download size={15} /> Download {label}
          </button>
        </div>
      </div>
    </div>
  );
}
