import { useMemo, useState, useEffect } from 'react';
import {
  X, User, Phone, Mail, Globe, Target, Check, UserCheck,
  Users, Heart, GraduationCap, Languages, Briefcase, Cake,
} from 'lucide-react';
import { IntakeStudent, Counselor } from '../types';
import { AVAILABILITY_STYLES, sortByAvailability } from '../counselorStatus';

interface AssignCounselorModalProps {
  student: IntakeStudent;
  counselors: Counselor[];
  onClose: () => void;
  onConfirm: (counselorName: string) => void;
}

export default function AssignCounselorModal({
  student,
  counselors,
  onClose,
  onConfirm,
}: AssignCounselorModalProps) {
  const [selectedCounselor, setSelectedCounselor] = useState<string>(
    student.assignedCounselor || ''
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Country-of-interest match is a fit signal, not a restriction — matching counselors are
  // just sorted first and badged, never disabled or de-emphasized. Within each group,
  // available counselors sort before in-session/away ones.
  const { matching, others } = useMemo(() => {
    const isMatch = (c: Counselor) => c.countries.includes(student.country);
    return {
      matching: sortByAvailability(counselors.filter(isMatch)),
      others: sortByAvailability(counselors.filter((c) => !isMatch(c))),
    };
  }, [counselors, student.country]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const detailRows = [
    { icon: User, label: 'Name', value: student.name },
    { icon: Phone, label: 'Phone', value: student.phone },
    { icon: Mail, label: 'Email', value: student.email },
    { icon: Globe, label: 'Country', value: student.country },
    { icon: Target, label: 'Purpose', value: student.purpose },
    { icon: Cake, label: 'Date of Birth', value: student.dob },
    { icon: Users, label: 'Gender', value: student.gender },
    { icon: Heart, label: 'Marital Status', value: student.maritalStatus },
    { icon: GraduationCap, label: 'Academic Qualification', value: student.academicQualification },
    { icon: Languages, label: 'IELTS/PTE', value: student.ieltsPte },
    { icon: Briefcase, label: 'Work Experience', value: student.workExperience },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full sm:max-w-md bg-white border-l border-grey-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-grey-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <UserCheck className="text-navy" size={20} />
            <h2 className="text-base font-semibold text-navy">Assign to Counselor</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-navy transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Student details */}
          <div className="px-5 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Client Details
            </p>
            <div className="bg-grey-bg rounded-xl p-4 space-y-3">
              {detailRows.map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                      <Icon className="text-navy" size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">{row.label}</p>
                      <p className="text-sm font-medium text-navy truncate">{row.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Counselor selection */}
          <div className="px-5 pb-5">
            <label className="block text-sm font-medium text-navy mb-1.5">Select Counselor</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between pl-4 pr-3 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors bg-white"
              >
                <span className={selectedCounselor ? 'text-navy font-medium' : 'text-gray-400'}>
                  {selectedCounselor || 'Choose a counselor'}
                </span>
                <ChevronDownIcon open={dropdownOpen} />
              </button>
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute z-20 mt-1 w-full bg-white border border-grey-border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                    {matching.map((c) => (
                      <CounselorOption
                        key={c.id}
                        counselor={c}
                        selected={c.name === selectedCounselor}
                        isSpecialist
                        studentCountry={student.country}
                        onSelect={() => {
                          setSelectedCounselor(c.name);
                          setDropdownOpen(false);
                        }}
                      />
                    ))}
                    {matching.length > 0 && others.length > 0 && (
                      <p className="px-4 py-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide bg-grey-bg">
                        Other counselors
                      </p>
                    )}
                    {others.map((c) => (
                      <CounselorOption
                        key={c.id}
                        counselor={c}
                        selected={c.name === selectedCounselor}
                        isSpecialist={false}
                        studentCountry={student.country}
                        onSelect={() => {
                          setSelectedCounselor(c.name);
                          setDropdownOpen(false);
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 border-t border-grey-border px-5 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-grey-border rounded-lg text-sm font-medium text-navy hover:bg-grey-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => selectedCounselor && onConfirm(selectedCounselor)}
              disabled={!selectedCounselor}
              className="flex-1 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              Confirm Assignment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CounselorOptionProps {
  counselor: Counselor;
  selected: boolean;
  isSpecialist: boolean;
  studentCountry: string;
  onSelect: () => void;
}

// Consistent with the Counselor Status panel: name, country, availability badge, active
// student count. Selection uses a solid navy row background, so badges swap to a
// white-on-navy overlay treatment when selected rather than keeping their normal colors
// (a navy "In Session" badge, for instance, would otherwise disappear against the selected
// row's own navy background).
function CounselorOption({ counselor: c, selected, isSpecialist, studentCountry, onSelect }: CounselorOptionProps) {
  const overlayBadge = 'bg-white/20 text-white';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors text-left ${
        selected ? 'bg-navy text-white' : 'text-navy hover:bg-grey-bg'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-medium truncate">{c.name}</p>
          {isSpecialist && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${selected ? overlayBadge : 'bg-navy text-white'}`}>
              {studentCountry} specialist
            </span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${selected ? 'text-white/60' : 'text-gray-400'}`}>{c.countries.join(', ') || '—'}</p>
        <p className={`text-[11px] mt-1 ${selected ? 'text-white/60' : 'text-gray-400'}`}>{c.activeAssignments} assigned clients</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${selected ? overlayBadge : AVAILABILITY_STYLES[c.availability]}`}>
          {c.availability}
        </span>
        {selected && <Check size={16} />}
      </div>
    </button>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
