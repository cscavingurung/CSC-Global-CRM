import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronLeft, ChevronRight, CalendarCheck, UserPlus, GraduationCap, Send, BadgeCheck } from 'lucide-react';
import { ApplicationRecord, CounselorStudent, MockUser, Partner, StaffMember, StaffRole } from '../types';
import CompactDateRangeFilter from './CompactDateRangeFilter';
import ClientProfile from './ClientProfile';
import { matchesDateRange } from '../dateFilter';
import { dateKey, parseSubmittedAt } from '../dateTime';

interface StaffActivityPanelProps {
  counselorStudents: CounselorStudent[];
  applications: ApplicationRecord[];
  /** Branch staff — drives the staff filter list and the role badges. */
  staff: StaffMember[];
  partners?: Partner[];
  currentUser?: MockUser;
  onUpdateApplication?: (id: string, updates: Partial<ApplicationRecord>) => void;
}

type RangePreset = 'today' | 'week' | 'month' | 'manual';

interface ActivityItem {
  id: string;
  staffName: string;
  /** YYYY-MM-DD */
  date: string;
  /** Exact time when the source record captured one. */
  time: string | null;
  action: string;
  client: string;
  clientAppId?: string;
  tone: string;
}

const ROLE_BADGE_STYLES: Record<StaffRole, string> = {
  'Front Desk Officer': 'bg-blue-50 text-blue-700',
  Counselor: 'bg-green-50 text-green-700',
  'V/A Officer': 'bg-navy/10 text-navy',
  'Branch Manager': 'bg-teal-50 text-teal-700',
  'Super Admin': 'bg-red-50 text-red-700',
  Marketing: 'bg-amber-50 text-amber-700',
  Finance: 'bg-teal-50 text-teal-700',
};

const PAGE_SIZE = 15;

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'manual', label: 'Manual Range' },
];

function shiftDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateKey(d);
}

function timeOf(value?: string | null): string | null {
  if (!value) return null;
  const parsed = parseSubmittedAt(value);
  if (parsed) {
    const hour = parsed.getHours() % 12 || 12;
    return `${hour}:${String(parsed.getMinutes()).padStart(2, '0')} ${parsed.getHours() >= 12 ? 'PM' : 'AM'}`;
  }
  const match = value.match(/(\d{1,2}):(\d{2})/);
  return match ? match[0] : null;
}

/** Branch Manager view: aggregate staff progress, filters and a detailed activity feed. */
export default function StaffActivityPanel({
  counselorStudents, applications, staff, partners = [], currentUser, onUpdateApplication,
}: StaffActivityPanelProps) {
  const [staffFilter, setStaffFilter] = useState('all');
  const [preset, setPreset] = useState<RangePreset>('month');
  const [manualFrom, setManualFrom] = useState('');
  const [manualTo, setManualTo] = useState('');
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [page, setPage] = useState(1);

  const [from, to] = useMemo<[string, string]>(() => {
    if (preset === 'manual') return [manualFrom, manualTo];
    if (preset === 'today') return [dateKey(new Date()), dateKey(new Date())];
    if (preset === 'week') return [shiftDays(6), dateKey(new Date())];
    return [shiftDays(29), dateKey(new Date())];
  }, [preset, manualFrom, manualTo]);

  const roleOf = (name: string): StaffRole | null => staff.find((s) => s.name === name)?.role ?? null;

  const filterableStaff = useMemo(
    () => staff.filter((s) => s.role === 'Counselor' || s.role === 'V/A Officer' || s.role === 'Front Desk Officer'),
    [staff]
  );

  // ─── Progress overview ───────────────────────────────────────────────────────
  const progress = useMemo(() => {
    const todayKey = dateKey(new Date());
    const month = todayKey.slice(0, 7);
    const inMonth = (d?: string | null) => !!d && d.slice(0, 7) === month;

    const consultationsToday = counselorStudents.filter((c) => c.completedDate === todayKey).length;
    const intakesToday = counselorStudents.filter((c) => (c.submittedAt ?? '').slice(0, 10) === todayKey).length;
    const enrolmentsMonth = counselorStudents.filter((c) => c.outcome === 'Proceeding' && inMonth(c.completedDate)).length;

    let visasLodged = 0;
    let visasApproved = 0;
    applications.forEach((a) => {
      const attempts = a.visaApplication ? [a.visaApplication, ...(a.visaApplication.history ?? [])] : [];
      attempts.forEach((v) => {
        if (inMonth(v.appliedDate)) visasLodged += 1;
        if (v.status === 'Visa Approved' && inMonth(v.outcomeDate)) visasApproved += 1;
      });
    });

    return [
      { label: 'Consultations Today', value: consultationsToday, icon: CalendarCheck, group: 'Daily' },
      { label: 'Intakes Today', value: intakesToday, icon: UserPlus, group: 'Daily' },
      { label: 'Enrolments This Month', value: enrolmentsMonth, icon: GraduationCap, group: 'Monthly' },
      { label: 'Visas Lodged This Month', value: visasLodged, icon: Send, group: 'Monthly' },
      { label: 'Visas Approved This Month', value: visasApproved, icon: BadgeCheck, group: 'Monthly' },
    ];
  }, [counselorStudents, applications]);

  // ─── Activity feed ───────────────────────────────────────────────────────────
  const items = useMemo<ActivityItem[]>(() => {
    const built: ActivityItem[] = [];
    const appByName = new Map(applications.map((a) => [a.name, a]));

    counselorStudents.forEach((c) => {
      const appId = appByName.get(c.name)?.id;
      if (c.submittedAt) {
        built.push({
          id: `${c.id}-created`, staffName: c.addedBy ?? c.assignedCounselor, date: c.submittedAt.slice(0, 10),
          time: timeOf(c.visitDateTime ?? c.submittedAt), action: 'Created New Client', client: c.name, clientAppId: appId,
          tone: 'bg-blue-50 text-blue-700',
        });
      }
      if (c.assignedDate) {
        built.push({
          id: `${c.id}-assigned`, staffName: c.assignedCounselor, date: c.assignedDate, time: timeOf(c.visitDateTime),
          action: 'Client Assigned', client: c.name, clientAppId: appId, tone: 'bg-navy/10 text-navy',
        });
      }
      if (c.followUpDate) {
        built.push({
          id: `${c.id}-followup`, staffName: c.assignedCounselor, date: c.followUpDate, time: null,
          action: c.followUpNote ? 'Added Follow-up Note' : 'Follow-up Scheduled', client: c.name, clientAppId: appId,
          tone: 'bg-teal-50 text-teal-700',
        });
      }
      if (c.completedDate) {
        built.push({
          id: `${c.id}-complete`, staffName: c.assignedCounselor, date: c.completedDate, time: null,
          action: c.outcome === 'Not Proceeding' ? 'Client Archived' : 'Consultation Completed', client: c.name, clientAppId: appId,
          tone: c.outcome === 'Not Proceeding' ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700',
        });
      }
    });

    applications.forEach((a) => {
      a.offerApplications.forEach((o) => {
        built.push({
          id: `${a.id}-${o.id}`, staffName: a.counselor, date: o.statusUpdatedAt, time: null,
          action: `Status Updated to ${o.status}`, client: a.name, clientAppId: a.id, tone: 'bg-amber-50 text-amber-700',
        });
      });
      const attempts = a.visaApplication ? [a.visaApplication, ...(a.visaApplication.history ?? [])] : [];
      attempts.forEach((v, idx) => {
        built.push({
          id: `${a.id}-visa-${idx}`, staffName: a.counselor, date: v.statusUpdatedAt, time: null,
          action: `Status Updated to ${v.status}`, client: a.name, clientAppId: a.id, tone: 'bg-navy/10 text-navy',
        });
      });
    });

    return built
      .filter((i) => staffFilter === 'all' || i.staffName === staffFilter)
      .filter((i) => matchesDateRange(i.date, from, to))
      .sort((x, y) => `${y.date} ${y.time ?? ''}`.localeCompare(`${x.date} ${x.time ?? ''}`));
  }, [counselorStudents, applications, staffFilter, from, to]);

  useEffect(() => {
    setPage(1);
  }, [staffFilter, from, to]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = useMemo(
    () => items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [items, currentPage]
  );

  const openClient = (id?: string) => {
    if (!id || !currentUser) return;
    const app = applications.find((a) => a.id === id);
    if (app) setSelectedApp(app);
  };

  return (
    <div className="space-y-6">
      {/* Progress overview */}
      <div>
        <h3 className="mb-3 text-base font-semibold text-navy">Staff Progress Overview</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {progress.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-xl border border-grey-border bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy/5">
                    <Icon size={17} className="text-navy" />
                  </div>
                  <span className="rounded-full bg-grey-bg px-2 py-0.5 text-[11px] font-medium text-gray-500">{m.group}</span>
                </div>
                <p className="text-2xl font-bold text-navy">{m.value}</p>
                <p className="mt-1 text-xs text-gray-500">{m.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity feed */}
      <div className="rounded-xl border border-grey-border bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-grey-border p-4">
          <div className="mr-auto flex items-center gap-2">
            <Activity size={18} className="text-navy" />
            <h3 className="text-base font-semibold text-navy">Staff Activity</h3>
            <span className="rounded-full bg-navy/5 px-2 py-0.5 text-xs font-medium text-navy">{items.length}</span>
          </div>

          <div className="relative">
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="appearance-none rounded-lg border border-grey-border bg-white py-2 pl-3 pr-9 text-sm font-medium text-navy transition-colors focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
            >
              <option value="all">All Staff Members</option>
              {filterableStaff.map((s) => (
                <option key={s.id} value={s.name}>{s.name} — {s.role}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          </div>

          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-grey-border p-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={preset === p.key}
                onClick={() => setPreset(p.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  preset === p.key ? 'bg-navy text-white' : 'text-gray-500 hover:bg-navy/5 hover:text-navy'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'manual' && (
            <CompactDateRangeFilter from={manualFrom} to={manualTo} onFromChange={setManualFrom} onToChange={setManualTo} />
          )}
        </div>

        <div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-grey-border text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">Staff Member</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Client</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((i) => {
                const role = roleOf(i.staffName);
                return (
                  <tr key={i.id} className="border-b border-grey-border last:border-0 hover:bg-grey-bg/50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {i.date}
                      <span className="ml-2 text-xs text-gray-400">{i.time ?? 'Time not recorded'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-navy">{i.staffName}</span>
                      {role && (
                        <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE_STYLES[role]}`}>
                          {role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${i.tone}`}>{i.action}</span>
                    </td>
                    <td className="px-4 py-3">
                      {i.clientAppId && currentUser ? (
                        <button
                          type="button"
                          onClick={() => openClient(i.clientAppId)}
                          className="font-medium text-navy underline decoration-grey-border underline-offset-2 transition-colors hover:text-navy-light"
                        >
                          {i.client}
                        </button>
                      ) : (
                        <span className="text-gray-600">{i.client}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No staff activity in this period.</div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-grey-border px-4 py-3">
            <p className="text-xs text-gray-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-grey-border bg-white px-3 py-1.5 text-sm font-medium text-navy transition-colors hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} /> Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-grey-border bg-white px-3 py-1.5 text-sm font-medium text-navy transition-colors hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedApp && currentUser && (
        <ClientProfile
          application={selectedApp}
          partners={partners}
          currentUser={currentUser}
          onClose={() => setSelectedApp(null)}
          onUpdate={(updates) => {
            onUpdateApplication?.(selectedApp.id, updates);
            setSelectedApp({ ...selectedApp, ...updates });
          }}
        />
      )}
    </div>
  );
}
