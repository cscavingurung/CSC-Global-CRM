import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, FileSpreadsheet, History, Search, ShieldCheck } from 'lucide-react';
import { DATASETS, DATASET_ORDER, DatasetKey, applyGlobal, searchAll, sheetFor } from '../../superAdmin';
import { downloadWorkbook } from '../../xlsxExport';
import GlobalFilterBar from './GlobalFilterBar';
import MonthlyReportModal from './MonthlyReportModal';
import { Sheet } from './SheetView';
import { ADMIN_BASE, sheetPath, useAdmin } from './adminContext';

// ═══ Reports & Analytics ═════════════════════════════════════════════════════
export function ReportsHub() {
  const { rows, filters, setFilters, sources, flash } = useAdmin();
  const navigate = useNavigate();
  const [report, setReport] = useState(false);
  const counts = useMemo(
    () => Object.fromEntries(DATASET_ORDER.map((k) => [k, applyGlobal(rows[k], DATASETS[k], filters).length])) as Record<DatasetKey, number>,
    [rows, filters],
  );
  const downloadAll = () => {
    downloadWorkbook(`CSC-All-Data-${new Date().toISOString().slice(0, 10)}`,
      DATASET_ORDER.map((k) => sheetFor(DATASETS[k], applyGlobal(rows[k], DATASETS[k], filters))));
    flash('Every view downloaded as one Excel file (current filters).');
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-navy">Reports & Analytics</h2>
        <p className="text-sm text-gray-500">Open any dataset as a spreadsheet, or download it. Filters below apply wherever they make sense.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-grey-border bg-white p-4 sm:flex-row sm:items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy"><FileSpreadsheet size={20} /></span>
        <div className="flex-1">
          <p className="font-semibold text-navy">Monthly Report</p>
          <p className="text-sm text-gray-500">One Excel file per month — summary, branch comparison, attention items and every dataset for that month.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={downloadAll} className="inline-flex items-center gap-1.5 rounded-lg border border-grey-border px-3.5 py-2 text-sm font-medium text-navy transition-colors hover:border-navy-light">
            <Download size={14} /> All views
          </button>
          <button type="button" onClick={() => setReport(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-light">
            <FileSpreadsheet size={15} /> Monthly Report
          </button>
        </div>
      </div>

      <GlobalFilterBar filters={filters} onChange={setFilters} sources={sources} dims={['date', 'branch', 'country', 'counselor', 'department', 'intake']} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DATASET_ORDER.map((k) => {
          const ds = DATASETS[k];
          return (
            <button key={k} type="button" onClick={() => navigate(sheetPath(k))} className="group flex flex-col rounded-xl border border-grey-border bg-white p-4 text-left transition-colors hover:border-navy-light">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-navy">{ds.title}</p>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-slate-700">{counts[k].toLocaleString('en-IN')} rows</span>
              </div>
              <p className="mt-1 flex-1 text-xs text-gray-500">{ds.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-navy-light">Open Excel view <ArrowRight size={12} /></span>
            </button>
          );
        })}
      </div>
      {report && <MonthlyReportModal onClose={() => setReport(false)} />}
    </div>
  );
}

// ═══ Global search ═══════════════════════════════════════════════════════════
export function GlobalSearchPage() {
  const { rows, navigateApp } = useAdmin();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const query = params.get('q') ?? '';
  const groups = useMemo(() => searchAll(rows, query), [rows, query]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-navy">Global Search</h2>
        <p className="text-sm text-gray-500">Search clients, leads, applications, visa files, people, issues, tasks and the finance ledger at once — across every branch and all dates.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setParams(q.trim() ? { q: q.trim() } : {}); }} className="relative max-w-2xl">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Name, Client ID, receipt no., issue code, email…"
          className="h-11 w-full rounded-lg border border-grey-border pl-10 pr-24 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light" />
        <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-navy-light">Search</button>
      </form>
      {query.length > 0 && query.length < 2 && <p className="text-sm text-gray-400">Type at least 2 characters.</p>}
      {query.length >= 2 && groups.length === 0 && <p className="rounded-xl border border-grey-border bg-white py-12 text-center text-sm text-gray-400">Nothing matches “{query}”.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <section key={g.dataset} className="overflow-hidden rounded-xl border border-grey-border bg-white">
            <div className="flex items-center justify-between border-b border-grey-border px-4 py-2.5">
              <h3 className="text-sm font-semibold text-navy">{DATASETS[g.dataset].title} <span className="font-normal text-gray-400">· {g.total}</span></h3>
              <Link to={sheetPath(g.dataset, { q: query })} className="inline-flex items-center gap-1 text-xs font-medium text-navy-light hover:text-navy">
                {g.total > g.hits.length ? `All ${g.total} in Excel view` : 'Excel view'} <ArrowRight size={12} />
              </Link>
            </div>
            <ul className="divide-y divide-grey-border">
              {g.hits.map((h) => (
                <li key={h.row.id}>
                  <button type="button" onClick={() => h.row.open && navigateApp(h.row.open.navKey, h.row.open.intent)} disabled={!h.row.open}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors enabled:hover:bg-grey-bg/60 disabled:cursor-default">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy">{h.title}</span>
                      <span className="block truncate text-xs text-gray-500">{h.subtitle}</span>
                    </span>
                    {h.row.open && <ArrowRight size={14} className="shrink-0 text-gray-400" />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// ═══ System administration ═══════════════════════════════════════════════════
export function SystemAdmin() {
  const { sources, rows } = useAdmin();
  const active = sources.staff.filter((s) => s.status === 'Active').length;
  const cards = [
    { label: 'Active users', value: active, hint: `${sources.staff.length - active} inactive`, to: sheetPath('people', { col: 'status', val: 'Active' }) },
    { label: 'Branches', value: sources.branches.length, hint: 'Managed under Branches', to: undefined },
    { label: 'Roles', value: 6, hint: 'Super Admin, Marketing, Branch Manager, Front Desk, Counselor, V/A Officer', to: undefined },
    { label: 'Overrides logged', value: rows.audit.length, hint: 'Permanent audit entries', to: sheetPath('audit') },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-navy">System Administration</h2>
        <p className="text-sm text-gray-500">Users, roles and the override audit trail.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => {
          const body = (
            <>
              <span className="text-xs font-medium text-gray-500">{c.label}</span>
              <span className="mt-1 block text-2xl font-bold tabular-nums text-navy">{c.value}</span>
              <span className="mt-1 block text-[11px] text-gray-400">{c.hint}</span>
            </>
          );
          return c.to
            ? <Link key={c.label} to={c.to} className="rounded-xl border border-grey-border bg-white p-4 transition-colors hover:border-navy-light">{body}</Link>
            : <div key={c.label} className="rounded-xl border border-grey-border bg-white p-4">{body}</div>;
        })}
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-grey-border bg-white p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy"><ShieldCheck size={18} /></span>
        <p className="text-sm text-gray-600">
          <b className="text-navy">Administrative overrides</b> bypass normal permissions, so each one needs a written reason and is written here permanently.
          To try one, open <Link to={sheetPath('tasks')} className="font-medium text-navy underline hover:text-navy-light">Tasks</Link> and use <b>Override</b> on any row.
        </p>
      </div>
      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-navy"><History size={15} /> Override Audit Log</h3>
        <Sheet ds={DATASETS.audit} embedded />
      </section>
      <p className="text-[11px] text-gray-400"><Link to={ADMIN_BASE} className="hover:text-navy">← Back to the Command Center</Link></p>
    </div>
  );
}
