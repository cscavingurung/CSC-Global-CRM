import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, X, Paperclip, Eye, Check, Hourglass, ChevronDown, Upload, ListChecks, ArrowRight, Users, CalendarDays, Megaphone,
} from 'lucide-react';
import { BranchNotice, BranchNoticeAudience, BranchNoticeType, DailyTask, MockUser, StaffMember, StaffRole, TaskPriority } from '../types';
import {
  AUDIENCE_LABELS, AUDIENCE_OPTIONS, NOTICE_TYPES, NOTICE_TYPE_STYLES, ReceiptStatus, audienceLabel, isExpired,
  noticeRecipients, receiptStatus,
} from '../branchNotices';
import { dateKey, formatSubmittedAt } from '../dateTime';
import DateInput from './DateInput';

// ─── Branch Communication Center ────────────────────────────────────────────
// Official, one-way notices from the Branch Manager to branch staff. Deliberately not a chat:
// no replies, reactions or direct messages. Staff can only open a notice and, where asked,
// confirm "I have read and understood this" — which feeds the acknowledgement tracker.

interface BranchCommunicationCenterProps {
  /** Notices for the current user's branch. */
  notices: BranchNotice[];
  currentUser: MockUser;
  /** Branch staff — recipients and task assignees. */
  staff: StaffMember[];
  /** Branch tasks — to show the status of tasks created from a notice. */
  tasks: DailyTask[];
  onAddNotice: (notice: BranchNotice) => void;
  onUpdateNotice: (id: string, updates: Partial<BranchNotice>) => void;
  onAddTask: (task: DailyTask) => void;
  /** Open the Daily Task Board on a given day. */
  onOpenTaskBoard: (date: string) => void;
}

type FeedFilter = 'All' | 'Announcement' | 'Instruction' | 'SOP Update' | 'Urgent Alert' | 'Meeting';

const FILTERS: { value: FeedFilter; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Announcement', label: 'Announcements' },
  { value: 'Instruction', label: 'Instructions' },
  { value: 'SOP Update', label: 'SOP Updates' },
  { value: 'Urgent Alert', label: 'Urgent' },
  { value: 'Meeting', label: 'Meetings' },
];

const STATUS_ORDER: ReceiptStatus[] = ['Pending', 'Read', 'Acknowledged'];

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';
const labelClass = 'block text-xs font-semibold text-navy mb-1.5';

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function TypeBadge({ type }: { type: BranchNoticeType }) {
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${NOTICE_TYPE_STYLES[type]}`}>{type}</span>;
}

function StatusIcon({ status }: { status: ReceiptStatus }) {
  if (status === 'Acknowledged') return <Check size={15} className="text-emerald-600" aria-hidden="true" />;
  if (status === 'Read') return <Eye size={15} className="text-gray-400" aria-hidden="true" />;
  return <Hourglass size={15} className="text-amber-500" aria-hidden="true" />;
}

const STATUS_TEXT: Record<ReceiptStatus, string> = {
  Acknowledged: 'text-emerald-700',
  Read: 'text-gray-500',
  Pending: 'text-amber-700',
};

// ─── Modal shell ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`dissolve-in relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto rounded-2xl border border-grey-border bg-white`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-grey-border bg-white px-6 py-4">
          <h3 className="text-base font-semibold text-navy">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-navy">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── New Communication ──────────────────────────────────────────────────────

interface NoticeDraft {
  type: BranchNoticeType;
  title: string;
  message: string;
  audience: BranchNoticeAudience[];
  effectiveDate: string;
  expiryDate: string;
  ackRequired: boolean;
  attachments: string[];
}

function NewCommunicationModal({ recipientsFor, onClose, onPublish }: {
  recipientsFor: (audience: BranchNoticeAudience[]) => number;
  onClose: () => void;
  onPublish: (draft: NoticeDraft) => void;
}) {
  const today = dateKey(new Date());
  const [draft, setDraft] = useState<NoticeDraft>({
    type: 'Announcement', title: '', message: '', audience: ['All Staff'], effectiveDate: today, expiryDate: '', ackRequired: false, attachments: [],
  });
  const [tried, setTried] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<NoticeDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // "All Staff" and specific roles are mutually exclusive.
  const toggleAudience = (value: BranchNoticeAudience) => {
    if (value === 'All Staff') return set({ audience: draft.audience.includes('All Staff') ? [] : ['All Staff'] });
    const roles = draft.audience.filter((a) => a !== 'All Staff');
    set({ audience: roles.includes(value) ? roles.filter((a) => a !== value) : [...roles, value] });
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const names = Array.from(files).map((f) => f.name);
    set({ attachments: Array.from(new Set([...draft.attachments, ...names])) });
  };

  const errors = {
    title: !draft.title.trim() && 'Add a title.',
    message: !draft.message.trim() && 'Add the message.',
    audience: draft.audience.length === 0 && 'Choose at least one audience.',
    effectiveDate: !draft.effectiveDate && 'Choose an effective date.',
    expiryDate: !!draft.expiryDate && draft.expiryDate < draft.effectiveDate && 'Expiry must be on or after the effective date.',
  };
  const valid = !Object.values(errors).some(Boolean);
  const reach = recipientsFor(draft.audience);

  const publish = () => {
    setTried(true);
    if (valid) onPublish(draft);
  };

  const FieldError = ({ msg }: { msg: string | false }) => (tried && msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null);

  return (
    <Modal title="New Communication" onClose={onClose} wide>
      <div className="space-y-5 px-6 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="notice-type">Type</label>
            <div className="relative">
              <select
                id="notice-type"
                value={draft.type}
                onChange={(e) => {
                  const type = e.target.value as BranchNoticeType;
                  // Urgent alerts and SOP updates almost always need a confirmed read.
                  set({ type, ackRequired: type === 'Urgent Alert' || type === 'SOP Update' ? true : draft.ackRequired });
                }}
                className={`${inputClass} appearance-none pr-9`}
              >
                {NOTICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <div className="flex items-end">
            <TypeBadge type={draft.type} />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="notice-title">Title</label>
          <input id="notice-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className={inputClass} placeholder="e.g. Revised document verification SOP" />
          <FieldError msg={errors.title} />
        </div>

        <div>
          <label className={labelClass} htmlFor="notice-message">Message</label>
          <textarea id="notice-message" value={draft.message} onChange={(e) => set({ message: e.target.value })} rows={5} className={`${inputClass} resize-y`} placeholder="What staff need to know or do, and by when." />
          <FieldError msg={errors.message} />
        </div>

        <div>
          <p className={labelClass}>Target audience</p>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map((a) => {
              const checked = draft.audience.includes(a);
              return (
                <label
                  key={a}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    checked ? 'border-navy-light bg-navy/5 text-navy' : 'border-grey-border text-gray-600 hover:border-navy-light'
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleAudience(a)} className="h-4 w-4 accent-navy" />
                  {AUDIENCE_LABELS[a]}
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            {draft.audience.length > 0 ? `Reaches ${reach} active staff member${reach === 1 ? '' : 's'} in this branch.` : ''}
          </p>
          <FieldError msg={errors.audience} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="notice-effective">Effective date</label>
            <DateInput id="notice-effective" value={draft.effectiveDate} onChange={(effectiveDate) => set({ effectiveDate })} className="w-full" />
            <FieldError msg={errors.effectiveDate} />
          </div>
          <div>
            <label className={labelClass} htmlFor="notice-expiry">Expiry date <span className="font-normal text-gray-400">(optional)</span></label>
            <DateInput id="notice-expiry" value={draft.expiryDate} min={draft.effectiveDate} onChange={(expiryDate) => set({ expiryDate })} className="w-full" />
            <FieldError msg={errors.expiryDate} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-grey-border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-navy">Acknowledgement required?</p>
            <p className="text-xs text-gray-400">Staff must confirm “I have read and understood this”.</p>
          </div>
          <div className="inline-flex rounded-lg border border-grey-border p-0.5" role="radiogroup" aria-label="Acknowledgement required">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={draft.ackRequired === v}
                onClick={() => set({ ackRequired: v })}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${draft.ackRequired === v ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
              >
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={labelClass}>Attachments</p>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center ${
              dragOver ? 'border-navy-light bg-navy/5' : 'border-grey-border hover:border-navy-light'
            }`}
          >
            <Upload size={18} className="text-gray-400" />
            <p className="text-sm text-navy">Drop files here or <span className="font-semibold">browse</span></p>
            <p className="text-xs text-gray-400">PDF, Word, Excel or images · uploads are simulated for now</p>
            <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </div>
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
        <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">
          Cancel
        </button>
        <button type="button" onClick={publish} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light">
          Publish to branch
        </button>
      </div>
    </Modal>
  );
}

// ─── Create Task from Communication ─────────────────────────────────────────

const TASK_ROLES: (StaffRole | 'Anyone')[] = ['Anyone', 'Front Desk Officer', 'Counselor', 'V/A Officer'];

function CreateTaskModal({ notice, staff, onClose, onCreate }: {
  notice: BranchNotice;
  staff: StaffMember[];
  onClose: () => void;
  onCreate: (task: { title: string; owner: string; date: string }) => void;
}) {
  const today = dateKey(new Date());
  const [title, setTitle] = useState(`Follow up: ${notice.title}`);
  const [owner, setOwner] = useState('Anyone');
  const [date, setDate] = useState(notice.effectiveDate > today ? notice.effectiveDate : today);
  const people = staff.filter((s) => s.status === 'Active' && s.role !== 'Branch Manager' && s.role !== 'Super Admin');

  return (
    <Modal title="Create Task from Communication" onClose={onClose}>
      <div className="space-y-4 px-6 py-5">
        <div className="flex items-start gap-2 rounded-lg bg-grey-bg px-3 py-2.5">
          <Megaphone size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
          <p className="text-xs text-gray-500">
            Linked to <span className="font-medium text-navy">{notice.title}</span>. The task is added to the <span className="font-medium text-navy">Daily Task Board</span>.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="task-title">Task title</label>
          <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="task-owner">Assigned to</label>
          <div className="relative">
            <select id="task-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={`${inputClass} appearance-none pr-9`}>
              <optgroup label="Role">
                {TASK_ROLES.map((r) => <option key={r} value={r}>{r === 'Anyone' ? 'Anyone in the branch' : `Any ${r}`}</option>)}
              </optgroup>
              <optgroup label="Staff member">
                {people.map((p) => <option key={p.id} value={p.name}>{p.name} · {p.role}</option>)}
              </optgroup>
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="task-date">Due date</label>
          <DateInput id="task-date" value={date} min={today} onChange={setDate} className="w-full" />
        </div>
      </div>
      <div className="flex gap-3 border-t border-grey-border px-6 py-4">
        <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">
          Cancel
        </button>
        <button
          type="button"
          disabled={!title.trim() || !date}
          onClick={() => onCreate({ title: title.trim(), owner, date })}
          className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add to Daily Task Board
        </button>
      </div>
    </Modal>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function BranchCommunicationCenter({
  notices, currentUser, staff, tasks, onAddNotice, onUpdateNotice, onAddTask, onOpenTaskBoard,
}: BranchCommunicationCenterProps) {
  const today = dateKey(new Date());
  const isManager = currentUser.role === 'branch_manager';
  const [filter, setFilter] = useState<FeedFilter>('All');
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);
  const [taskFor, setTaskFor] = useState<BranchNotice | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<{ noticeId: string; date: string } | null>(null);

  // Staff viewing the page: opening it counts as reading every notice addressed to them.
  useEffect(() => {
    if (isManager) return;
    notices.forEach((n) => {
      const receipt = n.receipts.find((r) => r.staffName === currentUser.name);
      if (receipt && !receipt.readAt) {
        onUpdateNotice(n.id, {
          receipts: n.receipts.map((r) => (r.staffName === currentUser.name ? { ...r, readAt: formatSubmittedAt(new Date()) } : r)),
        });
      }
    });
  }, [isManager, notices, currentUser.name, onUpdateNotice]);

  const acknowledge = (n: BranchNotice) => {
    const now = formatSubmittedAt(new Date());
    onUpdateNotice(n.id, {
      receipts: n.receipts.map((r) => (r.staffName === currentUser.name ? { ...r, readAt: r.readAt ?? now, acknowledgedAt: now } : r)),
    });
  };

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notices
      .filter((n) => isManager || n.receipts.some((r) => r.staffName === currentUser.name))
      .filter((n) => filter === 'All' || n.type === filter)
      .filter((n) => !term || `${n.title} ${n.message} ${n.attachments.join(' ')}`.toLowerCase().includes(term))
      // Live urgent alerts first, then newest first; expired notices sink to the bottom.
      .sort((a, b) => {
        const rank = (n: BranchNotice) => (isExpired(n, today) ? 2 : n.type === 'Urgent Alert' ? 0 : 1);
        return rank(a) - rank(b) || b.effectiveDate.localeCompare(a.effectiveDate) || b.postedAt.localeCompare(a.postedAt);
      });
  }, [notices, filter, search, isManager, currentUser.name, today]);

  const mineOnly = useMemo(
    () => (isManager ? notices : notices.filter((n) => n.receipts.some((r) => r.staffName === currentUser.name))),
    [notices, isManager, currentUser.name]
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: mineOnly.length };
    mineOnly.forEach((n) => { c[n.type] = (c[n.type] ?? 0) + 1; });
    return c;
  }, [mineOnly]);
  const toAcknowledge = mineOnly.filter(
    (n) => n.ackRequired && !isExpired(n, today) && !n.receipts.find((r) => r.staffName === currentUser.name)?.acknowledgedAt
  ).length;

  const awaitingAck = notices
    .filter((n) => n.ackRequired && !isExpired(n, today))
    .reduce((sum, n) => sum + n.receipts.filter((r) => !r.acknowledgedAt).length, 0);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const publish = (draft: NoticeDraft) => {
    const recipients = noticeRecipients(staff, draft.audience);
    onAddNotice({
      id: `notice-${Date.now()}`,
      branch: currentUser.branch,
      type: draft.type,
      title: draft.title.trim(),
      message: draft.message.trim(),
      audience: draft.audience,
      effectiveDate: draft.effectiveDate,
      expiryDate: draft.expiryDate || undefined,
      ackRequired: draft.ackRequired,
      attachments: draft.attachments,
      postedBy: currentUser.name,
      postedAt: formatSubmittedAt(new Date()),
      receipts: recipients.map((s) => ({ staffName: s.name })),
      linkedTaskIds: [],
    });
    setComposing(false);
    setFilter('All');
  };

  const createTask = (notice: BranchNotice, draft: { title: string; owner: string; date: string }) => {
    const person = staff.find((s) => s.name === draft.owner);
    const id = `t${Date.now()}`;
    const priority: TaskPriority = notice.type === 'Urgent Alert' ? 'High' : 'Medium';
    onAddTask({
      id,
      title: draft.title,
      notes: `From communication: ${notice.title}`,
      branch: currentUser.branch,
      assignedRole: person ? person.role : (draft.owner as StaffRole | 'Anyone'),
      assignee: person?.name,
      date: draft.date,
      priority,
      status: 'To Do',
      createdBy: currentUser.name,
    });
    onUpdateNotice(notice.id, { linkedTaskIds: [...notice.linkedTaskIds, id] });
    setTaskFor(null);
    setFlash({ noticeId: notice.id, date: draft.date });
  };

  const staffByName = useMemo(() => new Map(staff.map((s) => [s.name, s])), [staff]);

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">Official notices and instructions for the {currentUser.branch} branch team.</p>
          {!isManager && toAcknowledge > 0 && (
            <p className="mt-0.5 text-xs text-amber-700">{toAcknowledge} notice{toAcknowledge === 1 ? '' : 's'} need{toAcknowledge === 1 ? 's' : ''} your acknowledgement</p>
          )}
          {isManager && awaitingAck > 0 && (
            <p className="mt-0.5 text-xs text-amber-700">
              {awaitingAck} acknowledgement{awaitingAck === 1 ? '' : 's'} outstanding on active notices
            </p>
          )}
        </div>
        {isManager && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light"
          >
            <Plus size={16} /> New Communication
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search past communications by title or keyword"
            className="w-full rounded-lg border border-grey-border bg-white py-2.5 pl-10 pr-9 text-sm focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={active}
                className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  active ? 'border-navy bg-navy text-white' : 'border-grey-border bg-white text-gray-600 hover:border-navy-light hover:text-navy'
                }`}
              >
                {f.value === 'Urgent Alert' && <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
                {f.label}
                <span className={active ? 'text-white/70' : 'text-gray-400'}>{counts[f.value] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {visible.length === 0 && (
          <div className="rounded-xl border border-grey-border bg-white py-12 text-center text-sm text-gray-400">
            {search || filter !== 'All' ? 'No communications match these filters.' : 'No communications yet.'}
          </div>
        )}

        {visible.map((n) => {
          const urgent = n.type === 'Urgent Alert';
          const expired = isExpired(n, today);
          const upcoming = n.effectiveDate > today;
          const acked = n.receipts.filter((r) => r.acknowledgedAt).length;
          const read = n.receipts.filter((r) => r.readAt && !r.acknowledgedAt).length;
          const total = n.receipts.length;
          const open = expanded.has(n.id);
          const myReceipt = n.receipts.find((r) => r.staffName === currentUser.name);
          const linkedTasks = n.linkedTaskIds.map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as DailyTask[];
          const sortedReceipts = [...n.receipts].sort(
            (a, b) => STATUS_ORDER.indexOf(receiptStatus(a)) - STATUS_ORDER.indexOf(receiptStatus(b)) || a.staffName.localeCompare(b.staffName)
          );

          return (
            <article
              key={n.id}
              className={`rounded-xl border bg-white ${urgent && !expired ? 'border-red-200' : 'border-grey-border'} ${expired ? 'opacity-70' : ''}`}
            >
              {/* Header */}
              <div className="px-5 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  {urgent && !expired && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      </span>
                      URGENT
                    </span>
                  )}
                  <TypeBadge type={n.type} />
                  {expired && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">Expired</span>}
                  {!isManager && n.ackRequired && myReceipt && !myReceipt.acknowledgedAt && !expired && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Action required</span>
                  )}
                  {upcoming && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">Scheduled</span>}
                </div>
                <h2 className="mt-2 text-base font-semibold leading-snug text-navy">{n.title}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>Posted by <span className="font-medium text-navy">{n.postedBy}</span> · Branch Manager</span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={12} className="text-gray-400" />
                    Effective {formatDate(n.effectiveDate)}
                    {n.expiryDate && <> · {expired ? 'expired' : 'expires'} {formatDate(n.expiryDate)}</>}
                  </span>
                </p>
              </div>

              {/* Body */}
              <div className="px-5 py-3">
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{n.message}</p>
                {n.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {n.attachments.map((name) => (
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
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500">
                  <Users size={13} className="text-gray-400" />
                  Audience: <span className="font-medium text-navy">{audienceLabel(n.audience)}</span>
                </p>
              </div>

              {/* Staff: acknowledge */}
              {!isManager && n.ackRequired && myReceipt && (
                <div className="border-t border-grey-border px-5 py-3">
                  {myReceipt.acknowledgedAt ? (
                    <p key="acked" className="dissolve-in flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                        <Check size={15} /> Acknowledged
                      </span>
                      <span className="text-xs text-gray-400">{myReceipt.acknowledgedAt}</span>
                    </p>
                  ) : (
                    <button type="button" onClick={() => acknowledge(n)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light sm:w-auto">
                      <Check size={15} /> Mark as Read & Acknowledged
                    </button>
                  )}
                </div>
              )}

              {/* Manager: acknowledgement tracker */}
              {isManager && n.ackRequired && (
                <div className="border-t border-grey-border">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(n.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-grey-bg/50"
                  >
                    <span className="text-sm text-navy">
                      Acknowledgement: <span className="font-semibold tabular-nums">{acked}/{total}</span> staff
                    </span>
                    <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-gray-100 sm:block" aria-hidden="true">
                      <span className="block h-full rounded-full bg-emerald-500" style={{ width: total ? `${(acked / total) * 100}%` : '0%' }} />
                    </span>
                    <span className="hidden text-xs text-gray-400 sm:inline">
                      {read > 0 && <>{read} read only · </>}
                      {total - acked - read > 0 ? `${total - acked - read} pending` : acked === total ? 'complete' : ''}
                    </span>
                    <ChevronDown size={16} className={`ml-auto text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <ul className="dissolve-in divide-y divide-grey-border border-t border-grey-border">
                      {sortedReceipts.map((r) => {
                        const status = receiptStatus(r);
                        const member = staffByName.get(r.staffName);
                        return (
                          <li key={r.staffName} className="flex items-center gap-3 px-5 py-2.5">
                            <StatusIcon status={status} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-navy">{r.staffName}</p>
                              {member && <p className="text-[11px] text-gray-400">{member.role}</p>}
                            </div>
                            <div className="text-right">
                              <p className={`text-xs font-medium ${STATUS_TEXT[status]}`}>{status}</p>
                              <p className="text-[11px] text-gray-400">
                                {status === 'Acknowledged' ? r.acknowledgedAt : status === 'Read' ? `Opened ${r.readAt}` : 'Not opened yet'}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                      {total === 0 && <li className="px-5 py-3 text-xs text-gray-400">No active staff in this audience.</li>}
                    </ul>
                  )}
                </div>
              )}

              {/* Manager: linked tasks + create task */}
              {isManager && (
                <div className="flex flex-col gap-2 border-t border-grey-border px-5 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {linkedTasks.length === 0 && !n.ackRequired && (
                      <span className="text-xs text-gray-400">No acknowledgement required</span>
                    )}
                    {linkedTasks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onOpenTaskBoard(t.date)}
                        title="Open in Daily Task Board"
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-grey-border px-2.5 py-1 text-xs text-navy hover:border-navy-light"
                      >
                        <ListChecks size={12} className="flex-shrink-0 text-gray-400" />
                        <span className="truncate">{t.title}</span>
                        <span className={`flex-shrink-0 ${t.status === 'Done' ? 'text-emerald-700' : t.status === 'In Progress' ? 'text-navy-light' : 'text-gray-400'}`}>· {t.status}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaskFor(n)}
                    className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg border border-grey-border px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy-light hover:bg-grey-bg"
                  >
                    <ListChecks size={14} /> Create Task from Communication
                  </button>
                </div>
              )}

              {flash?.noticeId === n.id && (
                <div className="dissolve-in flex items-center gap-2 border-t border-grey-border bg-emerald-50 px-5 py-2.5 text-xs text-emerald-800">
                  <Check size={14} /> Task added to the Daily Task Board.
                  <button type="button" onClick={() => onOpenTaskBoard(flash.date)} className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline">
                    Open board <ArrowRight size={12} />
                  </button>
                  <button type="button" onClick={() => setFlash(null)} aria-label="Dismiss" className="text-emerald-700 hover:text-emerald-900">
                    <X size={14} />
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {composing && (
        <NewCommunicationModal
          recipientsFor={(audience) => noticeRecipients(staff, audience).length}
          onClose={() => setComposing(false)}
          onPublish={publish}
        />
      )}
      {taskFor && (
        <CreateTaskModal notice={taskFor} staff={staff} onClose={() => setTaskFor(null)} onCreate={(draft) => createTask(taskFor, draft)} />
      )}
    </div>
  );
}
