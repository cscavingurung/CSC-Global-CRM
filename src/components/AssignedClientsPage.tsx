import { useState, useMemo } from 'react';
import { Search, X, UserCheck, Users } from 'lucide-react';
import { ConsultationStatus, CounselorStudent } from '../types';
import DateRangeFilter from './DateRangeFilter';
import { matchesDateRange } from '../dateFilter';

interface AssignedClientsPageProps {
  counselorStudents: CounselorStudent[];
}

const STATUS_STYLES: Record<ConsultationStatus, string> = {
  'Awaiting Consultation': 'bg-orange-100 text-orange-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Follow Up': 'bg-purple-100 text-purple-700',
  'Consultation Complete': 'bg-green-100 text-green-700',
};

export default function AssignedClientsPage({ counselorStudents }: AssignedClientsPageProps) {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(
    () =>
      counselorStudents.filter((s) => {
        const matchesSearch =
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.email.toLowerCase().includes(search.toLowerCase()) ||
          s.assignedCounselor.toLowerCase().includes(search.toLowerCase());
        return matchesSearch && matchesDateRange(s.assignedDate, dateFrom, dateTo);
      }),
    [counselorStudents, search, dateFrom, dateTo]
  );

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
            placeholder="Search by name, email or counselor"
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
        <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Users size={16} className="text-navy" />
        <span>{filtered.length} assigned client{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table — desktop */}
      {filtered.length > 0 ? (
        <>
          <div className="hidden lg:block bg-white rounded-xl border border-grey-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-grey-border bg-grey-bg">
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Client</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Country</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Purpose</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Assigned Date</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Counselor</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-grey-border last:border-0 hover:bg-grey-bg/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-navy">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{s.country}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{s.purpose}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{s.assignedDate}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <UserCheck size={14} className="text-green-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-green-700">{s.assignedCounselor}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[s.consultationStatus]}`}>
                        {s.consultationStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card list — mobile */}
          <div className="lg:hidden space-y-3">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-grey-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.email}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${STATUS_STYLES[s.consultationStatus]}`}>
                    {s.consultationStatus}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                  <p>Country: <span className="text-gray-700">{s.country}</span></p>
                  <p>Purpose: <span className="text-gray-700">{s.purpose}</span></p>
                  <p className="col-span-2">Assigned: <span className="text-gray-700">{s.assignedDate}</span></p>
                </div>
                <div className="flex items-center gap-1.5 pt-3 border-t border-grey-border min-w-0">
                  <UserCheck size={14} className="text-green-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-green-700 truncate">{s.assignedCounselor}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : search || dateFrom || dateTo ? (
        <div className="py-12 text-center text-sm text-gray-400">No assigned clients found.</div>
      ) : (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-navy/5 flex items-center justify-center mx-auto mb-4">
            <UserCheck className="text-navy/40" size={28} />
          </div>
          <p className="text-sm text-gray-400">No clients have been assigned yet.</p>
        </div>
      )}
    </div>
  );
}
