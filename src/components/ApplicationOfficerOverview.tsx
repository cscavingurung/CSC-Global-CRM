import { useMemo, useState } from 'react';
import GreetingBanner from './GreetingBanner';
import { FileText, Send, CheckCircle2, AlertTriangle, type LucideIcon } from 'lucide-react';
import { ApplicationRecord } from '../types';
import {
  getClientStage, getStatusTone, STATUS_TONE_STYLES,
  daysInCurrentStatus, latestActivityDate, latestActivityDateForApp, recentActivity, monthKey,
  isVisaApproved, isVisaRefused, isClientInProgress,
} from '../clientPipeline';
import { PeriodKey, periodStart, periodSuffix } from '../reportPeriod';
import PeriodFilter from './PeriodFilter';

interface ApplicationOfficerOverviewProps {
  branch: string;
  applications: ApplicationRecord[];
}

const STALE_THRESHOLD_DAYS = 7;

interface StatCardDef {
  key: string;
  icon: LucideIcon;
  value: string;
  label: string;
  trend: string;
}

interface ActionRow {
  id: string;
  name: string;
  country: string;
  purpose: string;
  daysInStatus: number;
  notYetStarted: boolean;
}

function formatRelativeDay(date: Date, now: Date): string {
  const days = Math.round((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function ApplicationOfficerOverview({ branch, applications }: ApplicationOfficerOverviewProps) {
  const [period, setPeriod] = useState<PeriodKey>('6m');

  const allBranchApplications = useMemo(
    () => applications.filter((a) => a.branch === branch),
    [applications, branch]
  );

  const now = useMemo(() => latestActivityDate(allBranchApplications), [allBranchApplications]);
  const start = useMemo(() => periodStart(period, now), [period, now]);
  const suffix = periodSuffix(period);

  const branchApplications = useMemo(() => {
    if (!start) return allBranchApplications;
    return allBranchApplications.filter((a) => {
      const activity = latestActivityDateForApp(a);
      return !!activity && activity >= start;
    });
  }, [allBranchApplications, start]);

  const activeClients = useMemo(() => branchApplications.filter(isClientInProgress), [branchApplications]);
  const offerStage = useMemo(() => activeClients.filter((a) => getClientStage(a) === 'Offer'), [activeClients]);
  const visaStage = useMemo(() => activeClients.filter((a) => getClientStage(a) === 'Visa'), [activeClients]);

  const actionRequired = useMemo<ActionRow[]>(() => {
    return offerStage
      .map((a) => {
        const daysInStatus = daysInCurrentStatus(a, now);
        return {
          id: a.id,
          name: a.name,
          country: a.country,
          purpose: a.purpose,
          daysInStatus,
          notYetStarted: a.offerApplications.length === 0,
        };
      })
      .sort((a, b) => {
        if (a.notYetStarted !== b.notYetStarted) return a.notYetStarted ? -1 : 1;
        return b.daysInStatus - a.daysInStatus;
      });
  }, [offerStage, now]);

  const activity = useMemo(() => recentActivity(branchApplications, 5), [branchApplications]);

  const stats = useMemo<StatCardDef[]>(() => {
    const nowMonthKey = monthKey(now);
    const decidedThisMonth = branchApplications.filter((a) => {
      const outcomeDate = a.visaApplication?.outcomeDate;
      if (!outcomeDate || (!isVisaApproved(a) && !isVisaRefused(a))) return false;
      return monthKey(new Date(outcomeDate)) === nowMonthKey;
    });
    const approved = decidedThisMonth.filter(isVisaApproved).length;
    const refused = decidedThisMonth.filter(isVisaRefused).length;

    const needingAttention = activeClients.filter((a) => daysInCurrentStatus(a, now) >= STALE_THRESHOLD_DAYS);
    const longestStuck = needingAttention.reduce((max, a) => Math.max(max, daysInCurrentStatus(a, now)), 0);

    return [
      {
        key: 'offer',
        icon: FileText,
        value: String(offerStage.length),
        label: 'In Offer Stage',
        trend: offerStage.length === 0 ? 'Nothing in progress' : `${offerStage.filter((a) => a.offerApplications.length === 0).length} not yet started`,
      },
      {
        key: 'visa',
        icon: Send,
        value: String(visaStage.length),
        label: 'In Visa Stage',
        trend: visaStage.length === 0 ? 'None in visa stage' : `${visaStage.filter((a) => a.visaApplication === null).length} not yet started`,
      },
      {
        key: 'decided',
        icon: CheckCircle2,
        value: String(decidedThisMonth.length),
        label: 'Decided This Month',
        trend: decidedThisMonth.length === 0 ? 'None decided yet' : `${approved} approved, ${refused} refused`,
      },
      {
        key: 'attention',
        icon: AlertTriangle,
        value: String(needingAttention.length),
        label: 'Needs Attention',
        trend: needingAttention.length === 0 ? 'Nothing overdue' : `Longest stuck: ${longestStuck} day${longestStuck === 1 ? '' : 's'}`,
      },
    ];
  }, [offerStage, visaStage, activeClients, branchApplications, now]);

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

      {/* Action required + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="text-base font-semibold text-navy mb-4">Action Required — Offer Stage</h3>
          {actionRequired.length > 0 ? (
            <div className="space-y-0">
              {actionRequired.map((row) => {
                const stale = row.daysInStatus >= STALE_THRESHOLD_DAYS;
                return (
                  <div key={row.id} className="flex items-center justify-between py-2.5 border-b border-grey-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{row.name}</p>
                      <p className="text-xs text-gray-500 truncate">{row.country} — {row.purpose}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                        {row.notYetStarted ? 'Not Started' : 'Offer Stage'}
                      </span>
                      <span className={`text-xs ${stale ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                        {row.notYetStarted ? 'Handed over, no institution yet' : `${row.daysInStatus} day${row.daysInStatus === 1 ? '' : 's'} in current status`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Nothing needs attention — pipeline is current.</p>
          )}
        </div>

        <div className="stat-card">
          <h3 className="text-base font-semibold text-navy mb-4">Recent Activity</h3>
          {activity.length > 0 ? (
            <div className="space-y-0">
              {activity.map((row) => {
                const app = branchApplications.find((a) => a.name === row.name);
                const tone = app ? getStatusTone(app) : 'progress';
                return (
                  <div key={row.key} className="flex items-center justify-between py-2.5 border-b border-grey-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy truncate mb-1">{row.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_TONE_STYLES[tone]}`}>{row.description}</span>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2 whitespace-nowrap">{formatRelativeDay(row.date, now)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No recent activity.</p>
          )}
        </div>
      </div>
    </div>
  );
}

