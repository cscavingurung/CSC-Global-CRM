import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Search, Send } from 'lucide-react';
import { useMarketing } from './mktContext';
import {
  CampaignTag, Card, Chips, EmptyRow, Field, GhostButton, Modal, PageIntro, Pill, PrimaryButton, ReadOnlyNote,
  SelectInput, SourceTag, TableBox, Td, Th,
} from './MktShared';
import { CONTACT_SLA_HOURS, LEAD_CHANNELS, MKT_CAN, ago, campaignName, LeadTrack, trackStatusStyle, whenLabel } from '../../marketingDept';
import { Lead360Drawer, LeadForm } from './MktLeadsSpecialist';
import { ExcelSheet, ViewToggle } from './MktSheet';
import { leadColumns, trackColumns, trackTone } from './mktSheetColumns';
import { useViewMode } from './mktUtils';
import { MarketingLead } from '../../types';

const CHANNEL_CHIPS = ['All', ...LEAD_CHANNELS] as const;
type ChannelChip = (typeof CHANNEL_CHIPS)[number];

function matches(l: MarketingLead, q: string) {
  const s = q.trim().toLowerCase();
  return !s || [l.name, l.phone, l.message ?? '', l.interestedProgram ?? ''].some((v) => v.toLowerCase().includes(s));
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search name, phone, message" className="w-full rounded-lg border border-grey-border py-2 pl-9 pr-3 text-sm focus:border-navy-light focus:outline-none" />
    </div>
  );
}

// ── Qualification modal ─────────────────────────────────────────────────────
export function QualifyModal({ lead, onClose }: { lead: MarketingLead; onClose: () => void }) {
  return (
    <Modal title={`Qualify lead — ${lead.name}`} onClose={onClose} wide>
      <LeadForm lead={lead} onDone={onClose} />
    </Modal>
  );
}

// ── Assign to Branch modal ──────────────────────────────────────────────────
export function AssignModal({ lead, onClose }: { lead: MarketingLead; onClose: () => void }) {
  const { branches, actions } = useMarketing();
  const [branch, setBranch] = useState(lead.preferredBranch ?? '');
  return (
    <Modal title={`Assign ${lead.name} to a branch`} onClose={onClose}>
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-2 rounded-lg border border-grey-border p-3 text-sm">
          <dt className="text-gray-500">Country</dt><dd className="text-navy">{lead.preferredCountry}</dd>
          <dt className="text-gray-500">Program</dt><dd className="text-navy">{lead.interestedProgram}</dd>
          <dt className="text-gray-500">Source</dt><dd><SourceTag source={lead.source} /></dd>
        </dl>
        <Field label="Branch" required hint="The lead leaves the Marketing inbox and lands in this branch's New Leads queue for its counselors to claim.">
          <SelectInput value={branch} onChange={setBranch} label="Branch">
            <option value="">Select branch</option>
            {branches.map((b) => <option key={b} value={b}>{b}{b === lead.preferredBranch ? ' (preferred)' : ''}</option>)}
          </SelectInput>
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton disabled={!branch} onClick={() => { actions.assignLead(lead.id, branch); onClose(); }}><Send size={15} /> Assign to Branch</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Inbox ───────────────────────────────────────────────────────────────────
export function LeadsInbox() {
  const { store, role, navigate } = useMarketing();
  const [channel, setChannel] = useState<ChannelChip>('All');
  const [q, setQ] = useState('');
  const [qualifying, setQualifying] = useState<MarketingLead | null>(null);
  const [assigning, setAssigning] = useState<MarketingLead | null>(null);
  const [mode, setMode] = useViewMode('inbox');
  const canAct = MKT_CAN.qualify(role);
  const actionFor = (l: MarketingLead) => (!canAct ? <span className="text-gray-400">View only</span> : l.stage === 'Raw'
    ? <PrimaryButton small onClick={() => setQualifying(l)}>Qualify</PrimaryButton>
    : <PrimaryButton small onClick={() => setAssigning(l)}><Send size={13} /> Assign to Branch</PrimaryButton>);

  // Assigned leads have left the inbox — they live in the branch queue now.
  const inbox = store.leads.filter((l) => l.stage === 'Raw' || l.stage === 'Qualified');
  const counts = Object.fromEntries(CHANNEL_CHIPS.map((c) => [c, c === 'All' ? inbox.length : inbox.filter((l) => l.source === c).length])) as Record<ChannelChip, number>;
  const rows = inbox
    .filter((l) => (channel === 'All' || l.source === channel) && matches(l, q))
    .sort((a, b) => (a.stage === b.stage ? b.receivedAt.localeCompare(a.receivedAt) : a.stage === 'Raw' ? -1 : 1));

  return (
    <div className="space-y-4">
      <PageIntro text="Every enquiry from Facebook, Instagram, TikTok and the website lands here. Qualify it, then assign it to a branch.">
        {canAct && <PrimaryButton onClick={() => navigate('ls-add-lead')}><Plus size={15} /> Add Lead</PrimaryButton>}
      </PageIntro>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Chips options={CHANNEL_CHIPS} value={channel} onChange={setChannel} counts={counts} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {mode === 'simple' && <SearchBox value={q} onChange={setQ} />}
          <ViewToggle value={mode} onChange={setMode} />
        </div>
      </div>
      {mode === 'sheet' ? (
        <ExcelSheet
          columns={leadColumns(store.campaigns, actionFor)}
          rows={rows}
          rowKey={(l) => l.id}
          filename={`lead-inbox${channel === 'All' ? '' : `-${channel.toLowerCase()}`}`}
          emptyText="Inbox zero — no unassigned leads here."
        />
      ) : (
      <TableBox min={1040}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Name</Th><Th>Phone</Th><Th>Country</Th><Th>Program</Th><Th>Source</Th><Th>Campaign</Th><Th>Date</Th><Th>Stage</Th><Th right>Action</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((l) => (
            <tr key={l.id} className="transition-colors hover:bg-grey-bg/40">
              <Td><span className="font-medium text-navy">{l.name}</span>{l.message && <span className="line-clamp-1 block max-w-[200px] text-[11px] text-gray-400" title={l.message}>“{l.message}”</span>}</Td>
              <Td className="whitespace-nowrap text-gray-600">{l.phone}</Td>
              <Td className="text-gray-600">{l.preferredCountry ?? <span className="text-gray-300">—</span>}</Td>
              <Td className="max-w-[180px] text-gray-600">{l.interestedProgram ?? l.purpose ?? <span className="text-gray-300">—</span>}</Td>
              <Td><SourceTag source={l.source} /></Td>
              <Td><CampaignTag campaigns={store.campaigns} id={l.campaignId} /></Td>
              <Td className="whitespace-nowrap text-gray-500">{whenLabel(l.receivedAt)}<span className="block text-[11px] text-gray-400">{ago(l.receivedAt)}</span></Td>
              <Td><Pill text={l.stage} /></Td>
              <Td right><span className="text-xs">{actionFor(l)}</span></Td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={9} text="Inbox zero — no unassigned leads here." />}
        </tbody>
      </TableBox>
      )}
      {qualifying && <QualifyModal lead={qualifying} onClose={() => setQualifying(null)} />}
      {assigning && <AssignModal lead={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
}

// ── Qualification ───────────────────────────────────────────────────────────
export function LeadsQualification() {
  const { store, role } = useMarketing();
  const [q, setQ] = useState('');
  const [qualifying, setQualifying] = useState<MarketingLead | null>(null);
  const canAct = MKT_CAN.qualify(role);
  const queue = store.leads.filter((l) => l.stage === 'Raw' && matches(l, q)).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const decided = store.leads
    .filter((l) => l.qualifiedAt && (l.stage === 'Qualified' || l.stage === 'Disqualified'))
    .sort((a, b) => (b.qualifiedAt ?? '').localeCompare(a.qualifiedAt ?? ''))
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <PageIntro text="Oldest first. Qualifying captures the country, program and branch the lead wants — Source and Campaign are mandatory.">
        <SearchBox value={q} onChange={setQ} />
      </PageIntro>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {queue.map((l) => (
          <div key={l.id} className="flex flex-col rounded-xl border border-grey-border bg-white p-4 transition-colors hover:border-navy-light">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy">{l.name}</p>
                <p className="text-xs text-gray-400">{l.phone} · {ago(l.receivedAt)}</p>
              </div>
              <SourceTag source={l.source} />
            </div>
            <p className="mt-2 line-clamp-2 flex-1 text-sm text-gray-600">{l.message ?? 'No message.'}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <CampaignTag campaigns={store.campaigns} id={l.campaignId} />
              {canAct && <PrimaryButton small onClick={() => setQualifying(l)}>Qualify</PrimaryButton>}
            </div>
          </div>
        ))}
        {queue.length === 0 && <p className="rounded-xl border border-dashed border-grey-border bg-white px-4 py-10 text-center text-sm text-gray-400 md:col-span-2 xl:col-span-3">Nothing waiting for qualification.</p>}
      </div>
      <Card title="Recent decisions">
        <ul className="divide-y divide-grey-border">
          {decided.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-sm">
              <span className="font-medium text-navy">{l.name}</span>
              <Pill text={l.stage} />
              <span className="flex-1 text-xs text-gray-500">{l.stage === 'Disqualified' ? l.disqualifyReason : `${l.interestedProgram} · ${l.preferredCountry} · prefers ${l.preferredBranch}`}</span>
              <span className="text-xs text-gray-400">{l.qualifiedBy} · {ago(l.qualifiedAt)}</span>
            </li>
          ))}
          {decided.length === 0 && <li className="px-5 py-6 text-center text-sm text-gray-400">No decisions yet.</li>}
        </ul>
      </Card>
      {qualifying && <QualifyModal lead={qualifying} onClose={() => setQualifying(null)} />}
    </div>
  );
}

// ── Assignment ──────────────────────────────────────────────────────────────
export function LeadsAssignment() {
  const { store, tracks, role } = useMarketing();
  const [assigning, setAssigning] = useState<MarketingLead | null>(null);
  const canAct = MKT_CAN.qualify(role);
  const queue = store.leads.filter((l) => l.stage === 'Qualified').sort((a, b) => (a.qualifiedAt ?? '').localeCompare(b.qualifiedAt ?? ''));
  const recent = store.leads.filter((l) => l.stage === 'Assigned').sort((a, b) => (b.assignedAt ?? '').localeCompare(a.assignedAt ?? '')).slice(0, 6);
  const trackOf = (id: string) => tracks.find((t) => t.leadId === id);

  return (
    <div className="space-y-4">
      <PageIntro text="Qualified leads waiting for a branch. Assigning removes the lead from the Marketing inbox and pushes it into that branch's CRM queue." />
      <TableBox min={820}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Lead</Th><Th>Wants</Th><Th>Preferred branch</Th><Th>Source</Th><Th>Campaign</Th><Th>Qualified</Th><Th right>Action</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {queue.map((l) => (
            <tr key={l.id} className="transition-colors hover:bg-grey-bg/40">
              <Td><span className="font-medium text-navy">{l.name}</span><span className="block text-[11px] text-gray-400">{l.phone}</span></Td>
              <Td className="text-gray-600">{l.interestedProgram ?? l.purpose}<span className="block text-[11px] text-gray-400">{l.preferredCountry}</span></Td>
              <Td className="text-navy">{l.preferredBranch}</Td>
              <Td><SourceTag source={l.source} /></Td>
              <Td><CampaignTag campaigns={store.campaigns} id={l.campaignId} /></Td>
              <Td className="whitespace-nowrap text-gray-500">{ago(l.qualifiedAt)}</Td>
              <Td right>{canAct ? <PrimaryButton small onClick={() => setAssigning(l)}><Send size={13} /> Assign to Branch</PrimaryButton> : <span className="text-xs text-gray-400">View only</span>}</Td>
            </tr>
          ))}
          {queue.length === 0 && <EmptyRow cols={7} text="No qualified leads waiting for a branch." />}
        </tbody>
      </TableBox>
      <Card title="Recently assigned">
        <ul className="divide-y divide-grey-border">
          {recent.map((l) => {
            const t = trackOf(l.id);
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-sm">
                <span className="font-medium text-navy">{l.name}</span>
                <span className="text-xs text-gray-500">→ {t?.branch ?? l.preferredBranch}</span>
                <span className="flex-1" />
                {t && <Pill text={t.status} cls={t.slaBreached ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'} />}
                <span className="text-xs text-gray-400">{ago(l.assignedAt)}</span>
              </li>
            );
          })}
        </ul>
      </Card>
      {assigning && <AssignModal lead={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
}

// ── Lead Monitoring (read-only) ─────────────────────────────────────────────
export function SlaBadge({ t }: { t: LeadTrack }) {
  if (t.hoursUncontacted === null) return <span className="text-xs text-emerald-700">Contacted</span>;
  const h = Math.round(t.hoursUncontacted);
  if (t.slaBreached) return <Pill text={`Escalated · ${h}h uncontacted`} cls="bg-red-50 text-red-700" />;
  if (h >= CONTACT_SLA_HOURS / 2) return <Pill text={`${h}h — due soon`} cls="bg-amber-50 text-amber-700" />;
  return <Pill text={`${h}h`} cls="bg-gray-100 text-gray-600" />;
}

export function LeadsMonitoring() {
  const { store, tracks, branches } = useMarketing();
  const [branch, setBranch] = useState('All branches');
  const [view, setView] = useState<'All' | 'Escalated' | 'Uncontacted' | 'Converted'>('All');
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useViewMode('monitoring');

  const rows = useMemo(() => tracks
    .filter((t) => branch === 'All branches' || t.branch === branch)
    .filter((t) => view === 'All' || (view === 'Escalated' ? t.slaBreached : view === 'Uncontacted' ? t.hoursUncontacted !== null : t.step >= 5))
    .sort((a, b) => Number(b.slaBreached) - Number(a.slaBreached) || (b.hoursUncontacted ?? -1) - (a.hoursUncontacted ?? -1) || b.assignedAt.localeCompare(a.assignedAt)),
  [tracks, branch, view]);
  const counts = {
    All: tracks.length,
    Escalated: tracks.filter((t) => t.slaBreached).length,
    Uncontacted: tracks.filter((t) => t.hoursUncontacted !== null).length,
    Converted: tracks.filter((t) => t.step >= 5).length,
  };
  const leadOf = (id: string) => store.leads.find((l) => l.id === id);

  return (
    <div className="space-y-4">
      <PageIntro text={`Where every marketing lead is now, synced from the branch. Leads not contacted within ${CONTACT_SLA_HOURS} hours are escalated in red.`}>
        <div className="w-full sm:w-48">
          <SelectInput value={branch} onChange={setBranch} label="Branch">
            <option>All branches</option>
            {branches.map((b) => <option key={b}>{b}</option>)}
          </SelectInput>
        </div>
      </PageIntro>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Chips options={['All', 'Escalated', 'Uncontacted', 'Converted'] as const} value={view} onChange={setView} counts={counts} />
        <ViewToggle value={mode} onChange={setMode} />
      </div>
      {counts.Escalated > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={15} /> {counts.Escalated} lead{counts.Escalated === 1 ? ' has' : 's have'} breached the {CONTACT_SLA_HOURS}h first-contact SLA.
        </p>
      )}
      {mode === 'sheet' ? (
        <ExcelSheet
          columns={trackColumns(store.campaigns)}
          rows={rows.map((t) => ({ t, l: leadOf(t.leadId) }))}
          rowKey={(r) => r.t.leadId}
          rowTone={trackTone}
          onRowClick={(r) => setOpen(r.t.leadId)}
          filename={`lead-monitoring${branch === 'All branches' ? '' : `-${branch.toLowerCase()}`}`}
          emptyText="No leads match this view."
        />
      ) : (
      <TableBox min={960}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Lead</Th><Th>Source · Campaign</Th><Th>Branch</Th><Th>Counselor</Th><Th>Assigned</Th><Th>Pipeline</Th><Th>First contact SLA</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((t) => {
            const l = leadOf(t.leadId);
            return (
              <tr key={t.leadId} onClick={() => setOpen(t.leadId)} className={`cursor-pointer transition-colors hover:bg-grey-bg/60 ${t.slaBreached ? 'bg-red-50/60' : ''}`}>
                <Td><span className={`font-medium ${t.slaBreached ? 'text-red-700' : 'text-navy'}`}>{l?.name}</span><span className="block text-[11px] text-gray-400">{l?.interestedProgram ?? l?.purpose} · {l?.preferredCountry}</span></Td>
                <Td><div className="flex flex-col items-start gap-1">{l && <SourceTag source={l.source} />}<span className="text-[11px] text-gray-500">{campaignName(store.campaigns, l?.campaignId)}</span></div></Td>
                <Td className="text-navy">{t.branch}</Td>
                <Td className="text-gray-600">{t.counselor ?? <span className="text-gray-400">Unclaimed</span>}</Td>
                <Td className="whitespace-nowrap text-gray-500">{ago(t.assignedAt)}</Td>
                <Td><Pill text={t.status} cls={trackStatusStyle(t)} /><span className="mt-1 block text-[11px] text-gray-400">Updated {whenLabel(t.lastUpdate)}</span></Td>
                <Td><SlaBadge t={t} /></Td>
              </tr>
            );
          })}
          {rows.length === 0 && <EmptyRow cols={7} text="No leads match this view." />}
        </tbody>
      </TableBox>
      )}
      {open && <Lead360Drawer leadId={open} onClose={() => setOpen(null)} />}
      <ReadOnlyNote>Read-only — click a lead for its journey. Marketing can follow a lead's progress but can't reassign it, contact the client or manage branch staff — escalations are handled by that branch's manager.</ReadOnlyNote>
    </div>
  );
}
