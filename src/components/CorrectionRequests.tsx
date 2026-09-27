import { useState } from 'react';
import { ArrowRight, Check, ShieldCheck, X } from 'lucide-react';
import { AttendanceCorrection } from '../types';
import { AttendanceViewProps, applyCorrection, correctionIssue } from '../attendance';
import { timeOf } from '../branchOps';
import { formatSubmittedAt } from '../dateTime';

// ─── HRM · Attendance · Correction Requests ─────────────────────────────────
// The only way an attendance record changes. Approving amends the day's single record: the
// original punch is kept and the corrected time is appended alongside it.

const shortDate = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export default function CorrectionRequests({ currentUser, attendance, corrections, onSaveAttendance, onUpdateCorrection, onNavigate }: AttendanceViewProps) {
  const [tab, setTab] = useState<'Pending' | 'Decided'>('Pending');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [justApproved, setJustApproved] = useState<Set<string>>(new Set());

  const recordFor = (c: AttendanceCorrection) => attendance.find((r) => r.staffName === c.staffName && r.date === c.date);
  const pending = corrections.filter((c) => c.status === 'Pending').sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const decided = corrections.filter((c) => c.status !== 'Pending').sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));
  const list = tab === 'Pending' ? pending : decided;

  const approve = (c: AttendanceCorrection) => {
    const at = formatSubmittedAt(new Date());
    onSaveAttendance(applyCorrection(recordFor(c), c, currentUser.name, at));
    onUpdateCorrection(c.id, { status: 'Approved', decidedBy: currentUser.name, decidedAt: at });
    setJustApproved((prev) => new Set(prev).add(c.id));
  };
  const reject = (c: AttendanceCorrection) => {
    onUpdateCorrection(c.id, { status: 'Rejected', decidedBy: currentUser.name, decidedAt: formatSubmittedAt(new Date()), decisionNote: note.trim() || undefined });
    setRejecting(null);
    setNote('');
  };

  // The value as originally punched, and what it is (or would be) after this correction.
  const beforeAfter = (c: AttendanceCorrection) => {
    const r = recordFor(c);
    const amendment = r?.amendments?.find((a) => a.correctionId === c.id);
    const before = amendment ? amendment.from : r?.[c.field];
    return { before: timeOf(before) || null, after: c.requestedTime, applied: !!amendment };
  };

  return (
    <div className="max-w-5xl space-y-4">
      <div className="inline-flex rounded-lg border border-grey-border bg-white p-0.5">
        {(['Pending', 'Decided'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}>
            {t} <span className={tab === t ? 'text-white/70' : 'text-gray-400'}>{t === 'Pending' ? pending.length : decided.length}</span>
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="rounded-xl border border-grey-border bg-white py-12 text-center text-sm text-gray-400">
          {tab === 'Pending' ? 'No corrections waiting — every record is as punched.' : 'No decisions yet.'}
        </div>
      )}

      <div key={tab} className="dissolve-in space-y-3">
        {list.map((c) => {
          const { before, after, applied } = beforeAfter(c);
          const approved = c.status === 'Approved';
          return (
            <article key={c.id} className={`rounded-xl border bg-white ${justApproved.has(c.id) ? 'border-emerald-200' : 'border-grey-border'}`}>
              <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => onNavigate('hr-att-employee', { openStaffName: c.staffName, attendanceDate: c.date })} className="text-sm font-semibold text-navy hover:underline">
                      {c.staffName}
                    </button>
                    <span className="text-xs text-gray-500">{shortDate(c.date)}</span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{correctionIssue(c, approved ? { ...recordFor(c)!, ...recordFor(c)?.original } : recordFor(c))}</span>
                    {c.status !== 'Pending' && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${approved ? 'bg-emerald-50 text-emerald-700' : c.status === 'Returned' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>{c.status}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">“{c.reason}”</p>
                  <p className="text-[11px] text-gray-400">
                    Requested {c.requestedAt} by {c.requestedBy ?? c.staffName}
                    {c.decidedBy && <> · {c.status.toLowerCase()} by {c.decidedBy} {c.decidedAt}</>}
                    {c.decisionNote && <> · “{c.decisionNote}”</>}
                  </p>
                </div>

                {/* Requested change: original preserved, corrected value appended */}
                <div className="flex items-center gap-2 rounded-lg border border-grey-border px-3 py-2">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">{approved ? 'Original (kept)' : 'Recorded'}</p>
                    <p className={`text-sm tabular-nums ${approved ? 'text-gray-400 line-through decoration-gray-300' : 'text-navy'}`}>{before ?? 'Missing'}</p>
                  </div>
                  <ArrowRight size={14} className="text-gray-300" />
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">{approved ? 'Corrected' : 'Requested'} {c.field === 'checkOut' ? 'out' : 'in'}</p>
                    <p className={`text-sm font-semibold tabular-nums ${approved ? 'text-emerald-700' : c.status === 'Rejected' ? 'text-gray-400 line-through' : 'text-navy'}`}>{after}</p>
                  </div>
                  {approved && applied && <ShieldCheck size={16} className="text-emerald-600" aria-label="Applied with audit trail" />}
                </div>

                {c.status === 'Pending' && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setRejecting(c.id); setNote(''); }} className="inline-flex items-center gap-1 rounded-lg border border-grey-border px-3 py-2 text-sm font-medium text-gray-600 hover:border-red-300 hover:text-red-700">
                      <X size={14} /> Reject
                    </button>
                    <button type="button" onClick={() => approve(c)} className="inline-flex items-center gap-1 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-light">
                      <Check size={14} /> Approve
                    </button>
                  </div>
                )}
              </div>

              {rejecting === c.id && (
                <div className="dissolve-in flex flex-col gap-2 border-t border-grey-border bg-grey-bg/50 px-5 py-3 sm:flex-row">
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for rejecting (shown to the employee)" className="flex-1 rounded-lg border border-grey-border px-3 py-2 text-sm text-navy" />
                  <button type="button" onClick={() => setRejecting(null)} className="rounded-lg border border-grey-border px-3 py-2 text-sm text-navy">Cancel</button>
                  <button type="button" onClick={() => reject(c)} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">Reject request</button>
                </div>
              )}
              {justApproved.has(c.id) && (
                <p className="dissolve-in border-t border-emerald-100 bg-emerald-50/60 px-5 py-2 text-xs text-emerald-800">
                  Record amended — the original punch ({before ?? 'missing'}) is preserved and {after} is added as the corrected {c.field === 'checkOut' ? 'check-out' : 'check-in'}.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
