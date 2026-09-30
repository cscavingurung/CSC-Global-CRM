import { Fragment, useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle, ChevronDown, Clock, Search, Send, Users, X } from 'lucide-react';
import { Holiday, LeaveRecord, LeaveType, MockUser, NavIntent, StaffMember } from '../types';
import {
  ALLOWANCE, BALANCE_TYPES, LEAVE_STATUS_STYLES, LEAVE_TYPES, balancesFor, countDays, leaveDays, overlapping,
} from '../leave';
import { dateKey, formatSubmittedAt } from '../dateTime';
import DateInput from './DateInput';

// ─── HRM · Leave Management ─────────────────────────────────────────────────
// Request → approve/reject, nothing more. The Branch Manager gets all four views; staff (via
// Branch Hub) get Apply Leave and their own history. Approved requests are the same records
// Attendance reads, so approving is what makes those days show "On Leave" there.

type Tab = 'Dashboard' | 'Apply Leave' | 'Leave Requests' | 'Leave History';

interface LeaveManagementPageProps {
  currentUser: MockUser;
  /** Branch staff. */
  staff: StaffMember[];
  /** Branch leave requests (all statuses). */
  leave: LeaveRecord[];
  /** Branch holidays — never counted as leave days, so never deducted from a balance. */
  holidays: Holiday[];
  /** 'manager' shows all four views; 'employee' only Apply + own history. */
  mode: 'manager' | 'employee';
  onAddLeave: (l: LeaveRecord) => void;
  onUpdateLeave: (id: string, updates: Partial<LeaveRecord>) => void;
  onNavigate: (key: string, intent?: NavIntent) => void;
}

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

const fmt = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const rangeLabel = (l: LeaveRecord) => (l.from === l.to ? fmt(l.from) : `${fmt(l.from)} – ${fmt(l.to)}`);
const shift = (key: string, days: number) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateKey(d);
};

function StatusPill({ status }: { status: LeaveRecord['status'] }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${LEAVE_STATUS_STYLES[status]}`}>{status}</span>;
}

export default function LeaveManagementPage({ currentUser, staff, leave, holidays, mode, onAddLeave, onUpdateLeave, onNavigate }: LeaveManagementPageProps) {
  // Days a request costs, worked out live — a holiday added later is refunded automatically.
  const daysOf = (l: LeaveRecord) => leaveDays(l, holidays);
  const today = dateKey(new Date());
  const year = new Date().getFullYear();
  const isManager = mode === 'manager';
  const tabs: Tab[] = isManager ? ['Dashboard', 'Apply Leave', 'Leave Requests', 'Leave History'] : ['Apply Leave', 'Leave History'];
  const [tab, setTab] = useState<Tab>(tabs[0]);
  const [toast, setToast] = useState('');
  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3500);
  };

  const team = staff.filter((s) => s.status === 'Active' && s.role !== 'Super Admin');
  const roleOf = (name: string) => staff.find((s) => s.name === name)?.role ?? '';
  const pending = leave.filter((l) => l.status === 'Pending').sort((a, b) => a.from.localeCompare(b.from));

  // ── Dashboard ────────────────────────────────────────────────────────────
  const approved = leave.filter((l) => l.status === 'Approved');
  const onLeaveToday = approved.filter((l) => l.from <= today && today <= l.to);
  const in7 = shift(today, 7);
  const upcoming = leave
    .filter((l) => l.status !== 'Rejected' && l.from > today && l.from <= in7)
    .sort((a, b) => a.from.localeCompare(b.from));
  const balances = team.map((s) => ({ member: s, bal: balancesFor(s.name, leave, year, holidays) }));
  const avgAnnual = balances.length ? Math.round(balances.reduce((n, b) => n + b.bal[0].remaining, 0) / balances.length) : 0;
  const lowAnnual = balances.filter((b) => b.bal[0].remaining <= 3);

  // ── Apply ────────────────────────────────────────────────────────────────
  const myBalances = balancesFor(currentUser.name, leave, year, holidays);
  const [form, setForm] = useState<{ type: LeaveType; from: string; to: string; reason: string }>({ type: 'Annual', from: shift(today, 7), to: shift(today, 7), reason: '' });
  const [tried, setTried] = useState(false);
  // Auto-calculated as the dates change: Saturdays (weekly day off) and holidays aren't counted.
  const breakdown = countDays(form.from, form.to, holidays);
  const totalDays = breakdown.working;
  const bal = myBalances.find((b) => b.type === form.type);
  const clash = form.from && form.to ? overlapping(leave, currentUser.name, form.from, form.to) : undefined;
  const errors = {
    dates: (!form.from || !form.to) ? 'Choose both dates.' : form.to < form.from ? 'The end date is before the start date.' : totalDays === 0 ? 'That range is only a day off — nothing to request.' : null,
    balance: bal && totalDays > bal.remaining - bal.pending
      ? `Only ${Math.max(0, bal.remaining - bal.pending)} ${form.type} day${bal.remaining - bal.pending === 1 ? '' : 's'} available${bal.pending ? ` (${bal.pending} already pending)` : ''}.` : null,
    clash: clash ? `Overlaps your ${clash.status.toLowerCase()} ${clash.type} leave (${rangeLabel(clash)}).` : null,
    reason: !form.reason.trim() ? 'Add a short reason.' : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const submit = () => {
    setTried(true);
    if (!valid) return;
    onAddLeave({
      id: `lv-${Date.now()}`, staffName: currentUser.name, branch: currentUser.branch, from: form.from, to: form.to, type: form.type,
      status: 'Pending', days: totalDays, reason: form.reason.trim(), requestedAt: formatSubmittedAt(new Date()),
    });
    setForm({ ...form, reason: '' });
    setTried(false);
    flash(`Leave request sent — ${totalDays} day${totalDays === 1 ? '' : 's'} of ${form.type} leave awaiting approval.`);
  };

  // ── Requests ─────────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<string | null>(pending[0]?.id ?? null);
  const [rejectNote, setRejectNote] = useState('');
  const decide = (l: LeaveRecord, approve: boolean) => {
    onUpdateLeave(l.id, {
      status: approve ? 'Approved' : 'Rejected', decidedBy: currentUser.name, decidedAt: formatSubmittedAt(new Date()),
      decisionNote: approve ? undefined : rejectNote.trim() || undefined,
    });
    setRejectNote('');
    // Attendance sync: Attendance derives "On Leave" from approved requests in this same store,
    // so the approval is reflected in Today's Attendance, History, the employee calendar and
    // Late & Absence immediately — nothing else to update.
    flash(approve
      ? `Approved — synced to Attendance: ${l.staffName.split(' ')[0]}’s ${daysOf(l)} day${daysOf(l) === 1 ? '' : 's'} (${rangeLabel(l)}) now show as On Leave.`
      : `Rejected — ${l.staffName.split(' ')[0]} will see the decision in their leave history.`);
  };
  const alsoAway = (l: LeaveRecord) =>
    leave.filter((o) => o.id !== l.id && o.staffName !== l.staffName && o.status === 'Approved' && o.from <= l.to && l.from <= o.to);

  // ── History ──────────────────────────────────────────────────────────────
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fType, setFType] = useState('');
  const history = useMemo(() => leave
    .filter((l) => isManager || l.staffName === currentUser.name)
    .filter((l) => !q.trim() || `${l.staffName} ${l.type} ${l.reason}`.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((l) => !fStatus || l.status === fStatus)
    .filter((l) => !fType || l.type === fType)
    .sort((a, b) => b.from.localeCompare(a.from)), [leave, isManager, currentUser.name, q, fStatus, fType]);

  return (
    <div className="space-y-5">
      {/* Internal navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-grey-border">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-navy'}`}
          >
            {t === 'Leave History' && !isManager ? 'My Leave History' : t}
            {t === 'Leave Requests' && pending.length > 0 && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">{pending.length}</span>}
          </button>
        ))}
      </div>

      <div key={tab} className="dissolve-in">
        {/* ── Dashboard ── */}
        {tab === 'Dashboard' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <section className="rounded-xl border border-grey-border bg-white">
                <p className="flex items-center gap-2 border-b border-grey-border px-4 py-3 text-sm font-semibold text-navy"><Users size={15} className="text-gray-400" /> On leave today <span className="text-xs font-normal text-gray-400">{onLeaveToday.length}</span></p>
                {onLeaveToday.length === 0 ? <p className="px-4 py-4 text-sm text-gray-400">Everyone is in today.</p> : (
                  <ul className="divide-y divide-grey-border">
                    {onLeaveToday.map((l) => (
                      <li key={l.id} className="px-4 py-2.5">
                        <p className="text-sm font-medium text-navy">{l.staffName}</p>
                        <p className="text-xs text-gray-500">{l.type} · back after {fmt(l.to)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="flex flex-col rounded-xl border border-grey-border bg-white">
                <p className="flex items-center gap-2 border-b border-grey-border px-4 py-3 text-sm font-semibold text-navy"><Clock size={15} className="text-gray-400" /> Pending requests</p>
                <div className="flex flex-1 flex-col justify-between px-4 py-4">
                  <p className={`text-4xl font-semibold tabular-nums ${pending.length ? 'text-amber-600' : 'text-gray-300'}`}>{pending.length}</p>
                  <p className="text-xs text-gray-500">{pending.length ? pending.map((l) => l.staffName.split(' ')[0]).join(', ') : 'Nothing to approve.'}</p>
                  {pending.length > 0 && (
                    <button type="button" onClick={() => setTab('Leave Requests')} className="mt-3 self-start rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-light">Review requests</button>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-grey-border bg-white">
                <p className="flex items-center gap-2 border-b border-grey-border px-4 py-3 text-sm font-semibold text-navy"><CalendarCheck size={15} className="text-gray-400" /> Upcoming · next 7 days</p>
                {upcoming.length === 0 ? <p className="px-4 py-4 text-sm text-gray-400">No leave coming up.</p> : (
                  <ul className="divide-y divide-grey-border">
                    {upcoming.map((l) => (
                      <li key={l.id} className="flex items-center gap-2 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-navy">{l.staffName}</p>
                          <p className="text-xs text-gray-500">{l.type} · {rangeLabel(l)}</p>
                        </div>
                        <StatusPill status={l.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="rounded-xl border border-grey-border bg-white">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-grey-border px-4 py-3">
                <p className="text-sm font-semibold text-navy">Remaining balances · {year}</p>
                <p className="text-xs text-gray-500">Average Annual left: <b className="text-navy">{avgAnnual} days</b></p>
                <p className="text-xs text-gray-500">3 or fewer Annual days: <b className={lowAnnual.length ? 'text-amber-700' : 'text-navy'}>{lowAnnual.length ? lowAnnual.map((b) => b.member.name.split(' ')[0]).join(', ') : 'none'}</b></p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="bg-grey-bg text-left">
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Employee</th>
                      {BALANCE_TYPES.map((t) => <th key={t} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{t} <span className="font-normal text-gray-400">/ {ALLOWANCE[t]}</span></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map(({ member, bal: bs }) => (
                      <tr key={member.id} className="border-t border-grey-border">
                        <td className="px-4 py-2.5 text-sm text-navy">{member.name}<span className="ml-1.5 text-[11px] text-gray-400">{member.role}</span></td>
                        {bs.map((b) => (
                          <td key={b.type} className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                                <div className={`h-full rounded-full ${b.remaining <= Math.ceil(b.allowance * 0.2) ? 'bg-amber-400' : 'bg-navy'}`} style={{ width: `${(Math.max(0, b.remaining) / b.allowance) * 100}%` }} />
                              </div>
                              <span className="text-sm tabular-nums text-gray-700">{b.remaining}</span>
                              {b.pending > 0 && <span className="text-[11px] text-amber-700">({b.pending} pending)</span>}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ── Apply Leave ── */}
        {tab === 'Apply Leave' && (
          <div className="max-w-2xl space-y-5">
            <section className="rounded-xl border border-grey-border bg-white px-5 py-4">
              <p className="text-xs font-semibold text-gray-500">My balance · {year}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-navy">
                {myBalances.map((b, i) => (
                  <span key={b.type} className="whitespace-nowrap">
                    {i > 0 && <span className="mr-4 text-gray-300">|</span>}
                    {b.type}: <b className={`tabular-nums ${b.remaining <= Math.ceil(b.allowance * 0.2) ? 'text-amber-700' : ''}`}>{b.remaining} day{b.remaining === 1 ? '' : 's'}</b> remaining
                  </span>
                ))}
              </p>
              {myBalances.some((b) => b.pending) && (
                <p className="mt-1 text-xs text-amber-700">Pending approval: {myBalances.filter((b) => b.pending).map((b) => `${b.pending} ${b.type}`).join(', ')}</p>
              )}
            </section>

            <section className="space-y-4 rounded-xl border border-grey-border bg-white px-5 py-5">
              <div>
                <label htmlFor="lv-type" className="mb-1.5 block text-xs font-semibold text-navy">Leave type</label>
                <div className="relative">
                  <select id="lv-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LeaveType })} className={`${inputClass} appearance-none pr-9`}>
                    {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}{ALLOWANCE[t] === undefined ? ' (no balance)' : ''}</option>)}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="lv-from" className="mb-1.5 block text-xs font-semibold text-navy">From</label>
                  <DateInput id="lv-from" value={form.from} onChange={(from) => setForm({ ...form, from, to: form.to < from ? from : form.to })} className="w-full" />
                </div>
                <div>
                  <label htmlFor="lv-to" className="mb-1.5 block text-xs font-semibold text-navy">To</label>
                  <DateInput id="lv-to" value={form.to} min={form.from} onChange={(to) => setForm({ ...form, to })} className="w-full" />
                </div>
              </div>

              {/* Auto-calculated total */}
              <div className="flex items-center justify-between rounded-lg bg-grey-bg px-4 py-3">
                <span className="text-sm text-gray-600">Total days</span>
                <span className="text-right">
                  <span key={totalDays} className="dissolve-in block text-2xl font-semibold tabular-nums text-navy">{totalDays}</span>
                  {breakdown.saturdays > 0 && <span className="block text-[11px] text-gray-400">{breakdown.saturdays} Saturday{breakdown.saturdays === 1 ? '' : 's'} not counted</span>}
                  {breakdown.holidays.length > 0 && (
                    <span className="block text-[11px] text-sky-700" title={breakdown.holidays.map((h) => `${h.date} ${h.name}`).join('\n')}>
                      {breakdown.holidays.length} holiday{breakdown.holidays.length === 1 ? '' : 's'} not counted ({[...new Set(breakdown.holidays.map((h) => h.name))].join(', ')})
                    </span>
                  )}
                </span>
              </div>
              {(tried || errors.balance || errors.clash) && (errors.dates || errors.balance || errors.clash) && (
                <p className="text-xs text-red-600">{errors.dates ?? errors.balance ?? errors.clash}</p>
              )}

              <div>
                <label htmlFor="lv-reason" className="mb-1.5 block text-xs font-semibold text-navy">Reason</label>
                <textarea id="lv-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className={`${inputClass} resize-y`} placeholder="e.g. Family wedding in Pokhara" />
                {tried && errors.reason && <p className="mt-1 text-xs text-red-600">{errors.reason}</p>}
              </div>

              <button type="button" onClick={submit} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light sm:w-auto sm:px-6">
                <Send size={15} /> Submit request
              </button>
            </section>

            {/* My open requests */}
            {leave.filter((l) => l.staffName === currentUser.name && l.status === 'Pending').length > 0 && (
              <section className="rounded-xl border border-grey-border bg-white px-5 py-3">
                <p className="mb-2 text-xs font-semibold text-gray-500">Waiting for approval</p>
                {leave.filter((l) => l.staffName === currentUser.name && l.status === 'Pending').map((l) => (
                  <p key={l.id} className="flex items-center gap-2 py-1 text-sm text-navy">
                    <StatusPill status={l.status} /> {l.type} · {rangeLabel(l)} · {daysOf(l)} day{daysOf(l) === 1 ? '' : 's'}
                  </p>
                ))}
              </section>
            )}
          </div>
        )}

        {/* ── Leave Requests ── */}
        {tab === 'Leave Requests' && (
          <section className="rounded-xl border border-grey-border bg-white">
            {pending.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">No requests waiting — you’re all caught up.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="bg-grey-bg text-left">
                      {['Employee', 'Leave type', 'Dates', 'Total days', 'Status', 'Action'].map((h) => (
                        <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 ${h === 'Action' ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((l) => {
                      const open = expanded === l.id;
                      const own = l.staffName === currentUser.name;
                      const b = balancesFor(l.staffName, leave, year, holidays).find((x) => x.type === l.type);
                      const holidayDays = countDays(l.from, l.to, holidays).holidays;
                      const away = alsoAway(l);
                      return (
                        <Fragment key={l.id}>
                          <tr onClick={() => setExpanded(open ? null : l.id)} className="cursor-pointer border-t border-grey-border hover:bg-grey-bg/50">
                            <td className="px-4 py-3 text-sm font-medium text-navy">{l.staffName}<p className="text-[11px] font-normal text-gray-400">{roleOf(l.staffName)}</p></td>
                            <td className="px-4 py-3 text-sm text-gray-600">{l.type}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{rangeLabel(l)}</td>
                            <td className="px-4 py-3 text-sm font-semibold tabular-nums text-navy">
                              {daysOf(l)}
                              {holidayDays.length > 0 && <p className="text-[11px] font-normal text-sky-700">+{holidayDays.length} holiday{holidayDays.length === 1 ? '' : 's'} free</p>}
                            </td>
                            <td className="px-4 py-3"><StatusPill status={l.status} /></td>
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              {own ? (
                                <span className="text-xs text-gray-400">Approved by Head Office</span>
                              ) : (
                                <span className="inline-flex gap-2">
                                  <button type="button" onClick={() => decide(l, false)} className="rounded-lg border border-grey-border px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-red-300 hover:text-red-700">Reject</button>
                                  <button type="button" onClick={() => decide(l, true)} className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light">Approve</button>
                                </span>
                              )}
                            </td>
                          </tr>
                          {open && (
                            <tr className="bg-grey-bg/40">
                              <td colSpan={6} className="px-4 py-3">
                                <div className="dissolve-in grid grid-cols-1 gap-3 text-sm sm:grid-cols-[1fr_auto]">
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500">Reason</p>
                                    <p className="text-gray-700">“{l.reason}”</p>
                                    <p className="mt-1 text-[11px] text-gray-400">Requested {l.requestedAt}</p>
                                    {away.length > 0 && (
                                      <p className="mt-1 text-xs text-amber-700">Also away those days: {away.map((o) => `${o.staffName} (${o.type})`).join(', ')}</p>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    {b && <p className="text-xs text-gray-500">{l.type} balance: {b.remaining} → <b className="text-navy">{b.remaining - daysOf(l)}</b> after approval</p>}
                                    {holidayDays.length > 0 && <p className="text-xs text-sky-700">Not deducted: {[...new Set(holidayDays.map((h) => h.name))].join(', ')} ({holidayDays.length} day{holidayDays.length === 1 ? '' : 's'})</p>}
                                    {!own && (
                                      <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Note if rejecting (optional)" className="w-full rounded-lg border border-grey-border bg-white px-3 py-1.5 text-xs text-navy sm:w-64" />
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── Leave History ── */}
        {tab === 'Leave History' && (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isManager ? 'Search employee, type or reason' : 'Search type or reason'} className="w-full rounded-lg border border-grey-border bg-white py-2.5 pl-10 pr-3 text-sm focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light" />
              </div>
              <select value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Leave type" className="rounded-lg border border-grey-border bg-white px-3 py-2.5 text-sm text-navy">
                <option value="">All types</option>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status" className="rounded-lg border border-grey-border bg-white px-3 py-2.5 text-sm text-navy">
                <option value="">All statuses</option>
                {(['Pending', 'Approved', 'Rejected', 'Returned'] as const).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="bg-grey-bg text-left">
                    {[...(isManager ? ['Employee'] : []), 'Leave type', 'Date range', 'Total days', 'Status', 'Approved by'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((l) => (
                    <tr key={l.id} className="border-t border-grey-border">
                      {isManager && <td className="px-4 py-2.5 text-sm font-medium text-navy">{l.staffName}</td>}
                      <td className="px-4 py-2.5 text-sm text-gray-600">{l.type}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">{rangeLabel(l)} {l.from.slice(0, 4) !== String(year) ? l.from.slice(0, 4) : ''}</td>
                      <td className="px-4 py-2.5 text-sm tabular-nums text-gray-600">{daysOf(l)}</td>
                      <td className="px-4 py-2.5"><StatusPill status={l.status} /></td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">
                        {l.status === 'Approved' ? l.decidedBy : l.status === 'Rejected' ? <span className="text-gray-400" title={l.decisionNote}>— rejected by {l.decidedBy}{l.decisionNote ? ` · “${l.decisionNote}”` : ''}</span> : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No leave records.</p>}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} aria-label="Dismiss" className="ml-1 text-white/80 hover:text-white"><X size={15} /></button>
          {toast.startsWith('Approved') && (
            <button type="button" onClick={() => onNavigate('hr-att-today')} className="ml-2 whitespace-nowrap font-semibold underline-offset-2 hover:underline">Open Attendance</button>
          )}
        </div>
      )}
    </div>
  );
}
