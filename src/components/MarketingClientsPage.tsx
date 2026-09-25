import { useMemo, useState, useEffect } from 'react';
import { Search, Lock, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ApplicationRecord, CounselorStudent, IntakeStudent } from '../types';
import { getClientStatusLabel, getStatusTone, STATUS_TONE_STYLES } from '../clientPipeline';
import {
  PLATFORM_SOURCES, platformBadgeStyle, isMarketingLead, leadBranch,
  consultationFor, applicationFor,
} from '../marketing';

interface MarketingClientsPageProps {
  students: IntakeStudent[];
  counselorStudents: CounselorStudent[];
  applications: ApplicationRecord[];
}

const ALL_PLATFORMS = 'All Platforms';
const PAGE_SIZE = 15;

const CONSULT_STATUS_STYLES: Record<CounselorStudent['consultationStatus'], string> = {
  'Awaiting Consultation': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-navy/10 text-navy',
  'Follow Up': 'bg-amber-50 text-amber-700',
  'Consultation Complete': 'bg-green-100 text-green-700',
};

export default function MarketingClientsPage({ students, counselorStudents, applications }: MarketingClientsPageProps) {
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState(ALL_PLATFORMS);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students
      .filter(isMarketingLead)
      .filter((lead) => (platform === ALL_PLATFORMS ? true : lead.platformSource === platform))
      .filter((lead) => (term ? lead.name.toLowerCase().includes(term) || lead.phone.includes(term) : true))
      .map((lead) => {
        const consultation = consultationFor(lead, counselorStudents);
        const application = applicationFor(consultation, applications);
        const counselor = lead.claimedBy || consultation?.assignedCounselor || lead.assignedCounselor || null;

        let statusLabel: string;
        let statusStyle: string;
        if (application) {
          statusLabel = getClientStatusLabel(application);
          statusStyle = STATUS_TONE_STYLES[getStatusTone(application)];
        } else if (consultation) {
          statusLabel = consultation.consultationStatus;
          statusStyle = CONSULT_STATUS_STYLES[consultation.consultationStatus];
        } else if (lead.broadcastBranch) {
          statusLabel = 'Awaiting Claim';
          statusStyle = 'bg-amber-50 text-amber-700';
        } else {
          statusLabel = 'New Lead';
          statusStyle = 'bg-gray-100 text-gray-600';
        }

        return { lead, counselor, statusLabel, statusStyle };
      });
  }, [students, counselorStudents, applications, search, platform]);

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [search, platform]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-xl border border-grey-border bg-white p-4">
        <Lock size={15} className="flex-shrink-0 text-gray-400" />
        <p className="text-sm text-gray-500">
          Read-only tracking view — statuses and documents are managed by counselors and V/A officers.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone"
            className="w-full rounded-lg border border-grey-border py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
          />
        </div>
        <div className="relative">
          <Share2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <select
            aria-label="Platform source"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="appearance-none rounded-lg border border-grey-border bg-white py-2.5 pl-9 pr-8 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
          >
            <option value={ALL_PLATFORMS}>{ALL_PLATFORMS}</option>
            {PLATFORM_SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-grey-border bg-white py-12 text-center text-sm text-gray-400">
          No marketing-generated clients yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-grey-border bg-grey-bg">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Client Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Platform Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Country</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Case Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Assigned Counselor</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Current Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map(({ lead, counselor, statusLabel, statusStyle }) => (
                <tr key={lead.id} className="border-b border-grey-border last:border-0 hover:bg-grey-bg/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-navy">{lead.name}</p>
                    <p className="text-xs text-gray-400">{lead.submittedAt}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${platformBadgeStyle(lead.platformSource)}`}>
                      {lead.platformSource}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{lead.country}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{lead.purpose}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{leadBranch(lead)}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{counselor ?? <span className="text-gray-400">Unclaimed</span>}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle}`}>{statusLabel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">Page {currentPage} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-grey-border bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} /> Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-grey-border bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
