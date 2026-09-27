import { test, eq, ok } from './harness';
import {
  completeStep, countryRouteFor, processingOfferOf, routeActions, routeRecordUpdates, routeStateFor, setPreCasInterview, stepViews,
} from '/src/countryPipeline';
import type { ApplicationRecord, OfferApplication } from '/src/types';

const offer = (o: Partial<OfferApplication>): OfferApplication => ({ id: 'o1', institution: 'Uni', status: 'Offer Received', statusUpdatedAt: '2026-09-20', ...o });
const app = (a: Partial<ApplicationRecord>): ApplicationRecord => ({
  id: 'a', name: 'Client', phone: '', email: '', country: 'Australia, Canada', purpose: 'Study', counselor: 'C', consultationDate: '2026-09-01',
  consultationNotes: '', branch: 'Kathmandu', offerApplications: [], visaApplication: null, withdrawn: false, ...a,
} as ApplicationRecord);
const at = '2026-09-26 10:00 AM';
const next = (a: ApplicationRecord) => routeActions(routeStateFor(a, countryRouteFor(a)!)).map((x) => x.label);

test('no country is processed until one is chosen, even with an offer in hand', () => {
  const a = app({ offerApplications: [offer({ country: 'Australia' }), offer({ id: 'o2', country: 'Canada' })] });
  eq(processingOfferOf(a), null);
  eq(countryRouteFor(a), null);
  eq(countryRouteFor({ ...a, processingOfferId: 'o1' }), 'Australia');
  eq(countryRouteFor({ ...a, processingOfferId: 'o2' }), null); // Canada = standard route
});

test('a file already fee-paid resolves to that offer without a choice', () => {
  const a = app({ offerApplications: [offer({ country: 'Canada' }), offer({ id: 'o2', country: 'Australia', status: 'Fee Paid', studentId: 'U1' })] });
  eq(processingOfferOf(a)?.id, 'o2');
});

test('Australia: Fee Paid needs GS approved first, then the University Client ID', () => {
  let a = app({ processingOfferId: 'o1', offerApplications: [offer({ country: 'Australia' })] });
  eq(next(a), ['Mark GS Preparation']);
  let s = routeStateFor(a, 'Australia');
  ok(routeActions(s)[0].disabledReason, 'checklist must gate GS Preparation');
  s = { ...s, checklists: { 'au-gs': { 'gs-statement': true, funds: true, sponsor: true, income: true, ties: true } } };
  for (const k of ['gs-prep', 'gs-submitted', 'gs-approved']) s = completeStep(s, k, '', 'C', at) as typeof s;
  eq(completeStep(s, 'fee-paid', '', 'C', at), 'University Client ID is required to mark this step complete.');
  const done = completeStep(s, 'fee-paid', 'UNI-77', 'C', at);
  ok(typeof done !== 'string');
  const upd = routeRecordUpdates(a, 'Australia', 'fee-paid', 'UNI-77', 'C', '2026-09-26');
  eq([upd.offerApplications?.[0].status, upd.offerApplications?.[0].studentId], ['Fee Paid', 'UNI-77']);
  a = { ...a, ...upd };
  eq(processingOfferOf(a)?.status, 'Fee Paid');
});

test('UK: turning the Pre-CAS interview off skips both Pre-CAS stages', () => {
  const a = app({ country: 'United Kingdom', processingOfferId: 'o1', offerApplications: [offer({ country: 'United Kingdom' })] });
  const off = setPreCasInterview(routeStateFor(a, 'United Kingdom'), false, 'C', at);
  const states = Object.fromEntries(stepViews(off).map((v) => [v.def.key, v.state]));
  eq([states['pre-cas-deposit'], states['pre-cas-interview'], states['clear-conditions']], ['skipped', 'skipped', 'active']);
});

test('New Zealand: tuition can never be marked before AIP; a refused AIP closes the route', () => {
  const a = app({ country: 'New Zealand', processingOfferId: 'o1', offerApplications: [offer({ country: 'New Zealand' })] });
  let s = routeStateFor(a, 'New Zealand');
  eq(typeof completeStep(s, 'tuition-paid', '', 'C', at), 'string');
  s = { ...s, checklists: { 'nz-finance': { bank: true, affidavit: true, income: true, tax: true } } };
  for (const k of ['clear-conditions', 'nz-finance', 'visa-lodged']) s = completeStep(s, k, '', 'C', at) as typeof s;
  const refused = completeStep(s, 'aip', 'Refused', 'C', at) as typeof s;
  eq(stepViews(refused).find((v) => v.def.key === 'tuition-paid')?.state, 'closed');
  eq(routeRecordUpdates(a, 'New Zealand', 'aip', 'Refused', 'C', '2026-09-26').visaApplication?.status, 'Visa Refused');
});

test('USA: scheduling the interview requires a date and lodges the visa', () => {
  const a = app({ country: 'USA', processingOfferId: 'o1', offerApplications: [offer({ country: 'USA' })] });
  let s = routeStateFor(a, 'USA');
  for (const k of ['i20', 'ds160']) s = completeStep(s, k, '', 'C', at) as typeof s;
  eq(routeActions(s)[0].needs, 'datetime');
  eq(typeof completeStep(s, 'interview-scheduled', '', 'C', at), 'string');
  eq(routeRecordUpdates(a, 'USA', 'interview-scheduled', '2026-10-08T10:30', 'C', '2026-09-26').visaApplication?.status, 'Visa Applied');
});
