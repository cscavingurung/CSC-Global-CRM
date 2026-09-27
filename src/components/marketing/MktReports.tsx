import { useMemo, useState } from 'react';
import { useMarketing } from './mktContext';
import { BarRow, Card, Kpi, PageIntro, ReadOnlyNote, TableBox, Td, Th } from './MktShared';
import { RoiTable } from './MktCampaigns';
import { CONTACT_SLA_HOURS, LEAD_CHANNELS, addDaysIso, campaignRoi, isoToday, shortDay } from '../../marketingDept';
import { parseLeadDate } from '../../marketing';
import { rs } from '../../finance';
import { ExcelSheet, ViewToggle } from './MktSheet';
import { leadColumns } from './mktSheetColumns';
import { SheetColumn, useViewMode } from './mktUtils';
import { MarketingLead } from '../../types';

const dayKey = (stamp?: string) => { const d = parseLeadDate(stamp); return d ? isoToday(d) : ''; };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

/** Read-only conversion by source and by campaign — outcome counts only, never money. */
function ConversionTables() {
  const { store, tracks } = useMarketing();
  const row = (ids: Set<string>, total: number) => {
    const t = tracks.filter((x) => ids.has(x.leadId));
    return {
      total,
      clients: t.filter((x) => x.journey >= 4).length,
      applications: t.filter((x) => x.journey >= 5).length,
      visas: t.filter((x) => x.visaOutcome === 'Approved').length,
    };
  };
  const group = (key: (l: (typeof store.leads)[number]) => string, labels: [string, string][]) => labels.map(([id, label]) => {
    const leads = store.leads.filter((l) => key(l) === id);
    return { label, ...row(new Set(leads.map((l) => l.id)), leads.length) };
  });
  const bySource = group((l) => l.source, LEAD_CHANNELS.map((s) => [s, s]));
  const byCampaign = group((l) => l.campaignId ?? '', [...store.campaigns.map((c): [string, string] => [c.id, c.name]), ['', 'No campaign']]).filter((r) => r.total > 0);
  const table = (first: string, rows: ReturnType<typeof group>) => {
    const tot = rows.reduce((a, r) => ({ total: a.total + r.total, clients: a.clients + r.clients, applications: a.applications + r.applications, visas: a.visas + r.visas }), { total: 0, clients: 0, applications: 0, visas: 0 });
    return (
      <TableBox min={560}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>{first}</Th><Th right>Total Leads</Th><Th right>Clients</Th><Th right>Applications</Th><Th right>Visa Approved</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((r) => (
            <tr key={r.label}>
              <Td className="font-medium text-navy">{r.label}</Td>
              <Td right>{r.total}</Td>
              <Td right>{r.clients}<span className="ml-1 text-[11px] text-gray-400">{pct(r.clients, r.total)}</span></Td>
              <Td right>{r.applications}</Td>
              <Td right className={r.visas ? 'font-semibold text-emerald-700' : ''}>{r.visas}</Td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-grey-border bg-grey-bg/50 font-semibold text-navy">
          <tr><Td>Total</Td><Td right>{tot.total}</Td><Td right>{tot.clients}</Td><Td right>{tot.applications}</Td><Td right>{tot.visas}</Td></tr>
        </tfoot>
      </TableBox>
    );
  };
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="space-y-2"><h3 className="text-sm font-semibold text-navy">Leads by Source</h3>{table('Source', bySource)}</section>
      <section className="space-y-2"><h3 className="text-sm font-semibold text-navy">Leads by Campaign</h3>{table('Campaign Name', byCampaign)}</section>
    </div>
  );
}

interface OutcomeRow { label: string; total: number; qualified: number; assigned: number; contacted: number; clients: number; applications: number; visas: number; breaches: number }

const outcomeColumns = (first: string, withBreaches = false): SheetColumn<OutcomeRow>[] => [
  { key: 'label', header: first, value: (r) => r.label },
  { key: 'total', header: 'Total Leads', value: (r) => r.total, numeric: true, total: true },
  { key: 'qualified', header: 'Qualified', value: (r) => r.qualified, numeric: true, total: true, hidden: true },
  { key: 'assigned', header: 'Assigned', value: (r) => r.assigned, numeric: true, total: true },
  { key: 'contacted', header: 'Contacted', value: (r) => r.contacted, numeric: true, total: true, hidden: !withBreaches },
  { key: 'clients', header: 'Clients', value: (r) => r.clients, numeric: true, total: true },
  { key: 'conv', header: 'Lead → Client %', value: (r) => (r.total ? Math.round((r.clients / r.total) * 100) : 0), numeric: true, render: (r) => pct(r.clients, r.total) },
  { key: 'applications', header: 'Applications', value: (r) => r.applications, numeric: true, total: true },
  { key: 'visas', header: 'Visa Approved', value: (r) => r.visas, numeric: true, total: true },
  ...(withBreaches ? [{ key: 'breaches', header: 'SLA Breaches', value: (r: OutcomeRow) => r.breaches, numeric: true, total: true }] : []),
];

const SHEETS = ['By Source', 'By Campaign', 'By Branch', 'All Leads'] as const;
type SheetTab = (typeof SHEETS)[number];

/** Excel view of Lead Reports: a small workbook with one worksheet per breakdown. */
function ReportWorkbook() {
  const { store, tracks, branches } = useMarketing();
  const [tab, setTab] = useState<SheetTab>('By Source');
  const outcome = (label: string, leads: MarketingLead[]): OutcomeRow => {
    const ids = new Set(leads.map((l) => l.id));
    const t = tracks.filter((x) => ids.has(x.leadId));
    return {
      label, total: leads.length, qualified: leads.filter((l) => l.stage === 'Qualified' || l.stage === 'Assigned').length,
      assigned: t.length, contacted: t.filter((x) => x.journey >= 2).length, clients: t.filter((x) => x.journey >= 4).length,
      applications: t.filter((x) => x.journey >= 5).length, visas: t.filter((x) => x.visaOutcome === 'Approved').length,
      breaches: t.filter((x) => x.slaBreached).length,
    };
  };
  const bySource = LEAD_CHANNELS.map((s) => outcome(s, store.leads.filter((l) => l.source === s)));
  const byCampaign = [
    ...store.campaigns.map((c) => outcome(c.name, store.leads.filter((l) => l.campaignId === c.id))),
    outcome('No campaign', store.leads.filter((l) => !l.campaignId)),
  ].filter((r) => r.total > 0);
  const byBranch = branches.map((b) => {
    const ids = new Set(tracks.filter((t) => t.branch === b).map((t) => t.leadId));
    return outcome(b, store.leads.filter((l) => ids.has(l.id)));
  });
  const trackOf = (id: string) => tracks.find((t) => t.leadId === id);
  const allCols: SheetColumn<MarketingLead>[] = [
    ...leadColumns(store.campaigns),
    { key: 'assignedTo', header: 'Assigned Branch', value: (l) => trackOf(l.id)?.branch },
    { key: 'branchStatus', header: 'Branch Status', value: (l) => trackOf(l.id)?.status ?? (l.stage === 'Disqualified' ? `Disqualified — ${l.disqualifyReason ?? ''}` : 'In Marketing inbox'), sort: (l) => trackOf(l.id)?.journey ?? -1 },
  ];

  return (
    <div className="space-y-2">
      {tab === 'By Source' && <ExcelSheet columns={outcomeColumns('Source')} rows={bySource} rowKey={(r) => r.label} filename="lead-report-by-source" />}
      {tab === 'By Campaign' && <ExcelSheet columns={outcomeColumns('Campaign Name')} rows={byCampaign} rowKey={(r) => r.label} filename="lead-report-by-campaign" />}
      {tab === 'By Branch' && <ExcelSheet columns={outcomeColumns('Branch', true)} rows={byBranch} rowKey={(r) => r.label} filename="lead-report-by-branch" />}
      {tab === 'All Leads' && <ExcelSheet columns={allCols} rows={store.leads} rowKey={(l) => l.id} filename="lead-report-all-leads" />}
      {/* Worksheet tabs, like the bottom of an Excel workbook. */}
      <div role="tablist" className="flex flex-wrap gap-0.5 border-t border-grey-border">
        {SHEETS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={tab === s} onClick={() => setTab(s)}
            className={`-mt-px rounded-b-md border border-t-0 px-3 py-1.5 text-xs font-medium transition-colors ${tab === s ? 'border-grey-border bg-white text-navy' : 'border-transparent text-gray-500 hover:text-navy-light'}`}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LeadReports() {
  const { store } = useMarketing();
  const [mode, setMode] = useViewMode('lead-reports');
  const leads = store.leads;
  const decided = leads.filter((l) => l.stage !== 'Raw');
  const qualified = leads.filter((l) => l.stage === 'Qualified' || l.stage === 'Assigned');
  const hoursToQualify = qualified
    .map((l) => { const a = parseLeadDate(l.receivedAt); const b = parseLeadDate(l.qualifiedAt); return a && b ? (b.getTime() - a.getTime()) / 3_600_000 : null; })
    .filter((h): h is number => h !== null && h >= 0);
  const avgQ = hoursToQualify.length ? hoursToQualify.reduce((a, b) => a + b, 0) / hoursToQualify.length : null;

  const bySource = LEAD_CHANNELS.map((s) => {
    const mine = leads.filter((l) => l.source === s);
    return { s, total: mine.length, qualified: mine.filter((l) => l.stage === 'Qualified' || l.stage === 'Assigned').length };
  });
  const maxSource = Math.max(...bySource.map((b) => b.total), 1);

  const today = isoToday();
  const days = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i - 13));
  const perDay = days.map((d) => ({ d, n: leads.filter((l) => dayKey(l.receivedAt) === d).length }));
  const maxDay = Math.max(...perDay.map((p) => p.n), 1);
  const reasons = Object.entries(leads.filter((l) => l.stage === 'Disqualified').reduce<Record<string, number>>((m, l) => {
    const r = l.disqualifyReason ?? 'Other'; m[r] = (m[r] ?? 0) + 1; return m;
  }, {}));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">Read-only conversion — outcome counts synced from the branches.</p>
        <ViewToggle value={mode} onChange={setMode} />
      </div>
      {mode === 'sheet' ? <ReportWorkbook /> : <ConversionTables />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total leads" value={leads.length} />
        <Kpi label="Qualification rate" value={pct(qualified.length, decided.length)} hint="of leads reviewed" />
        <Kpi label="Avg. time to qualify" value={avgQ === null ? '—' : avgQ < 24 ? `${avgQ.toFixed(1)}h` : `${(avgQ / 24).toFixed(1)}d`} />
        <Kpi label="Waiting in inbox" value={leads.filter((l) => l.stage === 'Raw').length} tone="amber" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Leads by source">
          <div className="space-y-3 px-5 py-4">
            {bySource.map((b) => <BarRow key={b.s} label={b.s} value={b.total} max={maxSource} sub={`${b.qualified} qualified · ${pct(b.qualified, b.total)}`} />)}
          </div>
        </Card>
        <Card title="New leads — last 14 days">
          <div className="px-5 py-4">
            <div className="flex h-36 items-end gap-1.5" role="img" aria-label="New leads per day for the last 14 days">
              {perDay.map((p) => (
                <div key={p.d} className="group flex flex-1 flex-col items-center justify-end" title={`${shortDay(p.d)}: ${p.n} lead${p.n === 1 ? '' : 's'}`}>
                  {p.n > 0 && <span className="mb-1 text-[10px] font-semibold tabular-nums text-navy">{p.n}</span>}
                  <div className="w-full rounded-t bg-navy transition-colors group-hover:bg-navy-light" style={{ height: `${(p.n / maxDay) * 100}%`, minHeight: p.n ? 4 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between border-t border-grey-border pt-1 text-[10px] text-gray-400">
              <span>{shortDay(days[0])}</span><span>{shortDay(days[13])}</span>
            </div>
          </div>
        </Card>
      </div>
      <Card title="Why leads were disqualified">
        <ul className="divide-y divide-grey-border">
          {reasons.map(([r, n]) => <li key={r} className="flex justify-between px-5 py-2.5 text-sm"><span className="text-gray-600">{r}</span><span className="font-semibold tabular-nums text-navy">{n}</span></li>)}
          {reasons.length === 0 && <li className="px-5 py-6 text-center text-sm text-gray-400">No disqualified leads.</li>}
        </ul>
      </Card>
    </div>
  );
}

export function CampaignReports() {
  const { store, tracks } = useMarketing();
  const roi = campaignRoi(store, tracks);
  const maxRev = Math.max(...roi.map((r) => r.revenue), 1);
  return (
    <div className="space-y-4">
      <PageIntro text="Campaign outcomes side by side — spend, leads, conversions and the revenue they brought in." />
      <RoiTable />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Attributed revenue by campaign">
          <div className="space-y-3 px-5 py-4">
            {[...roi].sort((a, b) => b.revenue - a.revenue).map((r) => <BarRow key={r.campaign.id} label={r.campaign.name} value={r.revenue} max={maxRev} display={rs(r.revenue)} />)}
          </div>
        </Card>
        <Card title="Lead target attainment">
          <div className="space-y-3 px-5 py-4">
            {roi.map((r) => <BarRow key={r.campaign.id} label={r.campaign.name} value={r.leads} max={Math.max(r.campaign.target, r.leads)} display={`${r.leads} / ${r.campaign.target}`} sub={pct(r.leads, r.campaign.target)} />)}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function BranchConversion() {
  const { tracks, branches } = useMarketing();
  const rows = useMemo(() => branches.map((b) => {
    const t = tracks.filter((x) => x.branch === b);
    const at = (i: number) => t.filter((x) => x.step >= i).length;
    const contactHours = t.map((x) => {
      const a = parseLeadDate(x.assignedAt); const c = parseLeadDate(x.contactedAt);
      return a && c ? Math.max(0, (c.getTime() - a.getTime()) / 3_600_000) : null;
    }).filter((h): h is number => h !== null);
    return {
      b, assigned: t.length, contacted: at(3), consultation: at(4), clients: at(5), applications: at(6), visas: at(7),
      breaches: t.filter((x) => x.slaBreached).length,
      avgContact: contactHours.length ? contactHours.reduce((a, c) => a + c, 0) / contactHours.length : null,
      revenue: t.reduce((n, x) => n + (x.revenue ?? 0), 0),
    };
  }), [tracks, branches]);

  return (
    <div className="space-y-4">
      <PageIntro text="How each branch converts the leads Marketing sends it." />
      <TableBox min={960}>
        <thead className="border-b border-grey-border bg-grey-bg/50">
          <tr><Th>Branch</Th><Th right>Assigned</Th><Th right>Contacted</Th><Th right>Consultation</Th><Th right>Clients</Th><Th right>Applications</Th><Th right>Visas</Th><Th right>Lead → Client</Th><Th right>Avg. first contact</Th><Th right>SLA breaches</Th><Th right>Attributed revenue</Th></tr>
        </thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((r) => (
            <tr key={r.b}>
              <Td className="font-medium text-navy">{r.b}</Td>
              <Td right>{r.assigned}</Td><Td right>{r.contacted}</Td><Td right>{r.consultation}</Td><Td right>{r.clients}</Td>
              <Td right>{r.applications}</Td><Td right>{r.visas}</Td>
              <Td right className="font-semibold text-navy">{pct(r.clients, r.assigned)}</Td>
              <Td right>{r.avgContact === null ? '—' : `${r.avgContact.toFixed(1)}h`}</Td>
              <Td right className={r.breaches ? 'font-semibold text-red-600' : 'text-gray-400'}>{r.breaches}</Td>
              <Td right>{rs(r.revenue)}</Td>
            </tr>
          ))}
        </tbody>
      </TableBox>
      <ReadOnlyNote>Read-only. SLA breach = a lead not contacted within {CONTACT_SLA_HOURS} hours of assignment. Branch staffing, attendance and internal finances are outside Marketing's view.</ReadOnlyNote>
    </div>
  );
}
