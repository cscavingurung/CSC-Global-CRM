import { useState } from 'react';
import { Ban, Download, Eye, Search, X } from 'lucide-react';
import { FinTransaction } from '../../types';
import { methodText, rs, serviceLabel, stampMs, txStatus } from '../../finance';
import { formatSubmittedAt } from '../../dateTime';
import { useFinance } from './financeContext';
import { ClientCell, Pill, TableBox, Td, Th, ViewHeader } from './FinanceShared';

// 3 — Automated Receipts: one per payment, generated automatically and never edited. Voiding
// keeps the receipt and its number with the reason, who voided it and when.
export default function ReceiptsView() {
  const { transactions, currentUser, onSave, flash } = useFinance();
  const [q, setQ] = useState('');
  const [voiding, setVoiding] = useState<{ id: string; reason: string } | null>(null);
  const [preview, setPreview] = useState<FinTransaction | null>(null);

  const term = q.trim().toLowerCase();
  const list = transactions
    .filter((t) => t.kind === 'Payment' && t.receiptNo && (!term || `${t.receiptNo} ${t.clientName} ${t.clientId}`.toLowerCase().includes(term)))
    .sort((a, b) => stampMs(b.at) - stampMs(a.at));

  const confirmVoid = () => {
    const p = list.find((x) => x.id === voiding?.id);
    if (!p || !voiding?.reason.trim()) return;
    onSave({ ...p, void: { reason: voiding.reason.trim(), by: currentUser.name, at: formatSubmittedAt(new Date()) } });
    setVoiding(null);
    flash(`${p.receiptNo} voided — kept on record with your reason.`);
  };

  return (
    <div className="space-y-4">
      <ViewHeader description="Generated automatically for every payment. Read-only — a mistake is voided with a reason, never edited or deleted.">
        <div className="relative sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Receipt no., client or Client ID" className="w-full rounded-lg border border-grey-border bg-white py-2.5 pl-9 pr-3 text-sm focus:border-navy-light focus:outline-none" />
        </div>
      </ViewHeader>
      <TableBox>
        <thead><tr className="bg-grey-bg"><Th>Receipt #</Th><Th>Date</Th><Th>Client</Th><Th right>Amount</Th><Th>Method</Th><Th>Status</Th><Th right>Actions</Th></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className="border-t border-grey-border">
              <Td className="whitespace-nowrap font-medium text-navy">{p.receiptNo}</Td>
              <Td className="whitespace-nowrap text-gray-600">{p.at}</Td>
              <Td><ClientCell t={p} /></Td>
              <Td right className={p.void ? 'text-gray-400 line-through' : 'text-navy'}>{rs(p.amount)}</Td>
              <Td className="text-gray-600">{methodText(p)}</Td>
              <Td><Pill text={txStatus(p)} />{p.void && <span className="block max-w-[200px] text-[11px] text-gray-400">{p.void.reason} · {p.void.by}</span>}</Td>
              <Td right>
                {voiding?.id === p.id ? (
                  <span className="flex items-center justify-end gap-1.5">
                    <input autoFocus value={voiding.reason} onChange={(e) => setVoiding({ id: p.id, reason: e.target.value })} placeholder="Reason for voiding (required)" className="w-52 rounded-md border border-grey-border px-2 py-1 text-xs text-navy" />
                    <button type="button" onClick={confirmVoid} disabled={!voiding.reason.trim()} className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">Void</button>
                    <button type="button" onClick={() => setVoiding(null)} aria-label="Cancel" className="text-gray-400 hover:text-navy"><X size={14} /></button>
                  </span>
                ) : (
                  <span className="inline-flex gap-1.5">
                    <button type="button" onClick={() => setPreview(p)} className="inline-flex items-center gap-1 rounded-md border border-grey-border px-2.5 py-1 text-xs font-medium text-navy hover:border-navy-light"><Eye size={12} /> View / Download</button>
                    {!p.void && <button type="button" onClick={() => setVoiding({ id: p.id, reason: '' })} className="inline-flex items-center gap-1 rounded-md border border-grey-border px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-red-300 hover:text-red-700"><Ban size={12} /> Void Receipt</button>}
                  </span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableBox>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="dissolve-in relative w-full max-w-sm rounded-2xl border border-grey-border bg-white">
            <div className="flex items-center justify-between border-b border-grey-border px-5 py-3">
              <p className="text-sm font-semibold text-navy">Receipt</p>
              <button type="button" onClick={() => setPreview(null)} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
            </div>
            <div className="space-y-3 px-5 py-5">
              <div className="text-center">
                <p className="text-base font-bold text-navy">CSC Global</p>
                <p className="text-xs text-gray-500">{currentUser.branch} branch · Payment receipt</p>
              </div>
              {preview.void && <p className="rounded-md bg-red-50 px-3 py-1.5 text-center text-xs font-semibold text-red-700">VOID — {preview.void.reason}</p>}
              <dl className="space-y-1.5 text-sm">
                {[
                  ['Receipt no.', preview.receiptNo],
                  ['Date', preview.at],
                  ['Client', `${preview.clientName} (${preview.clientId})`],
                  ['Service', `${serviceLabel(preview)}${preview.planId ? ` — instalment ${preview.installment}` : ''}`],
                  ['Method', methodText(preview)],
                  ['Received by', preview.by],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="text-gray-500">{k}</dt><dd className="text-right text-navy">{v}</dd></div>
                ))}
              </dl>
              <div className="flex items-center justify-between border-t border-grey-border pt-3">
                <span className="text-sm text-gray-500">Amount received</span>
                <span className={`text-xl font-bold tabular-nums ${preview.void ? 'text-gray-400 line-through' : 'text-navy'}`}>{rs(preview.amount)}</span>
              </div>
            </div>
            <div className="flex gap-2 border-t border-grey-border px-5 py-3">
              <button type="button" onClick={() => setPreview(null)} className="flex-1 rounded-lg border border-grey-border py-2 text-sm font-medium text-navy hover:bg-grey-bg">Close</button>
              <button type="button" onClick={() => flash(`PDF download isn’t connected yet — ${preview.receiptNo} would download here.`)} className="flex-1 rounded-lg bg-navy py-2 text-sm font-semibold text-white hover:bg-navy-light"><Download size={14} className="mr-1 inline" /> Download PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
