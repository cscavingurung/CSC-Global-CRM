import { useEffect } from 'react';
import {
  ArrowLeft, User, Phone, Mail, Globe, Target, CalendarDays, Lock, Calendar,
  Cake, Users, Heart, GraduationCap, Languages, Briefcase, Building2, UserX,
} from 'lucide-react';
import { ApplicationRecord, CounselorStudent, ConsultationStatus } from '../types';
import { OFFER_STATUS_STYLES, VISA_STATUS_STYLES, isVisaUnlocked, checklistCompleteCount, checklistTotalCount } from '../clientPipeline';

interface StudentProfileProps {
  student: CounselorStudent;
  /** When provided, shows a read-only "Application Progress" section for the matching
   * ApplicationRecord (joined by email) — the officer's offer/visa work on this client. */
  applications?: ApplicationRecord[];
  onClose: () => void;
  onUpdate: (updates: Partial<CounselorStudent>) => void;
}

const STATUS_STYLES: Record<ConsultationStatus, string> = {
  'Awaiting Consultation': 'bg-orange-100 text-orange-700 border-orange-200',
  'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
  'Follow Up': 'bg-purple-100 text-purple-700 border-purple-200',
  'Consultation Complete': 'bg-green-100 text-green-700 border-green-200',
};

export default function StudentProfile({ student, applications, onClose }: StudentProfileProps) {
  const status = student.consultationStatus;
  const outcome = student.outcome;
  const app = applications?.find((a) => a.email.trim().toLowerCase() === student.email.trim().toLowerCase());

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Same field set (and order) as the Leads intake form — see LeadIntakeForm.tsx.
  const detailRows = [
    { icon: Phone, label: 'Phone', value: student.phone },
    { icon: Mail, label: 'Email', value: student.email },
    { icon: Globe, label: 'Country of Interest', value: student.country },
    { icon: Target, label: 'Purpose', value: student.purpose },
    { icon: Cake, label: 'Date of Birth', value: student.dob },
    { icon: Users, label: 'Gender', value: student.gender },
    { icon: Heart, label: 'Marital Status', value: student.maritalStatus },
    { icon: GraduationCap, label: 'Academic Qualification', value: student.academicQualification },
    { icon: Languages, label: 'IELTS/PTE', value: student.ieltsPte },
    { icon: Briefcase, label: 'Work Experience', value: student.workExperience },
    { icon: CalendarDays, label: 'Submitted', value: student.submittedAt },
    { icon: CalendarDays, label: 'Assigned', value: student.assignedDate },
    ...(status === 'Follow Up'
      ? [{ icon: Calendar, label: 'Next Visit Date', value: student.followUpDate
            ? new Date(student.followUpDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'Not set' }]
      : []),
  ];

  const initials = student.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

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
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
          {/* Profile header + contact & application details */}
          <div className="bg-white rounded-2xl border border-grey-border p-6">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-16 h-16 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-semibold text-navy">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-navy truncate">{student.name}</h2>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>
                  {outcome !== 'Pending' && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                        outcome === 'Proceeding' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      <Lock size={11} />
                      {outcome}
                    </span>
                  )}
                  {student.followUpDate && status === 'Follow Up' && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">
                      <Calendar size={11} />
                      Returns {new Date(student.followUpDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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

          {/* Application progress — read-only, mirrors the officer's own view */}
          {app && (
            <>
              {app.withdrawn && (
                <div className="bg-gray-100 border border-grey-border rounded-2xl px-5 py-4 flex items-center gap-3">
                  <UserX className="text-gray-500 flex-shrink-0" size={18} />
                  <p className="text-sm text-gray-600">
                    This client was marked as withdrawn{app.withdrawnDate ? ` on ${app.withdrawnDate}` : ''}.
                  </p>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-grey-border p-6">
                <h3 className="text-sm font-semibold text-navy mb-4">Offer Application History</h3>
                {app.offerApplications.length === 0 ? (
                  <p className="text-sm text-gray-400">No offer applications yet.</p>
                ) : (
                  <div className="space-y-3">
                    {[...app.offerApplications].reverse().map((o) => (
                      <div key={o.id} className="flex items-center gap-3 border border-grey-border rounded-xl px-4 py-3">
                        <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="text-navy" size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-navy truncate">{o.institution}</p>
                          {o.appliedDate && <p className="text-xs text-gray-400">Applied {o.appliedDate}</p>}
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${OFFER_STATUS_STYLES[o.status]}`}>{o.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isVisaUnlocked(app) && (
                <div className="bg-white rounded-2xl border border-grey-border p-6">
                  <h3 className="text-sm font-semibold text-navy mb-4">Visa Application</h3>
                  {!app.visaApplication ? (
                    <p className="text-sm text-gray-400">Not started yet.</p>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${VISA_STATUS_STYLES[app.visaApplication.status]}`}>
                        {app.visaApplication.status}
                      </span>
                      <span className="text-xs text-gray-500">{checklistCompleteCount(app.visaApplication)} of {checklistTotalCount(app.visaApplication)} documents complete</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
