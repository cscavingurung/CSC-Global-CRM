import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Info, Paperclip, Plus, Search, Upload, X } from 'lucide-react';
import { BranchIssue, IssueCategory, IssueImpact, IssuePriority, IssueStatus, MockUser, StaffMember } from '../types';
import {
  IMPACT_PRIORITY, ISSUE_CATEGORIES, ISSUE_IMPACTS, ISSUE_PRIORITIES, ISSUE_STATUSES, NewIssueInput, attentionReason, awaitingConfirmation,
  buildIssue, isActive,
} from '../branchIssues';
import { ROLE_LABELS } from '../mockData';
import { formatActivityTime, formatSubmittedAt, formatWait, parseSubmittedAt } from '../dateTime';
import { matchesDateRange } from '../dateFilter';
import CompactDateRangeFilter from './CompactDateRangeFilter';
import IssueDetail, { PriorityBadge, StatusBadge } from './IssueDetail';

// ─── Issue & Escalation Management ──────────────────────────────────────────
// For work-blocking problems that need IT or manager intervention. Not a task list and not a
// chat: each issue carries a structured, read-only activity timeline and a fixed pipeline
// (Open → Assigned → In Progress → Waiting → Resolved → Closed).

interface IssueEscalationCenterProps {
  /** Issues for the current user's branch. */
  issues: BranchIssue[];
  currentUser: MockUser;
  /** Branch staff — owner options in the detail view. */
  staff: StaffMember[];
  onAddIssue: (issue: BranchIssue) => void;
  onUpdateIssue: (id: string, updates: Partial<BranchIssue>) => void;
  /** Open straight into this issue (e.g. from a failed opening-checklist item). */
  initialIssueId?: string;
}

type StatusFilter = '' | 'active' | 'resolved-month' | IssueStatus;

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';
const selectClass =
  'w-full sm:w-auto appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

const PRIORITY_RANK: Record<IssuePriority, number> = { Critical: 0, High: 1, Normal: 2 };

const ageOf = (stamp: string, now: Date) => {
  const d = parseSubmittedAt(stamp);
  return d ? formatWait((now.getTime() - d.getTime()) / 60000) : '';
};

const isThisMonth = (stamp: string | undefined, now: Date) => {
  const d = stamp ? parseSubmittedAt(stamp) : null;
  return !!d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

function Select({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={selectClass}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

// ─── Report an Issue ────────────────────────────────────────────────────────

interface IssueDraft {
  title: string;
  category: IssueCategory | '';
  impact: IssueImpact | '';
  description: string;
  triedSoFar: string;
  attachments: string[];
}

export function ReportIssueModal({ onClose, onSubmit, initial, context }: {
  onClose: () => void;
  onSubmit: (draft: NewIssueInput) => void;
  /** Pre-filled values, e.g. from a failed checklist item. */
  initial?: Partial<IssueDraft>;
  /** Optional line under the info banner explaining where the pre-fill came from. */
  context?: string;
}) {
  const [draft, setDraft] = useState<IssueDraft>({ title: '', category: '', impact: '', description: '', triedSoFar: '', attachments: [], ...initial });
  const [tried, setTried] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<IssueDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const errors = {
    title: !draft.title.trim() && 'Give the issue a short title.',
    category: !draft.category && 'Choose a category.',
    impact: !draft.impact && 'Choose who is affected.',
    description: !draft.description.trim() && 'Describe what’s happening.',
  };
  const valid = !Object.values(errors).some(Boolean);
  const FieldError = ({ msg }: { msg: string | false }) => (tried && msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null);

  const submit = () => {
    setTried(true);
    if (valid && draft.category && draft.impact) onSubmit({ ...draft, category: draft.category, impact: draft.impact });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className="dissolve-in relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-grey-border bg-white">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-grey-border bg-white px-6 py-4">
          <h3 className="text-base font-semibold text-navy">Report an Issue</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex gap-2.5 rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-3 text-sm text-blue-800">
            <Info size={16} className="mt-0.5 flex-shrink-0" />
            <p>
              Need help with something you cannot resolve yourself? Report it here. For normal work, use Tasks. For client communication, use standard channels. Use Issues when something is blocked, broken, disputed, or requires management/IT intervention.
            </p>
          </div>
          {context && <p className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{context}</p>}

          <div>
            <label htmlFor="issue-title" className="mb-1.5 block text-xs font-semibold text-navy">Issue title</label>
            <input id="issue-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className={inputClass} placeholder="e.g. Printer on first floor not working" />
            <FieldError msg={errors.title} />
          </div>

          <div>
            <label htmlFor="issue-category" className="mb-1.5 block text-xs font-semibold text-navy">Category</label>
            <div className="relative">
              <select id="issue-category" value={draft.category} onChange={(e) => set({ category: e.target.value as IssueCategory })} className={`${inputClass} appearance-none pr-9`}>
                <option value="" disabled>Choose a category…</option>
                {ISSUE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <FieldError msg={errors.category} />
          </div>

          <fieldset>
            <legend className="mb-1.5 block text-xs font-semibold text-navy">Who is affected?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ISSUE_IMPACTS.map((impact) => {
                const checked = draft.impact === impact;
                return (
                  <label
                    key={impact}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-navy-light bg-navy/5 text-navy' : 'border-grey-border text-gray-600 hover:border-navy-light'}`}
                  >
                    <input type="radio" name="impact" checked={checked} onChange={() => set({ impact })} className="accent-navy" />
                    {impact}
                  </label>
                );
              })}
            </div>
            {draft.impact && (
              <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                Priority is set automatically: <PriorityBadge priority={IMPACT_PRIORITY[draft.impact]} />
              </p>
            )}
            <FieldError msg={errors.impact} />
          </fieldset>

          <div>
            <label htmlFor="issue-desc" className="mb-1.5 block text-xs font-semibold text-navy">What’s happening?</label>
            <textarea id="issue-desc" value={draft.description} onChange={(e) => set({ description: e.target.value })} rows={3} className={`${inputClass} resize-y`} placeholder="What is broken or blocked, and since when?" />
            <FieldError msg={errors.description} />
          </div>

          <div>
            <label htmlFor="issue-tried" className="mb-1.5 block text-xs font-semibold text-navy">What have you already tried? <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea id="issue-tried" value={draft.triedSoFar} onChange={(e) => set({ triedSoFar: e.target.value })} rows={2} className={`${inputClass} resize-y`} placeholder="e.g. Restarted the computer, tried another browser" />
          </div>

          <div>
            <p className="mb-1.5 block text-xs font-semibold text-navy">Attachment <span className="font-normal text-gray-400">(optional)</span></p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-grey-border px-4 py-4 text-sm text-navy hover:border-navy-light"
            >
              <Upload size={16} className="text-gray-400" /> Add a screenshot or file <span className="text-xs text-gray-400">· simulated upload</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const names = Array.from(e.target.files ?? []).map((f) => f.name);
                set({ attachments: Array.from(new Set([...draft.attachments, ...names])) });
                e.target.value = '';
              }}
            />
            {draft.attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {draft.attachments.map((name) => (
                  <li key={name} className="flex items-center gap-2 rounded-md border border-grey-border px-3 py-1.5 text-sm text-navy">
                    <Paperclip size={14} className="text-gray-400" />
                    <span className="flex-1 truncate">{name}</span>
                    <button type="button" onClick={() => set({ attachments: draft.attachments.filter((n) => n !== name) })} aria-label={`Remove ${name}`} className="text-gray-400 hover:text-red-600">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex gap-3 border-t border-grey-border px-6 py-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
          <button type="button" onClick={submit} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light">Report issue</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function IssueEscalationCenter({ issues, currentUser, staff, onAddIssue, onUpdateIssue, initialIssueId }: IssueEscalationCenterProps) {
  const now = useMemo(() => new Date(), []);
  const [selectedId, setSelectedId] = useState<string | null>(initialIssueId ?? null);
  const [reporting, setReporting] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const selected = issues.find((i) => i.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const active = issues.filter(isActive);
    return {
      open: active.length,
      high: active.filter((i) => i.priority === 'High').length,
      critical: active.filter((i) => i.priority === 'Critical').length,
      waiting: issues.filter((i) => i.status === 'Waiting').length,
      resolvedMonth: issues.filter((i) => !isActive(i) && isThisMonth(i.resolvedAt, now)).length,
    };
  }, [issues, now]);

  const attention = useMemo(
    () =>
      issues
        .map((issue) => ({ issue, reason: attentionReason(issue, currentUser.name) }))
        .filter((x): x is { issue: BranchIssue; reason: NonNullable<ReturnType<typeof attentionReason>> } => x.reason !== null)
        .sort((a, b) => PRIORITY_RANK[a.issue.priority] - PRIORITY_RANK[b.issue.priority] || b.issue.reportedAt.localeCompare(a.issue.reportedAt)),
    [issues, currentUser.name]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return issues
      .filter((i) => !term || `${i.code} ${i.title} ${i.description} ${i.reportedBy} ${i.owner ?? ''}`.toLowerCase().includes(term))
      .filter((i) => !category || i.category === category)
      .filter((i) => !priority || i.priority === priority)
      .filter((i) =>
        !status ? true
        : status === 'active' ? isActive(i)
        : status === 'resolved-month' ? !isActive(i) && isThisMonth(i.resolvedAt, now)
        : i.status === status
      )
      .filter((i) => matchesDateRange(i.reportedAt, dateFrom, dateTo))
      // Active issues first (most urgent on top), then resolved/closed, newest first.
      .sort((a, b) =>
        Number(!isActive(a)) - Number(!isActive(b)) ||
        (isActive(a) ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] : 0) ||
        b.reportedAt.localeCompare(a.reportedAt)
      );
  }, [issues, search, category, priority, status, dateFrom, dateTo, now]);

  const anyFilter = !!(search || category || priority || status || dateFrom || dateTo);
  const clearFilters = () => { setSearch(''); setCategory(''); setPriority(''); setStatus(''); setDateFrom(''); setDateTo(''); };

  // Stat cards double as shortcuts into the table below.
  const applyStat = (next: { status?: StatusFilter; priority?: string }) => {
    clearFilters();
    setStatus(next.status ?? '');
    setPriority(next.priority ?? '');
    document.getElementById('all-branch-issues')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const report = (draft: NewIssueInput) => {
    const issue = buildIssue(draft, currentUser, ROLE_LABELS[currentUser.role], issues, formatSubmittedAt(new Date()));
    onAddIssue(issue);
    setReporting(false);
    setSelectedId(issue.id);
  };

  if (selected) {
    return (
      <IssueDetail
        issue={selected}
        currentUser={currentUser}
        staff={staff}
        onBack={() => setSelectedId(null)}
        onUpdate={(updates) => onUpdateIssue(selected.id, updates)}
      />
    );
  }

  const STAT_CARDS: { label: string; value: number; tone: string; onClick: () => void }[] = [
    { label: 'Open', value: stats.open, tone: 'text-navy', onClick: () => applyStat({ status: 'active' }) },
    { label: 'High Priority', value: stats.high, tone: 'text-amber-600', onClick: () => applyStat({ status: 'active', priority: 'High' }) },
    { label: 'Critical Priority', value: stats.critical, tone: 'text-red-600', onClick: () => applyStat({ status: 'active', priority: 'Critical' }) },
    { label: 'Waiting', value: stats.waiting, tone: 'text-amber-600', onClick: () => applyStat({ status: 'Waiting' }) },
    { label: 'Resolved This Month', value: stats.resolvedMonth, tone: 'text-emerald-600', onClick: () => applyStat({ status: 'resolved-month' }) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">Work-blocking problems that need IT or manager help — {currentUser.branch} branch.</p>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light"
        >
          <Plus size={16} /> Report an Issue
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_CARDS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.onClick}
            className="rounded-xl border border-grey-border bg-white px-4 py-3.5 text-left transition-colors hover:border-navy-light/40"
          >
            <p className="text-xs font-medium text-gray-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.value === 0 ? 'text-gray-300' : s.tone}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Section A — Needs My Attention */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-600" />
          <h2 className="text-sm font-semibold text-navy">Needs My Attention</h2>
          <span className="text-xs text-gray-400">{attention.length}</span>
        </div>
        {attention.length === 0 ? (
          <div className="rounded-xl border border-grey-border bg-white px-5 py-6 text-center text-sm text-gray-400">Nothing needs your attention right now.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {attention.map(({ issue, reason }) => {
              const red = issue.priority === 'Critical';
              const readyToClose = reason === 'Ready to close';
              return (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => setSelectedId(issue.id)}
                  className={`group relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-white py-3.5 pl-5 pr-4 text-left transition-colors ${
                    readyToClose ? 'border-emerald-200 hover:border-emerald-300' : red ? 'border-red-200 hover:border-red-300' : 'border-amber-200 hover:border-amber-300'
                  }`}
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${readyToClose ? 'bg-emerald-400' : red ? 'bg-red-500' : 'bg-amber-400'}`} aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      readyToClose ? 'bg-emerald-50 text-emerald-700' : red ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {reason}
                    </span>
                    <PriorityBadge priority={issue.priority} />
                    <span className="ml-auto text-xs tabular-nums text-gray-400">{issue.code}</span>
                  </div>
                  <p className="text-sm font-semibold leading-snug text-navy">{issue.title}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                    <span>{issue.category}</span>
                    <span className="text-gray-300">·</span>
                    <StatusBadge status={issue.status} />
                    <span className="text-gray-300">·</span>
                    <span>Owner: <span className="text-navy">{issue.owner ?? 'Unassigned'}</span></span>
                    <span className="text-gray-300">·</span>
                    <span>{readyToClose ? `resolved ${ageOf(issue.resolvedAt ?? issue.reportedAt, now)} ago` : `open ${ageOf(issue.reportedAt, now)}`}</span>
                    <ChevronRight size={14} className="ml-auto text-gray-300 group-hover:text-navy" />
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Section B — All Branch Issues */}
      <section id="all-branch-issues" className="scroll-mt-24 space-y-3">
        <h2 className="text-sm font-semibold text-navy">All Branch Issues</h2>
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
          <div className="relative min-w-[220px] flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, title, reporter or owner"
              className="w-full rounded-lg border border-grey-border bg-white py-2.5 pl-10 pr-9 text-sm focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy"><X size={16} /></button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
            <Select value={category} onChange={setCategory} label="Category">
              <option value="">All categories</option>
              {ISSUE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select value={priority} onChange={setPriority} label="Priority">
              <option value="">All priorities</option>
              {ISSUE_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Select value={status} onChange={(v) => setStatus(v as StatusFilter)} label="Status">
              <option value="">All statuses</option>
              <option value="active">Open (not resolved)</option>
              {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="resolved-month">Resolved this month</option>
            </Select>
            <CompactDateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{filtered.length} issue{filtered.length === 1 ? '' : 's'}</span>
          {anyFilter && <button type="button" onClick={clearFilters} className="font-medium text-navy-light hover:text-navy">Clear filters</button>}
        </div>

        {/* Table — desktop */}
        <div className="hidden overflow-x-auto rounded-xl border border-grey-border bg-white lg:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-grey-border bg-grey-bg">
                {['ID', 'Issue', 'Category', 'Priority', 'Status', 'Owner', 'Reported', 'Age'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const reported = parseSubmittedAt(i.reportedAt);
                return (
                  <tr key={i.id} onClick={() => setSelectedId(i.id)} className="cursor-pointer border-b border-grey-border last:border-0 hover:bg-grey-bg/50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold tabular-nums text-gray-500">{i.code}</td>
                    <td className="max-w-[320px] px-4 py-3">
                      <p className="truncate text-sm font-medium text-navy" title={i.title}>{i.title}</p>
                      {i.escalatedTo && <p className="text-[11px] text-red-600">Escalated to {i.escalatedTo}</p>}
                      {awaitingConfirmation(i) && <p className="text-[11px] text-amber-700">Awaiting reporter confirmation</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{i.category}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={i.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{i.owner ?? <span className="text-gray-400">Unassigned</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {i.reportedBy}
                      <p className="text-[11px] text-gray-400">{reported ? formatActivityTime(reported) : i.reportedAt}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-gray-500">{isActive(i) ? ageOf(i.reportedAt, now) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No issues match these filters.</div>}
        </div>

        {/* Cards — mobile */}
        <div className="space-y-3 lg:hidden">
          {filtered.map((i) => (
            <button key={i.id} type="button" onClick={() => setSelectedId(i.id)} className="w-full rounded-xl border border-grey-border bg-white p-4 text-left">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-gray-500">{i.code}</span>
                <PriorityBadge priority={i.priority} />
                <StatusBadge status={i.status} />
              </div>
              <p className="text-sm font-semibold text-navy">{i.title}</p>
              <p className="mt-1 text-xs text-gray-500">
                {i.category} · Owner: {i.owner ?? 'Unassigned'} · by {i.reportedBy}
              </p>
            </button>
          ))}
          {filtered.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No issues match these filters.</div>}
        </div>
      </section>

      {reporting && <ReportIssueModal onClose={() => setReporting(false)} onSubmit={report} />}
    </div>
  );
}
