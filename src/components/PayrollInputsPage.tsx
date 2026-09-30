import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, ChevronRight, Database, History, Lock, Send, Undo2, X } from 'lucide-react';
import {
  AttendanceRecord, Holiday, LeaveRecord, MockUser, PayProfile, PayrollAuto, PayrollManual, PayrollRun, StaffMember,
} from '../types';
import { MANUAL_COLUMNS, RUN_STATUS_STYLES, autoFor, basicOn, emptyManual, money, monthKey, monthLabel } from '../payroll';
import { dateKey, formatSubmittedAt } from '../dateTime';
import DateInput from './DateInput';

// ─── HRM · Payroll Inputs ───────────────────────────────────────────────────
// One page for Finance's monthly inputs. Auto columns come from Attendance / Leave (read-only);
// the branch fills the manual columns and submits. No tax, net pay or payslips — Finance does
// those. Past months open as a read-only snapshot of exactly what was submitted.

interface PayrollInputsPageProps {
  currentUser: MockUser;
  /** Branch staff. */
  staff: StaffMember[];
  profiles: PayProfile[];
  runs: PayrollRun[];
  attendance: AttendanceRecord[];
  leave: LeaveRecord[];
  holidays: Holiday[];
  onSaveProfile: (p: PayProfile) => void;
  onSaveRun: (r: PayrollRun) => void;
}

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';
const numClass =
  'w-24 rounded-md border border-grey-border bg-white px-2 py-1.5 text-right text-sm tabular-nums text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light';

type Row = { name: string; role: string; auto: PayrollAuto; manual: PayrollManual; profile?: PayProfile };

export default function PayrollInputsPage({
  currentUser, staff, profiles, runs, attendance, leave, holidays, onSaveProfile, onSaveRun,
}: PayrollInputsPageProps) {
  const now = useMemo(() => new Date(), []);
  const today = dateKey(now);
  const thisMonth = monthKey(now);
  const [viewMonth, setViewMonth] = useState(thisMonth);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 3500); };

  const team = staff.filter((s) => s.status === 'Active' && s.role !== 'Super Admin');
  const profileOf = (name: string) => profiles.find((p) => p.staffName === name);

  // The current month's run — created as a draft the first time anything is entered.
  const currentRun: PayrollRun = runs.find((r) => r.month === thisMonth) ?? {
    id: `pay-${currentUser.branch}-${thisMonth}`, branch: currentUser.branch, month: thisMonth, status: 'Draft', manual: {},
  };
  const run = viewMonth === thisMonth ? currentRun : runs.find((r) => r.month === viewMonth)!;
  const isCurrent = viewMonth === thisMonth;
  const editable = isCurrent && run.status === 'Draft';

  // History strip: this month + every past run, newest first.
  const months = [thisMonth, ...runs.map((r) => r.month).filter((m) => m !== thisMonth)].sort().reverse();

  const rows: Row[] = useMemo(() => {
    if (run.snapshot) {
      return Object.entries(run.snapshot).map(([name, auto]) => ({
        name, role: staff.find((s) => s.name === name)?.role ?? '', auto, manual: run.manual[name] ?? emptyManual(), profile: profileOf(name),
      }));
    }
    return team.map((m) => ({
      name: m.name, role: m.role, profile: profileOf(m.name),
      auto: autoFor(m, run.month, profileOf(m.name), attendance, leave, holidays, now),
      manual: run.manual[m.name] ?? emptyManual(profileOf(m.name)?.fixedAllowance ?? 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, staff, profiles, attendance, leave, holidays, now]);

  const setManual = (name: string, patch: Partial<PayrollManual>) => {
    const prev = run.manual[name] ?? emptyManual(profileOf(name)?.fixedAllowance ?? 0);
    onSaveRun({ ...currentRun, manual: { ...currentRun.manual, [name]: { ...prev, ...patch } } });
  };

  const totals = MANUAL_COLUMNS.map((c) => rows.reduce((n, r) => n + (r.manual[c.key] || 0), 0));

  const submit = () => {
    const snapshot = Object.fromEntries(rows.map((r) => [r.name, r.auto]));
    const manual = Object.fromEntries(rows.map((r) => [r.name, r.manual]));
    onSaveRun({ ...currentRun, manual, snapshot, status: 'Submitted', submittedBy: currentUser.name, submittedAt: formatSubmittedAt(new Date()) });
    setConfirming(false);
    flash(`${monthLabel(thisMonth)} payroll data submitted to Finance — ${rows.length} employees.`);
  };
  const recall = () => {
    onSaveRun({ ...currentRun, status: 'Draft', snapshot: undefined, submittedBy: undefined, submittedAt: undefined });
    flash('Submission recalled — you can edit again.');
  };

  const statusOf = (m: string) => (m === thisMonth ? currentRun.status : runs.find((r) => r.month === m)?.status ?? 'Not started');
  const withRemarks = rows.filter((r) => r.manual.remarks.trim()).length;

  return (
    <div className="space-y-5">
      {/* Payroll history */}
      <section>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-500"><History size={13} /> Payroll history</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {months.map((m) => {
            const st = statusOf(m);
            const active = m === viewMonth;
            return (
              <button
                key={m}
                type="button"
                onClick={() => { setViewMonth(m); setConfirming(false); }}
                aria-pressed={active}
                className={`flex min-w-[168px] flex-shrink-0 items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left transition-colors ${active ? 'border-navy' : 'border-grey-border hover:border-navy-light/50'}`}
              >
                <span>
                  <span className="block text-sm font-semibold text-navy">{monthLabel(m)}</span>
                  <span className="block text-[11px] text-gray-400">{m === thisMonth ? 'Current month' : 'Read-only'}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${RUN_STATUS_STYLES[st]}`}>{st}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Context */}
      <div key={viewMonth} className="dissolve-in space-y-4">
        {!isCurrent ? (
          <div className="flex flex-col gap-2 rounded-xl border border-grey-border bg-grey-bg/60 px-4 py-3 sm:flex-row sm:items-center">
            <Lock size={16} className="text-gray-500" />
            <p className="flex-1 text-sm text-gray-700">
              Viewing <b>{monthLabel(viewMonth)}</b> as submitted{run.submittedAt ? ` on ${run.submittedAt} by ${run.submittedBy}` : ''}
              {run.processedAt ? ` · processed ${run.processedAt} by ${run.processedBy}` : ''}. Read-only.
            </p>
            <button type="button" onClick={() => setViewMonth(thisMonth)} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-navy-light hover:text-navy sm:self-auto">
              <ArrowLeft size={14} /> Back to {monthLabel(thisMonth)}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <p className="flex flex-1 items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <Database size={16} className="mt-0.5 flex-shrink-0 text-blue-700" />
              <span>
                <b>Basic Salary, Days Worked, Leave Taken and Late/Absence are pulled automatically</b> from employee fixed inputs, Attendance and Leave
                {' '}(month to date, holidays excluded) — they can’t be edited here. Fill in the manual columns and submit; Finance calculates pay.
              </span>
            </p>
            {run.status === 'Draft' ? (
              <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">
                <Send size={15} /> Submit Monthly Payroll Data
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RUN_STATUS_STYLES[run.status]}`}>{run.status}</span>
                <span className="text-gray-600">{run.submittedAt} by {run.submittedBy}</span>
                {run.status === 'Submitted' && (
                  <button type="button" onClick={recall} className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-navy-light hover:text-navy"><Undo2 size={12} /> Recall</button>
                )}
              </div>
            )}
          </div>
        )}

        {confirming && (
          <div className="dissolve-in flex flex-col gap-3 rounded-xl border border-navy/30 bg-white px-4 py-3 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-navy">
              Submit {monthLabel(thisMonth)} for <b>{rows.length} employees</b>{withRemarks ? `, with remarks on ${withRemarks}` : ''}? Auto figures are frozen as of today and the table becomes read-only until Finance processes it or you recall it.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-grey-border px-3 py-2 text-sm text-navy hover:bg-grey-bg">Cancel</button>
              <button type="button" onClick={submit} className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-light">Submit to Finance</button>
            </div>
          </div>
        )}

        {/* Main table */}
        <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
          <table className="w-full min-w-[1400px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide">
                <th className="sticky left-0 z-10 bg-white" />
                <th colSpan={4} className="border-b border-l border-grey-border bg-grey-bg px-3 py-1.5 font-semibold text-gray-500"><Lock size={10} className="mr-1 inline" /> From Attendance / Leave</th>
                <th colSpan={MANUAL_COLUMNS.length + 1} className="border-b border-l border-grey-border px-3 py-1.5 font-semibold text-navy">Manual inputs</th>
              </tr>
              <tr className="bg-grey-bg text-left">
                <th className="sticky left-0 z-10 bg-grey-bg px-4 py-2.5 text-xs font-semibold text-gray-500">Employee</th>
                {['Basic Salary', 'Days Worked', 'Leave Taken', 'Late / Absence'].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 ${i === 0 ? 'border-l border-grey-border' : ''} ${i === 0 ? 'text-right' : ''}`}>{h}</th>
                ))}
                {MANUAL_COLUMNS.map((c, i) => (
                  <th key={c.key} className={`px-3 py-2.5 text-right text-xs font-semibold text-gray-500 ${i === 0 ? 'border-l border-grey-border' : ''}`}>{c.label}</th>
                ))}
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const eligible = r.profile?.commissionEligible ?? false;
                return (
                  <tr key={r.name} className="border-t border-grey-border align-middle">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2">
                      <button type="button" onClick={() => setDrawer(r.name)} className="group flex items-center gap-1 text-left" title="Fixed inputs">
                        <span>
                          <span className="block font-medium text-navy group-hover:underline">{r.name}</span>
                          <span className="block text-[11px] text-gray-400">{r.role}</span>
                        </span>
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-navy" />
                      </button>
                    </td>
                    <td className="border-l border-grey-border bg-grey-bg/40 px-3 py-2 text-right tabular-nums text-gray-700">{money(r.auto.basic)}</td>
                    <td className="bg-grey-bg/40 px-3 py-2 tabular-nums text-gray-700">{r.auto.daysWorked}<span className="text-gray-400"> / {r.auto.workingDays}</span></td>
                    <td className="bg-grey-bg/40 px-3 py-2 tabular-nums text-gray-700">{r.auto.leaveDays || <span className="text-gray-300">0</span>}</td>
                    <td className="bg-grey-bg/40 px-3 py-2 whitespace-nowrap">
                      {r.auto.late > 0 && <span className="mr-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{r.auto.late} late</span>}
                      {r.auto.absent > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">{r.auto.absent} absent</span>}
                      {!r.auto.late && !r.auto.absent && <span className="text-gray-300">—</span>}
                    </td>
                    {MANUAL_COLUMNS.map((c, i) => {
                      const v = r.manual[c.key];
                      const disabled = !editable || (c.key === 'commission' && !eligible);
                      return (
                        <td key={c.key} className={`px-3 py-2 text-right ${i === 0 ? 'border-l border-grey-border' : ''}`}>
                          {editable && !(c.key === 'commission' && !eligible) ? (
                            <input
                              type="number"
                              min={0}
                              step={100}
                              inputMode="numeric"
                              value={v || ''}
                              placeholder="0"
                              onChange={(e) => setManual(r.name, { [c.key]: Math.max(0, Number(e.target.value) || 0) })}
                              aria-label={`${c.label} for ${r.name}`}
                              className={numClass}
                            />
                          ) : (
                            <span className={`tabular-nums ${disabled && c.key === 'commission' && !eligible ? 'text-[11px] text-gray-400' : v ? (c.negative ? 'text-red-700' : 'text-navy') : 'text-gray-300'}`}>
                              {c.key === 'commission' && !eligible ? 'Not eligible' : v ? `${c.negative ? '−' : ''}${money(v)}` : '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
                      {editable ? (
                        <input value={r.manual.remarks} onChange={(e) => setManual(r.name, { remarks: e.target.value })} placeholder="Note for Finance" aria-label={`Remarks for ${r.name}`} className="w-64 rounded-md border border-grey-border bg-white px-2 py-1.5 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light" />
                      ) : (
                        <span className="block max-w-xs text-xs text-gray-600">{r.manual.remarks || <span className="text-gray-300">—</span>}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-grey-border bg-grey-bg/60 text-sm">
                <td className="sticky left-0 z-10 bg-grey-bg px-4 py-2.5 font-semibold text-navy">Totals · {rows.length} employees</td>
                <td className="border-l border-grey-border px-3 py-2.5 text-right tabular-nums text-gray-600">{money(rows.reduce((n, r) => n + r.auto.basic, 0))}</td>
                <td colSpan={3} />
                {totals.map((t, i) => (
                  <td key={MANUAL_COLUMNS[i].key} className={`px-3 py-2.5 text-right font-semibold tabular-nums ${t ? (MANUAL_COLUMNS[i].negative ? 'text-red-700' : 'text-navy') : 'text-gray-300'} ${i === 0 ? 'border-l border-grey-border' : ''}`}>
                    {t ? `${MANUAL_COLUMNS[i].negative ? '−' : ''}${money(t)}` : '—'}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {editable && <p className="text-[11px] text-gray-400">Entries save as you type. Figures are month to date ({monthLabel(thisMonth)} 1 – {Number(today.slice(8))}).</p>}
      </div>

      {drawer && (
        <FixedInputsDrawer
          key={drawer}
          name={drawer}
          role={staff.find((s) => s.name === drawer)?.role ?? ''}
          branch={currentUser.branch}
          profile={profileOf(drawer)}
          currentUserName={currentUser.name}
          today={today}
          onClose={() => setDrawer(null)}
          onSave={(p) => { onSaveProfile(p); setDrawer(null); flash(`Fixed inputs saved for ${p.staffName}.`); }}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
}

// ─── Fixed inputs drawer ────────────────────────────────────────────────────

function FixedInputsDrawer({ name, role, branch, profile, currentUserName, today, onClose, onSave }: {
  name: string; role: string; branch: string; profile?: PayProfile; currentUserName: string; today: string;
  onClose: () => void; onSave: (p: PayProfile) => void;
}) {
  const base: PayProfile = profile ?? {
    staffName: name, branch, salaryHistory: [], fixedAllowance: 0, commissionEligible: false,
    paymentMethod: 'Bank transfer', bankName: '', accountName: name.toUpperCase(), accountNumber: '',
  };
  const [p, setP] = useState<PayProfile>(base);
  const current = basicOn(p, today);
  const currentEntry = [...p.salaryHistory].filter((e) => e.effectiveFrom <= today).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  const [change, setChange] = useState({ amount: '', effectiveFrom: today, note: '' });

  const addChange = () => {
    const amount = Number(change.amount);
    if (!amount || !change.effectiveFrom) return;
    setP({
      ...p,
      salaryHistory: [...p.salaryHistory, { amount, effectiveFrom: change.effectiveFrom, setBy: currentUserName, setAt: formatSubmittedAt(new Date()), note: change.note.trim() || undefined }],
    });
    setChange({ amount: '', effectiveFrom: today, note: '' });
  };
  const history = [...p.salaryHistory].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const upcoming = history.filter((e) => e.effectiveFrom > today);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy-dark/30" onClick={onClose} />
      <aside className="dissolve-in relative flex h-full w-full max-w-md flex-col border-l border-grey-border bg-white">
        <div className="flex items-start gap-3 border-b border-grey-border px-5 py-4">
          <div className="flex-1">
            <p className="text-base font-semibold text-navy">{name}</p>
            <p className="text-xs text-gray-500">{role} · Fixed inputs</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Salary */}
          <section className="space-y-3">
            <div className="rounded-lg border border-grey-border px-4 py-3">
              <p className="text-[11px] text-gray-500">Current basic salary</p>
              <p className="text-xl font-semibold tabular-nums text-navy">{money(current)}</p>
              {currentEntry && <p className="text-[11px] text-gray-400">Effective from {currentEntry.effectiveFrom}</p>}
              {upcoming.map((u) => <p key={u.effectiveFrom} className="mt-1 text-[11px] text-blue-700">Changes to {money(u.amount)} on {u.effectiveFrom}</p>)}
            </div>
            <div className="space-y-2 rounded-lg border border-dashed border-grey-border px-4 py-3">
              <p className="text-xs font-semibold text-navy">Change salary</p>
              <p className="text-[11px] text-gray-400">Adds a new entry from its effective date — earlier salaries stay on record.</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min={0} step={500} value={change.amount} onChange={(e) => setChange({ ...change, amount: e.target.value })} placeholder="New basic (Rs)" aria-label="New basic salary" className={inputClass} />
                <DateInput value={change.effectiveFrom} onChange={(effectiveFrom) => setChange({ ...change, effectiveFrom })} aria-label="Effective date" className="w-full" />
              </div>
              <input value={change.note} onChange={(e) => setChange({ ...change, note: e.target.value })} placeholder="Reason, e.g. Annual increment" className={inputClass} />
              <button type="button" onClick={addChange} disabled={!Number(change.amount)} className="rounded-lg border border-navy px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy hover:text-white disabled:cursor-not-allowed disabled:border-grey-border disabled:text-gray-400 disabled:hover:bg-transparent">
                Add salary change
              </button>
            </div>
            {history.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Salary history</p>
                <ol className="space-y-1.5">
                  {history.map((e, i) => (
                    <li key={`${e.effectiveFrom}-${i}`} className="flex items-baseline gap-2 text-xs">
                      <span className="w-20 flex-shrink-0 tabular-nums text-gray-500">{e.effectiveFrom}</span>
                      <span className="font-semibold tabular-nums text-navy">{money(e.amount)}</span>
                      <span className="min-w-0 flex-1 truncate text-gray-500">{e.note ?? ''} · {e.setBy}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          {/* Allowance + commission */}
          <section className="space-y-3 border-t border-grey-border pt-4">
            <div>
              <label htmlFor="fx-allow" className="mb-1.5 block text-xs font-semibold text-navy">Fixed allowances (monthly, Rs)</label>
              <input id="fx-allow" type="number" min={0} step={100} value={p.fixedAllowance || ''} onChange={(e) => setP({ ...p, fixedAllowance: Math.max(0, Number(e.target.value) || 0) })} className={inputClass} />
              <p className="mt-1 text-[11px] text-gray-400">Pre-fills the Allowance column each month.</p>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>
                <span className="block text-sm text-navy">Commission / incentive eligible</span>
                <span className="block text-[11px] text-gray-400">Turns the Commission column on for this employee.</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={p.commissionEligible}
                onClick={() => setP({ ...p, commissionEligible: !p.commissionEligible })}
                className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${p.commissionEligible ? 'bg-navy' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${p.commissionEligible ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </section>

          {/* Payment */}
          <section className="space-y-3 border-t border-grey-border pt-4">
            <p className="text-xs font-semibold text-navy">Bank / payment information</p>
            <select value={p.paymentMethod} onChange={(e) => setP({ ...p, paymentMethod: e.target.value as PayProfile['paymentMethod'] })} aria-label="Payment method" className={inputClass}>
              {(['Bank transfer', 'Cash', 'Cheque'] as const).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {p.paymentMethod === 'Bank transfer' && (
              <>
                <input value={p.bankName} onChange={(e) => setP({ ...p, bankName: e.target.value })} placeholder="Bank name" aria-label="Bank name" className={inputClass} />
                <input value={p.accountName} onChange={(e) => setP({ ...p, accountName: e.target.value })} placeholder="Account name" aria-label="Account name" className={inputClass} />
                <input value={p.accountNumber} onChange={(e) => setP({ ...p, accountNumber: e.target.value })} placeholder="Account number" aria-label="Account number" className={inputClass} />
              </>
            )}
          </section>
        </div>

        <div className="flex gap-3 border-t border-grey-border px-5 py-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
          <button type="button" onClick={() => onSave(p)} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light">Save fixed inputs</button>
        </div>
      </aside>
    </div>
  );
}
