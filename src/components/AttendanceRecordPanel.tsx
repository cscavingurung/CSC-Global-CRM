import { useState } from 'react';
import { CircleDot, Clock, History, LogIn, LogOut, PenLine, ShieldCheck, X, XCircle } from 'lucide-react';
import { AttendanceCorrection, StaffMember } from '../types';
import { DAY_STATUS_STYLES, DayView, correctionIssue, formatMinutes, workedMinutes } from '../attendance';
import { timeOf } from '../branchOps';
import { parseSubmittedAt } from '../dateTime';

// Read-only detail for one employee-day, with its full audit timeline. There is deliberately
// no Edit button: any change goes through a correction request and approval.

interface AttendanceRecordPanelProps {
  day: DayView;
  member?: StaffMember;
  /** Every correction request raised for this employee-day. */
  corrections: AttendanceCorrection[];
  now: Date;
  onClose: () => void;
  /** Omit to hide the request form (e.g. the day is Off). */
  onRequestCorrection?: (field: AttendanceCorrection['field'], time: string, reason: string) => void;
  onOpenEmployee?: () => void;
}

const longDate = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// <input type="time"> "18:10" → "6:10 PM"
const formatTime = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return Number.isNaN(h) ? value : `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export default function AttendanceRecordPanel({ day, member, corrections, now, onClose, onRequestCorrection, onOpenEmployee }: AttendanceRecordPanelProps) {
  const r = day.record;
  const original = r?.original ?? { checkIn: r?.checkIn, checkOut: r?.checkOut };
  const pending = corrections.find((c) => c.status === 'Pending');
  const [form, setForm] = useState<{ open: boolean; field: AttendanceCorrection['field']; time: string; reason: string }>({
    open: false, field: day.missingCheckOut || (r?.checkIn && !r.checkOut) ? 'checkOut' : 'checkIn', time: r?.checkIn && !r.checkOut ? '18:00' : '09:00', reason: '',
  });

  // Timeline, oldest first: punches as recorded, then each request and approved amendment.
  type Entry = { at: string; icon: React.ReactNode; tone: string; title: React.ReactNode; detail?: React.ReactNode };
  const entries: Entry[] = [];
  if (original.checkIn) entries.push({ at: original.checkIn, icon: <LogIn size={13} />, tone: 'text-navy', title: <>Checked in <b>{timeOf(original.checkIn)}</b></>, detail: 'Original punch' });
  if (original.checkOut) entries.push({ at: original.checkOut, icon: <LogOut size={13} />, tone: 'text-navy', title: <>Checked out <b>{timeOf(original.checkOut)}</b></>, detail: 'Original punch' });
  corrections.forEach((c) => {
    entries.push({
      at: c.requestedAt, icon: <PenLine size={13} />, tone: 'text-gray-500',
      title: <>{c.requestedBy ?? c.staffName} requested {c.field === 'checkOut' ? 'check-out' : 'check-in'} <b>{c.requestedTime}</b></>,
      detail: <>{correctionIssue(c, r && { ...r, ...original })} · “{c.reason}”</>,
    });
    if (c.status === 'Rejected') {
      entries.push({ at: c.decidedAt ?? c.requestedAt, icon: <XCircle size={13} />, tone: 'text-red-600', title: <>Rejected by {c.decidedBy}</>, detail: c.decisionNote });
    }
  });
  (r?.amendments ?? []).forEach((a) => {
    entries.push({
      at: a.approvedAt, icon: <ShieldCheck size={13} />, tone: 'text-emerald-600',
      title: <>{a.field === 'checkOut' ? 'Check-out' : 'Check-in'} corrected {a.from ? <><s className="text-gray-400">{timeOf(a.from)}</s> → </> : 'to '}<b>{timeOf(a.to)}</b></>,
      detail: <>Approved by {a.approvedBy} · {a.approvedAt}</>,
    });
  });
  // Stamps are "YYYY-MM-DD h:mm AM" — sort by real time, not text ("11:20 AM" < "9:32 AM" as strings).
  const ms = (s: string) => parseSubmittedAt(s)?.getTime() ?? 0;
  entries.sort((x, y) => ms(x.at) - ms(y.at));

  const submit = () => {
    if (!form.reason.trim() || !onRequestCorrection) return;
    onRequestCorrection(form.field, formatTime(form.time), form.reason.trim());
    setForm({ ...form, open: false, reason: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy-dark/30" onClick={onClose} />
      <aside className="dissolve-in relative flex h-full w-full max-w-md flex-col border-l border-grey-border bg-white">
        <div className="flex items-start gap-3 border-b border-grey-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-navy">{day.staffName}</p>
            <p className="text-xs text-gray-500">{member?.role ? `${member.role} · ` : ''}{longDate(day.date)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Current values */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${DAY_STATUS_STYLES[day.status]}`}>{day.status}</span>
            {day.missingCheckOut && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Missing check-out</span>}
            {r?.amendments?.length ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">Corrected</span> : null}
            {day.leave && <span className="text-xs text-gray-500">{day.leave.type} leave</span>}
          </div>
          <dl className="grid grid-cols-3 gap-3 rounded-lg border border-grey-border px-4 py-3">
            {[
              ['Check-in', timeOf(r?.checkIn) || '—'],
              ['Check-out', timeOf(r?.checkOut) || '—'],
              ['Working time', formatMinutes(workedMinutes(r, now))],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] text-gray-400">{label}</dt>
                <dd className="text-sm font-semibold tabular-nums text-navy">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Audit timeline */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400"><History size={12} /> Audit trail</p>
            {entries.length === 0 ? (
              <p className="text-sm text-gray-400">No punches recorded for this day.</p>
            ) : (
              <ol>
                {entries.map((e, i) => (
                  <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < entries.length - 1 && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-grey-border" aria-hidden="true" />}
                    <span className={`relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-grey-border bg-white ${e.tone}`}>{e.icon}</span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm text-navy">{e.title}</p>
                      <p className="text-[11px] text-gray-400">{e.at}{e.detail ? <> · {e.detail}</> : null}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {r?.original && (
              <p className="mt-3 rounded-lg bg-grey-bg px-3 py-2 text-[11px] text-gray-500">
                Original punches are kept permanently: in {timeOf(r.original.checkIn) || '—'}, out {timeOf(r.original.checkOut) || '—'}.
              </p>
            )}
          </div>

          {pending && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <CircleDot size={14} className="mt-0.5 flex-shrink-0" /> A correction is waiting for approval — {pending.field === 'checkOut' ? 'check-out' : 'check-in'} {pending.requestedTime}.
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-grey-border px-5 py-4">
          {onRequestCorrection && !pending && (
            form.open ? (
              <div className="dissolve-in space-y-2">
                <p className="text-xs text-gray-500">Records can’t be edited. This raises a correction request that must be approved — the original stays on record.</p>
                <div className="grid grid-cols-2 gap-2">
                  <select value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value as AttendanceCorrection['field'] })} className="rounded-lg border border-grey-border px-3 py-2 text-sm text-navy" aria-label="Which punch">
                    <option value="checkIn">Check-in</option>
                    <option value="checkOut">Check-out</option>
                  </select>
                  <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="rounded-lg border border-grey-border px-3 py-2 text-sm text-navy" aria-label="Correct time" />
                </div>
                <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason (required)" className="w-full rounded-lg border border-grey-border px-3 py-2 text-sm text-navy" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm({ ...form, open: false })} className="flex-1 rounded-lg border border-grey-border py-2 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
                  <button type="button" onClick={submit} disabled={!form.reason.trim()} className="flex-1 rounded-lg bg-navy py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40">Send for approval</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setForm({ ...form, open: true })} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-navy py-2.5 text-sm font-semibold text-navy hover:bg-navy hover:text-white">
                <PenLine size={15} /> Request Correction
              </button>
            )
          )}
          {onOpenEmployee && (
            <button type="button" onClick={onOpenEmployee} className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-navy-light hover:text-navy">
              <Clock size={13} /> Open {day.staffName.split(' ')[0]}’s attendance calendar
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
