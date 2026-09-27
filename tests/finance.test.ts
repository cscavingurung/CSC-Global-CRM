import { test, eq } from './harness';
import { chargeLines, clientBalances, isLivePayment, nextReceiptNo } from '/src/finance';
import { financeTotals } from '/src/superAdmin';
import type { FinTransaction } from '/src/types';

let n = 0;
const tx = (t: Partial<FinTransaction>): FinTransaction => ({
  id: `t${n++}`, branch: 'Kathmandu', kind: 'Charge', clientId: 'CSC-1', clientName: 'Client A', counselor: 'C', country: 'Australia',
  service: 'Visa Processing', amount: 0, at: '2026-09-01 10:00 AM', by: 'X', ...t,
});
const today = '2026-09-26';
const bal = (txs: FinTransaction[]) => clientBalances(txs, today)[0];

test('outstanding = charges − approved discounts − live payments', () => {
  const b = bal([tx({ amount: 35000, dueDate: '2026-10-01' }), tx({ kind: 'Payment', amount: 15000, receiptNo: 'R1' })]);
  eq(b.outstanding, 20000);
});

test('a pending discount does not reduce the balance; an approved one does', () => {
  const base = [tx({ amount: 25000, dueDate: '2026-10-01' })];
  eq(bal([...base, tx({ kind: 'Discount', amount: 5000, status: 'Pending Approval' })]).outstanding, 25000);
  eq(bal([...base, tx({ kind: 'Discount', amount: 5000, status: 'Approved' })]).outstanding, 20000);
  eq(bal([...base, tx({ kind: 'Discount', amount: 5000, status: 'Rejected' })]).outstanding, 25000);
});

test('a processed refund never re-opens a paid balance (regression)', () => {
  const b = bal([
    tx({ service: 'Consultation Fee', amount: 2000, dueDate: '2026-09-01' }),
    tx({ kind: 'Payment', service: 'Consultation Fee', amount: 2000, receiptNo: 'R2' }),
    tx({ kind: 'Refund', service: 'Consultation Fee', amount: 2000, status: 'Processed' }),
  ]);
  eq(b.outstanding, 0);
  eq(chargeLines([
    tx({ id: 'c', service: 'Consultation Fee', amount: 2000, dueDate: '2026-09-01' }),
    tx({ kind: 'Payment', amount: 2000 }),
    tx({ kind: 'Refund', amount: 2000, status: 'Processed' }),
  ])[0].remaining, 0);
});

test('a voided payment does not count', () => {
  const b = bal([tx({ amount: 12000, dueDate: '2026-10-01' }), tx({ kind: 'Payment', amount: 12000, void: { reason: 'dup', by: 'M', at: 'x' } })]);
  eq(b.outstanding, 12000);
  eq(isLivePayment(tx({ kind: 'Payment', amount: 1, void: { reason: 'r', by: 'b', at: 'a' } })), false);
});

test('outstanding never goes negative on over-payment', () => {
  eq(bal([tx({ amount: 1000, dueDate: '2026-10-01' }), tx({ kind: 'Payment', amount: 1500 })]).outstanding, 0);
});

test('an instalment payment covers its own instalment first', () => {
  const lines = chargeLines([
    tx({ id: 'i1', amount: 10000, dueDate: '2026-09-01', planId: 'P', installment: 1 }),
    tx({ id: 'i2', amount: 10000, dueDate: '2026-10-01', planId: 'P', installment: 2 }),
    tx({ kind: 'Payment', amount: 10000, planId: 'P', installment: 2 }),
  ]);
  eq(lines.map((l) => l.remaining), [10000, 0]);
});

test('receipt numbers continue the branch sequence per year', () => {
  const txs = [tx({ kind: 'Payment', receiptNo: 'RCP-KTM-2026-00041' }), tx({ kind: 'Payment', receiptNo: 'RCP-KTM-2026-00042' }), tx({ kind: 'Payment', receiptNo: 'RCP-KTM-2025-00990' })];
  eq(nextReceiptNo(txs, 'Kathmandu', 2026), 'RCP-KTM-2026-00043');
  eq(nextReceiptNo(txs, 'Kathmandu', 2027), 'RCP-KTM-2027-00001');
  eq(nextReceiptNo([], 'Pokhara', 2026), 'RCP-POK-2026-00001');
});

test('revenue counts a payment once, net of processed refunds only', () => {
  const rows = [
    { cells: { type: 'Payment', status: 'Received', amount: 20000 } },
    { cells: { type: 'Refund', status: 'Pending', amount: 5000 } },
    { cells: { type: 'Refund', status: 'Processed', amount: 3000 } },
    { cells: { type: 'Expense', status: 'Approved', amount: 1000 } },
    { cells: { type: 'Expense', status: 'Pending', amount: 9000 } },
  ] as never;
  eq(financeTotals(rows), { revenue: 17000, expenses: 1000, net: 16000 });
});

test('Client IDs are issued in sequence, never reused', async () => {
  const { generateClientId } = await import('/src/clientId');
  const y = new Date().getFullYear();
  eq(generateClientId([]), `CSC-${y}-1001`);
  eq(generateClientId([`CSC-${y}-1016`, `CSC-${y}-1004`, `CSC-${y - 1}-4999`, undefined]), `CSC-${y}-1017`);
});

test('inter-branch transfer: old branch keeps what it collected, new branch carries the rest', () => {
  const old = [tx({ id: 'c1', amount: 35000, dueDate: '2026-09-01' }), tx({ kind: 'Payment', amount: 10000 }), tx({ kind: 'Transfer', amount: 25000 })];
  const moved = [tx({ branch: 'Pokhara', amount: 25000, dueDate: '2026-09-26' })];
  eq(bal(old).outstanding, 0);
  eq(bal(old).totalFee, 10000);
  eq(bal(moved).outstanding, 25000);
  eq(bal([...old, ...moved]).outstanding, 25000);
  eq(bal([...old, ...moved]).totalFee, 35000);
});

test('client fee = country price, else All-countries price; retired and future versions ignored', async () => {
  const { resolvePrice } = await import('/src/servicePricing');
  const p = (id: string, country: string, fee: number, effectiveFrom: string, active = true) =>
    ({ id, name: 'Student Visa', category: 'Visa Processing', country, fee, currency: 'NPR', effectiveFrom, active, setBy: 'SA', setAt: `${effectiveFrom} 10:00 AM` }) as never;
  const list = [p('a', 'All countries', 35000, '2026-01-01'), p('b', 'Canada', 40000, '2026-01-01'), p('c', 'Canada', 45000, '2026-09-01'), p('d', 'Canada', 50000, '2027-01-01'), p('e', 'USA', 50000, '2026-01-01'), p('f', 'USA', 50000, '2026-06-01', false)];
  eq(resolvePrice(list, 'Student Visa', 'Canada', '2026-09-26')?.fee, 45000);
  eq(resolvePrice(list, 'Student Visa', 'Australia', '2026-09-26')?.fee, 35000);
  eq(resolvePrice(list, 'Student Visa', 'USA', '2026-09-26')?.fee, 35000);
  eq(resolvePrice(list, 'Visitor Visa', 'Canada', '2026-09-26'), null);
});
