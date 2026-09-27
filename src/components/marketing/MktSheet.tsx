import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download, LayoutGrid, Search, Sheet, X } from 'lucide-react';
import { downloadSheet } from '../../exportSheet';
import { isoToday } from '../../marketingDept';
import type { SheetColumn, ViewMode } from './mktUtils';

/** "Simple | Excel sheet" switch — same control as the Front Desk client list. */
export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const btn = (mode: ViewMode, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      aria-pressed={value === mode}
      onClick={() => onChange(mode)}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${value === mode ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
    >
      {icon} {label}
    </button>
  );
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-grey-border bg-white p-0.5">
      {btn('simple', <LayoutGrid size={14} />, 'Simple')}
      {btn('sheet', <Sheet size={14} />, 'Excel sheet')}
    </div>
  );
}

interface ExcelSheetProps<T> {
  columns: SheetColumn<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  /** Download name, without date or extension. */
  filename: string;
  onRowClick?: (r: T) => void;
  /** Soft row tint for rows that need attention. */
  rowTone?: (r: T) => 'red' | 'amber' | undefined;
  emptyText?: string;
}

const cellText = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v));

/**
 * Spreadsheet view: row numbers, frozen header and first column, click-to-sort headers,
 * a quick filter across every cell, show/hide columns, totals for numeric columns, and a
 * one-click download of exactly what's on screen (opens in Excel).
 */
export function ExcelSheet<T>({ columns, rows, rowKey, filename, onRowClick, rowTone, emptyText = 'No rows.' }: ExcelSheetProps<T>) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.hidden).map((c) => c.key)));
  const [menu, setMenu] = useState(false);

  const visible = columns.filter((c) => !hidden.has(c.key));
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = needle ? rows.filter((r) => columns.some((c) => cellText(c.value(r)).toLowerCase().includes(needle))) : [...rows];
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        const key = col.sort ?? col.value;
        out.sort((a, b) => {
          const x = key(a); const y = key(b);
          const ex = x === null || x === undefined || x === ''; const ey = y === null || y === undefined || y === '';
          if (ex || ey) return ex === ey ? 0 : ex ? 1 : -1; // blanks always last
          return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
        });
      }
    }
    return out;
  }, [rows, columns, q, sort]);

  const toggleSort = (key: string) => setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  const exportable = visible.filter((c) => !c.noExport);
  const download = () => downloadSheet(
    `${filename}-${isoToday()}`,
    exportable.map((c) => c.header),
    shown.map((r) => exportable.map((c) => { const v = c.value(r); return typeof v === 'number' ? v : cellText(v); })),
  );
  const totals = visible.some((c) => c.total);

  return (
    <div className="dissolve-in overflow-hidden rounded-xl border border-grey-border bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-grey-border px-3 py-2">
        <div className="relative w-full sm:w-60">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter rows…" className="w-full rounded-md border border-grey-border py-1.5 pl-8 pr-7 text-xs focus:border-navy-light focus:outline-none" />
          {q && <button type="button" aria-label="Clear filter" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy"><X size={13} /></button>}
        </div>
        <div className="relative">
          <button type="button" onClick={() => setMenu((m) => !m)} className="inline-flex items-center gap-1.5 rounded-md border border-grey-border px-2.5 py-1.5 text-xs font-medium text-navy transition-colors hover:border-navy-light">
            <Columns3 size={13} /> Columns <span className="text-gray-400">{visible.length}/{columns.length}</span>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
              <div className="dissolve-in absolute left-0 z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-grey-border bg-white p-1.5">
                <div className="mb-1 flex justify-between px-2 py-1 text-[11px]">
                  <button type="button" className="font-medium text-navy hover:text-navy-light" onClick={() => setHidden(new Set())}>Show all</button>
                  <button type="button" className="font-medium text-navy hover:text-navy-light" onClick={() => setHidden(new Set(columns.filter((c) => c.hidden).map((c) => c.key)))}>Reset</button>
                </div>
                {columns.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-navy hover:bg-grey-bg">
                    <input
                      type="checkbox"
                      checked={!hidden.has(c.key)}
                      disabled={!hidden.has(c.key) && visible.length === 1}
                      onChange={() => setHidden((h) => { const n = new Set(h); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })}
                      className="rounded border-grey-border text-navy focus:ring-navy-light"
                    />
                    {c.header}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <span className="flex-1 text-right text-xs text-gray-400">
          {shown.length === rows.length ? `${rows.length} row${rows.length === 1 ? '' : 's'}` : `${shown.length} of ${rows.length} rows`}
          {sort && <> · sorted by {columns.find((c) => c.key === sort.key)?.header} <button type="button" className="text-navy hover:text-navy-light" onClick={() => setSort(null)}>clear</button></>}
        </span>
        <button type="button" onClick={download} disabled={shown.length === 0} className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy-light disabled:opacity-40">
          <Download size={13} /> Download Excel
        </button>
      </div>
      <div className="max-h-[68vh] overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 whitespace-nowrap text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 w-10 border-b border-r border-grey-border bg-grey-bg px-2 py-2 text-right font-semibold text-gray-400">#</th>
              {visible.map((c, i) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} className={`sticky top-0 z-10 border-b border-r border-grey-border bg-grey-bg p-0 font-semibold text-gray-500 ${i === 0 ? 'left-10 z-20' : ''}`}>
                    <button type="button" onClick={() => toggleSort(c.key)} title={`Sort by ${c.header}`} className={`flex w-full items-center gap-1 px-3 py-2 transition-colors hover:text-navy ${c.numeric ? 'justify-end' : ''} ${active ? 'text-navy' : ''}`}>
                      {c.header}
                      {active ? (sort!.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="text-gray-300" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, n) => {
              const tone = rowTone?.(r);
              const bg = tone === 'red' ? 'bg-red-50' : tone === 'amber' ? 'bg-amber-50/70' : n % 2 ? 'bg-grey-bg/40' : 'bg-white';
              return (
                <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={`group ${onRowClick ? 'cursor-pointer' : ''}`}>
                  <td className={`sticky left-0 z-[5] border-b border-r border-grey-border px-2 py-1.5 text-right tabular-nums text-gray-400 group-hover:bg-blue-50 ${bg}`}>{n + 1}</td>
                  {visible.map((c, i) => {
                    const v = c.value(r);
                    return (
                      <td
                        key={c.key}
                        title={typeof v === 'string' && v.length > 28 ? v : undefined}
                        className={`border-b border-r border-grey-border px-3 py-1.5 group-hover:bg-blue-50 ${bg} ${c.numeric ? 'text-right tabular-nums' : ''} ${i === 0 ? 'sticky left-10 z-[5] font-medium text-navy' : 'text-gray-600'} ${c.wide ? 'max-w-[280px] truncate' : ''}`}
                      >
                        {c.render ? c.render(r) : cellText(v) || <span className="text-gray-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {totals && shown.length > 0 && (
            <tfoot>
              <tr className="font-semibold text-navy">
                <td className="sticky bottom-0 left-0 z-20 border-r border-t-2 border-grey-border bg-grey-bg px-2 py-2" />
                {visible.map((c, i) => (
                  <td key={c.key} className={`sticky bottom-0 z-10 border-r border-t-2 border-grey-border bg-grey-bg px-3 py-2 ${c.numeric ? 'text-right tabular-nums' : ''} ${i === 0 ? 'left-10 z-20' : ''}`}>
                    {i === 0 ? 'Total' : c.total ? shown.reduce((sum, r) => sum + (Number(c.value(r)) || 0), 0).toLocaleString('en-IN') : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {shown.length === 0 && <p className="py-10 text-center text-sm text-gray-400">{rows.length ? 'No rows match the filter.' : emptyText}</p>}
      </div>
      <p className="border-t border-grey-border px-3 py-1.5 text-[11px] text-gray-400">
        Click a header to sort{onRowClick ? ' · click a row to open it' : ''} · Download saves the rows and columns shown, ready for Excel.
      </p>
    </div>
  );
}
