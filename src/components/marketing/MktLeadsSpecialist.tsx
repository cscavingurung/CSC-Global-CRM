// Leads Specialist workspace — the Marketing Department's intake and routing hub.
//
// DATA BOUNDARY: every branch-side fact on these screens comes from a LeadTrack row
// (marketingDept.trackMarketingLeads), which carries only the high-level outcome — Contacted,
// Client, Application Submitted, Offer, Visa. For the Leads Specialist, App.tsx builds those
// rows without the finance ledger, so no revenue, fees, receipts or payment history exist here.
// Journey statuses are read-only: they sync from the branch Counselor / V/A Officer modules and
// there is deliberately no control to set "Client" or "Visa Approved" by hand.
import { useMemo, useState } from 'react';
import { AlertTriangle, BellRing, Building2, Check, CheckCircle2, Clock, Flag, Minus, Search, UserPlus, Users, XCircle } from 'lucide-react';
import { QualifyFields, useMarketing } from './mktContext';
import {
  CampaignTag, Card, Chips, Drawer, EmptyRow, Field, GhostButton, Kpi, PageIntro, Pill, PrimaryButton, ReadOnlyNote,
  SelectInput, SourceTag, TableBox, Td, TextArea, TextInput, Th,
} from './MktShared';
import {
  CONSULTATION_STUCK_DAYS, CONTACT_SLA_HOURS, JOURNEY_STEPS, LEAD_CHANNELS, LeadTrack, MKT_CAN, NO_ACTIVITY_DAYS,
  ago, campaignName, trackStatusStyle, whenLabel,
} from '../../marketingDept';
import { BranchPing, LeadChannel, MarketingLead } from '../../types';
import { CITY_POOLS, COUNTRIES, needsAttention } from './mktUtils';
import NewIntakeForm, { IntakeFormData, MarketingSubmitAction } from '../NewIntakeForm';
import { findClientBranches } from '../../lib/studentsApi';
import { ExcelSheet, ViewToggle } from './MktSheet';
import { AlertRow, alertColumns, trackColumns, trackTone } from './mktSheetColumns';
import { useViewMode } from './mktUtils';

const INTAKES = ['Jan 2027', 'Feb 2027', 'May 2027', 'Jul 2027', 'Sep 2027', 'Jan 2028'];
const ENGLISH = ['IELTS', 'PTE', 'TOEFL', 'Duolingo', 'Preparing for IELTS / PTE', 'Not taken yet', 'Not required'];
const DISQUALIFY_REASONS = [
  'Spam / test entry', 'Duplicate of an existing lead', 'Unreachable after 3 attempts',
  'Not a study / visa service we offer', 'Not eligible (age / academics)',
];

// ── Add / Qualify Lead form ─────────────────────────────────────────────────
const blank = (lead?: MarketingLead): QualifyFields => ({
  name: lead?.name ?? '', phone: lead?.phone ?? '', email: lead?.email ?? '',
  preferredCountry: lead?.preferredCountry ?? '', interestedProgram: lead?.interestedProgram ?? '', intake: lead?.intake ?? '',
  academicBackground: lead?.academicBackground ?? '', englishTest: lead?.englishTest ?? '', preferredBranch: lead?.preferredBranch ?? '',
  source: lead?.source ?? ('' as LeadChannel), campaignId: lead?.campaignId ?? '', notes: lead?.notes ?? '',
});

const clean = (f: QualifyFields): QualifyFields => Object.fromEntries(
  Object.entries(f).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || undefined : v]),
) as QualifyFields;

/** Manual entry (no `lead`) or qualification of an inbox lead. */
export function LeadForm({ lead, onDone }: { lead?: MarketingLead; onDone: (message: string) => void }) {
  const { store, branches, actions } = useMarketing();
  const [f, setF] = useState<QualifyFields>(() => blank(lead));
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState<'Branch' | 'City Pool'>('Branch');
  const [city, setCity] = useState('');
  const set = <K extends keyof QualifyFields>(k: K, v: QualifyFields[K]) => setF((p) => ({ ...p, [k]: v }));

  const basicsOk = Boolean(f.name.trim() && f.phone.trim() && f.source);
  const destinationOk = destination === 'Branch' ? Boolean(f.preferredBranch) : Boolean(city);
  const qualified = basicsOk && Boolean(f.preferredCountry && f.interestedProgram?.trim()) && destinationOk;
  const branch = f.preferredBranch ?? '';

  const save = () => {
    if (!basicsOk) return;
    const data = clean(f);
    if (lead) {
      actions.qualifyLead(lead.id, data);
      onDone(`${f.name} is qualified and waiting in the Assign to Branch queue.`);
    } else {
      actions.addLead(data, qualified ? 'Qualified' : 'Raw');
      onDone(`${f.name} was added to the inbox${qualified ? ' as qualified' : ''}.`);
    }
    setF(blank());
  };
  const assign = () => {
    if (!qualified) return;
    const data = clean(f);
    if (destination === 'City Pool') {
      if (lead) actions.assignToCityPool(lead.id, city, data);
      else actions.addAndAssignToCityPool(data, city);
      onDone(`${f.name} was routed to the ${city} City Pool — any counselor in that city can now claim it.`);
    } else {
      if (lead) actions.assignLead(lead.id, branch, data);
      else actions.addAndAssign(data, branch);
      onDone(`${f.name} was assigned to ${branch} and is now in that branch's lead queue.`);
    }
    setF(blank());
  };

  if (rejecting && lead) {
    return (
      <div className="space-y-4">
        <Field label={`Why is ${lead.name} being disqualified?`} required>
          <SelectInput value={reason} onChange={setReason} label="Reason">
            <option value="">Select a reason</option>
            {DISQUALIFY_REASONS.map((r) => <option key={r}>{r}</option>)}
          </SelectInput>
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={() => setRejecting(false)}>Back</GhostButton>
          <PrimaryButton disabled={!reason} onClick={() => { actions.disqualifyLead(lead.id, reason); onDone(`${lead.name} was disqualified.`); }}>Disqualify lead</PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); assign(); }} className="space-y-5">
      {lead?.message && (
        <p className="rounded-lg bg-grey-bg px-3 py-2 text-sm text-gray-600">“{lead.message}” <span className="text-xs text-gray-400">· {lead.source} · {ago(lead.receivedAt)}</span></p>
      )}
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Contact</legend>
        <Field label="Name" required><TextInput value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Phone" required><TextInput value={f.phone} inputMode="tel" onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><TextInput type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Study interest</legend>
        <Field label="Interested Country">
          <SelectInput value={f.preferredCountry ?? ''} onChange={(v) => set('preferredCountry', v)} label="Interested Country">
            <option value="">Select country</option>
            {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </SelectInput>
        </Field>
        <Field label="Program"><TextInput value={f.interestedProgram ?? ''} placeholder="e.g. Bachelor of Nursing" onChange={(e) => set('interestedProgram', e.target.value)} /></Field>
        <Field label="Intake">
          <SelectInput value={f.intake ?? ''} onChange={(v) => set('intake', v)} label="Intake">
            <option value="">Not sure yet</option>
            {INTAKES.map((i) => <option key={i}>{i}</option>)}
          </SelectInput>
        </Field>
        <Field label="Academic Background"><TextInput value={f.academicBackground ?? ''} placeholder="e.g. +2 Science, 3.2 GPA" onChange={(e) => set('academicBackground', e.target.value)} /></Field>
        <Field label="English Test Status">
          <TextInput list="english-tests" value={f.englishTest ?? ''} placeholder="e.g. IELTS 6.5" onChange={(e) => set('englishTest', e.target.value)} />
          <datalist id="english-tests">{ENGLISH.map((e) => <option key={e} value={e} />)}</datalist>
        </Field>
        <div className="sm:col-span-3">
          <span className="mb-1 block text-xs font-medium text-gray-600">Assign to</span>
          <Chips
            options={['Branch', 'City Pool'] as const}
            value={destination}
            onChange={(v) => { setDestination(v); if (v === 'Branch') setCity(''); else set('preferredBranch', ''); }}
          />
        </div>
        {destination === 'Branch' ? (
          <Field label="Preferred Branch">
            <SelectInput value={branch} onChange={(v) => set('preferredBranch', v)} label="Preferred Branch">
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b}>{b}</option>)}
            </SelectInput>
          </Field>
        ) : (
          <Field label="City Pool" hint="Visible to every counselor at a branch in this city — no single branch gets first pick.">
            <SelectInput value={city} onChange={setCity} label="City Pool">
              <option value="">Select city</option>
              {CITY_POOLS.map((c) => <option key={c}>{c}</option>)}
            </SelectInput>
          </Field>
        )}
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Marketing attribution</legend>
        <Field label="Lead Source" required>
          <SelectInput value={f.source} onChange={(v) => set('source', v as LeadChannel)} label="Lead Source">
            <option value="">Select source</option>
            {LEAD_CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </SelectInput>
        </Field>
        <Field label="Campaign">
          <SelectInput value={f.campaignId ?? ''} onChange={(v) => set('campaignId', v)} label="Campaign">
            <option value="">No campaign</option>
            {store.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes" hint="Marketing's own notes from the enquiry. The branch sees these with the lead.">
            <TextArea value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </fieldset>
      <div className="flex flex-col-reverse gap-2 border-t border-grey-border pt-4 sm:flex-row sm:items-center">
        {lead && <GhostButton danger onClick={() => setRejecting(true)}><XCircle size={15} /> Disqualify</GhostButton>}
        <p className="flex-1 text-xs text-gray-400">
          {qualified
            ? destination === 'City Pool' ? `Ready to route into the ${city} City Pool.` : `Ready to route to ${branch}.`
            : `Country, program and a ${destination === 'City Pool' ? 'city pool' : 'preferred branch'} are needed to assign.`}
        </p>
        <GhostButton onClick={save}>{lead ? 'Save as qualified' : 'Save to Inbox'}</GhostButton>
        <PrimaryButton type="submit" disabled={!qualified}>
          {destination === 'City Pool' ? <><Users size={15} /> Assign to City Pool</> : <><Building2 size={15} /> Assign to Branch</>}
        </PrimaryButton>
      </div>
    </form>
  );
}

/** Front Desk intake fields → a marketing lead carrying the full profile. */
function leadFromIntake(d: IntakeFormData): Omit<MarketingLead, 'id' | 'receivedAt' | 'stage'> {
  const academics = d.academics.filter((a) => a.level);
  return {
    name: d.name.trim(), phone: d.phone, email: d.email.trim() || undefined,
    source: (d.platformSource || 'Website') as LeadChannel, campaignId: d.campaignId || undefined,
    preferredCountry: d.country, purpose: d.purpose, preferredBranch: d.preferredBranch,
    academicBackground: academics.map((a) => `${a.level}${a.stream ? `, ${a.stream}` : ''}${a.gpa ? ` (${a.gpa})` : ''}`).join(' · ') || undefined,
    englishTest: d.ieltsPte || undefined,
    address: d.address, dob: d.dob, gender: d.gender, maritalStatus: d.maritalStatus, academics, workExperience: d.workExperience,
  };
}

export function AddLeadPage() {
  const { store, me, role, branches, actions } = useMarketing();
  const mine = store.leads.filter((l) => l.qualifiedBy === me || l.assignedBy === me)
    .sort((a, b) => (b.assignedAt ?? b.qualifiedAt ?? b.receivedAt).localeCompare(a.assignedAt ?? a.qualifiedAt ?? a.receivedAt))
    .slice(0, 6);
  if (!MKT_CAN.qualify(role)) return <p className="text-sm text-gray-500">Only the Leads Specialist and Marketing Manager add leads.</p>;

  const submit = (data: IntakeFormData, action: MarketingSubmitAction = 'assign') => {
    const lead = leadFromIntake(data);
    // Every Add Lead entry has its full profile and a branch, so it's already qualified.
    if (action === 'assign' && lead.preferredBranch) actions.addAndAssign(lead, lead.preferredBranch);
    else actions.addLead(lead, 'Qualified');
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
      <NewIntakeForm
        embedded
        marketing={{ branches, sources: LEAD_CHANNELS, campaigns: store.campaigns.map((c) => ({ id: c.id, name: c.name })) }}
        onSubmit={submit}
        findClientBranches={findClientBranches}
      />
      <Card title="Your recent leads" className="h-fit xl:mt-2">
        <ul className="divide-y divide-grey-border">
          {mine.map((l) => (
            <li key={l.id} className="px-5 py-2.5 text-sm">
              <p className="flex items-center justify-between gap-2"><span className="truncate font-medium text-navy">{l.name}</span><Pill text={l.stage} /></p>
              <p className="mt-0.5 text-xs text-gray-400">{l.stage === 'Assigned' ? `→ ${l.preferredBranch}` : l.source} · {ago(l.assignedAt ?? l.qualifiedAt ?? l.receivedAt)}</p>
            </li>
          ))}
          {mine.length === 0 && <li className="px-5 py-6 text-center text-sm text-gray-400">Nothing yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

// ── Lead 360 (simplified) ───────────────────────────────────────────────────
function JourneyStepper({ t }: { t: LeadTrack }) {
  return (
    <ol className="relative">
      {JOURNEY_STEPS.map((step, i) => {
        const date = t.journeyDates[i];
        const reached = i <= t.journey && date !== undefined;
        const skipped = i < t.journey && date === undefined;
        const current = i === t.journey;
        const label = step === 'Visa Decision' && t.visaOutcome ? `Visa ${t.visaOutcome}` : step === 'Offer' ? 'Offer Received' : step;
        const dotCls = current && t.visaOutcome === 'Refused' ? 'border-red-500 bg-red-500 text-white'
          : reached ? 'border-navy bg-navy text-white' : 'border-grey-border bg-white text-gray-300';
        return (
          <li key={step} className="relative flex gap-3 pb-4 last:pb-0">
            {i < JOURNEY_STEPS.length - 1 && <span className={`absolute left-[11px] top-6 h-[calc(100%-20px)] w-0.5 ${i < t.journey ? 'bg-navy' : 'bg-grey-border'}`} />}
            <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${dotCls} ${current ? 'ring-4 ring-navy/10' : ''}`}>
              {skipped ? <Minus size={12} className="text-white" /> : reached ? <Check size={12} /> : null}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={`text-sm ${current ? 'font-semibold text-navy' : reached ? 'text-navy' : 'text-gray-400'}`}>
                {label}
                {current && <span className="ml-2 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy">Current</span>}
              </p>
              <p className="text-xs text-gray-400">{skipped ? 'Not applicable for this file' : reached ? (date ? whenLabel(date) : 'Date not recorded') : 'Not reached yet'}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Lead360Drawer({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { store, tracks } = useMarketing();
  const lead = store.leads.find((l) => l.id === leadId);
  const t = tracks.find((x) => x.leadId === leadId);
  if (!lead) return null;
  const rows = (pairs: [string, React.ReactNode][]) => (
    <dl className="divide-y divide-grey-border rounded-lg border border-grey-border text-sm">
      {pairs.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 px-3 py-2"><dt className="shrink-0 text-gray-500">{k}</dt><dd className="text-right text-navy">{v || <span className="text-gray-400">—</span>}</dd></div>
      ))}
    </dl>
  );
  return (
    <Drawer
      title={lead.name}
      onClose={onClose}
      subtitle={t ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <Pill text={t.status} cls={trackStatusStyle(t)} />
          <span>{t.branch} · {t.counselor ?? 'awaiting counselor'}</span>
          <span>· updated {whenLabel(t.lastUpdate)}</span>
        </div>
      ) : <Pill text={lead.stage} />}
    >
      {/* Simplified Lead 360 — deliberately OMITTED for Marketing: financial ledgers and payment
          history, document uploads/checklists (SOPs, passports), counselor consultation notes and
          internal branch task histories. Only the whitelisted LeadTrack outcome is shown. */}
      <div className="space-y-6">
        {t && (
          <section>
            <h4 className="mb-3 text-sm font-semibold text-navy">Journey</h4>
            {t.slaBreached && <p className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><AlertTriangle size={14} /> Not contacted {Math.round(t.hoursUncontacted ?? 0)}h after assignment — past the {CONTACT_SLA_HOURS}h SLA.</p>}
            <JourneyStepper t={t} />
          </section>
        )}
        <section>
          <h4 className="mb-2 text-sm font-semibold text-navy">Basic info</h4>
          {rows([
            ['Phone', lead.phone], ['Email', lead.email], ['Interested country', lead.preferredCountry],
            ['Purpose', lead.purpose], ['Program', lead.interestedProgram],
            ['Intake', lead.intake], ['Academic background', lead.academicBackground], ['English test', lead.englishTest],
            ['Work experience', lead.workExperience],
            [lead.cityPool ? 'City Pool' : 'Preferred branch', lead.cityPool ? `${lead.cityPool} City Pool` : lead.preferredBranch],
          ])}
        </section>
        <section>
          <h4 className="mb-2 text-sm font-semibold text-navy">Marketing attribution</h4>
          {rows([
            ['Source', <SourceTag key="s" source={lead.source} />],
            ['Campaign', <CampaignTag key="c" campaigns={store.campaigns} id={lead.campaignId} />],
            ['Received', whenLabel(lead.receivedAt)],
            ['Qualified by', lead.qualifiedBy ? `${lead.qualifiedBy} · ${whenLabel(lead.qualifiedAt)}` : ''],
            ['Assigned by', lead.assignedBy ? `${lead.assignedBy} · ${whenLabel(lead.assignedAt)}` : ''],
          ])}
          {lead.notes && <p className="mt-2 rounded-lg bg-grey-bg px-3 py-2 text-xs text-gray-600">Marketing note: {lead.notes}</p>}
        </section>
        <ReadOnlyNote>Statuses sync automatically from the branch Counselor and V/A Officer modules and can't be changed here.</ReadOnlyNote>
      </div>
    </Drawer>
  );
}

// ── My Assigned Leads ───────────────────────────────────────────────────────
type MineFilter = 'All' | 'In progress' | 'Converted' | 'Needs attention' | 'Closed';

export function LeadTrackTable({ rows, onOpen, empty }: { rows: LeadTrack[]; onOpen: (id: string) => void; empty: string }) {
  const { store } = useMarketing();
  const leadOf = (id: string) => store.leads.find((l) => l.id === id);
  return (
    <TableBox min={760}>
      <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Name</Th><Th>Branch</Th><Th>Source</Th><Th>Status</Th><Th>Last Update</Th></tr></thead>
      <tbody className="divide-y divide-grey-border">
        {rows.map((t) => {
          const l = leadOf(t.leadId);
          return (
            <tr key={t.leadId} onClick={() => onOpen(t.leadId)} className={`cursor-pointer transition-colors hover:bg-grey-bg/60 ${t.slaBreached ? 'bg-red-50/60' : ''}`}>
              <Td>
                <span className={`font-medium ${t.slaBreached ? 'text-red-700' : 'text-navy'}`}>{l?.name}</span>
                <span className="block text-[11px] text-gray-400">{l?.interestedProgram ?? l?.purpose}{l?.preferredCountry ? ` · ${l.preferredCountry}` : ''}</span>
              </Td>
              <Td className="text-navy">{t.branch}<span className="block text-[11px] text-gray-400">{t.counselor ?? 'Unclaimed'}</span></Td>
              <Td><div className="flex flex-col items-start gap-1">{l && <SourceTag source={l.source} />}<span className="text-[11px] text-gray-500">{campaignName(store.campaigns, l?.campaignId)}</span></div></Td>
              <Td>
                <Pill text={t.status} cls={trackStatusStyle(t)} />
                {t.slaBreached && <span className="mt-1 block text-[11px] font-medium text-red-600">Not contacted · {Math.round(t.hoursUncontacted ?? 0)}h</span>}
                {t.consultationStuck && <span className="mt-1 block text-[11px] text-amber-700">Consultation not converting</span>}
                {t.noActivity && <span className="mt-1 block text-[11px] text-amber-700">No activity {t.daysSinceUpdate}d</span>}
              </Td>
              <Td className="whitespace-nowrap text-gray-500">{whenLabel(t.lastUpdate)}<span className="block text-[11px] text-gray-400">{t.daysSinceUpdate === 0 ? 'today' : `${t.daysSinceUpdate}d ago`}</span></Td>
            </tr>
          );
        })}
        {rows.length === 0 && <EmptyRow cols={5} text={empty} />}
      </tbody>
    </TableBox>
  );
}

export function MyAssignedLeads() {
  const { store, tracks, me } = useMarketing();
  const [filter, setFilter] = useState<MineFilter>('All');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useViewMode('my-leads');
  const mineIds = new Set(store.leads.filter((l) => l.assignedBy === me).map((l) => l.id));
  const mine = tracks.filter((t) => mineIds.has(t.leadId));
  const test: Record<MineFilter, (t: LeadTrack) => boolean> = {
    All: () => true,
    'In progress': (t) => !t.closed && t.journey < 4,
    Converted: (t) => t.journey >= 4 && t.visaOutcome !== 'Refused',
    'Needs attention': needsAttention,
    Closed: (t) => t.closed,
  };
  const counts = Object.fromEntries((Object.keys(test) as MineFilter[]).map((k) => [k, mine.filter(test[k]).length])) as Record<MineFilter, number>;
  const name = (id: string) => store.leads.find((l) => l.id === id)?.name.toLowerCase() ?? '';
  const rows = mine
    .filter((t) => test[filter](t) && (!q.trim() || name(t.leadId).includes(q.trim().toLowerCase()) || t.branch.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)) || b.lastUpdate.localeCompare(a.lastUpdate));

  return (
    <div className="space-y-4">
      <PageIntro text="Every lead you've routed to a branch. Click a lead to follow its journey — statuses update automatically from the branch.">
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or branch" className="w-full rounded-lg border border-grey-border py-2 pl-9 pr-3 text-sm focus:border-navy-light focus:outline-none" />
        </div>
      </PageIntro>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Chips options={Object.keys(test) as MineFilter[]} value={filter} onChange={setFilter} counts={counts} />
        <ViewToggle value={mode} onChange={setMode} />
      </div>
      {mode === 'sheet' ? (
        <ExcelSheet
          columns={trackColumns(store.campaigns)}
          rows={rows.map((t) => ({ t, l: store.leads.find((l) => l.id === t.leadId) }))}
          rowKey={(r) => r.t.leadId}
          rowTone={trackTone}
          onRowClick={(r) => setOpen(r.t.leadId)}
          filename={`my-assigned-leads${filter === 'All' ? '' : `-${filter.toLowerCase().replace(/ /g, '-')}`}`}
          emptyText={mine.length ? 'No leads in this view.' : "You haven't assigned any leads yet."}
        />
      ) : (
        <LeadTrackTable rows={rows} onOpen={setOpen} empty={mine.length ? 'No leads in this view.' : "You haven't assigned any leads yet."} />
      )}
      {open && <Lead360Drawer leadId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ── Follow-up Status (escalation queue) ─────────────────────────────────────
const RULES: { rule: BranchPing['rule']; test: (t: LeadTrack) => boolean; headline: (n: number) => string; detail: (t: LeadTrack) => string }[] = [
  {
    rule: 'uncontacted',
    test: (t) => t.slaBreached,
    headline: (n) => `${n} lead${n === 1 ? '' : 's'} assigned but not contacted`,
    detail: (t) => `${Math.round(t.hoursUncontacted ?? 0)}h since assignment`,
  },
  {
    rule: 'consultation-stuck',
    test: (t) => t.consultationStuck,
    headline: (n) => `${n} consultation${n === 1 ? '' : 's'} with no conversion (over ${CONSULTATION_STUCK_DAYS} days)`,
    detail: (t) => `in consultation since ${whenLabel(t.contactedAt)}`,
  },
  {
    rule: 'no-activity',
    test: (t) => t.noActivity,
    headline: (n) => `${n} lead${n === 1 ? '' : 's'} with no activity for ${NO_ACTIVITY_DAYS}+ days`,
    detail: (t) => `${t.status} · quiet for ${t.daysSinceUpdate} days`,
  },
];
type RuleFilter = 'All' | 'Not contacted' | 'Consultation stuck' | 'No activity';
const RULE_LABEL: Record<BranchPing['rule'], RuleFilter> = { uncontacted: 'Not contacted', 'consultation-stuck': 'Consultation stuck', 'no-activity': 'No activity' };

export function FollowUpStatus() {
  const { store, tracks, actions, role } = useMarketing();
  const [filter, setFilter] = useState<RuleFilter>('All');
  const [open, setOpen] = useState<string | null>(null);
  const canPing = MKT_CAN.qualify(role);
  const nameOf = (id: string) => store.leads.find((l) => l.id === id)?.name ?? id;

  const alerts = useMemo(() => RULES.flatMap((r) => {
    const hits = tracks.filter(r.test);
    const byBranch = new Map<string, LeadTrack[]>();
    hits.forEach((t) => byBranch.set(t.branch, [...(byBranch.get(t.branch) ?? []), t]));
    return [...byBranch.entries()].map(([branch, list]) => ({ ...r, branch, list }));
  }), [tracks]);
  const totals = RULES.map((r) => ({ ...r, n: tracks.filter(r.test).length }));
  const counts: Record<RuleFilter, number> = { All: 0, 'Not contacted': 0, 'Consultation stuck': 0, 'No activity': 0 };
  totals.forEach((r) => { counts[RULE_LABEL[r.rule]] = r.n; counts.All += r.n; });
  const shown = alerts.filter((a) => filter === 'All' || RULE_LABEL[a.rule] === filter);
  const lastPing = (branch: string, rule: BranchPing['rule']) => store.pings.find((p) => p.branch === branch && p.rule === rule);
  const [mode, setMode] = useViewMode('followups');
  const pingGroup = (a: (typeof alerts)[number]) => actions.pingBranch(a.branch, a.rule, a.list.map((t) => t.leadId),
    `${a.headline(a.list.length)} (${a.list.map((t) => nameOf(t.leadId)).join(', ')})`);
  // Excel view: one row per stuck lead, pinging still goes to the whole branch alert.
  const sheetRows: (AlertRow & { group: (typeof alerts)[number] })[] = shown.flatMap((a) => a.list.map((t) => ({
    t, l: store.leads.find((l) => l.id === t.leadId), alert: RULE_LABEL[a.rule], detail: a.detail(t),
    lastPing: lastPing(a.branch, a.rule)?.at, group: a,
  })));

  return (
    <div className="space-y-4">
      <PageIntro text="Leads stuck in a branch pipeline. Flag the branch and its Branch Manager gets an alert — Marketing never contacts the client or reassigns staff." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {totals.map((r) => (
          <button key={r.rule} type="button" onClick={() => setFilter(RULE_LABEL[r.rule])} className={`rounded-xl border bg-white px-4 py-3 text-left transition-colors hover:border-navy-light ${filter === RULE_LABEL[r.rule] ? 'border-navy' : 'border-grey-border'}`}>
            <p className={`text-2xl font-bold tabular-nums ${r.n ? (r.rule === 'uncontacted' ? 'text-red-600' : 'text-amber-700') : 'text-emerald-700'}`}>{r.n}</p>
            <p className="mt-0.5 text-sm text-gray-600">{r.headline(r.n).replace(/^\d+ /, '')}</p>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Chips options={['All', 'Not contacted', 'Consultation stuck', 'No activity'] as const} value={filter} onChange={setFilter} counts={counts} />
        <ViewToggle value={mode} onChange={setMode} />
      </div>
      {mode === 'sheet' ? (
        <ExcelSheet
          columns={alertColumns(canPing ? (r) => (
            <PrimaryButton small onClick={() => pingGroup((r as (typeof sheetRows)[number]).group)}><Flag size={12} /> Ping {r.t.branch}</PrimaryButton>
          ) : undefined)}
          rows={sheetRows}
          rowKey={(r) => `${r.alert}-${r.t.leadId}`}
          rowTone={(r) => (r.t.slaBreached ? 'red' : 'amber')}
          filename={`follow-up-status${filter === 'All' ? '' : `-${filter.toLowerCase().replace(/ /g, '-')}`}`}
          emptyText="Nothing stuck — every branch is moving its leads."
        />
      ) : (
      <ul className="space-y-3">
        {shown.map((a) => {
          const ping = lastPing(a.branch, a.rule);
          const red = a.rule === 'uncontacted';
          return (
            <li key={`${a.rule}-${a.branch}`} className={`dissolve-in rounded-xl border bg-white p-4 ${red ? 'border-red-200' : 'border-grey-border'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${red ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                  {red ? <AlertTriangle size={17} /> : <Clock size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy">{a.branch}: {a.headline(a.list.length)}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {a.list.map((t) => (
                      <li key={t.leadId}>
                        <button type="button" onClick={() => setOpen(t.leadId)} className="rounded-full border border-grey-border px-2.5 py-1 text-xs text-gray-600 transition-colors hover:border-navy-light hover:text-navy-light">
                          <span className="font-medium text-navy">{nameOf(t.leadId)}</span> · {a.detail(t)}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {ping && <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400"><BellRing size={11} /> Branch Manager pinged by {ping.by} · {ago(ping.at)}</p>}
                </div>
                {canPing && (
                  <PrimaryButton small onClick={() => pingGroup(a)}>
                    <Flag size={13} /> {ping ? 'Ping again' : 'Flag / Ping Branch'}
                  </PrimaryButton>
                )}
              </div>
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-grey-border bg-white px-4 py-10 text-sm text-emerald-700"><CheckCircle2 size={16} /> Nothing stuck — every branch is moving its leads.</li>
        )}
      </ul>
      )}
      {open && <Lead360Drawer leadId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ── Leads Dashboard ─────────────────────────────────────────────────────────
function LinkBtn({ to, children }: { to: string; children: React.ReactNode }) {
  const { navigate } = useMarketing();
  return <button type="button" onClick={() => navigate(to)} className="text-xs font-medium text-navy transition-colors hover:text-navy-light">{children} →</button>;
}

export function LeadsDashboard() {
  const { store, tracks } = useMarketing();
  const [open, setOpen] = useState<string | null>(null);
  const raw = store.leads.filter((l) => l.stage === 'Raw');
  const unassigned = store.leads.filter((l) => l.stage === 'Qualified');
  const at = (i: number) => tracks.filter((t) => t.journey >= i).length;
  const approved = tracks.filter((t) => t.visaOutcome === 'Approved').length;
  const flagged = tracks.filter(needsAttention);
  const stages: [string, number][] = [
    ['Assigned', tracks.length], ['Contacted', at(2)], ['Consultation', at(3)], ['Client', at(4)],
    ['Application', at(5)], ['Offer', tracks.filter((t) => t.journeyDates[6] !== undefined).length], ['Visa Submitted', at(7)], ['Visa Approved', approved],
  ];
  const recent = [...tracks].sort((a, b) => b.lastUpdate.localeCompare(a.lastUpdate)).slice(0, 6);
  const nameOf = (id: string) => store.leads.find((l) => l.id === id)?.name;
  const todayRaw = raw.filter((l) => ago(l.receivedAt).includes('min') || ago(l.receivedAt).includes('hr')).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="New Leads" value={raw.length} hint={`${todayRaw} in the last 24h`} />
        <Kpi label="Unassigned Leads" value={unassigned.length} hint="Qualified, waiting for a branch" tone={unassigned.length ? 'amber' : undefined} />
        <Kpi label="Assigned Leads" value={tracks.length} hint={`${tracks.filter((t) => t.slaBreached).length} past contact SLA`} />
        <Kpi label="Contacted" value={at(2)} />
        <Kpi label="Consultations" value={at(3)} />
        <Kpi label="Converted Clients" value={at(4)} tone="green" />
        <Kpi label="Applications" value={at(5)} />
        <Kpi label="Visa Approved" value={approved} tone="green" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <Card title="From marketing lead to branch result" action={<LinkBtn to="mkt-report-leads">Reports</LinkBtn>}>
          <ol className="space-y-2.5 px-5 py-4">
            {stages.map(([label, n]) => (
              <li key={label} className="grid grid-cols-[104px_1fr_48px] items-center gap-3 text-xs" title={`${label}: ${n}`}>
                <span className="font-medium text-gray-600">{label}</span>
                <div className="h-5 rounded-md bg-grey-bg">
                  <div className="h-5 rounded-md bg-navy transition-all duration-500 hover:bg-navy-light" style={{ width: `${tracks.length ? Math.max(n ? 4 : 0, (n / tracks.length) * 100) : 0}%` }} />
                </div>
                <span className="text-right font-semibold tabular-nums text-navy">{n}</span>
              </li>
            ))}
          </ol>
          <p className="border-t border-grey-border px-5 py-2 text-[11px] text-gray-400">Share of assigned leads that reached each stage. Synced from branch modules.</p>
        </Card>
        <Card title={`Needs attention · ${flagged.length}`} action={<LinkBtn to="ls-followups">Follow-up Status</LinkBtn>}>
          <ul className="divide-y divide-grey-border">
            {flagged.slice(0, 5).map((t) => (
              <li key={t.leadId}>
                <button type="button" onClick={() => setOpen(t.leadId)} className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-sm transition-colors hover:bg-grey-bg/60">
                  <AlertTriangle size={14} className={t.slaBreached ? 'text-red-600' : 'text-amber-600'} />
                  <span className="min-w-0 flex-1 truncate font-medium text-navy">{nameOf(t.leadId)}</span>
                  <span className="text-xs text-gray-500">{t.branch}</span>
                  <span className={`text-xs ${t.slaBreached ? 'text-red-600' : 'text-amber-700'}`}>{t.slaBreached ? 'Not contacted' : t.consultationStuck ? 'Stuck in consultation' : `Quiet ${t.daysSinceUpdate}d`}</span>
                </button>
              </li>
            ))}
            {flagged.length === 0 && <li className="px-5 py-6 text-center text-sm text-gray-400">Nothing stuck.</li>}
          </ul>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Inbox by source" action={<LinkBtn to="mkt-inbox">Lead Inbox</LinkBtn>}>
          <ul className="divide-y divide-grey-border">
            {LEAD_CHANNELS.map((s) => {
              const n = raw.filter((l) => l.source === s).length;
              const q = unassigned.filter((l) => l.source === s).length;
              return (
                <li key={s} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <SourceTag source={s} />
                  <span className="flex-1" />
                  <span className="text-xs text-gray-500">{n} new · {q} qualified</span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-grey-border px-5 py-3"><LinkBtn to="ls-add-lead"><UserPlus size={12} className="mr-1 inline" />Add a lead</LinkBtn></div>
        </Card>
        <Card title="Latest branch movement" action={<LinkBtn to="mkt-monitoring">Lead Monitoring</LinkBtn>}>
          <ul className="divide-y divide-grey-border">
            {recent.map((t) => (
              <li key={t.leadId}>
                <button type="button" onClick={() => setOpen(t.leadId)} className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-sm transition-colors hover:bg-grey-bg/60">
                  <span className="min-w-0 flex-1 truncate font-medium text-navy">{nameOf(t.leadId)}</span>
                  <span className="text-xs text-gray-500">{t.branch}</span>
                  <Pill text={t.status} cls={trackStatusStyle(t)} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {open && <Lead360Drawer leadId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
