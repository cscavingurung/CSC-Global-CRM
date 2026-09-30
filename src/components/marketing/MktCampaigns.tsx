import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useMarketing } from './mktContext';
import {
  Card, Chips, EmptyRow, Field, GhostButton, Modal, PageIntro, Pill, PrimaryButton, Progress, ReadOnlyNote,
  SelectInput, SourceTag, TableBox, Td, TextInput, Th, BarRow,
} from './MktShared';
import { CampaignState, LEAD_CHANNELS, MKT_CAN, campaignRoi, campaignState, isoToday, shortDay } from '../../marketingDept';
import { rs } from '../../finance';
import { Campaign, CampaignObjective } from '../../types';
import DateInput from '../DateInput';

const OBJECTIVES: CampaignObjective[] = ['Lead Generation', 'Brand Awareness', 'Event Registration', 'Engagement'];
const STATE_STYLES: Record<CampaignState, string> = {
  Active: 'bg-emerald-50 text-emerald-700', Upcoming: 'bg-blue-50 text-blue-700', Ended: 'bg-gray-100 text-gray-500',
};

function NewCampaignModal({ onClose }: { onClose: () => void }) {
  const { actions } = useMarketing();
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<Campaign['platform'] | ''>('');
  const [objective, setObjective] = useState<CampaignObjective | ''>('');
  const [target, setTarget] = useState('');
  const [startDate, setStart] = useState(isoToday());
  const [endDate, setEnd] = useState('');
  const [budget, setBudget] = useState('');
  const datesOk = startDate && endDate && endDate >= startDate;
  const valid = name.trim() && platform && objective && Number(target) > 0 && datesOk && Number(budget) > 0;
  return (
    <Modal title="Create campaign" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        actions.createCampaign({ name: name.trim(), platform: platform as Campaign['platform'], objective: objective as CampaignObjective, target: Number(target), startDate, endDate, budget: Number(budget) });
        onClose();
      }}>
        <Field label="Campaign name" required><TextInput value={name} placeholder="e.g. Australia July 2027 Intake" onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platform" required>
            <SelectInput value={platform} onChange={(v) => setPlatform(v as Campaign['platform'])} label="Platform">
              <option value="">Select</option>
              {[...LEAD_CHANNELS, 'Multi-platform'].map((p) => <option key={p}>{p}</option>)}
            </SelectInput>
          </Field>
          <Field label="Objective" required>
            <SelectInput value={objective} onChange={(v) => setObjective(v as CampaignObjective)} label="Objective">
              <option value="">Select</option>
              {OBJECTIVES.map((o) => <option key={o}>{o}</option>)}
            </SelectInput>
          </Field>
          <Field label="Target (leads)" required><TextInput type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          <Field label="Budget (Rs)" required><TextInput type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
          <Field label="Start date" required><DateInput value={startDate} onChange={setStart} className="w-full" /></Field>
          <Field label="End date" required hint={endDate && !datesOk ? 'Must be on or after the start date.' : undefined}><DateInput min={startDate} value={endDate} onChange={setEnd} className="w-full" /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}>Create campaign</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export function CampaignsPage() {
  const { store, tracks, role } = useMarketing();
  const [adding, setAdding] = useState(false);
  const [state, setState] = useState<'All' | CampaignState>('All');
  const roi = campaignRoi(store, tracks);
  const counts = { All: roi.length, Active: 0, Upcoming: 0, Ended: 0 };
  roi.forEach((r) => { counts[campaignState(r.campaign)] += 1; });
  const shown = roi
    .filter((r) => state === 'All' || campaignState(r.campaign) === state)
    .sort((a, b) => b.campaign.startDate.localeCompare(a.campaign.startDate));

  return (
    <div className="space-y-4">
      <PageIntro text="Every campaign with its budget, spend so far and lead target.">
        {MKT_CAN.campaigns(role) && <PrimaryButton onClick={() => setAdding(true)}><Plus size={15} /> New campaign</PrimaryButton>}
      </PageIntro>
      <Chips options={['All', 'Active', 'Upcoming', 'Ended'] as const} value={state} onChange={setState} counts={counts} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map(({ campaign: c, spend, leads }) => {
          const st = campaignState(c);
          return (
            <div key={c.id} className="rounded-xl border border-grey-border bg-white p-4 transition-colors hover:border-navy-light">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-navy">{c.name}</p>
                <Pill text={st} cls={STATE_STYLES[st]} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                <SourceTag source={c.platform} /> <span>{c.objective}</span> · <span>{shortDay(c.startDate)} – {shortDay(c.endDate)}</span>
              </div>
              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <div className="mb-1 flex justify-between"><span className="text-gray-500">Spend</span><span className="tabular-nums text-navy">{rs(spend)} <span className="text-gray-400">/ {rs(c.budget)}</span></span></div>
                  <Progress value={spend} max={c.budget} danger={spend > c.budget} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between"><span className="text-gray-500">Leads</span><span className="tabular-nums text-navy">{leads} <span className="text-gray-400">/ {c.target}</span></span></div>
                  <Progress value={leads} max={c.target} />
                </div>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p className="rounded-xl border border-dashed border-grey-border bg-white px-4 py-10 text-center text-sm text-gray-400 md:col-span-2 xl:col-span-3">No campaigns in this view.</p>}
      </div>
      {adding && <NewCampaignModal onClose={() => setAdding(false)} />}
    </div>
  );
}

export function AdvertisingPage() {
  const { store, role, actions } = useMarketing();
  const canLog = MKT_CAN.campaigns(role);
  const [campaignId, setCampaignId] = useState('');
  const [adName, setAdName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(isoToday());
  const valid = campaignId && adName.trim() && Number(amount) > 0 && date;
  const byCampaign = useMemo(() => store.campaigns.map((c) => ({
    c, spend: store.adSpend.filter((a) => a.campaignId === c.id).reduce((n, a) => n + a.amount, 0),
  })), [store]);
  const maxBudget = Math.max(...byCampaign.map((b) => Math.max(b.c.budget, b.spend)), 1);
  const log = [...store.adSpend].sort((a, b) => b.date.localeCompare(a.date));
  const name = (id: string) => store.campaigns.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-4">
      <PageIntro text="Ad spend by campaign. Every entry here feeds cost-per-lead and ROI in Campaign Performance." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Card title="Budget used">
          <div className="space-y-3 px-5 py-4">
            {byCampaign.map(({ c, spend }) => (
              <BarRow key={c.id} label={c.name} value={spend} max={maxBudget} display={rs(spend)} sub={`of ${rs(c.budget)} · ${Math.round((spend / c.budget) * 100)}%`} />
            ))}
          </div>
        </Card>
        <Card title="Log ad spend" className="h-fit">
          {canLog ? (
            <form className="space-y-3 px-5 py-4" onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              actions.logAdSpend({ campaignId, adName: adName.trim(), amount: Number(amount), date });
              setAdName(''); setAmount('');
            }}>
              <Field label="Campaign" required>
                <SelectInput value={campaignId} onChange={setCampaignId} label="Campaign">
                  <option value="">Select</option>
                  {store.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectInput>
              </Field>
              <Field label="Ad / ad set" required><TextInput value={adName} onChange={(e) => setAdName(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (Rs)" required><TextInput type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
                <Field label="Date" required><DateInput max={isoToday()} value={date} onChange={setDate} className="w-full" /></Field>
              </div>
              <PrimaryButton type="submit" disabled={!valid}>Add spend</PrimaryButton>
            </form>
          ) : <p className="px-5 py-4 text-sm text-gray-500">Only the Marketing Manager logs ad spend.</p>}
        </Card>
      </div>
      <TableBox min={620}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Date</Th><Th>Campaign</Th><Th>Ad</Th><Th>Logged by</Th><Th right>Amount</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {log.map((a) => (
            <tr key={a.id}><Td className="whitespace-nowrap text-gray-500">{shortDay(a.date)}</Td><Td className="text-navy">{name(a.campaignId)}</Td><Td className="text-gray-600">{a.adName}</Td><Td className="text-gray-500">{a.loggedBy}</Td><Td right>{rs(a.amount)}</Td></tr>
          ))}
          {log.length === 0 && <EmptyRow cols={5} text="No ad spend logged yet." />}
        </tbody>
      </TableBox>
    </div>
  );
}

/** Read-only ROI table — used by Campaign Performance and Campaign Reports. */
export function RoiTable() {
  const { store, tracks } = useMarketing();
  const roi = campaignRoi(store, tracks);
  const tot = roi.reduce((t, r) => ({
    spend: t.spend + r.spend, leads: t.leads + r.leads, qualified: t.qualified + r.qualified,
    clients: t.clients + r.clients, applications: t.applications + r.applications, revenue: t.revenue + r.revenue,
  }), { spend: 0, leads: 0, qualified: 0, clients: 0, applications: 0, revenue: 0 });
  return (
    <TableBox min={920}>
      <thead className="border-b border-grey-border bg-grey-bg/50">
        <tr><Th>Campaign</Th><Th right>Ad Spend</Th><Th right>Leads</Th><Th right>Cost per Lead</Th><Th right>Qualified Leads</Th><Th right>Clients</Th><Th right>Applications</Th><Th right>Attributed Revenue</Th><Th right>ROI</Th></tr>
      </thead>
      <tbody className="divide-y divide-grey-border">
        {roi.map((r) => {
          const ret = r.spend ? (r.revenue - r.spend) / r.spend : null;
          return (
            <tr key={r.campaign.id}>
              <Td><span className="font-medium text-navy">{r.campaign.name}</span><span className="mt-0.5 block"><SourceTag source={r.campaign.platform} /></span></Td>
              <Td right>{rs(r.spend)}</Td>
              <Td right>{r.leads}</Td>
              <Td right>{r.costPerLead === null ? '—' : rs(r.costPerLead)}</Td>
              <Td right>{r.qualified}</Td>
              <Td right>{r.clients}</Td>
              <Td right>{r.applications}</Td>
              <Td right className="font-semibold text-navy">{rs(r.revenue)}</Td>
              <Td right className={ret === null ? 'text-gray-400' : ret >= 0 ? 'text-emerald-700' : 'text-red-600'}>{ret === null ? '—' : `${ret >= 0 ? '+' : ''}${Math.round(ret * 100)}%`}</Td>
            </tr>
          );
        })}
      </tbody>
      <tfoot className="border-t-2 border-grey-border bg-grey-bg/50 font-semibold text-navy">
        <tr>
          <Td>Total</Td><Td right>{rs(tot.spend)}</Td><Td right>{tot.leads}</Td><Td right>{tot.leads ? rs(tot.spend / tot.leads) : '—'}</Td>
          <Td right>{tot.qualified}</Td><Td right>{tot.clients}</Td><Td right>{tot.applications}</Td><Td right>{rs(tot.revenue)}</Td>
          <Td right>{tot.spend ? `${Math.round(((tot.revenue - tot.spend) / tot.spend) * 100)}%` : '—'}</Td>
        </tr>
      </tfoot>
    </TableBox>
  );
}

export function CampaignPerformance() {
  return (
    <div className="space-y-4">
      <PageIntro text="Return on every rupee of ad spend — from lead to client, application and fees received." />
      <RoiTable />
      <ReadOnlyNote>Read-only. Attributed revenue is the net fees received (payments less processed refunds) from clients who came in through each campaign. Individual fee lines, receipts and branch finances are not visible to Marketing.</ReadOnlyNote>
    </div>
  );
}
