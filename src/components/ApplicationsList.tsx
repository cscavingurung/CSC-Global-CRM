import { useState, useMemo } from 'react';
import { Check, Search, X, ChevronDown, ChevronUp, ExternalLink, LayoutGrid, Sheet } from 'lucide-react';
import { ApplicationRecord, MockUser, OfferApplication, Partner, VisaStageStatus } from '../types';
import ClientProfile from './ClientProfile';
import StatusUpdatesKanban from './StatusUpdatesKanban';
import CompactDateRangeFilter from './CompactDateRangeFilter';
import { matchesDateRange } from '../dateFilter';
import {
  getClientStage, getClientStatusLabel, getStatusTone, STATUS_TONE_STYLES, ClientStage,
  OFFER_STATUS_STYLES, getFeePaidOffer, isStudyCase,
} from '../clientPipeline';
import { clientIdFor } from '../clientId';

interface ApplicationsListProps {
  applications: ApplicationRecord[];
  onUpdateApplication: (id: string, updates: Partial<ApplicationRecord>) => void;
  partners: Partner[];
  currentUser: MockUser;
  branches?: string[];
  showBranchFilter?: boolean;
  /** Restricts the list to one stage (Offer/Visa) and hides the stage filter + column —
   * used when this list is reached via a stage-specific sidebar item rather than the
   * combined view. Withdrawn clients still show up under whichever stage they were in. */
  stageScope?: ClientStage;
  /** Offer queue only — hides offers still sitting at "Enrolled" (they live on the
   * V/A Officer's Enrolled staging tab until the application is actually submitted). */
  excludePendingOffers?: boolean;
}

type StageFilter = 'all' | ClientStage | 'Withdrawn';

const STAGE_FILTER_OPTIONS: { value: StageFilter; label: string }[] = [
  { value: 'all', label: 'All Stages' },
  { value: 'Offer', label: 'Offer Stage' },
  { value: 'Visa', label: 'Visa Stage' },
  { value: 'Withdrawn', label: 'Withdrawn' },
];

// Offer queue filter — grouped by where the offer letter itself stands.
type OfferFilter = 'all' | 'pending' | 'further-info' | 'received' | 'decided';

const OFFER_FILTER_OPTIONS: { value: OfferFilter; label: string }[] = [
  { value: 'all', label: 'All Offer Statuses' },
  { value: 'pending', label: 'Offer Letter Pending' },
  { value: 'further-info', label: 'Further Information Required' },
  { value: 'received', label: 'Offer Letter Received' },
  { value: 'decided', label: 'Other/Decided' },
];

function matchesOfferFilter(offer: OfferApplication | null, filter: OfferFilter): boolean {
  if (filter === 'all') return true;
  if (!offer) return filter === 'pending';
  if (filter === 'pending') return offer.status === 'Enrolled' || offer.status === 'Applied to Institution';
  if (filter === 'further-info') return offer.status === 'Further Information Required';
  if (filter === 'received') return offer.status === 'Offer Received';
  return offer.status === 'Fee Paid' || offer.status === 'Rejected';
}

// Soft-tinted case type pill — Study / SOWP / Visit and anything else the branch records.
const CASE_TYPE_STYLES: Record<string, string> = {
  Study: 'bg-blue-50 text-blue-700',
  SOWP: 'bg-teal-50 text-teal-700',
  Visit: 'bg-amber-50 text-amber-700',
};

function CaseTypeBadge({ purpose }: { purpose: string }) {
  const tone = CASE_TYPE_STYLES[purpose] ?? (isStudyCase(purpose) ? CASE_TYPE_STYLES.Study : 'bg-gray-100 text-gray-600');
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${tone}`}>{purpose}</span>;
}

type SortKey = 'date' | 'name' | 'institution' | 'country';
type VisaStatusFilter = 'Pending' | 'Applied' | 'Approved' | 'Refused';
type ViewMode = 'simple' | 'sheet' | 'kanban';

const VISA_STATUS_FILTER_OPTIONS: VisaStatusFilter[] = ['Pending', 'Applied', 'Approved', 'Refused'];

function visaStatusBucket(status: VisaStageStatus | undefined): VisaStatusFilter {
  if (status === 'Visa Applied') return 'Applied';
  if (status === 'Visa Approved') return 'Approved';
  if (status === 'Visa Refused') return 'Refused';
  return 'Pending';
}

interface Row {
  key: string;
  app: ApplicationRecord;
  /** The specific offer attempt this row represents — Offer queue only. */
  offer: OfferApplication | null;
}

export default function ApplicationsList({ applications, onUpdateApplication, branches, showBranchFilter, partners, currentUser, stageScope, excludePendingOffers }: ApplicationsListProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [offerFilter, setOfferFilter] = useState<OfferFilter>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [visaStatusFilter, setVisaStatusFilter] = useState<VisaStatusFilter[]>([]);
  const [visaStatusOpen, setVisaStatusOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);

  const isOfferQueue = stageScope === 'Offer';
  const isVisaQueue = stageScope === 'Visa';

  const rows = useMemo(() => {
    const matching = applications.filter((a) => {
      const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
      const matchesCaseType = !isOfferQueue || isStudyCase(a.purpose);
      const matchesScope = !stageScope || isOfferQueue || getClientStage(a) === stageScope;
      const matchesVisaStatus = !isVisaQueue || visaStatusFilter.length === 0 || visaStatusFilter.includes(visaStatusBucket(a.visaApplication?.status));
      const matchesStage =
        stageScope !== undefined ||
        stageFilter === 'all' ||
        (stageFilter === 'Withdrawn' ? a.withdrawn : !a.withdrawn && getClientStage(a) === stageFilter);
      const matchesBranch = !showBranchFilter || branchFilter === 'all' || a.branch === branchFilter;
      const matchesDate = matchesDateRange(a.consultationDate, dateFrom, dateTo);
      return matchesSearch && matchesCaseType && matchesScope && matchesVisaStatus && matchesStage && matchesBranch && matchesDate;
    });

    // On the Offer queue a client applying to three institutions shows as three rows.
    const built: Row[] = [];
    matching.forEach((a) => {
      if (isOfferQueue) {
        if (a.offerApplications.length === 0) {
          if (!excludePendingOffers && matchesOfferFilter(null, offerFilter)) built.push({ key: a.id, app: a, offer: null });
          return;
        }
        a.offerApplications.forEach((o) => {
          if (excludePendingOffers && o.status === 'Enrolled') return;
          if (matchesOfferFilter(o, offerFilter)) built.push({ key: `${a.id}-${o.id}`, app: a, offer: o });
        });
      } else {
        built.push({ key: a.id, app: a, offer: null });
      }
    });

    const dir = sortAsc ? 1 : -1;
    return built.sort((x, y) => {
      const left = sortKey === 'name' ? x.app.name
        : sortKey === 'country' ? x.app.country
          : sortKey === 'institution' ? (x.offer?.institution ?? '')
            : x.app.consultationDate;
      const right = sortKey === 'name' ? y.app.name
        : sortKey === 'country' ? y.app.country
          : sortKey === 'institution' ? (y.offer?.institution ?? '')
            : y.app.consultationDate;
      return left.localeCompare(right) * dir;
    });
  }, [applications, search, stageScope, stageFilter, offerFilter, branchFilter, showBranchFilter, dateFrom, dateTo, isOfferQueue, isVisaQueue, excludePendingOffers, visaStatusFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(key !== 'date'); }
  };

  const toggleVisaStatus = (status: VisaStatusFilter) => {
    setVisaStatusFilter((current) => (current.includes(status) ? current.filter((item) => item !== status) : [...current, status]));
  };

  const visaStatusLabel = visaStatusFilter.length === 0 ? 'All Visa Statuses' : `${visaStatusFilter.length} Visa Status${visaStatusFilter.length === 1 ? '' : 'es'}`;

  const SortHeader = ({ label, sortBy }: { label: string; sortBy: SortKey }) => (
    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">
      <button onClick={() => toggleSort(sortBy)} className="inline-flex items-center gap-1 hover:text-navy transition-colors">
        {label}
        {sortKey === sortBy && (sortAsc ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      {/* Search & filter bar — hidden in Status Updates (kanban) view, which shows every
          client on its own boards rather than a filtered list. */}
      {viewMode !== 'kanban' && (
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
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

        {!stageScope && (
          <div className="relative">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as StageFilter)}
              className="w-full sm:w-auto appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light transition-colors"
            >
              {STAGE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        )}
        {isOfferQueue && (
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
        )}
        {isVisaQueue && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setVisaStatusOpen((value) => !value)}
              className={`inline-flex min-h-[42px] w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:w-[190px] ${
                visaStatusFilter.length > 0 ? 'border-navy-light bg-navy/5 text-navy' : 'border-grey-border bg-white text-gray-500 hover:border-navy-light/60 hover:text-navy'
              }`}
            >
              <span>{visaStatusLabel}</span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>
            {visaStatusOpen && (
              <>
                <button type="button" aria-label="Close visa status filter" className="fixed inset-0 z-20 cursor-default" onClick={() => setVisaStatusOpen(false)} />
                <div className="absolute right-0 z-30 mt-2 w-52 rounded-lg border border-grey-border bg-white p-2">
                  {VISA_STATUS_FILTER_OPTIONS.map((status) => {
                    const active = visaStatusFilter.includes(status);
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => toggleVisaStatus(status)}
                        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${active ? 'bg-navy/5 text-navy' : 'text-gray-600 hover:bg-grey-bg hover:text-navy'}`}
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${active ? 'border-navy bg-navy text-white' : 'border-grey-border bg-white'}`}>
                          {active && <Check size={11} />}
                        </span>
                        {status}
                      </button>
                    );
                  })}
                  {visaStatusFilter.length > 0 && (
                    <button type="button" onClick={() => setVisaStatusFilter([])} className="mt-1 w-full rounded-md border-t border-grey-border px-2.5 py-2 text-left text-xs font-semibold text-navy hover:bg-grey-bg">
                      Clear filter
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
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
        <CompactDateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
      </div>
      )}

      {(isOfferQueue || isVisaQueue) && (
        <div className="hidden lg:flex items-center justify-between">
          <p className="text-xs text-gray-400">{viewMode === 'kanban' ? 'Status Updates' : `${rows.length} application${rows.length === 1 ? '' : 's'}`}</p>
          <div className="inline-flex rounded-lg border border-grey-border bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('simple')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'simple' ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
            >
              <LayoutGrid size={14} />
              Simple View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sheet')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'sheet' ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
            >
              <Sheet size={14} />
              Excel View
            </button>
            {currentUser.role === 'application_officer' && (
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'kanban' ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
              >
                Status Updates
              </button>
            )}
          </div>
        </div>
      )}

      {(isOfferQueue || isVisaQueue) && viewMode === 'sheet' && (
        <div className="hidden overflow-x-auto rounded-lg border border-grey-border bg-white lg:block">
          <table className="w-full min-w-[1180px] border-collapse whitespace-nowrap text-left">
            <thead className="bg-grey-bg">
              <tr>
                {[
                  '#', 'Client ID', 'Client Name', 'Email', 'Country', 'Case Type',
                  ...(isOfferQueue ? ['Institution', 'Program Name', 'Intake'] : ['Student ID']),
                  'Counselor', 'Submission Date', ...(showBranchFilter ? ['Branch'] : []), 'Status',
                ].map((header) => (
                  <th key={header} className="border border-grey-border px-3 py-2 text-xs font-semibold text-gray-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, app: a, offer }, index) => {
                const feePaid = getFeePaidOffer(a);
                return (
                  <tr key={key} onClick={() => setSelectedApp(a)} className="cursor-pointer odd:bg-white even:bg-grey-bg/40 hover:bg-blue-50">
                    <td className="border border-grey-border px-3 py-2 text-xs text-gray-400">{index + 1}</td>
                    <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{clientIdFor(a)}</td>
                    <td className="border border-grey-border px-3 py-2 text-sm font-medium text-navy">{a.name}</td>
                    <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{a.email}</td>
                    <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{a.country}</td>
                    <td className="border border-grey-border px-3 py-2"><CaseTypeBadge purpose={a.purpose} /></td>
                    {isOfferQueue && <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{offer?.institution ?? '—'}</td>}
                    {isOfferQueue && <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{offer?.course ?? '—'}</td>}
                    {isOfferQueue && <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{offer?.intake ?? '—'}</td>}
                    {isVisaQueue && <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{feePaid?.studentId ?? '—'}</td>}
                    <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{a.counselor}</td>
                    <td className="border border-grey-border px-3 py-2 text-sm text-gray-500">{a.consultationDate}</td>
                    {showBranchFilter && <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{a.branch}</td>}
                    <td className="border border-grey-border px-3 py-2">
                      {isOfferQueue && offer && !a.withdrawn ? (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${OFFER_STATUS_STYLES[offer.status]}`}>{offer.status}</span>
                      ) : (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE_STYLES[getStatusTone(a)]}`}>{getClientStatusLabel(a)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No applications found.</div>}
        </div>
      )}

      {/* Table — desktop */}
      <div className={`${(isOfferQueue || isVisaQueue) && viewMode !== 'simple' ? 'hidden' : 'hidden lg:block'} bg-white rounded-xl border border-grey-border overflow-x-auto`}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-grey-border bg-grey-bg">
              <SortHeader label="Client Name" sortBy="name" />
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Client ID</th>
              <SortHeader label="Country" sortBy="country" />
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Case Type</th>
              {isOfferQueue && <SortHeader label="Institution" sortBy="institution" />}
              {isOfferQueue && <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Program Name</th>}
              {isOfferQueue && <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Intake</th>}
              {isVisaQueue && <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Student ID</th>}
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Counselor</th>
              <SortHeader label="Submission Date" sortBy="date" />
              {showBranchFilter && <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Branch</th>}
              {!stageScope && <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Stage</th>}
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Status</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">Profile</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, app: a, offer }) => {
              const feePaid = getFeePaidOffer(a);
              return (
                <tr
                  key={key}
                  onClick={() => setSelectedApp(a)}
                  className="border-b border-grey-border last:border-0 hover:bg-grey-bg/50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-navy">{a.name}</p>
                    <p className="text-xs text-gray-400">{a.email}</p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{clientIdFor(a)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{a.country}</td>
                  <td className="px-5 py-3.5"><CaseTypeBadge purpose={a.purpose} /></td>
                  {isOfferQueue && (
                    <td className="px-5 py-3.5 text-sm text-gray-600">{offer?.institution ?? '—'}</td>
                  )}
                  {isOfferQueue && <td className="px-5 py-3.5 text-sm text-gray-600">{offer?.course ?? '—'}</td>}
                  {isOfferQueue && <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{offer?.intake ?? '—'}</td>}
                  {isVisaQueue && (
                    <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{feePaid?.studentId ?? '—'}</td>
                  )}
                  <td className="px-5 py-3.5 text-sm text-gray-600">{a.counselor}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{a.consultationDate}</td>
                  {showBranchFilter && <td className="px-5 py-3.5 text-sm text-gray-600">{a.branch}</td>}
                  {!stageScope && <td className="px-5 py-3.5 text-sm text-gray-600">{a.withdrawn ? '—' : getClientStage(a)}</td>}
                  <td className="px-5 py-3.5">
                    {isOfferQueue && offer && !a.withdrawn ? (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${OFFER_STATUS_STYLES[offer.status]}`}>{offer.status}</span>
                    ) : (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_TONE_STYLES[getStatusTone(a)]}`}>
                        {getClientStatusLabel(a)}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedApp(a); }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy border border-grey-border rounded-lg px-2.5 py-1.5 hover:bg-grey-bg transition-colors whitespace-nowrap"
                    >
                      <ExternalLink size={13} />
                      View Client Profile
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No applications found.</div>
        )}
      </div>

      {/* Card list — mobile */}
      {viewMode !== 'kanban' && (
      <div className="lg:hidden space-y-3">
        {rows.map(({ key, app: a, offer }) => (
          <div key={key} className="bg-white rounded-xl border border-grey-border p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">{a.name}</p>
                <p className="text-xs text-gray-400">{clientIdFor(a)}</p>
              </div>
              {isOfferQueue && offer && !a.withdrawn ? (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${OFFER_STATUS_STYLES[offer.status]}`}>{offer.status}</span>
              ) : (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${STATUS_TONE_STYLES[getStatusTone(a)]}`}>
                  {getClientStatusLabel(a)}
                </span>
              )}
            </div>
            <div className="mb-2"><CaseTypeBadge purpose={a.purpose} /></div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
              <p>Country: <span className="text-gray-700">{a.country}</span></p>
              <p>Counselor: <span className="text-gray-700">{a.counselor}</span></p>
              <p>Submitted: <span className="text-gray-700">{a.consultationDate}</span></p>
              {isOfferQueue && <p>Institution: <span className="text-gray-700">{offer?.institution ?? '—'}</span></p>}
              {isOfferQueue && <p>Program: <span className="text-gray-700">{offer?.course ?? '—'}</span></p>}
              {isOfferQueue && <p>Intake: <span className="text-gray-700">{offer?.intake ?? '—'}</span></p>}
              {isVisaQueue && <p>Student ID: <span className="text-gray-700">{getFeePaidOffer(a)?.studentId ?? '—'}</span></p>}
              {!stageScope && <p>Stage: <span className="text-gray-700">{a.withdrawn ? '—' : getClientStage(a)}</span></p>}
            </div>
            <button
              onClick={() => setSelectedApp(a)}
              className="w-full inline-flex items-center justify-center gap-1.5 pt-3 border-t border-grey-border text-xs font-semibold text-navy"
            >
              <ExternalLink size={13} />
              View Client Profile
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No applications found.</div>
        )}
      </div>
      )}

      {/* Status Updates — embedded kanban, replaces the list entirely while active */}
      {viewMode === 'kanban' && (isOfferQueue || isVisaQueue) && (
        <StatusUpdatesKanban
          applications={applications}
          onUpdateApplication={onUpdateApplication}
          lockTab={isVisaQueue ? 'visa' : 'offer'}
        />
      )}

      {/* Client profile */}
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
