import { useState } from 'react';
import { Check, X } from 'lucide-react';

// Approve / Reject for a pending refund or discount. Rejecting asks for an optional note.
export default function ApprovalButtons({ onApprove, onReject }: { onApprove: () => void; onReject: (note: string) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  if (rejecting) {
    return (
      <span className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:justify-end">
        <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className="w-44 rounded-md border border-grey-border px-2 py-1 text-xs text-navy" />
        <span className="flex gap-1.5">
          <button type="button" onClick={() => onReject(note.trim())} className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white">Reject</button>
          <button type="button" onClick={() => setRejecting(false)} aria-label="Cancel" className="text-gray-400 hover:text-navy"><X size={14} /></button>
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex gap-1.5">
      <button type="button" onClick={() => setRejecting(true)} className="rounded-md border border-grey-border px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-red-300 hover:text-red-700">Reject</button>
      <button type="button" onClick={onApprove} className="inline-flex items-center gap-1 rounded-md bg-navy px-2.5 py-1 text-xs font-semibold text-white hover:bg-navy-light"><Check size={12} /> Approve</button>
    </span>
  );
}
