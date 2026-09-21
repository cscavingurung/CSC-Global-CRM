import { useMemo, useState } from 'react';
import GreetingBanner from './GreetingBanner';
import { GraduationCap, Clock, CheckCircle, FileText, type LucideIcon } from 'lucide-react';
import { ApplicationRecord, CounselorStudent } from '../types';
import { parseSubmittedAt, dateKey } from '../dateTime';
import { getClientStage, latestActivityDateForApp, recentActivity } from '../clientPipeline';
import { LEAD_TEMPERATURE_STYLES } from '../leadTemperature';
import { PeriodKey, periodStart, periodSuffix } from '../reportPeriod';
import PeriodFilter from './PeriodFilter';

interface CounselorOverviewProps {
  counselorName: string;
  counselorStudents: CounselorStudent[];
  applications: ApplicationRecord[];
  /** When this counselor previously signed in — used to flag updates as new. */
  lastLoginAt?: Date | null;
}

interface StatCardDef {
  key: string;
  icon: LucideIcon;
  value: string;
  label: string;
  trend: string;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function prevMonthKey(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function CounselorOverview({ counselorName, counselorStudents, applications, lastLoginAt }: CounselorOverviewProps) {
  const [period, setPeriod] = useState<PeriodKey>('6m');

  const allMyStudents = useMemo(
    () => counselorStudents.filter((s) => s.assignedCounselor === counselorName),
    [counselorStudents, counselorName]
  );

  const allMyApplications = useMemo(
    () =>
      applications
        .filter((a) => a.counselor === counselorName)
        .map((a) => ({ app: a, date: latestActivityDateForApp(a) }))
        .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
        .map((x) => x.app),
    [applications, counselorName]
  );

  const now = useMemo(() => new Date(), []);

  const start = useMemo(() => periodStart(period, now), [period, now]);
  const suffix = periodSuffix(period);

  // Scoped by assignedDate (when the client became this counselor's) rather than the
  // original intake submittedAt — a client submitted long ago but only just assigned
  // should still count as "mine" for the selected reporting period.
  const myStudents = useMemo(() => {
    if (!start) return allMyStudents;
    const startKey = dateKey(start);
    return allMyStudents.filter((s) => s.assignedDate >= startKey);
  }, [allMyStudents, start]);

  const myApplications = useMemo(() => {
    if (!start) return allMyApplications;
    return allMyApplications.filter((a) => {
      const activity = latestActivityDateForApp(a);
      return !!activity && activity >= start;
    });
  }, [allMyApplications, start]);

  const stats = useMemo<StatCardDef[]>(() => {
    const awaiting = myStudents.filter((s) => s.consultationStatus === 'Awaiting Consultation');
    const inProgress = myStudents.filter((s) => s.consultationStatus === 'In Progress');
    const awaitingOver24h = awaiting.filter((s) => {
      const submitted = parseSubmittedAt(s.submittedAt);
      return submitted !== null && now.getTime() - submitted.getTime() > 24 * 60 * 60 * 1000;
    }).length;

    const nowKey = dateKey(now);
    const completed = myStudents.filter((s) => s.consultationStatus === 'Consultation Complete' && s.completedDate);
    const completedThisMonth = completed.filter((s) => monthKey(s.completedDate as string) === monthKey(nowKey)).length;
    const completedLastMonth = completed.filter((s) => monthKey(s.completedDate as string) === prevMonthKey(nowKey)).length;
    const completedDiff = completedThisMonth - completedLastMonth;
    const completedTrend =
      completedDiff > 0 ? `+${completedDiff} vs last month` : completedDiff < 0 ? `${completedDiff} vs last month` : 'Same as last month';

    const inVisaStage = myApplications.filter((a) => getClientStage(a) === 'Visa').length;

    return [
      {
        key: 'my-students',
        icon: GraduationCap,
        value: String(myStudents.length),
        label: `My Clients · ${suffix}`,
        trend: `${inProgress.length} in progress`,
      },
      {
        key: 'awaiting',
        icon: Clock,
        value: String(awaiting.length),
        label: 'Awaiting Consultation',
        trend: awaitingOver24h === 0 ? 'None waiting over 24 hrs' : `${awaitingOver24h} waiting over 24 hrs`,
      },
      {
        key: 'completed',
        icon: CheckCircle,
        value: String(completed.length),
        label: `Completed · ${suffix}`,
        trend: `${completedThisMonth} this month · ${completedTrend}`,
      },
      {
        key: 'in-application',
        icon: FileText,
        value: String(myApplications.length),
        label: 'In Application',
        trend: inVisaStage === 0 ? 'None in visa stage' : `${inVisaStage} in visa stage`,
      },
    ];
  }, [myStudents, myApplications, now, suffix]);

  // Follow-ups this counselor scheduled — soonest first, overdue ones kept visible.
  const upcomingFollowUps = useMemo(
    () =>
      allMyStudents
        .filter((s) => s.consultationStatus === 'Follow Up' && !!s.followUpDate)
        .sort((a, b) => ((a.followUpDate as string) < (b.followUpDate as string) ? -1 : 1))
        .slice(0, 6),
    [allMyStudents]
  );

  // Activity feed on this counselor's clients.
  const updates = useMemo(() => recentActivity(allMyApplications, 6), [allMyApplications]);
  const newUpdateCount = useMemo(
    () => (lastLoginAt ? recentActivity(allMyApplications, 200).filter((e) => e.date > lastLoginAt).length : 0),
    [allMyApplications, lastLoginAt]
  );


  return (
    <div className="space-y-6">
      {/* Greeting banner */}
      <GreetingBanner name={counselorName} />

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
        {stats.map((stat) => {
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
              <p className="text-xs mt-2 text-gray-400">{stat.trend}</p>
            </div>
          );
        })}
      </div>

      {/* Upcoming follow-ups + client updates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="text-base font-semibold text-navy mb-4">Upcoming Follow-ups</h3>
          {upcomingFollowUps.length > 0 ? (
            <div className="space-y-0">
              {upcomingFollowUps.map((s) => {
                const due = new Date(`${s.followUpDate}T00:00:00`);
                const isOverdue = dateKey(due) < dateKey(new Date());
                const isToday = dateKey(due) === dateKey(new Date());
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-grey-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{s.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {isOverdue ? 'Overdue · ' : isToday ? 'Today · ' : ''}
                        {due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    {s.leadTemperature && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${LEAD_TEMPERATURE_STYLES[s.leadTemperature]}`}>
                        {s.leadTemperature}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No follow-ups scheduled.</p>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-navy">My Clients' Updates</h3>
            <span className="text-xs text-gray-400">
              {newUpdateCount > 0 ? `${newUpdateCount} since your last sign-in` : 'Nothing new since your last sign-in'}
            </span>
          </div>
          {updates.length > 0 ? (
            <div className="space-y-0">
              {updates.map((event) => {
                const isNew = !!lastLoginAt && event.date > lastLoginAt;
                return (
                  <div key={event.key} className="flex items-center justify-between gap-2 py-2.5 border-b border-grey-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{event.name}</p>
                      <p className="text-xs text-gray-500 truncate">{event.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isNew && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-navy/10 text-navy">New</span>}
                      <span className="text-xs text-gray-400">
                        {event.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No updates on your clients yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
