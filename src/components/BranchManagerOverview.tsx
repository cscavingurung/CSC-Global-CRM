import { useEffect, useMemo, useState } from 'react';
import GreetingBanner from './GreetingBanner';
import {
  GraduationCap, CalendarDays, FileText, CheckCircle,
  UserCheck, RefreshCw, UserPlus, ClipboardList,
  UserX, FileClock, UserMinus, ChevronLeft, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { ActivityEntry, AppNotification, ApplicationRecord, Counselor, CounselorStudent, IntakeStudent, NavIntent, StaffMember } from '../types';
import { CLICKABLE_CARD, CLICKABLE_ROW } from './clickable';
import { parseSubmittedAt, formatActivityTime } from '../dateTime';
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
  onNavigate?: (key: string, intent?: NavIntent) => void;
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
  { value: 'intake', label: 'Leads' },
  { value: 'assignment', label: 'Assignments' },
  { value: 'status', label: 'Status Changes' },
];

const ACTIVITY_PAGE_SIZE = 10;
const STALE_APPLICATION_DAYS = 7;
const STALE_STUDENT_HOURS = 24;

type ActivityFilter = 'all' | ActivityEntry['type'];

// Activity is derived live from the branch-scoped notifications created alongside
// New Intake / Assign Counselor / Consultation Ready / Status Tracker updates (see
// createBranchManagerNotification and createStatusUpdateNotification in src/notifications.ts)
// rather than the static, never-written-to activity_feed table.
const TRIGGER_TO_ACTIVITY_TYPE: Record<AppNotification['trigger'], ActivityEntry['type']> = {
  'new-intake': 'intake',
  'assigned-to-counselor': 'assignment',
  'consultation-ready': 'consultation',
  'lead-broadcast': 'intake',
  'city-lead-broadcast': 'intake',
  'status-update': 'status',
};

interface NeedsAttentionRow {
  id: string;
  icon: LucideIcon;
  iconColor: string;
  name: string;
  typeLabel: string;
  timeText: string;
  severity: number;
  navKey: string;
  intent?: NavIntent;
}

export default function BranchManagerOverview({ branch, students, counselorStudents, applications, counselors, staff, notifications, onNavigate }: BranchManagerOverviewProps) {
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

  const statCards: { key: string; icon: LucideIcon; value: number; label: string; navKey: string; intent?: NavIntent }[] = [
    { key: 'total-students', icon: GraduationCap, value: stats.totalStudentsThisMonth, label: `Total Clients · ${suffix}`, navKey: 'students' },
    { key: 'active-consultations', icon: CalendarDays, value: stats.activeConsultations, label: 'Active Consultations', navKey: 'students', intent: { clientStage: 'Assigned' } },
    { key: 'applications-in-progress', icon: FileText, value: stats.applicationsInProgress, label: 'Applications In Progress', navKey: 'applications' },
  ];

  const needsAttention = useMemo<NeedsAttentionRow[]>(() => {
    const rows: NeedsAttentionRow[] = [];

    periodStudents
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
          navKey: 'students',
          intent: { clientStage: 'New', search: s.name },
        });
      });

    periodApplications
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
          navKey: 'applications',
          intent: { openClientId: a.id },
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
          navKey: 'staff',
          intent: { openStaffName: c.name },
        });
      });

    return rows.sort((a, b) => b.severity - a.severity);
  }, [periodStudents, periodApplications, counselors, now]);

  // Same report-period window as the stat cards above, so switching the period filter updates
  // this feed too instead of only the cards.
  const periodActivity = useMemo<ActivityEntry[]>(() => {
    return notifications
      .filter((n) => n.role === 'branch_manager' && n.branch === branch && (!start || n.createdAt >= start))
      .filter((n) => activityFilter === 'all' || TRIGGER_TO_ACTIVITY_TYPE[n.trigger] === activityFilter)
      .map((n) => ({
        id: n.id,
        message: `${n.messageBefore}${n.studentName}${n.messageAfter}`,
        timestamp: `${formatActivityTime(n.createdAt)} · ${formatRelativeTime(n.createdAt)}`,
        by: n.actorName,
        type: TRIGGER_TO_ACTIVITY_TYPE[n.trigger],
      }));
  }, [notifications, branch, activityFilter, start]);

  // Activity rows come from notifications — open the application profile when the entry is
  // about an application, otherwise land on Clients searched to that name.
  const openActivity = (notificationId: string) => {
    const n = notifications.find((x) => x.id === notificationId);
    if (!n) return;
    const app = n.studentName ? applications.find((a) => a.name === n.studentName) : undefined;
    if (n.navigateTo === 'applications' || n.trigger === 'status-update') {
      onNavigate?.('applications', app ? { openClientId: app.id } : { search: n.studentName });
    } else {
      onNavigate?.('students', n.studentName ? { search: n.studentName } : undefined);
    }
  };

  const activityTotalPages = Math.max(1, Math.ceil(periodActivity.length / ACTIVITY_PAGE_SIZE));

  useEffect(() => {
    setActivityPage(1);
  }, [activityFilter]);

  const pagedActivity = useMemo(() => {
    const pageStart = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
    return periodActivity.slice(pageStart, pageStart + ACTIVITY_PAGE_SIZE);
  }, [periodActivity, activityPage]);

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
            <button
              key={stat.key}
              type="button"
              onClick={() => onNavigate?.(stat.navKey, stat.intent)}
              className={`stat-card ${CLICKABLE_CARD}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-lg bg-navy/5 flex items-center justify-center">
                  <Icon className="text-navy" size={22} />
                </div>
                <ChevronRight size={18} className="text-gray-300 transition-colors group-hover:text-navy" />
              </div>
              <p className="text-3xl font-bold text-navy">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </button>
          );
        })}

        {/* Decided This Month — merged Granted + Refused */}
        <button
          type="button"
          onClick={() => onNavigate?.('applications', { appStage: 'Visa' })}
          className={`stat-card ${CLICKABLE_CARD}`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-lg bg-navy/5 flex items-center justify-center">
              <CheckCircle className="text-navy" size={22} />
            </div>
            <ChevronRight size={18} className="text-gray-300 transition-colors group-hover:text-navy" />
          </div>
          <p className="text-3xl font-bold text-navy">
            {stats.decidedGranted + stats.decidedRefused}
          </p>
          <p className="text-sm text-gray-500 mt-1">Decided · {suffix}</p>
          <p className="text-xs mt-2 text-gray-400">
            {stats.decidedGranted} granted · {stats.decidedRefused} refused
          </p>
        </button>
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
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => onNavigate?.(row.navKey, row.intent)}
                    className={`flex items-center gap-3 py-2.5 border-b border-grey-border last:border-0 ${CLICKABLE_ROW}`}
                  >
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
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Nothing needs attention — branch is running clear.</p>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="text-base font-semibold text-navy">Activity · {suffix}</h3>
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
          {periodActivity.length > 0 ? (
            <>
              <div className="space-y-1">
                {pagedActivity.map((entry, idx) => {
                  const Icon = ACTIVITY_ICONS[entry.type];
                  const colorClass = ACTIVITY_COLORS[entry.type];
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => openActivity(entry.id)}
                      className={`flex items-center gap-3 py-3 border-b border-grey-border last:border-0 ${CLICKABLE_ROW}`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon size={17} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-navy truncate">{entry.message}</p>
                          {activityPage === 1 && idx === 0 && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-green-700 bg-green-100 px-1.5 py-0.5 rounded flex-shrink-0">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {entry.timestamp}{entry.by ? ` · by ${entry.by}` : ''}
                        </p>
                      </div>
                    </button>
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
            <p className="text-sm text-gray-400 text-center py-6">No activity in this period.</p>
          )}
        </div>
      </div>
    </div>
  );
}
