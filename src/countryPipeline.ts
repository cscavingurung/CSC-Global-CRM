// Dynamic, country-specific application pipeline. Every country shares four baseline stages and
// then follows its own route to the visa. The steps array — and the rules that lock, unlock or
// skip steps — come from COUNTRY_PIPELINES, keyed by the destination country.
//
// Pure logic only: the Client Profile's Status Tracker renders it, and App.tsx runs the side effects (e.g. the
// USA interview-prep task) when an application's pipeline changes.
import { ApplicationRecord, CountryPipelineState, OfferApplication, PipelineCountry } from './types';
import { emptyVisaChecklist, getActiveOfferApplication, getFeePaidOffer } from './clientPipeline';
import { splitCountries } from './mockData';

export const PIPELINE_COUNTRIES: PipelineCountry[] = ['Australia', 'United Kingdom', 'New Zealand', 'USA'];

/** Extra input a step asks for before it can be completed. */
export type StepInput =
  | { kind: 'choice'; label: string; options: string[] }
  | { kind: 'text'; label: string; placeholder: string; field: 'universityClientId' }
  | { kind: 'datetime'; label: string };

export interface StepDef {
  key: string;
  label: string;
  hint?: string;
  /** Opens the checklist modal; every required item must be ticked before completing. */
  checklist?: string;
  input?: StepInput;
  /** Decision step — a "Refused" / "Rejected" value ends the pipeline. */
  terminal?: boolean;
  /** Skipped when this returns true (e.g. UK without a Pre-CAS interview). */
  skipIf?: (s: CountryPipelineState) => boolean;
  /** Hard lock: a reason while this step can't be completed, even when it's next. */
  lockedUntil?: (s: CountryPipelineState) => string | null;
}

export interface ChecklistItem {
  key: string;
  label: string;
  required: boolean;
}

export interface ChecklistDef {
  title: string;
  intro: string;
  items: ChecklistItem[];
}

export const CHECKLISTS: Record<string, ChecklistDef> = {
  documents: {
    title: 'Document Collection',
    intro: 'Core documents every application needs before it can be submitted.',
    items: [
      { key: 'passport', label: 'Passport (bio page, valid 6+ months)', required: true },
      { key: 'transcripts', label: 'Academic transcripts and certificates', required: true },
      { key: 'english', label: 'English test result (IELTS / PTE / TOEFL)', required: true },
      { key: 'cv', label: 'CV / résumé', required: false },
      { key: 'sop', label: 'Statement of purpose draft', required: true },
      { key: 'references', label: 'Recommendation letters', required: false },
    ],
  },
  'au-gs': {
    title: 'GS Preparation — Document Checklist',
    intro: 'Genuine Student requirement evidence for the Australian institution’s GS assessment.',
    items: [
      { key: 'gs-statement', label: 'GS statement / personal statement', required: true },
      { key: 'funds', label: 'Financial capacity — 3 months of bank statements', required: true },
      { key: 'sponsor', label: 'Sponsor relationship documents', required: true },
      { key: 'income', label: 'Sponsor income evidence (salary, business, rental)', required: true },
      { key: 'tax', label: 'Tax clearance / tax returns', required: false },
      { key: 'ties', label: 'Ties to home country (family, property, job offer)', required: true },
      { key: 'oshc', label: 'OSHC quote', required: false },
    ],
  },
  'nz-finance': {
    title: 'Financial Documents Preparation',
    intro: 'Immigration New Zealand financial evidence (living costs of at least NZD 20,000 per year of study).',
    items: [
      { key: 'bank', label: 'Bank statements covering the funds (3–6 months)', required: true },
      { key: 'loan', label: 'Education loan sanction letter (if used)', required: false },
      { key: 'affidavit', label: 'Sponsor affidavit of support', required: true },
      { key: 'income', label: 'Sponsor income source documents', required: true },
      { key: 'tax', label: 'Tax clearance certificate', required: true },
      { key: 'property', label: 'Property valuation', required: false },
    ],
  },
};

const BASELINE: StepDef[] = [
  { key: 'counseling', label: 'Counseling & Shortlisting', hint: 'Programs and institutions agreed with the client.' },
  { key: 'documents', label: 'Document Collection', checklist: 'documents' },
  { key: 'submitted', label: 'Application Submitted' },
  { key: 'offer', label: 'Offer Received', input: { kind: 'choice', label: 'Offer type', options: ['Conditional', 'Unconditional'] } },
];

const done = (s: CountryPipelineState, key: string) => Boolean(s.steps[key]?.doneAt);

const DECISION: StepInput = { kind: 'choice', label: 'Visa decision', options: ['Approved', 'Refused'] };

export const COUNTRY_PIPELINES: Record<PipelineCountry, StepDef[]> = {
  Australia: [
    ...BASELINE,
    { key: 'gs-prep', label: 'GS Preparation', checklist: 'au-gs', hint: 'Prepare the Genuine Student evidence pack.' },
    { key: 'gs-submitted', label: 'GS Submitted' },
    { key: 'gs-approved', label: 'GS Approved', hint: 'Approval unlocks Fee Paid.' },
    {
      key: 'fee-paid', label: 'Fee Paid',
      input: { kind: 'text', label: 'University Client ID', placeholder: 'ID issued by the university, e.g. 21984456', field: 'universityClientId' },
      lockedUntil: (s) => (done(s, 'gs-approved') ? null : 'Unlocks when GS is approved'),
    },
    { key: 'coe', label: 'CoE Received' },
    { key: 'visa-lodged', label: 'Visa Lodged' },
    { key: 'visa-decision', label: 'Visa Decision', input: DECISION, terminal: true },
  ],
  'United Kingdom': [
    ...BASELINE,
    { key: 'pre-cas-deposit', label: 'Pre-CAS Deposit', hint: 'Only when the university asks for a deposit before CAS.', skipIf: (s) => s.requiresPreCasInterview === false },
    { key: 'pre-cas-interview', label: 'Pre-CAS Interview', skipIf: (s) => s.requiresPreCasInterview === false },
    { key: 'clear-conditions', label: 'Clear Conditions' },
    { key: 'cas', label: 'CAS Requested & Received' },
    { key: 'visa-lodged', label: 'Visa Lodged' },
    { key: 'visa-decision', label: 'Visa Decision', input: DECISION, terminal: true },
  ],
  'New Zealand': [
    ...BASELINE,
    { key: 'clear-conditions', label: 'Clear Conditions' },
    { key: 'nz-finance', label: 'Financial Documents Preparation', checklist: 'nz-finance' },
    { key: 'visa-lodged', label: 'Visa Lodged' },
    { key: 'aip', label: 'AIP (Approval in Principle) Received', input: { kind: 'choice', label: 'Immigration NZ response', options: ['AIP Received', 'Refused'] }, terminal: true },
    {
      key: 'tuition-paid', label: 'Tuition Fee Paid',
      // Hard lock: never pay tuition before Immigration NZ has approved in principle.
      lockedUntil: (s) => (s.steps.aip?.value === 'AIP Received' ? null : 'Locked until AIP is received'),
    },
    { key: 'enrolled', label: 'Enrolled' },
  ],
  USA: [
    ...BASELINE,
    { key: 'i20', label: 'I-20 Received' },
    { key: 'ds160', label: 'DS-160 & SEVIS Fee Paid' },
    { key: 'interview-scheduled', label: 'Interview Scheduled', input: { kind: 'datetime', label: 'Interview date & time' }, hint: 'Creates an interview-prep task for the counselor.' },
    { key: 'interview-prep', label: 'Interview Preparation' },
    { key: 'interview-outcome', label: 'Visa Interview Outcome', input: DECISION, terminal: true },
    { key: 'tuition-paid', label: 'Tuition Fee Paid' },
    { key: 'enrolled', label: 'Enrolled' },
  ],
};

// ── State helpers ───────────────────────────────────────────────────────────
export const emptyPipeline = (country: PipelineCountry): CountryPipelineState => ({
  country, steps: {}, checklists: {}, requiresPreCasInterview: country === 'United Kingdom' ? true : undefined, log: [],
});

export type StepState = 'done' | 'active' | 'locked' | 'upcoming' | 'skipped' | 'closed';

export interface StepView {
  def: StepDef;
  state: StepState;
  /** Why it can't be completed yet (locked / closed). */
  reason?: string;
}

/** Where every step stands. Steps complete strictly in order; skipped steps are passed over. */
export function stepViews(s: CountryPipelineState): StepView[] {
  const defs = COUNTRY_PIPELINES[s.country];
  let activeFound = false;
  let closedBy: string | null = null;
  return defs.map((def): StepView => {
    if (def.skipIf?.(s)) return { def, state: 'skipped', reason: 'Not needed for this application' };
    if (done(s, def.key)) {
      const v = s.steps[def.key]?.value;
      if (def.terminal && (v === 'Refused' || v === 'Rejected')) closedBy = `${def.label}: ${v}`;
      return { def, state: 'done' };
    }
    if (closedBy) return { def, state: 'closed', reason: `Pipeline closed — ${closedBy}` };
    if (activeFound) return { def, state: 'upcoming' };
    activeFound = true;
    const lock = def.lockedUntil?.(s);
    return lock ? { def, state: 'locked', reason: lock } : { def, state: 'active' };
  });
}

export function checklistProgress(s: CountryPipelineState, key: string) {
  const def = CHECKLISTS[key];
  const ticks = s.checklists[key] ?? {};
  const required = def.items.filter((i) => i.required);
  return {
    done: def.items.filter((i) => ticks[i.key]).length,
    total: def.items.length,
    requiredDone: required.filter((i) => ticks[i.key]).length,
    requiredTotal: required.length,
    complete: required.every((i) => ticks[i.key]),
  };
}

/** Why the active step can't be completed with this input (null = ok). */
export function completionError(s: CountryPipelineState, def: StepDef, value: string): string | null {
  if (def.checklist && !checklistProgress(s, def.checklist).complete) return 'Tick every required document in the checklist first.';
  if (def.input?.kind === 'choice' && !def.input.options.includes(value)) return `Choose the ${def.input.label.toLowerCase()}.`;
  if (def.input?.kind === 'text' && value.trim().length < 3) return `${def.input.label} is required to mark this step complete.`;
  if (def.input?.kind === 'datetime' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'Pick the interview date and time.';
  return null;
}

/** Complete the active step. Returns the new state, or an error. */
export function completeStep(s: CountryPipelineState, key: string, value: string, by: string, at: string): CountryPipelineState | string {
  const view = stepViews(s).find((v) => v.def.key === key);
  if (!view || view.state !== 'active') return view?.reason ?? 'This step is not next in the pipeline.';
  const err = completionError(s, view.def, value);
  if (err) return err;
  const input = view.def.input;
  const shown = input?.kind === 'datetime' ? formatInterview(value) : value.trim();
  const next: CountryPipelineState = {
    ...s,
    steps: { ...s.steps, [key]: { doneAt: at, doneBy: by, value: input ? value.trim() : undefined } },
    ...(input?.kind === 'text' ? { [input.field]: value.trim() } : {}),
    log: [...s.log, { at, by, text: `${view.def.label} completed${shown ? ` — ${input?.label ?? ''}${input?.label ? ': ' : ''}${shown}` : ''}` }],
  };
  // Automation note for the audit trail — the unlock itself falls out of stepViews().
  if (s.country === 'Australia' && key === 'gs-approved') next.log.push({ at, by: 'System', text: 'GS approved — Fee Paid unlocked.' });
  return next;
}

/** UK toggle. Turning the interview off skips Pre-CAS Deposit and Interview. */
export function setPreCasInterview(s: CountryPipelineState, on: boolean, by: string, at: string): CountryPipelineState {
  return {
    ...s, requiresPreCasInterview: on,
    log: [...s.log, { at, by, text: on ? 'Pre-CAS interview required — Pre-CAS stages added back.' : 'No Pre-CAS interview — skipped to Clear Conditions.' }],
  };
}

export function toggleChecklist(s: CountryPipelineState, list: string, item: string): CountryPipelineState {
  const cur = s.checklists[list] ?? {};
  return { ...s, checklists: { ...s.checklists, [list]: { ...cur, [item]: !cur[item] } } };
}

export function formatInterview(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Newly scheduled USA interview (for App.tsx's task automation). */
export function newlyScheduledInterview(prev: CountryPipelineState | null | undefined, next: CountryPipelineState | null | undefined): string | null {
  if (!next || next.country !== 'USA') return null;
  const now = next.steps['interview-scheduled'];
  const before = prev?.steps['interview-scheduled'];
  return now?.doneAt && !before?.doneAt ? now.value ?? null : null;
}

// ════════════════════════════════════════════════════════════════════════════
// Status Tracker integration
// The Client Profile's Status Tracker is one journey for every client:
//   Enrolled → Applied to Institution → Offer Received → Choose Country to Process → …
// A client can hold offers in more than one country, so once an offer is in, the counselor picks
// the offer (and so the country) to process. Canada — and any country without its own route —
// then continues with the standard Fee Paid → visa steps; Australia, the UK, New Zealand and the
// USA continue with their route from COUNTRY_PIPELINES. Route steps that matter elsewhere write to
// the normal offer / visa records, so queues, reports and commissions keep one source of truth.
// ════════════════════════════════════════════════════════════════════════════

const BASELINE_KEYS = ['counseling', 'documents', 'submitted', 'offer'];

/** The steps that follow the shared offer stage. */
export const routeSteps = (country: PipelineCountry): StepDef[] => {
  const defs = COUNTRY_PIPELINES[country];
  return defs.slice(defs.findIndex((d) => d.key === 'offer') + 1);
};

/** A country name → its route; null = the standard (Canada) route. */
export function routeCountry(name?: string): PipelineCountry | null {
  const v = (name ?? '').trim().toLowerCase();
  if (v === 'australia') return 'Australia';
  if (v === 'united kingdom' || v === 'uk') return 'United Kingdom';
  if (v === 'new zealand' || v === 'nz') return 'New Zealand';
  if (v === 'usa' || v === 'united states' || v === 'us') return 'USA';
  return null;
}

/** Country an offer is for: the institution's country, else the client's first listed one. */
export const offerCountryName = (app: ApplicationRecord, offer?: OfferApplication | null) =>
  offer?.country?.trim() || splitCountries(app.country)[0] || app.country;

/** The offer being processed. An explicit choice wins; files already past the choice (fee paid,
 * visa open, or route progress recorded) resolve to their offer; otherwise null = not chosen. */
export function processingOfferOf(app: ApplicationRecord): OfferApplication | null {
  const offers = app.offerApplications;
  if (app.processingOfferId) {
    const chosen = offers.find((o) => o.id === app.processingOfferId);
    if (chosen) return chosen;
  }
  const feePaid = getFeePaidOffer(app);
  if (feePaid) return feePaid;
  if (app.visaApplication) return getActiveOfferApplication(app);
  if (app.processingOfferId === '') return null;
  const recorded = app.countryPipeline;
  if (recorded) {
    const match = offers.find((o) => o.status === 'Offer Received' && routeCountry(offerCountryName(app, o)) === recorded.country);
    if (match) return match;
  }
  return null;
}

/** Country route for a study client (null = standard route, or no country chosen yet). */
export function countryRouteFor(app: ApplicationRecord): PipelineCountry | null {
  if (!/study/i.test(app.purpose)) return null;
  const offer = processingOfferOf(app);
  return offer ? routeCountry(offerCountryName(app, offer)) : null;
}

/** Route progress: what's been recorded, with anything the offer / visa record shows as done
 * since (e.g. the V/A Officer lodged the visa from their queue) filled in around it. */
export function routeStateFor(app: ApplicationRecord, country: PipelineCountry): CountryPipelineState {
  const derived = deriveRouteState(app, country);
  const stored = app.countryPipeline;
  if (!stored || stored.country !== country) return derived;
  return {
    ...stored,
    steps: { ...derived.steps, ...stored.steps },
    checklists: { ...derived.checklists, ...stored.checklists },
    universityClientId: stored.universityClientId ?? derived.universityClientId,
  };
}

function deriveRouteState(app: ApplicationRecord, country: PipelineCountry): CountryPipelineState {
  const s = emptyPipeline(country);
  const offer = processingOfferOf(app);
  const visa = app.visaApplication;
  const by = 'From status history';
  const mark = (key: string, at?: string, value?: string) => { s.steps[key] = { doneAt: at || offer?.statusUpdatedAt || 'earlier', doneBy: by, value }; };
  const tickAll = (key?: string) => { if (key) s.checklists[key] = Object.fromEntries(CHECKLISTS[key].items.map((i) => [i.key, true])); };
  // The shared offer stage is always behind a chosen offer.
  BASELINE_KEYS.forEach((k) => mark(k, k === 'offer' ? offer?.outcomeDate : undefined));
  tickAll('documents');
  if (!offer) return s;
  const feePaid = offer.status === 'Fee Paid';
  const vs = visa?.status;
  const decided = vs === 'Visa Approved' || vs === 'Visa Refused';
  const outcome = vs === 'Visa Approved' ? 'Approved' : vs === 'Visa Refused' ? 'Refused' : undefined;
  const lodged = vs === 'Visa Applied' || decided;
  const upTo = (keys: string[]) => keys.forEach((k) => { mark(k); tickAll(COUNTRY_PIPELINES[country].find((x) => x.key === k)?.checklist); });
  if (country === 'Australia') {
    if (feePaid || visa) {
      upTo(['gs-prep', 'gs-submitted', 'gs-approved']);
      mark('fee-paid', offer.feePaidDate, offer.studentId);
      if (offer.studentId) s.universityClientId = offer.studentId;
    }
    if (visa) mark('coe', visa.preparingDocsDate);
    if (lodged) mark('visa-lodged', visa?.appliedDate);
    if (decided) mark('visa-decision', visa?.outcomeDate, outcome);
  } else if (country === 'United Kingdom') {
    if (visa) { s.requiresPreCasInterview = false; upTo(['clear-conditions', 'cas']); }
    if (lodged) mark('visa-lodged', visa?.appliedDate);
    if (decided) mark('visa-decision', visa?.outcomeDate, outcome);
  } else if (country === 'New Zealand') {
    if (visa) upTo(['clear-conditions', 'nz-finance']);
    if (lodged) mark('visa-lodged', visa?.appliedDate);
    if (vs === 'Visa Refused') mark('aip', visa?.outcomeDate, 'Refused');
    if (vs === 'Visa Approved') {
      mark('aip', visa?.outcomeDate, 'AIP Received');
      mark('tuition-paid', offer.feePaidDate);
      if (visa?.enrollmentCompleted) mark('enrolled', visa.enrollmentCompletedDate);
    }
  } else {
    if (feePaid || visa) mark('i20');
    if (visa) mark('ds160', visa.preparingDocsDate);
    if (lodged) { mark('interview-scheduled', visa?.appliedDate); mark('interview-prep', visa?.appliedDate); }
    if (decided) mark('interview-outcome', visa?.outcomeDate, outcome);
    if (vs === 'Visa Approved' && feePaid) mark('tuition-paid', offer.feePaidDate);
    if (vs === 'Visa Approved' && visa?.enrollmentCompleted) mark('enrolled', visa.enrollmentCompletedDate);
  }
  return s;
}

/** What the tracker's "Update Status" dropdown offers for the route's current step. */
export interface RouteAction {
  key: string;
  /** Pre-set value (a decision option); '' when the step needs none, or takes it from an input. */
  value: string;
  label: string;
  tone: 'advance' | 'positive' | 'negative';
  /** Extra input collected before the step completes. */
  needs?: 'datetime' | 'university-id';
  disabledReason?: string;
}

const DECISION_LABELS: Record<string, Record<string, string>> = {
  'visa-decision': { Approved: 'Mark Visa Approved', Refused: 'Mark Visa Refused' },
  aip: { 'AIP Received': 'Mark AIP Received', Refused: 'Mark AIP Refused' },
  'interview-outcome': { Approved: 'Mark Visa Approved at Interview', Refused: 'Mark Visa Refused at Interview' },
};

export function routeActions(s: CountryPipelineState): RouteAction[] {
  const v = stepViews(s).find((x) => (x.state === 'active' || x.state === 'locked') && !BASELINE_KEYS.includes(x.def.key));
  if (!v) return [];
  const d = v.def;
  const checklistGap = d.checklist && !checklistProgress(s, d.checklist).complete ? 'Tick every required document in the checklist first' : undefined;
  const disabledReason = (v.state === 'locked' ? v.reason : undefined) ?? checklistGap;
  if (d.input?.kind === 'choice') {
    return d.input.options.map((o) => ({
      key: d.key, value: o, label: DECISION_LABELS[d.key]?.[o] ?? `Mark ${d.label}: ${o}`,
      tone: /refus|reject/i.test(o) ? 'negative' : 'positive', disabledReason,
    }));
  }
  const needs = d.input?.kind === 'text' ? 'university-id' : d.input?.kind === 'datetime' ? 'datetime' : undefined;
  return [{ key: d.key, value: '', label: `Mark ${d.label}`, tone: 'advance', needs, disabledReason }];
}

/** Offer / visa changes a completed route step implies. `date` is YYYY-MM-DD. */
export function routeRecordUpdates(app: ApplicationRecord, country: PipelineCountry, key: string, value: string, by: string, date: string): Partial<ApplicationRecord> {
  const offer = processingOfferOf(app);
  const out: Partial<ApplicationRecord> = {};
  const payFee = (universityId?: string) => {
    if (!offer || offer.status === 'Fee Paid') return;
    out.offerApplications = app.offerApplications.map((o) => (o.id !== offer.id ? o : {
      ...o, status: 'Fee Paid' as const, statusUpdatedAt: date, feePaidDate: date, feePaidBy: by, ...(universityId ? { studentId: universityId } : {}),
    }));
  };
  const visaTo = (status: 'Preparing Documents' | 'Visa Applied' | 'Visa Approved' | 'Visa Refused', extra: Record<string, unknown> = {}) => {
    const base = app.visaApplication ?? {
      status: 'Preparing Documents' as const, statusUpdatedAt: date, preparingDocsDate: date, checklist: emptyVisaChecklist(), customChecklist: [], notes: '', history: [],
    };
    out.visaApplication = {
      ...base, status, statusUpdatedAt: date, statusUpdatedBy: by,
      ...(status === 'Visa Applied' ? { appliedDate: date } : {}),
      ...(status === 'Visa Approved' || status === 'Visa Refused' ? { outcomeDate: date } : {}),
      ...extra,
    };
  };
  const decision = (v: string) => visaTo(v === 'Approved' || v === 'AIP Received' ? 'Visa Approved' : 'Visa Refused');
  if (country === 'Australia') {
    if (key === 'fee-paid') payFee(value.trim());
    if (key === 'coe') visaTo('Preparing Documents');
    if (key === 'visa-lodged') visaTo('Visa Applied');
    if (key === 'visa-decision') decision(value);
  } else if (country === 'United Kingdom') {
    if (key === 'cas') visaTo('Preparing Documents');
    if (key === 'visa-lodged') visaTo('Visa Applied');
    if (key === 'visa-decision') decision(value);
  } else if (country === 'New Zealand') {
    if (key === 'visa-lodged') visaTo('Visa Applied');
    // AIP is approval in principle — the visa itself is issued once tuition is paid.
    if (key === 'aip' && value === 'Refused') visaTo('Visa Refused');
    if (key === 'tuition-paid') { payFee(); visaTo('Visa Approved'); }
    if (key === 'enrolled') visaTo('Visa Approved', { enrollmentCompleted: true, enrollmentCompletedDate: date });
  } else {
    if (key === 'ds160') visaTo('Preparing Documents');
    if (key === 'interview-scheduled') visaTo('Visa Applied');
    if (key === 'interview-outcome') decision(value);
    if (key === 'tuition-paid') payFee();
    if (key === 'enrolled') visaTo('Visa Approved', { enrollmentCompleted: true, enrollmentCompletedDate: date });
  }
  return out;
}
