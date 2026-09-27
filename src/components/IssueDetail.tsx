import { useState } from 'react';
import {
  ArrowLeft, ArrowUpRight, Check, ChevronDown, CircleDot, Flag, Paperclip, RotateCcw, Send, ShieldCheck, UserCheck, X,
} from 'lucide-react';
import { BranchIssue, IssueActivity, IssueEscalationReason, IssueStatus, MockUser, StaffMember } from '../types';
import {
  ESCALATION_REASONS, ISSUE_STATUSES, IT_SUPPORT, PRIORITY_DOT, PRIORITY_STYLES, STATUS_STYLES, awaitingConfirmation,
  escalationTargetFor, isActive,
} from '../branchIssues';
import { formatActivityTime, formatSubmittedAt, parseSubmittedAt } from '../dateTime';

interface IssueDetailProps {
  issue: BranchIssue;
  currentUser: MockUser;
  /** Branch staff — owner options. */
  staff: StaffMember[];
  onBack: () => void;
  onUpdate: (updates: Partial<BranchIssue>) => void;
}

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

export function PriorityBadge({ priority }: { priority: BranchIssue['priority'] }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${PRIORITY_STYLES[priority]}`}>
      <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[priority]}`} aria-hidden="true" />
      {priority}
    </span>
  );
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[status]}`}>{status}</span>;
}

const when = (stamp?: string) => {
  const d = stamp ? parseSubmittedAt(stamp) : null;
  return d ? formatActivityTime(d) : stamp ?? '';
};

/** Open → Assigned → In Progress → Waiting → Resolved → Closed. */
function StatusPipeline({ status }: { status: IssueStatus }) {
  const current = ISSUE_STATUSES.indexOf(status);
  return (
    <ol className="flex items-start overflow-x-auto pb-1" aria-label={`Status: ${status}`}>
      {ISSUE_STATUSES.map((s, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <li key={s} className="flex min-w-[88px] flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : done || here ? 'bg-navy' : 'bg-grey-border'}`} />
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  here ? 'border-navy bg-navy text-white' : done ? 'border-navy bg-white text-navy' : 'border-grey-border bg-white text-gray-400'
                }`}
                aria-current={here ? 'step' : undefined}
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === ISSUE_STATUSES.length - 1 ? 'invisible' : done ? 'bg-navy' : 'bg-grey-border'}`} />
            </div>
            <span className={`mt-1.5 text-xs ${here ? 'font-semibold text-navy' : done ? 'text-navy' : 'text-gray-400'}`}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

const ACTIVITY_ICON: Record<IssueActivity['kind'], React.ReactNode> = {
  reported: <Flag size={13} />,
  assigned: <UserCheck size={13} />,
  status: <CircleDot size={13} />,
  escalated: <ArrowUpRight size={13} />,
  update: <Send size={13} />,
  resolved: <Check size={13} />,
  confirmed: <ShieldCheck size={13} />,
  closed: <Check size={13} />,
  reopened: <RotateCcw size={13} />,
};

export default function IssueDetail({ issue, currentUser, staff, onBack, onUpdate }: IssueDetailProps) {
  const [update, setUpdate] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [reason, setReason] = useState<IssueEscalationReason>('Cannot resolve');
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(true);

  const active = isActive(issue);
  const target = escalationTargetFor(issue.category);
  const alreadyEscalated = issue.escalatedTo === target;
  const isManager = currentUser.role === 'branch_manager';
  const isReporter = currentUser.name === issue.reportedBy;
  const waitingOnReporter = awaitingConfirmation(issue);

  // Every change also writes a line to the timeline.
  const apply = (updates: Partial<BranchIssue>, text: string, kind: IssueActivity['kind']) => {
    const entry: IssueActivity = { id: `ia-${Date.now()}`, at: formatSubmittedAt(new Date()), by: currentUser.name, text, kind };
    onUpdate({ ...updates, activity: [...issue.activity, entry] });
  };

  const setStatus = (status: IssueStatus) => apply({ status }, `moved to ${status}`, 'status');

  const assign = (owner: string) => {
    if (!owner || owner === issue.owner) return;
    apply(
      { owner, status: issue.status === 'Open' ? 'Assigned' : issue.status },
      `assigned to ${owner === currentUser.name ? 'the Branch Manager' : owner}`,
      'assigned'
    );
  };

  const escalate = () => {
    const owner = target === 'IT Support' ? IT_SUPPORT : staff.find((s) => s.role === 'Branch Manager')?.name ?? currentUser.name;
    apply(
      { escalatedTo: target, escalationReason: reason, owner, status: issue.status === 'Open' ? 'Assigned' : issue.status },
      `escalated to ${target} — ${reason}`,
      'escalated'
    );
    setEscalating(false);
  };

  const resolve = () => {
    if (!resolution.trim()) return;
    const at = formatSubmittedAt(new Date());
    apply(
      { status: 'Resolved', resolution: resolution.trim(), requiresConfirmation: needsConfirmation, resolvedAt: at, reporterConfirmedAt: undefined },
      needsConfirmation ? 'resolved — reporter confirmation required' : 'resolved',
      'resolved'
    );
    setResolving(false);
  };

  const confirmFixed = () =>
    apply(
      { reporterConfirmedAt: formatSubmittedAt(new Date()) },
      isReporter ? 'confirmed the issue is fixed' : `recorded ${issue.reportedBy}’s confirmation that the issue is fixed`,
      'confirmed'
    );

  const close = () => apply({ status: 'Closed', closedAt: formatSubmittedAt(new Date()) }, 'closed the issue', 'closed');

  const reopen = () =>
    apply(
      { status: 'In Progress', resolvedAt: undefined, closedAt: undefined, reporterConfirmedAt: undefined },
      'reopened the issue — not fixed',
      'reopened'
    );

  const postUpdate = () => {
    if (!update.trim()) return;
    apply({}, update.trim(), 'update');
    setUpdate('');
  };

  const ownerOptions = [
    IT_SUPPORT,
    ...staff.filter((s) => s.status === 'Active' && s.role !== 'Super Admin').map((s) => s.name),
  ];

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: 'Category', value: issue.category },
    { label: 'Impact', value: issue.impact },
    { label: 'Reporter', value: <>{issue.reportedBy} <span className="text-gray-400">· {issue.reporterRole}</span></> },
    { label: 'Reported', value: when(issue.reportedAt) },
    { label: 'Owner', value: issue.owner ?? <span className="text-gray-400">Unassigned</span> },
    {
      label: 'Escalated to',
      value: issue.escalatedTo
        ? <>{issue.escalatedTo} <span className="text-gray-400">· {issue.escalationReason}</span></>
        : <span className="text-gray-400">Not escalated</span>,
    },
  ];

  const secondaryBtn = 'inline-flex items-center gap-1.5 rounded-lg border border-grey-border px-3 py-2 text-sm font-medium text-navy hover:border-navy-light hover:bg-grey-bg';
  const primaryBtn = 'inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="max-w-5xl space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-light hover:text-navy">
        <ArrowLeft size={16} /> All issues
      </button>

      {/* Header */}
      <section className="rounded-xl border border-grey-border bg-white">
        <div className="px-5 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tabular-nums text-gray-500">{issue.code}</span>
            <PriorityBadge priority={issue.priority} />
            <StatusBadge status={issue.status} />
            {waitingOnReporter && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Awaiting reporter confirmation</span>}
          </div>
          <h2 className="mt-2 text-lg font-semibold leading-snug text-navy">{issue.title}</h2>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{f.label}</dt>
              <dd className="mt-0.5 text-sm text-navy">{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-grey-border px-5 py-5">
          <StatusPipeline status={issue.status} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {/* What's happening */}
          <section className="rounded-xl border border-grey-border bg-white px-5 py-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-navy">What’s happening?</h3>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">{issue.description}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-navy">What has already been tried?</h3>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">{issue.triedSoFar || '—'}</p>
            </div>
            {issue.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {issue.attachments.map((name) => (
                  <a
                    key={name}
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    title="Attachment preview isn't available yet"
                    className="inline-flex items-center gap-1.5 rounded-md border border-grey-border px-2.5 py-1 text-xs font-medium text-navy-light hover:border-navy-light hover:text-navy"
                  >
                    <Paperclip size={12} /> {name}
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* Resolution (once resolved) */}
          {issue.resolution && !active && (
            <section className="rounded-xl border border-emerald-200 bg-white px-5 py-4">
              <h3 className="text-sm font-semibold text-navy">Resolution</h3>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">{issue.resolution}</p>
              <p className="mt-2 text-xs text-gray-500">
                Resolved {when(issue.resolvedAt)}
                {issue.requiresConfirmation && (
                  issue.reporterConfirmedAt
                    ? <> · <span className="text-emerald-700">confirmed by reporter {when(issue.reporterConfirmedAt)}</span></>
                    : <> · <span className="text-amber-700">waiting for {issue.reportedBy} to confirm</span></>
                )}
                {issue.closedAt && <> · closed {when(issue.closedAt)}</>}
              </p>
            </section>
          )}

          {/* Activity timeline */}
          <section className="rounded-xl border border-grey-border bg-white">
            <h3 className="border-b border-grey-border px-5 py-3 text-sm font-semibold text-navy">Activity</h3>
            <ol className="px-5 py-4">
              {issue.activity.map((a, i) => (
                <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < issue.activity.length - 1 && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-grey-border" aria-hidden="true" />}
                  <span className={`relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border bg-white ${
                    a.kind === 'escalated' ? 'border-red-200 text-red-600' : a.kind === 'resolved' || a.kind === 'confirmed' || a.kind === 'closed' ? 'border-emerald-200 text-emerald-600' : 'border-grey-border text-gray-400'
                  }`}>
                    {ACTIVITY_ICON[a.kind]}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-xs tabular-nums text-gray-400">{when(a.at)}</p>
                    {a.kind === 'update' ? (
                      <>
                        <p className="text-sm text-navy"><span className="font-medium">{a.by}</span> <span className="text-gray-500">posted a status update</span></p>
                        <p className="mt-1 rounded-lg border border-grey-border bg-grey-bg/60 px-3 py-2 text-sm text-gray-700">{a.text}</p>
                      </>
                    ) : (
                      <p className="text-sm text-navy"><span className="font-medium">{a.by}</span> <span className="text-gray-600">{a.text}</span></p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {issue.status !== 'Closed' && (
              <div className="flex gap-2 border-t border-grey-border px-5 py-3">
                <input
                  value={update}
                  onChange={(e) => setUpdate(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') postUpdate(); }}
                  placeholder="Add status update — e.g. “Vendor visiting at 2 PM”"
                  maxLength={280}
                  className={inputClass}
                />
                <button type="button" onClick={postUpdate} disabled={!update.trim()} className={primaryBtn}>
                  Add
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Actions */}
        <aside className="space-y-4">
          {active && (
            <section className="rounded-xl border border-grey-border bg-white px-4 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-navy">Actions</h3>

              {isManager && (
                <div>
                  <label htmlFor="issue-owner" className="mb-1.5 block text-xs font-semibold text-navy">Owner</label>
                  <div className="relative">
                    <select id="issue-owner" value={issue.owner ?? ''} onChange={(e) => assign(e.target.value)} className={`${inputClass} appearance-none pr-9`}>
                      <option value="" disabled>Assign an owner…</option>
                      {ownerOptions.map((o) => <option key={o} value={o}>{o === currentUser.name ? `${o} (me)` : o}</option>)}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(issue.status === 'Open' || issue.status === 'Assigned' || issue.status === 'Waiting') && (
                  <button type="button" onClick={() => setStatus('In Progress')} className={secondaryBtn}>
                    {issue.status === 'Waiting' ? 'Resume work' : 'Start work'}
                  </button>
                )}
                {issue.status === 'In Progress' && (
                  <button type="button" onClick={() => setStatus('Waiting')} className={secondaryBtn} title="Blocked on someone else — add a status update to say who or what">
                    Mark waiting
                  </button>
                )}
                <button type="button" onClick={() => { setResolving(true); setEscalating(false); }} className={primaryBtn}>
                  <Check size={15} /> Mark resolved
                </button>
              </div>

              {/* Escalate */}
              <div className="border-t border-grey-border pt-3">
                {!escalating ? (
                  <button
                    type="button"
                    onClick={() => { setEscalating(true); setResolving(false); }}
                    disabled={alreadyEscalated}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-grey-border disabled:text-gray-400 disabled:hover:bg-transparent"
                  >
                    <ArrowUpRight size={15} /> {alreadyEscalated ? `Escalated to ${target}` : 'Escalate'}
                  </button>
                ) : (
                  <div className="dissolve-in space-y-2">
                    <p className="text-sm font-semibold text-navy">Why?</p>
                    {ESCALATION_REASONS.map((r) => (
                      <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-navy">
                        <input type="radio" name="escalate-reason" checked={reason === r} onChange={() => setReason(r)} className="accent-navy" />
                        {r}
                      </label>
                    ))}
                    <p className="text-xs text-gray-500">
                      Goes to <span className="font-medium text-navy">{target}</span>
                      {target === 'IT Support' ? ' (IT/System issue)' : ''}, who becomes the owner.
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEscalating(false)} className={secondaryBtn}>Cancel</button>
                      <button type="button" onClick={escalate} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
                        Escalate now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Resolution block */}
          {active && resolving && (
            <section className="dissolve-in rounded-xl border border-emerald-200 bg-white px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-navy">Resolve issue</h3>
                <button type="button" onClick={() => setResolving(false)} aria-label="Cancel" className="text-gray-400 hover:text-navy"><X size={16} /></button>
              </div>
              <div>
                <label htmlFor="resolution" className="mb-1.5 block text-xs font-semibold text-navy">Resolution details <span className="text-red-600">*</span></label>
                <textarea id="resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} rows={4} className={`${inputClass} resize-y`} placeholder="What was the cause and what fixed it?" />
              </div>
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium text-navy">Requires reporter confirmation?</span>
                  <span className="block text-xs text-gray-400">{issue.reportedBy} must confirm it’s fixed before it can be closed.</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={needsConfirmation}
                  onClick={() => setNeedsConfirmation((v) => !v)}
                  className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors ${needsConfirmation ? 'bg-navy' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${needsConfirmation ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </label>
              <button type="button" onClick={resolve} disabled={!resolution.trim()} className={`${primaryBtn} w-full justify-center`}>
                Mark resolved
              </button>
            </section>
          )}

          {/* After resolution */}
          {issue.status === 'Resolved' && (
            <section className="rounded-xl border border-grey-border bg-white px-4 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-navy">Close out</h3>
              {waitingOnReporter ? (
                <>
                  <p className="text-xs text-gray-500">
                    Waiting for <span className="font-medium text-navy">{issue.reportedBy}</span> to confirm the fix before this can be closed.
                  </p>
                  <button type="button" onClick={confirmFixed} className={`${secondaryBtn} w-full justify-center`}>
                    <ShieldCheck size={15} /> {isReporter ? 'Confirm it’s fixed' : 'Record reporter’s confirmation'}
                  </button>
                </>
              ) : (
                <p className="text-xs text-gray-500">{issue.requiresConfirmation ? 'Reporter confirmed the fix.' : 'No reporter confirmation needed.'} Ready to close.</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={reopen} className={secondaryBtn}>
                  <RotateCcw size={14} /> Not fixed — reopen
                </button>
                <button type="button" onClick={close} disabled={waitingOnReporter} className={`${primaryBtn} flex-1 justify-center`}>
                  Close
                </button>
              </div>
            </section>
          )}

          {issue.status === 'Closed' && (
            <section className="rounded-xl border border-grey-border bg-white px-4 py-4 space-y-2">
              <p className="text-sm text-gray-500">This issue is closed.</p>
              <button type="button" onClick={reopen} className={secondaryBtn}>
                <RotateCcw size={14} /> Reopen
              </button>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
