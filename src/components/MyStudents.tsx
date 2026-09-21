import { useState, useMemo } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { ConsultationStatus, CounselorStudent } from '../types';
import StudentDetailDrawer from './StudentDetailDrawer';
import DateRangeFilter from './DateRangeFilter';
import { matchesDateRange } from '../dateFilter';

interface MyStudentsProps {
  students: CounselorStudent[];
  onUpdateStudent: (id: string, updates: Partial<CounselorStudent>) => void;
}

export default function MyStudents({ students, onUpdateStudent }: MyStudentsProps) {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<CounselorStudent | null>(null);

  const STATUS_STYLES: Record<ConsultationStatus, string> = {
    'Awaiting Consultation': 'bg-orange-100 text-orange-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Follow Up': 'bg-purple-100 text-purple-700',
    'Consultation Complete': 'bg-green-100 text-green-700',
  };

  const filtered = useMemo(() => {
    return students
      .filter((s) => s.outcome === 'Pending' && !(s.consultationStatus === 'Follow Up' && s.followUpDate))
      .filter((s) => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
        const matchesDate = matchesDateRange(s.assignedDate, dateFrom, dateTo);
        return matchesSearch && matchesDate;
      });
  }, [students, search, dateFrom, dateTo]);

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

        <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
      </div>

      {/* Table — desktop */}
      <div className="hidden lg:block bg-white rounded-xl border border-grey-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-grey-border bg-grey-bg">
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Name</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Phone</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Country</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Purpose</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Assigned</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Status</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.id}
                onClick={() => setSelectedStudent(s)}
                className="border-b border-grey-border last:border-0 hover:bg-grey-bg/50 transition-colors cursor-pointer"
              >
                <td className="px-5 py-3.5">
                  <p className="text-sm font-medium text-navy">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{s.phone}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{s.country}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{s.purpose}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{s.assignedDate}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[s.consultationStatus]}`}>
                    {s.consultationStatus}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <ChevronRight className="text-gray-300 inline" size={18} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No clients found.</div>
        )}
      </div>

      {/* Card list — mobile */}
      <div className="lg:hidden space-y-3">
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedStudent(s)}
            className="w-full text-left bg-white rounded-xl border border-grey-border p-4 transition-colors hover:border-navy-light/40"
          >
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
              <p>Phone: <span className="text-gray-700">{s.phone}</span></p>
              <p>Country: <span className="text-gray-700">{s.country}</span></p>
              <p>Purpose: <span className="text-gray-700">{s.purpose}</span></p>
              <p>Assigned: <span className="text-gray-700">{s.assignedDate}</span></p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-grey-border">
              <p className="text-xs text-gray-400">Tap to view details</p>
              <ChevronRight className="text-gray-300" size={16} />
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No clients found.</div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedStudent && (
        <StudentDetailDrawer
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onUpdate={(updates) => {
            onUpdateStudent(selectedStudent.id, updates);
            setSelectedStudent({ ...selectedStudent, ...updates });
          }}
        />
      )}
    </div>
  );
}
