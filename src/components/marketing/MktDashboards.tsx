import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { MarketingContext, useMarketing } from './mktContext';
import PeriodFilter from '../PeriodFilter';
import GreetingBanner from '../GreetingBanner';
import { PeriodKey, periodStart, periodSuffix } from '../../reportPeriod';
import { BarRow, Card, Kpi, SourceTag } from './MktShared';
import { LeadsDashboard } from './MktLeadsSpecialist';
import { PlannerDashboardPage } from './MktContentPlanner';
import { storeForPeriod } from './mktUtils';
import {
  FUNNEL_STEPS, LEAD_CHANNELS, campaignRoi, campaignState, funnelCounts,
} from '../../marketingDept';
import { rs } from '../../finance';

function LinkButton({ to, children }: { to: string; children: React.ReactNode }) {
  const { navigate } = useMarketing();
  return (
    <button type="button" onClick={() => navigate(to)} className="inline-flex items-center gap-0.5 text-xs font-medium text-navy transition-colors hover:text-navy-light">
      {children} <ChevronRight size={13} />
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 py-6 text-center text-sm text-gray-400">{text}</p>;
}

// ── Marketing Manager ───────────────────────────────────────────────────────
function ManagerDashboard() {
  const { store, tracks } = useMarketing();
  const funnel = funnelCounts(store.leads, tracks);
  const roi = campaignRoi(store, tracks);
  const revenue = tracks.reduce((n, t) => n + (t.revenue ?? 0), 0);
  const active = store.campaigns.filter((c) => campaignState(c) === 'Active');
  const escalated = tracks.filter((t) => t.slaBreached).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Total Leads" value={funnel.Leads} hint={`${store.leads.filter((l) => l.stage === 'Raw').length} waiting in inbox`} />
        <Kpi label="Assigned" value={funnel.Assigned} hint={escalated ? `${escalated} escalated (SLA)` : 'All within SLA'} tone={escalated ? 'red' : undefined} />
        <Kpi label="Applications Generated" value={funnel.Application} />
        <Kpi label="Revenue Generated" value={rs(revenue)} hint="Marketing-attributed" />
        <Kpi label="Active Campaigns" value={active.length} hint={`${store.campaigns.length} total`} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <Card title="Lead Funnel" action={<LinkButton to="mkt-report-branches">Branch conversion</LinkButton>}>
          <ol className="space-y-2.5 px-5 py-4">
            {FUNNEL_STEPS.map((step, i) => {
              const n = funnel[step];
              const prev = i === 0 ? n : funnel[FUNNEL_STEPS[i - 1]];
              return (
                <li key={step} className="grid grid-cols-[96px_1fr_88px] items-center gap-3 text-xs" title={`${step}: ${n}`}>
                  <span className="font-medium text-gray-600">{step}</span>
                  <div className="h-6 rounded-md bg-grey-bg">
                    <div className="flex h-6 items-center rounded-md bg-navy px-2 text-[11px] font-semibold text-white transition-all duration-500 hover:bg-navy-light" style={{ width: `${Math.max(n ? 8 : 0, (n / Math.max(funnel.Leads, 1)) * 100)}%` }}>
                      {n > 0 && n}
                    </div>
                  </div>
                  <span className="text-right tabular-nums text-gray-400">{i === 0 ? '' : prev ? `${Math.round((n / prev) * 100)}% of prev.` : '—'}</span>
                </li>
              );
            })}
          </ol>
        </Card>
        <Card title="Leads by source">
          <div className="space-y-3 px-5 py-4">
            {LEAD_CHANNELS.map((s) => {
              const n = store.leads.filter((l) => l.source === s).length;
              return <BarRow key={s} label={s} value={n} max={Math.max(funnel.Leads, 1)} />;
            })}
          </div>
        </Card>
      </div>
      <Card title="Active campaigns" action={<LinkButton to="mkt-performance">Performance</LinkButton>}>
        <ul className="divide-y divide-grey-border">
          {roi.filter((r) => campaignState(r.campaign) === 'Active').map((r) => (
            <li key={r.campaign.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
              <span className="min-w-[180px] flex-1 font-medium text-navy">{r.campaign.name}</span>
              <SourceTag source={r.campaign.platform} />
              <span className="text-xs text-gray-500">{r.leads}/{r.campaign.target} leads</span>
              <span className="text-xs text-gray-500">CPL {r.costPerLead === null ? '—' : rs(r.costPerLead)}</span>
              <span className="text-xs font-semibold text-navy">{rs(r.revenue)}</span>
            </li>
          ))}
          {active.length === 0 && <Empty text="No active campaigns." />}
        </ul>
      </Card>
    </div>
  );
}

export default function MarketingDashboard() {
  const ctx = useMarketing();
  const { role } = ctx;
  const [period, setPeriod] = useState<PeriodKey>('6m');
  const filtered = useMemo(
    () => storeForPeriod(ctx.store, ctx.tracks, periodStart(period, new Date())),
    [ctx.store, ctx.tracks, period],
  );
  // The Content Planner's dashboard carries its own greeting, quick actions and period filter.
  if (role === 'Content Planner') return <PlannerDashboardPage />;
  // (The Graphics Designer has a separate workspace — DesignerModule — and never reaches this.)
  const Dashboard = role === 'Leads Specialist' ? LeadsDashboard : ManagerDashboard;

  return (
    <div className="space-y-4">
      <GreetingBanner name={ctx.me} />
      {/* Report period selector — same control as the Branch Manager and Counselor dashboards. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">Report period</p>
          <p className="text-xs text-gray-400">
            Showing figures for {periodSuffix(period).toLowerCase()}
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>
      {/* Same page, narrower data: every dashboard widget reads the period-filtered store. */}
      <MarketingContext.Provider value={{ ...ctx, store: filtered.store, tracks: filtered.tracks }}>
        <div key={period} className="dissolve-in">
          <Dashboard />
        </div>
      </MarketingContext.Provider>
    </div>
  );
}
