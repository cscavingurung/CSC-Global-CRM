import { test, eq, ok } from './harness';
import { balancesFor, countDays, overlapping, workingDaysBetween } from '/src/leave';
import { attendanceStatus } from '/src/branchOps';
import { dayView } from '/src/attendance';
import type { Holiday, LeaveRecord } from '/src/types';

const holiday = (from: string, to = from): Holiday => ({ id: from, name: 'Holiday', type: 'Public' as never, from, to, repeatsAnnually: false, appliesTo: 'All' });
const leave = (l: Partial<LeaveRecord>): LeaveRecord => ({
  id: 'l', staffName: 'Asha', branch: 'Kathmandu', from: '2026-09-21', to: '2026-09-21', type: 'Annual', status: 'Approved', days: 1, reason: 'r', requestedAt: 'x', ...l,
});

test('leave days skip Saturdays (weekly off) and branch holidays', () => {
  // 2026-09-19 is a Saturday.
  eq(workingDaysBetween('2026-09-17', '2026-09-23'), 6);
  eq(workingDaysBetween('2026-09-17', '2026-09-23', [holiday('2026-09-22')]), 5);
  eq(countDays('2026-09-19', '2026-09-19').saturdays, 1);
  eq(workingDaysBetween('2026-09-23', '2026-09-21'), 0);
});

test('overlapping pending/approved leave is detected; rejected leave is not', () => {
  const all = [leave({ from: '2026-09-21', to: '2026-09-23' }), leave({ id: 'r', from: '2026-09-25', to: '2026-09-25', status: 'Rejected' })];
  ok(overlapping(all, 'Asha', '2026-09-23', '2026-09-24'));
  eq(overlapping(all, 'Asha', '2026-09-25', '2026-09-25'), undefined);
  eq(overlapping(all, 'Someone else', '2026-09-21', '2026-09-21'), undefined);
});

test('balances use approved days only; pending shown separately', () => {
  const b = balancesFor('Asha', [leave({ from: '2026-09-21', to: '2026-09-22' }), leave({ id: 'p', from: '2026-09-24', to: '2026-09-24', status: 'Pending' })], 2026)
    .find((x) => x.type === 'Annual')!;
  eq([b.used, b.pending, b.remaining], [2, 1, 13]);
});

test('check-in lateness: 10-minute grace, late up to 30 minutes, then very late', () => {
  eq(attendanceStatus('2026-09-21 9:10 AM'), 'On Time');
  eq(attendanceStatus('2026-09-21 9:11 AM'), 'Late');
  eq(attendanceStatus('2026-09-21 9:30 AM'), 'Late');
  eq(attendanceStatus('2026-09-21 9:31 AM'), 'Very Late');
});

test('a day with no check-in: approved leave → On Leave, holiday → Holiday, otherwise Absent', () => {
  const now = new Date('2026-09-26T15:00:00');
  eq(dayView('Asha', '2026-09-21', [], [leave({})], now).status, 'On Leave');
  eq(dayView('Asha', '2026-09-22', [], [], now, [holiday('2026-09-22')]).status, 'Holiday');
  eq(dayView('Asha', '2026-09-23', [], [], now).status, 'Absent');
  eq(dayView('Asha', '2026-09-19', [], [], now).status, 'Off');
});

test('a past day checked in without a check-out is flagged', () => {
  const now = new Date('2026-09-26T15:00:00');
  const v = dayView('Asha', '2026-09-24', [{ id: 'a', staffName: 'Asha', branch: 'Kathmandu', date: '2026-09-24', checkIn: '2026-09-24 9:00 AM' }], [], now);
  eq([v.status, v.missingCheckOut], ['Present', true]);
});
