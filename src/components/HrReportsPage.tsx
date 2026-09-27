import { useMemo, useState } from 'react';
import { CheckCircle, ChevronDown, FileDown, FileSpreadsheet, Info, X } from 'lucide-react';
import {
  AttendanceRecord, Holiday, LeaveRecord, MockUser, OnboardingCase, PayProfile, PayrollRun, StaffMember,
} from '../types';
import { DEPARTMENTS, attendanceSummary, departmentOf } from '../attendance';
import { LEAVE_STATUS_STYLES, LEAVE_TYPES, leaveDays } from '../leave';
import { MANUAL_COLUMNS, RUN_STATUS_STYLES, autoFor, emptyManual, money, monthKey, monthLabel } from '../payroll';
import { dateKey } from '../dateTime';
import { downloadSheet } from '../exportSheet';
import CompactDateRangeFilter from './CompactDateRangeFilter';

// ─── HRM · HR Reports ───────────────────────────────────────────────────────
// Read-only reports over Attendance, Leave and Payroll Inputs. One page; the four reports are
// switched with local state. Nothing here can be edited — every number comes from those modules.

type Report = 'Staff Report' | 'Attendance Report' | 'Leave Report' | 'Payroll Input Report';
const REPORTS: Report[] = ['Staff Report', 'Attendance Report', 'Leave Report', 'Payroll Input Report'];

interface HrReportsPageProps {
  currentUser: MockUser;
  /** Staff in the branches this user can report on (all statuses). */
  staff: StaffMember[];
  joinDates: Record<string, string>;
  onboarding: OnboardingCase[];
  attendance: AttendanceRecord[];
  leave: LeaveRecord[];
  holidays: Holiday[];
  profiles: PayProfile[];
  runs: PayrollRun[];
  /** Report to open first (defaults to Attendance). */
  initialReport?: Report;
}

type Cell = string | number;
interface Table {
  headers: string[];
  rows: { key: string; cells: Cell[]; render?: React.ReactNode[] }[];
  /** Optional totals row (same length as headers). */
  totals?: Cell[];
}

const shortDate = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function Filter({ label, value, onChange, options, all }: { label: string; value: string; onChange: (v: string) => void; options: string[] | { value: string; label: string }[]; all?: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="w-full appearance-none rounded-lg border border-grey-border bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-navy focus:border-navy-light focus:outline-none sm:w-auto">
        {all && <option value="">{all}</option>}
        {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

const pill = (text: string, cls: string) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;

export default function HrReportsPage({ currentUser, staff, joinDates, onboarding, attendance, leave, holidays, profiles, runs, initialReport }: HrReportsPageProps) {
  const now = useMemo(() => new Date(), []);
  const today = dateKey(now);
  const thisMonth = monthKey(now);
  const [report, setReport] = useState<Report>(initialReport ?? 'Attendance Report');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 3500); };

  const branches = [...new Set(staff.map((s) => s.branch))].sort();
  const people = staff.filter((s) => s.role !== 'Super Admin');
  const roles = [...new Set(people.map((s) => s.role))];
  const nameOptions = people.map((s) => s.name).sort();

  // Months that have attendance or payroll data, newest first.
  const months = [...new Set([thisMonth, ...attendance.map((r) => r.date.slice(0, 7)), ...runs.map((r) => r.month)])].sort().reverse();

  // ── Filter state, one set per report ──
  const [sf, setSf] = useState({ branch: '', dept: '', role: '', status: '' });
  const [af, setAf] = useState({ month: thisMonth, employee: '', dept: '', branch: '' });
  const [lf, setLf] = useState({ from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31`, employee: '', type: '', status: '' });
  const [pf, setPf] = useState({ month: thisMonth, employee: '', branch: '' });

  const table: Table = useMemo(() => {
    if (report === 'Staff Report') {
      const list = people
        .filter((s) => (!sf.branch || s.branch === sf.branch) && (!sf.dept || departmentOf(s.role) === sf.dept) && (!sf.role || s.role === sf.role) && (!sf.status || s.status === sf.status))
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        headers: ['Employee', 'Branch', 'Department', 'Role', 'Joining Date', 'Employment Status'],
        rows: list.map((s) => {
          const joined = onboarding.find((c) => c.employeeName === s.name)?.startDate ?? joinDates[s.name];
          return {
            key: s.id,
            cells: [s.name, s.branch, departmentOf(s.role), s.role, joined ?? '', s.status],
            render: [<span key="n" className="font-medium text-navy">{s.name}</span>, s.branch, departmentOf(s.role), s.role, joined ? shortDate(joined) : '—',
              pill(s.status === 'Active' ? 'Active' : 'Inactive', s.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600')],
          };
        }),
      };
    }

    if (report === 'Attendance Report') {
      const [y, m] = af.month.split('-').map(Number);
      const from = `${af.month}-01`;
      const to = dateKey(new Date(y, m, 0));
      const list = people
        .filter((s) => s.status === 'Active')
        .filter((s) => (!af.employee || s.name === af.employee) && (!af.dept || departmentOf(s.role) === af.dept) && (!af.branch || s.branch === af.branch))
        .map((s) => ({ s, sum: attendanceSummary(s.name, from, to, attendance, leave, holidays, now) }))
        .filter((x) => x.sum.workingDays > 0)
        .sort((a, b) => a.s.name.localeCompare(b.s.name));
      const num = (n: number, warn?: string) => <span className={`tabular-nums ${n === 0 ? 'text-gray-300' : warn ?? 'text-gray-700'}`}>{n}</span>;
      const tot = (k: keyof (typeof list)[number]['sum']) => list.reduce((n, x) => n + x.sum[k], 0);
      return {
        headers: ['Employee', 'Working Days', 'Present', 'Late', 'Absent', 'Leave', 'Half Day', 'Missing Attendance'],
        rows: list.map(({ s, sum }) => ({
          key: s.id,
          cells: [s.name, sum.workingDays, sum.present, sum.late, sum.absent, sum.leave, sum.halfDay, sum.missing],
          render: [
            <span key="n"><span className="font-medium text-navy">{s.name}</span><span className="block text-[11px] text-gray-400">{s.role}</span></span>,
            num(sum.workingDays), num(sum.present, 'text-emerald-700'), num(sum.late, 'text-amber-700 font-semibold'), num(sum.absent, 'text-red-700 font-semibold'),
            num(sum.leave, 'text-blue-700'), num(sum.halfDay, 'text-violet-700'), num(sum.missing, 'text-amber-700 font-semibold'),
          ],
        })),
        totals: [`${list.length} employees`, tot('workingDays'), tot('present'), tot('late'), tot('absent'), tot('leave'), tot('halfDay'), tot('missing')],
      };
    }

    if (report === 'Leave Report') {
      const list = leave
        .filter((l) => (!lf.from || l.to >= lf.from) && (!lf.to || l.from <= lf.to))
        .filter((l) => (!lf.employee || l.staffName === lf.employee) && (!lf.type || l.type === lf.type) && (!lf.status || l.status === lf.status))
        .sort((a, b) => b.from.localeCompare(a.from));
      return {
        headers: ['Employee', 'Leave Type', 'Date(s)', 'Number of Days', 'Status'],
        rows: list.map((l) => {
          const dates = l.from === l.to ? shortDate(l.from) : `${shortDate(l.from)} – ${shortDate(l.to)}`;
          const days = leaveDays(l, holidays);
          return {
            key: l.id,
            cells: [l.staffName, l.type, dates, days, l.status],
            render: [<span key="n" className="font-medium text-navy">{l.staffName}</span>, l.type, dates, <span key="d" className="tabular-nums">{days}</span>, pill(l.status, LEAVE_STATUS_STYLES[l.status])],
          };
        }),
        totals: [`${list.length} requests`, '', '', list.reduce((n, l) => n + leaveDays(l, holidays), 0), ''],
      };
    }

    // Payroll Input Report
    const run = runs.find((r) => r.month === pf.month);
    const status = run?.status ?? 'Not started';
    const names = run?.snapshot ? Object.keys(run.snapshot) : people.filter((s) => s.status === 'Active').map((s) => s.name);
    const list = names
      .map((n) => ({ n, member: staff.find((s) => s.name === n) }))
      .filter(({ n, member }) => (!pf.employee || n === pf.employee) && (!pf.branch || member?.branch === pf.branch))
      .map(({ n, member }) => {
        const profile = profiles.find((p) => p.staffName === n);
        const auto = run?.snapshot?.[n] ?? (member ? autoFor(member, pf.month, profile, attendance, leave, holidays, now) : undefined);
        const manual = run?.manual[n] ?? emptyManual(profile?.fixedAllowance ?? 0);
        return { n, auto, manual };
      });
    const colOf = (k: (typeof MANUAL_COLUMNS)[number]['key']) => MANUAL_COLUMNS.find((c) => c.key === k)!;
    const deductions = (x: (typeof list)[number]) => x.manual.deduction + x.manual.advance;
    return {
      headers: ['Employee', 'Period', 'Attendance (worked / days · late · absent)', 'Leave', colOf('overtime').label, colOf('bonus').label, colOf('commission').label, 'Deductions (incl. advance)', colOf('other').label, 'Status'],
      rows: list.map((x) => {
        const att = x.auto ? `${x.auto.daysWorked}/${x.auto.workingDays} · ${x.auto.late} late · ${x.auto.absent} absent` : '';
        return {
          key: x.n,
          cells: [x.n, monthLabel(pf.month), att, x.auto?.leaveDays ?? 0, x.manual.overtime, x.manual.bonus, x.manual.commission, deductions(x), x.manual.other, status],
          render: [
            <span key="n" className="font-medium text-navy">{x.n}</span>, monthLabel(pf.month), <span key="a" className="whitespace-nowrap text-gray-600">{att || '—'}</span>,
            <span key="l" className="tabular-nums">{x.auto?.leaveDays ?? 0}</span>,
            money(x.manual.overtime), money(x.manual.bonus), money(x.manual.commission),
            <span key="d" className={deductions(x) ? 'text-red-700' : ''}>{deductions(x) ? `−${money(deductions(x))}` : '—'}</span>,
            money(x.manual.other), pill(status, RUN_STATUS_STYLES[status]),
          ],
        };
      }),
      totals: [`${list.length} employees`, '', '', list.reduce((n, x) => n + (x.auto?.leaveDays ?? 0), 0),
        ...(['overtime', 'bonus', 'commission'] as const).map((k) => list.reduce((n, x) => n + x.manual[k], 0)),
        list.reduce((n, x) => n + deductions(x), 0), list.reduce((n, x) => n + x.manual.other, 0), ''],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, sf, af, lf, pf, staff, attendance, leave, holidays, profiles, runs, onboarding, joinDates]);

  const exportExcel = () => {
    const name = `${report.toLowerCase().replace(/\s+/g, '-')}-${currentUser.branch.toLowerCase()}-${today}`;
    downloadSheet(name, table.headers, [...table.rows.map((r) => r.cells), ...(table.totals ? [table.totals] : [])]);
    flash(`${report} exported — ${table.rows.length} row${table.rows.length === 1 ? '' : 's'} (${name}.csv, opens in Excel).`);
  };
  const exportPdf = () => flash(`PDF export isn’t connected yet — ${report} (${table.rows.length} rows) would be generated here. Use Export to Excel for now.`);

  const moneyCols = report === 'Payroll Input Report' ? new Set([4, 5, 6, 7, 8]) : new Set<number>();
  const numericCols = report === 'Attendance Report' ? new Set([1, 2, 3, 4, 5, 6, 7]) : report === 'Leave Report' ? new Set([3]) : report === 'Payroll Input Report' ? new Set([3, 4, 5, 6, 7, 8]) : new Set<number>();

  return (
    <div className="space-y-5">
      {/* Selector + exports */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report">
          {REPORTS.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={report === r}
              onClick={() => setReport(r)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${report === r ? 'border-navy bg-navy text-white' : 'border-grey-border bg-white text-gray-600 hover:border-navy-light hover:text-navy'}`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <button type="button" onClick={exportExcel} className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">
            <FileSpreadsheet size={16} /> Export to Excel
          </button>
          <button type="button" onClick={exportPdf} className="inline-flex items-center gap-2 rounded-lg border border-navy px-4 py-2.5 text-sm font-semibold text-navy hover:bg-navy hover:text-white">
            <FileDown size={16} /> Export to PDF
          </button>
        </div>
      </div>

      <div key={report} className="dissolve-in space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
          {report === 'Staff Report' && (
            <>
              <Filter label="Branch" value={sf.branch} onChange={(v) => setSf({ ...sf, branch: v })} options={branches} all="All branches" />
              <Filter label="Department" value={sf.dept} onChange={(v) => setSf({ ...sf, dept: v })} options={DEPARTMENTS} all="All departments" />
              <Filter label="Role" value={sf.role} onChange={(v) => setSf({ ...sf, role: v })} options={roles} all="All roles" />
              <Filter label="Status" value={sf.status} onChange={(v) => setSf({ ...sf, status: v })} options={['Active', 'Inactive']} all="All statuses" />
            </>
          )}
          {report === 'Attendance Report' && (
            <>
              <Filter label="Month" value={af.month} onChange={(v) => setAf({ ...af, month: v })} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
              <Filter label="Employee" value={af.employee} onChange={(v) => setAf({ ...af, employee: v })} options={nameOptions} all="All employees" />
              <Filter label="Department" value={af.dept} onChange={(v) => setAf({ ...af, dept: v })} options={DEPARTMENTS} all="All departments" />
              <Filter label="Branch" value={af.branch} onChange={(v) => setAf({ ...af, branch: v })} options={branches} all="All branches" />
            </>
          )}
          {report === 'Leave Report' && (
            <>
              <CompactDateRangeFilter from={lf.from} to={lf.to} onFromChange={(v) => setLf({ ...lf, from: v })} onToChange={(v) => setLf({ ...lf, to: v })} />
              <Filter label="Employee" value={lf.employee} onChange={(v) => setLf({ ...lf, employee: v })} options={nameOptions} all="All employees" />
              <Filter label="Leave type" value={lf.type} onChange={(v) => setLf({ ...lf, type: v })} options={LEAVE_TYPES} all="All leave types" />
              <Filter label="Status" value={lf.status} onChange={(v) => setLf({ ...lf, status: v })} options={['Approved', 'Pending', 'Rejected', 'Returned']} all="All statuses" />
            </>
          )}
          {report === 'Payroll Input Report' && (
            <>
              <Filter label="Month" value={pf.month} onChange={(v) => setPf({ ...pf, month: v })} options={[...new Set([thisMonth, ...runs.map((r) => r.month)])].sort().reverse().map((m) => ({ value: m, label: monthLabel(m) }))} />
              <Filter label="Employee" value={pf.employee} onChange={(v) => setPf({ ...pf, employee: v })} options={nameOptions} all="All employees" />
              <Filter label="Branch" value={pf.branch} onChange={(v) => setPf({ ...pf, branch: v })} options={branches} all="All branches" />
            </>
          )}
          <p className="flex items-center gap-1.5 text-xs text-gray-400 sm:ml-auto">
            <Info size={12} /> Read-only · from {report === 'Staff Report' ? 'staff records' : report === 'Leave Report' ? 'Leave Management' : report === 'Payroll Input Report' ? 'Payroll Inputs' : 'Attendance'}
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-grey-bg text-left">
                {table.headers.map((h, i) => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 ${numericCols.has(i) ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r.key} className="border-t border-grey-border">
                  {(r.render ?? r.cells).map((c, i) => (
                    <td key={i} className={`px-4 py-2.5 ${numericCols.has(i) ? 'text-right tabular-nums' : ''} ${i === 0 ? '' : 'text-gray-600'}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {table.totals && table.rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-grey-border bg-grey-bg/60 font-semibold text-navy">
                  {table.totals.map((t, i) => (
                    <td key={i} className={`px-4 py-2.5 ${numericCols.has(i) ? 'text-right tabular-nums' : ''}`}>
                      {moneyCols.has(i) && typeof t === 'number' ? (t ? (i === 7 ? `−${money(t)}` : money(t)) : '—') : t}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
          {table.rows.length === 0 && <p className="py-12 text-center text-sm text-gray-400">No records match these filters.</p>}
        </div>
        {report === 'Attendance Report' && (
          <p className="text-[11px] text-gray-400">
            Working days exclude Saturdays and holidays. Present includes late and half days. Half day = under 4 hours between check-in and check-out.
            Missing attendance = checked in but never checked out. {af.month === thisMonth ? 'Current month is to date.' : ''}
          </p>
        )}
      </div>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} aria-label="Dismiss" className="ml-1 text-white/80 hover:text-white"><X size={15} /></button>
        </div>
      )}
    </div>
  );
}
