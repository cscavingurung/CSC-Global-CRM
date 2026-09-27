import { test, eq } from './harness';
import { DATASETS, applyGlobal, buildAll, DEFAULT_FILTERS } from '/src/superAdmin';
import * as seed from '/src/devSeed';

const sources = {
  branches: seed.SEED_BRANCHES, staff: seed.SEED_STAFF, intakes: seed.SEED_STUDENTS, consultations: seed.SEED_COUNSELOR_STUDENTS,
  applications: seed.SEED_APPLICATIONS, transactions: seed.SEED_FIN_TRANSACTIONS, expenses: seed.SEED_EXPENSES, marketingLeads: seed.SEED_MARKETING.leads,
  issues: seed.SEED_ISSUES, tasks: seed.SEED_TASKS, attendance: seed.SEED_ATTENDANCE, dayLogs: seed.SEED_DAY_LOGS, leave: seed.SEED_LEAVE,
  corrections: seed.SEED_CORRECTIONS, holidays: seed.SEED_HOLIDAYS, transfers: seed.SEED_WORKSPACE.transfers, audit: seed.SEED_AUDIT,
};

test('a client is counted once in Converted Clients, however many offers they hold', () => {
  const rows = buildAll(sources).clients;
  eq(new Set(rows.map((r) => r.id)).size, rows.length);
});

test('every payment appears once in the finance ledger view', () => {
  const rows = buildAll(sources).finance.filter((r) => r.cells.type === 'Payment');
  const payments = seed.SEED_FIN_TRANSACTIONS.filter((t) => t.kind === 'Payment' && !t.void);
  eq(rows.length, payments.length);
});

test('each visa file is counted once (no double count from refusal history)', () => {
  const rows = buildAll(sources).visa;
  eq(rows.length, seed.SEED_APPLICATIONS.filter((a) => a.visaApplication).length);
});

test('branch filter narrows every dataset to that branch', () => {
  const all = buildAll(sources);
  for (const k of ['clients', 'applications', 'visa', 'finance'] as const) {
    const rows = applyGlobal(all[k], DATASETS[k], { ...DEFAULT_FILTERS, period: 'All Time', branch: 'Pokhara' });
    eq(rows.every((r) => r.dims.branch === 'Pokhara'), true, k);
  }
});
