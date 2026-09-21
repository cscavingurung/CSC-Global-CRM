import { useState, useMemo } from 'react';
import { Search, X, ChevronRight, PhoneCall, Calendar, LayoutGrid, Sheet } from 'lucide-react';
import { CounselorStudent, LeadTemperature } from '../types';
import StudentProfile from './StudentProfile';
import { LEAD_TEMPERATURES, LEAD_TEMPERATURE_STYLES } from '../leadTemperature';
import { clientIdFor } from '../clientId';

interface FollowUpsPageProps {
  students: CounselorStudent[];
  onUpdateStudent: (id: string, updates: Partial<CounselorStudent>) => void;
}

type TempFilter = 'all' | LeadTemperature;
type ViewMode = 'simple' | 'sheet';

function formatDate(value: string): string {
  return new Date(value + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function FollowUpsPage({ students, onUpdateStudent }: FollowUpsPageProps) {
  const [search, setSearch] = useState('');
  const [tempFilter, setTempFilter] = useState<TempFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const [selectedStudent, setSelectedStudent] = useState<CounselorStudent | null>(null);

  const followUps = useMemo(() => {
    return students
      .filter((s) => s.consultationStatus === 'Follow Up' && !!s.followUpDate)
      .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.phone.toLowerCase().includes(search.toLowerCase()))
      .filter((s) => tempFilter === 'all' || s.leadTemperature === tempFilter);
  }, [students, search, tempFilter]);

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
      </div>

      {/* Lead temperature filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-500 mr-1">Lead temperature</span>
        {(['all', ...LEAD_TEMPERATURES] as TempFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={tempFilter === option}
            onClick={() => setTempFilter(option)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              tempFilter === option
                ? option === 'all'
                  ? 'bg-navy text-white border-navy'
                  : LEAD_TEMPERATURE_STYLES[option]
                : 'bg-white border-grey-border text-gray-500 hover:bg-grey-bg hover:text-navy'
            }`}
          >
            {option === 'all' ? 'All' : option}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <PhoneCall size={16} className="text-navy" />
        <span>{followUps.length} client{followUps.length !== 1 ? 's' : ''} needing follow-up</span>
      </div>

      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-grey-border bg-white p-1">
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
        </div>
      </div>

      {viewMode === 'sheet' ? (
        <div className="overflow-x-auto rounded-lg border border-grey-border bg-white">
          <table className="min-w-[1120px] w-full border-collapse text-left">
            <thead className="bg-grey-bg">
              <tr>
                {['#', 'Client ID', 'Client Name', 'Phone', 'Email', 'Country', 'Case Type', 'Lead', 'Next Visit', 'Follow-up Note', 'Status'].map((header) => (
                  <th key={header} className="border border-grey-border px-3 py-2 text-xs font-semibold text-gray-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {followUps.map((s, index) => (
                <tr key={s.id} onClick={() => setSelectedStudent(s)} className="cursor-pointer hover:bg-grey-bg/50">
                  <td className="border border-grey-border px-3 py-2 text-xs text-gray-500">{index + 1}</td>
                  <td className="border border-grey-border px-3 py-2 text-sm text-gray-600 whitespace-nowrap">{clientIdFor(s)}</td>
                  <td className="border border-grey-border px-3 py-2 text-sm font-medium text-navy">{s.name}</td>
                  <td className="border border-grey-border px-3 py-2 text-sm text-gray-600 whitespace-nowrap">{s.phone}</td>
                  <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{s.email}</td>
                  <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{s.country}</td>
                  <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{s.purpose}</td>
                  <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{s.leadTemperature ?? 'Not set'}</td>
                  <td className="border border-grey-border px-3 py-2 text-sm text-gray-600 whitespace-nowrap">{s.followUpDate ? formatDate(s.followUpDate) : 'Not set'}</td>
                  <td className="border border-grey-border px-3 py-2 text-sm text-gray-600 max-w-[280px] truncate">{s.followUpNote ?? '—'}</td>
                  <td className="border border-grey-border px-3 py-2 text-sm text-gray-600">{s.consultationStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {followUps.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No clients match this view.</div>
          )}
        </div>
      ) : (
        <>

      {/* Table — desktop */}
      <div className="hidden lg:block bg-white rounded-xl border border-grey-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-grey-border bg-grey-bg">
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Name</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Phone</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Country</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Case Type</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Lead</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Next Visit</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Follow-up Note</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {followUps.map((s) => (
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
                <td className="px-5 py-3.5">
                  {s.leadTemperature ? (
                    <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full border ${LEAD_TEMPERATURE_STYLES[s.leadTemperature]}`}>
                      {s.leadTemperature}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Not set</span>
                  )}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  {s.followUpDate ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-teal-50 text-teal-700">
                      <Calendar size={11} />
                      {formatDate(s.followUpDate)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Not set</span>
                  )}
                </td>
                <td className="px-5 py-3.5 max-w-[280px] text-sm text-gray-600">
                  {s.followUpNote ? (
                    <span className="block whitespace-pre-line">{s.followUpNote}</span>
                  ) : (
                    <span className="text-xs text-gray-400">No note</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <ChevronRight className="text-gray-300 inline" size={18} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {followUps.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No clients match this view.</div>
        )}
      </div>

      {/* Card list — mobile */}
      <div className="lg:hidden space-y-3">
        {followUps.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedStudent(s)}
            className="w-full text-left bg-white rounded-xl border border-grey-border p-4 transition-colors hover:bg-grey-bg/50"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">{s.name}</p>
                <p className="text-xs text-gray-400">{s.email}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-teal-50 text-teal-700">Follow Up</span>
                {s.leadTemperature && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${LEAD_TEMPERATURE_STYLES[s.leadTemperature]}`}>
                    {s.leadTemperature}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
              <p>Phone: <span className="text-gray-700">{s.phone}</span></p>
              <p>Country: <span className="text-gray-700">{s.country}</span></p>
              <p>Case Type: <span className="text-gray-700">{s.purpose}</span></p>
              <p>Assigned: <span className="text-gray-700">{s.assignedDate}</span></p>
              <p className="col-span-2">
                Next Visit:{' '}
                {s.followUpDate ? (
                  <span className="inline-flex items-center gap-1 font-medium text-teal-700">
                    <Calendar size={11} />
                    {formatDate(s.followUpDate)}
                  </span>
                ) : (
                  <span className="text-gray-400">Not set</span>
                )}
              </p>
            </div>
            <div className="mb-3 rounded-lg border border-grey-border bg-grey-bg/60 px-3 py-2">
              <p className="text-xs font-semibold text-gray-500">Follow-up Note</p>
              <p className="mt-0.5 whitespace-pre-line text-xs text-gray-700">{s.followUpNote || 'No note yet'}</p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-grey-border">
              <p className="text-xs text-gray-400">Tap to view details</p>
              <ChevronRight className="text-gray-300" size={16} />
            </div>
          </button>
        ))}
        {followUps.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No clients match this view.</div>
        )}
      </div>

        </>
      )}

      {/* Detail drawer */}
      {selectedStudent && (
        <StudentProfile
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
