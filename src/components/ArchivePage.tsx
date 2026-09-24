import { useState, useMemo } from 'react';
import { Search, X, Eye, Archive as ArchiveIcon, ChevronDown } from 'lucide-react';
import { CounselorStudent } from '../types';
import StudentProfile from './StudentProfile';
import DateRangeFilter from './DateRangeFilter';
import { matchesDateRange } from '../dateFilter';

interface ArchivePageProps {
  students: CounselorStudent[];
  onUpdateStudent: (id: string, updates: Partial<CounselorStudent>) => void;
}

type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Sort: Newest First' },
  { value: 'oldest', label: 'Sort: Oldest First' },
  { value: 'name-asc', label: 'Sort: Name (A–Z)' },
  { value: 'name-desc', label: 'Sort: Name (Z–A)' },
];

export default function ArchivePage({ students, onUpdateStudent }: ArchivePageProps) {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [viewStudent, setViewStudent] = useState<CounselorStudent | null>(null);

  const archived = useMemo(() => {
    return students
      .filter((s) => s.outcome === 'Not Proceeding')
      .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
      .filter((s) => matchesDateRange(s.completedDate, dateFrom, dateTo))
      .sort((a, b) => {
        if (sortOption === 'name-asc') return a.name.localeCompare(b.name);
        if (sortOption === 'name-desc') return b.name.localeCompare(a.name);
        const aTime = a.completedDate ? new Date(a.completedDate).getTime() : 0;
        const bTime = b.completedDate ? new Date(b.completedDate).getTime() : 0;
        return sortOption === 'oldest' ? aTime - bTime : bTime - aTime;
      });
  }, [students, search, dateFrom, dateTo, sortOption]);

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
            placeholder="Search archived clients"
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

      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <ArchiveIcon size={16} className="text-navy" />
        <span>{archived.length} archived client{archived.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      {archived.length > 0 ? (
        <div className="space-y-3">
          {archived.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-grey-border p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <ArchiveIcon className="text-red-600" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-navy truncate">{s.name}</p>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-red-100 text-red-700">
                    Not Proceeding
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span>Completed: {s.completedDate}</span>
                  <span className="text-gray-300">·</span>
                  <span className="truncate">{s.country} — {s.purpose}</span>
                </div>
              </div>
              <button
                onClick={() => setViewStudent(s)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light transition-colors flex-shrink-0"
              >
                <Eye size={15} />
                <span className="hidden sm:inline">View Notes</span>
              </button>
            </div>
          ))}
        </div>
      ) : search || dateFrom || dateTo ? (
        <div className="py-12 text-center text-sm text-gray-400">No archived clients found.</div>
      ) : (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-navy/5 flex items-center justify-center mx-auto mb-4">
            <ArchiveIcon className="text-navy/40" size={28} />
          </div>
          <p className="text-sm text-gray-400">No archived clients yet.</p>
        </div>
      )}

      {/* Detail drawer */}
      {viewStudent && (
        <StudentProfile
          student={viewStudent}
          onClose={() => setViewStudent(null)}
          onUpdate={(updates) => {
            onUpdateStudent(viewStudent.id, updates);
            setViewStudent({ ...viewStudent, ...updates });
          }}
        />
      )}
    </div>
  );
}
