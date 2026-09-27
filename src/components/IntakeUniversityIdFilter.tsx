import { ChevronDown, X } from 'lucide-react';
import { INTAKE_MONTHS, generateIntakeYears } from '../mockData';

// Intake (month + year) and University Client ID filters, shared by every client / application list so they
// look and behave the same everywhere. The University Client ID is the one the institution issues, entered
// when the tuition fee is marked paid — it's what commission claims are matched on.

const INTAKE_YEARS = generateIntakeYears(5, 2);
const selectCls = 'w-full sm:w-auto appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors';

interface IntakeStudentIdFilterProps {
  intakeMonth: string;
  intakeYear: string;
  universityId: string;
  onIntakeMonth: (v: string) => void;
  onIntakeYear: (v: string) => void;
  onUniversityId: (v: string) => void;
  /** Hide the University Client ID box where no client can have one yet (e.g. before any fee is paid). */
  hideUniversityId?: boolean;
}

export default function IntakeUniversityIdFilter({
  intakeMonth, intakeYear, universityId, onIntakeMonth, onIntakeYear, onUniversityId, hideUniversityId,
}: IntakeStudentIdFilterProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="flex gap-2">
        <div className="relative flex-1 sm:flex-none">
          <select value={intakeMonth} onChange={(e) => onIntakeMonth(e.target.value)} aria-label="Intake month" className={`${selectCls} ${intakeMonth ? 'border-navy-light bg-navy/5' : ''}`}>
            <option value="">Intake: Any Month</option>
            {INTAKE_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
        <div className="relative flex-1 sm:flex-none">
          <select value={intakeYear} onChange={(e) => onIntakeYear(e.target.value)} aria-label="Intake year" className={`${selectCls} ${intakeYear ? 'border-navy-light bg-navy/5' : ''}`}>
            <option value="">Any Year</option>
            {INTAKE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
      </div>
      {!hideUniversityId && (
        <div className="relative">
          <input
            value={universityId}
            onChange={(e) => onUniversityId(e.target.value)}
            placeholder="University Client ID"
            aria-label="University Client ID issued by the institution"
            title="University Client ID issued by the institution (entered when the fee is marked paid)"
            className={`w-full sm:w-48 rounded-lg border px-3 py-2.5 pr-8 text-sm text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors ${universityId ? 'border-navy-light bg-navy/5' : 'border-grey-border bg-white'}`}
          />
          {universityId && (
            <button type="button" onClick={() => onUniversityId('')} aria-label="Clear University Client ID" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy">
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
