import { useEffect, useMemo, useState } from 'react';
import { appUniversityClientId, matchesUniversityClientId } from '../applicationFilters';
import { Search, X, ChevronDown, ChevronLeft, ChevronRight, Download, BadgeCheck, GraduationCap, Clock } from 'lucide-react';
import { ApplicationRecord, MockUser, NavIntent, Partner } from '../types';
import ClientProfile from './ClientProfile';
import { getActiveOfferApplication, getFeePaidOffer, isVisaApproved } from '../clientPipeline';
import { INTAKE_MONTHS, PURPOSES, splitCountries } from '../mockData';
import { clientIdFor } from '../clientId';
import { downloadSheet } from '../exportSheet';

interface VisaApprovedPageProps {
  /** The counselor's own applications — only visa-approved ones are shown. */
  applications: ApplicationRecord[];
  partners: Partner[];
  currentUser: MockUser;
  onUpdateApplication: (id: string, updates: Partial<ApplicationRecord>) => void;
  intent?: NavIntent;
}

type EnrollmentFilter = 'all' | 'completed' | 'pending';
type SortOption = 'approved-desc' | 'approved-asc' | 'name-asc' | 'name-desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'approved-desc', label: 'Sort: Newest Approval' },
  { value: 'approved-asc', label: 'Sort: Oldest Approval' },
  { value: 'name-asc', label: 'Sort: Name (A–Z)' },
  { value: 'name-desc', label: 'Sort: Name (Z–A)' },
];

const CASE_TYPE_STYLES: Record<string, string> = {
  Study: 'bg-blue-50 text-blue-700',
  SOWP: 'bg-teal-50 text-teal-700',
  Tourist: 'bg-amber-50 text-amber-700',
  PR: 'bg-purple-50 text-purple-700',
};

const PAGE_SIZE = 15;
const selectClass = 'w-full sm:w-auto appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

interface Row {
  app: ApplicationRecord;
  institution: string;
  program: string;
  /** "Feb 2027" — from the fee-paid offer (or the active one); empty for non-study cases. */
  intake: string;
  /** University Client ID issued by the institution (entered at Fee Paid) — for commission claims. */
  universityClientId: string;
  /** Destination countries — the fee-paid institution's country, else the client's stated countries. */
  countries: string[];
  approvedDate: string;
  enrollmentCompleted: boolean;
}

function formatDate(value: string): string {
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Select({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: React.ReactNode; label: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass} aria-label={label}>
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
    </div>
  );
}

/** Counselor's Visa Approved list — clients whose visa has been granted, with case-type / country / intake filters. */
export default function VisaApprovedPage({ applications, partners, currentUser, onUpdateApplication, intent }: VisaApprovedPageProps) {
  const [search, setSearch] = useState(intent?.search ?? '');
  const [caseType, setCaseType] = useState('all');
  const [country, setCountry] = useState('all');
  const [intakeMonth, setIntakeMonth] = useState('');
  const [intakeYear, setIntakeYear] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [enrollment, setEnrollment] = useState<EnrollmentFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('approved-desc');
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(
    () => applications.find((a) => a.id === intent?.openClientId) ?? null
  );
  const [page, setPage] = useState(1);

  // Withdrawn clients are out of the pipeline, so they're left off even if their visa was granted.
  const rows = useMemo<Row[]>(
    () =>
      applications
        .filter((a) => !a.withdrawn && isVisaApproved(a))
        .map((a) => {
          const offer = getFeePaidOffer(a) ?? getActiveOfferApplication(a);
          const visa = a.visaApplication!;
          return {
            app: a,
            institution: offer?.institution ?? '',
            program: offer?.course ?? '',
            intake: offer?.intake ?? '',
            universityClientId: appUniversityClientId(a),
            countries: offer?.country ? [offer.country] : splitCountries(a.country),
            approvedDate: visa.outcomeDate ?? visa.statusUpdatedAt,
            enrollmentCompleted: !!visa.enrollmentCompleted,
          };
        }),
    [applications]
  );

  // Filter options come from the approved clients themselves; case types always include the
  // standard purposes so "Study / SOWP / Tourist / PR" are selectable even before data exists.
  const caseTypes = useMemo(
    () => Array.from(new Set([...PURPOSES, ...rows.map((r) => r.app.purpose).filter(Boolean)])),
    [rows]
  );
  const countries = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.countries))).sort(), [rows]);
  const intakeYears = useMemo(
    () => Array.from(new Set(rows.map((r) => r.intake.split(' ')[1]).filter(Boolean))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        const [month, year] = r.intake.split(' ');
        return (
          (!term || r.app.name.toLowerCase().includes(term) || clientIdFor(r.app).toLowerCase().includes(term) || r.institution.toLowerCase().includes(term) || r.universityClientId.toLowerCase().includes(term))
          && (caseType === 'all' || r.app.purpose === caseType)
          && (country === 'all' || r.countries.includes(country))
          // Any intake filter excludes clients with no intake (e.g. Tourist / SOWP cases).
          && (!intakeMonth || month === intakeMonth)
          && (!intakeYear || year === intakeYear)
          && matchesUniversityClientId(r.universityClientId, universityId)
          && (enrollment === 'all' || (enrollment === 'completed') === r.enrollmentCompleted)
        );
      })
      .sort((a, b) => {
        if (sortOption === 'name-asc') return a.app.name.localeCompare(b.app.name);
        if (sortOption === 'name-desc') return b.app.name.localeCompare(a.app.name);
        const cmp = a.approvedDate.localeCompare(b.approvedDate);
        return sortOption === 'approved-asc' ? cmp : -cmp;
      });
  }, [rows, search, caseType, country, intakeMonth, intakeYear, universityId, enrollment, sortOption]);

  useEffect(() => {
    setPage(1);
  }, [search, caseType, country, intakeMonth, intakeYear, universityId, enrollment, sortOption]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filtersActive = !!search || caseType !== 'all' || country !== 'all' || !!intakeMonth || !!intakeYear || !!universityId || enrollment !== 'all';
  const clearFilters = () => {
    setSearch('');
    setCaseType('all');
    setCountry('all');
    setIntakeMonth('');
    setIntakeYear('');
    setUniversityId('');
    setEnrollment('all');
  };

  const completedCount = rows.filter((r) => r.enrollmentCompleted).length;

  const handleExport = () =>
    downloadSheet(
      `visa-approved-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Client ID', 'Client Name', 'Case Type', 'Country', 'Institution', 'Program', 'Intake', 'University Client ID', 'Visa Approved', 'Enrollment'],
      filtered.map((r) => [
        clientIdFor(r.app), r.app.name, r.app.purpose, r.countries.join(', '), r.institution, r.program, r.intake, r.universityClientId,
        r.approvedDate, r.enrollmentCompleted ? 'Completed' : 'Pending',
      ])
    );

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: BadgeCheck, label: 'Visas Approved', value: rows.length, filter: 'all' as EnrollmentFilter },
          { icon: GraduationCap, label: 'Enrollment Completed', value: completedCount, filter: 'completed' as EnrollmentFilter },
          { icon: Clock, label: 'Awaiting Enrollment', value: rows.length - completedCount, filter: 'pending' as EnrollmentFilter },
        ].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setEnrollment(s.filter)}
            aria-pressed={enrollment === s.filter}
            className={`text-left bg-white rounded-xl border p-5 transition-colors hover:border-navy-light ${enrollment === s.filter ? 'border-navy' : 'border-grey-border'}`}
          >
            <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center mb-3"><s.icon className="text-navy" size={20} /></div>
            <p className="text-2xl font-bold text-navy">{s.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, Client ID or institution"
            className="w-full pl-10 pr-9 py-2.5 border border-grey-border rounded-lg text-sm bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy" aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>
        <Select value={caseType} onChange={setCaseType} label="Case type">
          <option value="all">All Case Types</option>
          {caseTypes.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={country} onChange={setCountry} label="Country">
          <option value="all">All Countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={intakeMonth} onChange={setIntakeMonth} label="Intake month">
          <option value="">Any Intake Month</option>
          {INTAKE_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select value={intakeYear} onChange={setIntakeYear} label="Intake year">
          <option value="">Any Intake Year</option>
          {intakeYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <input
          value={universityId}
          onChange={(e) => setUniversityId(e.target.value)}
          placeholder="University Client ID"
          aria-label="University Client ID issued by the institution"
          title="University Client ID issued by the institution (entered when the fee is marked paid)"
          className={`w-full sm:w-48 rounded-lg border px-3 py-2.5 text-sm text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light ${universityId ? 'border-navy-light bg-navy/5' : 'border-grey-border bg-white'}`}
        />
        <Select value={sortOption} onChange={(v) => setSortOption(v as SortOption)} label="Sort">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <button
          type="button"
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-grey-border bg-white px-4 py-2.5 text-sm font-medium text-navy hover:bg-grey-bg disabled:opacity-40"
        >
          <Download size={16} /> Export
        </button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-gray-500"><span className="font-semibold text-navy">{filtered.length}</span> of {rows.length} approved client{rows.length === 1 ? '' : 's'}</p>
        {filtersActive && <button onClick={clearFilters} className="text-sm font-medium text-navy-light hover:text-navy">Clear filters</button>}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-grey-border py-14 text-center">
          <p className="text-sm text-gray-500">
            {rows.length === 0 ? 'No clients with an approved visa yet.' : 'No approved clients match these filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-grey-border overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-grey-border bg-grey-bg">
                  {['Client', 'Case Type', 'Country', 'Institution / Program', 'Intake', 'University Client ID', 'Visa Approved', 'Enrollment'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-5 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.app.id} onClick={() => setSelectedApp(r.app)} className="border-b border-grey-border last:border-0 cursor-pointer hover:bg-grey-bg transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-navy">{r.app.name}</p>
                      <p className="text-xs text-gray-400">{clientIdFor(r.app)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${CASE_TYPE_STYLES[r.app.purpose] ?? 'bg-gray-100 text-gray-600'}`}>{r.app.purpose}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{r.countries.join(', ') || '—'}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-navy">{r.institution || '—'}</p>
                      {r.program && <p className="text-xs text-gray-400">{r.program}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{r.intake || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{r.universityClientId || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{formatDate(r.approvedDate)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${r.enrollmentCompleted ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {r.enrollmentCompleted ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-grey-border">
            {paginated.map((r) => (
              <button key={r.app.id} type="button" onClick={() => setSelectedApp(r.app)} className="w-full text-left p-4 hover:bg-grey-bg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy truncate">{r.app.name}</p>
                    <p className="text-xs text-gray-500 truncate">{r.institution || r.countries.join(', ')}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${CASE_TYPE_STYLES[r.app.purpose] ?? 'bg-gray-100 text-gray-600'}`}>{r.app.purpose}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Approved {formatDate(r.approvedDate)}{r.intake ? ` · ${r.intake} intake` : ''}{r.universityClientId ? ` · University Client ID ${r.universityClientId}` : ''} · Enrollment {r.enrollmentCompleted ? 'completed' : 'pending'}
                </p>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-3 border-t border-grey-border">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-navy hover:bg-grey-bg disabled:opacity-30" aria-label="Previous page">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-gray-500 font-medium">{currentPage} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-navy hover:bg-grey-bg disabled:opacity-30" aria-label="Next page">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {selectedApp && (
        <ClientProfile
          application={selectedApp}
          partners={partners}
          currentUser={currentUser}
          onClose={() => setSelectedApp(null)}
          onUpdate={(updates) => {
            onUpdateApplication(selectedApp.id, updates);
            setSelectedApp({ ...selectedApp, ...updates });
          }}
        />
      )}
    </div>
  );
}
