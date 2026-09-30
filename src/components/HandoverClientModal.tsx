import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, X } from 'lucide-react';
import { dateKey } from '../dateTime';

interface HandoverClientModalProps {
  clientName: string;
  currentCounselor: string;
  /** Other active counselors in the same branch. */
  counselors: string[];
  onCancel: () => void;
  onConfirm: (to: string, reason: string, handoverDate: string) => void;
  /** Branch Manager handover: show the Handover Date field and a manager-facing notice. */
  managerView?: boolean;
}

const REASONS = ['Client requested a different counselor', 'Workload balancing', 'Country specialisation', 'Counselor going on leave', 'Counselor absent'];

/** Counselor → counselor case transfer, with a mandatory reason. */
export default function HandoverClientModal({ clientName, currentCounselor, counselors, onCancel, onConfirm, managerView }: HandoverClientModalProps) {
  const today = dateKey(new Date());
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today);
  const valid = Boolean(to && reason.trim().length >= 5 && date >= today);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const field = 'w-full rounded-lg border border-grey-border bg-white px-3 py-2.5 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={onCancel} />
      <div role="dialog" aria-modal="true" aria-label="Handover Client" className="dissolve-in relative w-full max-w-md rounded-2xl border border-grey-border bg-white">
        <div className="flex items-center justify-between border-b border-grey-border px-6 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-navy"><ArrowRightLeft size={17} /> Handover Client</h3>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-1 text-gray-400 transition-colors hover:text-navy-light"><X size={18} /></button>
        </div>
        <form className="space-y-4 px-6 py-5" onSubmit={(e) => { e.preventDefault(); if (valid) onConfirm(to, reason.trim(), date); }}>
          <p className="text-sm text-gray-600">Transfer <b className="text-navy">{clientName}</b> to another counselor in {managerView ? 'the' : 'your'} branch.</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Current Counselor</span>
            <input value={currentCounselor} readOnly aria-readonly className={`${field} cursor-not-allowed bg-grey-bg text-gray-500`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Transfer To <span className="text-red-500">*</span></span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={field} disabled={counselors.length === 0}>
              <option value="">{counselors.length ? 'Select a counselor' : 'No other active counselor in this branch'}</option>
              {counselors.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Reason for Handover <span className="text-red-500">*</span></span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why is this client being transferred?" className={`${field} resize-y`} />
            <span className="mt-1.5 flex flex-wrap gap-1">
              {REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-grey-border px-2 py-0.5 text-[11px] text-gray-600 transition-colors hover:border-navy-light hover:text-navy-light">{r}</button>
              ))}
            </span>
          </label>
          {managerView && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Handover Date <span className="text-red-500">*</span></span>
              <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={field} />
              <span className="mt-1 block text-[11px] text-gray-400">Effective date recorded on the audit trail. The new counselor gets the client straight away.</span>
            </label>
          )}
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {managerView
              ? `${currentCounselor} loses access to this client's pipeline and the selected counselor is notified.`
              : 'Transferring this client will remove them from your active pipeline and assign them to the selected counselor.'}
          </p>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy transition-colors hover:border-navy-light">Cancel</button>
            <button type="submit" disabled={!valid} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40">Confirm Handover</button>
          </div>
        </form>
      </div>
    </div>
  );
}
