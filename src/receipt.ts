// Payment receipts — built from the ledger as it stood when the payment was taken, so a receipt
// shows exactly which charges the money went to and the balance left afterwards, and reprints
// identically later.
import { FinTransaction } from './types';
import { chargeLines, finDayLabel, rs, serviceLabel, stampMs } from './finance';

export interface ReceiptLine {
  label: string;
  due?: string;
  amount: number;
  paidBefore: number;
  thisPayment: number;
  remaining: number;
}

export interface ReceiptData {
  payment: FinTransaction;
  lines: ReceiptLine[];
  totalFees: number;
  discounts: number;
  paidBefore: number;
  thisPayment: number;
  balanceAfter: number;
  nextDue?: { label: string; date?: string; amount: number };
}

const chargeLabel = (c: FinTransaction) =>
  `${serviceLabel(c)}${c.planId ? ` — instalment ${c.installment} of ${c.installments}` : ''}`;

/** `clientTxs` = every ledger row for this client (the payment itself may or may not be in it). */
export function buildReceipt(clientTxs: FinTransaction[], payment: FinTransaction): ReceiptData {
  const at = stampMs(payment.at);
  // The account as it was just before this payment: earlier rows only.
  const before = clientTxs.filter((t) => t.id !== payment.id && stampMs(t.at) <= at);
  const after = [...before, payment];
  const linesBefore = chargeLines(before);
  const linesAfter = chargeLines(after);
  const paidBeforeOf = (id: string) => linesBefore.find((l) => l.charge.id === id)?.paid ?? 0;

  const lines: ReceiptLine[] = linesAfter
    .map((l) => ({
      label: chargeLabel(l.charge),
      due: l.charge.dueDate,
      amount: l.charge.amount,
      paidBefore: paidBeforeOf(l.charge.id),
      thisPayment: l.paid - paidBeforeOf(l.charge.id),
      remaining: l.remaining,
    }))
    .filter((l) => l.thisPayment > 0);

  const transferred = after.filter((t) => t.kind === 'Transfer').reduce((n, t) => n + t.amount, 0);
  const totalFees = linesAfter.reduce((n, l) => n + l.charge.amount, 0) - transferred;
  const discounts = after.filter((t) => t.kind === 'Discount' && (t.status === 'Approved' || t.status === 'Processed')).reduce((n, t) => n + t.amount, 0);
  const net = (rows: FinTransaction[]) =>
    rows.filter((t) => t.kind === 'Payment' && !t.void).reduce((n, t) => n + t.amount, 0)
    - rows.filter((t) => t.kind === 'Refund' && t.status === 'Processed').reduce((n, t) => n + t.amount, 0);
  const paidBefore = net(before);
  // Same rule as clientBalances(): refunds are credits and never raise the balance.
  const balanceAfter = Math.max(0, totalFees - discounts - after.filter((t) => t.kind === 'Payment' && !t.void).reduce((n, t) => n + t.amount, 0));
  const next = linesAfter.find((l) => l.remaining > 0);

  return {
    payment, lines, totalFees, discounts, paidBefore, thisPayment: payment.amount, balanceAfter,
    nextDue: next && balanceAfter > 0 ? { label: chargeLabel(next.charge), date: next.charge.dueDate, amount: next.remaining } : undefined,
  };
}

// ─── Amount in words (Indian numbering: thousand, lakh, crore) ──────────────
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const twoDigits = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const threeDigits = (n: number) => (n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigits(n % 100)}` : ''}` : twoDigits(n));

export function amountInWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return 'Zero Rupees Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return `${parts.join(' ')} Rupees Only`;
}

// ─── Printable receipt ──────────────────────────────────────────────────────
// Record values (names, titles) are escaped before going into the receipt's HTML.
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function receiptHtml(r: ReceiptData, branch: string, autoPrint = true): string {
  const p = r.payment;
  const method = `${p.method === 'Bank' ? (p.methodNote ?? 'Bank transfer') : p.method === 'Other' ? (p.methodNote ?? 'Other') : 'Cash'}`;
  const row = (k: string, v: string) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`;
  const lineRows = r.lines.map((l) => `<tr>
      <td>${esc(l.label)}${l.due ? `<div class="muted">Due ${esc(finDayLabel(l.due))}</div>` : ''}</td>
      <td class="num">${rs(l.amount)}</td><td class="num">${l.paidBefore ? rs(l.paidBefore) : '—'}</td>
      <td class="num strong">${rs(l.thisPayment)}</td><td class="num">${l.remaining ? rs(l.remaining) : 'Paid'}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.receiptNo ?? 'Receipt')}</title>
<style>
  *{box-sizing:border-box} body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#16283D;margin:0;padding:28px;font-size:13px}
  .sheet{max-width:640px;margin:0 auto;border:1px solid #E5E7EB;border-radius:12px;padding:24px}
  h1{margin:0;font-size:20px} .muted{color:#6b7280;font-size:11px} .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #16283D;padding-bottom:12px;margin-bottom:14px}
  .tag{display:inline-block;background:#ecfdf5;color:#047857;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:600}
  table{width:100%;border-collapse:collapse} .meta th{text-align:left;color:#6b7280;font-weight:500;padding:3px 0;width:38%} .meta td{padding:3px 0}
  .items{margin-top:14px} .items th{background:#f5f6f8;text-align:left;font-size:11px;color:#6b7280;padding:7px 8px;border-bottom:1px solid #E5E7EB}
  .items td{padding:8px;border-bottom:1px solid #E5E7EB;vertical-align:top} .num{text-align:right;white-space:nowrap} .strong{font-weight:700}
  .totals{margin-top:14px;margin-left:auto;width:60%} .totals td{padding:4px 0} .totals .grand td{border-top:2px solid #16283D;padding-top:8px;font-size:15px;font-weight:700}
  .words{margin-top:12px;background:#f5f6f8;border-radius:8px;padding:8px 10px} .next{margin-top:10px;color:#92400e;background:#fffbeb;border-radius:8px;padding:8px 10px}
  .sign{display:flex;justify-content:space-between;margin-top:36px} .sign div{width:42%;border-top:1px solid #9ca3af;padding-top:6px;text-align:center;color:#6b7280;font-size:11px}
  .foot{margin-top:18px;text-align:center;color:#6b7280;font-size:11px}
  @media print{body{padding:0}.sheet{border:none;border-radius:0}}
</style></head><body><div class="sheet">
  <div class="head">
    <div><h1>CSC Global</h1><div class="muted">${esc(branch)} branch · Official payment receipt</div></div>
    <div style="text-align:right"><div class="strong">${esc(p.receiptNo ?? '')}</div><div class="muted">${esc(p.at)}</div><div style="margin-top:4px"><span class="tag">PAID</span></div></div>
  </div>
  <table class="meta">
    ${row('Received from', `${p.clientName} (${p.clientId})`)}
    ${row('Counselor', p.counselor)}
    ${row('Payment method', method)}
    ${row('Received by', p.by)}
    ${p.note ? row('Note', p.note) : ''}
  </table>
  <table class="items">
    <thead><tr><th>Charge paid for</th><th class="num">Charge</th><th class="num">Paid before</th><th class="num">This payment</th><th class="num">Left on item</th></tr></thead>
    <tbody>${lineRows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Total fees</td><td class="num">${rs(r.totalFees)}</td></tr>
    ${r.discounts ? `<tr><td>Approved discounts</td><td class="num">−${rs(r.discounts)}</td></tr>` : ''}
    <tr><td>Paid previously</td><td class="num">${rs(r.paidBefore)}</td></tr>
    <tr><td class="strong">This payment</td><td class="num strong">${rs(r.thisPayment)}</td></tr>
    <tr class="grand"><td>Balance remaining</td><td class="num">${rs(r.balanceAfter)}</td></tr>
  </table>
  <div class="words"><span class="muted">Amount received in words:</span> <strong>${esc(amountInWords(r.thisPayment))}</strong></div>
  ${r.nextDue ? `<div class="next">Next payment: <strong>${rs(r.nextDue.amount)}</strong> for ${esc(r.nextDue.label)}${r.nextDue.date ? ` · due ${esc(finDayLabel(r.nextDue.date))}` : ''}</div>` : '<div class="next" style="background:#ecfdf5;color:#047857">All fees are fully paid. Thank you!</div>'}
  <div class="sign"><div>Received by — ${esc(p.by)}</div><div>Client signature</div></div>
  <div class="foot">Computer-generated receipt · Please keep it for your records.</div>
</div>${autoPrint ? '<script>window.onload=function(){window.print()}</script>' : ''}</body></html>`;
}

/** Opens the receipt in its own window. With `print`, the print dialog opens too (Save as PDF works there). */
export function printReceipt(r: ReceiptData, branch: string, print = true) {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return false;
  w.document.write(receiptHtml(r, branch, print));
  w.document.close();
  return true;
}

/** Saves the receipt as a standalone file the client can open or print anywhere. */
export function downloadReceipt(r: ReceiptData, branch: string) {
  const blob = new Blob([receiptHtml(r, branch, false)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${r.payment.receiptNo ?? 'receipt'}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Short plain-text summary for sharing (SMS, WhatsApp, email). */
export function receiptSummary(r: ReceiptData, branch: string): string {
  const p = r.payment;
  return [
    `CSC Global (${branch}) — Payment receipt ${p.receiptNo}`,
    `${p.clientName} (${p.clientId}) · ${p.at}`,
    `Paid ${rs(p.amount)} for: ${r.lines.map((l) => l.label).join(', ')}`,
    `Balance remaining: ${rs(r.balanceAfter)}`,
  ].join('\n');
}

/** Shares via the device share sheet when available, otherwise copies the summary. */
export async function shareReceipt(r: ReceiptData, branch: string): Promise<'shared' | 'copied' | 'failed'> {
  const text = receiptSummary(r, branch);
  try {
    if (navigator.share) {
      await navigator.share({ title: `Receipt ${r.payment.receiptNo}`, text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
