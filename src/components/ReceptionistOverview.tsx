import { useMemo, useState } from 'react';
import GreetingBanner from './GreetingBanner';
import { UserX, UserPlus, Clock, UserCheck, type LucideIcon } from 'lucide-react';
import { Counselor, CounselorStudent, ConsultationStatus, IntakeStudent } from '../types';
import { AVAILABILITY_STYLES, sortByAvailability } from '../counselorStatus';
import { parseSubmittedAt, dateKey, formatWait } from '../dateTime';
import { PeriodKey, periodStart, periodSuffix } from '../reportPeriod';
import PeriodFilter from './PeriodFilter';

interface ReceptionistOverviewProps {
  students: IntakeStudent[];
  upcomingConsultations: CounselorStudent[];
  counselors: Counselor[];
}

interface StatCardDef {
  key: string;
  icon: LucideIcon;
  value: string;
  label: string;
  trend: string;
  emphasized?: boolean;
}

interface QueueRow {
  id: string;
  name: string;
  country: string;
  purpose: string;
  assignedCounselor: string;
  consultationStatus: ConsultationStatus;
  assignedAt: Date | null;
  waitMinutes: number;
}

const WAIT_HIGHLIGHT_THRESHOLD_MIN = 30;

export default function ReceptionistOverview({ students, upcomingConsultations, counselors }: ReceptionistOverviewProps) {
  const [period, setPeriod] = useState<PeriodKey>('6m');

  // Treat the most recent submission across both students and the counselor queue as "now" —
  // the mock dataset has no live clock, so the latest timestamp anchors "today" / wait times.
  const now = useMemo(() => {
    const timestamps = [
      ...students.map((s) => parseSubmittedAt(s.submittedAt)),
      ...upcomingConsultations.map((s) => parseSubmittedAt(s.submittedAt)),
    ].filter((d): d is Date => d !== null);
    if (timestamps.length === 0) return new Date();
    return timestamps.reduce((latest, d) => (d > latest ? d : latest), timestamps[0]);
  }, [students, upcomingConsultations]);

  const start = useMemo(() => periodStart(period, now), [period, now]);
  const suffix = periodSuffix(period);



  const inQueue = useMemo<QueueRow[]>(() => {
    return upcomingConsultations
      .filter((s) => s.consultationStatus === 'Awaiting Consultation' || s.consultationStatus === 'In Progress')
      .map((s) => {
        const assignedAt = parseSubmittedAt(s.submittedAt);
        return {
          id: s.id,
          name: s.name,
          country: s.country,
          purpose: s.purpose,
          assignedCounselor: s.assignedCounselor,
          consultationStatus: s.consultationStatus,
          assignedAt,
          waitMinutes: assignedAt ? Math.max(0, (now.getTime() - assignedAt.getTime()) / 60000) : 0,
        };
      })
      .sort((a, b) => (a.assignedAt?.getTime() ?? 0) - (b.assignedAt?.getTime() ?? 0))
      .slice(0, 5);
  }, [upcomingConsultations, now]);

  const stats = useMemo<StatCardDef[]>(() => {
    const submissions = students
      .map((s) => ({ student: s, date: parseSubmittedAt(s.submittedAt) }))
      .filter((x): x is { student: IntakeStudent; date: Date } => x.date !== null);

    const todayKey = dateKey(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = dateKey(yesterday);

    const unassigned = submissions.filter((x) => x.student.status === 'New');
    const waitingOver24h = unassigned.filter((x) => now.getTime() - x.date.getTime() > 24 * 60 * 60 * 1000).length;

    const todaysIntakes = submissions.filter((x) => dateKey(x.date) === todayKey).length;
    const yesterdaysIntakes = submissions.filter((x) => dateKey(x.date) === yesterdayKey).length;
    const intakeDiff = todaysIntakes - yesterdaysIntakes;
    const intakeTrend =
      intakeDiff > 0 ? `+${intakeDiff} vs yesterday` : intakeDiff < 0 ? `${intakeDiff} vs yesterday` : 'Same as yesterday';
    const periodIntakes = start ? submissions.filter((x) => x.date >= start).length : submissions.length;

    const awaitingConsultation = upcomingConsultations.filter((s) => s.consultationStatus === 'Awaiting Consultation');
    const waitingNow = unassigned.length + awaitingConsultation.length;

    const waitingTodayMinutes = [
      ...unassigned.filter((x) => dateKey(x.date) === todayKey).map((x) => x.date),
      ...awaitingConsultation
        .map((s) => parseSubmittedAt(s.submittedAt))
        .filter((d): d is Date => d !== null && dateKey(d) === todayKey),
    ].map((d) => Math.round((now.getTime() - d.getTime()) / 60000));
    const longestWait = waitingTodayMinutes.length > 0 ? Math.max(...waitingTodayMinutes) : null;

    const availableCounselors = counselors.filter((c) => c.availability === 'Available');
    const inSession = counselors.filter((c) => c.availability === 'In Session').length;

    return [
      {
        key: 'unassigned',
        icon: UserX,
        value: String(unassigned.length),
        label: 'Unassigned Clients',
        trend: waitingOver24h === 0 ? 'None waiting over 24 hrs' : `${waitingOver24h} waiting over 24 hrs`,
        emphasized: true,
      },
      {
        key: 'today',
        icon: UserPlus,
        value: String(periodIntakes),
        label: `Intakes · ${suffix}`,
        trend: `${todaysIntakes} today · ${intakeTrend}`,
      },
      {
        key: 'waiting',
        icon: Clock,
        value: String(waitingNow),
        label: 'Waiting Now',
        trend: longestWait === null ? 'No one waiting today' : `Longest wait: ${longestWait} min`,
      },
      {
        key: 'counselors',
        icon: UserCheck,
        value: `${availableCounselors.length} / ${counselors.length}`,
        label: 'Counselors Available',
        trend: inSession === 0 ? 'None in session' : `${inSession} in session`,
      },
    ];
  }, [students, upcomingConsultations, counselors, now, start, suffix]);

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
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.key}
              className={`stat-card ${stat.emphasized ? 'border-2 border-navy/30 bg-navy/[0.03]' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${stat.emphasized ? 'bg-navy/10' : 'bg-navy/5'}`}>
                  <Icon className="text-navy" size={22} />
                </div>
              </div>
              <p className={`font-bold text-navy ${stat.emphasized ? 'text-4xl' : 'text-3xl'}`}>{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              <p className="text-xs mt-2 text-gray-400">{stat.trend}</p>
            </div>
          );
        })}
      </div>

      {/* Recent activity placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="text-base font-semibold text-navy mb-4">In Queue</h3>
          {inQueue.length > 0 ? (
            <div className="space-y-0">
              {inQueue.map((entry) => {
                const overdue = entry.waitMinutes > WAIT_HIGHLIGHT_THRESHOLD_MIN;
                const waiting = entry.consultationStatus === 'Awaiting Consultation';
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between py-2.5 pl-3 -ml-3 border-b border-l-2 border-grey-border last:border-b-0 ${
                      overdue ? 'border-l-orange-400' : 'border-l-transparent'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{entry.name}</p>
                      <p className="text-xs text-gray-500 truncate">{entry.country} — {entry.purpose}</p>
                      <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <span className="truncate min-w-0">{entry.assignedCounselor}</span>
                        <span className="text-gray-300 flex-shrink-0">·</span>
                        <span className={`inline-flex items-center gap-0.5 flex-shrink-0 ${overdue ? 'text-orange-600 font-medium' : ''}`}>
                          <Clock size={11} />
                          {formatWait(entry.waitMinutes)}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${
                        waiting ? 'bg-orange-100 text-orange-700' : 'bg-navy text-white'
                      }`}
                    >
                      {waiting ? 'Waiting' : 'In Progress'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No clients waiting — queue is clear.</p>
          )}
        </div>

        <div className="stat-card">
          <h3 className="text-base font-semibold text-navy mb-4">Counselor Status</h3>
          <div className="space-y-0">
            {sortByAvailability(counselors).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-grey-border last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.countries.join(', ') || '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.activeAssignments} assigned clients</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${AVAILABILITY_STYLES[c.availability]}`}>
                  {c.availability}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
