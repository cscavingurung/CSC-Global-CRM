import { useMemo, useState } from 'react';
import { ChevronRight, Download, Mail, Phone, Search, UserCheck, Users, X } from 'lucide-react';
import { ConsultationStatus, CounselorStudent } from '../types';
import StudentDetailDrawer from './StudentDetailDrawer';
import { LEAD_TEMPERATURE_STYLES } from '../leadTemperature';
import { downloadSheet } from '../exportSheet';
import { clientIdFor } from '../clientId';
import { splitCountries } from '../mockData';
import { parseSubmittedAt } from '../dateTime';

interface CounselorClientsPageProps {
  clients: CounselorStudent[];
  onUpdateClient: (id: string, updates: Partial<CounselorStudent>) => void;
}


const ALL_STATUSES: ConsultationStatus[] = ['Awaiting Consultation', 'In Progress', 'Follow Up', 'Consultation Complete'];

const STATUS_STYLES: Record<ConsultationStatus, string> = {
  'Awaiting Consultation': 'bg-orange-50 text-orange-700 border-orange-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  'Follow Up': 'bg-teal-50 text-teal-700 border-teal-200',
  'Consultation Complete': 'bg-green-50 text-green-700 border-green-200',
};

type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Sort: Newest First' },
  { value: 'oldest', label: 'Sort: Oldest First' },
  { value: 'name-asc', label: 'Sort: Name (A–Z)' },
  { value: 'name-desc', label: 'Sort: Name (Z–A)' },
];

export default function CounselorClientsPage({ clients, onUpdateClient }: CounselorClientsPageProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConsultationStatus[]>([]);
  const [country, setCountry] = useState('all');
  const [caseType, setCaseType] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [selectedClient, setSelectedClient] = useState<CounselorStudent | null>(null);

  // Dropdown options come from the data itself, so new countries/case types appear automatically.
  // A client's `country` can hold more than one country of interest, comma-separated, so this
  // splits each one out to offer individual countries in the filter.
  const countries = useMemo(
    () => Array.from(new Set(clients.flatMap((c) => splitCountries(c.country)))).sort(),
    [clients]
  );
  const caseTypes = useMemo(
    () => Array.from(new Set(clients.map((c) => c.purpose).filter(Boolean))).sort(),
    [clients]
  );
  const statusOptions = useMemo(() => {
    const present = new Set(clients.map((c) => c.consultationStatus));
    const extras = ALL_STATUSES.filter((s) => !present.has(s));
    return [...ALL_STATUSES.filter((s) => present.has(s)), ...extras];
  }, [clients]);

  const toggleStatus = (status: ConsultationStatus) =>
    setStatusFilter((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients
      .filter((client) => {
        const matchesSearch = !query
          || client.name.toLowerCase().includes(query)
          || client.phone.toLowerCase().includes(query);
        const matchesStatus = statusFilter.length === 0 || statusFilter.includes(client.consultationStatus);
        const matchesCountry = country === 'all' || splitCountries(client.country).includes(country);
        const matchesCase = caseType === 'all' || client.purpose === caseType;
        return matchesSearch && matchesStatus && matchesCountry && matchesCase;
      })
      .sort((a, b) => {
        if (sortOption === 'name-asc') return a.name.localeCompare(b.name);
        if (sortOption === 'name-desc') return b.name.localeCompare(a.name);
        const aTime = parseSubmittedAt(a.submittedAt)?.getTime() ?? 0;
        const bTime = parseSubmittedAt(b.submittedAt)?.getTime() ?? 0;
        return sortOption === 'oldest' ? aTime - bTime : bTime - aTime;
      });
  }, [clients, search, statusFilter, country, caseType, sortOption]);

  const filtersActive = !!search || statusFilter.length > 0 || country !== 'all' || caseType !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter([]);
    setCountry('all');
    setCaseType('all');
  };

  const handleExport = () => {
    downloadSheet(
      `clients-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Client ID', 'Client Name', 'Phone', 'Email', 'Visit Date and Time', 'Country of Interest', 'Case Type', 'Status', 'Lead Temperature', 'Enrolled Date', 'Next Visit', 'Counselor', 'Outcome'],
      filteredClients.map((c) => [
        clientIdFor(c), c.name, c.phone, c.email, c.visitDateTime ?? c.submittedAt, c.country, c.purpose, c.consultationStatus,
        c.leadTemperature ?? '', c.assignedDate, c.followUpDate ?? '', c.assignedCounselor, c.outcome,
      ])
    );
  };

  const selectClass = 'w-full appearance-none rounded-lg border border-grey-border bg-white px-3 py-2.5 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by client name or phone"
              className="w-full rounded-lg border border-grey-border bg-white py-2.5 pl-10 pr-10 text-sm focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light"
          >
            <Download size={16} />
            Download Excel
          </button>
        </div>
      </div>

      {/* Advanced filters */}
      <div className="rounded-lg border border-grey-border bg-white p-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500" htmlFor="country-filter">Country of Interest</label>
            <select id="country-filter" value={country} onChange={(e) => setCountry(e.target.value)} className={selectClass}>
              <option value="all">All countries</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500" htmlFor="case-filter">Case Type</label>
            <select id="case-filter" value={caseType} onChange={(e) => setCaseType(e.target.value)} className={selectClass}>
              <option value="all">All case types</option>
              {caseTypes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500" htmlFor="sort-filter">Sort by</label>
            <select id="sort-filter" value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)} className={selectClass}>
              {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500">Client Status</p>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={statusFilter.includes(status)}
                onClick={() => toggleStatus(status)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter.includes(status) ? STATUS_STYLES[status] : 'border-grey-border bg-white text-gray-500 hover:bg-grey-bg hover:text-navy'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {filtersActive && (
          <button type="button" onClick={clearFilters} className="text-xs font-semibold text-navy hover:text-navy-light">
            Clear all filters
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Users size={16} className="text-navy" />
        <span>{filteredClients.length} client{filteredClients.length === 1 ? '' : 's'}</span>
      </div>

      {filteredClients.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-grey-border bg-white lg:block">
            <table className="w-full">
              <thead className="border-b border-grey-border bg-grey-bg">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Client Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Client ID</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Visit Date and Time</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Contact Details</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Country of Interest</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Case Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Lead</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">Access</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className="cursor-pointer border-b border-grey-border transition-colors last:border-0 hover:bg-grey-bg/50"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-navy">{client.name}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{clientIdFor(client)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{client.visitDateTime ?? client.submittedAt}</td>
                    <td className="px-5 py-4">
                      <div className="space-y-1 text-xs text-gray-600">
                        <p className="flex items-center gap-1.5"><Phone size={13} className="text-gray-400" />{client.phone}</p>
                        <p className="flex items-center gap-1.5"><Mail size={13} className="text-gray-400" />{client.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{client.country}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{client.purpose}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[client.consultationStatus]}`}>
                        {client.consultationStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {client.leadTemperature ? (
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${LEAD_TEMPERATURE_STYLES[client.leadTemperature]}`}>
                          {client.leadTemperature}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy">
                        <UserCheck size={14} /> Manage <ChevronRight size={15} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedClient(client)}
                className="w-full rounded-lg border border-grey-border bg-white p-4 text-left transition-colors hover:bg-grey-bg/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{client.name}</p>
                    <p className="mt-1 text-xs text-gray-500">{client.phone}</p>
                    <p className="truncate text-xs text-gray-400">{client.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[client.consultationStatus]}`}>
                      {client.consultationStatus}
                    </span>
                    {client.leadTemperature && (
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${LEAD_TEMPERATURE_STYLES[client.leadTemperature]}`}>
                        {client.leadTemperature}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-grey-border pt-3 text-xs">
                  <p className="text-gray-400">Visit Date and Time<br /><span className="font-medium text-gray-700">{client.visitDateTime ?? client.submittedAt}</span></p>
                  <p className="text-gray-400">Country<br /><span className="font-medium text-gray-700">{client.country}</span></p>
                  <p className="text-gray-400">Case Type<br /><span className="font-medium text-gray-700">{client.purpose}</span></p>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-grey-border bg-white py-14 text-center">
          <Users className="mx-auto mb-3 text-navy/30" size={28} />
          <p className="text-sm text-gray-400">No clients match this view.</p>
        </div>
      )}

      {selectedClient && (
        <StudentDetailDrawer
          student={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdate={(updates) => {
            onUpdateClient(selectedClient.id, updates);
            setSelectedClient({ ...selectedClient, ...updates });
          }}
        />
      )}
    </div>
  );
}
