import { useRef, useState } from 'react';
import { ArrowRight, LifeBuoy, Paperclip, Plus, RotateCcw, Send, UserCog, X } from 'lucide-react';
import { DailyTask, ItTicket, ItTicketCategory, ItTicketPriority } from '../../types';
import {
  ALL_TIME, DateRange, IT_CATEGORIES, IT_PRIORITIES, IT_STATUSES, IT_STATUS_STYLES, PRIORITY_STYLES, TASK_CATEGORIES,
  TASK_STATUS_STYLES, dayLabel, inRange, overdueDays, taskCategory, taskOwner,
} from '../../managerWorkspace';
import { dateKey } from '../../dateTime';
import { Field, GhostButton, Kpi, Modal, PrimaryButton, SelectInput, TextArea, TextInput } from '../marketing/MktShared';
import { NewItTicket, useWorkspace } from './workspaceContext';
import { Badge, DataList, DateRangeControl, FilterBar, FilterSelect, SearchFilter, SectionHeading, StepTrack, ToggleFilter } from './WorkspaceShared';

// ═══ 1. Staff task oversight ═════════════════════════════════════════════════
function ReassignModal({ task, onClose }: { task: DailyTask; onClose: () => void }) {
  const { data, actions, flash } = useWorkspace();
  const people = data.staff.filter((s) => s.status === 'Active' && s.role !== 'Branch Manager' && (task.assignedRole === 'Anyone' || s.role === task.assignedRole)).map((s) => s.name).sort();
  const [to, setTo] = useState(task.assignee && people.includes(task.assignee) ? task.assignee : '');
  return (
    <Modal title="Reassign Task" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-grey-bg p-4 text-sm">
          <p className="font-semibold text-navy">{task.title}</p>
          <p className="text-xs text-gray-500">Currently: {taskOwner(task)} · {task.assignedRole === 'Anyone' ? 'open to anyone' : `${task.assignedRole} task`}</p>
        </div>
        <Field label="Assign To" required>
          <SelectInput value={to} onChange={setTo} label="Assign To">
            <option value="">Select staff</option>
            {people.map((p) => <option key={p}>{p}</option>)}
          </SelectInput>
        </Field>
        <div className="flex justify-end gap-2 border-t border-grey-border pt-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton disabled={!to || to === task.assignee} onClick={() => { actions.reassignTask(task.id, to); flash(`Task reassigned to ${to}.`); onClose(); }}><UserCog size={14} /> Reassign</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function TaskOversight() {
  const { data, navigateApp } = useWorkspace();
  const today = dateKey(new Date());
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [staff, setStaff] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [q, setQ] = useState('');
  const [reassign, setReassign] = useState<string | null>(null);

  const owners = [...new Set(data.tasks.map(taskOwner))].sort();
  const rows = data.tasks
    .filter((t) => (!overdueOnly || overdueDays(t, today) > 0) && (!staff || taskOwner(t) === staff) && (!priority || t.priority === priority)
      && (!category || taskCategory(t) === category) && (!status || t.status === status) && inRange(t.date, range)
      && (!q || t.title.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => overdueDays(b, today) - overdueDays(a, today) || ['High', 'Medium', 'Low'].indexOf(a.priority) - ['High', 'Medium', 'Low'].indexOf(b.priority) || a.date.localeCompare(b.date));

  const open = data.tasks.filter((t) => t.status !== 'Done');
  const overdue = open.filter((t) => overdueDays(t, today) > 0);
  const moving = data.tasks.find((t) => t.id === reassign);

  const lateBadge = (t: DailyTask) => {
    const d = overdueDays(t, today);
    return d > 0 ? <Badge text={`${d} day${d === 1 ? '' : 's'} overdue`} cls="bg-red-100 text-red-800" /> : null;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Open Tasks" value={open.length} />
        <Kpi label="Overdue" value={overdue.length} tone={overdue.length ? 'red' : undefined} hint={overdue.length ? `oldest ${Math.max(...overdue.map((t) => overdueDays(t, today)))} days` : 'nothing late'} />
        <Kpi label="Due Today" value={open.filter((t) => t.date === today).length} />
        <Kpi label="High Priority Open" value={open.filter((t) => t.priority === 'High').length} tone={open.some((t) => t.priority === 'High') ? 'amber' : undefined} />
      </div>
      <FilterBar
        active={Boolean(overdueOnly || staff || priority || category || status || q || range.preset !== 'All Time')}
        onReset={() => { setOverdueOnly(false); setStaff(''); setPriority(''); setCategory(''); setStatus(''); setQ(''); setRange(ALL_TIME); }}
      >
        <ToggleFilter label="Overdue Only" checked={overdueOnly} onChange={setOverdueOnly} />
        <SearchFilter value={q} onChange={setQ} placeholder="Task title…" />
        <FilterSelect label="Staff Member" value={staff} onChange={setStaff} all="All Staff" options={owners} />
        <FilterSelect label="Priority" value={priority} onChange={setPriority} all="All Priorities" options={['High', 'Medium', 'Low']} />
        <FilterSelect label="Category" value={category} onChange={setCategory} all="All Categories" options={TASK_CATEGORIES} />
        <FilterSelect label="Status" value={status} onChange={setStatus} all="All Statuses" options={['To Do', 'In Progress', 'Done']} />
        <DateRangeControl label="Task Date" value={range} onChange={setRange} />
      </FilterBar>
      <DataList
        rows={rows}
        rowKey={(t) => t.id}
        empty="No tasks match these filters."
        rowClass={(t) => (overdueDays(t, today) > 0 ? 'bg-red-50 text-red-700' : '')}
        columns={[
          { header: 'Task', cell: (t) => (
            <div className="max-w-md">
              <p className={`font-medium ${overdueDays(t, today) > 0 ? 'text-red-700' : 'text-navy'}`}>{t.title}</p>
              {t.notes && <p className="line-clamp-1 text-xs text-gray-400">{t.notes}</p>}
            </div>
          ) },
          { header: 'Category', cell: (t) => <Badge text={taskCategory(t)} cls="bg-slate-100 text-slate-700" /> },
          { header: 'Assigned To', cell: (t) => <span className="whitespace-nowrap">{taskOwner(t)}</span> },
          { header: 'Date', cell: (t) => <div className="whitespace-nowrap"><p>{dayLabel(t.date)}{t.dueTime ? ` · ${t.dueTime}` : ''}</p>{lateBadge(t)}</div> },
          { header: 'Priority', cell: (t) => <Badge text={t.priority} cls={PRIORITY_STYLES[t.priority]} /> },
          { header: 'Status', cell: (t) => <Badge text={t.status} cls={TASK_STATUS_STYLES[t.status]} /> },
          { header: '', right: true, cell: (t) => t.status !== 'Done' && (
            <button type="button" onClick={() => setReassign(t.id)} className="inline-flex items-center gap-1 text-sm font-medium text-navy hover:text-navy-light"><UserCog size={15} /> Reassign</button>
          ) },
        ]}
        card={(t) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className={`font-semibold ${overdueDays(t, today) > 0 ? 'text-red-700' : 'text-navy'}`}>{t.title}</p>
              <Badge text={t.priority} cls={PRIORITY_STYLES[t.priority]} />
            </div>
            <p className="text-xs text-gray-500">{taskCategory(t)} · {taskOwner(t)} · {dayLabel(t.date)}</p>
            <div className="flex flex-wrap items-center gap-2"><Badge text={t.status} cls={TASK_STATUS_STYLES[t.status]} />{lateBadge(t)}</div>
            {t.status !== 'Done' && <button type="button" onClick={() => setReassign(t.id)} className="text-sm font-medium text-navy">Reassign</button>}
          </div>
        )}
      />
      <button type="button" onClick={() => navigateApp('daily-tasks')} className="inline-flex items-center gap-1 text-xs font-medium text-navy-light hover:text-navy">
        Create or edit tasks on the Daily Task Board <ArrowRight size={12} />
      </button>
      {moving && <ReassignModal task={moving} onClose={() => setReassign(null)} />}
    </div>
  );
}

// ═══ 2. IT support ticketing ═════════════════════════════════════════════════
function ItTicketForm({ onClose }: { onClose: () => void }) {
  const { actions, flash } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<NewItTicket>({ category: 'CRM Issue', priority: 'Medium', subject: '', description: '', attachments: [] });
  const valid = f.subject.trim().length >= 4 && f.description.trim().length >= 10;
  return (
    <Modal title="Request IT Support" onClose={onClose} wide>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        actions.addItTicket({ ...f, subject: f.subject.trim(), description: f.description.trim() });
        flash('IT ticket raised — Head Office IT has been notified.');
        onClose();
      }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Issue Category" required>
            <SelectInput value={f.category} onChange={(v) => setF({ ...f, category: v as ItTicketCategory })} label="Issue Category">{IT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</SelectInput>
          </Field>
          <Field label="Priority" required>
            <div className="flex gap-1.5">
              {IT_PRIORITIES.map((p) => (
                <button key={p} type="button" onClick={() => setF({ ...f, priority: p as ItTicketPriority })}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${f.priority === p ? `border-transparent ${PRIORITY_STYLES[p]}` : 'border-grey-border text-gray-500 hover:bg-grey-bg'}`}>{p}</button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Subject" required>
          <TextInput value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="e.g. Receipt PDF shows the wrong branch address" />
        </Field>
        <Field label="Issue Description" required hint="What happens, since when, who is affected, what you’ve tried.">
          <TextArea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Screenshots / Attachments">
          <div className="space-y-2">
            <button type="button" onClick={() => input.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-grey-border px-4 py-4 text-sm font-medium text-navy transition-colors hover:border-navy-light">
              <Paperclip size={15} /> Attach screenshots or files
            </button>
            <input ref={input} type="file" multiple accept="image/*,application/pdf,.txt,.log" className="hidden"
              onChange={(e) => { const names = Array.from(e.target.files ?? []).map((x) => x.name); setF((p) => ({ ...p, attachments: [...new Set([...p.attachments, ...names])] })); e.target.value = ''; }} />
            {f.attachments.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {f.attachments.map((a) => (
                  <li key={a} className="inline-flex items-center gap-1.5 rounded-full bg-grey-bg px-2.5 py-1 text-xs font-medium text-navy">
                    {a}
                    <button type="button" aria-label={`Remove ${a}`} onClick={() => setF({ ...f, attachments: f.attachments.filter((x) => x !== a) })} className="text-gray-400 hover:text-red-600"><X size={12} /></button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-gray-400">File names are attached to the ticket; uploads are stored once file storage is connected.</p>
          </div>
        </Field>
        <div className="flex justify-end gap-2 border-t border-grey-border pt-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}><Send size={14} /> Submit Ticket</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function TicketDetail({ t, onClose }: { t: ItTicket; onClose: () => void }) {
  const { actions, flash } = useWorkspace();
  const [reopen, setReopen] = useState('');
  return (
    <Modal title={`${t.code} · ${t.subject}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge text={t.status} cls={IT_STATUS_STYLES[t.status]} />
          <Badge text={t.priority} cls={PRIORITY_STYLES[t.priority]} />
          <Badge text={t.category} cls="bg-slate-100 text-slate-700" />
          <StepTrack steps={IT_STATUSES} current={t.status} />
        </div>
        <p className="whitespace-pre-line rounded-lg border border-grey-border bg-grey-bg/50 p-3 text-sm text-gray-700">{t.description}</p>
        {t.attachments.length > 0 && <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500"><Paperclip size={12} /> {t.attachments.join(', ')}</p>}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-gray-400">Raised</dt><dd className="text-navy">{t.raisedBy} · {t.raisedAt}</dd></div>
          <div><dt className="text-xs text-gray-400">IT Engineer</dt><dd className="text-navy">{t.assignee ?? 'Not picked up yet'}</dd></div>
        </dl>
        {t.resolution && (
          <section className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <p className="text-xs font-semibold uppercase tracking-wide">Resolution notes</p>
            <p>{t.resolution}</p>
          </section>
        )}
        <section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">History</h4>
          <ol className="space-y-2 border-l-2 border-grey-border pl-4">
            {t.history.map((h, i) => <li key={i} className="text-sm"><p className="text-navy">{h.text}</p><p className="text-[11px] text-gray-400">{h.by} · {h.at}</p></li>)}
          </ol>
        </section>
        {t.status === 'Resolved' && (
          <section className="space-y-2 border-t border-grey-border pt-4">
            <Field label="Still not fixed? Reopen with a note">
              <TextArea rows={2} value={reopen} onChange={(e) => setReopen(e.target.value)} placeholder="What’s still happening?" />
            </Field>
            <div className="flex justify-end">
              <GhostButton onClick={() => { if (reopen.trim().length < 5) return; actions.reopenItTicket(t.id, reopen.trim()); flash(`${t.code} reopened.`); onClose(); }}>
                <RotateCcw size={14} /> Reopen Ticket
              </GhostButton>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

export function ItSupport() {
  const { data } = useWorkspace();
  const [form, setForm] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [q, setQ] = useState('');

  const tickets = data.store.itTickets;
  const rows = tickets
    .filter((t) => (!status || t.status === status) && (!category || t.category === category) && (!priority || t.priority === priority)
      && inRange(t.raisedAt, range) && (!q || `${t.code} ${t.subject}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => IT_STATUSES.indexOf(a.status) - IT_STATUSES.indexOf(b.status) || b.raisedAt.localeCompare(a.raisedAt));
  const viewing = tickets.find((t) => t.id === open);
  const highOpen = tickets.filter((t) => t.status !== 'Resolved' && t.priority === 'High').length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Open" value={tickets.filter((t) => t.status === 'Open').length} tone={tickets.some((t) => t.status === 'Open') ? 'amber' : undefined} />
        <Kpi label="In Progress" value={tickets.filter((t) => t.status === 'In Progress').length} />
        <Kpi label="Resolved" value={tickets.filter((t) => t.status === 'Resolved').length} tone="green" />
        <Kpi label="High Priority Active" value={highOpen} tone={highOpen ? 'red' : undefined} />
      </div>
      <SectionHeading
        title="My IT Tickets"
        hint="Requests to Head Office IT. Engineers update the status and add resolution notes."
        action={<PrimaryButton onClick={() => setForm(true)}><Plus size={15} /> Request IT Support</PrimaryButton>}
      />
      <FilterBar active={Boolean(status || category || priority || q || range.preset !== 'All Time')} onReset={() => { setStatus(''); setCategory(''); setPriority(''); setQ(''); setRange(ALL_TIME); }}>
        <SearchFilter value={q} onChange={setQ} placeholder="Ticket code or subject…" />
        <FilterSelect label="Status" value={status} onChange={setStatus} all="All Statuses" options={IT_STATUSES} />
        <FilterSelect label="Category" value={category} onChange={setCategory} all="All Categories" options={IT_CATEGORIES} />
        <FilterSelect label="Priority" value={priority} onChange={setPriority} all="All Priorities" options={IT_PRIORITIES} />
        <DateRangeControl label="Raised" value={range} onChange={setRange} />
      </FilterBar>
      <DataList
        rows={rows}
        rowKey={(t) => t.id}
        onRowClick={(t) => setOpen(t.id)}
        empty="No IT tickets match these filters."
        columns={[
          { header: 'Ticket', cell: (t) => <div className="max-w-sm"><p className="font-medium text-navy">{t.subject}</p><p className="text-xs text-gray-400">{t.code} · {t.category}</p></div> },
          { header: 'Priority', cell: (t) => <Badge text={t.priority} cls={PRIORITY_STYLES[t.priority]} /> },
          { header: 'Raised', cell: (t) => <span className="whitespace-nowrap text-gray-600">{dayLabel(t.raisedAt)}</span> },
          { header: 'Engineer', cell: (t) => <span className="text-gray-600">{t.assignee ?? '—'}</span> },
          { header: 'Status', cell: (t) => <div className="space-y-1.5"><Badge text={t.status} cls={IT_STATUS_STYLES[t.status]} /><StepTrack steps={IT_STATUSES} current={t.status} /></div> },
          { header: 'Resolution Notes', cell: (t) => <span className="line-clamp-2 block max-w-xs text-xs text-gray-500">{t.resolution ?? '—'}</span> },
        ]}
        card={(t) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2"><p className="font-semibold text-navy">{t.subject}</p><Badge text={t.status} cls={IT_STATUS_STYLES[t.status]} /></div>
            <p className="text-xs text-gray-400">{t.code} · {t.category} · {dayLabel(t.raisedAt)}</p>
            <Badge text={t.priority} cls={PRIORITY_STYLES[t.priority]} />
            {t.resolution && <p className="text-xs text-gray-500">{t.resolution}</p>}
          </div>
        )}
      />
      <p className="flex items-center gap-1.5 text-[11px] text-gray-400"><LifeBuoy size={11} /> Branch-level problems for your own staff (facility, service, HR) still go through Issue & Escalation Management.</p>
      {form && <ItTicketForm onClose={() => setForm(false)} />}
      {viewing && <TicketDetail t={viewing} onClose={() => setOpen(null)} />}
    </div>
  );
}
