import { useState } from 'react';
import { ArrowRight, ArrowRightLeft, CheckCircle, ChevronDown, History, Inbox, Lock, Search, Send, XCircle } from 'lucide-react';
import { BranchTransfer, ConsultationStatus, CounselorStudent } from '../../types';
import { ALL_TIME, DateRange, TRANSFER_STYLES, TransferCandidate, dayLabel, inRange } from '../../managerWorkspace';
import { clampDateInput, dateKey } from '../../dateTime';
import HandoverClientModal from '../HandoverClientModal';
import { Field, GhostButton, Kpi, Modal, PrimaryButton, SelectInput, TextArea, TextInput } from '../marketing/MktShared';
import { useWorkspace } from './workspaceContext';
import { Badge, DataList, DateRangeControl, FilterBar, FilterSelect, SearchFilter, SectionHeading } from './WorkspaceShared';

const CONSULTATION_STYLES: Record<ConsultationStatus, string> = {
  'Awaiting Consultation': 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-sky-100 text-sky-800',
  'Follow Up': 'bg-amber-100 text-amber-800',
  'Consultation Complete': 'bg-emerald-100 text-emerald-800',
};
const CONSULTATION_STATUSES = Object.keys(CONSULTATION_STYLES) as ConsultationStatus[];

function PendingFlag({ t }: { t: BranchTransfer }) {
  return <Badge text={`Transfer Pending Approval (${t.fromBranch} → ${t.toBranch})`} cls="bg-amber-100 text-amber-800" />;
}

const pendingFor = (transfers: BranchTransfer[], clientKey: string) => transfers.find((t) => t.clientKey === clientKey && t.status === 'Pending');

// ═══ 1. Internal staff handover ══════════════════════════════════════════════
function ClientProfileModal({ client, onClose, onHandover }: { client: CounselorStudent; onClose: () => void; onHandover: () => void }) {
  const { data } = useWorkspace();
  const pending = pendingFor(data.store.transfers, client.id);
  const history = [...(client.auditLog ?? [])].reverse();
  return (
    <Modal title={client.name} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-grey-bg px-2 py-0.5 text-xs font-medium text-navy">{client.clientId ?? '—'}</span>
          <Badge text={client.consultationStatus} cls={CONSULTATION_STYLES[client.consultationStatus]} />
          {pending && <PendingFlag t={pending} />}
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-grey-bg p-4 text-sm">
          {[
            ['Counselor', client.assignedCounselor],
            ['Branch', data.branch],
            ['Country', client.country],
            ['Purpose', client.purpose],
            ['Assigned on', dayLabel(client.assignedDate)],
            ['Outcome', client.outcome],
          ].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-gray-400">{k}</dt><dd className="font-medium text-navy">{v || '—'}</dd></div>
          ))}
        </dl>
        <section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Handover & transfer history</h4>
          {history.length === 0 ? <p className="text-sm text-gray-400">No handovers yet.</p> : (
            <ul className="divide-y divide-grey-border rounded-lg border border-grey-border">
              {history.map((e) => (
                <li key={e.id} className="px-3 py-2 text-sm">
                  <p className="text-navy">{e.text}</p>
                  <p className="text-[11px] text-gray-400">{e.action} · {e.by} · {e.at}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="flex flex-col-reverse gap-2 border-t border-grey-border pt-4 sm:flex-row sm:items-center sm:justify-end">
          {pending && <p className="text-xs text-amber-700 sm:mr-auto">Handover is locked while a branch transfer is pending.</p>}
          <GhostButton onClick={onClose}>Close</GhostButton>
          <PrimaryButton disabled={Boolean(pending)} onClick={onHandover}><ArrowRightLeft size={14} /> Handover to Another Counselor</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function InternalHandover() {
  const { data, actions, flash } = useWorkspace();
  const [profile, setProfile] = useState<string | null>(null);
  const [handover, setHandover] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [counselor, setCounselor] = useState('');
  const [status, setStatus] = useState('');
  const [logRange, setLogRange] = useState<DateRange>(ALL_TIME);
  const [logCounselor, setLogCounselor] = useState('');

  const counselors = data.staff.filter((s) => s.role === 'Counselor' && s.status === 'Active').map((s) => s.name).sort();
  const clients = data.consultations
    .filter((c) => (!counselor || c.assignedCounselor === counselor) && (!status || c.consultationStatus === status)
      && (!q || `${c.name} ${c.clientId ?? ''} ${c.country}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name));
  const log = data.consultations
    .flatMap((c) => (c.auditLog ?? []).filter((e) => e.action === 'Handover').map((e) => ({ ...e, client: c.name, clientId: c.clientId })))
    .filter((e) => inRange(e.at, logRange) && (!logCounselor || e.from === logCounselor || e.to === logCounselor))
    .sort((a, b) => b.at.localeCompare(a.at));

  const caseload = (name: string) => data.consultations.filter((c) => c.assignedCounselor === name).length;
  const viewing = data.consultations.find((c) => c.id === profile);
  const moving = data.consultations.find((c) => c.id === handover);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {counselors.slice(0, 4).map((c) => <Kpi key={c} label={c} value={caseload(c)} hint="clients assigned" />)}
      </div>

      <section className="space-y-3">
        <SectionHeading title="Branch Clients" hint="Open a client to review their profile and hand them to another counselor." />
        <FilterBar active={Boolean(q || counselor || status)} onReset={() => { setQ(''); setCounselor(''); setStatus(''); }}>
          <SearchFilter value={q} onChange={setQ} placeholder="Name, Client ID, country…" />
          <FilterSelect label="Counselor" value={counselor} onChange={setCounselor} all="All Counselors" options={counselors} />
          <FilterSelect label="Status" value={status} onChange={setStatus} all="All Statuses" options={CONSULTATION_STATUSES} />
        </FilterBar>
        <DataList
          rows={clients}
          rowKey={(c) => c.id}
          onRowClick={(c) => setProfile(c.id)}
          empty="No clients match these filters."
          columns={[
            { header: 'Client', cell: (c) => <div><p className="font-medium text-navy">{c.name}</p><p className="text-xs text-gray-400">{c.clientId ?? '—'} · {c.country}</p></div> },
            { header: 'Counselor', cell: (c) => <span className="text-navy">{c.assignedCounselor}</span> },
            { header: 'Status', cell: (c) => <Badge text={c.consultationStatus} cls={CONSULTATION_STYLES[c.consultationStatus]} /> },
            { header: 'Transfer', cell: (c) => { const p = pendingFor(data.store.transfers, c.id); return p ? <PendingFlag t={p} /> : <span className="text-gray-300">—</span>; } },
            { header: '', right: true, cell: (c) => (
              <button type="button" disabled={Boolean(pendingFor(data.store.transfers, c.id))} onClick={(e) => { e.stopPropagation(); setHandover(c.id); }}
                className="inline-flex items-center gap-1 text-sm font-medium text-navy hover:text-navy-light disabled:cursor-not-allowed disabled:opacity-40">
                <ArrowRightLeft size={15} /> Handover
              </button>
            ) },
          ]}
          card={(c) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-navy">{c.name}</p>
                <Badge text={c.consultationStatus} cls={CONSULTATION_STYLES[c.consultationStatus]} />
              </div>
              <p className="text-xs text-gray-400">{c.clientId ?? '—'} · {c.assignedCounselor}</p>
              {pendingFor(data.store.transfers, c.id) && <PendingFlag t={pendingFor(data.store.transfers, c.id)!} />}
            </div>
          )}
        />
      </section>

      <section className="space-y-3">
        <SectionHeading title="Handover Log" hint="Every counselor-to-counselor move in this branch. Entries can’t be edited or removed." />
        <FilterBar active={Boolean(logCounselor || logRange.preset !== 'All Time')} onReset={() => { setLogCounselor(''); setLogRange(ALL_TIME); }}>
          <DateRangeControl value={logRange} onChange={setLogRange} />
          <FilterSelect label="Counselor" value={logCounselor} onChange={setLogCounselor} all="All Counselors" options={counselors} />
        </FilterBar>
        <DataList
          rows={log}
          rowKey={(e) => e.id}
          empty="No handovers in this range."
          columns={[
            { header: 'When', cell: (e) => <span className="whitespace-nowrap text-gray-600">{e.at}</span> },
            { header: 'Client', cell: (e) => <div><p className="font-medium text-navy">{e.client}</p><p className="text-xs text-gray-400">{e.clientId ?? '—'}</p></div> },
            { header: 'From → To', cell: (e) => <span className="inline-flex items-center gap-1 text-navy">{e.from} <ArrowRight size={12} className="text-gray-400" /> {e.to}</span> },
            { header: 'Reason', cell: (e) => <span className="block max-w-sm text-gray-600">{e.reason}</span> },
            { header: 'By', cell: (e) => <span className="text-gray-500">{e.by}</span> },
          ]}
          card={(e) => (
            <div className="space-y-1">
              <p className="font-semibold text-navy">{e.client}</p>
              <p className="text-xs text-gray-500">{e.from} → {e.to} · {e.at}</p>
              <p className="text-xs text-gray-400">{e.reason}</p>
            </div>
          )}
        />
      </section>

      {viewing && !moving && (
        <ClientProfileModal client={viewing} onClose={() => setProfile(null)} onHandover={() => { setHandover(viewing.id); setProfile(null); }} />
      )}
      {moving && (
        <HandoverClientModal
          managerView
          clientName={moving.name}
          currentCounselor={moving.assignedCounselor}
          counselors={counselors.filter((c) => c !== moving.assignedCounselor)}
          onCancel={() => setHandover(null)}
          onConfirm={(to, reason, date) => {
            actions.handover(moving.id, to, reason, date);
            flash(`${moving.name} handed over to ${to}.`);
            setHandover(null);
          }}
        />
      )}
    </div>
  );
}

// ═══ 2. Inter-branch transfers ═══════════════════════════════════════════════
type View = 'Approval Inbox' | 'Request Transfer' | 'Outgoing Requests' | 'Audit Trail';
const VIEWS: { key: View; icon: React.ReactNode }[] = [
  { key: 'Approval Inbox', icon: <Inbox size={14} /> },
  { key: 'Request Transfer', icon: <Send size={14} /> },
  { key: 'Outgoing Requests', icon: <ArrowRightLeft size={14} /> },
  { key: 'Audit Trail', icon: <History size={14} /> },
];

function RequestModal({ c, onClose }: { c: TransferCandidate; onClose: () => void }) {
  const { data, actions, flash } = useWorkspace();
  const today = dateKey(new Date());
  const counselors = data.staff.filter((s) => s.role === 'Counselor' && s.status === 'Active').map((s) => s.name).sort();
  const [toCounselor, setToCounselor] = useState(counselors[0] ?? '');
  const [visitDate, setVisitDate] = useState(today);
  const [reason, setReason] = useState('');
  const valid = Boolean(toCounselor && visitDate && visitDate <= today && reason.trim().length >= 10);
  return (
    <Modal title="Request Inter-Branch Transfer" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        actions.requestTransfer({ clientKey: c.clientKey, toCounselor, reason: reason.trim(), visitDate });
        flash(`Transfer requested — ${c.branch}’s manager will decide.`);
        onClose();
      }}>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-grey-bg p-4 text-sm">
          <div><p className="text-xs text-gray-400">Origin branch</p><p className="font-semibold text-navy">{c.branch}</p><p className="text-xs text-gray-500">{c.counselor}</p></div>
          <ArrowRight size={18} className="text-gray-400" />
          <div className="text-right"><p className="text-xs text-gray-400">Target branch</p><p className="font-semibold text-navy">{data.branch}</p><p className="text-xs text-gray-500">{toCounselor || '—'}</p></div>
        </div>
        <p className="text-sm text-gray-600"><b className="text-navy">{c.name}</b> · {c.clientId} · phone {c.phoneHint}</p>
        <Field label="Receiving Counselor" required>
          <SelectInput value={toCounselor} onChange={setToCounselor} label="Receiving Counselor">
            <option value="">Select a counselor</option>
            {counselors.map((n) => <option key={n}>{n}</option>)}
          </SelectInput>
        </Field>
        <Field label="Date Client Visited This Branch" required>
          <TextInput type="date" max={today} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} onBlur={(e) => { const c = clampDateInput(e.target.value, { max: today }); if (c) setVisitDate(c); }} />
        </Field>
        <Field label="Counselor Reason" required hint="The origin branch manager sees this when deciding.">
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Client relocated for work and wants to continue the file here." />
        </Field>
        <p className="flex items-start gap-2 rounded-lg bg-grey-bg px-3 py-2 text-xs text-gray-500"><Lock size={13} className="mt-0.5 shrink-0" /> The client stays with {c.branch} until their manager approves. The record is flagged “Transfer Pending Approval”.</p>
        <div className="flex justify-end gap-2 border-t border-grey-border pt-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}><Send size={14} /> Send Request</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function DecisionModal({ t, decision, onClose }: { t: BranchTransfer; decision: 'Approved' | 'Rejected'; onClose: () => void }) {
  const { actions, flash } = useWorkspace();
  const [note, setNote] = useState('');
  const reject = decision === 'Rejected';
  const valid = !reject || note.trim().length >= 5;
  return (
    <Modal title={reject ? 'Reject Transfer' : 'Approve Transfer'} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {reject
            ? <><b className="text-navy">{t.clientName}</b> stays with {t.fromBranch}. {t.toBranch} is told why.</>
            : <><b className="text-navy">{t.clientName}</b> moves to <b className="text-navy">{t.toBranch}</b> now and is assigned to {t.toCounselor}. {t.fromCounselor} loses access.</>}
        </p>
        <Field label={reject ? 'Reason for rejecting' : 'Note (optional)'} required={reject}>
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder={reject ? 'e.g. Visa file mid-lodgement here — re-request after lodgement.' : 'e.g. Documents handed over by email.'} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-grey-border pt-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <button
            type="button"
            disabled={!valid}
            onClick={() => { actions.decideTransfer(t.id, decision, note.trim()); flash(`${t.code} ${decision.toLowerCase()}.`); onClose(); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${reject ? 'bg-red-600 hover:bg-red-700' : 'bg-navy hover:bg-navy-light'}`}
          >
            {reject ? <XCircle size={15} /> : <CheckCircle size={15} />} {reject ? 'Reject Transfer' : 'Approve Transfer'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TransferLog({ t }: { t: BranchTransfer }) {
  return (
    <ol className="space-y-2 border-l-2 border-grey-border pl-4">
      {t.log.map((e, i) => (
        <li key={i} className="text-sm">
          <p className="text-navy">{e.text}</p>
          <p className="text-[11px] text-gray-400">{e.by} · {e.role} · {e.at}</p>
        </li>
      ))}
    </ol>
  );
}

export function InterBranchTransfers() {
  const { data } = useWorkspace();
  const mine = data.branch;
  const inbox = data.store.transfers.filter((t) => t.fromBranch === mine && t.status === 'Pending').sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const [view, setView] = useState<View>(inbox.length ? 'Approval Inbox' : 'Request Transfer');
  const [deciding, setDeciding] = useState<{ id: string; decision: 'Approved' | 'Rejected' } | null>(null);
  const [requesting, setRequesting] = useState<TransferCandidate | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  // Outgoing + audit filters
  const [status, setStatus] = useState('');
  const [direction, setDirection] = useState('');
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [q, setQ] = useState('');

  const needle = search.trim().toLowerCase();
  const results = needle.length < 2 ? [] : data.candidates
    .filter((c) => `${c.name} ${c.clientId} ${c.phoneHint}`.toLowerCase().includes(needle)).slice(0, 12);
  const outgoing = data.store.transfers.filter((t) => t.toBranch === mine);
  const matches = (t: BranchTransfer) => (!status || t.status === status) && inRange(t.requestedAt, range)
    && (!q || `${t.clientName} ${t.clientId} ${t.code}`.toLowerCase().includes(q.toLowerCase()));
  const audit = data.store.transfers
    .filter((t) => matches(t) && (!direction || (direction === 'Incoming to this branch' ? t.toBranch === mine : t.fromBranch === mine)))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const decidingT = deciding ? data.store.transfers.find((t) => t.id === deciding.id) : undefined;

  const counts: Partial<Record<View, number>> = { 'Approval Inbox': inbox.length, 'Outgoing Requests': outgoing.filter((t) => t.status === 'Pending').length };
  const filterBar = (withDirection: boolean) => (
    <FilterBar active={Boolean(status || q || direction || range.preset !== 'All Time')} onReset={() => { setStatus(''); setQ(''); setDirection(''); setRange(ALL_TIME); }}>
      <SearchFilter value={q} onChange={setQ} placeholder="Client, Client ID, TRF code…" />
      <FilterSelect label="Status" value={status} onChange={setStatus} all="All Statuses" options={['Pending', 'Approved', 'Rejected']} />
      {withDirection && <FilterSelect label="Direction" value={direction} onChange={setDirection} all="Both Directions" options={['Incoming to this branch', 'Outgoing from this branch']} />}
      <DateRangeControl label="Requested" value={range} onChange={setRange} />
    </FilterBar>
  );

  return (
    <div className="space-y-5">
      <nav aria-label="Transfer views" className="inline-flex flex-wrap rounded-lg border border-grey-border bg-white p-0.5">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" onClick={() => setView(v.key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${view === v.key ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy-light'}`}>
            {v.icon} {v.key}
            {!!counts[v.key] && <span className={`rounded-full px-1.5 text-[11px] ${view === v.key ? 'bg-white/20' : 'bg-amber-100 text-amber-800'}`}>{counts[v.key]}</span>}
          </button>
        ))}
      </nav>

      <div key={view} className="dissolve-in space-y-4">
        {view === 'Approval Inbox' && (
          <>
            <SectionHeading title="Approval Inbox" hint={`Other branches asking to take over clients registered at ${mine}. Also listed in the Manager Approval Center.`} />
            {inbox.length === 0 && <p className="rounded-xl border border-dashed border-grey-border bg-white py-12 text-center text-sm text-gray-400">No transfer requests waiting on you.</p>}
            <div className="grid gap-3 xl:grid-cols-2">
              {inbox.map((t) => (
                <article key={t.id} className="dissolve-in rounded-xl border border-grey-border bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-navy">{t.clientName}</p>
                      <p className="text-xs text-gray-400">{t.clientId} · {t.code}</p>
                    </div>
                    <PendingFlag t={t} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-gray-400">Origin Branch</dt><dd className="font-medium text-navy">{t.fromBranch} · {t.fromCounselor}</dd></div>
                    <div><dt className="text-gray-400">Target Branch</dt><dd className="font-medium text-navy">{t.toBranch} · {t.toCounselor}</dd></div>
                    <div><dt className="text-gray-400">Requested by</dt><dd className="text-navy">{t.requestedBy}</dd></div>
                    <div><dt className="text-gray-400">Visited {t.toBranch}</dt><dd className="text-navy">{dayLabel(t.visitDate)}</dd></div>
                  </dl>
                  <p className="mt-3 rounded-lg bg-grey-bg px-3 py-2 text-sm text-gray-700">“{t.reason}”</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <GhostButton danger small onClick={() => setDeciding({ id: t.id, decision: 'Rejected' })}><XCircle size={13} /> Reject Transfer</GhostButton>
                    <PrimaryButton small onClick={() => setDeciding({ id: t.id, decision: 'Approved' })}><CheckCircle size={13} /> Approve Transfer</PrimaryButton>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {view === 'Request Transfer' && (
          <>
            <SectionHeading title="Find a client from another branch" hint="For clients registered elsewhere who want to continue here. Only name, Client ID, branch and counselor are shown." />
            <div className="relative max-w-xl">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, Client ID or last 3 phone digits…" autoFocus
                className="w-full rounded-lg border border-grey-border py-2.5 pl-10 pr-4 text-sm focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light" />
            </div>
            {needle.length < 2 ? <p className="text-sm text-gray-400">Type at least 2 characters.</p> : (
              <DataList
                rows={results}
                rowKey={(c) => c.clientKey}
                empty="No registered client at another branch matches."
                columns={[
                  { header: 'Client', cell: (c) => <div><p className="font-medium text-navy">{c.name}</p><p className="text-xs text-gray-400">{c.clientId} · {c.phoneHint}</p></div> },
                  { header: 'Registered At', cell: (c) => <span className="text-navy">{c.branch}</span> },
                  { header: 'Counselor', cell: (c) => <span className="text-gray-600">{c.counselor}</span> },
                  { header: '', right: true, cell: (c) => { const p = pendingFor(data.store.transfers, c.clientKey); return p ? <PendingFlag t={p} /> : (
                    <PrimaryButton small onClick={() => setRequesting(c)}><ArrowRightLeft size={13} /> Request Inter-Branch Transfer</PrimaryButton>
                  ); } },
                ]}
                card={(c) => {
                  const p = pendingFor(data.store.transfers, c.clientKey);
                  return (
                    <div className="space-y-2">
                      <p className="font-semibold text-navy">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.clientId} · {c.branch} · {c.counselor}</p>
                      {p ? <PendingFlag t={p} /> : <PrimaryButton small onClick={() => setRequesting(c)}>Request Inter-Branch Transfer</PrimaryButton>}
                    </div>
                  );
                }}
              />
            )}
          </>
        )}

        {view === 'Outgoing Requests' && (
          <>
            <SectionHeading title="Requests you sent" hint="Clients you asked other branches to release to you." />
            {filterBar(false)}
            <DataList
              rows={outgoing.filter(matches).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))}
              rowKey={(t) => t.id}
              empty="No transfer requests match these filters."
              columns={[
                { header: 'Client', cell: (t) => <div><p className="font-medium text-navy">{t.clientName}</p><p className="text-xs text-gray-400">{t.clientId} · {t.code}</p></div> },
                { header: 'From', cell: (t) => <span className="text-navy">{t.fromBranch}</span> },
                { header: 'Receiving Counselor', cell: (t) => <span className="text-gray-600">{t.toCounselor}</span> },
                { header: 'Requested', cell: (t) => <span className="text-gray-600">{dayLabel(t.requestedAt)}</span> },
                { header: 'Status', cell: (t) => <Badge text={t.status} cls={TRANSFER_STYLES[t.status]} /> },
                { header: 'Decision Note', cell: (t) => <span className="block max-w-xs text-xs text-gray-500">{t.decisionNote ?? (t.status === 'Pending' ? `Waiting on ${t.fromBranch}` : '—')}</span> },
              ]}
              card={(t) => (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2"><p className="font-semibold text-navy">{t.clientName}</p><Badge text={t.status} cls={TRANSFER_STYLES[t.status]} /></div>
                  <p className="text-xs text-gray-400">{t.fromBranch} → {t.toBranch} · {dayLabel(t.requestedAt)}</p>
                  {t.decisionNote && <p className="text-xs text-gray-500">{t.decisionNote}</p>}
                </div>
              )}
            />
          </>
        )}

        {view === 'Audit Trail' && (
          <>
            <SectionHeading title="Transfer Audit Trail" hint="Every transfer into or out of this branch, with its full immutable history." />
            {filterBar(true)}
            {audit.length === 0 && <p className="rounded-xl border border-grey-border bg-white py-12 text-center text-sm text-gray-400">No transfers match these filters.</p>}
            <ul className="divide-y divide-grey-border overflow-hidden rounded-xl border border-grey-border bg-white">
              {audit.map((t) => {
                const isOpen = expanded === t.id;
                return (
                  <li key={t.id}>
                    <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : t.id)} className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-grey-bg/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-navy">{t.clientName} <span className="font-normal text-gray-400">· {t.code}</span></p>
                        <p className="text-xs text-gray-400">{t.fromBranch} → {t.toBranch} · requested {dayLabel(t.requestedAt)}{t.decidedBy ? ` · decided by ${t.decidedBy}` : ''}</p>
                      </div>
                      <Badge text={t.toBranch === mine ? 'Incoming' : 'Outgoing'} cls="bg-slate-100 text-slate-700" />
                      <Badge text={t.status} cls={TRANSFER_STYLES[t.status]} />
                      <ChevronDown size={15} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && <div className="dissolve-in border-t border-grey-border bg-grey-bg/40 px-5 py-4"><TransferLog t={t} /></div>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {requesting && <RequestModal c={requesting} onClose={() => setRequesting(null)} />}
      {decidingT && deciding && <DecisionModal t={decidingT} decision={deciding.decision} onClose={() => setDeciding(null)} />}
    </div>
  );
}
