import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X, CornerDownLeft } from 'lucide-react';
import { DailyTask, MockUser, StaffMember, StaffRole, TaskPriority, TaskStatus } from '../types';
import { ROLE_LABELS } from '../mockData';
import { dateKey, formatSubmittedAt } from '../dateTime';

interface DailyTaskBoardProps {
  /** Tasks for the current user's branch. */
  tasks: DailyTask[];
  currentUser: MockUser;
  /** Branch staff — assignee options when adding a task. */
  staff: StaffMember[];
  /** Branch Manager: can add, reassign and delete tasks, and update any task's status. */
  canManage: boolean;
  onAddTask: (task: DailyTask) => void;
  onUpdateTask: (id: string, updates: Partial<DailyTask>) => void;
  onDeleteTask: (id: string) => void;
  /** Open on this day (YYYY-MM-DD) instead of today — e.g. a task just created elsewhere. */
  initialDate?: string;
}

// ─── Daily run sheet ────────────────────────────────────────────────────────
// The day laid out like a printed shift sheet: a time rail down the left with each task on
// the hour it's due, "Anytime today" underneath, and done tasks left in place (struck
// through) so the shape of the day stays readable. One round mark per task cycles
// To Do → In Progress → Done. A second view lists the same day by person.

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = { 'To Do': 'In Progress', 'In Progress': 'Done', Done: 'To Do' };
const PRIORITY_BAR: Record<TaskPriority, string> = { High: 'bg-red-500', Medium: 'bg-amber-400', Low: 'bg-gray-300' };
const BRANCH_ROLES: (StaffRole | 'Anyone')[] = ['Anyone', 'Front Desk Officer', 'Counselor', 'V/A Officer', 'Branch Manager'];

/** "10:30 AM" → minutes after midnight (null when no time). */
function minutesOf(time?: string): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + parseInt(m[2], 10);
}

// <input type="time"> "14:30" → "2:30 PM"
function formatTime(value: string): string {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const hourLabel = (h: number) => `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;

function shiftDate(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Round status mark — empty, half-filled (in progress), filled with a tick (done). */
function StatusMark({ status, editable, onClick }: { status: TaskStatus; editable: boolean; onClick: () => void }) {
  const next = NEXT_STATUS[status];
  const body = (
    <svg viewBox="0 0 20 20" className="w-5 h-5" aria-hidden="true">
      <circle cx="10" cy="10" r="8.25" fill="none" strokeWidth="1.5" className={status === 'To Do' ? 'stroke-gray-300' : 'stroke-navy'} />
      {status === 'In Progress' && <path d="M10 1.75 A8.25 8.25 0 0 1 10 18.25 Z" className="fill-navy" />}
      {status === 'Done' && (
        <>
          <circle cx="10" cy="10" r="8.25" className="fill-navy" />
          <path d="M6 10.3l2.6 2.6L14 7.6" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
  if (!editable) return <span className="flex-shrink-0 opacity-60" title={status}>{body}</span>;
  return (
    <button type="button" onClick={onClick} title={`${status} — click to mark ${next}`} aria-label={`${status}. Mark ${next}`} className="flex-shrink-0 rounded-full hover:scale-110 transition-transform">
      {body}
    </button>
  );
}

export default function DailyTaskBoard({ tasks, currentUser, staff, canManage, onAddTask, onUpdateTask, onDeleteTask, initialDate }: DailyTaskBoardProps) {
  const today = dateKey(new Date());
  const [date, setDate] = useState(initialDate ?? today);
  const [scope, setScope] = useState<'mine' | 'all'>(canManage ? 'all' : 'mine');
  const [view, setView] = useState<'sheet' | 'people'>('sheet');
  const [draft, setDraft] = useState({ title: '', time: '', owner: 'Anyone', priority: 'Medium' as TaskPriority });

  const myRole = ROLE_LABELS[currentUser.role];
  // A task is someone's when it's assigned to them by name, or — with no named assignee — to
  // their role or to anyone in the branch. The manager can update everything.
  const isMine = (t: DailyTask) =>
    t.assignee ? t.assignee === currentUser.name : t.assignedRole === 'Anyone' || t.assignedRole === myRole;
  const canUpdate = (t: DailyTask) => canManage || isMine(t);
  const ownerOf = (t: DailyTask) => t.assignee ?? (t.assignedRole === 'Anyone' ? 'Anyone' : t.assignedRole);

  const dayTasks = useMemo(
    () => tasks.filter((t) => t.date === date).filter((t) => scope === 'all' || isMine(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, date, scope, currentUser.name, myRole]
  );

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const isLate = (t: DailyTask) => {
    if (t.status === 'Done') return false;
    if (t.date < today) return true;
    const due = minutesOf(t.dueTime);
    return t.date === today && due !== null && due < nowMinutes;
  };

  // Group timed tasks by hour; untimed ones go to "Anytime today".
  const { hours, anytime } = useMemo(() => {
    const byHour = new Map<number, DailyTask[]>();
    const untimed: DailyTask[] = [];
    dayTasks.forEach((t) => {
      const m = minutesOf(t.dueTime);
      if (m === null) untimed.push(t);
      else byHour.set(Math.floor(m / 60), [...(byHour.get(Math.floor(m / 60)) ?? []), t]);
    });
    byHour.forEach((list) => list.sort((a, b) => (minutesOf(a.dueTime) ?? 0) - (minutesOf(b.dueTime) ?? 0)));
    return { hours: [...byHour.entries()].sort((a, b) => a[0] - b[0]), anytime: untimed };
  }, [dayTasks]);

  const done = dayTasks.filter((t) => t.status === 'Done').length;
  const inProgress = dayTasks.filter((t) => t.status === 'In Progress').length;
  const late = dayTasks.filter(isLate).length;

  const cycle = (t: DailyTask) =>
    onUpdateTask(t.id, { status: NEXT_STATUS[t.status], updatedBy: currentUser.name, updatedAt: formatSubmittedAt(new Date()) });

  const ownerOptions = useMemo(() => {
    const people = staff.filter((s) => s.status === 'Active' && s.role !== 'Super Admin').map((s) => s.name);
    return [...BRANCH_ROLES, ...people];
  }, [staff]);

  const addDraft = () => {
    if (!draft.title.trim()) return;
    const person = staff.find((s) => s.name === draft.owner);
    onAddTask({
      id: `t${Date.now()}`,
      title: draft.title.trim(),
      branch: currentUser.branch,
      assignedRole: person ? person.role : (draft.owner as StaffRole | 'Anyone'),
      assignee: person?.name,
      date,
      dueTime: draft.time ? formatTime(draft.time) : undefined,
      priority: draft.priority,
      status: 'To Do',
      createdBy: currentUser.name,
    });
    setDraft({ ...draft, title: '', time: '' });
  };

  const dayLabel = new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const relative = date === today ? 'Today' : date === shiftDate(today, -1) ? 'Yesterday' : date === shiftDate(today, 1) ? 'Tomorrow' : '';

  const TaskLine = ({ t }: { t: DailyTask }) => {
    const editable = canUpdate(t);
    const lateNow = isLate(t);
    return (
      <div className="group relative flex items-start gap-3 py-2.5 pl-3 pr-2">
        <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${PRIORITY_BAR[t.priority]}`} title={`${t.priority} priority`} />
        <StatusMark status={t.status} editable={editable} onClick={() => cycle(t)} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-snug ${t.status === 'Done' ? 'text-gray-400 line-through decoration-gray-300' : 'text-navy'}`}>{t.title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            <span className="text-gray-500">{ownerOf(t)}</span>
            {t.status === 'In Progress' && <span className="text-navy"> · in progress</span>}
            {t.updatedBy && t.status !== 'To Do' && <span> · {t.status === 'Done' ? 'done' : 'started'} by {t.updatedBy}</span>}
            {t.notes && <span> · {t.notes}</span>}
          </p>
        </div>
        <span className={`text-xs tabular-nums flex-shrink-0 pt-0.5 ${lateNow ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
          {t.dueTime ?? ''}{lateNow ? ' · late' : ''}
        </span>
        {canManage && (
          <button type="button" onClick={() => onDeleteTask(t.id)} aria-label="Delete task" className="flex-shrink-0 pt-0.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-600">
            <X size={14} />
          </button>
        )}
      </div>
    );
  };

  // "By person" view: each owner's tasks for the day on one line.
  const people = useMemo(() => {
    const groups = new Map<string, DailyTask[]>();
    dayTasks.forEach((t) => groups.set(ownerOf(t), [...(groups.get(ownerOf(t)) ?? []), t]));
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [dayTasks]);

  const selectClass = 'appearance-none bg-transparent text-xs text-gray-500 hover:text-navy focus:outline-none cursor-pointer';

  return (
    <div className="max-w-4xl space-y-4">
      {/* Sheet header */}
      <div className="bg-white border border-grey-border rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-grey-border">
              <button type="button" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day" className="px-2 py-1.5 text-gray-500 hover:text-navy"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day" className="px-2 py-1.5 text-gray-500 hover:text-navy border-l border-grey-border"><ChevronRight size={16} /></button>
            </div>
            <div>
              <p className="text-base font-semibold text-navy leading-tight">{dayLabel}</p>
              <p className="text-xs text-gray-400">
                {relative && <span className="text-navy font-medium">{relative} · </span>}
                {currentUser.branch} branch
                {date !== today && <button type="button" onClick={() => setDate(today)} className="ml-2 text-navy-light hover:text-navy underline-offset-2 hover:underline">Back to today</button>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {(['mine', 'all'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setScope(s)} className={`pb-0.5 border-b-2 ${scope === s ? 'border-navy text-navy font-semibold' : 'border-transparent text-gray-400 hover:text-navy'}`}>
                {s === 'mine' ? 'My tasks' : 'Whole branch'}
              </button>
            ))}
            <span className="w-px h-4 bg-grey-border" />
            {(['sheet', 'people'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`pb-0.5 border-b-2 ${view === v ? 'border-navy text-navy font-semibold' : 'border-transparent text-gray-400 hover:text-navy'}`}>
                {v === 'sheet' ? 'Run sheet' : 'By person'}
              </button>
            ))}
          </div>
        </div>

        {/* Tally strip — one mark per task */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-grey-border px-5 py-3">
          <div className="flex flex-wrap gap-1" aria-label={`${done} of ${dayTasks.length} done`}>
            {dayTasks.length === 0 && <span className="text-xs text-gray-400">No tasks for this day</span>}
            {[...dayTasks]
              .sort((a, b) => ['Done', 'In Progress', 'To Do'].indexOf(a.status) - ['Done', 'In Progress', 'To Do'].indexOf(b.status))
              .map((t) => (
                <span key={t.id} title={t.title} className={`h-4 w-1.5 rounded-sm ${t.status === 'Done' ? 'bg-navy' : t.status === 'In Progress' ? 'bg-navy/40' : isLate(t) ? 'bg-red-200' : 'bg-gray-200'}`} />
              ))}
          </div>
          <p className="text-xs text-gray-500 tabular-nums">
            <span className="font-semibold text-navy">{done}</span> of {dayTasks.length} done
            {inProgress > 0 && <> · {inProgress} in progress</>}
            {late > 0 && <span className="text-red-600"> · {late} late</span>}
          </p>
        </div>
      </div>

      {view === 'sheet' ? (
        <div className="bg-white border border-grey-border rounded-xl overflow-hidden">
          {hours.map(([hour, list]) => (
            <div key={hour} className="grid grid-cols-[64px_1fr] border-b border-grey-border last:border-b-0">
              <div className={`px-3 py-3 text-xs font-medium tabular-nums border-r border-grey-border ${date === today && Math.floor(nowMinutes / 60) === hour ? 'text-navy bg-navy/5' : 'text-gray-400'}`}>
                {hourLabel(hour)}
              </div>
              <div className="divide-y divide-grey-border/70">
                {list.map((t) => <TaskLine key={t.id} t={t} />)}
              </div>
            </div>
          ))}
          {anytime.length > 0 && (
            <div className="grid grid-cols-[64px_1fr] border-b border-grey-border last:border-b-0">
              <div className="px-3 py-3 text-[11px] font-medium text-gray-400 border-r border-grey-border leading-tight">Any&shy;time</div>
              <div className="divide-y divide-grey-border/70">
                {anytime.map((t) => <TaskLine key={t.id} t={t} />)}
              </div>
            </div>
          )}
          {dayTasks.length === 0 && !canManage && (
            <p className="px-5 py-10 text-center text-sm text-gray-400">Nothing on the sheet for {relative ? relative.toLowerCase() : 'this day'}.</p>
          )}

          {/* Quick add — typed straight onto the sheet */}
          {canManage && (
            <div className="grid grid-cols-[64px_1fr] bg-grey-bg/60 border-t border-grey-border">
              <div className="px-2 py-2.5 border-r border-grey-border">
                <input
                  type="time"
                  value={draft.time}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                  aria-label="Due time"
                  className="w-full bg-transparent text-[11px] text-gray-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') addDraft(); }}
                  placeholder="Add a task to this day…"
                  className="flex-1 min-w-[180px] bg-transparent text-sm text-navy placeholder:text-gray-400 focus:outline-none"
                />
                <select value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} className={selectClass} aria-label="Owner">
                  {ownerOptions.map((o) => <option key={o} value={o}>{o === 'Anyone' ? 'Anyone in branch' : o}</option>)}
                </select>
                <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })} className={selectClass} aria-label="Priority">
                  {(['High', 'Medium', 'Low'] as TaskPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button
                  type="button"
                  onClick={addDraft}
                  disabled={!draft.title.trim()}
                  className="inline-flex items-center gap-1 rounded-md bg-navy px-2.5 py-1 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-30"
                >
                  <CornerDownLeft size={12} /> Add
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-grey-border rounded-xl divide-y divide-grey-border">
          {people.length === 0 && <p className="px-5 py-10 text-center text-sm text-gray-400">No tasks for this day.</p>}
          {people.map(([owner, list]) => {
            const ownerDone = list.filter((t) => t.status === 'Done').length;
            return (
              <div key={owner} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-x-4">
                <div className="px-5 pt-4 sm:pb-4">
                  <p className="text-sm font-semibold text-navy">{owner === 'Anyone' ? 'Anyone in branch' : owner}</p>
                  <p className="text-xs text-gray-400 tabular-nums">{ownerDone}/{list.length} done{list.some(isLate) ? <span className="text-red-600"> · {list.filter(isLate).length} late</span> : null}</p>
                </div>
                <div className="px-3 sm:px-0 sm:pr-3 py-1.5">
                  {list
                    .sort((a, b) => (minutesOf(a.dueTime) ?? 9999) - (minutesOf(b.dueTime) ?? 9999))
                    .map((t) => <TaskLine key={t.id} t={t} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Click a task’s circle to move it along: to do → in progress → done.{' '}
        {!canManage && 'You can update tasks assigned to you or your role.'}
        {canManage && ' The coloured edge shows priority (red high, amber medium, grey low).'}
      </p>
    </div>
  );
}
