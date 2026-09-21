import { useEffect, useMemo, useState } from 'react';
import GreetingBanner from './GreetingBanner';
import {
  GraduationCap, CalendarDays, FileText, CheckCircle,
  UserCheck, RefreshCw, UserPlus, ClipboardList,
  UserX, FileClock, UserMinus, ChevronLeft, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { ActivityEntry, AppNotification, ApplicationRecord, Counselor, CounselorStudent, IntakeStudent, StaffMember } from '../types';
import { parseSubmittedAt } from '../dateTime';
import { formatRelativeTime } from '../notifications';
import { daysInCurrentStatus, latestActivityDate, latestActivityDateForApp, isClientInProgress, getClientStatusLabel } from '../clientPipeline';
import { computeBranchOverviewStats } from '../branchLiveStats';
import { PeriodKey, periodStart, periodSuffix } from '../reportPeriod';
import PeriodFilter from './PeriodFilter';

interface BranchManagerOverviewProps {
  branch: string;
  students: IntakeStudent[];
  counselorStudents: CounselorStudent[];
  applications: ApplicationRecord[];
  counselors: Counselor[];
  staff: StaffMember[];
  notifications: AppNotification[];
}

const ACTIVITY_ICONS: Record<ActivityEntry['type'], LucideIcon> = {
  assignment: UserCheck,
  status: RefreshCw,
  intake: UserPlus,
  consultation: ClipboardList,
};

const ACTIVITY_COLORS: Record<ActivityEntry['type'], string> = {
  assignment: 'bg-blue-50 text-blue-600',
  status: 'bg-navy/5 text-navy',
  intake: 'bg-green-50 text-green-600',
  consultation: 'bg-orange-50 text-orange-600',
};

const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'intake', label: 'Intakes' },
  { value: 'assignment', label: 'Assignments' },
  { value: 'status', label: 'Status Changes' },
];

const ACTIVITY_PAGE_SIZE = 10;
const STALE_APPLICATION_DAYS = 7;
const STALE_STUDENT_HOURS = 24;

type ActivityFilter = 'all' | ActivityEntry['type'];

// Today's Activity is derived live from the branch-scoped notifications created alongside
// New Intake / Assign Counselor / Consultation Ready (see createBranchManagerNotification in
// src/notifications.ts) rather than the static, never-written-to activity_feed table. There's
// no notification for application status changes yet, so the 'status' filter has no entries.
const TRIGGER_TO_ACTIVITY_TYPE: Record<AppNotification['trigger'], ActivityEntry['type']> = {
  'new-intake': 'intake',
  'assigned-to-counselor': 'assignment',
  'consultation-ready': 'consultation',
  'lead-broadcast': 'intake',
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface NeedsAttentionRow {
  id: string;
  icon: LucideIcon;
  iconColor: string;
  name: string;
  typeLabel: string;
  timeText: string;
  severity: number;
}

export default function BranchManagerOverview({ branch, students, counselorStudents, applications, counselors, staff, notifications }: BranchManagerOverviewProps) {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [activityPage, setActivityPage] = useState(1);
  const [period, setPeriod] = useState<PeriodKey>('6m');

  const branchApplications = useMemo(
    () => applications.filter((a) => a.branch === branch),
    [applications, branch]
  );

  // Treat the latest timestamp across students and this branch's applications as "now" —
  // the mock dataset has no live clock, so the latest timestamp anchors day/hour counts.
  const now = useMemo(() => {
    const studentDates = students
      .map((s) => parseSubmittedAt(s.submittedAt))
      .filter((d): d is Date => d !== null);
    const appNow = latestActivityDate(branchApplications);
    const all = [...studentDates, appNow];
    return all.reduce((latest, d) => (d > latest ? d : latest), all[0]);
  }, [students, branchApplications]);

  const start = useMemo(() => periodStart(period, now), [period, now]);
  const suffix = periodSuffix(period);

  const periodStudents = useMemo(() => {
    if (!start) return students;
    return students.filter((s) => {
      const submitted = parseSubmittedAt(s.submittedAt);
      return !!submitted && submitted >= start;
    });
  }, [students, start]);

  const periodApplications = useMemo(() => {
    if (!start) return applications;
    return applications.filter((a) => {
      const activity = latestActivityDateForApp(a);
      return !!activity && activity >= start;
    });
  }, [applications, start]);

  const stats = useMemo(
    () => computeBranchOverviewStats(branch, periodStudents, counselorStudents, periodApplications, staff),
    [branch, periodStudents, counselorStudents, periodApplications, staff]
  );

  const statCards: { key: string; icon: LucideIcon; value: number; label: string }[] = [
    { key: 'total-students', icon: GraduationCap, value: stats.totalStudentsThisMonth, label: `Total Clients · ${suffix}` },
    { key: 'active-consultations', icon: CalendarDays, value: stats.activeConsultations, label: 'Active Consultations' },
    { key: 'applications-in-progress', icon: FileText, value: stats.applicationsInProgress, label: 'Applications In Progress' },
  ];

  const needsAttention = useMemo<NeedsAttentionRow[]>(() => {
    const rows: NeedsAttentionRow[] = [];

    students
      .filter((s) => s.status === 'New')
      .forEach((s) => {
        const submitted = parseSubmittedAt(s.submittedAt);
        if (!submitted) return;
        const hours = (now.getTime() - submitted.getTime()) / (60 * 60 * 1000);
        if (hours <= STALE_STUDENT_HOURS) return;
        const days = Math.round(hours / 24);
        rows.push({
          id: `student-${s.id}`,
          icon: UserX,
          iconColor: 'bg-orange-50 text-orange-600',
          name: s.name,
          typeLabel: 'Client — unassigned',
          timeText: `unassigned ${days} day${days === 1 ? '' : 's'}`,
          severity: hours / 24,
        });
      });

    branchApplications
      .filter(isClientInProgress)
      .forEach((a) => {
        const days = daysInCurrentStatus(a, now);
        if (days < STALE_APPLICATION_DAYS) return;
        const status = getClientStatusLabel(a);
        rows.push({
          id: `application-${a.id}`,
          icon: FileClock,
          iconColor: 'bg-navy/5 text-navy',
          name: a.name,
          typeLabel: `Application — ${status}`,
          timeText: `${days} day${days === 1 ? '' : 's'} in ${status}`,
          severity: days,
        });
      });

    counselors
      .filter((c) => c.availability === 'Away')
      .forEach((c) => {
        rows.push({
          id: `counselor-${c.id}`,
          icon: UserMinus,
          iconColor: 'bg-gray-100 text-gray-500',
          name: c.name,
          typeLabel: 'Counselor — no activity',
          timeText: 'no activity today',
          severity: 0,
        });
      });

    return rows.sort((a, b) => b.severity - a.severity);
  }, [students, branchApplications, counselors, now]);

  const todaysActivity = useMemo<ActivityEntry[]>(() => {
    const today = new Date();
    return notifications
      .filter((n) => n.role === 'branch_manager' && n.branch === branch && isSameDay(n.createdAt, today))
      .filter((n) => activityFilter === 'all' || TRIGGER_TO_ACTIVITY_TYPE[n.trigger] === activityFilter)
      .map((n) => ({
        id: n.id,
        message: `${n.messageBefore}${n.studentName}${n.messageAfter}`,
        timestamp: formatRelativeTime(n.createdAt),
        type: TRIGGER_TO_ACTIVITY_TYPE[n.trigger],
      }));
  }, [notifications, branch, activityFilter]);

  const activityTotalPages = Math.max(1, Math.ceil(todaysActivity.length / ACTIVITY_PAGE_SIZE));

  useEffect(() => {
    setActivityPage(1);
  }, [activityFilter]);

  const pagedActivity = useMemo(() => {
    const start = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
    return todaysActivity.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [todaysActivity, activityPage]);

  return (
    <div className="space-y-6">
      {/* Greeting banner */}
      <GreetingBanner />

      {/* Report period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">Report period</p>
          <p className="text-xs text-gray-400">Showing figures for {suffix.toLowerCase()}</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>



      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.key} className="stat-card">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-lg bg-navy/5 flex items-center justify-center">
                  <Icon className="text-navy" size={22} />
                </div>
              </div>
              <p className="text-3xl font-bold text-navy">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          );
        })}

        {/* Decided This Month — merged Granted + Refused */}
        <div className="stat-card">
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-lg bg-navy/5 flex items-center justify-center">
              <CheckCircle className="text-navy" size={22} />
            </div>
          </div>
          <p className="text-3xl font-bold text-navy">
            {stats.decidedGranted + stats.decidedRefused}
          </p>
          <p className="text-sm text-gray-500 mt-1">Decided · {suffix}</p>
          <p className="text-xs mt-2 text-gray-400">
            {stats.decidedGranted} granted · {stats.decidedRefused} refused
          </p>
        </div>
      </div>

      {/* Needs attention + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="text-base font-semibold text-navy mb-4">Needs Attention</h3>
          {needsAttention.length > 0 ? (
            <div className="space-y-0">
              {needsAttention.map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.id} className="flex items-center gap-3 py-2.5 border-b border-grey-border last:border-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${row.iconColor}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy truncate">{row.name}</p>
                      <p className="text-xs text-gray-500 truncate">{row.typeLabel}</p>
                    </div>
                    <span className="text-xs text-amber-600 font-medium flex-shrink-0 ml-2 whitespace-nowrap">
                      {row.timeText}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Nothing needs attention — branch is running clear.</p>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="text-base font-semibold text-navy">Today's Activity</h3>
            <div className="flex items-center gap-1 flex-wrap">
              {ACTIVITY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setActivityFilter(f.value)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                    activityFilter === f.value
                      ? 'bg-navy text-white'
                      : 'bg-grey-bg text-gray-500 hover:text-navy'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {todaysActivity.length > 0 ? (
            <>
              <div className="space-y-1">
                {pagedActivity.map((entry, idx) => {
                  const Icon = ACTIVITY_ICONS[entry.type];
                  const colorClass = ACTIVITY_COLORS[entry.type];
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 py-3 border-b border-grey-border last:border-0"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon size={17} />
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="text-sm text-navy truncate">{entry.message}</p>
                        {activityPage === 1 && idx === 0 && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-green-700 bg-green-100 px-1.5 py-0.5 rounded flex-shrink-0">
                            New
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{entry.timestamp}</span>
                    </div>
                  );
                })}
              </div>
              {activityTotalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-grey-border">
                  <button
                    onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                    disabled={activityPage === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-navy hover:bg-grey-bg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-gray-500 font-medium">
                    {activityPage} of {activityTotalPages}
                  </span>
                  <button
                    onClick={() => setActivityPage((p) => Math.min(activityTotalPages, p + 1))}
                    disabled={activityPage === activityTotalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-navy hover:bg-grey-bg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No activity yet today.</p>
          )}
        </div>
      </div>
    </div>
  );
}
