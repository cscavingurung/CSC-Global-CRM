import { useMemo, useState } from 'react';
import GreetingBanner from './GreetingBanner';
import {
  GraduationCap, CalendarDays, FileText, CheckCircle,
  ArrowUp, ArrowDown, ArrowUpDown, UserX, FileClock, TrendingDown, type LucideIcon,
} from 'lucide-react';
import { Branch, IntakeStudent, CounselorStudent, ApplicationRecord, StaffMember } from '../types';
import { parseSubmittedAt } from '../dateTime';
import { daysInCurrentStatus, latestActivityDate, latestActivityDateForApp, isClientInProgress, getClientStatusLabel } from '../clientPipeline';
import { computeBranchLiveStats, computeCompanyOverviewStats } from '../branchLiveStats';
import { PeriodKey, periodStart, periodSuffix } from '../reportPeriod';
import PeriodFilter from './PeriodFilter';

interface SuperAdminOverviewProps {
  branches: Branch[];
  staff: StaffMember[];
  students: IntakeStudent[];
  counselorStudents: CounselorStudent[];
  applications: ApplicationRecord[];
}

const STALE_STUDENT_HOURS = 24;
const STALE_APPLICATION_DAYS = 7;
const SUCCESS_RATE_GAP_THRESHOLD = 10;

type SortKey = 'name' | 'manager' | 'staffCount' | 'activeStudents' | 'applicationsInProgress' | 'visasGranted' | 'successRate';

interface BranchRow extends Branch {
  staffCount: number;
  activeStudents: number;
  applicationsInProgress: number;
  visasGranted: number;
  visasRefused: number;
  successRate: number;
}

interface AttentionRow {
  id: string;
  branch: string;
  description: string;
  metricText: string;
  severity: number;
}

function successRateOf(granted: number, refused: number): number {
  return granted + refused > 0 ? (granted / (granted + refused)) * 100 : 0;
}

export default function SuperAdminOverview({ branches, staff, students, counselorStudents, applications }: SuperAdminOverviewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('activeStudents');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [period, setPeriod] = useState<PeriodKey>('6m');

  // Treat the latest timestamp across all students and applications as "now" — the mock
  // dataset has no live clock, so the latest timestamp anchors the report windows.
  const now = useMemo(() => {
    const studentDates = students.map((s) => parseSubmittedAt(s.submittedAt)).filter((d): d is Date => d !== null);
    const appNow = latestActivityDate(applications);
    const all = [...studentDates, appNow, new Date()];
    return all.reduce((latest, d) => (d > latest ? d : latest), all[0]);
  }, [students, applications]);

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
    () => computeCompanyOverviewStats(periodStudents, counselorStudents, periodApplications),
    [periodStudents, counselorStudents, periodApplications]
  );

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'manager' ? 'asc' : 'desc');
    }
  };

  const branchRows = useMemo<BranchRow[]>(
    () => branches.map((b) => {
      const live = computeBranchLiveStats(b.name, staff, periodStudents, periodApplications);
      return { ...b, ...live, successRate: successRateOf(live.visasGranted, live.visasRefused) };
    }),
    [branches, staff, periodStudents, periodApplications]
  );

  const sortedBranches = useMemo(() => {
    const getValue = (b: BranchRow): string | number => {
      switch (sortKey) {
        case 'name': return b.name;
        case 'manager': return b.manager ?? '';
        case 'staffCount': return b.staffCount;
        case 'activeStudents': return b.activeStudents;
        case 'applicationsInProgress': return b.applicationsInProgress;
        case 'visasGranted': return b.visasGranted;
        case 'successRate': return b.successRate;
      }
    };
    return [...branchRows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [branchRows, sortKey, sortDir]);

  const totals = useMemo(() => {
    const staffCount = branchRows.reduce((s, b) => s + b.staffCount, 0);
    const activeStudents = branchRows.reduce((s, b) => s + b.activeStudents, 0);
    const applicationsInProgress = branchRows.reduce((s, b) => s + b.applicationsInProgress, 0);
    const visasGranted = branchRows.reduce((s, b) => s + b.visasGranted, 0);
    const visasRefused = branchRows.reduce((s, b) => s + b.visasRefused, 0);
    return {
      staffCount, activeStudents, applicationsInProgress, visasGranted,
      successRate: successRateOf(visasGranted, visasRefused),
    };
  }, [branchRows]);


  const attentionRows = useMemo<AttentionRow[]>(() => {
    const rows: AttentionRow[] = [];

    const unassignedByBranch = new Map<string, { count: number; oldestDays: number }>();
    periodStudents
      .filter((s) => s.status === 'New')
      .forEach((s) => {
        const submitted = parseSubmittedAt(s.submittedAt);
        if (!submitted) return;
        const hours = (now.getTime() - submitted.getTime()) / (60 * 60 * 1000);
        if (hours <= STALE_STUDENT_HOURS) return;
        const days = Math.round(hours / 24);
        const existing = unassignedByBranch.get(s.branch);
        if (existing) {
          existing.count += 1;
          existing.oldestDays = Math.max(existing.oldestDays, days);
        } else {
          unassignedByBranch.set(s.branch, { count: 1, oldestDays: days });
        }
      });
    unassignedByBranch.forEach((info, branch) => {
      rows.push({
        id: `unassigned-${branch}`,
        branch,
        description: `${info.count} student${info.count === 1 ? '' : 's'} unassigned`,
        metricText: `oldest ${info.oldestDays} day${info.oldestDays === 1 ? '' : 's'}`,
        severity: info.oldestDays,
      });
    });

    const staleAppsByBranch = new Map<string, Map<string, { count: number; oldestDays: number }>>();
    periodApplications
      .filter(isClientInProgress)
      .forEach((a) => {
        const days = daysInCurrentStatus(a, now);
        if (days < STALE_APPLICATION_DAYS) return;
        const status = getClientStatusLabel(a);
        if (!staleAppsByBranch.has(a.branch)) staleAppsByBranch.set(a.branch, new Map());
        const statusMap = staleAppsByBranch.get(a.branch)!;
        const existing = statusMap.get(status);
        if (existing) {
          existing.count += 1;
          existing.oldestDays = Math.max(existing.oldestDays, days);
        } else {
          statusMap.set(status, { count: 1, oldestDays: days });
        }
      });
    staleAppsByBranch.forEach((statusMap, branch) => {
      statusMap.forEach((info, status) => {
        rows.push({
          id: `stale-${branch}-${status}`,
          branch,
          description: `${info.count} application${info.count === 1 ? '' : 's'} stuck in ${status}`,
          metricText: `oldest ${info.oldestDays} day${info.oldestDays === 1 ? '' : 's'}`,
          severity: info.oldestDays,
        });
      });
    });

    branchRows.forEach((b) => {
      if (b.visasGranted + b.visasRefused === 0) return;
      const gap = totals.successRate - b.successRate;
      if (gap >= SUCCESS_RATE_GAP_THRESHOLD) {
        rows.push({
          id: `rate-${b.id}`,
          branch: b.name,
          description: `Success rate ${b.successRate.toFixed(0)}% (company avg ${totals.successRate.toFixed(0)}%)`,
          metricText: `${gap.toFixed(0)}pts below avg`,
          severity: gap,
        });
      }
    });

    return rows.sort((a, b) => b.severity - a.severity);
  }, [periodStudents, periodApplications, branchRows, totals.successRate, now]);

  const decidedTotal = stats.decidedGranted + stats.decidedRefused;

  const statCards: { key: string; icon: LucideIcon; value: number; label: string }[] = [
    { key: 'total-students', icon: GraduationCap, value: periodStudents.length, label: `Total Clients · ${suffix}` },
    { key: 'active-consultations', icon: CalendarDays, value: stats.activeConsultations, label: 'Active Consultations' },
    { key: 'applications-in-progress', icon: FileText, value: stats.applicationsInProgress, label: 'Applications In Progress' },
  ];

  const columns: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'name', label: 'Branch', align: 'left' },
    { key: 'manager', label: 'Manager', align: 'left' },
    { key: 'staffCount', label: 'Staff', align: 'right' },
    { key: 'activeStudents', label: 'Active Clients', align: 'right' },
    { key: 'applicationsInProgress', label: 'Apps In Progress', align: 'right' },
    { key: 'visasGranted', label: 'Visas Granted', align: 'right' },
    { key: 'successRate', label: 'Success Rate', align: 'right' },
  ];

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (colKey !== sortKey) return <ArrowUpDown size={12} className="text-gray-300" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-navy" /> : <ArrowDown size={12} className="text-navy" />;
  };

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
          <p className="text-3xl font-bold text-navy">{decidedTotal}</p>
          <p className="text-sm text-gray-500 mt-1">Decided · {suffix}</p>
          <p className="text-xs mt-2 text-gray-400">
            {stats.decidedGranted} granted · {stats.decidedRefused} refused
          </p>
        </div>
      </div>

      {/* Branch comparison table */}
      <div className="stat-card">
        <h3 className="text-base font-semibold text-navy mb-1">Branch Performance Comparison</h3>
        <p className="text-xs text-gray-400 mb-5">
          Key metrics across all branches · {branches.length} branches · {totals.staffCount} staff
        </p>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-grey-border">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`text-xs font-semibold text-gray-500 py-2.5 cursor-pointer select-none hover:text-navy transition-colors ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                      {col.label}
                      <SortIcon colKey={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedBranches.map((b) => (
                <tr key={b.id} className="border-b border-grey-border last:border-0">
                  <td className="py-3 text-sm font-medium text-navy">{b.name}</td>
                  <td className="py-3 text-sm text-gray-600">{b.manager || 'Unassigned'}</td>
                  <td className="py-3 text-sm text-gray-600 text-right">{b.staffCount}</td>
                  <td className="py-3 text-sm text-gray-600 text-right">{b.activeStudents}</td>
                  <td className="py-3 text-sm text-gray-600 text-right">{b.applicationsInProgress}</td>
                  <td className="py-3 text-sm text-green-600 font-medium text-right">{b.visasGranted}</td>
                  <td className="py-3 text-sm text-navy font-medium text-right">{b.successRate.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy/20">
                <td className="py-3 text-sm font-bold text-navy">Company Total</td>
                <td className="py-3 text-sm text-gray-400">—</td>
                <td className="py-3 text-sm font-bold text-navy text-right">{totals.staffCount}</td>
                <td className="py-3 text-sm font-bold text-navy text-right">{totals.activeStudents}</td>
                <td className="py-3 text-sm font-bold text-navy text-right">{totals.applicationsInProgress}</td>
                <td className="py-3 text-sm font-bold text-green-600 text-right">{totals.visasGranted}</td>
                <td className="py-3 text-sm font-bold text-navy text-right">{totals.successRate.toFixed(0)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-3">
          {sortedBranches.map((b) => (
            <div key={b.id} className="border border-grey-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-navy">{b.name}</p>
                <span className="text-xs text-gray-400">{b.manager || 'Unassigned'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <p>Staff: <span className="text-gray-700 font-medium">{b.staffCount}</span></p>
                <p>Clients: <span className="text-gray-700 font-medium">{b.activeStudents}</span></p>
                <p>In Progress: <span className="text-gray-700 font-medium">{b.applicationsInProgress}</span></p>
                <p>Granted: <span className="text-green-600 font-medium">{b.visasGranted}</span></p>
                <p className="col-span-2">Success Rate: <span className="text-navy font-medium">{b.successRate.toFixed(0)}%</span></p>
              </div>
            </div>
          ))}
          <div className="border-2 border-navy/20 rounded-xl p-4">
            <p className="text-sm font-bold text-navy mb-3">Company Total</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <p>Staff: <span className="text-navy font-bold">{totals.staffCount}</span></p>
              <p>Clients: <span className="text-navy font-bold">{totals.activeStudents}</span></p>
              <p>In Progress: <span className="text-navy font-bold">{totals.applicationsInProgress}</span></p>
              <p>Granted: <span className="text-green-600 font-bold">{totals.visasGranted}</span></p>
              <p className="col-span-2">Success Rate: <span className="text-navy font-bold">{totals.successRate.toFixed(0)}%</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Branches needing attention */}
      <div className="stat-card">
        <h3 className="text-base font-semibold text-navy mb-4">Branches Needing Attention</h3>
        {attentionRows.length > 0 ? (
          <div className="space-y-0">
            {attentionRows.map((row) => {
              const Icon = row.id.startsWith('unassigned-') ? UserX : row.id.startsWith('stale-') ? FileClock : TrendingDown;
              return (
                <div key={row.id} className="flex items-center gap-3 py-2.5 border-b border-grey-border last:border-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-navy/5 text-navy">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy truncate">{row.branch}</p>
                    <p className="text-xs text-gray-500 truncate">{row.description}</p>
                  </div>
                  <span className="text-xs text-amber-600 font-medium flex-shrink-0 ml-2 whitespace-nowrap">
                    {row.metricText}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">All branches operating normally.</p>
        )}
      </div>
    </div>
  );
}
