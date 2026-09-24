import { useState, useEffect } from 'react';
import {
  ArrowLeft, User, Phone, Mail, MapPin, Globe, Target, CalendarDays,
  Send, CheckCircle, XCircle, Lock, Calendar,
  Cake, Users, Heart, GraduationCap, Languages, Briefcase,
} from 'lucide-react';
import { CounselorStudent, ConsultationStatus, ConsultationOutcome, EnrolmentChoice, LeadTemperature } from '../types';
import { LEAD_TEMPERATURES, LEAD_TEMPERATURE_HINTS, LEAD_TEMPERATURE_STYLES } from '../leadTemperature';
import { isStudyCase, formatAcademic } from '../clientPipeline';
import { clientIdFor } from '../clientId';
import { COUNTRIES, INTAKE_MONTHS, generateIntakeYears } from '../mockData';

const INTAKE_YEARS = generateIntakeYears();

interface StudentDetailDrawerProps {
  student: CounselorStudent;
  onClose: () => void;
  onUpdate: (updates: Partial<CounselorStudent>) => void;
}

const STATUS_OPTIONS: ConsultationStatus[] = ['Awaiting Consultation', 'In Progress', 'Follow Up', 'Consultation Complete'];

const STATUS_STYLES: Record<ConsultationStatus, string> = {
  'Awaiting Consultation': 'bg-orange-50 text-orange-700 border-orange-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  'Follow Up': 'bg-teal-50 text-teal-700 border-teal-200',
  'Consultation Complete': 'bg-green-50 text-green-700 border-green-200',
};

// Study clients need their target institutions captured as they move to Enrolled — a client
// can apply to several at once, and each one becomes its own offer application. Exported so
// the Follow Up / Archive profile (StudentProfile) can reuse it for the same outcome flow.
export function EnrolmentModal({
  onConfirm, onClose,
}: { onConfirm: (rows: EnrolmentChoice[]) => void; onClose: () => void }) {
  const [rows, setRows] = useState<EnrolmentChoice[]>([{ institution: '', country: '', program: '', intake: '' }]);

  const update = (i: number, field: keyof EnrolmentChoice, value: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const complete = rows.every((r) => {
    const [intakeMonth, intakeYear] = r.intake.split(' ');
    return r.institution.trim() && r.country.trim() && r.program.trim() && !!intakeMonth && !!intakeYear;
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-grey-border bg-white p-5">
        <h3 className="text-base font-semibold text-navy">Enrolment Details</h3>
        <p className="mt-1 text-xs text-gray-500">Add every university this client is applying to. Each one becomes its own application.</p>
        <div className="mt-4 space-y-4">
          {rows.map((row, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-grey-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Application {i + 1}</span>
                {rows.length > 1 && (
                  <button onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs font-semibold text-gray-400 hover:text-red-500">Remove</button>
                )}
              </div>
              <input
                type="text" value={row.institution} onChange={(e) => update(i, 'institution', e.target.value)}
                placeholder="University / College"
                className="w-full rounded-lg border border-grey-border px-3 py-2 text-sm text-navy focus:border-navy-light focus:outline-none"
              />
              <select
                value={row.country} onChange={(e) => update(i, 'country', e.target.value)}
                className="w-full appearance-none rounded-lg border border-grey-border bg-white px-3 py-2 text-sm text-navy focus:border-navy-light focus:outline-none"
              >
                <option value="" disabled>Select a country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text" value={row.program} onChange={(e) => update(i, 'program', e.target.value)}
                placeholder="Program"
                className="w-full rounded-lg border border-grey-border px-3 py-2 text-sm text-navy focus:border-navy-light focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const [intakeMonth = '', intakeYear = ''] = row.intake.split(' ');
                  return (
                    <>
                      <select
                        value={intakeMonth}
                        onChange={(e) => update(i, 'intake', `${e.target.value} ${intakeYear}`.trim())}
                        className="w-full appearance-none rounded-lg border border-grey-border bg-white px-3 py-2 text-sm text-navy focus:border-navy-light focus:outline-none"
                      >
                        <option value="" disabled>Month</option>
                        {INTAKE_MONTHS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={intakeYear}
                        onChange={(e) => update(i, 'intake', `${intakeMonth} ${e.target.value}`.trim())}
                        className="w-full appearance-none rounded-lg border border-grey-border bg-white px-3 py-2 text-sm text-navy focus:border-navy-light focus:outline-none"
                      >
                        <option value="" disabled>Year</option>
                        {INTAKE_YEARS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setRows((prev) => [...prev, { institution: '', country: '', program: '', intake: '' }])}
          className="mt-3 text-xs font-semibold text-navy hover:text-navy-light"
        >
          + Add another university
        </button>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
          <button
            onClick={() => complete && onConfirm(rows.map((r) => ({ institution: r.institution.trim(), country: r.country, program: r.program.trim(), intake: r.intake.trim() })))}
            disabled={!complete}
            className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm Enrolment
          </button>
        </div>
      </div>
    </div>
  );
}


export default function StudentDetailDrawer({ student, onClose, onUpdate }: StudentDetailDrawerProps) {
  const [status, setStatus] = useState<ConsultationStatus>(student.consultationStatus);
  const [outcome, setOutcome] = useState<ConsultationOutcome>(student.outcome);
  const followUpDate = student.followUpDate ?? '';
  const [inputDate, setInputDate] = useState(student.followUpDate ?? '');
  const [temperature, setTemperature] = useState<LeadTemperature | ''>(student.leadTemperature ?? '');
  const [followUpNote, setFollowUpNote] = useState(student.followUpNote ?? '');
  const [showEnrolmentModal, setShowEnrolmentModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ConsultationStatus | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Once a client has had a follow-up, they can only move forward to Consultation Complete —
  // not back to In Progress/Awaiting Consultation. And once Consultation Complete, the status
  // is final and can't be changed at all (mirrors the outcome lock below).
  const isStatusLocked = status === 'Consultation Complete';
  const isStatusOptionDisabled = (opt: ConsultationStatus) => {
    if (isStatusLocked) return opt !== status;
    if (status === 'Follow Up') return opt !== 'Follow Up' && opt !== 'Consultation Complete';
    return false;
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleStatusChange = (newStatus: ConsultationStatus) => {
    setStatus(newStatus);
    const updates: Partial<CounselorStudent> = { consultationStatus: newStatus };
    if (newStatus === 'Consultation Complete' && !student.completedDate) {
      updates.completedDate = new Date().toISOString().split('T')[0];
    }
    onUpdate(updates);
  };

  // Marking a client Consultation Complete locks the status for good, so confirm it first
  // rather than applying it straight from the button click.
  const requestStatusChange = (newStatus: ConsultationStatus) => {
    if (isStatusOptionDisabled(newStatus) || newStatus === status) return;
    if (newStatus === 'Consultation Complete') {
      setPendingStatus(newStatus);
      return;
    }
    handleStatusChange(newStatus);
  };

  const confirmPendingStatus = () => {
    if (!pendingStatus) return;
    handleStatusChange(pendingStatus);
    setPendingStatus(null);
  };

  const handleConfirmFollowUp = () => {
    if (!inputDate || !temperature || !followUpNote.trim()) return;
    onUpdate({ followUpDate: inputDate, leadTemperature: temperature, followUpNote: followUpNote.trim() });
    setToastMessage('Follow-up confirmed');
    setShowToast(true);
    setTimeout(() => onClose(), 1000);
  };

  const handleOutcomeChange = (newOutcome: ConsultationOutcome) => {
    // Proceeding is final — the client is already downstream in the application pipeline.
    // Not Proceeding (archived) can still be reopened later if the client comes back, but
    // only forward into Proceeding, never back-and-forth.
    if (outcome === 'Proceeding') return;
    if (outcome === 'Not Proceeding' && newOutcome !== 'Proceeding') return;
    // Study cases collect their university/program/intake choices first.
    if (newOutcome === 'Proceeding' && isStudyCase(student.purpose)) {
      setShowEnrolmentModal(true);
      return;
    }
    setOutcome(newOutcome);
    onUpdate({ outcome: newOutcome });
    setToastMessage(newOutcome === 'Proceeding' ? 'Sent to V/A Officer' : 'Marked as not proceeding');
    setShowToast(true);
    setTimeout(() => onClose(), 1000);
  };

  const handleConfirmEnrolment = (rows: EnrolmentChoice[]) => {
    setShowEnrolmentModal(false);
    setOutcome('Proceeding');
    onUpdate({ outcome: 'Proceeding', enrolments: rows });
    setToastMessage('Sent to V/A Officer');
    setShowToast(true);
    setTimeout(() => onClose(), 1000);
  };

  const initials = student.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const detailRows = [
    { icon: Phone, label: 'Phone', value: student.phone },
    { icon: Mail, label: 'Email', value: student.email },
    { icon: MapPin, label: 'Address', value: student.address },
    { icon: Globe, label: 'Country of Interest', value: student.country },
    { icon: Target, label: 'Purpose', value: student.purpose },
    { icon: Cake, label: 'Date of Birth', value: student.dob },
    { icon: Users, label: 'Gender', value: student.gender },
    { icon: Heart, label: 'Marital Status', value: student.maritalStatus },
    { icon: GraduationCap, label: 'Academic', value: formatAcademic(student) },
    { icon: Languages, label: 'IELTS/PTE', value: student.ieltsPte },
    { icon: Briefcase, label: 'Work Experience', value: student.workExperience },
    { icon: CalendarDays, label: 'Submitted', value: student.submittedAt },
    { icon: CalendarDays, label: 'Assigned', value: student.assignedDate },
  ];

  return (
    <div className="fixed inset-y-0 left-0 right-0 lg:left-64 z-50 bg-grey-bg flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-grey-border px-5 py-4 flex items-center gap-3">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light transition-colors"
        >
          <ArrowLeft size={18} />
          Back
        </button>
        <span className="text-gray-300">|</span>
        <h1 className="text-base font-semibold text-navy">Client Profile</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">

          {/* Profile header + contact details */}
          <div className="bg-white rounded-2xl border border-grey-border p-6">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-16 h-16 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-semibold text-navy">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-navy truncate">{student.name}</h2>
                <p className="text-xs text-gray-400">Client ID: {clientIdFor(student)}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>
                  {outcome !== 'Pending' && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                      outcome === 'Proceeding' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      <Lock size={11} />
                      {outcome}
                    </span>
                  )}
                  {followUpDate && status === 'Follow Up' && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-teal-50 text-teal-700">
                      <Calendar size={11} />
                      Returns {new Date(followUpDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {student.leadTemperature && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${LEAD_TEMPERATURE_STYLES[student.leadTemperature]}`}>
                      {student.leadTemperature} lead
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-grey-border">
              <div className="flex items-center gap-2 mb-4">
                <User className="text-navy" size={17} />
                <h3 className="text-sm font-semibold text-navy">Contact & Application Details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {detailRows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-grey-bg flex items-center justify-center flex-shrink-0">
                        <Icon className="text-navy" size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400">{row.label}</p>
                        <p className="text-sm font-medium text-navy truncate">{row.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Consultation status */}
          <div className="bg-white rounded-2xl border border-grey-border p-6">
            <h3 className="text-sm font-semibold text-navy mb-4">Consultation Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const disabled = isStatusOptionDisabled(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={disabled}
                    onClick={() => requestStatusChange(opt)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      status === opt ? STATUS_STYLES[opt] : 'border-grey-border text-gray-500 hover:bg-grey-bg'
                    } ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === opt ? 'bg-current' : 'bg-gray-300'}`} />
                    <span className="truncate">{opt}</span>
                    {status === opt && <CheckCircle className="ml-auto flex-shrink-0" size={15} />}
                  </button>
                );
              })}
            </div>
            {isStatusLocked && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                <Lock size={12} />
                Consultation is complete — status is final and can't be changed.
              </p>
            )}
            {!isStatusLocked && status === 'Follow Up' && (
              <p className="mt-3 text-xs text-gray-400">
                Once a follow-up is set, the client can only move forward to Consultation Complete.
              </p>
            )}
          </div>

          {/* Follow-up scheduling — shown when status is Follow Up */}
          {status === 'Follow Up' && (
            <div className="bg-white rounded-2xl border border-grey-border p-6">
              <h3 className="text-sm font-semibold text-navy mb-4">Next Visit Date</h3>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                <input
                  type="date"
                  value={inputDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setInputDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full pl-10 pr-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
                />
              </div>
              {inputDate && (
                <p className="text-xs text-teal-700 mt-2">
                  Client returning on {new Date(inputDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}

              {/* Lead temperature — required before a follow-up can be confirmed */}
              <div className="mt-5">
                <p className="text-sm font-semibold text-navy">Lead Temperature <span className="text-red-600">*</span></p>
                <p className="text-xs text-gray-400 mt-0.5 mb-3">How likely is this client to move forward?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {LEAD_TEMPERATURES.map((temp) => (
                    <button
                      key={temp}
                      type="button"
                      aria-pressed={temperature === temp}
                      onClick={() => setTemperature(temp)}
                      className={`text-left px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        temperature === temp ? LEAD_TEMPERATURE_STYLES[temp] : 'border-grey-border text-gray-500 hover:bg-grey-bg'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${temperature === temp ? 'bg-current' : 'bg-gray-300'}`} />
                        {temp}
                      </span>
                      <span className="block text-xs mt-0.5 opacity-70">{LEAD_TEMPERATURE_HINTS[temp]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Follow-up note — required before a follow-up can be confirmed */}
              <div className="mt-5">
                <p className="text-sm font-semibold text-navy">Follow-up Note <span className="text-red-600">*</span></p>
                <p className="mt-0.5 mb-2 text-xs text-gray-400">What should be picked up at the next visit?</p>
                <textarea
                  required
                  rows={3}
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  placeholder="e.g. Client comparing two colleges — bring updated fee sheets."
                  className="w-full rounded-lg border border-grey-border px-3.5 py-2.5 text-sm text-navy placeholder:text-gray-400 focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
                />
              </div>

              <button
                type="button"
                onClick={handleConfirmFollowUp}
                disabled={
                  !inputDate ||
                  !temperature ||
                  !followUpNote.trim() ||
                  (inputDate === followUpDate &&
                    temperature === student.leadTemperature &&
                    followUpNote.trim() === (student.followUpNote ?? ''))
                }
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 enabled:cursor-pointer"
              >
                <CheckCircle size={15} />
                Confirm Follow Up
              </button>
              {(!temperature || !followUpNote.trim()) && (
                <p className="mt-2 text-center text-xs text-gray-400">
                  Pick a lead temperature and add a follow-up note to confirm.
                </p>
              )}
            </div>
          )}

          {/* Outcome decision — shown when Consultation Complete */}
          {status === 'Consultation Complete' && (
            <div className="bg-white rounded-2xl border border-grey-border p-6">
              <h3 className="text-sm font-semibold text-navy mb-4">Will the client proceed?</h3>
              {outcome === 'Pending' ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleOutcomeChange('Proceeding')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors border-grey-border text-gray-500 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                  >
                    <Send size={15} />
                    Proceeding
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOutcomeChange('Not Proceeding')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors border-grey-border text-gray-500 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                  >
                    <XCircle size={15} />
                    Not Proceeding
                  </button>
                </div>
              ) : (
                <>
                  <div className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-medium ${
                    outcome === 'Proceeding'
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-red-100 text-red-700 border-red-200'
                  }`}>
                    {outcome === 'Proceeding' ? <Send size={15} /> : <XCircle size={15} />}
                    {outcome}
                    <Lock size={13} className="ml-auto opacity-60" />
                  </div>
                  {/* Not Proceeding is the only reversible outcome — a client can come back later */}
                  {outcome === 'Not Proceeding' && (
                    <button
                      type="button"
                      onClick={() => handleOutcomeChange('Proceeding')}
                      className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-grey-border text-sm font-medium text-gray-500 transition-colors hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                    >
                      <Send size={15} />
                      Reopen — Mark as Proceeding
                    </button>
                  )}
                </>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {outcome === 'Pending' && 'No decision made yet.'}
                {outcome === 'Proceeding' && 'Sent to V/A Officer. This decision is final and can\'t be changed.'}
                {outcome === 'Not Proceeding' && 'Client will not be moving forward — but can still be reopened if they come back.'}
              </p>
            </div>
          )}

        </div>
      </div>

      {showEnrolmentModal && (
        <EnrolmentModal onConfirm={handleConfirmEnrolment} onClose={() => setShowEnrolmentModal(false)} />
      )}

      {pendingStatus && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-grey-border bg-white p-5">
            <h3 className="text-base font-semibold text-navy">Mark Consultation Complete?</h3>
            <p className="mt-2 text-sm text-gray-500">
              This locks the client's status for good — it can't be moved back or changed afterward.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setPendingStatus(null)}
                className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPendingStatus}
                className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-sm font-medium">
          <CheckCircle size={18} />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
