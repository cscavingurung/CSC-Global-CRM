import { useState, type ReactNode } from 'react';
import {
  CHECKLISTS, checklistProgress, completeStep, countryRouteFor, formatInterview, offerCountryName, processingOfferOf, routeActions,
  routeRecordUpdates, routeStateFor, routeSteps, setPreCasInterview, stepViews, toggleChecklist,
} from '../countryPipeline';
import {
  ArrowLeft, Check, X, ChevronDown,
  AlertTriangle, Building2, FileText, UserX,
  Phone, Mail, MapPin, Globe, Target, User, Cake, IdCard,
  Users, Heart, GraduationCap, BookOpen, Briefcase,
  ListChecks, MessageSquare, Banknote, Plus, BellRing, type LucideIcon,
} from 'lucide-react';
import {
  ApplicationRecord, OfferApplication, VisaApplication, Partner, MockUser, ClientNote, CustomChecklistItem, PreviousEnrolment,
} from '../types';
import {
  getActiveOfferApplication, getFeePaidOffer, isChecklistComplete, checklistCompleteCount, checklistTotalCount,
  getClientStatusLabel, getStatusTone, STATUS_TONE_STYLES, OFFER_STATUS_STYLES, VISA_STATUS_STYLES,
  pipelineStepsFor, getPipelineStep, getOfferPipelineStep, canEditClientProfile, canWithdrawClient, today, isStudyCase,
  emptyVisaChecklist, formatAcademic, checklistGroupsFor, isVisaReapplication, isClosedAfterRefund,
  ENROLMENT_CHECKLIST_ITEMS, enrolmentChecklistCounts, isEnrolmentChecklistComplete, ENROLMENT_CHECKLIST_BLOCK_REASON, type PipelineStepKey,
} from '../clientPipeline';
import { clientIdFor } from '../clientId';
import CommunicationLog from './CommunicationLog';
import ClientFinancials from './ClientFinancials';
import { ROLE_LABELS, ROLE_BADGE_STYLES, COUNTRIES, INTAKE_MONTHS, generateIntakeYears } from '../mockData';
import { formatSubmittedAt } from '../dateTime';
import DateInput from './DateInput';

interface ClientProfileProps {
  application: ApplicationRecord;
  partners: Partner[];
  currentUser: MockUser;
  onClose: () => void;
  onUpdate: (updates: Partial<ApplicationRecord>) => void;
}


// Conditional markers shown once a visa has been applied for.
const VISA_MARKERS: { key: 'interviewRequired' | 'documentsRequestedFromHighCommission'; label: string }[] = [
  { key: 'interviewRequired', label: 'Interview Required' },
  { key: 'documentsRequestedFromHighCommission', label: 'Documents Requested from High Commission' },
];


// ─── Small reusable pieces ─────────────────────────────────────────────────────

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${className}`}>{children}</span>;
}

function SectionCard({
  title, icon: Icon, action, children,
}: { title: string; icon: LucideIcon; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-grey-border p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <Icon className="text-navy" size={17} />
          <h3 className="text-sm font-semibold text-navy">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ConfirmDialog({
  tone, title, message, confirmLabel, onCancel, onConfirm,
}: { tone: 'positive' | 'negative'; title: string; message: string; confirmLabel?: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-dark/60" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl border border-grey-border max-w-sm w-full p-6">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${tone === 'positive' ? 'bg-green-50' : 'bg-red-50'}`}>
          <AlertTriangle className={tone === 'positive' ? 'text-green-600' : 'text-red-600'} size={26} />
        </div>
        <h3 className="text-base font-semibold text-navy text-center mb-2">{title}</h3>
        <p className="text-sm text-gray-500 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors">Cancel</button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${tone === 'positive' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared modal shell + text field ───────────────────────────────────────────

function ModalShell({
  title, onClose, children, footer,
}: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-dark/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md flex flex-col border border-grey-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-grey-border flex-shrink-0">
          <h3 className="text-base font-semibold text-navy">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-navy transition-colors"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        <div className="px-6 py-4 border-t border-grey-border flex gap-3 flex-shrink-0">{footer}</div>
      </div>
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder, required,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light"
      />
    </div>
  );
}

// Intake is always picked as Month + Year (stored as "Feb 2027") so it's never mistyped and
// intake filters / deadlines can rely on the format. Years run from this year forward; an
// older stored year is kept in the list so existing values still show.
function IntakePicker({
  value, onChange, size = 'md',
}: { value: string; onChange: (v: string) => void; size?: 'md' | 'sm' }) {
  const [month = '', year = ''] = value.split(' ');
  const years = generateIntakeYears(5);
  if (year && !years.includes(year)) years.unshift(year);
  const cls = size === 'sm'
    ? 'w-full appearance-none border border-grey-border rounded-lg pl-2.5 pr-7 py-1.5 text-xs text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light'
    : 'w-full appearance-none border border-grey-border rounded-lg pl-3 pr-8 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';
  const set = (m: string, y: string) => onChange(m || y ? `${m} ${y}`.trim() : '');
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="relative">
        <select value={INTAKE_MONTHS.includes(month) ? month : ''} onChange={(e) => set(e.target.value, year)} className={cls} aria-label="Intake month">
          <option value="">Month</option>
          {INTAKE_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
      </div>
      <div className="relative">
        <select value={year} onChange={(e) => set(month, e.target.value)} className={cls} aria-label="Intake year">
          <option value="">Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
      </div>
    </div>
  );
}

/** Both parts chosen, e.g. "Feb 2027". */
const isCompleteIntake = (value: string) => {
  const [m, y] = value.split(' ');
  return INTAKE_MONTHS.includes(m) && /^\d{4}$/.test(y ?? '');
};

// Read-only display for details already locked in earlier (Enrolment Details / Add
// Institution) — shown so staff can double-check what they're confirming the fee against
// without being able to edit it here.
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <p className="w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-grey-bg">{value || '—'}</p>
    </div>
  );
}

// ─── Apply / Re-apply to Institution modal ─────────────────────────────────────
// Institution, program and intake are all free text — no fixed institution list, so any
// college or university can be entered.

function ApplyToInstitutionModal({
  onAdd, onClose, title = 'Apply to Institution', intro, submitLabel = 'Submit',
}: { onAdd: (o: OfferApplication) => void; onClose: () => void; title?: string; intro?: string; submitLabel?: string }) {
  const [institution, setInstitution] = useState('');
  const [country, setCountry] = useState('');
  const [course, setCourse] = useState('');
  const [intake, setIntake] = useState('');
  const [notes, setNotes] = useState('');

  // Intake is optional, but if one part is picked the other must be too.
  const intakeValid = !intake || isCompleteIntake(intake);
  const complete = !!institution.trim() && !!country.trim() && intakeValid;

  const handleSubmit = () => {
    if (!complete) return;
    onAdd({
      id: `o${Date.now()}`,
      institution: institution.trim(),
      country,
      course: course.trim() || undefined,
      intake: intake.trim() || undefined,
      status: 'Enrolled',
      statusUpdatedAt: today(),
      enrolledDate: today(),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!complete} className="flex-1 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {submitLabel}
          </button>
        </>
      }
    >
      {intro && <p className="text-xs text-gray-500">{intro}</p>}
      <TextField label="Institution Name" value={institution} onChange={setInstitution} placeholder="e.g. Holmes Institute" required />
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Country<span className="text-red-600"> *</span></label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full appearance-none border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light"
        >
          <option value="" disabled>Select a country</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <TextField label="Program" value={course} onChange={setCourse} placeholder="e.g. Master of Business Information Systems" />
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Intake</label>
        <IntakePicker value={intake} onChange={setIntake} />
        {!intakeValid && <p className="text-[11px] text-amber-700 mt-1">Pick both a month and a year.</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Special requirements or notes..." className="w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-navy-light" />
      </div>
    </ModalShell>
  );
}

// ─── Fee Paid modal ────────────────────────────────────────────────────────────
// Advancing the pipeline to Fee Paid requires confirming the enrolment details.

export interface FeePaidDetails {
  offerId: string;
  studentId: string;
}

// The client may hold offers from several institutions — the fee is paid to exactly one of
// them, and that institution issues the University Client ID shown on the visa queue. Institution,
// country, course and intake were already locked in earlier (Enrolment Details / Add
// Institution), so they're shown read-only here rather than re-editable — only the University Client ID
// is actually being captured at this step.
function FeePaidModal({
  offers, onConfirm, onClose,
}: { offers: OfferApplication[]; onConfirm: (d: FeePaidDetails) => void; onClose: () => void }) {
  const [offerId, setOfferId] = useState(offers[0]?.id ?? '');
  const selected = offers.find((o) => o.id === offerId) ?? offers[0];
  const [studentId, setStudentId] = useState(selected?.studentId ?? '');

  const pickOffer = (id: string) => {
    const o = offers.find((x) => x.id === id);
    setOfferId(id);
    setStudentId(o?.studentId ?? '');
  };

  const complete = !!offerId.trim() && !!studentId.trim();

  return (
    <ModalShell
      title="Confirm Fee Paid"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors">Cancel</button>
          <button
            onClick={() => complete && onConfirm({ offerId, studentId: studentId.trim() })}
            disabled={!complete}
            className="flex-1 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Confirm Fee Paid
          </button>
        </>
      }
    >
      <p className="text-xs text-gray-500">Confirm the details below and enter the University Client ID before this client moves into the visa stage.</p>
      {offers.length > 1 && (
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Fee paid to <span className="text-red-500">*</span></span>
          <select
            value={offerId}
            onChange={(e) => pickOffer(e.target.value)}
            className="mt-1 w-full border border-grey-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:border-navy-light"
          >
            {offers.map((o) => (
              <option key={o.id} value={o.id}>{o.institution}{o.course ? ` — ${o.course}` : ''}</option>
            ))}
          </select>
        </label>
      )}
      <ReadOnlyField label="Institution (College/University)" value={selected?.institution ?? ''} />
      <ReadOnlyField label="Country" value={selected?.country ?? ''} />
      <ReadOnlyField label="Course" value={selected?.course ?? ''} />
      <ReadOnlyField label="Intake" value={selected?.intake ?? ''} />
      <TextField label="University Client ID (issued by institution)" value={studentId} onChange={setStudentId} placeholder="e.g. 100482991" required />
    </ModalShell>
  );
}

// ─── Request Refund modal ──────────────────────────────────────────────────────
// Requesting a refund always schedules a follow-up with the client, so the refund doesn't
// go quiet — the reminder shows on the Status Tracker and the counselor's dashboard.

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatFollowUpDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Today", "in 3 days", "2 days overdue" — relative to today. */
function followUpTiming(value: string): { text: string; tone: string } {
  const days = Math.round((new Date(`${value}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86_400_000);
  if (days < 0) return { text: `${-days} day${days === -1 ? '' : 's'} overdue`, tone: 'bg-red-50 text-red-700' };
  if (days === 0) return { text: 'Today', tone: 'bg-amber-50 text-amber-700' };
  return { text: `in ${days} day${days === 1 ? '' : 's'}`, tone: 'bg-blue-50 text-blue-700' };
}

function RefundFollowUpModal({
  title, confirmLabel, initialDate, initialNote, onConfirm, onClose,
}: { title: string; confirmLabel: string; initialDate?: string; initialNote?: string; onConfirm: (date: string, note: string) => void; onClose: () => void }) {
  const [date, setDate] = useState(initialDate ?? addDays(today(), 7));
  const [note, setNote] = useState(initialNote ?? '');
  const valid = !!date && date >= today();
  return (
    <ModalShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors">Cancel</button>
          <button
            onClick={() => valid && onConfirm(date, note.trim())}
            disabled={!valid}
            className="flex-1 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-xs text-gray-500">Choose when to follow up with the client about this refund. The reminder appears on the Status Tracker and on the counselor’s dashboard.</p>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Follow-up date <span className="text-red-600">*</span></label>
        <DateInput value={date} min={today()} onChange={setDate} className="w-full" />
        <div className="flex gap-1.5 mt-2">
          {[3, 7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(addDays(today(), d))}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${date === addDays(today(), d) ? 'bg-navy/10 text-navy border-navy-light' : 'border-grey-border text-gray-500 hover:text-navy'}`}
            >
              +{d} days
            </button>
          ))}
        </div>
      </div>
      <TextField label="Note (optional)" value={note} onChange={setNote} placeholder="e.g. Check refund status with the institution" />
    </ModalShell>
  );
}

// ─── Re-enroll (non-study cases) ──────────────────────────────────────────────
// SOWP / Tourist / PR cases have no institution, so re-enrolling only asks which country the
// new case is for; the tracker then restarts at "Start Preparing Documents".

function ReEnrollCountryModal({
  initialCountry, onConfirm, onClose, title = 'Re-enroll Client', intro = 'The closed case is kept under Previous Enrolments. Choose the country for the new case.',
}: { initialCountry: string; onConfirm: (country: string) => void; onClose: () => void; title?: string; intro?: string }) {
  const [country, setCountry] = useState(COUNTRIES.includes(initialCountry) ? initialCountry : '');
  return (
    <ModalShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors">Cancel</button>
          <button onClick={() => country && onConfirm(country)} disabled={!country} className="flex-1 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Re-enroll
          </button>
        </>
      }
    >
      <p className="text-xs text-gray-500">{intro}</p>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Country<span className="text-red-600"> *</span></label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full appearance-none border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light"
        >
          <option value="" disabled>Select a country</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </ModalShell>
  );
}

/** Earlier, closed rounds of the case — collapsed by default. */
function PreviousEnrolments({
  items, canEdit, onMarkRefundReceived,
}: { items: PreviousEnrolment[]; canEdit: boolean; onMarkRefundReceived: (id: string) => void }) {
  const pendingRefunds = items.filter((p) => p.visaApplication?.refundRequested && !p.visaApplication.refundReceived).length;
  // Open by default while a refund from an earlier round is still being processed.
  const [open, setOpen] = useState(pendingRefunds > 0);
  if (items.length === 0) return null;
  return (
    <div className="mb-5 pb-5 border-b border-grey-border">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-left">
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Previous Enrolments ({items.length})</span>
          {pendingRefunds > 0 && <Badge className="bg-purple-50 text-purple-700">Refund processing</Badge>}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="dissolve-in mt-3 space-y-3">
          {[...items].reverse().map((p, idx) => (
            <PreviousEnrolmentCard
              key={p.id}
              enrolment={p}
              number={items.length - idx}
              canEdit={canEdit}
              onMarkRefundReceived={() => onMarkRefundReceived(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function shortDate(value?: string): string {
  if (!value) return '';
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysBetweenDates(from?: string, to?: string): number | null {
  if (!from || !to) return null;
  const a = new Date(`${from.slice(0, 10)}T00:00:00`).getTime();
  const b = new Date(`${to.slice(0, 10)}T00:00:00`).getTime();
  return Number.isNaN(a) || Number.isNaN(b) ? null : Math.max(0, Math.round((b - a) / 86_400_000));
}

const CLOSE_REASON_STYLES: Record<string, string> = {
  'Refund received': 'bg-green-50 text-green-700',
  'Refund processing': 'bg-purple-50 text-purple-700',
};

/**
 * One archived round. Collapsed: what was tried and how it ended. Expanded: what a counselor
 * needs before advising the client again — the dated timeline with who did each step, every
 * institution attempt (with its turnaround), how the visa attempt(s) went, and the refund.
 */
function PreviousEnrolmentCard({
  enrolment: p, number, canEdit, onMarkRefundReceived,
}: { enrolment: PreviousEnrolment; number: number; canEdit: boolean; onMarkRefundReceived: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const visa = p.visaApplication;
  const visaAttempts = visa ? [...(visa.history ?? []), visa] : [];
  const refundPending = !!visa?.refundRequested && !visa.refundReceived;

  const startDate = p.offerApplications.map((o) => o.enrolledDate).filter(Boolean).sort()[0] ?? visaAttempts[0]?.preparingDocsDate;
  const endDate = p.closedDate || p.reEnrolledDate;
  const duration = daysBetweenDates(startDate, endDate);
  const destinations = Array.from(new Set(p.offerApplications.map((o) => o.country).filter(Boolean)));
  const feePaid = p.offerApplications.find((o) => o.status === 'Fee Paid');

  // Every dated step across the round, oldest first, with who did it where it's known.
  const timeline: { date: string; label: string; by?: string; tone?: 'positive' | 'negative' }[] = [];
  p.offerApplications.forEach((o) => {
    if (o.enrolledDate) timeline.push({ date: o.enrolledDate, label: `Enrolled — ${o.institution}`, by: o.enrolledBy });
    if (o.appliedDate) timeline.push({ date: o.appliedDate, label: `Applied — ${o.institution}`, by: o.appliedBy });
    if (o.outcomeDate && o.status !== 'Enrolled' && o.status !== 'Applied to Institution') {
      const rejected = o.status === 'Rejected';
      timeline.push({ date: o.outcomeDate, label: `${rejected ? 'Offer rejected' : 'Offer received'} — ${o.institution}`, by: o.outcomeBy, tone: rejected ? 'negative' : 'positive' });
    }
    if (o.feePaidDate) timeline.push({ date: o.feePaidDate, label: `Fee paid — ${o.institution}`, by: o.feePaidBy, tone: 'positive' });
  });
  visaAttempts.forEach((v, i) => {
    const suffix = visaAttempts.length > 1 ? ` (attempt ${i + 1})` : '';
    if (v.preparingDocsDate) timeline.push({ date: v.preparingDocsDate, label: `Visa documents started${suffix}` });
    if (v.fileReadyDate) timeline.push({ date: v.fileReadyDate, label: `File ready for visa${suffix}` });
    if (v.appliedDate) timeline.push({ date: v.appliedDate, label: `Visa applied${suffix}` });
    if (v.outcomeDate && (v.status === 'Visa Approved' || v.status === 'Visa Refused')) {
      timeline.push({ date: v.outcomeDate, label: `${v.status}${suffix}`, tone: v.status === 'Visa Approved' ? 'positive' : 'negative' });
    }
  });
  if (visa?.refundRequestedDate) timeline.push({ date: visa.refundRequestedDate, label: 'Refund requested', by: visa.refundFollowUpSetBy });
  if (visa?.refundReceivedDate) timeline.push({ date: visa.refundReceivedDate, label: 'Refund received', by: visa.refundReceivedBy, tone: 'positive' });
  if (p.reEnrolledDate) timeline.push({ date: p.reEnrolledDate, label: 'Moved on to a new enrolment', by: p.reEnrolledBy });
  timeline.sort((a, b) => a.date.localeCompare(b.date));

  const sectionTitle = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2';

  return (
    <div className="rounded-lg border border-grey-border bg-grey-bg/60">
      {/* Summary — click to expand */}
      <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="w-full text-left p-3 hover:bg-grey-bg rounded-lg transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-navy">
            Enrolment {number}
            {startDate && <span className="text-xs font-normal text-gray-400"> · {shortDate(startDate)} – {shortDate(endDate)}{duration !== null ? ` (${duration} days)` : ''}</span>}
          </p>
          <span className="flex items-center gap-1.5">
            <Badge className={CLOSE_REASON_STYLES[p.closeReason] ?? 'bg-gray-100 text-gray-600'}>{p.closeReason}</Badge>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-1.5">
          {feePaid ? `${feePaid.institution}${feePaid.course ? ` — ${feePaid.course}` : ''}` : `${p.offerApplications.length} institution${p.offerApplications.length === 1 ? '' : 's'} tried`}
          {destinations.length > 0 && <span className="text-gray-400"> · {destinations.join(', ')}</span>}
          {visa && <span className="text-gray-400"> · {visa.status}</span>}
        </p>
      </button>

      {/* Pending refund stays actionable without expanding */}
      {refundPending && visa && (
        <div className="mx-3 mb-3 rounded-md border border-grey-border bg-white px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BellRing size={13} className="text-navy flex-shrink-0" />
            <span className="text-xs text-navy">
              Refund processing
              {visa.refundFollowUpDate && !visa.refundFollowUpDone ? ` · follow up ${formatFollowUpDate(visa.refundFollowUpDate)}` : ''}
            </span>
            {visa.refundFollowUpDate && !visa.refundFollowUpDone && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${followUpTiming(visa.refundFollowUpDate).tone}`}>
                {followUpTiming(visa.refundFollowUpDate).text}
              </span>
            )}
          </div>
          {canEdit && (
            <button type="button" onClick={onMarkRefundReceived} className="px-2.5 py-1 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-light">
              Mark Refund Received
            </button>
          )}
        </div>
      )}

      {expanded && (
        <div className="dissolve-in border-t border-grey-border bg-white rounded-b-lg p-4 space-y-5">
          {/* Institutions */}
          {p.offerApplications.length > 0 && (
            <div>
              <p className={sectionTitle}>Institutions ({p.offerApplications.length})</p>
              <div className="space-y-2">
                {p.offerApplications.map((o) => {
                  const turnaround = daysBetweenDates(o.appliedDate, o.outcomeDate);
                  return (
                    <div key={o.id} className="rounded-md border border-grey-border px-3 py-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy">{o.institution}</p>
                          <p className="text-xs text-gray-500">{[o.course, o.country, o.intake && `${o.intake} intake`].filter(Boolean).join(' · ') || '—'}</p>
                        </div>
                        <Badge className={OFFER_STATUS_STYLES[o.status]}>{o.status}</Badge>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {[
                          turnaround !== null && `Decision in ${turnaround} day${turnaround === 1 ? '' : 's'} after applying`,
                          o.studentId && `University Client ID ${o.studentId}`,
                          o.clientRefId && `Ref ${o.clientRefId}`,
                        ].filter(Boolean).join(' · ') || (o.status === 'Enrolled' ? 'Never submitted to the institution' : '')}
                      </p>
                      {o.notes && <p className="text-xs text-gray-600 mt-1">{o.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visa */}
          {visa && (
            <div>
              <p className={sectionTitle}>Visa {visaAttempts.length > 1 ? `(${visaAttempts.length} attempts)` : ''}</p>
              <div className="space-y-2">
                {visaAttempts.map((v, i) => (
                  <div key={i} className="rounded-md border border-grey-border px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-navy">{visaAttempts.length > 1 ? `Attempt ${i + 1}` : 'Visa application'}{v.appliedDate ? <span className="text-xs text-gray-400"> · applied {shortDate(v.appliedDate)}</span> : null}</p>
                      <Badge className={VISA_STATUS_STYLES[v.status]}>{v.status}</Badge>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {[
                        `Documents ${checklistCompleteCount(v)}/${checklistTotalCount(v)}`,
                        isVisaReapplication(v) && 'Re-application',
                        v.interviewRequired && 'Interview required',
                        v.documentsRequestedFromHighCommission && 'High Commission requested documents',
                        (v.customChecklist ?? []).length > 0 && `${(v.customChecklist ?? []).length} extra document${(v.customChecklist ?? []).length === 1 ? '' : 's'} added`,
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {v.notes && <p className="text-xs text-gray-600 mt-1">{v.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refund */}
          {visa?.refundRequested && (
            <div>
              <p className={sectionTitle}>Refund</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-gray-400">Requested</dt><dd className="text-navy">{shortDate(visa.refundRequestedDate) || '—'}</dd>
                <dt className="text-gray-400">Status</dt>
                <dd className={visa.refundReceived ? 'text-green-700' : 'text-purple-700'}>
                  {visa.refundReceived ? `Received ${shortDate(visa.refundReceivedDate)}${visa.refundReceivedBy ? ` by ${visa.refundReceivedBy}` : ''}` : 'Processing'}
                </dd>
                {visa.refundRequestedDate && visa.refundReceivedDate && (
                  <><dt className="text-gray-400">Took</dt><dd className="text-navy">{daysBetweenDates(visa.refundRequestedDate, visa.refundReceivedDate)} days</dd></>
                )}
                {visa.refundFollowUpNote && (
                  <><dt className="text-gray-400">Follow-up note</dt><dd className="text-navy">{visa.refundFollowUpNote}</dd></>
                )}
              </dl>
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div>
              <p className={sectionTitle}>Timeline</p>
              <ol className="relative border-l border-grey-border ml-1.5 space-y-2.5">
                {timeline.map((t, i) => (
                  <li key={i} className="pl-4 relative">
                    <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      t.tone === 'positive' ? 'bg-green-500' : t.tone === 'negative' ? 'bg-red-500' : 'bg-gray-300'
                    }`} />
                    <p className="text-xs text-navy">{t.label}</p>
                    <p className="text-[11px] text-gray-400">{shortDate(t.date)}{t.by ? ` · ${t.by}` : ''}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Enrolment documents (Enrolled step) ───────────────────────────────────────
// Only the V/A Officer marks documents received or adds new ones; everyone else (counselors,
// managers) sees what's in and what's still missing. Expanded while the offer hasn't been
// applied yet — that's when it matters — and collapsible to a summary afterwards.

function EnrolmentChecklistBlock({
  application, canMark, currentUser, onUpdate, expandedDefault,
}: { application: ApplicationRecord; canMark: boolean; currentUser: MockUser; onUpdate: (u: Partial<ApplicationRecord>) => void; expandedDefault: boolean }) {
  const [expanded, setExpanded] = useState(expandedDefault);
  const [newLabel, setNewLabel] = useState('');
  const list = application.enrolmentChecklist ?? { marks: {}, custom: [] };
  const { done, total } = enrolmentChecklistCounts(application);
  const complete = done === total;
  const save = (next: typeof list) => onUpdate({ enrolmentChecklist: next });

  const toggleItem = (key: string) => {
    const marks = { ...list.marks };
    if (marks[key]) delete marks[key];
    else marks[key] = { by: currentUser.name, date: today() };
    save({ ...list, marks });
  };
  const toggleCustom = (id: string) =>
    save({ ...list, custom: list.custom.map((c) => (c.id === id ? (c.done ? { ...c, done: false, doneBy: undefined, doneDate: undefined } : { ...c, done: true, doneBy: currentUser.name, doneDate: today() }) : c)) });
  const removeCustom = (id: string) => save({ ...list, custom: list.custom.filter((c) => c.id !== id) });
  const addCustom = () => {
    const label = newLabel.trim();
    if (!label) return;
    save({ ...list, custom: [...list.custom, { id: `ec${Date.now()}`, label, done: false, addedBy: currentUser.name }] });
    setNewLabel('');
  };

  const Row = ({ label, received, meta, optional, onToggle, onRemove }: {
    label: string; received: boolean; meta?: string; optional?: boolean; onToggle: () => void; onRemove?: () => void;
  }) => (
    <div className="flex items-start gap-2.5">
      {canMark ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${received ? 'Unmark' : 'Mark'} ${label} received`}
          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${received ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-navy-light'}`}
        >
          {received && <Check className="text-white" size={10} />}
        </button>
      ) : (
        <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${received ? 'bg-green-500' : 'border border-gray-300'}`}>
          {received && <Check className="text-white" size={10} />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-700">
          {label}
          {optional && <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Optional</span>}
        </p>
        {meta && <p className="text-[11px] text-gray-400">{meta}</p>}
      </div>
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${received ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
        {received ? 'Received' : 'Not received'}
      </span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-500" aria-label={`Remove ${label}`}>
          <X size={13} />
        </button>
      )}
    </div>
  );

  return (
    <div className="mt-2.5 rounded-lg border border-grey-border bg-white p-3">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left">
        <span className="text-xs font-medium text-gray-500">Enrolment documents</span>
        <span className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold ${complete ? 'text-green-600' : 'text-amber-600'}`}>{done} of {total} received</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {expanded && (
        <div className="dissolve-in mt-3 space-y-2">
          {ENROLMENT_CHECKLIST_ITEMS.map((item) => {
            const mark = list.marks[item.key];
            return (
              <Row
                key={item.key}
                label={item.label}
                optional={item.optional}
                received={!!mark}
                meta={mark ? `Marked by ${mark.by}${mark.date ? ` · ${mark.date}` : ''}` : undefined}
                onToggle={() => toggleItem(item.key)}
              />
            );
          })}
          {list.custom.length > 0 && (
            <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Added by V/A Officer</p>
          )}
          {list.custom.map((c) => (
            <Row
              key={c.id}
              label={c.label}
              received={c.done}
              meta={c.done && c.doneBy ? `Marked by ${c.doneBy}${c.doneDate ? ` · ${c.doneDate}` : ''}` : `Added by ${c.addedBy}`}
              onToggle={() => toggleCustom(c.id)}
              onRemove={canMark && !c.done ? () => removeCustom(c.id) : undefined}
            />
          ))}
          {canMark ? (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
                placeholder="Add a document"
                className="flex-1 border border-grey-border rounded-lg px-2.5 py-1.5 text-xs text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light"
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!newLabel.trim()}
                className="px-2.5 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          ) : (
            <p className="pt-1 text-[11px] text-gray-400">View only — the V/A Officer marks documents as they're received.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Status Tracker (bottom-left) ──────────────────────────────────────────────

/** One row of the Status Tracker stepper. */
interface TrackerStep {
  key: string;
  label: string;
  date?: string;
  by?: string;
  isDone: boolean;
  isCurrent: boolean;
  isCurrentNegative: boolean;
  isChecklistStep: boolean;
  showEnrollmentComplete: boolean;
  showRefund: boolean;
  showVisaMarkers: boolean;
  /** Extra line under the label — country chosen, decision, why a step is locked or skipped. */
  note?: string;
  /** Faded: skipped or no longer applicable. */
  muted?: boolean;
  /** Country-route checklist shown inline while this step is current. */
  routeChecklist?: string;
  routeStepKey?: string;
}

type ActionKind = 'advance' | 'confirm-positive' | 'confirm-negative' | 'apply-modal' | 'reapply-modal' | 'refund' | 'fee-paid-modal' | 'reenroll-modal' | 'datetime';

interface StatusAction {
  value: string;
  label: string;
  kind: ActionKind;
  disabled?: boolean;
  disabledReason?: string;
}

// `selectedOffer` is whichever institution card is currently selected in the tracker. For a
// study case, only the institution whose fee was actually paid drives the visa journey — the
// others are backup applications that just progress through their own offer stage and go
// read-only (no more actions) once a different institution has been chosen for the visa case.
function getAvailableActions(application: ApplicationRecord, selectedOffer: OfferApplication | null): StatusAction[] {
  const visa = application.visaApplication;
  const study = isStudyCase(application.purpose);

  // A withdrawn file has left the pipeline. One closed after a refund can be re-enrolled for
  // a new course or country; otherwise nothing more can be actioned.
  if (application.withdrawn) {
    return isClosedAfterRefund(application) ? [{ value: 're-enroll', label: 'Re-enroll Client', kind: 'reenroll-modal' }] : [];
  }

  if (!study) {
    // SOWP and Visit cases skip the offer stages entirely.
    if (!visa) return [{ value: 'start-docs', label: 'Start Preparing Documents', kind: 'advance' }];
    return getVisaActions(visa, study);
  }

  const feePaidOffer = getFeePaidOffer(application);
  if (feePaidOffer) {
    if (!selectedOffer || selectedOffer.id !== feePaidOffer.id) return [];
    return visa ? getVisaActions(visa, study) : [];
  }

  if (!selectedOffer) return [{ value: 'apply', label: 'Apply to Institution', kind: 'apply-modal' }];

  switch (selectedOffer.status) {
    case 'Enrolled': {
      // The application can't go to the institution until the enrolment documents are in.
      const docsDone = isEnrolmentChecklistComplete(application);
      return [{ value: 'applied', label: 'Mark Applied to Institution', kind: 'advance', disabled: !docsDone, disabledReason: ENROLMENT_CHECKLIST_BLOCK_REASON }];
    }
    case 'Applied to Institution':
      return [
        { value: 'offer-received', label: 'Mark Offer Received', kind: 'confirm-positive' },
        { value: 'offer-rejected', label: 'Mark Offer Rejected', kind: 'confirm-negative' },
        { value: 'further-info', label: 'Mark Further Information Required', kind: 'advance' },
      ];
    case 'Further Information Required':
      return [
        { value: 'offer-received', label: 'Mark Offer Received', kind: 'confirm-positive' },
        { value: 'offer-rejected', label: 'Mark Offer Rejected', kind: 'confirm-negative' },
      ];
    case 'Offer Received':
      return [{ value: 'fee-paid', label: 'Mark Fee Paid', kind: 'fee-paid-modal' }];
    case 'Rejected':
      return [{ value: 'reapply', label: 'Re-apply to a New Institution', kind: 'reapply-modal' }];
    case 'Fee Paid':
    default:
      return [];
  }
}

function getVisaActions(visa: VisaApplication, study: boolean): StatusAction[] {
  switch (visa.status) {
    case 'Preparing Documents': {
      const done = isChecklistComplete(visa);
      return [{ value: 'file-ready', label: 'Mark File Ready for Visa', kind: 'advance', disabled: !done, disabledReason: 'Complete every checklist item first' }];
    }
    case 'File Ready for Visa':
      return [{ value: 'visa-applied', label: 'Mark Visa Applied', kind: 'advance' }];
    case 'Visa Applied':
      return [
        { value: 'visa-approved', label: 'Mark Visa Approved', kind: 'confirm-positive' },
        { value: 'visa-refused', label: 'Mark Visa Refused', kind: 'confirm-negative' },
      ];
    case 'Visa Approved':
      return visa.enrollmentCompleted
        ? []
        : [{ value: 'complete-enrollment', label: 'Complete Enrollment', kind: 'advance' }];
    case 'Visa Refused': {
      // Once a refund is requested, re-applying is off the table: the refund is either received
      // (closing the file) or the client moves on to a new country / course while it processes.
      if (visa.refundRequested) {
        return visa.refundReceived ? [] : [
          { value: 'refund-close', label: 'Mark Refund Received & Close File', kind: 'confirm-negative' },
          { value: 'enroll-new', label: 'Enroll in a New Country or Course (refund processing)', kind: 'reenroll-modal' },
        ];
      }
      const actions: StatusAction[] = [];
      actions.push({ value: 'reapply-docs', label: 'Re-apply (New Document Attempt)', kind: 'advance' });
      if (study) actions.push({ value: 'reapply', label: 'Re-apply to a New Institution', kind: 'reapply-modal' });
      actions.push({ value: 'refund', label: 'Request Refund', kind: 'refund' });
      return actions;
    }
    default:
      return [];
  }
}

function StatusTracker({
  application, canEdit, currentUser, onUpdate,
}: { application: ApplicationRecord; canEdit: boolean; currentUser: MockUser; onUpdate: (u: Partial<ApplicationRecord>) => void }) {
  const [selectedValue, setSelectedValue] = useState('');
  const [pendingAction, setPendingAction] = useState<StatusAction | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  // 'reopen' = re-enroll a closed file; 'while-refund' = move on while a refund is processing.
  const [showReEnroll, setShowReEnroll] = useState<'reopen' | 'while-refund' | null>(null);
  const [showFeePaidModal, setShowFeePaidModal] = useState(false);
  // 'request' = Request Refund (sets the first follow-up); 'reschedule' = change the date.
  const [refundModal, setRefundModal] = useState<'request' | 'reschedule' | null>(null);
  const [deferOfferId, setDeferOfferId] = useState<string | null>(null);
  const [deferValue, setDeferValue] = useState('');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);

  const steps = pipelineStepsFor(application);
  const pipelineStep = getPipelineStep(application);
  const study = isStudyCase(application.purpose);
  const visa = application.visaApplication;
  const visaHistory = visa?.history ?? [];
  const visaAttemptCount = visa ? visaHistory.length + 1 : 0;
  const active = getActiveOfferApplication(application);
  const attempts = application.offerApplications;
  // The offer actually driving the visa case — the fee-paid one once there is one, otherwise
  // whichever offer is currently active. Card selection defaults here; picking a different
  // (backup) institution card overrides it for viewing/acting on that offer instead — but
  // once a fee's been paid, the other institutions are locked and unselectable, so a stale
  // selection from before the fee was paid must not keep pointing at one of them.
  const feePaidOffer = getFeePaidOffer(application);
  // A client can hold offers in several countries: after an offer is in, the counselor chooses
  // the one to process. That choice (or a paid fee) commits the case to one institution.
  const processingOffer = study ? processingOfferOf(application) : null;
  const committedOffer = feePaidOffer ?? processingOffer;
  const primaryOffer = committedOffer ?? active;
  const selectedOffer = committedOffer
    ? committedOffer
    : (selectedOfferId ? attempts.find((o) => o.id === selectedOfferId) : null) ?? primaryOffer;
  // Offers eligible for the fee payment — the chosen one once a country is chosen; before that,
  // anything with an offer in hand, so the right institution can be picked.
  // With offers in several countries the "active" offer may not be the chosen one — until the fee
  // is paid, the chosen offer's Offer Received is where the tracker stands.
  const { index: stepIndex, negative } = processingOffer && !feePaidOffer && !visa
    ? { index: steps.findIndex((st) => st.key === 'offer_outcome'), negative: false }
    : pipelineStep;
  const feePaidCandidates = processingOffer
    ? [processingOffer]
    : attempts.filter((o) => o.status === 'Offer Received' || o.status === 'Enrolled' || o.status === 'Applied to Institution' || o.status === 'Further Information Required');

  const setCustom = (v: VisaApplication, items: CustomChecklistItem[]) =>
    onUpdate({ visaApplication: { ...v, customChecklist: items } });

  const addCustomItem = (v: VisaApplication) => {
    const label = newItemLabel.trim();
    if (!label) return;
    setCustom(v, [...(v.customChecklist ?? []), { id: `c${Date.now()}`, label, done: false, addedBy: currentUser.name }]);
    setNewItemLabel('');
  };

  const toggleCustomItem = (v: VisaApplication, id: string) =>
    setCustom(v, (v.customChecklist ?? []).map((c) => (c.id === id ? { ...c, done: !c.done } : c)));

  const removeCustomItem = (v: VisaApplication, id: string) =>
    setCustom(v, (v.customChecklist ?? []).filter((c) => c.id !== id));

  // ── Destination route ──
  // Every study client goes Enrolled → Applied → Offer Received → Choose Country to Process.
  // Canada (and any country without its own route) then follows the standard Fee Paid → visa
  // steps; Australia / UK / New Zealand / USA follow their own route, driven by the same
  // Update Status dropdown below.
  const route = countryRouteFor(application);
  const routeState = route ? routeStateFor(application, route) : null;
  const routeViews = routeState ? stepViews(routeState).filter((v) => routeSteps(routeState.country).some((d) => d.key === v.def.key)) : [];
  const receivedOffers = attempts.filter((o) => o.status === 'Offer Received');
  const choosing = study && !application.withdrawn && !processingOffer && !feePaidOffer && !visa;
  const showingPrimary = !selectedOffer || !primaryOffer || selectedOffer.id === primaryOffer.id;
  const routeStarted = routeViews.some((v) => v.state === 'done');
  const [interviewAt, setInterviewAt] = useState('');

  const countryChoiceItem: TrackerStep = {
    key: 'choose-country',
    label: processingOffer ? `Country to Process: ${offerCountryName(application, processingOffer)}` : 'Choose Country to Process',
    note: processingOffer
      ? processingOffer.institution
      : receivedOffers.length
        ? `Offers in hand: ${receivedOffers.map((o) => `${offerCountryName(application, o)} (${o.institution})`).join(', ')}`
        : 'Available once an offer is received',
    isDone: !!processingOffer,
    isCurrent: !processingOffer && receivedOffers.length > 0,
    isCurrentNegative: false,
    isChecklistStep: false,
    showEnrollmentComplete: false,
    showRefund: false,
    showVisaMarkers: false,
  };

  const rawActions = getAvailableActions(application, selectedOffer);
  const actions: StatusAction[] = (() => {
    if (!study || application.withdrawn) return rawActions;
    // Before a country is chosen: the offer-stage actions, plus one "process" option per offer in hand.
    if (choosing) {
      const pick = receivedOffers.map((o): StatusAction => ({
        value: `process:${o.id}`, label: `Process ${offerCountryName(application, o)} — ${o.institution}`, kind: 'advance',
      }));
      return [...pick, ...rawActions.filter((a) => a.value !== 'fee-paid')];
    }
    // A country was chosen but nothing after it has happened yet — the choice can still change.
    const canChange = !!processingOffer && application.processingOfferId !== undefined && !feePaidOffer && !visa && !routeStarted;
    const change: StatusAction[] = canChange ? [{ value: 'process-reset', label: 'Change Country to Process', kind: 'advance' }] : [];
    if (!route || !routeState) return [...rawActions, ...change];
    // Country route: its current step, then refusal follow-ups (refund / re-apply) and — where the
    // route ends at the visa decision — the standard Complete Enrollment.
    const step: StatusAction[] = routeActions(routeState).map((a) => ({
      value: `route:${a.key}:${a.value}`,
      label: a.label,
      kind: a.needs === 'university-id' ? 'fee-paid-modal' : a.needs === 'datetime' ? 'datetime' : a.tone === 'positive' ? 'confirm-positive' : a.tone === 'negative' ? 'confirm-negative' : 'advance',
      disabled: !!a.disabledReason,
      disabledReason: a.disabledReason,
    }));
    const followUps = visa && (visa.status === 'Visa Refused' || (visa.status === 'Visa Approved' && (route === 'Australia' || route === 'United Kingdom')))
      ? getVisaActions(visa, study) : [];
    return [...step, ...followUps, ...change];
  })();
  const effectiveValue = actions.some((a) => a.value === selectedValue) ? selectedValue : (actions[0]?.value ?? '');
  const selectedAction = actions.find((a) => a.value === effectiveValue) ?? null;

  const updateOffer = (id: string, updates: Partial<OfferApplication>) =>
    onUpdate({ offerApplications: attempts.map((o) => (o.id === id ? { ...o, ...updates } : o)) });

  const archiveVisaAttempt = (v: VisaApplication): VisaApplication => ({ ...v, history: [] });

  const newVisaAttempt = (date: string, history: VisaApplication[] = []): VisaApplication => ({
    status: 'Preparing Documents',
    statusUpdatedAt: date,
    preparingDocsDate: date,
    checklist: emptyVisaChecklist(),
    customChecklist: [],
    notes: '',
    history,
  });

  // Complete the country route's current step, and apply what it means for the offer / visa record.
  const [routeError, setRouteError] = useState('');
  const completeRouteStep = (key: string, value: string) => {
    if (!route || !routeState) return;
    const next = completeStep(routeState, key, value, currentUser.name, formatSubmittedAt(new Date()));
    if (typeof next === 'string') { setRouteError(next); return; }
    setRouteError('');
    onUpdate({ countryPipeline: next, ...routeRecordUpdates(application, route, key, value, currentUser.name, today()) });
  };

  const performAction = (value: string) => {
    const date = today();
    if (value.startsWith('process:')) {
      // Choosing the offer (and so the country) to process unlocks that country's next steps.
      onUpdate({ processingOfferId: value.slice('process:'.length), countryPipeline: null });
      setSelectedOfferId(null);
      setPendingAction(null);
      return;
    }
    if (value === 'process-reset') {
      onUpdate({ processingOfferId: '', countryPipeline: null });
      setPendingAction(null);
      return;
    }
    if (value.startsWith('route:')) {
      const [, key, ...rest] = value.split(':');
      completeRouteStep(key, rest.join(':'));
      setPendingAction(null);
      return;
    }
    switch (value) {
      case 'applied':
        if (selectedOffer) updateOffer(selectedOffer.id, { status: 'Applied to Institution', statusUpdatedAt: date, appliedDate: date, appliedBy: currentUser.name });
        break;
      case 'further-info':
        if (selectedOffer) updateOffer(selectedOffer.id, { status: 'Further Information Required', statusUpdatedAt: date, furtherInfoRequired: true });
        break;
      case 'offer-received':
        if (selectedOffer) updateOffer(selectedOffer.id, { status: 'Offer Received', statusUpdatedAt: date, outcomeDate: date, outcomeBy: currentUser.name });
        break;
      case 'offer-rejected':
        if (selectedOffer) updateOffer(selectedOffer.id, { status: 'Rejected', statusUpdatedAt: date, outcomeDate: date, outcomeBy: currentUser.name });
        break;
      case 'fee-paid':
        if (selectedOffer) {
          onUpdate({
            offerApplications: attempts.map((o) => (o.id === selectedOffer.id ? { ...o, status: 'Fee Paid', statusUpdatedAt: date, feePaidDate: date, feePaidBy: currentUser.name } : o)),
            visaApplication: newVisaAttempt(date, visaHistory),
          });
        }
        break;
      // SOWP / Visit cases open their visa case straight from enrolment.
      case 'start-docs':
        onUpdate({ visaApplication: newVisaAttempt(date, visaHistory) });
        break;
      case 'complete-enrollment':
        if (visa) onUpdate({ visaApplication: { ...visa, enrollmentCompleted: true, enrollmentCompletedDate: date } });
        break;
      // A refused visa can be re-attempted — the checklist resets for the fresh attempt.
      case 'reapply-docs':
        if (visa) {
          onUpdate({ visaApplication: newVisaAttempt(date, [...visaHistory, archiveVisaAttempt(visa)]) });
        }
        break;
      case 'file-ready':
        if (visa) onUpdate({ visaApplication: { ...visa, status: 'File Ready for Visa', statusUpdatedAt: date, fileReadyDate: date } });
        break;
      case 'visa-applied':
        if (visa) onUpdate({ visaApplication: { ...visa, status: 'Visa Applied', statusUpdatedAt: date, appliedDate: date } });
        break;
      case 'visa-approved':
        if (visa) onUpdate({ visaApplication: { ...visa, status: 'Visa Approved', statusUpdatedAt: date, outcomeDate: date } });
        break;
      case 'visa-refused':
        if (visa) onUpdate({ visaApplication: { ...visa, status: 'Visa Refused', statusUpdatedAt: date, outcomeDate: date } });
        break;
      // Refund came through — record it, settle the follow-up and close the file (withdrawn).
      case 'refund-close':
        if (visa) {
          onUpdate({
            visaApplication: {
              ...visa,
              refundReceived: true,
              refundReceivedDate: date,
              refundReceivedBy: currentUser.name,
              refundFollowUpDone: true,
              refundFollowUpDoneDate: visa.refundFollowUpDoneDate ?? date,
            },
            withdrawn: true,
            withdrawnDate: date,
          });
        }
        break;
      case 'refund':
        // Handled by the Request Refund modal, which also schedules the follow-up.
        setRefundModal('request');
        break;
    }
    setPendingAction(null);
  };

  const handleAddOffer = (o: OfferApplication) => {
    const resetVisa = application.visaApplication?.status === 'Visa Refused';
    const date = today();
    const history = resetVisa && application.visaApplication
      ? [...(application.visaApplication.history ?? []), archiveVisaAttempt(application.visaApplication)]
      : visaHistory;
    onUpdate({
      offerApplications: [...attempts, { ...o, enrolledBy: currentUser.name }],
      ...(resetVisa ? { visaApplication: newVisaAttempt(date, history) } : {}),
    });
    setShowApplyModal(false);
  };

  // Re-enrolling: the current round (offers + visa) moves to Previous Enrolments and the case
  // starts again — with the new institution for Study cases, or just the new country for
  // SOWP / Tourist / PR, whose tracker restarts at Start Preparing Documents. When done while
  // a refund is still processing, the refund stays on that archived round to be marked later.
  const reEnroll = (newOffer: OfferApplication | null, country: string) => {
    const date = today();
    const whileRefund = showReEnroll === 'while-refund';
    const closedRound: PreviousEnrolment = {
      id: `pe${Date.now()}`,
      closeReason: whileRefund ? 'Refund processing' : visa?.refundReceived ? 'Refund received' : 'Closed',
      closedDate: whileRefund ? date : application.withdrawnDate,
      reEnrolledDate: date,
      reEnrolledBy: currentUser.name,
      offerApplications: attempts,
      visaApplication: visa,
    };
    onUpdate({
      previousEnrolments: [...(application.previousEnrolments ?? []), closedRound],
      offerApplications: newOffer ? [{ ...newOffer, enrolledBy: currentUser.name }] : [],
      visaApplication: null,
      withdrawn: false,
      withdrawnDate: '',
      country,
    });
    setShowReEnroll(null);
  };

  const markPreviousRefundReceived = (id: string) => {
    const date = today();
    onUpdate({
      previousEnrolments: (application.previousEnrolments ?? []).map((p) =>
        p.id === id && p.visaApplication
          ? {
              ...p,
              closeReason: 'Refund received',
              visaApplication: {
                ...p.visaApplication,
                refundReceived: true,
                refundReceivedDate: date,
                refundReceivedBy: currentUser.name,
                refundFollowUpDone: true,
                refundFollowUpDoneDate: p.visaApplication.refundFollowUpDoneDate ?? date,
              },
            }
          : p
      ),
    });
  };

  const handleUpdateStatusClick = () => {
    if (!selectedAction || selectedAction.disabled) return;
    if (selectedAction.kind === 'apply-modal' || selectedAction.kind === 'reapply-modal') { setShowApplyModal(true); return; }
    if (selectedAction.kind === 'fee-paid-modal') { setShowFeePaidModal(true); return; }
    if (selectedAction.kind === 'datetime') {
      if (!interviewAt) { setRouteError('Pick the interview date and time.'); return; }
      completeRouteStep(selectedAction.value.split(':')[1], interviewAt);
      setInterviewAt('');
      return;
    }
    if (selectedAction.kind === 'refund') { setRefundModal('request'); return; }
    if (selectedAction.kind === 'reenroll-modal') { setShowReEnroll(selectedAction.value === 'enroll-new' ? 'while-refund' : 'reopen'); return; }
    if (selectedAction.kind === 'confirm-positive' || selectedAction.kind === 'confirm-negative') { setPendingAction(selectedAction); return; }
    performAction(selectedAction.value);
  };

  // Fee Paid closes out the offer attempt with its confirmed enrolment details and opens
  // the visa stage.
  const handleFeePaid = (details: FeePaidDetails) => {
    const date = today();
    onUpdate({
      offerApplications: attempts.map((o) => (o.id === details.offerId
        ? { ...o, status: 'Fee Paid' as const, statusUpdatedAt: date, feePaidDate: date, feePaidBy: currentUser.name, studentId: details.studentId }
        : o)),
      visaApplication: newVisaAttempt(date, visaHistory),
    });
    setShowFeePaidModal(false);
  };

  const saveDeferredIntake = (offerId: string) => {
    const value = deferValue.trim();
    if (value) updateOffer(offerId, { intake: value });
    setDeferOfferId(null);
    setDeferValue('');
  };

  return (
    <>
      <PreviousEnrolments items={application.previousEnrolments ?? []} canEdit={canEdit} onMarkRefundReceived={markPreviousRefundReceived} />

      {/* Offer attempt history — institution, program and intake, with a deferrable intake */}
      {attempts.length > 0 && (
        <div className="mb-5 pb-5 border-b border-grey-border space-y-3">
          {/* Clients often apply to more than one institution in parallel — available until a
              fee is paid, at which point that institution is committed to and the button locks.
              (A visa refusal still offers "Re-apply to a New Institution" through the actions.) */}
          {canEdit && study && !application.withdrawn && (
            <button
              onClick={() => setShowApplyModal(true)}
              disabled={!!feePaidOffer}
              title={feePaidOffer ? `Fee already paid to ${feePaidOffer.institution} — no more institutions can be added` : undefined}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-grey-border text-sm font-medium text-navy hover:bg-grey-bg transition-colors disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
            >
              <Plus size={14} />
              Add Institution
            </button>
          )}
          {canEdit && study && !application.withdrawn && feePaidOffer && (
            <p className="text-xs text-gray-400 text-center -mt-1">Fee paid to {feePaidOffer.institution}. No more institutions can be added.</p>
          )}
          {[...attempts].reverse().map((o) => {
            // Once a fee's been paid on one institution, that one alone drives the case —
            // every other institution is a dead backup with nothing left to select, view,
            // or edit, so it's locked out instead of staying clickable.
            const locked = study && !!committedOffer && committedOffer.id !== o.id;
            // Selecting a card only matters once there's more than one institution to choose
            // between — it picks which offer the stepper/actions below describe.
            const selectable = study && attempts.length > 1 && !locked;
            const isSelected = selectable && selectedOffer?.id === o.id;
            return (
            <div
              key={o.id}
              onClick={selectable ? () => setSelectedOfferId(o.id) : undefined}
              className={`space-y-1.5 rounded-lg p-2 -mx-2 transition-colors ${
                locked ? 'opacity-50 grayscale cursor-not-allowed'
                : selectable ? `cursor-pointer ${isSelected ? 'bg-navy/5 ring-1 ring-navy-light' : 'hover:bg-grey-bg'}` : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="text-gray-400 flex-shrink-0" size={14} />
                <span className="text-sm text-navy truncate flex-1">{o.institution}</span>
                <Badge className={OFFER_STATUS_STYLES[o.status]}>{o.status}</Badge>
              </div>
              <div className="pl-6 space-y-1">
                {/* Who did what and when now lives on the Status Tracker timeline below,
                    next to each step's own date, instead of stacking as generic lines here. */}
                {o.country && <p className="text-xs text-gray-500">Country: <span className="text-gray-700">{o.country}</span></p>}
                {o.studentId && <p className="text-xs text-gray-500">University Client ID: <span className="text-gray-700">{o.studentId}</span></p>}
                {o.clientRefId && <p className="text-xs text-gray-500">Reference: <span className="text-gray-700">{o.clientRefId}</span></p>}
                {o.course && <p className="text-xs text-gray-500">Course: <span className="text-gray-700">{o.course}</span></p>}
                {/* "Further Information Required" is now a pipeline status, shown in the badge above. */}
                {deferOfferId === o.id ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <IntakePicker value={deferValue} onChange={setDeferValue} size="sm" />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => saveDeferredIntake(o.id)} disabled={!isCompleteIntake(deferValue) || deferValue === o.intake} className="px-2.5 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Save</button>
                      <button onClick={() => { setDeferOfferId(null); setDeferValue(''); }} className="px-2.5 py-1.5 rounded-lg border border-grey-border text-xs font-medium text-gray-500 hover:bg-grey-bg transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">Intake: <span className="text-gray-700">{o.intake ?? 'Not set'}</span></p>
                    {canEdit && !application.withdrawn && !locked && (
                      <button
                        onClick={() => { setDeferOfferId(o.id); setDeferValue(o.intake ?? ''); }}
                        className="text-xs font-semibold text-navy hover:text-navy-light transition-colors"
                      >
                        Defer Intake
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Vertical stepper */}
      <div className="space-y-0">
        {((): TrackerStep[] => {
          const visaStepLabels = ['Preparing Documents', 'File Ready for Visa', 'Visa Applied', 'Visa Approved'];
          const visaStepKeys = ['preparing_docs', 'file_ready', 'visa_applied', 'visa_outcome'];
          const statusIndex = (attempt: VisaApplication) => {
            if (attempt.status === 'Preparing Documents') return 0;
            if (attempt.status === 'File Ready for Visa') return 1;
            if (attempt.status === 'Visa Applied') return 2;
            return 3;
          };

          // Date shown beside each step's label — undefined leaves the step's date blank
          // rather than guessing, since older records saved before these fields existed
          // won't have them.
          const offerStepDate = (key: PipelineStepKey, offer: typeof active) => {
            if (!offer) return undefined;
            switch (key) {
              case 'enrolled': return offer.enrolledDate ?? (offer.status === 'Enrolled' ? offer.statusUpdatedAt : undefined);
              case 'applied': return offer.appliedDate;
              case 'offer_outcome': return offer.outcomeDate;
              case 'fee_paid': return offer.feePaidDate;
              default: return undefined;
            }
          };
          // Staff member who reached each step — shown next to that step's date.
          const offerStepBy = (key: PipelineStepKey, offer: typeof active) => {
            if (!offer) return undefined;
            switch (key) {
              case 'enrolled': return offer.enrolledBy;
              case 'applied': return offer.appliedBy;
              case 'offer_outcome': return offer.outcomeBy;
              case 'fee_paid': return offer.feePaidBy;
              default: return undefined;
            }
          };
          const visaStepDate = (i: number, attempt: VisaApplication) => {
            switch (i) {
              case 0: return attempt.preparingDocsDate ?? (attempt.status === 'Preparing Documents' ? attempt.statusUpdatedAt : undefined);
              case 1: return attempt.fileReadyDate ?? (attempt.status === 'File Ready for Visa' ? attempt.statusUpdatedAt : undefined);
              case 2: return attempt.appliedDate;
              case 3: return attempt.outcomeDate;
              default: return undefined;
            }
          };

          // Study client on the offer being processed: the shared offer steps, the country choice
          // and — for Australia / UK / New Zealand / USA — that country's steps. (Canada and other
          // countries continue with the standard steps below once chosen.)
          if (study && primaryOffer && showingPrimary && (choosing || route)) {
            const baseKeys: PipelineStepKey[] = ['enrolled', 'applied', 'offer_outcome'];
            const offerForSteps = processingOffer ?? primaryOffer;
            const { key: curKey, negative: curNegative } = getOfferPipelineStep(offerForSteps);
            const curIdx = processingOffer || receivedOffers.length > 0 ? baseKeys.length : baseKeys.indexOf(curKey);
            const baseItems: TrackerStep[] = steps.filter((step) => baseKeys.includes(step.key)).map((step, i) => ({
              key: step.key,
              label: step.key === 'offer_outcome' && curNegative && i === curIdx ? 'Offer Rejected' : step.label,
              date: offerStepDate(step.key, offerForSteps),
              by: offerStepBy(step.key, offerForSteps),
              isDone: i < curIdx,
              isCurrent: i === curIdx,
              isCurrentNegative: i === curIdx && curNegative,
              isChecklistStep: false,
              showEnrollmentComplete: false,
              showRefund: false,
              showVisaMarkers: false,
            }));
            const routeItems: TrackerStep[] = routeState ? routeViews.map((v) => {
              const rec = routeState.steps[v.def.key];
              const refused = v.state === 'done' && /refus|reject/i.test(rec?.value ?? '');
              const shown = !rec?.value ? undefined
                : v.def.input?.kind === 'datetime' ? `Interview: ${formatInterview(rec.value)}`
                  : v.def.input?.kind === 'text' ? `University Client ID: ${rec.value}` : rec.value;
              return {
                key: `route-${v.def.key}`,
                label: v.def.label,
                date: rec?.doneAt && /^\d{4}-\d{2}-\d{2}/.test(rec.doneAt) ? rec.doneAt.slice(0, 10) : undefined,
                by: rec?.doneBy && rec.doneBy !== 'From status history' ? rec.doneBy : undefined,
                isDone: v.state === 'done' && !refused,
                isCurrent: v.state === 'active' || v.state === 'locked' || refused,
                isCurrentNegative: refused,
                isChecklistStep: false,
                showEnrollmentComplete: false,
                showRefund: false,
                showVisaMarkers: false,
                note: v.state === 'skipped' ? 'Skipped — no Pre-CAS interview' : v.state === 'locked' || v.state === 'closed' ? v.reason : shown,
                muted: v.state === 'skipped' || v.state === 'closed',
                routeChecklist: v.def.checklist && (v.state === 'active' || v.state === 'locked') ? v.def.checklist : undefined,
                routeStepKey: v.def.key,
              };
            }) : [];
            return [...baseItems, countryChoiceItem, ...routeItems];
          }

          // A backup institution (anything besides the one whose fee was paid, or — before any
          // fee is paid — whichever offer is the active one) never touches the visa stage, so it
          // gets its own short offer-only stepper instead of the merged offer+visa journey below.
          if (study && selectedOffer && primaryOffer && selectedOffer.id !== primaryOffer.id) {
            const offerOnlySteps = steps.filter((step) => !visaStepKeys.includes(step.key));
            const offerKeys = offerOnlySteps.map((step) => step.key);
            const { key: curKey, negative: curNegative } = getOfferPipelineStep(selectedOffer);
            const curIdx = offerKeys.indexOf(curKey);
            return offerOnlySteps.map((step, i) => ({
              key: step.key,
              label: step.key === 'offer_outcome' && curNegative && i === curIdx ? 'Offer Rejected' : step.label,
              date: offerStepDate(step.key, selectedOffer),
              by: offerStepBy(step.key, selectedOffer),
              isDone: i < curIdx,
              isCurrent: i === curIdx,
              isCurrentNegative: i === curIdx && curNegative,
              isChecklistStep: false,
              showEnrollmentComplete: false,
              showRefund: false,
              showVisaMarkers: false,
            }));
          }

          if (!visa || visaAttemptCount <= 1) {
            return steps.map((step, i) => ({
              key: step.key,
              label: step.key === 'offer_outcome' && negative && i === stepIndex ? 'Offer Rejected'
                : step.key === 'visa_outcome' && negative && i === stepIndex ? 'Visa Refused'
                  : step.label,
              date: visaStepKeys.includes(step.key) && visa ? visaStepDate(visaStepKeys.indexOf(step.key), visa) : offerStepDate(step.key, primaryOffer),
              by: visaStepKeys.includes(step.key) ? undefined : offerStepBy(step.key, primaryOffer),
              // Reaching a step's named status is itself that step's "done" event — the only
              // ones that stay ring/current instead of dark-filled while current are steps with
              // their own extra completion requirement beyond just being reached: Preparing
              // Documents (checklist may still be incomplete) and, since it's also the final step
              // and stays on `stepIndex` forever once reached, Visa Approved (needs enrollment
              // completed to actually be done).
              isDone: i < stepIndex
                || (i === stepIndex && step.key === 'visa_outcome' && !negative && !!visa?.enrollmentCompleted)
                || (i === stepIndex && !negative && step.key !== 'preparing_docs' && step.key !== 'visa_outcome'),
              isCurrent: i === stepIndex,
              isCurrentNegative: i === stepIndex && negative,
              isChecklistStep: i === stepIndex && step.key === 'preparing_docs',
              showEnrollmentComplete: i === stepIndex && step.key === 'visa_outcome' && !negative && !!visa?.enrollmentCompleted,
              showRefund: i === stepIndex && step.key === 'visa_outcome' && negative && !!visa?.refundRequested,
              showVisaMarkers: i === stepIndex && step.key === 'visa_applied',
            }));
          }

          const baseSteps = steps.filter((step) => !visaStepKeys.includes(step.key));
          return [
            ...baseSteps.map((step) => ({
              key: step.key,
              label: step.label,
              date: offerStepDate(step.key, primaryOffer),
              by: offerStepBy(step.key, primaryOffer),
              isDone: true,
              isCurrent: false,
              isCurrentNegative: false,
              isChecklistStep: false,
              showEnrollmentComplete: false,
              showRefund: false,
              showVisaMarkers: false,
            })),
            ...[...visaHistory, visa].flatMap((attempt, attemptIndex) => {
              const activeAttempt = attemptIndex === visaAttemptCount - 1;
              const currentIndex = statusIndex(attempt);
              const prefix = `Attempt ${attemptIndex + 1} · `;
              return visaStepLabels.map((baseLabel, i) => {
                const terminalRefused = i === 3 && attempt.status === 'Visa Refused';
                // Same final-step case as the single-attempt branch above: the active attempt's
                // last step sits at `currentIndex` forever once "Visa Approved" is reached, so it
                // needs its own check to show dark-filled once enrollment is actually completed.
                const isFinalStepDone = activeAttempt && i === currentIndex && i === 3 && attempt.status === 'Visa Approved' && !!attempt.enrollmentCompleted;
                // Reaching a step is itself "done" — Preparing Documents (i === 0, checklist may
                // still be incomplete) and Visa Approved (i === 3, handled above) are the only
                // ones that stay ring/current instead of dark-filled while current.
                const isCurrentStepDone = activeAttempt && i === currentIndex && !terminalRefused && i !== 0 && i !== 3;
                return {
                  key: `visa-${attemptIndex}-${i}`,
                  label: `${prefix}${terminalRefused ? 'Visa Refused' : baseLabel}`,
                  date: visaStepDate(i, attempt),
                  by: undefined as string | undefined,
                  isDone: !activeAttempt || i < currentIndex || isFinalStepDone || isCurrentStepDone,
                  isCurrent: activeAttempt && i === currentIndex,
                  isCurrentNegative: terminalRefused,
                  isChecklistStep: activeAttempt && i === currentIndex && i === 0,
                  showEnrollmentComplete: activeAttempt && i === currentIndex && i === 3 && attempt.status === 'Visa Approved' && !!attempt.enrollmentCompleted,
                  showRefund: i === 3 && attempt.status === 'Visa Refused' && !!attempt.refundRequested,
                  showVisaMarkers: activeAttempt && i === 2 && currentIndex >= 2,
                };
              });
            }),
          ];
        })().flatMap((st) => (st.key === 'offer_outcome' && study && processingOffer && !route && showingPrimary ? [st, countryChoiceItem] : [st])).map((step, i, displaySteps) => {
          const isDone = step.isDone;
          const isCurrent = step.isCurrent;
          const isCurrentNegative = step.isCurrentNegative;
          const isLast = i === displaySteps.length - 1;
          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  isCurrentNegative ? 'bg-red-500 border-red-500'
                  : isDone ? 'bg-navy border-navy'
                  : isCurrent ? 'bg-white border-navy'
                  : 'bg-white border-gray-200'
                }`}>
                  {isCurrentNegative ? <X className="text-white" size={13} />
                    : isDone ? <Check className="text-white" size={13} />
                    : <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-navy' : 'bg-gray-200'}`} />}
                </div>
                {!isLast && <div className={`w-px flex-1 min-h-[18px] ${isDone ? 'bg-navy' : 'bg-gray-200'}`} />}
              </div>
              <div className="pb-4 flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={`text-sm font-medium ${step.muted ? 'text-gray-300' : isCurrentNegative ? 'text-red-600' : isDone || isCurrent ? 'text-navy' : 'text-gray-400'}`}>{step.label}</p>
                  {step.date && (
                    <span className={`text-xs flex-shrink-0 ${isCurrentNegative ? 'text-red-500' : isDone || isCurrent ? 'text-gray-500' : 'text-gray-300'}`}>{step.date}</span>
                  )}
                </div>
                {step.by && <p className="text-[11px] text-gray-400 mt-0.5">Updated by: {step.by}</p>}
                {step.note && (
                  <p className={`text-xs mt-0.5 ${step.isCurrentNegative ? 'text-red-600' : step.isCurrent ? 'text-amber-700' : 'text-gray-500'}`}>{step.note}</p>
                )}
                {step.routeStepKey === 'pre-cas-deposit' && routeState && canEdit && !application.withdrawn
                  && !routeState.steps['pre-cas-deposit']?.doneAt && !routeState.steps['clear-conditions']?.doneAt && (
                  <label className="mt-1.5 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-navy">
                    <input
                      type="checkbox"
                      checked={routeState.requiresPreCasInterview !== false}
                      onChange={(e) => onUpdate({ countryPipeline: setPreCasInterview(routeState, e.target.checked, currentUser.name, formatSubmittedAt(new Date())) })}
                      className="h-4 w-4 rounded border-gray-300 accent-navy"
                    />
                    Requires Pre-CAS Interview?
                  </label>
                )}
                {step.routeChecklist && routeState && (() => {
                  const list = CHECKLISTS[step.routeChecklist];
                  const ticks = routeState.checklists[step.routeChecklist] ?? {};
                  const progress = checklistProgress(routeState, step.routeChecklist);
                  const editable = canEdit && !application.withdrawn;
                  return (
                    <div className="mt-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Document checklist</span>
                        <span className={`text-xs font-semibold ${progress.complete ? 'text-green-600' : 'text-gray-500'}`}>
                          {progress.requiredDone} of {progress.requiredTotal} required
                        </span>
                      </div>
                      {list.items.map((item) => {
                        const done = !!ticks[item.key];
                        return (
                          <label key={item.key} className={`flex items-center gap-2.5 ${editable ? 'cursor-pointer group' : ''}`}>
                            <span
                              onClick={editable ? () => onUpdate({ countryPipeline: toggleChecklist(routeState, step.routeChecklist!, item.key) }) : undefined}
                              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${done ? 'bg-green-500 border-green-500' : `border-gray-300 ${editable ? 'group-hover:border-navy-light' : ''}`}`}
                            >
                              {done && <Check className="text-white" size={11} />}
                            </span>
                            <span className={`text-xs ${done ? 'text-gray-400 line-through' : 'text-gray-600'}`}>{item.label}</span>
                            {!item.required && <span className="text-[11px] text-gray-300">optional</span>}
                          </label>
                        );
                      })}
                    </div>
                  );
                })()}
                {step.key === 'enrolled' && study && (
                  <EnrolmentChecklistBlock
                    application={application}
                    canMark={currentUser.role === 'application_officer' && !application.withdrawn}
                    currentUser={currentUser}
                    onUpdate={onUpdate}
                    expandedDefault={step.isCurrent}
                  />
                )}
                {step.isChecklistStep && visa && (
                  <div className="mt-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Document checklist</span>
                      <span className={`text-xs font-semibold ${isChecklistComplete(visa) ? 'text-green-600' : 'text-gray-500'}`}>
                        {checklistCompleteCount(visa)} of {checklistTotalCount(visa)} complete
                      </span>
                    </div>
                    <div className="space-y-3">
                      {isVisaReapplication(visa) && (
                        <p className="text-xs text-gray-500">
                          Re-application after a visa refusal. Only the documents below are required; add anything else this case needs.
                        </p>
                      )}
                      {checklistGroupsFor(visa).map((group) => {
                        const required = group.items.filter((item) => !item.optional);
                        const groupDone = required.filter((item) => visa.checklist[item.key]).length;
                        return (
                          <div key={group.title}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{group.title}</span>
                              <span className={`text-[11px] ${groupDone === required.length ? 'text-green-600' : 'text-gray-400'}`}>{groupDone}/{required.length}</span>
                            </div>
                            <div className="space-y-1.5">
                              {group.items.map((item) => {
                                const done = !!visa.checklist[item.key];
                                return (
                                  <label key={item.key} className={`flex items-center gap-2.5 ${canEdit ? 'cursor-pointer group' : ''}`}>
                                    <div
                                      onClick={canEdit ? () => onUpdate({ visaApplication: { ...visa, checklist: { ...visa.checklist, [item.key]: !done } } }) : undefined}
                                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${done ? 'bg-green-500 border-green-500' : `border-gray-300 ${canEdit ? 'group-hover:border-navy-light' : ''}`}`}
                                    >
                                      {done && <Check className="text-white" size={10} />}
                                    </div>
                                    <span className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.label}</span>
                                    {item.optional && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Optional</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {(visa.customChecklist ?? []).length > 0 && (
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Added by staff</span>
                      )}
                      {/* Custom items staff added themselves, credited to whoever added them */}
                      {(visa.customChecklist ?? []).map((item) => (
                        <div key={item.id} className="flex items-start gap-2.5">
                          <div
                            onClick={canEdit ? () => toggleCustomItem(visa, item.id) : undefined}
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${item.done ? 'bg-green-500 border-green-500' : `border-gray-300 ${canEdit ? 'cursor-pointer hover:border-navy-light' : ''}`}`}
                          >
                            {item.done && <Check className="text-white" size={10} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm ${item.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.label}</p>
                            <p className="text-xs text-gray-400">Added by {item.addedBy}</p>
                          </div>
                          {canEdit && (
                            <button onClick={() => removeCustomItem(visa, item.id)} className="text-gray-300 hover:text-red-500 transition-colors" aria-label={`Remove ${item.label}`}>
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newItemLabel}
                          onChange={(e) => setNewItemLabel(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && newItemLabel.trim()) addCustomItem(visa); }}
                          placeholder={isVisaReapplication(visa) ? 'Add another document for this re-application' : 'Add a checklist item'}
                          className="flex-1 border border-grey-border rounded-lg px-2.5 py-1.5 text-xs text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light"
                        />
                        <button
                          onClick={() => addCustomItem(visa)}
                          disabled={!newItemLabel.trim()}
                          className="px-2.5 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {step.showVisaMarkers && visa && (
                  <div className="mt-2.5 space-y-1.5">
                    {VISA_MARKERS.map((marker) => {
                      const on = !!visa[marker.key];
                      return canEdit ? (
                        <button
                          key={marker.key}
                          onClick={() => onUpdate({ visaApplication: { ...visa, [marker.key]: !on } })}
                          aria-pressed={on}
                          className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium ${
                            on ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-grey-border text-gray-500 hover:bg-grey-bg'
                          }`}
                        >
                          <span className={`h-3.5 w-3.5 flex-shrink-0 rounded border flex items-center justify-center ${on ? 'border-amber-500 bg-amber-500' : 'border-gray-300'}`}>
                            {on && <Check className="text-white" size={9} />}
                          </span>
                          {marker.label}
                        </button>
                      ) : (
                        on && (
                          <Badge key={marker.key} className="bg-amber-50 text-amber-700">{marker.label}</Badge>
                        )
                      );
                    })}
                  </div>
                )}
                {step.showEnrollmentComplete && visa?.enrollmentCompleted && (
                  <div className="mt-2"><Badge className="bg-green-50 text-green-700"><Check size={11} className="mr-1" />Enrollment Complete{visa.enrollmentCompletedDate ? ` · ${visa.enrollmentCompletedDate}` : ''}</Badge></div>
                )}
                {step.showRefund && !(step.isCurrent && visa?.refundRequested) && (
                  <div className="mt-2"><Badge className="bg-gray-100 text-gray-600"><Banknote size={11} className="mr-1" />Refund Requested</Badge></div>
                )}
                {step.showRefund && step.isCurrent && visa?.refundRequested && (
                  <div className="mt-2.5 rounded-lg border border-grey-border bg-white p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className="bg-gray-100 text-gray-600"><Banknote size={11} className="mr-1" />Refund Requested{visa.refundRequestedDate ? ` · ${formatFollowUpDate(visa.refundRequestedDate)}` : ''}</Badge>
                      {visa.refundReceived && (
                        <Badge className="bg-green-50 text-green-700"><Check size={11} className="mr-1" />Refund Received{visa.refundReceivedDate ? ` · ${formatFollowUpDate(visa.refundReceivedDate)}` : ''}</Badge>
                      )}
                    </div>
                    {visa.refundReceived && (
                      <p className="text-xs text-gray-500">File closed{visa.refundReceivedBy ? ` by ${visa.refundReceivedBy}` : ''}.</p>
                    )}
                    {visa.refundFollowUpDate ? (
                      <div className="flex items-start gap-2">
                        <BellRing size={14} className={`mt-0.5 flex-shrink-0 ${visa.refundFollowUpDone ? 'text-gray-300' : 'text-navy'}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${visa.refundFollowUpDone ? 'text-gray-400 line-through' : 'text-navy'}`}>
                            Follow up with client · {formatFollowUpDate(visa.refundFollowUpDate)}
                          </p>
                          {visa.refundFollowUpNote && <p className="text-xs text-gray-500">{visa.refundFollowUpNote}</p>}
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {visa.refundFollowUpDone
                              ? `Done${visa.refundFollowUpDoneDate ? ` · ${formatFollowUpDate(visa.refundFollowUpDoneDate)}` : ''}`
                              : visa.refundFollowUpSetBy ? `Set by ${visa.refundFollowUpSetBy}` : ''}
                          </p>
                        </div>
                        {!visa.refundFollowUpDone && (
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${followUpTiming(visa.refundFollowUpDate).tone}`}>
                            {followUpTiming(visa.refundFollowUpDate).text}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">No follow-up scheduled for this refund.</p>
                    )}
                    {canEdit && !visa.refundReceived && (
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {visa.refundFollowUpDate && !visa.refundFollowUpDone && (
                          <button
                            type="button"
                            onClick={() => onUpdate({ visaApplication: { ...visa, refundFollowUpDone: true, refundFollowUpDoneDate: today() } })}
                            className="px-2.5 py-1 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-light"
                          >
                            Mark follow-up done
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setRefundModal('reschedule')}
                          className="px-2.5 py-1 rounded-lg border border-grey-border text-xs font-medium text-navy hover:bg-grey-bg"
                        >
                          {!visa.refundFollowUpDate ? 'Set follow-up' : visa.refundFollowUpDone ? 'Schedule another follow-up' : 'Change date'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dropdown + Update Status — hidden entirely for view-only roles */}
      {canEdit && (
        actions.length > 0 ? (
          <div className="mt-2 pt-4 border-t border-grey-border space-y-2.5">
            <div className="relative">
              <select
                value={effectiveValue}
                onChange={(e) => setSelectedValue(e.target.value)}
                className="w-full appearance-none border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light pr-9"
              >
                {actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
            {selectedAction?.kind === 'datetime' && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Interview date &amp; time</span>
                <input
                  type="datetime-local"
                  value={interviewAt}
                  onChange={(e) => { setInterviewAt(e.target.value); setRouteError(''); }}
                  className="w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light"
                />
                <span className="mt-1 block text-[11px] text-gray-400">An interview-prep task is added to the counselor’s Daily Tasks.</span>
              </label>
            )}
            <button
              onClick={handleUpdateStatusClick}
              disabled={!selectedAction || selectedAction.disabled || (selectedAction.kind === 'datetime' && !interviewAt)}
              className="w-full py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Update Status
            </button>
            {selectedAction?.disabled && selectedAction.disabledReason && (
              <p className="text-xs text-amber-600">{selectedAction.disabledReason}</p>
            )}
            {routeError && <p className="text-xs text-red-600">{routeError}</p>}
          </div>
        ) : (
          <p className="mt-2 pt-4 border-t border-grey-border text-xs text-gray-400">This case is complete — no further action needed.</p>
        )
      )}

      {showReEnroll && study && (
        <ApplyToInstitutionModal
          title={showReEnroll === 'while-refund' ? 'Enroll in a New Country or Course' : 'Re-enroll Client'}
          intro={showReEnroll === 'while-refund'
            ? 'The current case moves to Previous Enrolments with its refund still processing — you can mark the refund received there. Enter the new institution, course and country.'
            : 'The closed case is kept under Previous Enrolments. Enter the new institution, course and country to start again.'}
          submitLabel={showReEnroll === 'while-refund' ? 'Enroll' : 'Re-enroll'}
          onAdd={(o) => reEnroll(o, o.country ?? application.country)}
          onClose={() => setShowReEnroll(null)}
        />
      )}
      {showReEnroll && !study && (
        <ReEnrollCountryModal
          initialCountry={application.country}
          title={showReEnroll === 'while-refund' ? 'Enroll in a New Country' : 'Re-enroll Client'}
          intro={showReEnroll === 'while-refund'
            ? 'The current case moves to Previous Enrolments with its refund still processing — you can mark the refund received there. Choose the country for the new case.'
            : undefined}
          onConfirm={(c) => reEnroll(null, c)}
          onClose={() => setShowReEnroll(null)}
        />
      )}

      {showApplyModal && (
        <ApplyToInstitutionModal onAdd={handleAddOffer} onClose={() => setShowApplyModal(false)} />
      )}

      {refundModal && visa && (
        <RefundFollowUpModal
          title={refundModal === 'request' ? 'Request Refund' : 'Refund follow-up'}
          confirmLabel={refundModal === 'request' ? 'Request Refund' : 'Save follow-up'}
          initialDate={refundModal === 'reschedule' && !visa.refundFollowUpDone ? visa.refundFollowUpDate : undefined}
          initialNote={refundModal === 'reschedule' && !visa.refundFollowUpDone ? visa.refundFollowUpNote : undefined}
          onClose={() => setRefundModal(null)}
          onConfirm={(followUpDate, note) => {
            onUpdate({
              visaApplication: {
                ...visa,
                ...(refundModal === 'request' ? { refundRequested: true, refundRequestedDate: today() } : {}),
                refundFollowUpDate: followUpDate,
                refundFollowUpNote: note || undefined,
                refundFollowUpSetBy: currentUser.name,
                refundFollowUpDone: false,
                refundFollowUpDoneDate: undefined,
              },
            });
            setRefundModal(null);
          }}
        />
      )}

      {showFeePaidModal && feePaidCandidates.length > 0 && (
        <FeePaidModal
          offers={feePaidCandidates}
          onConfirm={(details) => {
            // Australia route: Fee Paid is a route step (it needs GS approved first and the
            // University Client ID); the visa file opens later, at CoE Received.
            if (route === 'Australia') { completeRouteStep('fee-paid', details.studentId); setShowFeePaidModal(false); return; }
            handleFeePaid(details);
          }}
          onClose={() => setShowFeePaidModal(false)}
        />
      )}

      {pendingAction && (
        <ConfirmDialog
          tone={pendingAction.kind === 'confirm-positive' ? 'positive' : 'negative'}
          title={`${pendingAction.label}?`}
          message={pendingAction.value === 'refund-close'
            ? `This records the refund as received and closes ${application.name}'s file. No further action can be taken on the case; its history is kept.`
            : "This updates the client's status and cannot be easily reversed."}
          confirmLabel={pendingAction.value === 'refund-close' ? 'Refund Received & Close' : undefined}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => performAction(pendingAction.value)}
        />
      )}
    </>
  );
}

// ─── Branch Staff Notes (bottom-right) ─────────────────────────────────────────

function BranchNotes({
  notes, canEdit, currentUser, onUpdate,
}: { notes: ClientNote[]; canEdit: boolean; currentUser: MockUser; onUpdate: (u: Partial<ApplicationRecord>) => void }) {
  const [draft, setDraft] = useState('');
  const feed = [...notes].reverse();

  const handleAddNote = () => {
    const text = draft.trim();
    if (!text) return;
    const newNote: ClientNote = {
      id: `note${Date.now()}`,
      text,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      createdAt: formatSubmittedAt(new Date()),
    };
    onUpdate({ notes: [...notes, newNote] });
    setDraft('');
  };

  return (
    <>
      {feed.length > 0 ? (
        <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
          {feed.map((n) => (
            <div key={n.id} className="border border-grey-border rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-sm font-semibold text-navy">{n.authorName}</span>
                <Badge className={ROLE_BADGE_STYLES[n.authorRole]}>{ROLE_LABELS[n.authorRole]}</Badge>
                <span className="text-xs text-gray-400 ml-auto">{n.createdAt}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{n.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-6 text-center">No notes yet.</p>
      )}

      {canEdit && (
        <div className="mt-4 pt-4 border-t border-grey-border space-y-2.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Add an internal note for other staff..."
            className="w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light"
          />
          <div className="flex justify-end">
            <button
              onClick={handleAddNote}
              disabled={!draft.trim()}
              className="px-4 py-2 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add Note
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Client Details (top, full width) ──────────────────────────────────────────

function ClientDetails({ application }: { application: ApplicationRecord }) {
  const detailRows = [
    { icon: IdCard,        label: 'Client ID',              value: clientIdFor(application) },
    { icon: Phone,         label: 'Phone',                  value: application.phone },
    { icon: Mail,          label: 'Email',                  value: application.email },
    { icon: MapPin,        label: 'Address',                value: application.address },
    { icon: Globe,         label: 'Country of Interest',    value: application.country },
    { icon: Target,        label: 'Purpose',                value: application.purpose },
    { icon: Cake,          label: 'Date of Birth',          value: application.dob },
    { icon: Users,         label: 'Gender',                 value: application.gender },
    { icon: Heart,         label: 'Marital Status',         value: application.maritalStatus },
    { icon: GraduationCap, label: 'Academic',               value: formatAcademic(application) },
    { icon: BookOpen,      label: 'IELTS / PTE',            value: application.ieltsPte },
    { icon: Briefcase,     label: 'Work Experience',        value: application.workExperience },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {detailRows.map((row) => {
        const Icon = row.icon;
        return (
          <div key={row.label} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-grey-bg flex items-center justify-center flex-shrink-0">
              <Icon className="text-navy" size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400">{row.label}</p>
              <p className={`text-sm font-medium truncate ${row.value ? 'text-navy' : 'text-gray-300'}`}>{row.value || '—'}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ClientProfile ───────────────────────────────────────────────────────

export default function ClientProfile({ application, currentUser, onClose, onUpdate }: ClientProfileProps) {
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const initials = application.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const statusLabel = getClientStatusLabel(application);
  const tone = getStatusTone(application);
  const canEdit = canEditClientProfile(currentUser.role);
  const canWithdraw = canWithdrawClient(currentUser.role);
  // Overview is the existing profile; Financials reads the branch finance ledger (read-only,
  // with request actions for the client's counselor).
  const [tab, setTab] = useState<'Overview' | 'Financials'>('Overview');

  return (
    <div className="fixed inset-y-0 left-0 right-0 lg:left-64 z-50 bg-grey-bg flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-grey-border px-5 py-4 flex items-center gap-3">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light transition-colors flex-shrink-0">
          <ArrowLeft size={18} />Back
        </button>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-navy">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy truncate">{application.name}</p>
            <p className="text-xs text-gray-400 truncate">{application.country} · {application.purpose}</p>
          </div>
        </div>
        <Badge className={STATUS_TONE_STYLES[tone]}>{statusLabel}</Badge>
        {canWithdraw && !application.withdrawn && (
          <button
            onClick={() => setConfirmWithdraw(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-grey-border hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <UserX size={14} />Mark as withdrawn
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white border-b border-grey-border px-5">
        <div className="max-w-6xl mx-auto flex gap-1" role="tablist" aria-label="Client profile">
          {(['Overview', 'Financials'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-navy-light'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {tab === 'Financials' ? (
          <div key="fin" className="dissolve-in max-w-6xl mx-auto">
            <ClientFinancials
              clientId={clientIdFor(application)}
              clientName={application.name}
              counselor={application.counselor}
              // The destination being processed (the chosen offer's country), else the first listed.
              country={(() => { const o = processingOfferOf(application); return o ? offerCountryName(application, o) : application.country.split(',')[0].trim(); })()}
              currentUser={currentUser}
            />
          </div>
        ) : (
        <div key="overview" className="dissolve-in max-w-6xl mx-auto space-y-5">

          {application.withdrawn && (
            <div className="bg-gray-100 border border-grey-border rounded-2xl px-5 py-4 flex items-center gap-3">
              <UserX className="text-gray-500 flex-shrink-0" size={18} />
              <p className="text-sm text-gray-600">
                {isClosedAfterRefund(application)
                  ? `This file was closed after the refund was received${application.withdrawnDate ? ` on ${application.withdrawnDate}` : ''}. Its history is preserved below.`
                  : `This client was marked as withdrawn${application.withdrawnDate ? ` on ${application.withdrawnDate}` : ''}. Their history is preserved below.`}
              </p>
            </div>
          )}

          {/* Top: Client Details — full width */}
          <SectionCard title="Client Details" icon={User}>
            <ClientDetails application={application} />
            {/* Consultation Notes row — the Communication Log sits last on the same row. */}
            <div className="mt-4 pt-4 border-t border-grey-border flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="min-w-0 flex-1">
                {application.consultationNotes && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-grey-bg flex items-center justify-center flex-shrink-0">
                        <FileText className="text-navy" size={15} />
                      </div>
                      <p className="text-xs text-gray-400">Consultation Notes</p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed pl-11">{application.consultationNotes}</p>
                  </>
                )}
              </div>
              <div className="flex-shrink-0 sm:self-start">
                <CommunicationLog clientKey={clientIdFor(application)} clientName={application.name} />
              </div>
            </div>
          </SectionCard>

          {/* Bottom: Status Tracker (left) + Branch Staff Notes (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4">
              <SectionCard title="Status Tracker" icon={ListChecks}>
                <StatusTracker application={application} canEdit={canEdit} currentUser={currentUser} onUpdate={onUpdate} />
              </SectionCard>
            </div>
            <div className="lg:col-span-8">
              <SectionCard title="Branch Staff Notes" icon={MessageSquare}>
                <BranchNotes notes={application.notes} canEdit={canEdit} currentUser={currentUser} onUpdate={onUpdate} />
              </SectionCard>
            </div>
          </div>

        </div>
        )}
      </div>

      {confirmWithdraw && (
        <ConfirmDialog
          tone="negative"
          title={`Mark ${application.name} as withdrawn?`}
          message="This is the only way a client exits the pipeline. Their history is kept, but no further action can be taken on their case."
          confirmLabel="Confirm"
          onCancel={() => setConfirmWithdraw(false)}
          onConfirm={() => { onUpdate({ withdrawn: true, withdrawnDate: today() }); setConfirmWithdraw(false); }}
        />
      )}
    </div>
  );
}
