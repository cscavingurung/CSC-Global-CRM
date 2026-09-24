import { useState, useMemo } from 'react';
import { Search, X, Eye, CalendarDays, FileText, ChevronDown, LayoutGrid, Sheet } from 'lucide-react';
import { CounselorStudent, ApplicationRecord, MockUser, OfferStatus, Partner, VisaStageStatus } from '../types';
import StudentProfile from './StudentProfile';
import ClientProfile from './ClientProfile';
import { getActiveOfferApplication, OFFER_STATUS_STYLES, VISA_STATUS_STYLES, monthKey } from '../clientPipeline';
import { matchesDateRange } from '../dateFilter';
import CompactDateRangeFilter from './CompactDateRangeFilter';
import { clientIdFor } from '../clientId';

interface ConsultationsPageProps {
  students: CounselorStudent[];
  applications: ApplicationRecord[];
  partners: Partner[];
  currentUser: MockUser;
  onUpdateStudent: (id: string, updates: Partial<CounselorStudent>) => void;
  onUpdateApplication: (id: string, updates: Partial<ApplicationRecord>) => void;
}

type OfferFilter = 'all' | 'none' | OfferStatus;
type VisaFilter = 'all' | 'none' | VisaStageStatus;

const OFFER_FILTER_OPTIONS: { value: OfferFilter; label: string }[] = [
  { value: 'all', label: 'All Offer Statuses' },
  { value: 'none', label: 'No Application Yet' },
  { value: 'Enrolled', label: 'Enrolled' },
  { value: 'Applied to Institution', label: 'Applied to Institution' },
  { value: 'Offer Received', label: 'Offer Received' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Fee Paid', label: 'Fee Paid' },
];

const VISA_FILTER_OPTIONS: { value: VisaFilter; label: string }[] = [
  { value: 'all', label: 'All Visa Statuses' },
  { value: 'none', label: 'No Application Yet' },
  { value: 'Preparing Documents', label: 'Preparing Documents' },
  { value: 'File Ready for Visa', label: 'File Ready for Visa' },
  { value: 'Visa Applied', label: 'Visa Applied' },
  { value: 'Visa Approved', label: 'Visa Approved' },
  { value: 'Visa Refused', label: 'Visa Refused' },
];

type SortOption = 'enrolled-desc' | 'enrolled-asc' | 'name-asc' | 'name-desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'enrolled-desc', label: 'Sort: Newest Enrolled' },
  { value: 'enrolled-asc', label: 'Sort: Oldest Enrolled' },
  { value: 'name-asc', label: 'Sort: Name (A–Z)' },
  { value: 'name-desc', label: 'Sort: Name (Z–A)' },
];

function getOfferStatus(app: ApplicationRecord | undefined): 'none' | OfferStatus {
  const active = app ? getActiveOfferApplication(app) : null;
  return active ? active.status : 'none';
}

function getVisaStatus(app: ApplicationRecord | undefined): 'none' | VisaStageStatus {
  return app?.visaApplication ? app.visaApplication.status : 'none';
}

export default function ConsultationsPage({ students, applications, partners, currentUser, onUpdateStudent, onUpdateApplication }: ConsultationsPageProps) {
  const [search, setSearch] = useState('');
  const [enrolledMonth, setEnrolledMonth] = useState('all');
  const [offerFilter, setOfferFilter] = useState<OfferFilter>('all');
  const [visaFilter, setVisaFilter] = useState<VisaFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('enrolled-desc');
  const [viewMode, setViewMode] = useState<'simple' | 'sheet'>('simple');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewStudent, setViewStudent] = useState<CounselorStudent | null>(null);

  // A client's downstream application isn't linked by id (it's created fresh once
  // consultation completes), so clientId is the join key — handleUpdateCounselorStudent
  // always carries the CounselorStudent's clientId over onto the new ApplicationRecord.
  // Email is NOT safe to join on: two different clients can share an email (family/shared
  // inbox, copy-paste, test data), and a Map can only keep one entry per key — whichever
  // application loaded last would silently win for every client sharing that email.
  const applicationByClientId = useMemo(() => {
    const map = new Map<string, ApplicationRecord>();
    applications.forEach((a) => map.set(clientIdFor(a), a));
    return map;
  }, [applications]);

  const enrolledMonths = useMemo(() => {
    const months = new Set<string>();
    students.forEach((s) => {
      if (s.outcome !== 'Proceeding' || !s.completedDate) return;
      const parsed = new Date(s.completedDate);
      if (!isNaN(parsed.getTime())) months.add(monthKey(parsed));
    });
    return Array.from(months).sort().reverse();
  }, [students]);

  const monthLabel = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return value;
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  const isFiltering = !!(search || enrolledMonth !== 'all' || offerFilter !== 'all' || visaFilter !== 'all' || dateFrom || dateTo);

  const completed = useMemo(() => {
    return students
      .filter((s) => s.outcome === 'Proceeding')
      .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
      .filter((s) => {
        if (enrolledMonth === 'all') return true;
        if (!s.completedDate) return false;
        const parsed = new Date(s.completedDate);
        return !isNaN(parsed.getTime()) && monthKey(parsed) === enrolledMonth;
      })
      // Manual range works alongside the month dropdown, both on the enrolled date.
      .filter((s) => matchesDateRange(s.completedDate, dateFrom, dateTo))
      .filter((s) => offerFilter === 'all' || getOfferStatus(applicationByClientId.get(clientIdFor(s))) === offerFilter)
      .filter((s) => visaFilter === 'all' || getVisaStatus(applicationByClientId.get(clientIdFor(s))) === visaFilter)
      .sort((a, b) => {
        if (sortOption === 'name-asc') return a.name.localeCompare(b.name);
        if (sortOption === 'name-desc') return b.name.localeCompare(a.name);
        const aTime = a.completedDate ? new Date(a.completedDate).getTime() : 0;
        const bTime = b.completedDate ? new Date(b.completedDate).getTime() : 0;
        return sortOption === 'enrolled-asc' ? aTime - bTime : bTime - aTime;
      });
  }, [students, search, enrolledMonth, offerFilter, visaFilter, applicationByClientId, dateFrom, dateTo, sortOption]);

  const selectedApplication = viewStudent ? applicationByClientId.get(clientIdFor(viewStudent)) : undefined;

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
            placeholder="Search enrolled clients"
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
            value={enrolledMonth}
            onChange={(e) => setEnrolledMonth(e.target.value)}
            className="w-full sm:w-auto appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          >
            <option value="all">All Enrolled Months</option>
            {enrolledMonths.map((month) => (
              <option key={month} value={month}>{monthLabel(month)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
        <CompactDateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        <div className="relative">
          <select
            value={offerFilter}
            onChange={(e) => setOfferFilter(e.target.value as OfferFilter)}
            className="w-full sm:w-auto appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          >
            {OFFER_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
        <div className="relative">
          <select
            value={visaFilter}
            onChange={(e) => setVisaFilter(e.target.value as VisaFilter)}
            className="w-full sm:w-auto appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          >
            {VISA_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
        <div className="relative">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="w-full sm:w-auto appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FileText size={16} className="text-navy" />
          <span>{completed.length} enrolled client{completed.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="inline-flex rounded-lg border border-grey-border bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('simple')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'simple' ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
          >
            <LayoutGrid size={14} /> Simple View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('sheet')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'sheet' ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
          >
            <Sheet size={14} /> Excel View
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500 lg:hidden">
        <FileText size={16} className="text-navy" />
        <span>{completed.length} enrolled client{completed.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      {completed.length > 0 ? (
        viewMode === 'sheet' ? (
          <div className="hidden overflow-hidden rounded-xl border border-grey-border bg-white lg:block">
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-grey-bg">
                    {['#', 'Client ID', 'Client Name', 'Email', 'Phone', 'Case Type', 'Country', 'Enrolled Date', 'Intake', 'Added By', 'Offer Status', 'Visa Status', 'Profile'].map((h) => (
                      <th key={h} className="sticky top-0 border border-grey-border px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {completed.map((s, i) => {
                    const app = applicationByClientId.get(clientIdFor(s));
                    const offer = app ? getActiveOfferApplication(app) : null;
                    const offerStatus = getOfferStatus(app);
                    const visaStatus = getVisaStatus(app);
                    return (
                      <tr key={s.id} className="odd:bg-white even:bg-grey-bg/40 hover:bg-blue-50 transition-colors">
                        <td className="border border-grey-border px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="border border-grey-border px-3 py-2 text-gray-600">{clientIdFor(app ?? s)}</td>
                        <td className="border border-grey-border px-3 py-2 font-medium text-navy">{s.name}</td>
                        <td className="border border-grey-border px-3 py-2 text-gray-600">{s.email}</td>
                        <td className="border border-grey-border px-3 py-2 text-gray-600">{s.phone}</td>
                        <td className="border border-grey-border px-3 py-2 text-gray-600">{s.purpose}</td>
                        <td className="border border-grey-border px-3 py-2 text-gray-600">{s.country}</td>
                        <td className="border border-grey-border px-3 py-2 text-gray-500">{s.completedDate}</td>
                        <td className="border border-grey-border px-3 py-2 text-gray-600">{offer?.intake ?? s.enrolments?.[0]?.intake ?? '—'}</td>
                        <td className="border border-grey-border px-3 py-2 text-gray-600">{s.addedBy ?? app?.addedBy ?? '—'}</td>
                        <td className="border border-grey-border px-3 py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${offerStatus === 'none' ? 'bg-gray-100 text-gray-500' : OFFER_STATUS_STYLES[offerStatus]}`}>
                            {offerStatus === 'none' ? 'Not Started' : offerStatus}
                          </span>
                        </td>
                        <td className="border border-grey-border px-3 py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${visaStatus === 'none' ? 'bg-gray-100 text-gray-500' : VISA_STATUS_STYLES[visaStatus]}`}>
                            {visaStatus === 'none' ? 'Not Started' : visaStatus}
                          </span>
                        </td>
                        <td className="border border-grey-border px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setViewStudent(s)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy hover:text-navy-light transition-colors"
                          >
                            <Eye size={13} /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {completed.map((s) => {
              const app = applicationByClientId.get(clientIdFor(s));
              const offer = app ? getActiveOfferApplication(app) : null;
              const offerStatus = getOfferStatus(app);
              const visaStatus = getVisaStatus(app);
              return (
                <div
                  key={s.id}
                  className="bg-white rounded-xl border border-grey-border p-4 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                    <CalendarDays className="text-green-600" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-navy truncate">{s.name}</p>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-green-100 text-green-700">
                        Proceeding
                      </span>
                      {app?.withdrawn ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-gray-100 text-gray-500">
                          Withdrawn
                        </span>
                      ) : (
                        <>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${offerStatus === 'none' ? 'bg-gray-100 text-gray-500' : OFFER_STATUS_STYLES[offerStatus]}`}>
                            Offer: {offerStatus === 'none' ? 'Not Started' : offerStatus}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${visaStatus === 'none' ? 'bg-gray-100 text-gray-500' : VISA_STATUS_STYLES[visaStatus]}`}>
                            Visa: {visaStatus === 'none' ? 'Not Started' : visaStatus}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>Enrolled: {s.completedDate}</span>
                      <span className="text-gray-300">·</span>
                      <span>Intake: {offer?.intake ?? s.enrolments?.[0]?.intake ?? '—'}</span>
                      <span className="text-gray-300">·</span>
                      <span>Added By: {s.addedBy ?? app?.addedBy ?? '—'}</span>
                      <span className="text-gray-300">·</span>
                      <span className="truncate">{s.country} — {s.purpose}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewStudent(s)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light transition-colors flex-shrink-0"
                  >
                    <Eye size={15} />
                    <span className="hidden sm:inline">View Profile</span>
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : isFiltering ? (
        <div className="py-12 text-center text-sm text-gray-400">No consultations found.</div>
      ) : (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-navy/5 flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="text-navy/40" size={28} />
          </div>
          <p className="text-sm text-gray-400">No enrolled clients yet.</p>
        </div>
      )}

      {/* Detail drawer — the officer's Client Profile once an application record exists
          (always true for a Proceeding client), falling back to the consultation-only
          profile otherwise. */}
      {viewStudent && (
        selectedApplication ? (
          <ClientProfile
            application={selectedApplication}
            partners={partners}
            currentUser={currentUser}
            onClose={() => setViewStudent(null)}
            onUpdate={(updates) => onUpdateApplication(selectedApplication.id, updates)}
          />
        ) : (
          <StudentProfile
            student={viewStudent}
            applications={applications}
            onClose={() => setViewStudent(null)}
            onUpdate={(updates) => {
              onUpdateStudent(viewStudent.id, updates);
              setViewStudent({ ...viewStudent, ...updates });
            }}
          />
        )
      )}
    </div>
  );
}
