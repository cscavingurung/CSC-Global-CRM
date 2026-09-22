import { useState, type ReactNode } from 'react';
import {
  ArrowLeft, Check, X, ChevronDown,
  AlertTriangle, Building2, FileText, UserX,
  Phone, Mail, Globe, Target, User, Cake, IdCard,
  Users, Heart, GraduationCap, BookOpen, Briefcase,
  ListChecks, MessageSquare, Banknote, type LucideIcon,
} from 'lucide-react';
import {
  ApplicationRecord, OfferApplication, VisaApplication, Partner, MockUser, ClientNote, CustomChecklistItem,
} from '../types';
import {
  getActiveOfferApplication, isChecklistComplete, checklistCompleteCount, checklistTotalCount,
  getClientStatusLabel, getStatusTone, STATUS_TONE_STYLES, OFFER_STATUS_STYLES,
  pipelineStepsFor, getPipelineStep, canEditClientProfile, today, isStudyCase,
  emptyVisaChecklist, type PipelineStepKey,
} from '../clientPipeline';
import { clientIdFor } from '../clientId';
import { ROLE_LABELS, ROLE_BADGE_STYLES } from '../mockData';

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

// NOC was removed from the defaults — staff add anything extra as a custom item.
const CHECKLIST_ITEMS: { key: keyof VisaApplication['checklist']; label: string }[] = [
  { key: 'medical', label: 'Medical' },
  { key: 'financial', label: 'Financial Documents' },
  { key: 'policeReport', label: 'Police Report' },
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

// ─── Apply / Re-apply to Institution modal ─────────────────────────────────────
// Institution, program and intake are all free text — no fixed institution list, so any
// college or university can be entered.

function ApplyToInstitutionModal({
  onAdd, onClose,
}: { onAdd: (o: OfferApplication) => void; onClose: () => void }) {
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [intake, setIntake] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!institution.trim()) return;
    onAdd({
      id: `o${Date.now()}`,
      institution: institution.trim(),
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
      title="Apply to Institution"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!institution.trim()} className="flex-1 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Submit
          </button>
        </>
      }
    >
      <TextField label="Institution Name" value={institution} onChange={setInstitution} placeholder="e.g. Holmes Institute" required />
      <TextField label="Program" value={course} onChange={setCourse} placeholder="e.g. Master of Business Information Systems" />
      <TextField label="Intake" value={intake} onChange={setIntake} placeholder="e.g. Feb 2027" />
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
  institution: string;
  course: string;
  intake: string;
}

// The client may hold offers from several institutions — the fee is paid to exactly one of
// them, and that institution issues the Student ID shown on the visa queue.
function FeePaidModal({
  offers, onConfirm, onClose,
}: { offers: OfferApplication[]; onConfirm: (d: FeePaidDetails) => void; onClose: () => void }) {
  const [offerId, setOfferId] = useState(offers[0]?.id ?? '');
  const selected = offers.find((o) => o.id === offerId) ?? offers[0];
  const [studentId, setStudentId] = useState(selected?.studentId ?? '');
  const [institution, setInstitution] = useState(selected?.institution ?? '');
  const [course, setCourse] = useState(selected?.course ?? '');
  const [intake, setIntake] = useState(selected?.intake ?? '');

  const pickOffer = (id: string) => {
    const o = offers.find((x) => x.id === id);
    setOfferId(id);
    if (o) {
      setInstitution(o.institution ?? '');
      setCourse(o.course ?? '');
      setIntake(o.intake ?? '');
      setStudentId(o.studentId ?? '');
    }
  };

  const complete = [offerId, studentId, institution, course, intake].every((v) => v.trim().length > 0);

  return (
    <ModalShell
      title="Confirm Fee Paid"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors">Cancel</button>
          <button
            onClick={() => complete && onConfirm({ offerId, studentId: studentId.trim(), institution: institution.trim(), course: course.trim(), intake: intake.trim() })}
            disabled={!complete}
            className="flex-1 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Confirm Fee Paid
          </button>
        </>
      }
    >
      <p className="text-xs text-gray-500">All fields are required before this client moves into the visa stage.</p>
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
      <TextField label="Institution (College/University)" value={institution} onChange={setInstitution} required />
      <TextField label="Course" value={course} onChange={setCourse} placeholder="e.g. Bachelor of Nursing" required />
      <TextField label="Intake" value={intake} onChange={setIntake} placeholder="e.g. Feb 2027" required />
      <TextField label="Student ID (issued by institution)" value={studentId} onChange={setStudentId} placeholder="e.g. 100482991" required />
    </ModalShell>
  );
}

// ─── Status Tracker (bottom-left) ──────────────────────────────────────────────

type ActionKind = 'advance' | 'confirm-positive' | 'confirm-negative' | 'apply-modal' | 'reapply-modal' | 'refund' | 'fee-paid-modal';

interface StatusAction {
  value: string;
  label: string;
  kind: ActionKind;
  disabled?: boolean;
  disabledReason?: string;
}

function getAvailableActions(application: ApplicationRecord): StatusAction[] {
  const visa = application.visaApplication;
  const study = isStudyCase(application.purpose);
  if (visa) {
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
        const actions: StatusAction[] = [];
        if (!visa.refundRequested) actions.push({ value: 'refund', label: 'Request Refund', kind: 'refund' });
        actions.push({ value: 'reapply-docs', label: 'Re-apply (New Document Attempt)', kind: 'advance' });
        if (study) actions.push({ value: 'reapply', label: 'Re-apply to a New Institution', kind: 'reapply-modal' });
        return actions;
      }
      default:
        return [];
    }
  }

  // SOWP and Visit cases skip the offer stages entirely.
  if (!study) return [{ value: 'start-docs', label: 'Start Preparing Documents', kind: 'advance' }];

  const active = getActiveOfferApplication(application);
  if (!active) return [{ value: 'apply', label: 'Apply to Institution', kind: 'apply-modal' }];

  switch (active.status) {
    case 'Enrolled':
      return [{ value: 'applied', label: 'Mark Applied to Institution', kind: 'advance' }];
    case 'Applied to Institution':
      return [
        { value: 'further-info', label: 'Mark Further Information Required', kind: 'advance' },
        { value: 'offer-received', label: 'Mark Offer Received', kind: 'confirm-positive' },
        { value: 'offer-rejected', label: 'Mark Offer Rejected', kind: 'confirm-negative' },
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

function StatusTracker({
  application, canEdit, currentUser, onUpdate,
}: { application: ApplicationRecord; canEdit: boolean; currentUser: MockUser; onUpdate: (u: Partial<ApplicationRecord>) => void }) {
  const [selectedValue, setSelectedValue] = useState('');
  const [pendingAction, setPendingAction] = useState<StatusAction | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showFeePaidModal, setShowFeePaidModal] = useState(false);
  const [deferOfferId, setDeferOfferId] = useState<string | null>(null);
  const [deferValue, setDeferValue] = useState('');
  const [newItemLabel, setNewItemLabel] = useState('');

  const { index: stepIndex, negative } = getPipelineStep(application);
  const steps = pipelineStepsFor(application);
  const visa = application.visaApplication;
  const visaHistory = visa?.history ?? [];
  const visaAttemptCount = visa ? visaHistory.length + 1 : 0;
  const active = getActiveOfferApplication(application);
  const attempts = application.offerApplications;
  // Offers eligible for the fee payment — anything with an offer in hand, so a client
  // holding several can have the right institution picked.
  const feePaidCandidates = attempts.filter((o) => o.status === 'Offer Received' || o.status === 'Enrolled' || o.status === 'Applied to Institution' || o.status === 'Further Information Required');

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

  const actions = getAvailableActions(application);
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

  const performAction = (value: string) => {
    const date = today();
    switch (value) {
      case 'applied':
        if (active) updateOffer(active.id, { status: 'Applied to Institution', statusUpdatedAt: date, appliedDate: date });
        break;
      case 'further-info':
        if (active) updateOffer(active.id, { status: 'Further Information Required', statusUpdatedAt: date, furtherInfoRequired: true });
        break;
      case 'offer-received':
        if (active) updateOffer(active.id, { status: 'Offer Received', statusUpdatedAt: date, outcomeDate: date });
        break;
      case 'offer-rejected':
        if (active) updateOffer(active.id, { status: 'Rejected', statusUpdatedAt: date, outcomeDate: date });
        break;
      case 'fee-paid':
        if (active) {
          onUpdate({
            offerApplications: attempts.map((o) => (o.id === active.id ? { ...o, status: 'Fee Paid', statusUpdatedAt: date, feePaidDate: date } : o)),
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
      case 'refund':
        if (visa) onUpdate({ visaApplication: { ...visa, refundRequested: true, refundRequestedDate: date } });
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
      offerApplications: [...attempts, o],
      ...(resetVisa ? { visaApplication: newVisaAttempt(date, history) } : {}),
    });
    setShowApplyModal(false);
  };

  const handleUpdateStatusClick = () => {
    if (!selectedAction || selectedAction.disabled) return;
    if (selectedAction.kind === 'apply-modal' || selectedAction.kind === 'reapply-modal') { setShowApplyModal(true); return; }
    if (selectedAction.kind === 'fee-paid-modal') { setShowFeePaidModal(true); return; }
    if (selectedAction.kind === 'confirm-positive' || selectedAction.kind === 'confirm-negative') { setPendingAction(selectedAction); return; }
    performAction(selectedAction.value);
  };

  // Fee Paid closes out the offer attempt with its confirmed enrolment details and opens
  // the visa stage.
  const handleFeePaid = (details: FeePaidDetails) => {
    const date = today();
    onUpdate({
      offerApplications: attempts.map((o) => (o.id === details.offerId
        ? { ...o, status: 'Fee Paid' as const, statusUpdatedAt: date, feePaidDate: date, studentId: details.studentId, institution: details.institution, course: details.course, intake: details.intake }
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
      {/* Offer attempt history — institution, program and intake, with a deferrable intake */}
      {attempts.length > 0 && (
        <div className="mb-5 pb-5 border-b border-grey-border space-y-3">
          {[...attempts].reverse().map((o) => (
            <div key={o.id} className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <Building2 className="text-gray-400 flex-shrink-0" size={14} />
                <span className="text-sm text-navy truncate flex-1">{o.institution}</span>
                <Badge className={OFFER_STATUS_STYLES[o.status]}>{o.status}</Badge>
              </div>
              <div className="pl-6 space-y-1">
                {o.studentId && <p className="text-xs text-gray-500">Student ID: <span className="text-gray-700">{o.studentId}</span></p>}
                {o.clientRefId && <p className="text-xs text-gray-500">Reference: <span className="text-gray-700">{o.clientRefId}</span></p>}
                {o.course && <p className="text-xs text-gray-500">Course: <span className="text-gray-700">{o.course}</span></p>}
                {/* "Further Information Required" is now a pipeline status, shown in the badge above. */}
                {deferOfferId === o.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={deferValue}
                      onChange={(e) => setDeferValue(e.target.value)}
                      placeholder="New intake, e.g. Jul 2027"
                      className="flex-1 border border-grey-border rounded-lg px-2.5 py-1.5 text-xs text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light"
                    />
                    <button onClick={() => saveDeferredIntake(o.id)} disabled={!deferValue.trim()} className="px-2.5 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Save</button>
                    <button onClick={() => { setDeferOfferId(null); setDeferValue(''); }} className="px-2.5 py-1.5 rounded-lg border border-grey-border text-xs font-medium text-gray-500 hover:bg-grey-bg transition-colors">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">Intake: <span className="text-gray-700">{o.intake ?? 'Not set'}</span></p>
                    {canEdit && !application.withdrawn && (
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
          ))}
        </div>
      )}

      {/* Vertical stepper */}
      <div className="space-y-0">
        {(() => {
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
          const visaStepDate = (i: number, attempt: VisaApplication) => {
            switch (i) {
              case 0: return attempt.preparingDocsDate ?? (attempt.status === 'Preparing Documents' ? attempt.statusUpdatedAt : undefined);
              case 1: return attempt.fileReadyDate ?? (attempt.status === 'File Ready for Visa' ? attempt.statusUpdatedAt : undefined);
              case 2: return attempt.appliedDate;
              case 3: return attempt.outcomeDate;
              default: return undefined;
            }
          };

          if (!visa || visaAttemptCount <= 1) {
            return steps.map((step, i) => ({
              key: step.key,
              label: step.key === 'offer_outcome' && negative && i === stepIndex ? 'Offer Rejected'
                : step.key === 'visa_outcome' && negative && i === stepIndex ? 'Visa Refused'
                  : step.label,
              date: visaStepKeys.includes(step.key) && visa ? visaStepDate(visaStepKeys.indexOf(step.key), visa) : offerStepDate(step.key, active),
              // The final "Visa Approved" step stays on `stepIndex` forever once reached (there's
              // no later step to advance to), so it needs its own check to ever show dark-filled —
              // completing enrollment is what confirms the client's journey is actually finished.
              isDone: i < stepIndex || (i === stepIndex && step.key === 'visa_outcome' && !negative && !!visa?.enrollmentCompleted),
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
              date: offerStepDate(step.key, active),
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
                return {
                  key: `visa-${attemptIndex}-${i}`,
                  label: `${prefix}${terminalRefused ? 'Visa Refused' : baseLabel}`,
                  date: visaStepDate(i, attempt),
                  isDone: !activeAttempt || i < currentIndex || isFinalStepDone,
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
        })().map((step, i, displaySteps) => {
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
                  <p className={`text-sm font-medium ${isCurrentNegative ? 'text-red-600' : isDone || isCurrent ? 'text-navy' : 'text-gray-400'}`}>{step.label}</p>
                  {step.date && (
                    <span className={`text-xs flex-shrink-0 ${isCurrentNegative ? 'text-red-500' : isDone || isCurrent ? 'text-gray-500' : 'text-gray-300'}`}>{step.date}</span>
                  )}
                </div>
                {step.isChecklistStep && visa && (
                  <div className="mt-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Document checklist</span>
                      <span className={`text-xs font-semibold ${isChecklistComplete(visa) ? 'text-green-600' : 'text-gray-500'}`}>
                        {checklistCompleteCount(visa)} of {checklistTotalCount(visa)} complete
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {CHECKLIST_ITEMS.map((item) => (
                        <label key={item.key} className={`flex items-center gap-2.5 ${canEdit ? 'cursor-pointer group' : ''}`}>
                          <div
                            onClick={canEdit ? () => onUpdate({ visaApplication: { ...visa, checklist: { ...visa.checklist, [item.key]: !visa.checklist[item.key] } } }) : undefined}
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${visa.checklist[item.key] ? 'bg-green-500 border-green-500' : `border-gray-300 ${canEdit ? 'group-hover:border-navy-light' : ''}`}`}
                          >
                            {visa.checklist[item.key] && <Check className="text-white" size={10} />}
                          </div>
                          <span className={`text-sm ${visa.checklist[item.key] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.label}</span>
                        </label>
                      ))}
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
                          placeholder="Add a checklist item"
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
                {step.showRefund && (
                  <div className="mt-2"><Badge className="bg-gray-100 text-gray-600"><Banknote size={11} className="mr-1" />Refund Requested</Badge></div>
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
            <button
              onClick={handleUpdateStatusClick}
              disabled={!selectedAction || selectedAction.disabled}
              className="w-full py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Update Status
            </button>
            {selectedAction?.disabled && selectedAction.disabledReason && (
              <p className="text-xs text-amber-600">{selectedAction.disabledReason}</p>
            )}
          </div>
        ) : (
          <p className="mt-2 pt-4 border-t border-grey-border text-xs text-gray-400">This case is complete — no further action needed.</p>
        )
      )}

      {showApplyModal && (
        <ApplyToInstitutionModal onAdd={handleAddOffer} onClose={() => setShowApplyModal(false)} />
      )}

      {showFeePaidModal && feePaidCandidates.length > 0 && (
        <FeePaidModal offers={feePaidCandidates} onConfirm={handleFeePaid} onClose={() => setShowFeePaidModal(false)} />
      )}

      {pendingAction && (
        <ConfirmDialog
          tone={pendingAction.kind === 'confirm-positive' ? 'positive' : 'negative'}
          title={`${pendingAction.label}?`}
          message="This updates the client's status and cannot be easily reversed."
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
      createdAt: today(),
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
    { icon: Globe,         label: 'Country of Interest',    value: application.country },
    { icon: Target,        label: 'Purpose',                value: application.purpose },
    { icon: Cake,          label: 'Date of Birth',          value: application.dob },
    { icon: Users,         label: 'Gender',                 value: application.gender },
    { icon: Heart,         label: 'Marital Status',         value: application.maritalStatus },
    { icon: GraduationCap, label: 'Academic Qualification', value: application.academicQualification },
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
        {canEdit && !application.withdrawn && (
          <button
            onClick={() => setConfirmWithdraw(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-grey-border hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <UserX size={14} />Mark as withdrawn
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-6xl mx-auto space-y-5">

          {application.withdrawn && (
            <div className="bg-gray-100 border border-grey-border rounded-2xl px-5 py-4 flex items-center gap-3">
              <UserX className="text-gray-500 flex-shrink-0" size={18} />
              <p className="text-sm text-gray-600">
                This client was marked as withdrawn{application.withdrawnDate ? ` on ${application.withdrawnDate}` : ''}. Their history is preserved below.
              </p>
            </div>
          )}

          {/* Top: Client Details — full width */}
          <SectionCard title="Client Details" icon={User}>
            <ClientDetails application={application} />
            {application.consultationNotes && (
              <div className="mt-4 pt-4 border-t border-grey-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-grey-bg flex items-center justify-center flex-shrink-0">
                    <FileText className="text-navy" size={15} />
                  </div>
                  <p className="text-xs text-gray-400">Consultation Notes</p>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed pl-11">{application.consultationNotes}</p>
              </div>
            )}
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
