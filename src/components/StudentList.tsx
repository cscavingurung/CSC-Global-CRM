import { useState, useMemo } from 'react';
import { Search, X, UserCheck, ChevronDown, LayoutGrid, Sheet } from 'lucide-react';
import { Counselor, CounselorStudent, IntakeStudent } from '../types';
import { dateKey } from '../dateTime';
import AssignCounselorModal from './AssignCounselorModal';
import CompactDateRangeFilter from './CompactDateRangeFilter';
import { matchesDateRange } from '../dateFilter';

interface StudentListProps {
  students: IntakeStudent[];
  counselors: Counselor[];
  counselorStudents?: CounselorStudent[];
  onAssign: (studentId: string, counselorName: string) => void;
  branches?: string[];
  showBranchFilter?: boolean;
}

type StatusFilter = 'all' | 'New' | 'Assigned' | 'Enrolled' | 'Followup' | 'Archive';

const CONSULTATION_STATUS_STYLES: Record<string, string> = {
  'Awaiting Consultation': 'bg-orange-100 text-orange-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Follow Up': 'bg-teal-100 text-teal-700',
  'Consultation Complete': 'bg-green-100 text-green-700',
};

export default function StudentList({ students, counselors, counselorStudents = [], onAssign, branches, showBranchFilter }: StudentListProps) {
  const csMap = useMemo(() => new Map(counselorStudents.map((cs) => [cs.id, cs])), [counselorStudents]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [assignStudent, setAssignStudent] = useState<IntakeStudent | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'sheet'>('sheet');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const today = dateKey(new Date());

  // Beyond the intake's own New/Assigned state, the later stages come from the client's
  // counselor record: proceeding = enrolled, follow up = followup, not proceeding = archived.
  const stageOf = (s: IntakeStudent): StatusFilter => {
    const cs = csMap.get(s.id);
    if (!cs) return s.status;
    if (cs.outcome === 'Not Proceeding') return 'Archive';
    if (cs.outcome === 'Proceeding') return 'Enrolled';
    if (cs.consultationStatus === 'Follow Up') return 'Followup';
    return s.status;
  };

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.phone.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || stageOf(s) === statusFilter;
      const matchesBranch = !showBranchFilter || branchFilter === 'all' || s.branch === branchFilter;
      const visit = csMap.get(s.id)?.visitDateTime ?? s.visitDateTime ?? s.submittedAt;
      const matchesDate = matchesDateRange(visit, dateFrom, dateTo);
      return matchesSearch && matchesStatus && matchesBranch && matchesDate;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, search, statusFilter, branchFilter, showBranchFilter, dateFrom, dateTo, csMap]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'New', label: 'New' },
    { value: 'Assigned', label: 'Assigned' },
    { value: 'Enrolled', label: 'Enrolled' },
    { value: 'Followup', label: 'Followup' },
    { value: 'Archive', label: 'Archive' },
  ];

  return (
    <div className="space-y-5">
      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or phone"
            className="w-full pl-10 pr-4 py-2.5 border border-grey-border rounded-lg text-sm bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full sm:w-auto appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
        {showBranchFilter && branches && (
          <div className="relative">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        )}

        {/* Date-wise: Today shortcut or a full date range */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const isToday = dateFrom === today && dateTo === today;
              setDateFrom(isToday ? '' : today);
              setDateTo(isToday ? '' : today);
            }}
            aria-pressed={dateFrom === today && dateTo === today}
            className={`rounded-lg border border-grey-border px-3 py-2.5 text-sm font-medium ${
              dateFrom === today && dateTo === today ? 'bg-navy text-white' : 'bg-white text-navy hover:bg-navy/5'
            }`}
          >
            Today
          </button>
          <CompactDateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        </div>
      </div>

      {/* View toggle */}
      <div className="hidden lg:flex items-center justify-between">
        <p className="text-xs text-gray-400">{filtered.length} client{filtered.length === 1 ? '' : 's'}</p>
        <div className="inline-flex rounded-lg border border-grey-border bg-white p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
          >
            <LayoutGrid size={14} /> Simple
          </button>
          <button
            onClick={() => setViewMode('sheet')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'sheet' ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
          >
            <Sheet size={14} /> Excel sheet
          </button>
        </div>
      </div>

      {/* Excel-style sheet — desktop */}
      {viewMode === 'sheet' && (
        <div className="hidden lg:block bg-white rounded-xl border border-grey-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-grey-bg">
                  {['#', 'Name', 'Email', 'Phone', 'Visit Date and Time', 'Date of Birth', 'Gender', 'Marital Status', 'Qualification', 'IELTS / PTE', 'Work Experience', 'Country', 'Purpose', 'Submitted', 'Branch', 'Status', 'Counselor'].map((h) => (
                    <th key={h} className="sticky top-0 text-left font-semibold text-gray-500 px-3 py-2 border border-grey-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const cs = csMap.get(s.id);
                  const statusLabel = cs?.consultationStatus || s.status;
                  return (
                    <tr key={s.id} className="odd:bg-white even:bg-grey-bg/40 hover:bg-blue-50 transition-colors">
                      <td className="px-3 py-2 border border-grey-border text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 border border-grey-border font-medium text-navy">{s.name}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.email}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.phone}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{cs?.visitDateTime ?? s.visitDateTime ?? s.submittedAt}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.dob}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.gender}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.maritalStatus}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.academicQualification}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.ieltsPte}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.workExperience}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.country}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.purpose}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-500">{s.submittedAt}</td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.branch}</td>
                      <td className="px-3 py-2 border border-grey-border">
                        <span className={`font-medium px-2 py-0.5 rounded-full ${CONSULTATION_STATUS_STYLES[statusLabel] || (statusLabel === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700')}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 border border-grey-border text-gray-600">{s.assignedCounselor || <span className="text-gray-300">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No clients found.</div>
          )}
        </div>
      )}

      {/* Table — desktop */}
      {viewMode === 'table' && (
      <div className="hidden lg:block bg-white rounded-xl border border-grey-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-grey-border bg-grey-bg">
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Name</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Phone</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Visit Date and Time</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Country</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Purpose</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Submitted</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Status</th>
              {showBranchFilter && <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Branch</th>}
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Counselor</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const cs = csMap.get(s.id);
              const consultationStatus = cs?.consultationStatus;
              const canReassign = !consultationStatus || consultationStatus === 'Awaiting Consultation';
              return (
              <tr key={s.id} className="border-b border-grey-border last:border-0 hover:bg-grey-bg/50 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="text-sm font-medium text-navy">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{s.phone}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{cs?.visitDateTime ?? s.visitDateTime ?? s.submittedAt}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{s.country}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{s.purpose}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{s.submittedAt}</td>
                <td className="px-5 py-3.5">
                  {consultationStatus ? (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CONSULTATION_STATUS_STYLES[consultationStatus]}`}>
                      {consultationStatus}
                    </span>
                  ) : (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      s.status === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {s.status}
                    </span>
                  )}
                </td>
                {showBranchFilter && <td className="px-5 py-3.5 text-sm text-gray-600">{s.branch}</td>}
                <td className="px-5 py-3.5 text-sm text-gray-600">
                  {s.assignedCounselor || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {s.status === 'New' ? (
                    <button
                      onClick={() => setAssignStudent(s)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light transition-colors"
                    >
                      <UserCheck size={15} />
                      Assign
                    </button>
                  ) : canReassign ? (
                    <button
                      onClick={() => setAssignStudent(s)}
                      className="text-sm text-gray-400 hover:text-navy transition-colors"
                    >
                      Reassign
                    </button>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No clients found.</div>
        )}
      </div>
      )}

      {/* Card list — mobile */}
      <div className="lg:hidden space-y-3">
        {filtered.map((s) => {
          const cs = csMap.get(s.id);
          const consultationStatus = cs?.consultationStatus;
          const canReassign = !consultationStatus || consultationStatus === 'Awaiting Consultation';
          return (
          <div key={s.id} className="bg-white rounded-xl border border-grey-border p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">{s.name}</p>
                <p className="text-xs text-gray-400">{s.email}</p>
              </div>
              {consultationStatus ? (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${CONSULTATION_STATUS_STYLES[consultationStatus]}`}>
                  {consultationStatus}
                </span>
              ) : (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${
                  s.status === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                  {s.status}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
              <p>Phone: <span className="text-gray-700">{s.phone}</span></p>
              <p>Visit: <span className="text-gray-700">{cs?.visitDateTime ?? s.visitDateTime ?? s.submittedAt}</span></p>
              <p>Country: <span className="text-gray-700">{s.country}</span></p>
              <p>Purpose: <span className="text-gray-700">{s.purpose}</span></p>
              <p>Submitted: <span className="text-gray-700">{s.submittedAt}</span></p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-grey-border">
              <p className="text-xs text-gray-500">
                {s.assignedCounselor ? `Counselor: ${s.assignedCounselor}` : 'No counselor assigned'}
              </p>
              {s.status === 'New' || canReassign ? (
                <button
                  onClick={() => setAssignStudent(s)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light transition-colors"
                >
                  <UserCheck size={15} />
                  {s.status === 'New' ? 'Assign' : 'Reassign'}
                </button>
              ) : null}
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No clients found.</div>
        )}
      </div>

      {/* Assign modal */}
      {assignStudent && (
        <AssignCounselorModal
          student={assignStudent}
          counselors={counselors}
          onClose={() => setAssignStudent(null)}
          onConfirm={(counselorName) => {
            onAssign(assignStudent.id, counselorName);
            setAssignStudent(null);
          }}
        />
      )}
    </div>
  );
}
