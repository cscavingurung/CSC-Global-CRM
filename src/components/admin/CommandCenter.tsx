import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, ArrowRight, BarChart3, CheckCircle2, Download, FileSpreadsheet } from 'lucide-react';
import { AttentionItem, BranchPerf, DATASETS, DatasetKey, Metric, Preset, attention, branchPerformance, metrics } from '../../superAdmin';
import { rs } from '../../finance';
import { downloadWorkbook } from '../../xlsxExport';
import GlobalFilterBar from './GlobalFilterBar';
import MonthlyReportModal from './MonthlyReportModal';
import { ADMIN_BASE, sheetPath, useAdmin } from './adminContext';

// ─── Command Center (Super Admin dashboard) ─────────────────────────────────
// Raw operational numbers only — no scores. Every number is clickable and opens the Excel view of
// exactly the rows behind it, with the same filters applied.

const presetParams = (p?: Preset, branch?: string) => ({
  col: p?.column, val: p?.value, flag: p?.flagOnly ? '1' : undefined, branch,
});

function MetricCard({ m, onOpen }: { m: Metric; onOpen: () => void }) {
  const tone = m.tone === 'red' && m.value !== 0 ? 'text-red-700' : m.tone === 'green' && m.value > 0 ? 'text-emerald-700' : 'text-navy';
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col rounded-xl border border-grey-border bg-white p-4 text-left transition-colors hover:border-navy-light">
      <span className="text-xs font-medium text-gray-500">{m.label}</span>
      <span className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{m.money ? rs(m.value) : m.value.toLocaleString('en-IN')}</span>
      <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-[11px] text-gray-400">
        {m.hint}
        <span className="inline-flex items-center gap-0.5 font-medium text-navy-light opacity-0 transition-opacity group-hover:opacity-100">View rows <ArrowRight size={11} /></span>
      </span>
    </button>
  );
}

function AttentionRow({ a, onOpen }: { a: AttentionItem; onOpen: () => void }) {
  const critical = a.severity === 'critical';
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-grey-bg/60">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${critical ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
          {critical ? <AlertOctagon size={16} /> : <AlertTriangle size={16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-navy">{a.title}</span>
          <span className="block truncate text-xs text-gray-500">{a.detail}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${critical ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{critical ? 'Critical' : 'Warning'}</span>
        <ArrowRight size={14} className="shrink-0 text-gray-400" />
      </button>
    </li>
  );
}

const PERF_COLS: { key: keyof Omit<BranchPerf, 'branch'>; label: string; money?: boolean; dataset: DatasetKey; preset?: Preset }[] = [
  { key: 'leads', label: 'Leads', dataset: 'leads' },
  { key: 'clients', label: 'Clients', dataset: 'clients' },
  { key: 'applications', label: 'Applications', dataset: 'applications' },
  { key: 'visaApproved', label: 'Visa Approved', dataset: 'visa', preset: { column: 'status', value: 'Visa Approved' } },
  { key: 'revenue', label: 'Revenue', money: true, dataset: 'finance', preset: { column: 'type', value: 'Payment' } },
  { key: 'outstanding', label: 'Outstanding', money: true, dataset: 'outstanding' },
];

export default function CommandCenter() {
  const { rows, filters, setFilters, sources, flash } = useAdmin();
  const navigate = useNavigate();
  const [report, setReport] = useState(false);

  const m = useMemo(() => metrics(rows, filters), [rows, filters]);
  const att = useMemo(() => attention(rows, filters.branch), [rows, filters.branch]);
  const perf = useMemo(() => branchPerformance(rows, filters, sources.branches.map((b) => b.name)), [rows, filters, sources.branches]);
  const total = (k: keyof Omit<BranchPerf, 'branch'>) => perf.reduce((n, p) => n + p[k], 0);
  const critical = att.filter((a) => a.severity === 'critical').length;

  const open = (dataset: DatasetKey, preset?: Preset, branch?: string) => navigate(sheetPath(dataset, presetParams(preset, branch)));
  const fmt = (v: number, money?: boolean) => (money ? rs(v) : v.toLocaleString('en-IN'));

  const downloadPerf = () => {
    downloadWorkbook(`CSC-Branch-Performance-${new Date().toISOString().slice(0, 10)}`, [{
      name: 'Branch Performance',
      headers: ['Branch', ...PERF_COLS.map((c) => c.label)],
      rows: [...perf.map((p) => [p.branch === 'Unrouted' ? 'Not yet routed (Marketing)' : p.branch, ...PERF_COLS.map((c) => p[c.key])]), ['Total', ...PERF_COLS.map((c) => total(c.key))]],
    }]);
    flash('Branch performance downloaded to Excel.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-navy">Command Center</h2>
          <p className="text-sm text-gray-500">Company-wide numbers. Click any number to see the rows behind it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate(`${ADMIN_BASE}/reports`)} className="inline-flex items-center gap-1.5 rounded-lg border border-grey-border px-3.5 py-2 text-sm font-medium text-navy transition-colors hover:border-navy-light hover:text-navy-light">
            <BarChart3 size={15} /> All Reports
          </button>
          <button type="button" onClick={() => setReport(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-light">
            <FileSpreadsheet size={15} /> Monthly Report
          </button>
        </div>
      </div>

      <GlobalFilterBar
        filters={filters}
        onChange={setFilters}
        sources={sources}
        dims={['date', 'branch', 'country', 'counselor', 'intake']}
        notes={{ department: 'Department applies to the People, Tasks and Issues views.' }}
      />

      {/* 1. Business overview */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-navy">Business Overview</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {m.map((x) => <MetricCard key={x.key} m={x} onOpen={() => open(x.dataset, x.preset)} />)}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* 2. Today's attention */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy">Today’s Attention</h3>
            {att.length > 0 && <span className="text-xs text-gray-500">{critical} critical · {att.length - critical} warning</span>}
          </div>
          <div className="overflow-hidden rounded-xl border border-grey-border bg-white">
            {att.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-emerald-700"><CheckCircle2 size={16} /> Nothing needs Super Admin attention{filters.branch ? ` at ${filters.branch}` : ''}.</p>
            ) : (
              <ul className="divide-y divide-grey-border">
                {att.map((a) => <AttentionRow key={a.id} a={a} onOpen={() => open(a.dataset, a.preset, a.branch)} />)}
              </ul>
            )}
          </div>
          <p className="text-[11px] text-gray-400">Live as of now — follows the Branch filter, not the date range.</p>
        </section>

        {/* 3. Branch performance */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy">Branch Performance</h3>
            <button type="button" onClick={downloadPerf} className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-navy-light"><Download size={13} /> Excel</button>
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-grey-border bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-grey-bg">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Branch</th>
                  {PERF_COLS.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-gray-500">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {perf.map((p) => (
                  <tr key={p.branch} className="border-b border-grey-border last:border-0 hover:bg-grey-bg/50">
                    <td className="px-4 py-2.5">
                      {p.branch === 'Unrouted' ? (
                        <span className="text-gray-500" title="Marketing leads not yet assigned to a branch">Not yet routed</span>
                      ) : (
                        <button type="button" onClick={() => setFilters({ ...filters, branch: filters.branch === p.branch ? '' : p.branch, counselor: '' })}
                          title={filters.branch === p.branch ? 'Show all branches' : `Filter the dashboard to ${p.branch}`}
                          className="font-medium text-navy hover:text-navy-light">{p.branch}</button>
                      )}
                    </td>
                    {PERF_COLS.map((c) => (
                      <td key={c.key} className="px-3 py-2.5 text-right tabular-nums">
                        <button type="button" onClick={() => open(c.dataset, c.preset, p.branch)} title={`${DATASETS[c.dataset].title} · ${p.branch}`}
                          className={`hover:text-navy-light hover:underline ${c.key === 'outstanding' && p.outstanding > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                          {fmt(p[c.key], c.money)}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {perf.length > 1 && (
                <tfoot className="bg-grey-bg">
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-500">All branches</td>
                    {PERF_COLS.map((c) => <td key={c.key} className="px-3 py-2.5 text-right font-semibold tabular-nums text-navy">{fmt(total(c.key), c.money)}</td>)}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {perf.map((p) => (
              <div key={p.branch} className="rounded-xl border border-grey-border bg-white p-4">
                <p className="mb-2 font-semibold text-navy">{p.branch === 'Unrouted' ? 'Not yet routed' : p.branch}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {PERF_COLS.map((c) => (
                    <button key={c.key} type="button" onClick={() => open(c.dataset, c.preset, p.branch)} className="rounded-lg bg-grey-bg px-2 py-1.5 text-left">
                      <span className="block text-gray-400">{c.label}</span>
                      <span className="font-semibold tabular-nums text-navy">{fmt(p[c.key], c.money)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">Click a branch name to filter the whole dashboard; click a number to open its rows.</p>
        </section>
      </div>

      {report && <MonthlyReportModal onClose={() => setReport(false)} />}
    </div>
  );
}
