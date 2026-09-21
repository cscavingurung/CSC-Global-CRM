import { useState, useMemo } from 'react';
import { UserCheck, Users } from 'lucide-react';
import { Counselor, IntakeStudent } from '../types';
import AssignCounselorModal from './AssignCounselorModal';
import { AVAILABILITY_STYLES, sortByAvailability } from '../counselorStatus';

interface AssignCounselorPageProps {
  students: IntakeStudent[];
  counselors: Counselor[];
  onAssign: (studentId: string, counselorName: string) => void;
}

export default function AssignCounselorPage({ students, counselors, onAssign }: AssignCounselorPageProps) {
  const [assignStudent, setAssignStudent] = useState<IntakeStudent | null>(null);

  // Marketing leads sitting in a branch broadcast pool are claimed by counselors themselves,
  // so they're excluded here until someone accepts them.
  const unassigned = useMemo(
    () => students.filter((s) => s.status === 'New' && !(s.broadcastBranch && !s.claimedBy)),
    [students]
  );

  return (
    <div className="space-y-6">
      {/* Counselor roster */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-navy">Counselors</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortByAvailability(counselors).map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-grey-border p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy truncate">{c.name}</p>
                <p className="text-xs text-gray-500 truncate">{c.country}</p>
                <p className="text-xs text-gray-400 mt-1">{c.activeAssignments} assigned clients</p>
              </div>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${AVAILABILITY_STYLES[c.availability]}`}
              >
                {c.availability}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Students awaiting assignment */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <UserCheck size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-navy">Awaiting Assignment ({unassigned.length})</h3>
        </div>

        {unassigned.length === 0 ? (
          <div className="bg-white rounded-xl border border-grey-border py-12 text-center text-sm text-gray-400">
            No clients waiting to be assigned.
          </div>
        ) : (
          <>
            {/* Table — desktop */}
            <div className="hidden lg:block bg-white rounded-xl border border-grey-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-grey-border bg-grey-bg">
                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Country</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Purpose</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Submitted</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map((s) => (
                    <tr key={s.id} className="border-b border-grey-border last:border-0 hover:bg-grey-bg/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-navy">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{s.country}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{s.purpose}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{s.submittedAt}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setAssignStudent(s)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light transition-colors"
                        >
                          <UserCheck size={15} />
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card list — mobile */}
            <div className="lg:hidden space-y-3">
              {unassigned.map((s) => (
                <div key={s.id} className="bg-white rounded-xl border border-grey-border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                    <p>Country: <span className="text-gray-700">{s.country}</span></p>
                    <p>Purpose: <span className="text-gray-700">{s.purpose}</span></p>
                    <p className="col-span-2">Submitted: <span className="text-gray-700">{s.submittedAt}</span></p>
                  </div>
                  <div className="flex items-center justify-end pt-3 border-t border-grey-border">
                    <button
                      onClick={() => setAssignStudent(s)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-light transition-colors"
                    >
                      <UserCheck size={15} />
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Assign modal */}
      {assignStudent && (
        <AssignCounselorModal
          student={assignStudent}
          counselors={counselors}
          onClose={() => setAssignStudent(null)}
          onConfirm={(counselorName) => {
            onAssign(assignStudent.id, counselorName);
            setAssignStudent(null);
          }}
        />
      )}
    </div>
  );
}
