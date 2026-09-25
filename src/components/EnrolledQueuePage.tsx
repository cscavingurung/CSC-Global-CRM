import { useMemo, useState, useEffect } from 'react';
import { Search, X, ExternalLink, Send, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { ApplicationRecord, MockUser, OfferApplication, Partner } from '../types';
import ClientProfile from './ClientProfile';
import { clientIdFor } from '../clientId';
import { today } from '../clientPipeline';

const PAGE_SIZE = 15;

interface EnrolledQueuePageProps {
  applications: ApplicationRecord[];
  partners: Partner[];
  currentUser: MockUser;
  onUpdateApplication: (id: string, updates: Partial<ApplicationRecord>) => void;
}

interface QueueRow {
  key: string;
  app: ApplicationRecord;
  offer: OfferApplication;
}

/**
 * V/A Officer staging queue: clients a counselor has enrolled whose offer application
 * hasn't been submitted yet. Submitting the application moves the row onto the
 * Offer Applications tab.
 */
export default function EnrolledQueuePage({ applications, partners, currentUser, onUpdateApplication }: EnrolledQueuePageProps) {
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);

  const rows = useMemo<QueueRow[]>(() => {
    const built: QueueRow[] = [];
    applications
      .filter((a) => !a.withdrawn)
      .filter((a) => a.name.toLowerCase().includes(search.trim().toLowerCase()))
      .forEach((a) => {
        a.offerApplications
          .filter((o) => o.status === 'Enrolled')
          .forEach((o) => built.push({ key: `${a.id}-${o.id}`, app: a, offer: o }));
      });
    return built.sort((x, y) => y.app.consultationDate.localeCompare(x.app.consultationDate));
  }, [applications, search]);

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage]
  );

  const submitApplication = (row: QueueRow) => {
    const date = today();
    onUpdateApplication(row.app.id, {
      offerApplications: row.app.offerApplications.map((o) =>
        o.id === row.offer.id ? { ...o, status: 'Applied to Institution' as const, statusUpdatedAt: date, appliedDate: date } : o
      ),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client name"
            className="w-full rounded-lg border border-grey-border bg-white py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-grey-border bg-white px-3 py-2.5 text-sm text-gray-500">
          <GraduationCap size={16} className="text-navy" />
          {rows.length} awaiting offer application{rows.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Table — desktop */}
      <div className="hidden overflow-x-auto rounded-xl border border-grey-border bg-white lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-grey-border bg-grey-bg">
              {['Client Name', 'Client ID', 'Country', 'Case Type', 'Institution', 'Program Name', 'Intake', 'Counselor', 'Enrolled On'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => (
              <tr key={row.key} className="border-b border-grey-border transition-colors last:border-0 hover:bg-grey-bg/50">
                <td className="px-5 py-3.5">
                  <p className="text-sm font-medium text-navy">{row.app.name}</p>
                  <p className="text-xs text-gray-400">{row.app.email}</p>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-sm text-gray-600">{clientIdFor(row.app)}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{row.app.country}</td>
                <td className="px-5 py-3.5">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{row.app.purpose}</span>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{row.offer.institution}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{row.offer.course ?? '—'}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-sm text-gray-600">{row.offer.intake ?? '—'}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{row.app.counselor}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-sm text-gray-500">{row.app.consultationDate}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSelectedApp(row.app)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-grey-border px-2.5 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-grey-bg"
                    >
                      <ExternalLink size={13} />
                      View Client Profile
                    </button>
                    <button
                      onClick={() => submitApplication(row)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-navy px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-light"
                    >
                      <Send size={13} />
                      Application Submitted
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No enrolled clients waiting for an offer application.</div>
        )}
      </div>

      {/* Cards — mobile */}
      <div className="space-y-3 lg:hidden">
        {paginatedRows.map((row) => (
          <div key={row.key} className="rounded-xl border border-grey-border bg-white p-4">
            <p className="text-sm font-semibold text-navy">{row.app.name}</p>
            <p className="text-xs text-gray-400">{clientIdFor(row.app)}</p>
            <div className="my-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
              <p>Country: <span className="text-gray-700">{row.app.country}</span></p>
              <p>Counselor: <span className="text-gray-700">{row.app.counselor}</span></p>
              <p>Institution: <span className="text-gray-700">{row.offer.institution}</span></p>
              <p>Intake: <span className="text-gray-700">{row.offer.intake ?? '—'}</span></p>
            </div>
            <div className="flex gap-2 border-t border-grey-border pt-3">
              <button onClick={() => setSelectedApp(row.app)} className="flex-1 rounded-lg border border-grey-border py-2 text-xs font-semibold text-navy">
                View Client Profile
              </button>
              <button onClick={() => submitApplication(row)} className="flex-1 rounded-lg bg-navy py-2 text-xs font-semibold text-white">
                Application Submitted
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No enrolled clients waiting for an offer application.</div>
        )}
      </div>

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
