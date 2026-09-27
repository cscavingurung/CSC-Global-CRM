import { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, FileText, ListChecks, LifeBuoy, UserPlus } from 'lucide-react';
import {
  ApplicationRecord, BranchIssue, CounselorStudent, DailyTask, HandoverTransfer, OffboardingCase, StaffMember,
} from '../types';
import { WorkloadSources, workloadOf, workloadTotal } from '../hrCases';
import { getClientStatusLabel } from '../clientPipeline';
import { clientIdFor } from '../clientId';
import { formatSubmittedAt } from '../dateTime';

// ─── Handover Engine ────────────────────────────────────────────────────────
// Finds everything a leaving employee still owns — leads, clients, tasks, issues — straight
// from the live records, and moves it to other staff in bulk. Every transfer is logged on the
// offboarding case. Nothing is deleted; only the owner changes.

type Category = HandoverTransfer['category'];

interface Row {
  id: string;
  title: string;
  meta: string;
}

export interface HandoverActions {
  onUpdateCounselorStudent: (id: string, updates: Partial<CounselorStudent>) => void;
  onUpdateApplication: (id: string, updates: Partial<ApplicationRecord>) => void;
  onUpdateTask: (id: string, updates: Partial<DailyTask>) => void;
  onUpdateIssue: (id: string, updates: Partial<BranchIssue>) => void;
}

interface HandoverEngineProps extends HandoverActions {
  offCase: OffboardingCase;
  sources: WorkloadSources;
  /** Branch staff — reassignment targets. */
  staff: StaffMember[];
  /** Names that can't receive work (the leaver, anyone else mid-offboarding). */
  unavailable: string[];
  currentUserName: string;
  onLog: (transfer: HandoverTransfer) => void;
  readOnly: boolean;
}

const selectClass =
  'w-full appearance-none rounded-lg border border-grey-border bg-white py-2 pl-3 pr-8 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light';

export default function HandoverEngine({
  offCase, sources, staff, unavailable, currentUserName, onLog, readOnly,
  onUpdateCounselorStudent, onUpdateApplication, onUpdateTask, onUpdateIssue,
}: HandoverEngineProps) {
  const work = workloadOf(offCase.employeeName, sources);
  const total = workloadTotal(work);

  // Who can take what: client work stays with counselors; tasks and issues can go to anyone.
  const active = staff.filter((s) => s.status === 'Active' && !unavailable.includes(s.name) && s.role !== 'Super Admin');
  const counselors = active.filter((s) => s.role === 'Counselor');
  const loadOf = (name: string) => {
    const w = workloadOf(name, sources);
    return `${w.leads.length} leads · ${w.clients.length} clients · ${w.tasks.length} tasks`;
  };

  const categories: { key: Category; icon: React.ReactNode; rows: Row[]; targets: StaffMember[] }[] = useMemo(() => [
    {
      key: 'Active leads',
      icon: <UserPlus size={16} />,
      rows: work.leads.map((l) => ({ id: l.id, title: l.name, meta: `${l.consultationStatus}${l.followUpDate ? ` · follow-up ${l.followUpDate}` : ''} · ${l.country}` })),
      targets: counselors,
    },
    {
      key: 'Active clients',
      icon: <FileText size={16} />,
      rows: work.clients.map((a) => ({ id: a.id, title: a.name, meta: `${clientIdFor(a)} · ${getClientStatusLabel(a)} · ${a.country}` })),
      targets: counselors,
    },
    {
      key: 'Pending tasks',
      icon: <ListChecks size={16} />,
      rows: work.tasks.map((t) => ({ id: t.id, title: t.title, meta: `${t.date}${t.dueTime ? ` ${t.dueTime}` : ''} · ${t.priority} · ${t.status}` })),
      targets: active,
    },
    {
      key: 'Open issues',
      icon: <LifeBuoy size={16} />,
      rows: work.issues.map((i) => ({ id: i.id, title: `${i.code} · ${i.title}`, meta: `${i.priority} · ${i.status}` })),
      targets: active,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [sources, staff, offCase.employeeName, unavailable.join('|')]);

  // Per-category selection (default: everything) and target.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<Partial<Record<Category, string>>>({});
  const [bulkTarget, setBulkTarget] = useState('');
  const [open, setOpen] = useState<Set<Category>>(new Set(['Active leads', 'Active clients']));
  const targetFor = (key: Category, options: StaffMember[]) => targets[key] ?? options[0]?.name ?? '';

  const transfer = (key: Category, ids: string[], to: string) => {
    if (!to || ids.length === 0) return;
    const person = staff.find((s) => s.name === to);
    const at = formatSubmittedAt(new Date());
    ids.forEach((id) => {
      if (key === 'Active leads') onUpdateCounselorStudent(id, { assignedCounselor: to });
      else if (key === 'Active clients') onUpdateApplication(id, { counselor: to });
      else if (key === 'Pending tasks') onUpdateTask(id, { assignee: to, assignedRole: person?.role ?? 'Anyone', updatedBy: currentUserName, updatedAt: at });
      else {
        const issue = sources.issues.find((i) => i.id === id);
        if (issue) {
          onUpdateIssue(id, {
            owner: to,
            activity: [...issue.activity, { id: `ia-${Date.now()}-${id}`, at, by: currentUserName, text: `reassigned to ${to} — ${offCase.employeeName} is leaving (${offCase.code})`, kind: 'assigned' }],
          });
        }
      }
    });
    onLog({ id: `ho-${Date.now()}-${key}`, at, by: currentUserName, category: key, count: ids.length, to });
    setDeselected((prev) => new Set([...prev].filter((x) => !ids.includes(x))));
  };

  const selectedIds = (rows: Row[]) => rows.filter((r) => !deselected.has(r.id)).map((r) => r.id);

  const reassignEverything = () => {
    categories.forEach((c) => {
      const to = c.targets.some((t) => t.name === bulkTarget) ? bulkTarget : targetFor(c.key, c.targets);
      transfer(c.key, c.rows.map((r) => r.id), to);
    });
  };

  const toggleRow = (id: string) => setDeselected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = (rows: Row[]) => {
    const allOn = rows.every((r) => !deselected.has(r.id));
    setDeselected((prev) => {
      const n = new Set(prev);
      rows.forEach((r) => (allOn ? n.add(r.id) : n.delete(r.id)));
      return n;
    });
  };
  const toggleOpen = (key: Category) => setOpen((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  return (
    <section className="rounded-xl border border-grey-border bg-white">
      <div className="flex flex-col gap-1 border-b border-grey-border px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-navy">Handover Engine</h3>
          <p className="text-xs text-gray-500">Open workload still owned by {offCase.employeeName}, read live from the CRM. Reassigning changes the owner only — history stays intact.</p>
        </div>
        {total === 0 && (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:self-auto">
            <Check size={13} /> Handover complete
          </span>
        )}
      </div>

      {/* Open workload summary */}
      <div className="grid grid-cols-2 gap-px bg-grey-border sm:grid-cols-4">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => toggleOpen(c.key)}
            className="bg-white px-5 py-3 text-left hover:bg-grey-bg/60"
          >
            <p className="flex items-center gap-1.5 text-xs text-gray-500">{c.icon} {c.key}</p>
            <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${c.rows.length ? 'text-navy' : 'text-gray-300'}`}>{c.rows.length}</p>
          </button>
        ))}
      </div>

      {/* Reassign everything */}
      {!readOnly && total > 0 && (
        <div className="flex flex-col gap-2 border-y border-grey-border bg-grey-bg/50 px-5 py-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-navy">
            Move all <span className="font-semibold">{total}</span> open item{total === 1 ? '' : 's'} to one person
            <span className="block text-xs text-gray-500">Client work only goes to counselors; anything they can’t take uses each list’s own choice below.</span>
          </p>
          <div className="relative sm:w-56">
            <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)} className={selectClass} aria-label="Reassign everything to">
              <option value="">Choose staff member…</option>
              {active.map((s) => <option key={s.id} value={s.name}>{s.name} · {s.role}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <button
            type="button"
            onClick={reassignEverything}
            disabled={!bulkTarget}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reassign all <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Per-category lists */}
      <div className="divide-y divide-grey-border">
        {categories.map((c) => {
          const isOpen = open.has(c.key) && c.rows.length > 0;
          const chosen = selectedIds(c.rows);
          const to = targetFor(c.key, c.targets);
          return (
            <div key={c.key}>
              <button
                type="button"
                onClick={() => toggleOpen(c.key)}
                disabled={c.rows.length === 0}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2 px-5 py-3 text-left disabled:cursor-default"
              >
                <span className="text-gray-400">{c.icon}</span>
                <span className="text-sm font-medium text-navy">{c.key}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.rows.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {c.rows.length ? `${c.rows.length} to hand over` : 'None'}
                </span>
                {c.rows.length > 0 && <ChevronDown size={16} className={`ml-auto text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
              </button>

              {isOpen && (
                <div className="dissolve-in px-5 pb-4">
                  <div className="overflow-hidden rounded-lg border border-grey-border">
                    <label className="flex items-center gap-3 border-b border-grey-border bg-grey-bg px-3 py-2 text-xs font-semibold text-gray-500">
                      <input type="checkbox" checked={chosen.length === c.rows.length} onChange={() => toggleAll(c.rows)} disabled={readOnly} className="h-4 w-4 accent-navy" />
                      Select all ({chosen.length}/{c.rows.length})
                    </label>
                    <ul className="max-h-64 divide-y divide-grey-border overflow-y-auto">
                      {c.rows.map((r) => (
                        <li key={r.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-grey-bg/50">
                            <input type="checkbox" checked={!deselected.has(r.id)} onChange={() => toggleRow(r.id)} disabled={readOnly} className="h-4 w-4 accent-navy" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-navy">{r.title}</span>
                              <span className="block truncate text-[11px] text-gray-400">{r.meta}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {!readOnly && (
                    c.targets.length === 0 ? (
                      <p className="mt-2 text-xs text-red-700">No active {c.key === 'Active leads' || c.key === 'Active clients' ? 'counselor' : 'staff member'} is available to take these.</p>
                    ) : (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <span className="text-xs text-gray-500">Reassign {chosen.length} selected to</span>
                        <div className="relative flex-1 sm:max-w-sm">
                          <select value={to} onChange={(e) => setTargets({ ...targets, [c.key]: e.target.value })} className={selectClass} aria-label={`${c.key} — new owner`}>
                            {c.targets.map((s) => <option key={s.id} value={s.name}>{s.name} — {loadOf(s.name)}</option>)}
                          </select>
                          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                        <button
                          type="button"
                          onClick={() => transfer(c.key, chosen, to)}
                          disabled={chosen.length === 0}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-navy bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-navy hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Reassign <ArrowRight size={14} />
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Transfer log */}
      {offCase.handoverLog.length > 0 && (
        <div className="border-t border-grey-border px-5 py-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Transfers</p>
          <ul className="space-y-1">
            {[...offCase.handoverLog].reverse().map((h) => (
              <li key={h.id} className="text-xs text-gray-600">
                <span className="tabular-nums text-gray-400">{h.at}</span> · {h.by} moved <span className="font-medium text-navy">{h.count} {h.category.toLowerCase()}</span> to <span className="font-medium text-navy">{h.to}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
