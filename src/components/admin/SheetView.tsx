import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, ChevronDown, Download, ExternalLink, Search, ShieldAlert, X } from 'lucide-react';
import { DATASETS, Dataset, DatasetKey, SheetRow, applyGlobal, formatCell, sheetFor } from '../../superAdmin';
import { downloadWorkbook } from '../../xlsxExport';
import GlobalFilterBar from './GlobalFilterBar';
import AuditOverrideModal from './AuditOverrideModal';
import { FinanceTabs } from './ServiceChargesPage';
import { ADMIN_BASE, useAdmin } from './adminContext';

// ─── Excel view ─────────────────────────────────────────────────────────────
// One spreadsheet-style grid for any dataset: global filters on top, then in-sheet search,
// dropdown filters, a "flagged only" toggle, sortable columns, a totals row and a real .xlsx
// download of exactly what's on screen. Query params carry presets from dashboard clicks
// (?col=status&val=Visa+Approved&flag=1&branch=Butwal&q=…).

/** Related CRM pages worth a link from a sheet. */
const RELATED: Partial<Record<DatasetKey, { label: string; navKey: string }[]>> = {
  finance: [{ label: 'Commissions', navKey: 'commissions' }],
  clients: [{ label: 'Clients page', navKey: 'students' }],
  applications: [{ label: 'Applications page', navKey: 'applications' }],
  people: [{ label: 'People page', navKey: 'staff' }],
};

const PAGE = 200;

export function Sheet({ ds, embedded }: { ds: Dataset; embedded?: boolean }) {
  const { rows: all, filters, setFilters, sources, navigateApp, onOverrideTask, flash } = useAdmin();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [branch, setBranch] = useState(params.get('branch') ?? '');
  const [quick, setQuick] = useState<Record<string, string>>(() => {
    const col = params.get('col');
    return col && ds.quick.includes(col) ? { [col]: params.get('val') ?? '' } : {};
  });
  const [flagOnly, setFlagOnly] = useState(params.get('flag') === '1');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [override, setOverride] = useState<SheetRow | null>(null);

  const scoped = useMemo(() => applyGlobal(all[ds.key], ds, filters), [all, ds, filters]);
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => {
    const out = scoped.filter((r) =>
      (!branch || r.dims.branch === branch)
      && Object.entries(quick).every(([k, v]) => !v || String(r.cells[k]) === v)
      && (!flagOnly || r.flag)
      && (!needle || Object.values(r.cells).some((v) => String(v).toLowerCase().includes(needle))));
    if (!sort) return out;
    const kind = ds.columns.find((c) => c.key === sort.key)?.kind;
    return [...out].sort((a, b) => {
      const x = a.cells[sort.key];
      const y = b.cells[sort.key];
      const cmp = kind === 'money' || kind === 'number' ? Number(x) - Number(y) : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true });
      return cmp * sort.dir;
    });
  }, [scoped, branch, quick, flagOnly, needle, sort, ds.columns]);

  const quickOptions = (key: string) => [...new Set(scoped.map((r) => String(r.cells[key] ?? '')).filter(Boolean))].sort();
  const totals = ds.columns.map((c) => (c.kind === 'money' || c.kind === 'number' ? rows.reduce((n, r) => n + (Number(r.cells[c.key]) || 0), 0) : null));
  const hasOpen = rows.some((r) => r.open);
  const isTasks = ds.key === 'tasks';
  const localActive = Boolean(needle || branch || flagOnly || Object.values(quick).some(Boolean));
  const flaggedCount = scoped.filter((r) => r.flag).length;

  const toggleSort = (key: string) => setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  const download = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadWorkbook(`CSC-${ds.title.replace(/\s+/g, '-')}-${stamp}`, [sheetFor(ds, rows)]);
    flash(`${rows.length} row${rows.length === 1 ? '' : 's'} downloaded to Excel.`);
  };

  const overrideTask = override ? sources.tasks.find((t) => `task-${t.id}` === override.id) : undefined;

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link to={ADMIN_BASE} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-navy-light hover:text-navy"><ArrowLeft size={12} /> Dashboard</Link>
            <h2 className="text-xl font-semibold text-navy">{ds.title}</h2>
            <p className="max-w-3xl text-sm text-gray-500">{ds.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(RELATED[ds.key] ?? []).map((r) => (
              <button key={r.navKey} type="button" onClick={() => navigateApp(r.navKey)} className="inline-flex items-center gap-1 rounded-lg border border-grey-border px-3 py-2 text-sm font-medium text-navy transition-colors hover:border-navy-light hover:text-navy-light">
                {r.label} <ExternalLink size={13} />
              </button>
            ))}
          </div>
        </div>
      )}

      {!embedded && ds.key === 'finance' && <FinanceTabs />}
      {!embedded && <GlobalFilterBar filters={filters} onChange={setFilters} sources={sources} dims={ds.dims} notes={ds.dimNotes} />}

      {/* Sheet toolbar */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="relative min-w-[220px] flex-1 sm:flex-none">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder={`Search ${ds.title.toLowerCase()}…`}
            className="h-9 w-full rounded-lg border border-grey-border pl-9 pr-3 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light sm:w-64" />
        </label>
        {ds.quick.map((key) => {
          const col = ds.columns.find((c) => c.key === key);
          return (
            <div key={key} className="relative">
              <select value={quick[key] ?? ''} onChange={(e) => { setQuick({ ...quick, [key]: e.target.value }); setLimit(PAGE); }} aria-label={col?.label}
                className="h-9 appearance-none rounded-lg border border-grey-border bg-white pl-3 pr-8 text-sm font-medium text-navy focus:border-navy-light focus:outline-none">
                <option value="">All {col?.label ?? key}</option>
                {quickOptions(key).map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          );
        })}
        {ds.flagLabel && (
          <button type="button" role="switch" aria-checked={flagOnly} onClick={() => setFlagOnly(!flagOnly)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${flagOnly ? 'border-red-200 bg-red-50 text-red-700' : 'border-grey-border bg-white text-navy hover:border-navy-light'}`}>
            {ds.flagLabel}
            <span className={`rounded-full px-1.5 text-[11px] ${flagOnly ? 'bg-red-100' : 'bg-red-50 text-red-700'}`}>{flaggedCount}</span>
          </button>
        )}
        {branch && (
          <button type="button" onClick={() => setBranch('')} className="inline-flex h-9 items-center gap-1 rounded-full bg-sky-100 px-3 text-xs font-medium text-sky-800 hover:bg-sky-200">
            Branch: {branch} <X size={12} />
          </button>
        )}
        {localActive && (
          <button type="button" onClick={() => { setQ(''); setBranch(''); setQuick({}); setFlagOnly(false); }} className="h-9 px-1 text-xs font-medium text-navy hover:text-navy-light">Clear sheet filters</button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-500">{rows.length.toLocaleString('en-IN')} of {scoped.length.toLocaleString('en-IN')} rows</span>
          <button type="button" onClick={download} disabled={rows.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy px-3.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light disabled:opacity-40">
            <Download size={14} /> Download Excel
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-grey-border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-grey-bg">
            <tr>
              <th className="w-10 border-b border-r border-grey-border px-2 py-2 text-right text-[11px] font-medium text-gray-400">#</th>
              {ds.columns.map((c) => {
                const active = sort?.key === c.key;
                const right = c.kind === 'money' || c.kind === 'number';
                return (
                  <th key={c.key} className={`whitespace-nowrap border-b border-r border-grey-border px-3 py-2 text-xs font-semibold text-gray-600 ${right ? 'text-right' : 'text-left'}`}>
                    <button type="button" onClick={() => toggleSort(c.key)} className={`inline-flex items-center gap-1 transition-colors hover:text-navy ${active ? 'text-navy' : ''}`}>
                      {c.label}
                      {active ? (sort!.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="text-gray-300" />}
                    </button>
                  </th>
                );
              })}
              {(hasOpen || isTasks) && <th className="border-b border-grey-border px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={ds.columns.length + 2} className="py-12 text-center text-sm text-gray-400">
                No rows match. {localActive ? 'Clear the sheet filters' : 'Widen the date range or branch'} to see more.
              </td></tr>
            )}
            {rows.slice(0, limit).map((r, i) => (
              <tr key={r.id} className={r.flag ? 'bg-red-50 text-red-700' : 'hover:bg-grey-bg/60'}>
                <td className="border-b border-r border-grey-border px-2 py-1.5 text-right text-[11px] tabular-nums text-gray-400">{i + 1}</td>
                {ds.columns.map((c) => {
                  const right = c.kind === 'money' || c.kind === 'number';
                  return (
                    <td key={c.key} className={`max-w-[280px] truncate whitespace-nowrap border-b border-r border-grey-border px-3 py-1.5 ${right ? 'text-right tabular-nums' : ''} ${r.flag ? '' : 'text-gray-700'}`} title={String(r.cells[c.key] ?? '')}>
                      {formatCell(r.cells[c.key], c.kind)}
                    </td>
                  );
                })}
                {(hasOpen || isTasks) && (
                  <td className="whitespace-nowrap border-b border-grey-border px-3 py-1.5 text-right">
                    {isTasks ? (
                      <button type="button" onClick={() => setOverride(r)} className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-navy-light"><ShieldAlert size={13} /> Override</button>
                    ) : r.open && (
                      <button type="button" onClick={() => navigateApp(r.open!.navKey, r.open!.intent)} className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-navy-light">{r.open.label} <ExternalLink size={12} /></button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && totals.some((t) => t !== null) && (
            <tfoot className="sticky bottom-0 bg-grey-bg">
              <tr>
                <td className="border-t border-r border-grey-border px-2 py-2 text-right text-[11px] font-semibold text-gray-500">Σ</td>
                {ds.columns.map((c, ci) => (
                  <td key={c.key} className={`border-t border-r border-grey-border px-3 py-2 font-semibold text-navy ${totals[ci] !== null ? 'text-right tabular-nums' : ''}`}>
                    {totals[ci] !== null ? formatCell(totals[ci]!, c.kind) : ci === 0 ? `${rows.length} rows` : ''}
                  </td>
                ))}
                {(hasOpen || isTasks) && <td className="border-t border-grey-border" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length > limit && (
        <button type="button" onClick={() => setLimit(limit + PAGE)} className="text-sm font-medium text-navy hover:text-navy-light">Show {Math.min(PAGE, rows.length - limit)} more rows</button>
      )}

      {override && overrideTask && (
        <AuditOverrideModal
          record={`Task · ${overrideTask.title} (${overrideTask.branch})`}
          field="Status"
          originalValue={overrideTask.status}
          newValue={overrideTask.status === 'Done' ? 'To Do' : 'Done'}
          onCancel={() => setOverride(null)}
          onConfirm={(reason) => {
            onOverrideTask(overrideTask.id, overrideTask.status === 'Done' ? 'To Do' : 'Done', reason);
            flash('Override applied and recorded in the audit log.');
            setOverride(null);
          }}
        />
      )}
    </div>
  );
}

/** Route element: /admin/sheet/:key */
export default function SheetView() {
  const { key } = useParams();
  const ds = DATASETS[key as DatasetKey];
  const [params] = useSearchParams();
  if (!ds) return <p className="py-12 text-center text-sm text-gray-400">Unknown view.</p>;
  // Re-mount when the preset changes so the sheet starts from the new filters.
  return <Sheet key={`${ds.key}?${params.toString()}`} ds={ds} />;
}
