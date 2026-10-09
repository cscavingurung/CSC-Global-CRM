// Content Planner & Branch Coordinator — four sidebar tabs: Dashboard, Content Calendar,
// Content Requests, Content History. A planning and coordination board, not a project-
// management tool, so statuses stay small: Idea → In Progress → Ready → Scheduled → Published
// on the calendar, and Waiting → Received → Ready for branch requests.
//
// The core loop: plan a piece → ask a branch counselor for raw material → chase / receive it →
// send it to the designer → schedule → publish. Every step is one obvious button.
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Bell, CalendarDays, Check, CheckCircle2, ExternalLink, Inbox, LayoutGrid, Link2, List,
  Palette, Pencil, Plus, RotateCcw, Search, Send, X,
} from 'lucide-react';
import { useMarketing } from './mktContext';
import {
  Card, Chips, Drawer, EmptyRow, Field, GhostButton, Kpi, Modal, Pill, PlatformCheckboxes, PrimaryButton, SelectInput, SourceTag, TableBox, Td,
  TextArea, TextInput, Th,
} from './MktShared';
import {
  CONTENT_PLATFORMS, CONTENT_STATUSES, CONTENT_STATUS_STYLES, REQUEST_STYLES, deadlineText, deadlineTone, requestState,
} from './mktUtils';
import { MKT_CAN, addDaysIso, ago, isoToday, shortDay, weekBounds, whenLabel } from '../../marketingDept';
import GreetingBanner from '../GreetingBanner';
import PeriodFilter from '../PeriodFilter';
import { PeriodKey, periodStart, periodSuffix } from '../../reportPeriod';
import { ContentItem, ContentStatus, MarketingRole } from '../../types';

const NEEDED_SUGGESTIONS = ['60-second video', '90-second explainer video', 'Client testimonial video (consent signed)', '6–8 photos', 'Short voice-over', 'Written quote for a post'];
const DONE: ContentStatus[] = ['Scheduled', 'Published'];
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** The Planner has its own tabs; the Marketing Manager reaches the same pages from the shared nav. */
const pageKeys = (role: MarketingRole) => role === 'Content Planner'
  ? { calendar: 'cp-calendar', requests: 'cp-requests', history: 'cp-history' }
  : { calendar: 'mkt-calendar', requests: 'mkt-requests', history: 'mkt-library' };

function useDesigners() {
  const { team } = useMarketing();
  return team.filter((t) => t.role === 'Graphics Designer').map((t) => t.name);
}

function StatusPill({ status }: { status: ContentStatus }) {
  return <Pill text={status} cls={CONTENT_STATUS_STYLES[status]} />;
}

function dayHeading(iso: string, today: string) {
  if (iso === today) return `Today · ${shortDay(iso)}`;
  if (iso === addDaysIso(today, 1)) return `Tomorrow · ${shortDay(iso)}`;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

function PeriodHeader({ period, onChange, what }: { period: PeriodKey; onChange: (p: PeriodKey) => void; what: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-navy">Report period</p>
        <p className="text-xs text-gray-400">{what} {periodSuffix(period).toLowerCase()}</p>
      </div>
      <PeriodFilter value={period} onChange={onChange} />
    </div>
  );
}

// ── Add / edit calendar content ─────────────────────────────────────────────
function ContentModal({ item, onClose }: { item?: ContentItem; onClose: () => void }) {
  const { team, me, role, store, actions, navigate } = useMarketing();
  const [title, setTitle] = useState(item?.title ?? '');
  const [platforms, setPlatforms] = useState<string[]>(item?.platform ? [item.platform] : []);
  const [assignee, setAssignee] = useState(item?.assignee ?? me);
  const [deadline, setDeadline] = useState(item?.deadline ?? '');
  const [status, setStatus] = useState<ContentStatus>(item?.status ?? 'Idea');
  const [link, setLink] = useState(item?.publishedLink ?? '');
  const people = [...new Set([...team.map((t) => t.name), ...(item?.person ? [item.person] : []), assignee].filter(Boolean))];
  const roleOf = (n: string) => team.find((t) => t.name === n)?.role ?? 'Branch';
  const platformOptions = item?.platform && !CONTENT_PLATFORMS.includes(item.platform) ? [...CONTENT_PLATFORMS, item.platform] : CONTENT_PLATFORMS;
  const valid = title.trim() && platforms.length > 0 && assignee && deadline;
  const request = item?.requestId ? store.contentRequests.find((r) => r.id === item.requestId) : undefined;
  const save = () => {
    if (!valid) return;
    const data = { title: title.trim(), assignee, deadline, status, publishedLink: status === 'Published' ? link.trim() || undefined : item?.publishedLink };
    // One calendar entry per platform; when editing, the entry keeps the first and extra ticks become new entries.
    const [first, ...rest] = platforms;
    if (item) actions.updateContentItem(item.id, { ...data, platform: first });
    else actions.addContentItem({ ...data, platform: first });
    rest.forEach((platform) => actions.addContentItem({ ...data, platform }));
    onClose();
  };
  return (
    <Modal title={item ? 'Edit content' : 'Add content'} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Title" required><TextInput value={title} placeholder="e.g. Why choose Canada for January 2027?" onChange={(e) => setTitle(e.target.value)} /></Field>
        <PlatformCheckboxes options={platformOptions} value={platforms} onChange={setPlatforms} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Assignee" required>
            <SelectInput value={assignee} onChange={setAssignee} label="Assignee">
              {people.map((p) => <option key={p} value={p}>{p} · {roleOf(p)}</option>)}
            </SelectInput>
          </Field>
          <Field label="Deadline" required><TextInput type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          <Field label="Status" required>
            <SelectInput value={status} onChange={(v) => setStatus(v as ContentStatus)} label="Status">
              {CONTENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </SelectInput>
          </Field>
        </div>
        {status === 'Published' && (
          <Field label="Published link" hint="Optional — makes it easy to find again in Content History.">
            <TextInput type="url" value={link} placeholder="https://" onChange={(e) => setLink(e.target.value)} />
          </Field>
        )}
        {request ? (
          <p className="rounded-lg bg-grey-bg px-3 py-2 text-xs text-gray-600">
            Raw material from <b className="text-navy">{request.targetCounselor}</b> ({request.targetBranch}) — request is <b className="text-navy">{request.status}</b>.
          </p>
        ) : item && !DONE.includes(item.status) && MKT_CAN.requestContent(role) && (
          <button type="button" onClick={() => { onClose(); navigate(pageKeys(role).requests, `new:${item.id}`); }}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-grey-border px-3 py-2 text-left text-xs text-navy transition-colors hover:border-navy-light hover:text-navy-light">
            <Send size={13} /> Need a video or photos for this? <b>Ask a branch counselor</b>
          </button>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}>{item ? 'Save changes' : platforms.length > 1 ? `Add for ${platforms.length} platforms` : 'Add content'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

/** Inline status changer that still looks like a soft pill. */
function StatusSelect({ item }: { item: ContentItem }) {
  const { actions } = useMarketing();
  return (
    <select
      value={item.status}
      aria-label={`Status of ${item.title}`}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => actions.updateContentItem(item.id, { status: e.target.value as ContentStatus })}
      className={`cursor-pointer rounded-full border-0 py-0.5 pl-2.5 pr-7 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-navy-light ${CONTENT_STATUS_STYLES[item.status]}`}
    >
      {CONTENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
    </select>
  );
}

// ── 1. Dashboard ────────────────────────────────────────────────────────────
export function PlannerDashboardPage() {
  const { store, me, role, navigate } = useMarketing();
  const designers = useDesigners();
  const keys = pageKeys(role);
  const [period, setPeriod] = useState<PeriodKey>('6m');
  const start = useMemo(() => periodStart(period, new Date()), [period]);
  const today = isoToday();
  const [, weekEnd] = weekBounds(today);
  const open = store.contentItems.filter((c) => !DONE.includes(c.status));
  const dueToday = open.filter((c) => c.deadline === today);
  const overdue = open.filter((c) => c.deadline < today);
  const dueWeek = open.filter((c) => c.deadline >= today && c.deadline <= weekEnd);
  const waitingBranch = store.contentRequests.filter((r) => r.status === 'Waiting').sort((a, b) => a.deadline.localeCompare(b.deadline));
  const received = store.contentRequests.filter((r) => r.status === 'Received');
  const withDesigner = open.filter((c) => c.status === 'In Progress' && designers.includes(c.assignee));
  const ready = store.contentItems.filter((c) => c.status === 'Ready');
  const scheduled = store.contentItems.filter((c) => c.status === 'Scheduled');
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  type Priority = { tone: 'red' | 'amber' | 'blue' | 'violet'; text: string; items: string[]; action: string; to: string; preset?: string };
  const priorities: Priority[] = [
    ...(overdue.length ? [{ tone: 'red' as const, text: `${plural(overdue.length, 'content piece')} overdue`, items: overdue.map((c) => `${c.title} — ${deadlineText(c.deadline)}`), action: 'Review', to: keys.calendar }] : []),
    ...(dueToday.length ? [{ tone: 'amber' as const, text: `${plural(dueToday.length, 'content piece')} due today`, items: dueToday.map((c) => `${c.title} · ${c.assignee}`), action: 'Open calendar', to: keys.calendar }] : []),
    ...(waitingBranch.length ? [{ tone: 'amber' as const, text: `${waitingBranch.length} waiting on branch staff`, items: waitingBranch.map((r) => `${r.targetCounselor.split(' ')[0]} (${r.targetBranch}) — ${r.needed}, ${lowerFirst(deadlineText(r.deadline))}`), action: 'Chase', to: keys.requests, preset: 'Waiting' }] : []),
    ...(received.length ? [{ tone: 'blue' as const, text: `${plural(received.length, 'branch delivery', 'branch deliveries')} to send to the designer`, items: received.map((r) => `${r.topic} — from ${r.targetCounselor}`), action: 'Send', to: keys.requests, preset: 'Received' }] : []),
    ...(withDesigner.length ? [{ tone: 'blue' as const, text: `${withDesigner.length} with designer`, items: withDesigner.map((c) => `${c.title} — ${lowerFirst(deadlineText(c.deadline))}`), action: 'View', to: keys.calendar, preset: 'In Progress' }] : []),
    ...(ready.length ? [{ tone: 'violet' as const, text: `${plural(ready.length, 'piece')} ready to schedule`, items: ready.map((c) => c.title), action: 'Schedule', to: keys.calendar, preset: 'Ready' }] : []),
  ];
  const toneCls = { red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', violet: 'bg-violet-50 text-violet-700' };
  const published = store.contentItems
    .filter((c) => c.status === 'Published' && c.publishedAt && (!start || new Date(`${c.publishedAt}T12:00:00`) >= start))
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

  const card = (label: string, value: number, hint: string, to: string, preset?: string, tone?: 'red' | 'amber' | 'green') => (
    <button type="button" onClick={() => navigate(to, preset)} className="text-left transition-opacity hover:opacity-80">
      <Kpi label={label} value={value} hint={hint} tone={tone} />
    </button>
  );

  return (
    <div className="space-y-4">
      <GreetingBanner name={me} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          <PrimaryButton onClick={() => navigate(keys.requests, 'new')}><Send size={15} /> Request content from a branch</PrimaryButton>
          <GhostButton onClick={() => navigate(keys.calendar, 'new')}><Plus size={15} /> Add content</GhostButton>
        </div>
        <div className="flex-1"><PeriodHeader period={period} onChange={setPeriod} what="Published list:" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {card('Content Due Today', dueToday.length, overdue.length ? `${overdue.length} overdue` : 'Nothing overdue', keys.calendar, undefined, overdue.length ? 'red' : dueToday.length ? 'amber' : undefined)}
        {card('Due This Week', dueWeek.length, `Until ${shortDay(weekEnd)}`, keys.calendar)}
        {card('Waiting for Branch', waitingBranch.length, `${waitingBranch.filter((r) => requestState(r) === 'Overdue').length} past deadline`, keys.requests, 'Waiting', waitingBranch.length ? 'amber' : undefined)}
        {card('Waiting for Designer', withDesigner.length, received.length ? `${received.length} more to send` : 'Nothing to send', keys.calendar, 'In Progress')}
        {card('Scheduled Posts', scheduled.length, 'Ready to go out', keys.calendar, 'Scheduled', 'green')}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <Card title="Today's Priorities">
          <ul className="divide-y divide-grey-border">
            {priorities.map((p) => (
              <li key={p.text} className="flex items-start gap-3 px-5 py-3">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${toneCls[p.tone]}`}>
                  {p.tone === 'red' ? <AlertTriangle size={14} /> : p.tone === 'blue' ? <Palette size={14} /> : p.tone === 'violet' ? <CheckCircle2 size={14} /> : <Bell size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy">{p.text}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {p.items.slice(0, 3).map((t) => <li key={t} className="truncate text-xs text-gray-500">{t}</li>)}
                    {p.items.length > 3 && <li className="text-xs text-gray-400">+{p.items.length - 3} more</li>}
                  </ul>
                </div>
                <button type="button" onClick={() => navigate(p.to, p.preset)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-grey-border px-2.5 py-1 text-xs font-medium text-navy transition-colors hover:border-navy-light hover:text-navy-light">{p.action} <ArrowRight size={12} /></button>
              </li>
            ))}
            {priorities.length === 0 && <li className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-emerald-700"><CheckCircle2 size={16} /> All clear for today.</li>}
          </ul>
        </Card>
        <Card title={`Published · ${published.length}`} action={<button type="button" onClick={() => navigate(keys.history)} className="text-xs font-medium text-navy hover:text-navy-light">History →</button>}>
          <ul className="divide-y divide-grey-border">
            {published.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-5 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-navy">{c.title}</span>
                <SourceTag source={c.platform} />
                <span className="w-14 text-right text-xs text-gray-400">{shortDay(c.publishedAt!)}</span>
              </li>
            ))}
            {published.length === 0 && <li className="px-5 py-6 text-center text-sm text-gray-400">Nothing published in this period.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

// ── 2. Content Calendar ─────────────────────────────────────────────────────
function MoveButton({ item, to }: { item: ContentItem; to: ContentStatus }) {
  const { actions } = useMarketing();
  return (
    <button type="button" onClick={() => actions.updateContentItem(item.id, { status: to })} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-navy transition-colors hover:text-navy-light">
      Move to {to} <ArrowRight size={11} />
    </button>
  );
}

export function ContentCalendarPage() {
  const { store, role, preset } = useMarketing();
  const [status, setStatus] = useState<'All' | ContentStatus>(CONTENT_STATUSES.includes(preset as ContentStatus) ? preset as ContentStatus : 'All');
  const [platform, setPlatform] = useState('All platforms');
  const [layout, setLayout] = useState<'list' | 'board'>('list');
  const [editing, setEditing] = useState<ContentItem | 'new' | null>(preset === 'new' ? 'new' : null);
  const today = isoToday();
  const canEdit = MKT_CAN.requestContent(role);
  // Published pieces older than two weeks live in Content History, keeping the calendar about what's next.
  const recentCutoff = addDaysIso(today, -14);
  const pool = store.contentItems.filter((c) => c.status !== 'Published' || (c.publishedAt ?? c.deadline) >= recentCutoff);
  const counts = { All: pool.length } as Record<'All' | ContentStatus, number>;
  CONTENT_STATUSES.forEach((s) => { counts[s] = pool.filter((c) => c.status === s).length; });
  const rows = pool
    .filter((c) => (status === 'All' || c.status === status) && (platform === 'All platforms' || c.platform === platform))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const overdue = rows.filter((c) => c.deadline < today && !DONE.includes(c.status));
  const groups = new Map<string, ContentItem[]>();
  rows.filter((c) => !overdue.includes(c)).forEach((c) => groups.set(c.deadline, [...(groups.get(c.deadline) ?? []), c]));
  const waitingOn = (c: ContentItem) => {
    const r = c.requestId ? store.contentRequests.find((x) => x.id === c.requestId) : undefined;
    return r?.status === 'Waiting' ? r : undefined;
  };

  const row = (c: ContentItem) => {
    const w = waitingOn(c);
    return (
      <li key={c.id} onClick={canEdit ? () => setEditing(c) : undefined} className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors sm:grid-cols-[1fr_110px_150px_130px] ${canEdit ? 'cursor-pointer hover:bg-grey-bg/60' : ''}`}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-navy">{c.title}</p>
          {w ? <p className="truncate text-[11px] font-medium text-amber-700">Waiting for {w.targetCounselor} ({w.targetBranch}) — {lowerFirst(deadlineText(w.deadline))}</p>
            : c.person && <p className="truncate text-[11px] text-gray-400">From {c.person} · {c.branch}</p>}
        </div>
        <span className="justify-self-end sm:justify-self-start"><SourceTag source={c.platform} /></span>
        <span className="truncate text-xs text-gray-500">{c.assignee}</span>
        <span className="justify-self-end sm:justify-self-start">{canEdit ? <StatusSelect item={c} /> : <StatusPill status={c.status} />}</span>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex-1"><Chips options={['All', ...CONTENT_STATUSES] as const} value={status} onChange={setStatus} counts={counts} /></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40"><SelectInput value={platform} onChange={setPlatform} label="Platform"><option>All platforms</option>{CONTENT_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</SelectInput></div>
          <div className="inline-flex rounded-lg border border-grey-border bg-white p-0.5">
            {([['list', <List key="l" size={14} />, 'List'], ['board', <LayoutGrid key="b" size={14} />, 'Board']] as const).map(([k, icon, label]) => (
              <button key={k} type="button" aria-pressed={layout === k} onClick={() => setLayout(k)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${layout === k ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}>{icon} {label}</button>
            ))}
          </div>
          {canEdit && <PrimaryButton onClick={() => setEditing('new')}><Plus size={15} /> Add Content</PrimaryButton>}
        </div>
      </div>

      {layout === 'list' ? (
        <div className="overflow-hidden rounded-xl border border-grey-border bg-white">
          <div className="hidden grid-cols-[1fr_110px_150px_130px] gap-3 border-b border-grey-border bg-grey-bg/50 px-4 py-2 text-xs font-semibold text-gray-500 sm:grid">
            <span>Content</span><span>Platform</span><span>Assignee</span><span>Status</span>
          </div>
          {overdue.length > 0 && (
            <section>
              <p className="flex items-center gap-1.5 border-b border-grey-border bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-700"><AlertTriangle size={12} /> Overdue · {overdue.length}</p>
              <ul className="divide-y divide-grey-border border-b border-grey-border">{overdue.map(row)}</ul>
            </section>
          )}
          {[...groups.entries()].map(([day, items]) => (
            <section key={day}>
              <p className={`border-b border-grey-border px-4 py-1.5 text-xs font-semibold ${day === today ? 'bg-navy/5 text-navy' : 'bg-grey-bg/40 text-gray-500'}`}>{dayHeading(day, today)}</p>
              <ul className="divide-y divide-grey-border border-b border-grey-border">{items.map(row)}</ul>
            </section>
          ))}
          {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-gray-400">No content in this view.</p>}
          <p className="px-4 py-2 text-[11px] text-gray-400">Click a piece to edit it or ask a branch for material. Published pieces older than two weeks move to Content History.</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[980px] grid-cols-5 gap-3">
            {CONTENT_STATUSES.map((s) => {
              const col = rows.filter((c) => c.status === s);
              const next = CONTENT_STATUSES[CONTENT_STATUSES.indexOf(s) + 1];
              return (
                <div key={s} className="rounded-xl border border-grey-border bg-grey-bg/50 p-2">
                  <div className="mb-2 flex items-center justify-between px-1"><StatusPill status={s} /><span className="text-xs font-semibold text-gray-500">{col.length}</span></div>
                  <div className="space-y-2">
                    {col.map((c) => {
                      const w = waitingOn(c);
                      return (
                        <div key={c.id} className="dissolve-in rounded-lg border border-grey-border bg-white p-3 transition-colors hover:border-navy-light">
                          <button type="button" disabled={!canEdit} onClick={() => setEditing(c)} className="w-full text-left text-sm font-medium leading-snug text-navy">{c.title}</button>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <SourceTag source={c.platform} />
                            <span className={deadlineTone(c.deadline, DONE.includes(c.status))}>{DONE.includes(c.status) ? shortDay(c.deadline) : deadlineText(c.deadline)}</span>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-gray-400">{c.assignee}</p>
                          {w && <p className="mt-1 truncate text-[11px] font-medium text-amber-700">Waiting for {w.targetCounselor.split(' ')[0]}</p>}
                          {next && canEdit && <MoveButton item={c} to={next} />}
                        </div>
                      );
                    })}
                    {col.length === 0 && <p className="px-2 py-6 text-center text-xs text-gray-400">Empty</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {editing && <ContentModal item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ── 3. Content Requests (branch coordination) ───────────────────────────────
function RequestModal({ fromItem, onClose }: { fromItem?: ContentItem; onClose: () => void }) {
  const { branches, contributorsByBranch, actions } = useMarketing();
  const [topic, setTopic] = useState(fromItem?.title ?? '');
  const [branch, setBranch] = useState('');
  const [person, setPerson] = useState('');
  const [needed, setNeeded] = useState('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const valid = topic.trim() && branch && person && needed.trim() && deadline;
  return (
    <Modal title="Request content from a branch" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        // Notifies the counselor and that branch's Branch Manager (handleContentRequest in App.tsx).
        actions.requestContent({
          topic: topic.trim(), targetBranch: branch, targetCounselor: person, needed: needed.trim(), deadline,
          notes: notes.trim() || undefined, contentItemId: fromItem?.id,
        });
        onClose();
      }}>
        {fromItem && <p className="rounded-lg bg-grey-bg px-3 py-2 text-xs text-gray-600">For the calendar piece <b className="text-navy">{fromItem.title}</b> — it will show who it's waiting on.</p>}
        <Field label="Topic" required><TextInput value={topic} placeholder="e.g. Why choose Canada for January 2027?" onChange={(e) => setTopic(e.target.value)} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Target Branch" required>
            <SelectInput value={branch} onChange={(v) => { setBranch(v); setPerson(''); }} label="Target Branch">
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b}>{b}</option>)}
            </SelectInput>
          </Field>
          <Field label="Target Person" required>
            <SelectInput value={person} onChange={setPerson} label="Target Person">
              <option value="">{branch ? 'Select counselor or front desk' : 'Pick a branch first'}</option>
              {(contributorsByBranch[branch] ?? []).map((c) => <option key={c.name} value={c.name}>{c.name} — {c.role}</option>)}
            </SelectInput>
          </Field>
          <Field label="What is needed" required>
            <TextInput list="needed-suggestions" value={needed} placeholder="e.g. 60-second video" onChange={(e) => setNeeded(e.target.value)} />
            <datalist id="needed-suggestions">{NEEDED_SUGGESTIONS.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
          <Field label="Deadline" required>
            <TextInput type="date" min={isoToday()} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            <span className="mt-1 flex gap-1">
              {[2, 3, 7].map((d) => (
                <button key={d} type="button" onClick={() => setDeadline(addDaysIso(isoToday(), d))} className="rounded-full border border-grey-border px-2 py-0.5 text-[11px] text-gray-600 transition-colors hover:border-navy-light hover:text-navy-light">+{d} days</button>
              ))}
            </span>
          </Field>
        </div>
        <Field label="Notes"><TextArea value={notes} placeholder="Talking points, framing, anything the counselor should know" onChange={(e) => setNotes(e.target.value)} /></Field>
        <p className="text-xs text-gray-400">The counselor and their Branch Manager get a notification.</p>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}><Send size={14} /> Send request</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

type DrawerAction = 'receive' | 'send' | 'reopen' | null;

/** Everything about one request, and the next step to take on it. */
function RequestDrawer({ reqId, startAction, onClose }: { reqId: string; startAction: DrawerAction; onClose: () => void }) {
  const { store, role, actions, contributorsByBranch, navigate } = useMarketing();
  const designers = useDesigners();
  const req = store.contentRequests.find((r) => r.id === reqId);
  const [action, setAction] = useState<DrawerAction>(startAction);
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [designer, setDesigner] = useState(designers[0] ?? '');
  const [platform, setPlatform] = useState('Instagram');
  const [designDeadline, setDesignDeadline] = useState(addDaysIso(isoToday(), 2));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ needed: req?.needed ?? '', deadline: req?.deadline ?? '', targetCounselor: req?.targetCounselor ?? '', notes: req?.notes ?? '' });
  const [flash, setFlash] = useState('');
  useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(''), 2600); return () => clearTimeout(t); }, [flash]);
  if (!req) return null;
  const can = MKT_CAN.requestContent(role);
  const st = requestState(req);
  const item = req.contentItemId ? store.contentItems.find((c) => c.id === req.contentItemId) : undefined;

  const steps: { label: string; done: boolean; when?: string; detail?: string }[] = [
    { label: 'Requested', done: true, when: req.requestedAt, detail: `by ${req.requestedBy}` },
    { label: 'Received from branch', done: req.status !== 'Waiting', when: req.receivedAt, detail: req.receivedNote },
    { label: 'Sent to designer', done: req.status === 'Ready', when: req.sentToDesignerAt, detail: item ? `${item.assignee} · calendar: ${item.status}` : undefined },
  ];
  const log = [
    ...(req.reminders ?? []).map((r, i) => ({ at: r, text: `Reminder ${i + 1} sent to ${req.targetCounselor}` })),
    ...(req.reopenReason ? [{ at: '', text: `Sent back to the branch: ${req.reopenReason}` }] : []),
  ];

  return (
    <Drawer
      title={req.topic}
      onClose={onClose}
      subtitle={<div className="flex flex-wrap items-center gap-2 text-xs text-gray-500"><Pill text={req.status} cls={REQUEST_STYLES[req.status]} />{st === 'Overdue' && <Pill text="Past deadline" cls={REQUEST_STYLES.Overdue} />}<span>{req.targetCounselor} · {req.targetBranch}</span></div>}
    >
      <div className="space-y-6">
        {flash && <p className="dissolve-in flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 size={15} /> {flash}</p>}

        {/* Next step — the one thing to do now */}
        {can && (
          <section className="rounded-xl border border-grey-border p-4">
            <h4 className="mb-3 text-sm font-semibold text-navy">Next step</h4>
            {req.status === 'Waiting' && action !== 'receive' && (
              <div className="flex flex-wrap gap-2">
                <PrimaryButton onClick={() => setAction('receive')}><Inbox size={14} /> Mark as Received</PrimaryButton>
                <GhostButton onClick={() => { actions.remindContentRequest(req.id); setFlash(`Reminder sent to ${req.targetCounselor} and the ${req.targetBranch} Branch Manager.`); }}><Bell size={14} /> Send reminder</GhostButton>
              </div>
            )}
            {req.status === 'Waiting' && action === 'receive' && (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); actions.markContentReceived(req.id, link.trim() || undefined, note.trim() || undefined); setAction('send'); setFlash('Marked as received. Next: send it to the designer.'); }}>
                <Field label="Where is the material?" hint="Optional — Drive folder, WhatsApp, or a shared link. The designer gets it with the brief.">
                  <TextInput value={link} placeholder="https://drive.google.com/…" onChange={(e) => setLink(e.target.value)} />
                </Field>
                <Field label="Note"><TextInput value={note} placeholder="e.g. 2 takes, second one is better" onChange={(e) => setNote(e.target.value)} /></Field>
                <div className="flex gap-2"><PrimaryButton type="submit"><Check size={14} /> Confirm received</PrimaryButton><GhostButton onClick={() => setAction(null)}>Cancel</GhostButton></div>
              </form>
            )}
            {req.status === 'Received' && action !== 'reopen' && (
              <div className="space-y-3">
                {req.materialLink && <a href={req.materialLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-navy hover:text-navy-light"><Link2 size={13} /> Open the material <ExternalLink size={11} /></a>}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Designer" required>
                    <SelectInput value={designer} onChange={setDesigner} label="Designer">
                      {designers.length === 0 && <option value="">No designer on the team</option>}
                      {designers.map((d) => <option key={d}>{d}</option>)}
                    </SelectInput>
                  </Field>
                  <Field label="Platform" required><SelectInput value={platform} onChange={setPlatform} label="Platform">{CONTENT_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</SelectInput></Field>
                  <Field label="Design deadline" required><TextInput type="date" min={isoToday()} value={designDeadline} onChange={(e) => setDesignDeadline(e.target.value)} /></Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PrimaryButton disabled={!designer || !designDeadline} onClick={() => { actions.sendToDesigner(req.id, designer, platform, designDeadline); setFlash(`Sent to ${designer}. It's on the Content Calendar as In Progress.`); }}><Palette size={14} /> Send to Designer</PrimaryButton>
                  <GhostButton onClick={() => setAction('reopen')}><RotateCcw size={14} /> Not usable — ask again</GhostButton>
                </div>
              </div>
            )}
            {req.status === 'Received' && action === 'reopen' && (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!reason.trim()) return; actions.reopenContentRequest(req.id, reason.trim()); setAction(null); setReason(''); setFlash(`Sent back to ${req.targetCounselor} — they've been notified.`); }}>
                <Field label="What needs redoing?" required><TextInput value={reason} placeholder="e.g. Audio too noisy, please re-record indoors" onChange={(e) => setReason(e.target.value)} /></Field>
                <div className="flex gap-2"><PrimaryButton type="submit" disabled={!reason.trim()}><RotateCcw size={14} /> Send back to branch</PrimaryButton><GhostButton onClick={() => setAction(null)}>Cancel</GhostButton></div>
              </form>
            )}
            {req.status === 'Ready' && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-600">{item ? <>With <b className="text-navy">{item.assignee}</b> — calendar status <StatusPill status={item.status} /></> : 'With the designer.'}</span>
                <GhostButton small onClick={() => navigate(pageKeys(role).calendar, item?.status)}><CalendarDays size={13} /> Open Content Calendar</GhostButton>
              </div>
            )}
          </section>
        )}

        {/* Progress */}
        <section>
          <h4 className="mb-3 text-sm font-semibold text-navy">Progress</h4>
          <ol>
            {steps.map((s, i) => (
              <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
                {i < steps.length - 1 && <span className={`absolute left-[11px] top-6 h-[calc(100%-20px)] w-0.5 ${steps[i + 1].done ? 'bg-navy' : 'bg-grey-border'}`} />}
                <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${s.done ? 'border-navy bg-navy text-white' : 'border-grey-border bg-white'}`}>{s.done && <Check size={12} />}</span>
                <div className="pt-0.5">
                  <p className={`text-sm ${s.done ? 'text-navy' : 'text-gray-400'}`}>{s.label}</p>
                  <p className="text-xs text-gray-400">{s.done ? `${s.when ? whenLabel(s.when) : ''}${s.detail ? `${s.when ? ' · ' : ''}${s.detail}` : ''}` : i === 1 ? `Due ${whenLabel(req.deadline)}` : 'Not yet'}</p>
                </div>
              </li>
            ))}
          </ol>
          {log.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg bg-grey-bg px-3 py-2">
              {log.map((l) => <li key={l.text + l.at} className="text-xs text-gray-600">{l.text}{l.at && <span className="text-gray-400"> · {ago(l.at)}</span>}</li>)}
            </ul>
          )}
        </section>

        {/* Details — editable while still waiting on the branch */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-navy">Details</h4>
            {can && req.status === 'Waiting' && !editing && <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-navy-light"><Pencil size={12} /> Update</button>}
          </div>
          {editing ? (
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              actions.updateContentRequest(req.id, { needed: draft.needed.trim() || req.needed, deadline: draft.deadline || req.deadline, targetCounselor: draft.targetCounselor, notes: draft.notes.trim() || undefined });
              setEditing(false); setFlash('Request updated.');
            }}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Target Person">
                  <SelectInput value={draft.targetCounselor} onChange={(v) => setDraft({ ...draft, targetCounselor: v })} label="Target Person">
                    {[...new Set([req.targetCounselor, ...(contributorsByBranch[req.targetBranch] ?? []).map((c) => c.name)])].map((c) => <option key={c}>{c}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Deadline"><TextInput type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} /></Field>
              </div>
              <Field label="What is needed"><TextInput value={draft.needed} onChange={(e) => setDraft({ ...draft, needed: e.target.value })} /></Field>
              <Field label="Notes"><TextArea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
              <div className="flex gap-2"><PrimaryButton type="submit">Save</PrimaryButton><GhostButton onClick={() => setEditing(false)}>Cancel</GhostButton></div>
            </form>
          ) : (
            <dl className="divide-y divide-grey-border rounded-lg border border-grey-border text-sm">
              {([
                ['Branch', req.targetBranch], ['Person', req.targetCounselor], ['What is needed', req.needed],
                ['Deadline', <span key="d" className={deadlineTone(req.deadline, req.status !== 'Waiting')}>{whenLabel(req.deadline)}</span>],
                ['Notes', req.notes],
                ['Material', req.submittedFiles?.length
                  ? <span key="m" className="flex flex-col items-end gap-0.5">{req.submittedFiles.map((f) => (f.url && /^https?:/.test(f.url)
                    ? <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="text-navy hover:text-navy-light">{f.name}</a>
                    : <span key={f.id}>{f.name}</span>))}<span className="text-[11px] text-gray-400">submitted by {req.submittedBy}</span></span>
                  : req.materialLink ? <a key="m" href={req.materialLink} target="_blank" rel="noopener noreferrer" className="text-navy hover:text-navy-light">Open link</a> : undefined],
                ['Counselor note', req.receivedNote],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-3 py-2"><dt className="shrink-0 text-gray-500">{k}</dt><dd className="text-right text-navy">{v || <span className="text-gray-400">—</span>}</dd></div>
              ))}
            </dl>
          )}
        </section>
      </div>
    </Drawer>
  );
}

type ReqFilter = 'All' | 'Waiting' | 'Received' | 'Ready';

/** Branch coordination — the Planner's Content Requests tab and the Manager's Content Requests page. */
export function RequestsView() {
  const { store, role, actions, preset, branches } = useMarketing();
  const newFrom = preset?.startsWith('new') ? preset : undefined;
  const fromItem = newFrom?.startsWith('new:') ? store.contentItems.find((c) => c.id === newFrom.slice(4)) : undefined;
  const [filter, setFilter] = useState<ReqFilter>((['Waiting', 'Received', 'Ready'] as string[]).includes(preset ?? '') ? preset as ReqFilter : 'All');
  const [branch, setBranch] = useState('All branches');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(Boolean(newFrom));
  const [open, setOpen] = useState<{ id: string; action: DrawerAction } | null>(null);
  const [flash, setFlash] = useState('');
  useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(''), 2600); return () => clearTimeout(t); }, [flash]);
  const can = MKT_CAN.requestContent(role);
  const counts: Record<ReqFilter, number> = { All: store.contentRequests.length, Waiting: 0, Received: 0, Ready: 0 };
  store.contentRequests.forEach((r) => { counts[r.status] += 1; });
  const overdueCount = store.contentRequests.filter((r) => requestState(r) === 'Overdue').length;
  const order = { Waiting: 0, Received: 1, Ready: 2 };
  const needle = q.trim().toLowerCase();
  const rows = store.contentRequests
    .filter((r) => (filter === 'All' || r.status === filter) && (branch === 'All branches' || r.targetBranch === branch)
      && (!needle || [r.topic, r.targetCounselor, r.needed].some((v) => v.toLowerCase().includes(needle))))
    .sort((a, b) => order[a.status] - order[b.status] || a.deadline.localeCompare(b.deadline));
  const itemOf = (id?: string) => store.contentItems.find((c) => c.id === id);

  const steps: { key: ReqFilter; n: number; title: string; hint: string; cls: string }[] = [
    { key: 'Waiting', n: counts.Waiting, title: 'Waiting on branch', hint: overdueCount ? `${overdueCount} past deadline — send a reminder` : 'Counselors are recording', cls: 'text-amber-700' },
    { key: 'Received', n: counts.Received, title: 'Received', hint: 'Check it, then send to the designer', cls: 'text-blue-700' },
    { key: 'Ready', n: counts.Ready, title: 'Ready · with designer', hint: 'Tracked on the Content Calendar', cls: 'text-emerald-700' },
  ];

  return (
    <div className="space-y-4">
      {/* The workflow at a glance — each step is also the filter. */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {steps.map((s, i) => (
          <div key={s.key} className="contents">
            <button type="button" aria-pressed={filter === s.key} onClick={() => setFilter(filter === s.key ? 'All' : s.key)}
              className={`rounded-xl border bg-white px-4 py-3 text-left transition-colors hover:border-navy-light ${filter === s.key ? 'border-navy' : 'border-grey-border'}`}>
              <p className="flex items-baseline gap-2"><span className={`text-2xl font-bold tabular-nums ${s.cls}`}>{s.n}</span><span className="text-sm font-semibold text-navy">{i + 1}. {s.title}</span></p>
              <p className="mt-0.5 text-xs text-gray-500">{s.hint}</p>
            </button>
            {i < steps.length - 1 && <ArrowRight className="mx-auto hidden self-center text-gray-300 md:block" size={18} />}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search topic or person" className="w-full rounded-lg border border-grey-border py-2 pl-9 pr-3 text-sm focus:border-navy-light focus:outline-none" />
          </div>
          <div className="w-full sm:w-44"><SelectInput value={branch} onChange={setBranch} label="Branch"><option>All branches</option>{branches.map((b) => <option key={b}>{b}</option>)}</SelectInput></div>
          {filter !== 'All' && <button type="button" onClick={() => setFilter('All')} className="text-xs font-medium text-navy hover:text-navy-light">Show all {counts.All}</button>}
        </div>
        {can && <PrimaryButton onClick={() => setAdding(true)}><Plus size={15} /> Request Content</PrimaryButton>}
      </div>
      {flash && <p className="dissolve-in flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 size={15} /> {flash}</p>}

      <TableBox min={880}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Topic</Th><Th>Branch · Person</Th><Th>What is needed</Th><Th>Deadline</Th><Th>Status</Th><Th right>Next step</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((r) => {
            const st = requestState(r);
            const item = itemOf(r.contentItemId);
            return (
              <tr key={r.id} onClick={() => setOpen({ id: r.id, action: null })} className={`cursor-pointer transition-colors hover:bg-grey-bg/60 ${st === 'Overdue' ? 'bg-red-50/50' : ''}`}>
                <Td><span className="font-medium text-navy">{r.topic}</span>{r.notes && <span className="line-clamp-1 block max-w-[280px] text-[11px] text-gray-400" title={r.notes}>{r.notes}</span>}</Td>
                <Td className="text-navy">{r.targetBranch}<span className="block text-[11px] text-gray-500">{r.targetCounselor}</span></Td>
                <Td className="text-gray-600">{r.needed}</Td>
                <Td className={`whitespace-nowrap ${deadlineTone(r.deadline, r.status !== 'Waiting')}`}>{shortDay(r.deadline)}</Td>
                <Td>
                  <Pill text={r.status} cls={REQUEST_STYLES[r.status]} />
                  {st === 'Overdue' && <span className="mt-1 block text-[11px] font-medium text-red-600">Past deadline</span>}
                  {r.status === 'Waiting' && !!r.reminders?.length && <span className="mt-1 block text-[11px] text-gray-400">Reminded {r.reminders.length}×</span>}
                  {r.status === 'Waiting' && r.reopenReason && <span className="mt-1 block text-[11px] text-amber-700">Asked to redo</span>}
                </Td>
                <Td right>
                  <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {!can ? <span className="text-xs text-gray-400">View only</span>
                      : r.status === 'Waiting' ? <>
                        <GhostButton small onClick={() => { actions.remindContentRequest(r.id); setFlash(`Reminder sent to ${r.targetCounselor}.`); }}><Bell size={12} /> Remind</GhostButton>
                        <PrimaryButton small onClick={() => setOpen({ id: r.id, action: 'receive' })}><Inbox size={12} /> Received</PrimaryButton>
                      </>
                        : r.status === 'Received' ? <PrimaryButton small onClick={() => setOpen({ id: r.id, action: 'send' })}><Palette size={12} /> Send to Designer</PrimaryButton>
                          : <span className="text-xs text-gray-500">{item ? <>With {item.assignee.split(' ')[0]} · <span className="font-medium text-navy">{item.status}</span></> : 'With designer'}</span>}
                  </div>
                </Td>
              </tr>
            );
          })}
          {rows.length === 0 && <EmptyRow cols={6} text={counts.All ? 'No requests match.' : 'No requests yet — ask a branch for a video or photos.'} />}
        </tbody>
      </TableBox>
      <p className="text-[11px] text-gray-400">Click a request for its full progress, to update the deadline or person, or to send it back if the material isn't usable.</p>
      {adding && <RequestModal fromItem={fromItem} onClose={() => setAdding(false)} />}
      {open && <RequestDrawer key={open.id} reqId={open.id} startAction={open.action} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ── 4. Content History ──────────────────────────────────────────────────────
export function ContentHistoryPage() {
  const { store } = useMarketing();
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState<string>('All');
  const [period, setPeriod] = useState<PeriodKey>('all');
  const start = useMemo(() => periodStart(period, new Date()), [period]);
  const needle = q.trim().toLowerCase();
  const archive = store.contentItems
    .filter((c) => c.status === 'Published')
    .filter((c) => !start || new Date(`${c.publishedAt ?? c.deadline}T12:00:00`) >= start)
    .sort((a, b) => (b.publishedAt ?? b.deadline).localeCompare(a.publishedAt ?? a.deadline));
  const rows = archive.filter((c) => (platform === 'All' || c.platform === platform)
    && (!needle || [c.title, c.platform, c.branch ?? '', c.person ?? '', c.assignee].some((v) => v.toLowerCase().includes(needle))));
  const mark = (text: string) => {
    if (!needle) return text;
    const i = text.toLowerCase().indexOf(needle);
    return i < 0 ? text : <>{text.slice(0, i)}<mark className="rounded bg-amber-100 px-0.5 text-navy">{text.slice(i, i + needle.length)}</mark>{text.slice(i + needle.length)}</>;
  };

  return (
    <div className="space-y-4">
      <PeriodHeader period={period} onChange={setPeriod} what="Published content:" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Did we already make this? Try "Canada"' className="w-full rounded-lg border border-grey-border py-2.5 pl-9 pr-8 text-sm focus:border-navy-light focus:outline-none" />
          {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy"><X size={14} /></button>}
        </div>
        <div className="flex-1"><Chips options={['All', ...CONTENT_PLATFORMS]} value={platform} onChange={setPlatform} /></div>
      </div>
      {needle && (
        <p className={`rounded-lg px-3 py-2 text-sm ${rows.length ? 'bg-emerald-50 text-emerald-800' : 'bg-grey-bg text-gray-600'}`}>
          {rows.length ? `Yes — ${rows.length} published piece${rows.length === 1 ? '' : 's'} about “${q.trim()}”.` : `Nothing published about “${q.trim()}” in this period — it's fair game.`}
        </p>
      )}
      <TableBox min={820}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Content Title</Th><Th>Date</Th><Th>Platform</Th><Th>Branch / Person</Th><Th>Status</Th><Th>Published Link</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((c) => (
            <tr key={c.id}>
              <Td className="font-medium text-navy">{mark(c.title)}</Td>
              <Td className="whitespace-nowrap text-gray-500">{whenLabel(c.publishedAt ?? c.deadline)}</Td>
              <Td><SourceTag source={c.platform} /></Td>
              <Td className="text-gray-600">{c.branch ? <>{mark(c.branch)}<span className="block text-[11px] text-gray-400">{mark(c.person ?? '')}</span></> : <span className="text-gray-400">Marketing team</span>}</Td>
              <Td><StatusPill status={c.status} /></Td>
              <Td>
                {c.publishedLink
                  ? <a href={c.publishedLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-navy transition-colors hover:text-navy-light">Open <ExternalLink size={11} /></a>
                  : <span className="text-xs text-gray-400">No link</span>}
              </Td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={6} text={archive.length ? 'No published content matches.' : 'Nothing published in this period.'} />}
        </tbody>
      </TableBox>
      <p className="text-[11px] text-gray-400">Read-only archive of published content. Mark a piece Published on the Content Calendar and it appears here.</p>
    </div>
  );
}
