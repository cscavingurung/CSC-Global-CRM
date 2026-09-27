import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, ChevronDown, Clock, Cpu, DoorClosed, DoorOpen, History, ListChecks, LogIn, LogOut, Moon, Sun, X,
} from 'lucide-react';
import {
  AttendanceCorrection, AttendanceRecord, BranchDayLog, BranchIssue, ChecklistMarkEntry, DailyTask, HandoverItem, Holiday, LeaveRecord, MockUser, NavIntent,
  StaffMember, TaskPriority,
} from '../types';
import {
  ATTENDANCE_STYLES, AutoCheck, CLOSING_CHECKLIST, CLOSING_FROM_HOUR, ChecklistGroup, ChecklistItem, LATE_LIMIT, OPENING_CHECKLIST,
  SHIFT_START_MINUTES, attendanceStatus, manualItems, minutesOfDay, timeOf,
} from '../branchOps';
import { NewIssueInput, buildIssue, isActive } from '../branchIssues';
import { applyCorrection, onLeave } from '../attendance';
import { holidayOn } from '../holidays';
import { ROLE_LABELS } from '../mockData';
import { dateKey, formatSubmittedAt } from '../dateTime';
import { ReportIssueModal } from './IssueEscalationCenter';
import { PriorityBadge, StatusBadge } from './IssueDetail';

// ─── Branch Operations Control ──────────────────────────────────────────────
// The branch's daily operating cycle on one page: who's in, the opening checklist, and the
// closing checklist with a next-day handover. A failed opening item raises an Issue; the
// handover turns pending items into tomorrow's Daily Task Board tasks.

interface BranchOperationsControlProps {
  currentUser: MockUser;
  /** Branch staff. */
  staff: StaffMember[];
  attendance: AttendanceRecord[];
  corrections: AttendanceCorrection[];
  dayLogs: BranchDayLog[];
  /** Leave requests — approved leave today isn't an attendance exception. */
  leave: LeaveRecord[];
  /** Branch holidays — on a holiday nobody is flagged for not checking in. */
  holidays: Holiday[];
  issues: BranchIssue[];
  tasks: DailyTask[];
  /** Client follow-ups due today or overdue in this branch. */
  clientFollowUpsDue: number;
  onSaveAttendance: (record: AttendanceRecord) => void;
  onAddCorrection: (correction: AttendanceCorrection) => void;
  onUpdateCorrection: (id: string, updates: Partial<AttendanceCorrection>) => void;
  onSaveDayLog: (log: BranchDayLog) => void;
  onAddIssue: (issue: BranchIssue) => void;
  onAddTask: (task: DailyTask) => void;
  onNavigate: (key: string, intent?: NavIntent) => void;
}

type AutoResult = { ok: boolean; text: string };

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40';
const secondaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-grey-border px-3 py-2 text-sm font-medium text-navy hover:border-navy-light hover:bg-grey-bg';

// <input type="time"> "18:10" → "6:10 PM"
const formatTime = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return Number.isNaN(h) ? value : `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const shiftDay = (key: string, days: number) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateKey(d);
};

const dayLabel = (key: string, today: string) =>
  key === today ? 'today' : key === shiftDay(today, -1) ? 'yesterday'
    : new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function Panel({ icon, title, subtitle, now, open, onToggle, children }: {
  icon: React.ReactNode; title: string; subtitle: React.ReactNode; now?: boolean; open: boolean; onToggle?: () => void; children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border bg-white ${now ? 'border-navy-light/50' : 'border-grey-border'}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left disabled:cursor-default"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-navy">{title}</span>
            {now && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Now</span>}
          </span>
          <span className="block text-xs text-gray-500">{subtitle}</span>
        </span>
        {onToggle && <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && <div className="border-t border-grey-border">{children}</div>}
    </section>
  );
}

/** One checklist row — manual items get ✓ / ✗, auto items show what the system found. */
function ChecklistRow({ item, entry, auto, allowFail, onMark, issue, onOpenIssue, onReport }: {
  item: ChecklistItem;
  entry?: ChecklistMarkEntry;
  auto?: AutoResult;
  allowFail: boolean;
  onMark: (state: 'ok' | 'fail' | null) => void;
  issue?: BranchIssue;
  onOpenIssue: (id: string) => void;
  onReport: () => void;
}) {
  if (item.auto && auto) {
    return (
      <li className="flex items-center gap-3 bg-grey-bg/50 px-5 py-2.5">
        <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${auto.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          {auto.ok ? <Check size={14} /> : <AlertTriangle size={13} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-navy">{item.label}: <span className={auto.ok ? 'text-emerald-700' : 'text-amber-700'}>{auto.text}</span></span>
        </span>
        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-500" title="Checked automatically by the system">
          <Cpu size={11} /> Auto
        </span>
      </li>
    );
  }
  const state = entry?.state;
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5 ${state === 'fail' ? 'bg-red-50/40' : ''}`}>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${state === 'ok' ? 'text-gray-500' : 'text-navy'}`}>{item.label}</span>
        {entry && <span className="block text-[11px] text-gray-400">{entry.by} · {timeOf(entry.at)}</span>}
      </span>
      {state === 'fail' && (
        issue ? (
          <button
            type="button"
            onClick={() => onOpenIssue(issue.id)}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:border-red-300"
            title="Open in Issue & Escalation Management"
          >
            {issue.code} · {issue.status} <ArrowRight size={12} />
          </button>
        ) : (
          <button type="button" onClick={onReport} className="text-xs font-semibold text-red-700 hover:underline">Report issue</button>
        )
      )}
      <span className="flex flex-shrink-0 gap-1.5">
        <button
          type="button"
          onClick={() => onMark(state === 'ok' ? null : 'ok')}
          aria-pressed={state === 'ok'}
          aria-label={`${item.label}: OK`}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${state === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-grey-border text-gray-400 hover:border-emerald-300 hover:text-emerald-600'}`}
        >
          <Check size={16} />
        </button>
        {allowFail && (
          <button
            type="button"
            onClick={() => onMark(state === 'fail' ? null : 'fail')}
            aria-pressed={state === 'fail'}
            aria-label={`${item.label}: not OK — report an issue`}
            title="Not OK — raises an issue"
            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${state === 'fail' ? 'border-red-300 bg-red-50 text-red-700' : 'border-grey-border text-gray-400 hover:border-red-300 hover:text-red-600'}`}
          >
            <X size={16} />
          </button>
        )}
      </span>
    </li>
  );
}

export default function BranchOperationsControl({
  currentUser, staff, attendance, corrections, dayLogs, leave, holidays, issues, tasks, clientFollowUpsDue,
  onSaveAttendance, onAddCorrection, onUpdateCorrection, onSaveDayLog, onAddIssue, onAddTask, onNavigate,
}: BranchOperationsControlProps) {
  // Re-render every minute so late flags and the morning/evening switch follow the clock.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const today = dateKey(now);
  const tomorrow = shiftDay(today, 1);
  const isManager = currentUser.role === 'branch_manager';

  const team = useMemo(() => staff.filter((s) => s.status === 'Active' && s.role !== 'Super Admin'), [staff]);
  const recordFor = (name: string, date: string) => attendance.find((r) => r.staffName === name && r.date === date);

  // ── Attendance facts ─────────────────────────────────────────────────────
  const todayRecords = team.map((s) => ({ member: s, record: recordFor(s.name, today) }));
  const present = todayRecords.filter((x) => x.record?.checkIn);
  const lateOnes = present.filter((x) => {
    const st = attendanceStatus(x.record!.checkIn!);
    return st === 'Late' || st === 'Very Late';
  });
  const pastCutoff = minutesOfDay(now) > SHIFT_START_MINUTES + LATE_LIMIT;
  const leaveToday = todayRecords.filter((x) => !x.record?.checkIn && onLeave(leave, x.member.name, today));
  const todayHoliday = holidayOn(holidays, today);
  const notIn = todayHoliday ? [] : todayRecords.filter((x) => !x.record?.checkIn && !onLeave(leave, x.member.name, today));
  const stillIn = present.filter((x) => !x.record?.checkOut);
  const previousDay = useMemo(
    () => attendance.map((r) => r.date).filter((d) => d < today).sort().pop(),
    [attendance, today]
  );
  const missingOut = previousDay
    ? attendance.filter((r) => r.date === previousDay && r.checkIn && !r.checkOut && team.some((s) => s.name === r.staffName))
    : [];
  const pendingCorrections = corrections.filter((c) => c.status === 'Pending');
  const correctionFor = (name: string, date: string, field: AttendanceCorrection['field']) =>
    corrections.filter((c) => c.staffName === name && c.date === date && c.field === field).pop();

  // ── Day log ──────────────────────────────────────────────────────────────
  const log: BranchDayLog = dayLogs.find((l) => l.date === today) ?? {
    id: `day-${currentUser.branch}-${today}`, branch: currentUser.branch, date: today, opening: {}, closing: {}, handover: [],
  };
  const saveLog = (patch: Partial<BranchDayLog>) => onSaveDayLog({ ...log, ...patch });
  const opened = !!log.openedAt;
  const closed = !!log.closedAt;

  const activeIssues = issues.filter(isActive);
  const criticalIssues = activeIssues.filter((i) => i.priority === 'Critical');
  const todayTasks = tasks.filter((t) => t.date === today);
  const openTasks = todayTasks.filter((t) => t.status !== 'Done');

  const autoResult = (auto: AutoCheck): AutoResult => {
    switch (auto) {
      case 'crm': {
        const it = criticalIssues.filter((i) => i.category === 'IT/System').length;
        return it ? { ok: false, text: `Connected · ${it} critical IT issue${it === 1 ? '' : 's'} open` } : { ok: true, text: 'Connected' };
      }
      case 'staff-present':
        return { ok: present.length >= Math.ceil(team.length * 0.75), text: `${present.length}/${team.length}` };
      case 'tasks-assigned':
        return todayTasks.length ? { ok: true, text: `${todayTasks.length} on the Daily Task Board` } : { ok: false, text: 'Nothing on today’s board' };
      case 'tasks-reviewed':
        return openTasks.length ? { ok: false, text: `${openTasks.length} of ${todayTasks.length} not done` } : { ok: true, text: `All ${todayTasks.length} done` };
      case 'staff-checked-out':
        return stillIn.length ? { ok: false, text: `${stillIn.length} still checked in` } : { ok: true, text: 'Everyone has checked out' };
    }
  };

  const openingManual = manualItems(OPENING_CHECKLIST);
  const openingAnswered = openingManual.filter((i) => log.opening[i.id]).length;
  const openingFailed = openingManual.filter((i) => log.opening[i.id]?.state === 'fail');
  const closingManual = manualItems(CLOSING_CHECKLIST);
  const closingDone = closingManual.filter((i) => log.closing[i.id]?.state === 'ok').length;
  const closingAutosOk = CLOSING_CHECKLIST.flatMap((g) => g.items).filter((i) => i.auto).every((i) => autoResult(i.auto!).ok);
  const closingComplete = closingDone === closingManual.length && closingAutosOk;

  // ── Status banner ────────────────────────────────────────────────────────
  const status = closed ? 'CLOSED' : !opened ? 'NOT OPEN' : openingFailed.length || criticalIssues.length ? 'OPEN WITH ISSUES' : 'OPEN';
  const bannerTone = {
    CLOSED: { box: 'border-grey-border bg-white', dot: 'bg-gray-400', text: 'text-gray-600' },
    'NOT OPEN': { box: 'border-red-200 bg-red-50/50', dot: 'bg-red-500', text: 'text-red-700' },
    'OPEN WITH ISSUES': { box: 'border-amber-200 bg-amber-50/50', dot: 'bg-amber-500', text: 'text-amber-700' },
    OPEN: { box: 'border-emerald-200 bg-emerald-50/50', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  }[status];

  // ── Panels open by time of day ───────────────────────────────────────────
  const phase: 'opening' | 'day' | 'closing' = !opened ? 'opening' : closed || now.getHours() >= CLOSING_FROM_HOUR ? 'closing' : 'day';
  const [openingOpen, setOpeningOpen] = useState<boolean | null>(null);
  const [closingOpen, setClosingOpen] = useState<boolean | null>(null);
  const [showAllStaff, setShowAllStaff] = useState(false);

  // ── Issue raised from a failed checklist item ────────────────────────────
  const [reportFor, setReportFor] = useState<ChecklistItem | null>(null);
  const mark = (item: ChecklistItem, state: 'ok' | 'fail' | null, list: 'opening' | 'closing') => {
    const current = { ...log[list] };
    if (state === null) delete current[item.id];
    else current[item.id] = { state, by: currentUser.name, at: formatSubmittedAt(new Date()), issueId: state === 'fail' ? current[item.id]?.issueId : undefined };
    saveLog({ [list]: current });
    if (state === 'fail' && item.issue && !current[item.id]?.issueId) setReportFor(item);
  };
  const submitIssue = (input: NewIssueInput) => {
    if (!reportFor) return;
    const issue = buildIssue(input, currentUser, ROLE_LABELS[currentUser.role], issues, formatSubmittedAt(new Date()));
    onAddIssue(issue);
    const entry = log.opening[reportFor.id] ?? { state: 'fail' as const, by: currentUser.name, at: formatSubmittedAt(new Date()) };
    saveLog({ opening: { ...log.opening, [reportFor.id]: { ...entry, issueId: issue.id } } });
    setReportFor(null);
  };
  const openIssue = (id: string) => onNavigate('issues-escalations', { openIssueId: id });

  // ── My attendance ────────────────────────────────────────────────────────
  const mine = recordFor(currentUser.name, today);
  const myStatus = mine?.checkIn ? attendanceStatus(mine.checkIn) : null;
  const checkIn = () =>
    onSaveAttendance({ id: `att-${Date.now()}`, staffName: currentUser.name, branch: currentUser.branch, date: today, checkIn: formatSubmittedAt(new Date()) });
  const checkOut = () => mine && onSaveAttendance({ ...mine, checkOut: formatSubmittedAt(new Date()) });

  const [correcting, setCorrecting] = useState(false);
  const myMissingOut = missingOut.find((r) => r.staffName === currentUser.name);
  const [corr, setCorr] = useState({ date: previousDay ?? today, field: 'checkOut' as AttendanceCorrection['field'], time: '18:00', reason: '' });
  const submitCorrection = () => {
    if (!corr.reason.trim() || !corr.time) return;
    onAddCorrection({
      id: `corr-${Date.now()}`, staffName: currentUser.name, branch: currentUser.branch, date: corr.date, field: corr.field,
      requestedTime: formatTime(corr.time), reason: corr.reason.trim(), requestedAt: formatSubmittedAt(new Date()), status: 'Pending',
    });
    setCorrecting(false);
    setCorr({ ...corr, reason: '' });
  };
  const myCorrections = corrections.filter((c) => c.staffName === currentUser.name).slice(-3).reverse();

  const decide = (c: AttendanceCorrection, approve: boolean) => {
    const at = formatSubmittedAt(new Date());
    onUpdateCorrection(c.id, { status: approve ? 'Approved' : 'Rejected', decidedBy: currentUser.name, decidedAt: at });
    if (!approve) return;
    // Amends the day's single record — original punches are kept, the change is appended.
    onSaveAttendance(applyCorrection(recordFor(c.staffName, c.date), c, currentUser.name, at));
  };

  // ── Handover ─────────────────────────────────────────────────────────────
  const [handoverOpen, setHandoverOpen] = useState(false);
  const managerName = team.find((s) => s.role === 'Branch Manager')?.name ?? currentUser.name;
  const firstOf = (role: StaffMember['role']) => team.find((s) => s.role === role)?.name ?? managerName;

  type Candidate = { id: string; label: string; owner: string; priority: TaskPriority; hint: string };
  const candidates: Candidate[] = useMemo(() => {
    const list: Candidate[] = [];
    if (clientFollowUpsDue > 0)
      list.push({ id: 'followups', label: `${clientFollowUpsDue} client follow-up${clientFollowUpsDue === 1 ? '' : 's'} due`, owner: firstOf('Counselor'), priority: 'High', hint: 'Clients' });
    [...activeIssues]
      .sort((a, b) => ['Critical', 'High', 'Normal'].indexOf(a.priority) - ['Critical', 'High', 'Normal'].indexOf(b.priority))
      .forEach((i) => list.push({
        id: `issue-${i.id}`,
        label: `Chase ${i.code}: ${i.title}`,
        owner: team.some((s) => s.name === i.owner) ? i.owner! : managerName,
        priority: i.priority === 'Normal' ? 'Medium' : 'High',
        hint: `${i.priority} issue`,
      }));
    openTasks.forEach((t) => list.push({ id: `task-${t.id}`, label: `Carry over: ${t.title}`, owner: t.assignee ?? managerName, priority: t.priority, hint: 'Unfinished task' }));
    closingManual.filter((i) => log.closing[i.id]?.state !== 'ok').forEach((i) =>
      list.push({ id: `close-${i.id}`, label: `Check at opening: ${i.label.toLowerCase()}`, owner: firstOf('Front Desk Officer'), priority: 'Medium', hint: 'Closing item' }));
    if (pendingCorrections.length)
      list.push({ id: 'corrections', label: `Review ${pendingCorrections.length} attendance correction request${pendingCorrections.length === 1 ? '' : 's'}`, owner: managerName, priority: 'Medium', hint: 'Attendance' });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientFollowUpsDue, issues, tasks, log.closing, corrections, team]);

  const [owners, setOwners] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const ownerOf = (c: Candidate) => owners[c.id] ?? c.owner;

  const closeBranch = () => {
    const at = formatSubmittedAt(new Date());
    const handover: HandoverItem[] = candidates.filter((c) => !skipped.has(c.id)).map((c, i) => {
      const taskId = `t${Date.now()}-${i}`;
      const person = team.find((s) => s.name === ownerOf(c));
      onAddTask({
        id: taskId,
        title: c.label,
        notes: `Handover from ${today} closing`,
        branch: currentUser.branch,
        assignedRole: person ? person.role : 'Anyone',
        assignee: person?.name,
        date: tomorrow,
        dueTime: '9:30 AM',
        priority: c.priority,
        status: 'To Do',
        createdBy: currentUser.name,
      });
      return { id: `ho-${Date.now()}-${i}`, label: c.label, owner: ownerOf(c), taskId };
    });
    saveLog({ closedAt: at, closedBy: currentUser.name, closedWithPending: candidates.length, handover });
    setHandoverOpen(false);
  };

  const renderChecklist = (groups: ChecklistGroup[], list: 'opening' | 'closing') => (
    <div className="divide-y divide-grey-border">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="bg-white px-5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.label}</p>
          <ul className="divide-y divide-grey-border/70">
            {g.items.map((item) => {
              const entry = log[list][item.id];
              return (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  entry={entry}
                  auto={item.auto ? autoResult(item.auto) : undefined}
                  allowFail={list === 'opening' && !!item.issue && !closed}
                  onMark={(state) => !closed && mark(item, state, list)}
                  issue={entry?.issueId ? issues.find((i) => i.id === entry.issueId) : undefined}
                  onOpenIssue={openIssue}
                  onReport={() => setReportFor(item)}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  // ── Exceptions (manager) ─────────────────────────────────────────────────
  type Exception = { key: string; who: string; role: string; text: string; tone: 'red' | 'amber'; action?: React.ReactNode };
  const exceptions: Exception[] = [
    ...lateOnes.map(({ member, record }) => {
      const st = attendanceStatus(record!.checkIn!)!;
      return { key: `late-${member.id}`, who: member.name, role: member.role, text: `${st} — checked in ${timeOf(record!.checkIn)}`, tone: st === 'Very Late' ? 'red' as const : 'amber' as const };
    }),
    ...(pastCutoff ? notIn.map(({ member }) => ({ key: `absent-${member.id}`, who: member.name, role: member.role, text: 'Not checked in yet', tone: 'red' as const })) : []),
    ...missingOut.map((r) => {
      const member = team.find((s) => s.name === r.staffName);
      const c = correctionFor(r.staffName, r.date, 'checkOut');
      return {
        key: `missing-${r.id}`,
        who: r.staffName,
        role: member?.role ?? '',
        text: `Missing check-out ${dayLabel(r.date, today)}${c?.status === 'Pending' ? ` · correction requested: ${c.requestedTime}` : ''}`,
        tone: 'amber' as const,
        action: c?.status === 'Pending' && isManager ? (
          <span className="flex gap-1.5">
            <button type="button" onClick={() => decide(c, false)} className="rounded-md border border-grey-border px-2 py-1 text-xs font-medium text-gray-600 hover:border-red-300 hover:text-red-700">Reject</button>
            <button type="button" onClick={() => decide(c, true)} className="rounded-md bg-navy px-2 py-1 text-xs font-semibold text-white hover:bg-navy-light">Approve {c.requestedTime}</button>
          </span>
        ) : undefined,
      };
    }),
    // Correction requests not already shown against a missing check-out.
    ...pendingCorrections
      .filter((c) => !missingOut.some((r) => r.staffName === c.staffName && r.date === c.date && c.field === 'checkOut'))
      .map((c) => ({
        key: `corr-${c.id}`,
        who: c.staffName,
        role: team.find((s) => s.name === c.staffName)?.role ?? '',
        text: `Requests ${c.field === 'checkOut' ? 'check-out' : 'check-in'} ${c.requestedTime} for ${dayLabel(c.date, today)} — “${c.reason}”`,
        tone: 'amber' as const,
        action: isManager ? (
          <span className="flex gap-1.5">
            <button type="button" onClick={() => decide(c, false)} className="rounded-md border border-grey-border px-2 py-1 text-xs font-medium text-gray-600 hover:border-red-300 hover:text-red-700">Reject</button>
            <button type="button" onClick={() => decide(c, true)} className="rounded-md bg-navy px-2 py-1 text-xs font-semibold text-white hover:bg-navy-light">Approve</button>
          </span>
        ) : undefined,
      })),
  ];

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <section className={`rounded-xl border px-5 py-4 ${bannerTone.box}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="relative flex h-4 w-4">
              {status !== 'CLOSED' && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${bannerTone.dot}`} />}
              <span className={`relative inline-flex h-4 w-4 rounded-full ${bannerTone.dot}`} />
            </span>
            <div>
              <p className={`text-lg font-bold tracking-wide ${bannerTone.text}`}>{status}</p>
              <p className="text-xs text-gray-500">
                {currentUser.branch} branch ·{' '}
                {closed ? <>closed {timeOf(log.closedAt)} by {log.closedBy}</>
                  : opened ? <>opened {timeOf(log.openedAt)} by {log.openedBy}</>
                    : <>opening checklist {openingAnswered}/{openingManual.length}</>}
              </p>
            </div>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 sm:ml-auto">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Staff present</dt>
              <dd className="text-base font-semibold tabular-nums text-navy">{present.length}/{team.length}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Critical issues</dt>
              <dd className={`text-base font-semibold tabular-nums ${criticalIssues.length ? 'text-red-600' : 'text-navy'}`}>{criticalIssues.length}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Opening failures</dt>
              <dd className={`text-base font-semibold tabular-nums ${openingFailed.length ? 'text-amber-600' : 'text-navy'}`}>{openingFailed.length}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Time</dt>
              <dd className="text-base font-semibold tabular-nums text-navy">{timeOf(formatSubmittedAt(now))}</dd>
            </div>
          </dl>
        </div>
        {(criticalIssues.length > 0 || openingFailed.length > 0) && !closed && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-amber-200/60 pt-3">
            {criticalIssues.map((i) => (
              <button key={i.id} type="button" onClick={() => openIssue(i.id)} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:border-red-300">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {i.code} · {i.title} <ArrowRight size={12} />
              </button>
            ))}
            {openingFailed.map((item) => (
              <span key={item.id} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-700">
                <X size={12} /> {item.label}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 1 — Attendance & exceptions */}
      <Panel icon={<Clock size={18} />} title="Today’s Attendance & Exceptions" subtitle={`${present.length} present · ${lateOnes.length} late · ${exceptions.length} exception${exceptions.length === 1 ? '' : 's'}`} open>
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* My attendance */}
          <div className="space-y-3 border-b border-grey-border px-5 py-4 lg:border-b-0 lg:border-r">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">My attendance</p>
            {!mine?.checkIn ? (
              <button type="button" onClick={checkIn} className={`${primaryBtn} w-full py-3 text-base`}>
                <LogIn size={18} /> CHECK IN
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-navy">In at <span className="font-semibold tabular-nums">{timeOf(mine.checkIn)}</span></span>
                  {myStatus && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ATTENDANCE_STYLES[myStatus]}`}>{myStatus}</span>}
                </div>
                {mine.checkOut ? (
                  <p className="text-sm text-navy">Out at <span className="font-semibold tabular-nums">{timeOf(mine.checkOut)}</span></p>
                ) : (
                  <button type="button" onClick={checkOut} className={`${secondaryBtn} w-full py-3 text-base font-semibold`}>
                    <LogOut size={18} /> CHECK OUT
                  </button>
                )}
              </>
            )}
            {myMissingOut && !correctionFor(currentUser.name, myMissingOut.date, 'checkOut') && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">You didn’t check out {dayLabel(myMissingOut.date, today)}.</p>
            )}
            {!correcting ? (
              <button type="button" onClick={() => setCorrecting(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-light hover:text-navy">
                <History size={13} /> Request Correction
              </button>
            ) : (
              <div className="dissolve-in space-y-2 rounded-lg border border-grey-border p-3">
                <p className="text-xs text-gray-500">Records can’t be edited directly — your manager approves the change and it’s logged.</p>
                <div className="grid grid-cols-2 gap-2">
                  <select value={corr.date} onChange={(e) => setCorr({ ...corr, date: e.target.value })} className={inputClass} aria-label="Day">
                    {[today, shiftDay(today, -1), shiftDay(today, -2)].map((d) => <option key={d} value={d}>{dayLabel(d, today)}</option>)}
                  </select>
                  <select value={corr.field} onChange={(e) => setCorr({ ...corr, field: e.target.value as AttendanceCorrection['field'] })} className={inputClass} aria-label="Which time">
                    <option value="checkOut">Check-out</option>
                    <option value="checkIn">Check-in</option>
                  </select>
                </div>
                <input type="time" value={corr.time} onChange={(e) => setCorr({ ...corr, time: e.target.value })} className={inputClass} aria-label="Correct time" />
                <input value={corr.reason} onChange={(e) => setCorr({ ...corr, reason: e.target.value })} placeholder="Reason (required)" className={inputClass} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCorrecting(false)} className={`${secondaryBtn} flex-1`}>Cancel</button>
                  <button type="button" onClick={submitCorrection} disabled={!corr.reason.trim()} className={`${primaryBtn} flex-1 py-2`}>Send request</button>
                </div>
              </div>
            )}
            {myCorrections.length > 0 && (
              <ul className="space-y-1">
                {myCorrections.map((c) => (
                  <li key={c.id} className="text-[11px] text-gray-500">
                    {c.field === 'checkOut' ? 'Check-out' : 'Check-in'} {c.requestedTime}, {dayLabel(c.date, today)} ·{' '}
                    <span className={c.status === 'Approved' ? 'text-emerald-700' : c.status === 'Rejected' ? 'text-red-700' : 'text-amber-700'}>{c.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Manager summary + exceptions */}
          <div className="px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Present', value: `${present.length}/${team.length}`, tone: 'bg-navy/5 text-navy' },
                { label: 'On time', value: present.length - lateOnes.length, tone: 'bg-emerald-50 text-emerald-700' },
                { label: 'Late', value: lateOnes.length, tone: lateOnes.length ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500' },
                { label: pastCutoff ? 'Absent' : 'Not in yet', value: notIn.length, tone: notIn.length && pastCutoff ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500' },
                { label: 'Missing check-out', value: missingOut.length, tone: missingOut.length ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500' },
                { label: 'On leave', value: leaveToday.length, tone: leaveToday.length ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500' },
              ].map((s) => (
                <span key={s.label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${s.tone}`}>
                  {s.label} <span className="font-semibold tabular-nums">{s.value}</span>
                </span>
              ))}
            </div>

            <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Attendance exceptions</p>
            {exceptions.length === 0 ? (
              <p className="rounded-lg border border-grey-border px-4 py-3 text-sm text-gray-400">No exceptions — everyone is on time.</p>
            ) : (
              <ul className="divide-y divide-grey-border rounded-lg border border-grey-border">
                {exceptions.map((e) => (
                  <li key={e.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${e.tone === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-navy">{e.role ? `${e.role} ${e.who}` : e.who}</span>
                      <span className="text-gray-500">: {e.text}</span>
                    </span>
                    {e.action}
                  </li>
                ))}
              </ul>
            )}

            <button type="button" onClick={() => setShowAllStaff((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-navy-light hover:text-navy">
              {showAllStaff ? 'Hide' : 'View'} all staff <ChevronDown size={13} className={showAllStaff ? 'rotate-180' : ''} />
            </button>
            {showAllStaff && (
              <table className="dissolve-in mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                    <th className="py-1.5 font-semibold">Staff</th><th className="py-1.5 font-semibold">In</th><th className="py-1.5 font-semibold">Out</th><th className="py-1.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayRecords.map(({ member, record }) => {
                    const st = record?.checkIn ? attendanceStatus(record.checkIn) : null;
                    return (
                      <tr key={member.id} className="border-t border-grey-border">
                        <td className="py-2">
                          <span className="text-navy">{member.name}</span> <span className="text-[11px] text-gray-400">{member.role}</span>
                          {record?.amendments?.length ? <p className="text-[11px] text-gray-400">Corrected · approved by {record.amendments[record.amendments.length - 1].approvedBy}</p> : null}
                        </td>
                        <td className="py-2 tabular-nums text-gray-600">{timeOf(record?.checkIn) || '—'}</td>
                        <td className="py-2 tabular-nums text-gray-600">{timeOf(record?.checkOut) || '—'}</td>
                        <td className="py-2">
                          {st ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ATTENDANCE_STYLES[st]}`}>{st}</span>
                            : onLeave(leave, member.name, today) ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">On leave</span>
                              : <span className="text-xs text-gray-400">Not in</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        {/* 2 — Opening checklist */}
        <Panel
          icon={<Sun size={18} />}
          title="Morning: Opening Checklist"
          subtitle={opened ? `Opened ${timeOf(log.openedAt)} by ${log.openedBy}${openingFailed.length ? ` · ${openingFailed.length} failed` : ''}` : `${openingAnswered} of ${openingManual.length} checked`}
          now={phase === 'opening'}
          open={openingOpen ?? phase === 'opening'}
          onToggle={() => setOpeningOpen(!(openingOpen ?? phase === 'opening'))}
        >
          <p className="flex items-center gap-2 px-5 pt-3 text-xs text-gray-500">
            Tick <Check size={12} className="text-emerald-600" /> when fine. <X size={12} className="text-red-600" /> opens a pre-filled issue report. <Cpu size={12} className="text-gray-400" /> items check themselves.
          </p>
          {renderChecklist(OPENING_CHECKLIST, 'opening')}
          {!opened && (
            <div className="border-t border-grey-border px-5 py-4">
              <button
                type="button"
                onClick={() => saveLog({ openedAt: formatSubmittedAt(new Date()), openedBy: currentUser.name })}
                disabled={openingAnswered < openingManual.length}
                className={`${primaryBtn} w-full py-3`}
              >
                <DoorOpen size={18} /> MARK BRANCH OPEN
              </button>
              {openingAnswered < openingManual.length && (
                <p className="mt-2 text-center text-xs text-gray-400">{openingManual.length - openingAnswered} item{openingManual.length - openingAnswered === 1 ? '' : 's'} still to check</p>
              )}
            </div>
          )}
        </Panel>

        {/* 3 — Closing checklist & handover */}
        <Panel
          icon={<Moon size={18} />}
          title="Evening: Closing Checklist & Handover"
          subtitle={closed ? `Closed ${timeOf(log.closedAt)} · ${log.handover.length} item${log.handover.length === 1 ? '' : 's'} handed over` : !opened ? 'Available once the branch is open' : `${closingDone} of ${closingManual.length} checked · usually from ${CLOSING_FROM_HOUR - 12} PM`}
          now={phase === 'closing' && !closed}
          open={(closingOpen ?? phase === 'closing') && opened}
          onToggle={opened ? () => setClosingOpen(!(closingOpen ?? phase === 'closing')) : undefined}
        >
          {renderChecklist(CLOSING_CHECKLIST, 'closing')}

          {!closed && !handoverOpen && (
            <div className="space-y-2 border-t border-grey-border px-5 py-4">
              <button type="button" onClick={() => setHandoverOpen(true)} className={`${primaryBtn} w-full py-3`}>
                <DoorClosed size={18} /> {closingComplete ? 'Close Branch' : 'Close Branch with Pending Items'}
              </button>
              <p className="text-center text-xs text-gray-400">You’ll review the next-day handover before closing.</p>
            </div>
          )}

          {!closed && handoverOpen && (
            <div className="dissolve-in border-t border-grey-border">
              <div className="flex items-center justify-between px-5 pt-4">
                <div>
                  <p className="text-sm font-semibold text-navy">Next-Day Handover</p>
                  <p className="text-xs text-gray-500">Each item becomes a task on tomorrow’s Daily Task Board for its owner.</p>
                </div>
                <button type="button" onClick={() => setHandoverOpen(false)} aria-label="Back" className="text-gray-400 hover:text-navy"><X size={16} /></button>
              </div>
              {candidates.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">Nothing pending — a clean close.</p>
              ) : (
                <ul className="mt-3 divide-y divide-grey-border border-y border-grey-border">
                  {candidates.map((c) => {
                    const included = !skipped.has(c.id);
                    return (
                      <li key={c.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 ${included ? '' : 'opacity-50'}`}>
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => setSkipped((prev) => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                          aria-label={`Hand over: ${c.label}`}
                          className="h-4 w-4 accent-navy"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-navy">{c.label}</span>
                          <span className="block text-[11px] text-gray-400">{c.hint}</span>
                        </span>
                        <div className="relative w-full sm:w-48">
                          <select value={ownerOf(c)} onChange={(e) => setOwners({ ...owners, [c.id]: e.target.value })} disabled={!included} className={`${inputClass} appearance-none pr-8`} aria-label="Owner tomorrow morning">
                            {team.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                          </select>
                          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex gap-3 px-5 py-4">
                <button type="button" onClick={() => setHandoverOpen(false)} className={`${secondaryBtn} flex-1`}>Back</button>
                <button type="button" onClick={closeBranch} className={`${primaryBtn} flex-1`}>
                  Confirm & close {candidates.length - skipped.size > 0 ? `(${candidates.length - skipped.size} to hand over)` : ''}
                </button>
              </div>
            </div>
          )}

          {closed && (
            <div className="border-t border-grey-border px-5 py-4">
              <p className="text-sm text-navy">
                Closed at <span className="font-semibold">{timeOf(log.closedAt)}</span> by {log.closedBy}
                {log.closedWithPending ? <span className="text-amber-700"> with {log.closedWithPending} pending item{log.closedWithPending === 1 ? '' : 's'}</span> : ''}.
              </p>
              {log.handover.length > 0 && (
                <>
                  <ul className="mt-3 space-y-1.5">
                    {log.handover.map((h) => (
                      <li key={h.id} className="flex items-center gap-2 text-sm">
                        <ListChecks size={14} className="flex-shrink-0 text-gray-400" />
                        <span className="min-w-0 flex-1 truncate text-navy">{h.label}</span>
                        <span className="flex-shrink-0 text-xs text-gray-500">{h.owner}</span>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => onNavigate('daily-tasks', { taskDate: tomorrow })} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-navy-light hover:text-navy">
                    Open tomorrow’s Daily Task Board <ArrowRight size={12} />
                  </button>
                </>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* Linked open issues (read-only glance) */}
      {activeIssues.length > 0 && (
        <section className="rounded-xl border border-grey-border bg-white">
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-sm font-semibold text-navy">Open branch issues</p>
            <button type="button" onClick={() => onNavigate('issues-escalations')} className="inline-flex items-center gap-1 text-xs font-semibold text-navy-light hover:text-navy">
              Issue & Escalation Management <ArrowRight size={12} />
            </button>
          </div>
          <ul className="divide-y divide-grey-border border-t border-grey-border">
            {activeIssues.slice(0, 5).map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => openIssue(i.id)} className="flex w-full flex-wrap items-center gap-2 px-5 py-2.5 text-left hover:bg-grey-bg/50">
                  <span className="text-xs font-semibold tabular-nums text-gray-500">{i.code}</span>
                  <PriorityBadge priority={i.priority} />
                  <span className="min-w-0 flex-1 truncate text-sm text-navy">{i.title}</span>
                  <StatusBadge status={i.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reportFor?.issue && (
        <ReportIssueModal
          initial={{ title: reportFor.issue.title, category: reportFor.issue.category, impact: reportFor.issue.impact, description: `Failed on the opening checklist: “${reportFor.label}”.\n` }}
          context={`Opening checklist: “${reportFor.label}” marked ✗. Category and priority are pre-filled — adjust if needed.`}
          onClose={() => setReportFor(null)}
          onSubmit={submitIssue}
        />
      )}
    </div>
  );
}
