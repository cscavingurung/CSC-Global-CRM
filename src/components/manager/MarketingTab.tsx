import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, ExternalLink, Megaphone, Plus, Send, UserCheck } from 'lucide-react';
import { BranchContentType, BranchRequestStatus, ContentRequest, MarketingSupportKind, MarketingSupportStatus } from '../../types';
import {
  ALL_TIME, CHANNEL_GROUPS, CONTENT_TYPES, MARKETING_SOURCES, STAGE_LABELS, STAGE_STYLES, stageLabel, DIRECTIVE_STATES, DIRECTIVE_STYLES, DateRange, DirectiveState, directiveState, FUNNEL_HINTS, INTAKES, LEAD_SOURCES,
  REQUEST_STATUSES, REQUEST_STYLES, SUPPORT_KINDS, SUPPORT_STATUSES, SUPPORT_STYLES, TARGET_COUNTRIES, branchLeads,
  dayLabel, inRange, pct, summarise,
} from '../../managerWorkspace';
import { rs } from '../../finance';
import { clampDateInput, dateKey } from '../../dateTime';
import { Card, Field, GhostButton, Kpi, Modal, PrimaryButton, SelectInput, SourceTag, TextArea, TextInput } from '../marketing/MktShared';
import { NewContentRequest, NewSupportRequest, useWorkspace } from './workspaceContext';
import { Badge, Column, DataList, DateRangeControl, FilterBar, FilterSelect, SearchFilter, SectionHeading, StepTrack } from './WorkspaceShared';

const todayKey = () => dateKey(new Date());

// ═══ 1. Summary report ═══════════════════════════════════════════════════════
export function MarketingSummary() {
  const { data } = useWorkspace();
  const [range, setRange] = useState<DateRange>({ preset: 'This Month', from: '', to: '' });
  const [channel, setChannel] = useState('');
  const [source, setSource] = useState('');
  const [counselor, setCounselor] = useState('');

  const all = useMemo(
    () => branchLeads(data.intakes, data.consultations, data.applications, data.transactions),
    [data.intakes, data.consultations, data.applications, data.transactions],
  );
  const leads = all.filter((l) => inRange(l.receivedAt, range) && (!channel || l.channel === channel) && (!source || l.source === source) && (!counselor || l.counselor === counselor));
  const s = summarise(leads);
  const counselors = data.staff.filter((m) => m.role === 'Counselor').map((m) => m.name).sort();
  const filtered = range.preset !== 'This Month' || Boolean(channel || source || counselor);
  // A source only makes sense inside its channel — picking a channel narrows the source list.
  const sourceOptions = channel === 'Marketing' ? MARKETING_SOURCES : channel ? LEAD_SOURCES.filter((x) => !MARKETING_SOURCES.includes(x)) : LEAD_SOURCES;

  const bySource = LEAD_SOURCES.map((src) => ({ key: src as string, ...summarise(leads.filter((l) => l.source === src)) })).filter((r) => r.total > 0);
  const byCounselor = [...new Set(leads.map((l) => l.counselor ?? 'Unassigned'))].sort()
    .map((c) => ({ key: c, ...summarise(leads.filter((l) => (l.counselor ?? 'Unassigned') === c)) }));
  type Row = (typeof bySource)[number];
  const breakdownCols = (first: string): Column<Row>[] => [
    { header: first, cell: (r) => <span className="font-medium text-navy">{r.key}</span> },
    { header: 'Leads', right: true, cell: (r) => <span className="tabular-nums">{r.total}</span> },
    { header: 'Contact Rate', right: true, cell: (r) => <span className="tabular-nums">{r.contactRate}%</span> },
    { header: 'Conversion', right: true, cell: (r) => <span className="tabular-nums">{r.conversionRate}%</span> },
    { header: 'Applications', right: true, cell: (r) => <span className="tabular-nums">{r.applications}</span> },
    { header: 'Revenue', right: true, cell: (r) => <span className="tabular-nums">{rs(r.revenue)}</span> },
  ];
  const breakdownCard = (r: Row) => (
    <div className="space-y-1">
      <p className="font-semibold text-navy">{r.key}</p>
      <p className="text-xs text-gray-500">{r.total} leads · {r.contactRate}% contacted · {r.conversionRate}% converted</p>
      <p className="text-xs text-gray-400">{r.applications} applications · {rs(r.revenue)}</p>
    </div>
  );

  const top = s.funnel[0]?.count ?? 0;
  return (
    <div className="space-y-5">
      <FilterBar active={filtered} onReset={() => { setRange({ preset: 'This Month', from: '', to: '' }); setChannel(''); setSource(''); setCounselor(''); }}>
        <DateRangeControl value={range} onChange={setRange} />
        <FilterSelect label="Channel" value={channel} onChange={(v) => { setChannel(v); setSource(''); }} all="All Channels" options={CHANNEL_GROUPS} />
        <FilterSelect label="Lead Source" value={source} onChange={setSource} all="All Sources" options={sourceOptions} />
        <FilterSelect label="Counselor" value={counselor} onChange={setCounselor} all="All Counselors" options={counselors} />
      </FilterBar>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Total Branch Leads" value={s.total} hint={`${range.preset === 'Custom' ? 'Custom range' : range.preset}`} />
        <Kpi label="Contact Rate" value={`${s.contactRate}%`} hint="Picked up by a counselor" tone={s.total && s.contactRate < 60 ? 'amber' : undefined} />
        <Kpi label="Client Conversion" value={`${s.conversionRate}%`} hint="Lead → proceeding client" />
        <Kpi label="Applications Generated" value={s.applications} hint="Offer or visa file lodged" />
        <Kpi label="Revenue Attributed" value={rs(s.revenue)} hint="Payments received from these clients" tone={s.revenue > 0 ? 'green' : undefined} />
      </div>

      <Card title="Lead Funnel">
        <div className="space-y-3 px-5 py-4">
          {top === 0 && s.total === 0 && <p className="py-6 text-center text-sm text-gray-400">No leads match these filters.</p>}
          {(top > 0 || s.total > 0) && s.funnel.map((f, i) => {
            const prev = i === 0 ? s.total : s.funnel[i - 1].count;
            const width = s.total > 0 ? Math.max(f.count > 0 ? 2 : 0, (f.count / s.total) * 100) : 0;
            return (
              <div key={f.stage} className="group grid grid-cols-[110px_1fr_auto] items-center gap-3" title={`${f.stage}: ${f.count} of ${s.total} leads (${pct(f.count, s.total)}%) — ${FUNNEL_HINTS[f.stage]}`}>
                <div>
                  <p className="text-sm font-medium text-navy">{f.stage}</p>
                  <p className="text-[11px] text-gray-400">{FUNNEL_HINTS[f.stage]}</p>
                </div>
                <div className="h-6 rounded bg-grey-bg">
                  <div className="h-6 rounded-r bg-navy transition-all duration-500 group-hover:bg-navy-light" style={{ width: `${width}%` }} />
                </div>
                <p className="w-28 text-right text-sm">
                  <span className="font-semibold tabular-nums text-navy">{f.count}</span>
                  <span className="ml-1 text-xs text-gray-400">{i === 0 ? `${pct(f.count, s.total)}% of leads` : `${pct(f.count, prev)}% of prev.`}</span>
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-2">
          <SectionHeading title="By Lead Source" />
          <DataList rows={bySource} columns={breakdownCols('Source')} rowKey={(r) => r.key} card={breakdownCard} empty="No leads in this range." />
        </section>
        <section className="space-y-2">
          <SectionHeading title="By Counselor" />
          <DataList rows={byCounselor} columns={breakdownCols('Counselor')} rowKey={(r) => r.key} card={breakdownCard} empty="No leads in this range." />
        </section>
      </div>
      <p className="text-[11px] text-gray-400">Live from this branch’s intake, consultation, application and payment records. Walk-in and referral clients are included so every channel can be compared.</p>
    </div>
  );
}

// ═══ 1b. Marketing clients ══════════════════════════════════════════════════
// Every branch client, filtered by default to the ones received through Marketing, followed
// through to their current stage.
export function MarketingClients() {
  const { data } = useWorkspace();
  const [channel, setChannel] = useState('Marketing');
  const [source, setSource] = useState('');
  const [counselor, setCounselor] = useState('');
  const [stage, setStage] = useState('');
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [q, setQ] = useState('');

  const all = useMemo(
    () => branchLeads(data.intakes, data.consultations, data.applications, data.transactions),
    [data.intakes, data.consultations, data.applications, data.transactions],
  );
  const inChannel = all.filter((l) => !channel || l.channel === channel);
  const rows = inChannel
    .filter((l) => (!source || l.source === source) && (!counselor || (l.counselor ?? 'Unassigned') === counselor)
      && (!stage || stageLabel(l.reached) === stage) && inRange(l.receivedAt, range)
      && (!q || `${l.name} ${l.clientId ?? ''} ${l.country}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const sourceOptions = channel === 'Marketing' ? MARKETING_SOURCES : channel ? LEAD_SOURCES.filter((x) => !MARKETING_SOURCES.includes(x)) : LEAD_SOURCES;
  const counselors = [...new Set(inChannel.map((l) => l.counselor ?? 'Unassigned'))].sort();
  const s = summarise(rows);
  const unassigned = rows.filter((l) => l.reached < 0).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={channel === 'Marketing' ? 'Marketing Clients' : 'Clients'} value={s.total} hint={channel ? `${channel} channel` : 'All channels'} />
        <Kpi label="Awaiting a Counselor" value={unassigned} tone={unassigned ? 'amber' : undefined} />
        <Kpi label="Converted to Client" value={`${s.conversionRate}%`} hint={`${s.funnel[3].count} proceeding`} />
        <Kpi label="Revenue Attributed" value={rs(s.revenue)} tone={s.revenue > 0 ? 'green' : undefined} />
      </div>
      <FilterBar
        active={channel !== 'Marketing' || Boolean(source || counselor || stage || q || range.preset !== 'All Time')}
        onReset={() => { setChannel('Marketing'); setSource(''); setCounselor(''); setStage(''); setQ(''); setRange(ALL_TIME); }}
      >
        <SearchFilter value={q} onChange={setQ} placeholder="Name, Client ID, country…" />
        <FilterSelect label="Channel" value={channel} onChange={(v) => { setChannel(v); setSource(''); setCounselor(''); }} all="All Channels" options={CHANNEL_GROUPS} />
        <FilterSelect label="Lead Source" value={source} onChange={setSource} all="All Sources" options={sourceOptions} />
        <FilterSelect label="Counselor" value={counselor} onChange={setCounselor} all="All Counselors" options={counselors} />
        <FilterSelect label="Stage" value={stage} onChange={setStage} all="All Stages" options={STAGE_LABELS} />
        <DateRangeControl label="Received" value={range} onChange={setRange} />
      </FilterBar>
      <DataList
        rows={rows}
        rowKey={(l) => l.id}
        empty={channel === 'Marketing' ? 'No clients received through Marketing match these filters.' : 'No clients match these filters.'}
        columns={[
          { header: 'Client', cell: (l) => <div><p className="font-medium text-navy">{l.name}</p><p className="text-xs text-gray-400">{l.clientId ?? 'No Client ID yet'} · {l.country}</p></div> },
          { header: 'Source', cell: (l) => <SourceTag source={l.source} /> },
          { header: 'Counselor', cell: (l) => l.counselor ? <span className="text-navy">{l.counselor}</span> : <span className="text-amber-700">Unassigned</span> },
          { header: 'Received', cell: (l) => <span className="whitespace-nowrap text-gray-600">{dayLabel(l.receivedAt)}</span> },
          { header: 'Stage', cell: (l) => <Badge text={stageLabel(l.reached)} cls={STAGE_STYLES[stageLabel(l.reached)]} /> },
          { header: 'Revenue', right: true, cell: (l) => <span className="tabular-nums">{l.revenue ? rs(l.revenue) : '—'}</span> },
        ]}
        card={(l) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-navy">{l.name}</p>
              <Badge text={stageLabel(l.reached)} cls={STAGE_STYLES[stageLabel(l.reached)]} />
            </div>
            <p className="text-xs text-gray-400">{l.clientId ?? 'No Client ID yet'} · {l.country} · {dayLabel(l.receivedAt)}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500"><SourceTag source={l.source} /> {l.counselor ?? 'Unassigned'}</div>
          </div>
        )}
      />
      <p className="text-[11px] text-gray-400">“Marketing” covers leads the Marketing team assigned or broadcast to this branch (Facebook, Instagram, TikTok, website and other campaigns).</p>
    </div>
  );
}

// ═══ 2. Outbound requests to central Marketing ═══════════════════════════════
function ContentRequestForm({ onClose }: { onClose: () => void }) {
  const { actions, flash } = useWorkspace();
  const [f, setF] = useState<NewContentRequest>({ type: 'Flyer', intake: INTAKES[0], country: TARGET_COUNTRIES[0], notes: '', neededBy: '' });
  const valid = f.notes.trim().length >= 10 && f.neededBy >= todayKey();
  return (
    <Modal title="Create Content Request" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!valid) return; actions.addContentRequest({ ...f, notes: f.notes.trim() }); flash(`${f.type} requested from Marketing.`); onClose(); }}>
        <Field label="Content Type" required>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setF({ ...f, type: t as BranchContentType })}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${f.type === t ? 'border-navy bg-navy text-white' : 'border-grey-border text-gray-500 hover:bg-grey-bg'}`}>{t}</button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target Intake" required>
            <SelectInput value={f.intake} onChange={(v) => setF({ ...f, intake: v })} label="Target Intake">{INTAKES.map((i) => <option key={i}>{i}</option>)}</SelectInput>
          </Field>
          <Field label="Target Country" required>
            <SelectInput value={f.country} onChange={(v) => setF({ ...f, country: v })} label="Target Country">{TARGET_COUNTRIES.map((c) => <option key={c}>{c}</option>)}</SelectInput>
          </Field>
        </div>
        <Field label="Requirement Notes" required hint="Size, languages, key messages, where it will be used.">
          <TextArea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. A5 flyer for the Saturday college fair — nursing pathways, QR to booking form." />
        </Field>
        <Field label="Needed Date" required>
          <TextInput type="date" min={todayKey()} value={f.neededBy} onChange={(e) => setF({ ...f, neededBy: e.target.value })} onBlur={(e) => { const c = clampDateInput(e.target.value, { min: todayKey() }); if (c) setF({ ...f, neededBy: c }); }} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-grey-border pt-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}><Send size={14} /> Send to Marketing</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function SupportRequestForm({ onClose }: { onClose: () => void }) {
  const { actions, flash } = useWorkspace();
  const [f, setF] = useState<NewSupportRequest>({ kind: 'Local Ad Boost', title: '', budget: 0, startDate: '', endDate: '', audience: '', justification: '' });
  const valid = f.title.trim().length >= 4 && f.justification.trim().length >= 10 && f.startDate >= todayKey() && (!f.endDate || f.endDate >= f.startDate) && f.budget >= 0;
  return (
    <Modal title="Request Marketing Support" onClose={onClose} wide>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        actions.addSupportRequest({ ...f, title: f.title.trim(), audience: f.audience.trim(), justification: f.justification.trim(), endDate: f.endDate || undefined });
        flash(`${f.kind} request sent to Marketing.`);
        onClose();
      }}>
        <Field label="Support Type" required>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORT_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setF({ ...f, kind: k as MarketingSupportKind })}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${f.kind === k ? 'border-navy bg-navy text-white' : 'border-grey-border text-gray-500 hover:bg-grey-bg'}`}>{k}</button>
            ))}
          </div>
        </Field>
        <Field label="Title" required>
          <TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Boost Canada January posts around the branch" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Budget (Rs)" hint="0 if no spend is needed">
            <TextInput type="number" min={0} step={500} value={f.budget || ''} onChange={(e) => setF({ ...f, budget: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
          <Field label="Start Date" required>
            <TextInput type="date" min={todayKey()} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} onBlur={(e) => { const c = clampDateInput(e.target.value, { min: todayKey() }); if (c) setF({ ...f, startDate: c }); }} />
          </Field>
          <Field label="End Date">
            <TextInput type="date" min={f.startDate || todayKey()} value={f.endDate ?? ''} onChange={(e) => setF({ ...f, endDate: e.target.value })} onBlur={(e) => { const c = clampDateInput(e.target.value, { min: f.startDate || todayKey() }); if (c) setF({ ...f, endDate: c }); }} />
          </Field>
        </div>
        <Field label="Target Audience">
          <TextInput value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} placeholder="e.g. +2 graduates within 25 km, age 18–30" />
        </Field>
        <Field label="Why the branch needs it" required>
          <TextArea value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} placeholder="Expected leads, competitor activity, event details…" />
        </Field>
        <div className="flex justify-end gap-2 border-t border-grey-border pt-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}><Send size={14} /> Submit Request</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export function MarketingRequests() {
  const { data, actions, flash } = useWorkspace();
  const [form, setForm] = useState<'content' | 'support' | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  // Content request filters
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [q, setQ] = useState('');
  const content = data.store.contentRequests
    .filter((r) => (!status || r.status === status) && (!type || r.type === type) && inRange(r.requestedAt, range)
      && (!q || `${r.code} ${r.notes} ${r.country} ${r.intake}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  // Support request filters
  const [sStatus, setSStatus] = useState('');
  const [kind, setKind] = useState('');
  const [sRange, setSRange] = useState<DateRange>(ALL_TIME);
  const support = data.store.supportRequests
    .filter((r) => (!sStatus || r.status === sStatus) && (!kind || r.kind === kind) && inRange(r.requestedAt, sRange))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const count = (st: BranchRequestStatus) => data.store.contentRequests.filter((r) => r.status === st).length;
  const cancelling = data.store.contentRequests.find((r) => r.id === cancelId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {REQUEST_STATUSES.map((st) => <Kpi key={st} label={st} value={count(st)} />)}
      </div>

      <section className="space-y-3">
        <SectionHeading
          title="My Branch Marketing Requests"
          hint="Collateral you’ve asked central Marketing to produce."
          action={<PrimaryButton onClick={() => setForm('content')}><Plus size={15} /> Create Content Request</PrimaryButton>}
        />
        <FilterBar active={Boolean(status || type || q || range.preset !== 'All Time')} onReset={() => { setStatus(''); setType(''); setQ(''); setRange(ALL_TIME); }}>
          <SearchFilter value={q} onChange={setQ} placeholder="Code, country, notes…" />
          <FilterSelect label="Status" value={status} onChange={setStatus} all="All Statuses" options={REQUEST_STATUSES} />
          <FilterSelect label="Type" value={type} onChange={setType} all="All Types" options={CONTENT_TYPES} />
          <DateRangeControl label="Requested" value={range} onChange={setRange} />
        </FilterBar>
        <DataList
          rows={content}
          rowKey={(r) => r.id}
          empty="No content requests match these filters."
          columns={[
            { header: 'Request', cell: (r) => (
              <div className="max-w-sm">
                <p className="font-medium text-navy">{r.type} <span className="font-normal text-gray-400">· {r.code}</span></p>
                <p className="text-xs text-gray-500">{r.country} · {r.intake}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{r.notes}</p>
              </div>
            ) },
            { header: 'Needed By', cell: (r) => <span className={r.status !== 'Delivered' && r.neededBy < todayKey() ? 'font-medium text-red-700' : 'text-gray-600'}>{dayLabel(r.neededBy)}</span> },
            { header: 'Requested', cell: (r) => <span className="text-gray-600">{dayLabel(r.requestedAt)}</span> },
            { header: 'Status', cell: (r) => <div className="space-y-1.5"><Badge text={r.status} cls={REQUEST_STYLES[r.status]} /><StepTrack steps={REQUEST_STATUSES} current={r.status} /></div> },
            { header: 'From Marketing', cell: (r) => (
              <div className="max-w-xs text-xs text-gray-500">
                {r.marketingNote ?? '—'}
                {r.deliveredLink && <a href={r.deliveredLink} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 font-medium text-navy hover:text-navy-light">Open files <ExternalLink size={11} /></a>}
              </div>
            ) },
            { header: '', right: true, cell: (r) => r.status === 'Requested' && (
              <button type="button" onClick={() => setCancelId(r.id)} className="text-sm font-medium text-red-500 hover:text-red-600">Cancel</button>
            ) },
          ]}
          card={(r) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-navy">{r.type} <span className="font-normal text-gray-400">· {r.code}</span></p>
                <Badge text={r.status} cls={REQUEST_STYLES[r.status]} />
              </div>
              <p className="text-xs text-gray-400">{r.country} · {r.intake} · needed {dayLabel(r.neededBy)}</p>
              <p className="text-xs text-gray-500">{r.notes}</p>
              <StepTrack steps={REQUEST_STATUSES} current={r.status} />
              {r.marketingNote && <p className="text-xs text-gray-500">Marketing: {r.marketingNote}</p>}
              {r.status === 'Requested' && <button type="button" onClick={() => setCancelId(r.id)} className="text-sm font-medium text-red-500">Cancel request</button>}
            </div>
          )}
        />
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Marketing Support Requests"
          hint="Local ad boosts, event sponsorship and regional campaign drives."
          action={<GhostButton onClick={() => setForm('support')}><Megaphone size={15} /> Request Marketing Support</GhostButton>}
        />
        <FilterBar active={Boolean(sStatus || kind || sRange.preset !== 'All Time')} onReset={() => { setSStatus(''); setKind(''); setSRange(ALL_TIME); }}>
          <FilterSelect label="Status" value={sStatus} onChange={setSStatus} all="All Statuses" options={SUPPORT_STATUSES} />
          <FilterSelect label="Support Type" value={kind} onChange={setKind} all="All Types" options={SUPPORT_KINDS} />
          <DateRangeControl label="Requested" value={sRange} onChange={setSRange} />
        </FilterBar>
        <DataList
          rows={support}
          rowKey={(r) => r.id}
          empty="No support requests match these filters."
          columns={[
            { header: 'Request', cell: (r) => (
              <div className="max-w-sm">
                <p className="font-medium text-navy">{r.title}</p>
                <p className="text-xs text-gray-400">{r.kind} · {r.code}</p>
              </div>
            ) },
            { header: 'Budget', right: true, cell: (r) => <span className="tabular-nums">{r.budget ? rs(r.budget) : '—'}</span> },
            { header: 'Runs', cell: (r) => <span className="text-gray-600">{dayLabel(r.startDate)}{r.endDate ? ` – ${dayLabel(r.endDate)}` : ''}</span> },
            { header: 'Status', cell: (r) => <Badge text={r.status} cls={SUPPORT_STYLES[r.status as MarketingSupportStatus]} /> },
            { header: 'Response', cell: (r) => <span className="block max-w-xs text-xs text-gray-500">{r.responseNote ?? 'Awaiting Marketing'}</span> },
          ]}
          card={(r) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-navy">{r.title}</p>
                <Badge text={r.status} cls={SUPPORT_STYLES[r.status]} />
              </div>
              <p className="text-xs text-gray-400">{r.kind} · {r.budget ? rs(r.budget) : 'No budget'} · from {dayLabel(r.startDate)}</p>
              {r.responseNote && <p className="text-xs text-gray-500">{r.responseNote}</p>}
            </div>
          )}
        />
      </section>

      {form === 'content' && <ContentRequestForm onClose={() => setForm(null)} />}
      {form === 'support' && <SupportRequestForm onClose={() => setForm(null)} />}
      {cancelling && (
        <Modal title="Cancel this request?" onClose={() => setCancelId(null)}>
          <p className="text-sm text-gray-600">{cancelling.type} for {cancelling.country} ({cancelling.code}) will be withdrawn before Marketing starts on it.</p>
          <div className="mt-5 flex justify-end gap-2">
            <GhostButton onClick={() => setCancelId(null)}>Keep it</GhostButton>
            <button type="button" onClick={() => { actions.cancelContentRequest(cancelling.id); flash(`${cancelling.code} cancelled.`); setCancelId(null); }}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700">Cancel Request</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══ 3. Inbound directives (Central Marketing → branch staff) ═════════════════

function DelegateModal({ req, onClose }: { req: ContentRequest; onClose: () => void }) {
  const { data, actions, flash } = useWorkspace();
  // Counselors and the Front Desk each have a Marketing inbox to submit from.
  const people = data.staff.filter((s) => (s.role === 'Counselor' || s.role === 'Front Desk Officer') && s.status === 'Active')
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  const today = todayKey();
  const [to, setTo] = useState(people.some((p) => p.name === req.targetCounselor) ? req.targetCounselor : '');
  const [due, setDue] = useState(req.internalDue ?? (req.deadline >= today ? req.deadline : today));
  const [note, setNote] = useState(req.delegationNote ?? '');
  const valid = Boolean(to && due >= today);
  const afterDeadline = due > req.deadline;
  return (
    <Modal title="Delegate to Staff" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!valid) return; actions.delegateDirective(req.id, to, due, note.trim()); flash(`Delegated to ${to} — due ${dayLabel(due)}.`); onClose(); }}>
        <div className="space-y-1 rounded-xl bg-grey-bg p-4 text-sm">
          <p className="font-semibold text-navy">{req.topic}</p>
          <p className="text-xs text-gray-500">{req.needed} · requested by {req.requestedBy}</p>
          <p className="text-xs text-gray-500">Marketing deadline: <b className="text-navy">{dayLabel(req.deadline)}</b></p>
          {req.targetCounselor && <p className="text-xs text-gray-500">Marketing suggested: {req.targetCounselor}</p>}
          {req.notes && <p className="pt-1 text-xs text-gray-600">“{req.notes}”</p>}
        </div>
        <Field label="Assign To" required hint="They receive it in their Marketing inbox and upload the files from there.">
          <SelectInput value={to} onChange={setTo} label="Assign To">
            <option value="">{people.length ? 'Select a counselor or front desk officer' : 'No active counselor or front desk officer'}</option>
            {people.map((p) => <option key={p.name} value={p.name}>{p.name} — {p.role}</option>)}
          </SelectInput>
        </Field>
        <Field label="Internal Due Date" required>
          <TextInput type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} onBlur={(e) => { const c = clampDateInput(e.target.value, { min: today }); if (c) setDue(c); }} />
        </Field>
        {afterDeadline && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> This is after Marketing’s deadline — they will receive it late.</p>
        )}
        <Field label="Instructions for staff">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Use the client room after 4 PM, bring the approved script." />
        </Field>
        <div className="flex justify-end gap-2 border-t border-grey-border pt-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}><UserCheck size={14} /> {req.delegatedBy ? 'Update Delegation' : 'Delegate'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export function InboundDirectives() {
  const { data } = useWorkspace();
  const [open, setOpen] = useState<string | null>(null);
  const [state, setState] = useState('');
  const [assignee, setAssignee] = useState('');
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [q, setQ] = useState('');
  const today = todayKey();

  const lateInternal = (r: ContentRequest) => directiveState(r) === 'Delegated' && Boolean(r.internalDue && r.internalDue < today);
  const rows = data.directives
    .filter((r) => (!state || directiveState(r) === state) && (!assignee || r.targetCounselor === assignee) && inRange(r.requestedAt, range)
      && (!q || `${r.topic} ${r.needed} ${r.requestedBy}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => DIRECTIVE_STATES.indexOf(directiveState(a)) - DIRECTIVE_STATES.indexOf(directiveState(b)) || a.deadline.localeCompare(b.deadline));
  const counts = (s: DirectiveState) => data.directives.filter((r) => directiveState(r) === s).length;
  const assignees = [...new Set(data.directives.map((r) => r.targetCounselor).filter(Boolean))].sort();
  const req = data.directives.find((r) => r.id === open);

  const action = (r: ContentRequest) => directiveState(r) !== 'Submitted' && (
    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(r.id); }} className="inline-flex items-center gap-1 text-sm font-medium text-navy hover:text-navy-light">
      <UserCheck size={15} /> {r.delegatedBy ? 'Reassign' : 'Delegate'}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Awaiting Delegation" value={counts('Awaiting Delegation')} tone={counts('Awaiting Delegation') ? 'amber' : undefined} />
        <Kpi label="Delegated" value={counts('Delegated')} />
        <Kpi label="Past Internal Due" value={data.directives.filter(lateInternal).length} tone={data.directives.some(lateInternal) ? 'red' : undefined} />
        <Kpi label="Submitted to Marketing" value={counts('Submitted')} tone="green" />
      </div>
      <FilterBar active={Boolean(state || assignee || q || range.preset !== 'All Time')} onReset={() => { setState(''); setAssignee(''); setQ(''); setRange(ALL_TIME); }}>
        <SearchFilter value={q} onChange={setQ} placeholder="Topic, format, requester…" />
        <FilterSelect label="Status" value={state} onChange={setState} all="All Statuses" options={DIRECTIVE_STATES} />
        <FilterSelect label="Staff" value={assignee} onChange={setAssignee} all="All Staff" options={assignees} />
        <DateRangeControl label="Received" value={range} onChange={setRange} />
      </FilterBar>
      <DataList
        rows={rows}
        rowKey={(r) => r.id}
        empty="No requests from Marketing match these filters."
        rowClass={(r) => (lateInternal(r) ? 'bg-red-50 text-red-700' : '')}
        columns={[
          { header: 'Request from Marketing', cell: (r) => (
            <div className="max-w-sm">
              <p className="font-medium text-navy">{r.topic}</p>
              <p className="text-xs text-gray-500">{r.needed} · {r.requestedBy} · {dayLabel(r.requestedAt)}</p>
            </div>
          ) },
          { header: 'Assigned To', cell: (r) => (
            <div>
              <p className="text-navy">{r.targetCounselor || '—'}</p>
              {!r.delegatedBy && r.targetCounselor && <p className="text-[11px] text-gray-400">suggested by Marketing</p>}
            </div>
          ) },
          { header: 'Internal Due', cell: (r) => r.internalDue
            ? <span className={lateInternal(r) ? 'font-medium text-red-700' : 'text-gray-600'}>{dayLabel(r.internalDue)}{lateInternal(r) && ' · overdue'}</span>
            : <span className="text-gray-400">Not set</span> },
          { header: 'Marketing Deadline', cell: (r) => <span className={directiveState(r) !== 'Submitted' && r.deadline < today ? 'font-medium text-red-700' : 'text-gray-600'}>{dayLabel(r.deadline)}</span> },
          { header: 'Status', cell: (r) => <Badge text={directiveState(r)} cls={DIRECTIVE_STYLES[directiveState(r)]} /> },
          { header: '', right: true, cell: action },
        ]}
        card={(r) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-navy">{r.topic}</p>
              <Badge text={directiveState(r)} cls={DIRECTIVE_STYLES[directiveState(r)]} />
            </div>
            <p className="text-xs text-gray-400">{r.needed} · {r.targetCounselor || 'Unassigned'}</p>
            <p className="flex items-center gap-1 text-xs text-gray-500"><CalendarClock size={12} /> Internal {r.internalDue ? dayLabel(r.internalDue) : 'not set'} · Marketing {dayLabel(r.deadline)}</p>
            {action(r)}
          </div>
        )}
      />
      <p className="text-[11px] text-gray-400">Submissions happen in the assignee’s Marketing inbox (counselor or Front Desk) and go straight back to the Marketing team member who asked.</p>
      {req && <DelegateModal req={req} onClose={() => setOpen(null)} />}
    </div>
  );
}

