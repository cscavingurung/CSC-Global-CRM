import { useState } from 'react';
import { Check, ChevronDown, Info, Plus, RotateCcw, ShieldCheck } from 'lucide-react';
import { BranchIssue, IssueActivity, IssueStatus, MockUser } from '../types';
import { NewIssueInput, buildIssue, isActive } from '../branchIssues';
import { ROLE_LABELS } from '../mockData';
import { formatActivityTime, formatSubmittedAt, parseSubmittedAt } from '../dateTime';
import { ReportIssueModal } from './IssueEscalationCenter';
import { PriorityBadge, StatusBadge } from './IssueDetail';

// ─── Branch Hub · Help Desk ─────────────────────────────────────────────────
// The employee side of Issue & Escalation Management: raise a ticket, follow your own tickets
// through a four-step tracker, and confirm the fix once IT or management resolves it.

interface HelpDeskPageProps {
  currentUser: MockUser;
  /** Every issue in the branch — used for numbering; only the user's own are shown. */
  issues: BranchIssue[];
  onAddIssue: (issue: BranchIssue) => void;
  onUpdateIssue: (id: string, updates: Partial<BranchIssue>) => void;
}

// Staff see a simplified pipeline; In Progress sits inside "Assigned" and Closed inside "Resolved".
const STEPS = ['Open', 'Assigned', 'Waiting', 'Resolved'] as const;
const STEP_OF: Record<IssueStatus, number> = { Open: 0, Assigned: 1, 'In Progress': 1, Waiting: 2, Resolved: 3, Closed: 3 };

function MiniPipeline({ status }: { status: IssueStatus }) {
  const current = STEP_OF[status];
  return (
    <ol className="flex items-center gap-1" aria-label={`Status: ${status}`}>
      {STEPS.map((s, i) => {
        const reached = i <= current;
        const label = i === current && status === 'In Progress' ? 'In Progress' : i === current && status === 'Closed' ? 'Closed' : s;
        return (
          <li key={s} className="flex items-center gap-1">
            {i > 0 && <span className={`h-px w-4 ${reached ? 'bg-navy' : 'bg-grey-border'}`} aria-hidden="true" />}
            <span
              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                i === current ? 'bg-navy text-white' : reached ? 'bg-navy/10 text-navy' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const when = (stamp?: string) => {
  const d = stamp ? parseSubmittedAt(stamp) : null;
  return d ? formatActivityTime(d) : stamp ?? '';
};

export default function HelpDeskPage({ currentUser, issues, onAddIssue, onUpdateIssue }: HelpDeskPageProps) {
  const [reporting, setReporting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const mine = issues
    .filter((i) => i.reportedBy === currentUser.name)
    // Tickets waiting on the user first, then open ones, then closed; newest first within each.
    .sort((a, b) => {
      const rank = (i: BranchIssue) => (i.status === 'Resolved' ? 0 : isActive(i) ? 1 : 2);
      return rank(a) - rank(b) || b.reportedAt.localeCompare(a.reportedAt);
    });
  const openCount = mine.filter(isActive).length;
  const toConfirm = mine.filter((i) => i.status === 'Resolved').length;

  const log = (issue: BranchIssue, entries: Omit<IssueActivity, 'id' | 'at' | 'by'>[]) => {
    const at = formatSubmittedAt(new Date());
    return [...issue.activity, ...entries.map((e, n) => ({ ...e, id: `ia-${Date.now()}-${n}`, at, by: currentUser.name }))];
  };

  const confirm = (issue: BranchIssue) => {
    const at = formatSubmittedAt(new Date());
    onUpdateIssue(issue.id, {
      status: 'Closed',
      reporterConfirmedAt: at,
      closedAt: at,
      activity: log(issue, [
        { text: 'confirmed the issue is fixed', kind: 'confirmed' },
        { text: 'closed the issue', kind: 'closed' },
      ]),
    });
  };

  const notFixed = (issue: BranchIssue) =>
    onUpdateIssue(issue.id, {
      status: 'In Progress',
      resolvedAt: undefined,
      reporterConfirmedAt: undefined,
      activity: log(issue, [{ text: 'reopened the issue — not fixed', kind: 'reopened' }]),
    });

  const submit = (input: NewIssueInput) => {
    const issue = buildIssue(input, currentUser, ROLE_LABELS[currentUser.role], issues, formatSubmittedAt(new Date()));
    onAddIssue(issue);
    setReporting(false);
    setExpanded(issue.id);
  };

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex gap-2.5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <p>Need help with something you cannot resolve yourself? Report it here. For normal work, use Tasks.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-navy">My Tickets</h2>
          <p className="text-xs text-gray-500">
            {openCount} open
            {toConfirm > 0 && <span className="font-medium text-amber-700"> · {toConfirm} waiting for you to confirm the fix</span>}
          </p>
        </div>
        <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">
          <Plus size={16} /> Submit New Ticket
        </button>
      </div>

      {mine.length === 0 ? (
        <div className="rounded-xl border border-grey-border bg-white py-12 text-center text-sm text-gray-400">You haven’t raised any tickets.</div>
      ) : (
        <div className="divide-y divide-grey-border rounded-xl border border-grey-border bg-white">
          {mine.map((i) => {
            const open = expanded === i.id;
            const resolved = i.status === 'Resolved';
            return (
              <div key={i.id} className={resolved ? 'bg-emerald-50/30' : ''}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : i.id)}
                  aria-expanded={open}
                  className="flex w-full flex-col gap-2 px-5 py-3.5 text-left hover:bg-grey-bg/40 lg:flex-row lg:items-center lg:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-gray-500">{i.code}</span>
                      <PriorityBadge priority={i.priority} />
                      <span className="text-xs text-gray-400">{i.category}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-navy">{i.title}</p>
                    <p className="text-[11px] text-gray-400">Reported {when(i.reportedAt)}{i.owner ? ` · with ${i.owner}` : ''}</p>
                  </div>
                  <MiniPipeline status={i.status} />
                  <ChevronDown size={16} className={`hidden flex-shrink-0 text-gray-400 transition-transform lg:block ${open ? 'rotate-180' : ''}`} />
                </button>

                {resolved && (
                  <div className="flex flex-col gap-2 px-5 pb-3.5 sm:flex-row sm:items-center">
                    <p className="flex-1 text-xs text-emerald-800">
                      <span className="font-semibold">Resolved:</span> {i.resolution}
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => notFixed(i)} className="inline-flex items-center gap-1.5 rounded-lg border border-grey-border bg-white px-3 py-2 text-xs font-medium text-navy hover:border-navy-light">
                        <RotateCcw size={13} /> Still not fixed
                      </button>
                      <button type="button" onClick={() => confirm(i)} className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy-light">
                        <ShieldCheck size={14} /> Confirm Resolution
                      </button>
                    </div>
                  </div>
                )}

                {open && (
                  <div className="dissolve-in grid grid-cols-1 gap-4 border-t border-grey-border bg-grey-bg/30 px-5 py-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-navy">What’s happening?</p>
                        <p className="mt-0.5 whitespace-pre-line text-sm text-gray-700">{i.description}</p>
                      </div>
                      {i.triedSoFar && (
                        <div>
                          <p className="text-xs font-semibold text-navy">Already tried</p>
                          <p className="mt-0.5 text-sm text-gray-700">{i.triedSoFar}</p>
                        </div>
                      )}
                      {i.status === 'Closed' && i.resolution && (
                        <p className="flex items-start gap-1.5 text-sm text-emerald-700"><Check size={15} className="mt-0.5" /> {i.resolution}</p>
                      )}
                      <StatusBadge status={i.status} />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-navy">Updates</p>
                      <ol className="space-y-1.5">
                        {i.activity.map((a) => (
                          <li key={a.id} className="text-xs text-gray-600">
                            <span className="tabular-nums text-gray-400">{when(a.at)}</span> · <span className="font-medium text-navy">{a.by}</span> {a.kind === 'update' ? <>: “{a.text}”</> : a.text}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reporting && <ReportIssueModal onClose={() => setReporting(false)} onSubmit={submit} />}
    </div>
  );
}
