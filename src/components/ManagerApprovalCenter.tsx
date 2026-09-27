import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle, ChevronDown, ClipboardCheck, Inbox, Search, Undo2, X, XCircle } from 'lucide-react';
import {
  AttendanceCorrection, AttendanceRecord, BranchTransfer, ExpenseRequest, FinTransaction, Holiday, LeaveRecord, MockUser, NavIntent,
} from '../types';
import {
  DECISION_STATUS_STYLES, DECISION_TYPES, Decision, DecisionStatus, NO_RETURN, SOURCES, TYPE_STYLES, collectDecisions,
} from '../approvals';
import { applyCorrection } from '../attendance';
import { formatActivityTime, formatSubmittedAt, parseSubmittedAt } from '../dateTime';
import CompactDateRangeFilter from './CompactDateRangeFilter';

// ─── Manager Approval Center ────────────────────────────────────────────────
// The Branch Manager's decision inbox. It stores nothing itself: pending requests are gathered
// from Leave Management, HRM Attendance (corrections), Financial Management (discounts and
// refunds) and Expense Claims, and each decision is written back to the module it came from.
// Decisions only — everyday work stays on the Daily Task Board. One page; the three views are
// switched with React state.

type View = 'Pending Approvals' | 'My Decisions' | 'Approval History';
const VIEWS: View[] = ['Pending Approvals', 'My Decisions', 'Approval History'];
const SOURCE_LABELS: Record<Decision['type'], string> = {
  Leave: 'Leave requests', 'Attendance Correction': 'Attendance corrections', Discount: 'Discounts', Refund: 'Refunds',
  'Payment Exception': 'Payment exceptions', Expense: 'Expense claims', 'Branch Transfer': 'Branch transfers',
};

interface ManagerApprovalCenterProps {
  currentUser: MockUser;
  leave: LeaveRecord[];
  corrections: AttendanceCorrection[];
  attendance: AttendanceRecord[];
  transactions: FinTransaction[];
  expenses: ExpenseRequest[];
  holidays: Holiday[];
  /** Inter-branch transfer requests out of this branch. */
  transfers: BranchTransfer[];
  onDecideTransfer: (id: string, decision: 'Approved' | 'Rejected', note: string) => void;
  onUpdateLeave: (id: string, updates: Partial<LeaveRecord>) => void;
  onUpdateCorrection: (id: string, updates: Partial<AttendanceCorrection>) => void;
  onSaveAttendance: (record: AttendanceRecord) => void;
  onSaveTransaction: (t: FinTransaction) => void;
  onSaveExpense: (e: ExpenseRequest) => void;
  onNavigate: (key: string, intent?: NavIntent) => void;
}

const ms = (s?: string) => (s ? parseSubmittedAt(s)?.getTime() ?? 0 : 0);
const when = (s?: string) => {
  const d = s ? parseSubmittedAt(s) : null;
  return d ? formatActivityTime(d) : s ?? '';
};
const onDay = (s?: string) => {
  const d = s ? parseSubmittedAt(s) : null;
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

function TypePill({ type }: { type: Decision['type'] }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLES[type]}`}>{type}</span>;
}
function StatusPill({ status }: { status: DecisionStatus }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${DECISION_STATUS_STYLES[status]}`}>{status === 'Returned' ? 'Changes requested' : status}</span>;
}
function SourceTag({ type }: { type: Decision['type'] }) {
  return <span className="text-[11px] text-gray-400">from {SOURCES[type].module}</span>;
}

export default function ManagerApprovalCenter(props: ManagerApprovalCenterProps) {
  const { currentUser, onNavigate } = props;
  const [view, setView] = useState<View>('Pending Approvals');
  const [reviewing, setReviewing] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 3500); };

  const decisions = useMemo(
    () => collectDecisions({ leave: props.leave, corrections: props.corrections, attendance: props.attendance, transactions: props.transactions, expenses: props.expenses, holidays: props.holidays, transfers: props.transfers }),
    [props.leave, props.corrections, props.attendance, props.transactions, props.expenses, props.holidays, props.transfers]
  );
  const pending = decisions.filter((d) => d.status === 'Pending').sort((a, b) => ms(a.requestedAt) - ms(b.requestedAt));
  const decided = decisions.filter((d) => d.status !== 'Pending' && d.decidedBy).sort((a, b) => ms(b.decidedAt) - ms(a.decidedAt));
  const mine = decided.filter((d) => d.decidedBy === currentUser.name);
  const count = (s: DecisionStatus) => decided.filter((d) => d.status === s).length;

  // ── Write a decision back to the module the request came from ──
  const decide = (d: Decision, status: Exclude<DecisionStatus, 'Pending'>) => {
    // Sending a request back only helps if the requester is told what to change.
    if (status === 'Returned' && !note.trim()) {
      setNoteError('Say what needs to change so the requester can fix it.');
      return;
    }
    // A rejected transfer leaves the client stranded between branches — the receiving branch needs to know why.
    if (d.type === 'Branch Transfer' && status === 'Rejected' && !note.trim()) {
      setNoteError('Give the receiving branch a reason for rejecting the transfer.');
      return;
    }
    const at = formatSubmittedAt(new Date());
    const decisionNote = note.trim() || undefined;
    const base = { decidedBy: currentUser.name, decidedAt: at, decisionNote };
    if (d.type === 'Branch Transfer') {
      // Approval moves the client's primary branch — App.tsx applies it and writes the audit trail.
      if (status === 'Returned') return;
      props.onDecideTransfer(d.sourceId, status, decisionNote ?? '');
    } else if (d.type === 'Leave') {
      // Approved leave is what Attendance reads as "On Leave" — nothing else to update.
      props.onUpdateLeave(d.sourceId, { status, ...base });
    } else if (d.type === 'Attendance Correction') {
      props.onUpdateCorrection(d.sourceId, { status, ...base });
      const c = props.corrections.find((x) => x.id === d.sourceId);
      if (status === 'Approved' && c) {
        // Amends the day's single record; the original punch is preserved.
        props.onSaveAttendance(applyCorrection(props.attendance.find((r) => r.staffName === c.staffName && r.date === c.date), c, currentUser.name, at));
      }
    } else if (d.type === 'Discount' || d.type === 'Refund' || d.type === 'Payment Exception') {
      // A refund approval never edits the original payment — the refund is its own ledger row.
      const t = props.transactions.find((x) => x.id === d.sourceId);
      if (t) props.onSaveTransaction({ ...t, status, ...base });
    } else {
      const e = props.expenses.find((x) => x.id === d.sourceId);
      if (e) props.onSaveExpense({ ...e, status, ...base });
    }
    setReviewing(null);
    setNote('');
    setNoteError('');
    const verb = status === 'Returned' ? 'sent back for changes' : status.toLowerCase();
    flash(`${d.type} for ${d.subject} ${verb} — updated in ${SOURCES[d.type].module}.`);
  };

  // ── History filters ──
  const [hf, setHf] = useState({ type: '', who: '', from: '', to: '', status: '' });
  const people = [...new Set(decided.map((d) => d.subject))].sort();
  const history = decided.filter((d) =>
    (!hf.type || d.type === hf.type) && (!hf.who || d.subject === hf.who) && (!hf.status || d.status === hf.status)
    && (!hf.from || (d.decidedAt ?? '').slice(0, 10) >= hf.from) && (!hf.to || (d.decidedAt ?? '').slice(0, 10) <= hf.to));

  const bySource = DECISION_TYPES.map((t) => ({ t, n: pending.filter((d) => d.type === t).length }));
  const selectClass = 'w-full appearance-none rounded-lg border border-grey-border bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-navy focus:border-navy-light focus:outline-none sm:w-auto';

  return (
    <div className="space-y-5">
      {/* 1 — Summary banner */}
      <section className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Pending', value: pending.length, icon: <Inbox size={16} />, tone: 'text-amber-600', v: 'Pending Approvals' as View },
            { label: 'Approved', value: count('Approved'), icon: <CheckCircle size={16} />, tone: 'text-emerald-600', v: 'Approval History' as View, s: 'Approved' },
            { label: 'Rejected', value: count('Rejected'), icon: <XCircle size={16} />, tone: 'text-red-600', v: 'Approval History' as View, s: 'Rejected' },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => { setView(c.v); if (c.s) setHf({ type: '', who: '', from: '', to: '', status: c.s }); }}
              className="flex items-center gap-4 rounded-xl border border-grey-border bg-white px-5 py-4 text-left transition-colors hover:border-navy-light/40"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg bg-grey-bg ${c.tone}`}>{c.icon}</span>
              <span>
                <span className={`block text-3xl font-semibold tabular-nums ${c.value === 0 ? 'text-gray-300' : c.tone}`}>{c.value}</span>
                <span className="block text-sm text-gray-500">{c.label}</span>
              </span>
            </button>
          ))}
        </div>
        {/* Where the requests come from */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-grey-border bg-white px-4 py-2.5 text-xs">
          <span className="font-semibold text-gray-500">Aggregated from</span>
          {bySource.map(({ t, n }) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-grey-border px-2.5 py-1 text-gray-600">
              <span className={`h-1.5 w-1.5 rounded-full ${n ? 'bg-amber-500' : 'bg-gray-300'}`} />
              {SOURCE_LABELS[t]}
              <span className="text-gray-400">· {SOURCES[t].module}</span>
              {n > 0 && <b className="tabular-nums text-navy">{n}</b>}
            </span>
          ))}
          {count('Returned') > 0 && <span className="ml-auto text-gray-500">{count('Returned')} sent back for changes</span>}
        </div>
      </section>

      {/* View selector */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Approval Center view">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${view === v ? 'border-navy bg-navy text-white' : 'border-grey-border bg-white text-gray-600 hover:border-navy-light hover:text-navy-light'}`}
          >
            {v}
            <span className={`rounded-full px-1.5 text-[11px] font-semibold ${view === v ? 'bg-white/20 text-white' : 'bg-grey-bg text-gray-500'}`}>
              {v === 'Pending Approvals' ? pending.length : v === 'My Decisions' ? mine.length : decided.length}
            </span>
          </button>
        ))}
      </div>

      <div key={view} className="dissolve-in">
        {/* 2 — Pending Approvals */}
        {view === 'Pending Approvals' && (
          pending.length === 0 ? (
            <div className="rounded-xl border border-grey-border bg-white py-14 text-center">
              <ClipboardCheck size={28} className="mx-auto text-emerald-500" />
              <p className="mt-2 text-sm font-medium text-navy">Inbox zero — nothing waiting for your decision.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="bg-grey-bg text-left">
                    {['Request Type', 'Employee / Client', 'Detail / Amount', 'Requested By', 'Date', 'Action'].map((h) => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 ${h === 'Action' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pending.map((d) => (
                    <tr key={d.key} className="border-t border-grey-border">
                      <td className="px-4 py-3"><TypePill type={d.type} /><span className="mt-0.5 block"><SourceTag type={d.type} /></span></td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-navy">{d.subject}</span>
                        <span className="block text-[11px] text-gray-400">{d.subjectKind}{d.subjectId ? ` · ${d.subjectId}` : ''}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-navy">{d.detail}</td>
                      <td className="px-4 py-3 text-gray-600">{d.requestedBy}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{when(d.requestedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => { setReviewing(d); setNote(''); setNoteError(''); }} className="rounded-lg bg-navy px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-navy-light">
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* 3 — My Decisions */}
        {view === 'My Decisions' && (
          mine.length === 0 ? (
            <p className="rounded-xl border border-grey-border bg-white py-12 text-center text-sm text-gray-400">You haven’t decided anything yet.</p>
          ) : (
            <ul className="divide-y divide-grey-border rounded-xl border border-grey-border bg-white">
              {mine.map((d) => (
                <li key={d.key} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypePill type={d.type} />
                      <span className="text-sm font-medium text-navy">{d.subject}</span>
                      <span className="text-sm tabular-nums text-gray-600">· {d.detail}</span>
                    </div>
                    {d.note && <p className="mt-1 text-xs text-gray-500">“{d.note}”</p>}
                  </div>
                  <span className={`self-start rounded-lg px-3 py-1.5 text-xs font-semibold sm:self-auto ${DECISION_STATUS_STYLES[d.status]}`}>
                    {d.status === 'Approved' ? `Approved by ${d.decidedBy} on ${onDay(d.decidedAt)}`
                      : d.status === 'Rejected' ? `Rejected by ${d.decidedBy} on ${onDay(d.decidedAt)}`
                        : `Sent back for changes on ${onDay(d.decidedAt)}`}
                  </span>
                </li>
              ))}
            </ul>
          )
        )}

        {/* 4 — Approval History */}
        {view === 'Approval History' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
              {[
                { label: 'Request type', value: hf.type, set: (v: string) => setHf({ ...hf, type: v }), all: 'All request types', options: DECISION_TYPES as string[] },
                { label: 'Employee / Client', value: hf.who, set: (v: string) => setHf({ ...hf, who: v }), all: 'All employees & clients', options: people },
                { label: 'Status', value: hf.status, set: (v: string) => setHf({ ...hf, status: v }), all: 'All statuses', options: ['Approved', 'Rejected', 'Returned'] },
              ].map((f) => (
                <div key={f.label} className="relative">
                  <select value={f.value} onChange={(e) => f.set(e.target.value)} aria-label={f.label} className={selectClass}>
                    <option value="">{f.all}</option>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              ))}
              <CompactDateRangeFilter from={hf.from} to={hf.to} onFromChange={(v) => setHf({ ...hf, from: v })} onToChange={(v) => setHf({ ...hf, to: v })} />
              <p className="flex items-center gap-1.5 text-xs text-gray-400 sm:ml-auto"><Search size={12} /> Read-only audit record · {history.length} of {decided.length}</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="bg-grey-bg text-left">
                    {['Decided', 'Request Type', 'Employee / Client', 'Detail / Amount', 'Requested By', 'Decision', 'Decided By', 'Note'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((d) => (
                    <tr key={d.key} className="border-t border-grey-border align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{d.decidedAt}</td>
                      <td className="px-4 py-2.5"><TypePill type={d.type} /></td>
                      <td className="px-4 py-2.5 font-medium text-navy">{d.subject}</td>
                      <td className="px-4 py-2.5 tabular-nums text-gray-600">{d.detail}</td>
                      <td className="px-4 py-2.5 text-gray-600">{d.requestedBy}<span className="block text-[11px] text-gray-400">{d.requestedAt}</span></td>
                      <td className="px-4 py-2.5"><StatusPill status={d.status} /></td>
                      <td className="px-4 py-2.5 text-gray-600">{d.decidedBy}</td>
                      <td className="max-w-xs px-4 py-2.5 text-xs text-gray-500">{d.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No decisions match these filters.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Review modal */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setReviewing(null)} />
          <div className="dissolve-in relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-grey-border bg-white">
            <div className="flex items-start gap-3 border-b border-grey-border px-6 py-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2"><TypePill type={reviewing.type} /><SourceTag type={reviewing.type} /></div>
                <h3 className="mt-1.5 text-base font-semibold text-navy">{reviewing.subject} · {reviewing.detail}</h3>
                <p className="text-xs text-gray-500">Requested by {reviewing.requestedBy} · {when(reviewing.requestedAt)}</p>
              </div>
              <button type="button" onClick={() => setReviewing(null)} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <dl className="divide-y divide-grey-border rounded-lg border border-grey-border">
                {reviewing.facts.map((f) => (
                  <div key={f.label} className="flex justify-between gap-4 px-4 py-2 text-sm">
                    <dt className="text-gray-500">{f.label}</dt>
                    <dd className="text-right text-navy">{f.value}</dd>
                  </div>
                ))}
              </dl>
              {reviewing.reason && (
                <div>
                  <p className="text-xs font-semibold text-navy">Reason given</p>
                  <p className="mt-0.5 text-sm text-gray-700">“{reviewing.reason}”</p>
                </div>
              )}
              <div>
                <label htmlFor="decision-note" className="text-xs font-semibold text-navy">Note to requester <span className="font-normal text-gray-400">(required for Request Changes)</span></label>
                <textarea id="decision-note" value={note} onChange={(e) => { setNote(e.target.value); setNoteError(''); }} rows={2} className="mt-1 w-full resize-y rounded-lg border border-grey-border px-3 py-2 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light" />
                {noteError && <p className="mt-1 text-xs text-red-600">{noteError}</p>}
              </div>
              <button type="button" onClick={() => { setReviewing(null); onNavigate(SOURCES[reviewing.type].navKey, reviewing.type === 'Branch Transfer' ? { workspacePath: '/manager/transfers/inter-branch' } : undefined); }} className="inline-flex items-center gap-1 text-xs font-medium text-navy-light hover:text-navy">
                Open in {SOURCES[reviewing.type].module} <ArrowRight size={12} />
              </button>
            </div>
            <div className={`grid gap-2 border-t border-grey-border px-6 py-4 ${NO_RETURN.includes(reviewing.type) ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <button type="button" onClick={() => decide(reviewing, 'Approved')} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                <CheckCircle size={15} /> Approve
              </button>
              <button type="button" onClick={() => decide(reviewing, 'Rejected')} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
                <XCircle size={15} /> Reject
              </button>
              {!NO_RETURN.includes(reviewing.type) && (
                <button type="button" onClick={() => decide(reviewing, 'Returned')} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600">
                  <Undo2 size={15} /> Request Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
}
