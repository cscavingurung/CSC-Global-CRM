import { useMemo, useState } from 'react';
import GreetingBanner from './GreetingBanner';
import { GraduationCap, Clock, BadgeCheck, Megaphone, ChevronRight, Lock, type LucideIcon } from 'lucide-react';
import { ApplicationRecord, CounselorStudent, NavIntent } from '../types';
import { CounselorRequest } from '../counselorMarketing';
import { clientIdFor } from '../clientId';
import { CLICKABLE_CARD, CLICKABLE_ROW } from './clickable';
import { parseSubmittedAt, dateKey, formatActivityTime } from '../dateTime';
import { latestActivityDateForApp, recentActivity } from '../clientPipeline';
import { LEAD_TEMPERATURE_STYLES } from '../leadTemperature';
import { PeriodKey, periodStart, periodSuffix } from '../reportPeriod';
import PeriodFilter from './PeriodFilter';
import { useFinanceLedger } from '../financeLedger';
import { DUE_STYLES, DueStatus, clientBalances, isLivePayment, isPaidOutRefund, planSummaries, rs } from '../finance';

interface CounselorOverviewProps {
  counselorName: string;
  counselorStudents: CounselorStudent[];
  applications: ApplicationRecord[];
  /** When this counselor previously signed in — used to flag updates as new. */
  lastLoginAt?: Date | null;
  /** Marketing content requests addressed to this counselor (their Marketing tab). */
  marketingRequests?: CounselorRequest[];
  onNavigate?: (key: string, intent?: NavIntent) => void;
}

interface StatCardDef {
  key: string;
  icon: LucideIcon;
  value: string;
  label: string;
  trend: string;
  emphasized?: boolean;
  /** Emphasis colour when emphasized (default amber). */
  tone?: 'amber' | 'red';
  /** Where clicking the card takes the counselor. */
  navKey: string;
  intent?: NavIntent;
}

export default function CounselorOverview({ counselorName, counselorStudents, applications, lastLoginAt, marketingRequests = [], onNavigate }: CounselorOverviewProps) {
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

  // Treat the most recent submission among this counselor's students as "now" — the mock
  // dataset has no live clock, so the latest timestamp anchors "this month" / wait times.
  const now = useMemo(() => {
    const timestamps = allMyStudents.map((s) => parseSubmittedAt(s.submittedAt)).filter((d): d is Date => d !== null);
    if (timestamps.length === 0) return new Date();
    return timestamps.reduce((latest, d) => (d > latest ? d : latest), timestamps[0]);
  }, [allMyStudents]);

  const start = useMemo(() => periodStart(period, now), [period, now]);
  const suffix = periodSuffix(period);

  const myStudents = useMemo(() => {
    if (!start) return allMyStudents;
    return allMyStudents.filter((s) => {
      const submitted = parseSubmittedAt(s.submittedAt);
      return !!submitted && submitted >= start;
    });
  }, [allMyStudents, start]);

  const myApplications = useMemo(() => {
    if (!start) return allMyApplications;
    return allMyApplications.filter((a) => {
      const activity = latestActivityDateForApp(a);
      return !!activity && activity >= start;
    });
  }, [allMyApplications, start]);

  // ── Financial view (read-only, from the branch finance ledger) ──
  const { transactions: ledger } = useFinanceLedger();
  const myLedger = useMemo(() => ledger.filter((t) => t.counselor === counselorName), [ledger, counselorName]);
  const inPeriod = (stamp?: string) => {
    if (!stamp) return false;
    if (!start) return true;
    const d = parseSubmittedAt(stamp) ?? new Date(`${stamp.slice(0, 10)}T00:00:00`);
    return d >= start;
  };
  const performance = useMemo(() => {
    const revenue = myLedger.filter((t) => isLivePayment(t) && inPeriod(t.at)).reduce((n, t) => n + t.amount, 0)
      - myLedger.filter((t) => isPaidOutRefund(t) && inPeriod(t.processedAt ?? t.at)).reduce((n, t) => n + t.amount, 0);
    const offers = allMyApplications.flatMap((a) => a.offerApplications);
    const activeLeads = allMyStudents.filter((s) => s.consultationStatus !== 'Consultation Complete').length;
    return [
      { label: 'Attributed Revenue', value: rs(revenue), hint: `payments from my clients · ${suffix.toLowerCase()}` },
      { label: 'Active Clients', value: String(allMyApplications.filter((a) => !a.withdrawn).length + activeLeads), hint: 'in consultation or application' },
      { label: 'Applications Submitted', value: String(offers.filter((o) => o.appliedDate && inPeriod(o.appliedDate)).length), hint: suffix.toLowerCase() },
      { label: 'Offers Received', value: String(offers.filter((o) => (o.status === 'Offer Received' || o.status === 'Fee Paid') && inPeriod(o.outcomeDate ?? o.statusUpdatedAt)).length), hint: suffix.toLowerCase() },
      { label: 'Visa Approvals', value: String(allMyApplications.filter((a) => a.visaApplication?.status === 'Visa Approved' && inPeriod(a.visaApplication.outcomeDate ?? a.visaApplication.statusUpdatedAt)).length), hint: suffix.toLowerCase() },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLedger, allMyApplications, allMyStudents, start, suffix]);

  // Clients with money owed or a plan instalment coming due — for follow-up, not collection.
  const pendingPayments = useMemo(() => {
    const today = dateKey(new Date());
    const ORDER: DueStatus[] = ['Overdue', 'Due', 'Due Soon', 'Scheduled'];
    const plans = planSummaries(myLedger, today);
    return clientBalances(myLedger, today)
      .filter((b) => b.outstanding > 0)
      .map((b) => ({
        ...b,
        planDue: plans.filter((p) => p.clientId === b.clientId).flatMap((p) => p.installments).find((i) => i.status !== 'Settled'),
        discountPending: myLedger.some((t) => t.clientId === b.clientId && t.kind === 'Discount' && t.status === 'Pending Approval'),
      }))
      .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.nextDue ?? '').localeCompare(b.nextDue ?? ''));
  }, [myLedger]);

  const stats = useMemo<StatCardDef[]>(() => {
    const awaiting = myStudents.filter((s) => s.consultationStatus === 'Awaiting Consultation');
    const inProgress = myStudents.filter((s) => s.consultationStatus === 'In Progress');
    const awaitingOver24h = awaiting.filter((s) => {
      const submitted = parseSubmittedAt(s.submittedAt);
      return submitted !== null && now.getTime() - submitted.getTime() > 24 * 60 * 60 * 1000;
    }).length;

    // Enrolled — the same clients the Enrolled tab lists (all time), so the number matches on click.
    const enrolled = allMyStudents.filter((s) => s.outcome === 'Proceeding');
    const enrolledInPeriod = enrolled.filter((s) => {
      const d = s.completedDate ? new Date(`${s.completedDate}T00:00:00`) : null;
      return !start || (!!d && d >= start);
    }).length;
    // Enrolled but no institution applied to and no visa file yet — the counselor's next job.
    const notApplied = enrolled.filter((s) => {
      const app = allMyApplications.find((a) => a.clientId === clientIdFor(s));
      return !app || (!app.visaApplication && !app.offerApplications.some((o) => o.appliedDate || (o.status !== 'Enrolled')));
    }).length;
    const enrolledTrend = enrolled.length === 0 ? 'No enrolled clients yet' : [
      enrolledInPeriod ? `+${enrolledInPeriod} ${suffix.toLowerCase()}` : `None new ${suffix.toLowerCase()}`,
      notApplied ? `${notApplied} not applied yet` : 'All applied',
    ].join(' · ');

    // Marketing requests still waiting on this counselor, soonest deadline first.
    const nowKey = dateKey(new Date());
    const pending = marketingRequests.filter((r) => r.status === 'Pending').sort((a, b) => a.deadline.localeCompare(b.deadline));
    const overdue = pending.filter((r) => r.deadline < nowKey).length;
    const tomorrow = dateKey(new Date(Date.now() + 86_400_000));
    const dueSoon = pending.filter((r) => r.deadline >= nowKey && r.deadline <= tomorrow).length;
    const next = pending.find((r) => r.deadline >= nowKey);
    const nextLabel = next ? new Date(`${next.deadline}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
    const marketingTrend = pending.length === 0 ? 'All caught up'
      : overdue ? `${overdue} past deadline${next ? ` · next due ${nextLabel}` : ''}`
        : dueSoon ? `${dueSoon} due by tomorrow`
          : `Next due ${nextLabel}`;

    return [
      {
        key: 'my-students',
        icon: GraduationCap,
        value: String(myStudents.length),
        label: `My Clients · ${suffix}`,
        trend: `${inProgress.length} in progress`,
        navKey: 'my-students',
      },
      {
        key: 'awaiting',
        icon: Clock,
        value: String(awaiting.length),
        label: 'Awaiting Consultation',
        trend: awaitingOver24h === 0 ? 'None waiting over 24 hrs' : `${awaitingOver24h} waiting over 24 hrs`,
        emphasized: awaiting.length > 0,
        navKey: 'my-students',
        intent: { statusFilter: 'Awaiting Consultation' },
      },
      {
        key: 'enrolled',
        icon: BadgeCheck,
        value: String(enrolled.length),
        label: 'Enrolled',
        trend: enrolledTrend,
        navKey: 'consultations',
      },
      {
        key: 'marketing',
        icon: Megaphone,
        value: String(pending.length),
        label: 'Marketing Requests Pending',
        trend: marketingTrend,
        emphasized: overdue > 0 || dueSoon > 0,
        tone: overdue > 0 ? 'red' : 'amber',
        navKey: 'co-marketing',
      },
    ];
  }, [myStudents, allMyStudents, allMyApplications, marketingRequests, now, start, suffix]);

  // Follow-ups this counselor scheduled — soonest first, overdue ones kept visible. Scoped to
  // the same report-period window as the stat cards, so switching the period filter updates
  // this list too instead of only the cards above it.
  // Refund follow-ups (set when a refund is requested after a visa refusal) are merged in
  // too — across all time, not the period filter, so a pending reminder never drops off.
  const upcomingFollowUps = useMemo(() => {
    const consultations = myStudents
      .filter((s) => s.consultationStatus === 'Follow Up' && !!s.followUpDate)
      .map((s) => ({ key: `cs-${s.id}`, kind: 'consultation' as const, id: s.id, name: s.name, date: s.followUpDate as string, temperature: s.leadTemperature, note: undefined as string | undefined }));
    // Pending refund reminders on the current visa attempt and on earlier rounds (a client can
    // enroll somewhere new while an old refund is still processing).
    const refunds = allMyApplications.flatMap((a) =>
      [a.visaApplication, ...(a.previousEnrolments ?? []).map((p) => p.visaApplication)]
        .filter((v) => v?.refundRequested && !v.refundReceived && v.refundFollowUpDate && !v.refundFollowUpDone)
        .map((v, i) => ({ key: `rf-${a.id}-${i}`, kind: 'refund' as const, id: a.id, name: a.name, date: v!.refundFollowUpDate as string, temperature: undefined, note: v!.refundFollowUpNote }))
    );
    return [...refunds, ...consultations].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  }, [myStudents, allMyApplications]);

  // Activity feed on this counselor's clients, scoped to the same report-period window.
  const updates = useMemo(() => recentActivity(myApplications, 6), [myApplications]);
  // Updates are keyed by application — resolve back to the counselor's client record (joined
  // on Client ID, same as the Enrolled page) so a click can open that client's profile.
  const openUpdate = (appId: string) => {
    const app = allMyApplications.find((a) => a.id === appId);
    const client = app && allMyStudents.find((s) => clientIdFor(s) === clientIdFor(app));
    onNavigate?.('consultations', client ? { openClientId: client.id } : undefined);
  };

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



      {/* My Performance — read-only figures from the CRM and the finance ledger */}
      <section>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-navy">My Performance <Lock size={12} className="text-gray-400" aria-label="Read-only" /></p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {performance.map((p) => (
            <div key={p.label} className="rounded-xl border border-grey-border bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{p.label}</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-navy">{p.value}</p>
              <p className="text-[11px] text-gray-400">{p.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          // Emphasis tints: amber = needs attention soon, red = past due.
          const t = !stat.emphasized ? null : stat.tone === 'red'
            ? { card: 'border-2 border-red-200 bg-red-50 hover:border-red-300', icon: 'bg-red-100', ink: 'text-red-600', value: 'text-red-700', hint: 'text-red-600' }
            : { card: 'border-2 border-amber-300 bg-amber-50 hover:border-amber-400', icon: 'bg-amber-100', ink: 'text-amber-600', value: 'text-amber-700', hint: 'text-amber-600' };
          return (
            <button
              key={stat.key}
              type="button"
              onClick={() => onNavigate?.(stat.navKey, stat.intent)}
              className={`stat-card ${CLICKABLE_CARD} ${t?.card ?? ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${t?.icon ?? 'bg-navy/5'}`}>
                  <Icon className={t?.ink ?? 'text-navy'} size={22} />
                </div>
                <ChevronRight size={18} className="text-gray-300 transition-colors group-hover:text-navy" />
              </div>
              <p className={`font-bold ${t ? `text-4xl ${t.value}` : 'text-3xl text-navy'}`}>{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              <p className={`text-xs mt-2 ${t ? `${t.hint} font-medium` : 'text-gray-400'}`}>{stat.trend}</p>
            </button>
          );
        })}
      </div>

      {/* Pending client payments — for follow-up; Finance records the payments */}
      <section className="stat-card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-navy">Pending Client Payments</h3>
          <span className="text-xs text-gray-400">{pendingPayments.length} client{pendingPayments.length === 1 ? '' : 's'} · {rs(pendingPayments.reduce((n, b) => n + b.outstanding, 0))} outstanding</span>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-gray-400"><Lock size={11} /> Read-only · from Financial Management</span>
        </div>
        {pendingPayments.length === 0 ? (
          <p className="text-sm text-gray-400">None of your clients owe anything right now.</p>
        ) : (
          <ul className="divide-y divide-grey-border">
            {pendingPayments.map((b) => (
              <li key={b.clientId} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-navy">{b.clientName}</span>
                  <span className="block text-[11px] text-gray-400">
                    {b.clientId}
                    {b.nextDue && <> · due {new Date(`${b.nextDue}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</>}
                    {b.planDue && <> · plan instalment {b.planDue.no} ({rs(b.planDue.amount - b.planDue.paid)})</>}
                  </span>
                </span>
                {b.discountPending && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Discount Requested (Pending)</span>}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DUE_STYLES[b.status]}`}>{b.status}</span>
                <span className="w-24 text-right text-sm font-semibold tabular-nums text-navy">{rs(b.outstanding)}</span>
                <button
                  type="button"
                  onClick={() => onNavigate?.('my-students', { search: b.clientName })}
                  className="rounded-lg border border-grey-border px-2.5 py-1 text-xs font-medium text-navy hover:border-navy-light hover:text-navy-light"
                >
                  Follow up
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Upcoming follow-ups + client updates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="text-base font-semibold text-navy mb-4">Upcoming Follow-ups</h3>
          {upcomingFollowUps.length > 0 ? (
            <div className="space-y-0">
              {upcomingFollowUps.map((s) => {
                const due = new Date(`${s.date}T00:00:00`);
                const isOverdue = dateKey(due) < dateKey(new Date());
                const isToday = dateKey(due) === dateKey(new Date());
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => (s.kind === 'refund' ? openUpdate(s.id) : onNavigate?.('follow-ups', { openClientId: s.id }))}
                    className={`flex items-center justify-between gap-2 py-2.5 border-b border-grey-border last:border-0 ${CLICKABLE_ROW}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{s.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{isOverdue ? 'Overdue · ' : isToday ? 'Today · ' : ''}</span>
                        {due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {s.note ? ` · ${s.note}` : ''}
                      </p>
                    </div>
                    {s.kind === 'refund' && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 bg-purple-50 text-purple-700">Refund</span>
                    )}
                    {s.temperature && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${LEAD_TEMPERATURE_STYLES[s.temperature]}`}>
                        {s.temperature}
                      </span>
                    )}
                  </button>
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
                  <button
                    key={event.key}
                    type="button"
                    onClick={() => openUpdate(event.appId)}
                    className={`flex items-center justify-between gap-2 py-2.5 border-b border-grey-border last:border-0 ${CLICKABLE_ROW}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{event.name}</p>
                      <p className="text-xs text-gray-500 truncate">{event.description}</p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {formatActivityTime(event.date, event.hasTime)}{event.by ? ` · by ${event.by}` : ''}
                      </p>
                    </div>
                    {isNew && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-navy/10 text-navy flex-shrink-0">New</span>}
                  </button>
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
