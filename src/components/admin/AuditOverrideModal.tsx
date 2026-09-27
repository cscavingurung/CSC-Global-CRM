import { useEffect, useState } from 'react';
import { ArrowRight, ShieldAlert, X } from 'lucide-react';

// Administrative Override — the Super Admin's way past normal permissions. Reusable: the caller
// says what's changing (original → new) and applies it; this modal only collects the mandatory
// reason. Every confirmed override is appended to the immutable audit log by App.tsx.

interface AuditOverrideModalProps {
  /** What's being overridden, e.g. "Task · Renew printer contract (Pokhara)". */
  record: string;
  field: string;
  originalValue: string;
  newValue: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const MIN_REASON = 10;

export default function AuditOverrideModal({ record, field, originalValue, newValue, onCancel, onConfirm }: AuditOverrideModalProps) {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= MIN_REASON;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const readOnly = 'w-full cursor-not-allowed rounded-lg border border-grey-border bg-grey-bg px-3 py-2.5 text-sm font-medium text-gray-600';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={onCancel} />
      <div role="dialog" aria-modal="true" aria-label="Administrative Override" className="dissolve-in relative w-full max-w-lg rounded-2xl border border-grey-border bg-white">
        <div className="flex items-center justify-between border-b border-grey-border px-6 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-navy"><ShieldAlert size={18} /> Administrative Override</h3>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-1 text-gray-400 transition-colors hover:text-navy-light"><X size={18} /></button>
        </div>
        <form className="space-y-4 px-6 py-5" onSubmit={(e) => { e.preventDefault(); if (valid) onConfirm(reason.trim()); }}>
          <div className="rounded-xl bg-grey-bg px-4 py-3 text-sm">
            <p className="text-xs text-gray-400">Record</p>
            <p className="font-medium text-navy">{record}</p>
            <p className="mt-1 text-xs text-gray-400">Field: <span className="text-navy">{field}</span></p>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Original Value</span>
              <input value={originalValue} readOnly aria-readonly className={readOnly} />
            </label>
            <ArrowRight size={16} className="mb-3 text-gray-400" />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">New Value</span>
              <input value={newValue} readOnly aria-readonly className={`${readOnly} text-navy`} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Reason for Override <span className="text-red-500">*</span></span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why is this being overridden, and who asked for it?"
              className="w-full resize-y rounded-lg border border-grey-border px-3 py-2.5 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light" />
            <span className="mt-1 block text-[11px] text-gray-400">At least {MIN_REASON} characters.</span>
          </label>
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            This action will bypass standard permissions and be permanently recorded in the immutable audit log.
          </p>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy transition-colors hover:border-navy-light">Cancel</button>
            <button type="submit" disabled={!valid} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40">Confirm &amp; Log Override</button>
          </div>
        </form>
      </div>
    </div>
  );
}
