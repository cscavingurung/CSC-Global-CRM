import { useMemo, useState } from 'react';
import { ArrowRight, Check, Paperclip, ChevronLeft, ChevronRight, Clock, Plus, RotateCcw } from 'lucide-react';
import { useMarketing } from './mktContext';
import {
  CampaignTag, Chips, Field, GhostButton, Modal, PageIntro, Pill, PrimaryButton, SelectInput,
  SourceTag, TextArea, TextInput,
} from './MktShared';
import { DESIGN_STAGES, LEAD_CHANNELS, MKT_CAN, dayOf, isoToday, shortDay } from '../../marketingDept';
import { parseLeadDate } from '../../marketing';
import { DeliveredFile, DesignStage, DesignTask, LeadChannel, VideoStatus, VideoTask } from '../../types';
import { DESIGN_STYLES, deadlineText, deadlineTone } from './mktUtils';

const DIMENSIONS: Record<LeadChannel, string[]> = {
  Facebook: ['1080×1080', '1200×630', '1080×1350'],
  Instagram: ['1080×1080', '1080×1350', '1080×1920'],
  TikTok: ['1080×1920'],
  Website: ['1920×600', '1200×630', '800×800'],
};

// ── Production Queue (designer Kanban) ──────────────────────────────────────
function NewDesignModal({ onClose }: { onClose: () => void }) {
  const { store, actions } = useMarketing();
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [platform, setPlatform] = useState<LeadChannel>('Instagram');
  const [dimensions, setDimensions] = useState(DIMENSIONS.Instagram[0]);
  const [deadline, setDeadline] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const valid = title.trim() && brief.trim() && deadline && dimensions;
  return (
    <Modal title="New design request" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) { actions.createDesignTask({ title: title.trim(), brief: brief.trim(), platform, dimensions, deadline, campaignId: campaignId || undefined }); onClose(); } }}>
        <Field label="Title" required><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Brief" required><TextArea value={brief} placeholder="Message, must-haves, references" onChange={(e) => setBrief(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platform" required>
            <SelectInput value={platform} onChange={(v) => { setPlatform(v as LeadChannel); setDimensions(DIMENSIONS[v as LeadChannel][0]); }} label="Platform">
              {LEAD_CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </SelectInput>
          </Field>
          <Field label="Dimensions" required>
            <SelectInput value={dimensions} onChange={setDimensions} label="Dimensions">
              {DIMENSIONS[platform].map((d) => <option key={d}>{d}</option>)}
            </SelectInput>
          </Field>
          <Field label="Deadline" required><TextInput type="date" min={isoToday()} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          <Field label="Campaign">
            <SelectInput value={campaignId} onChange={setCampaignId} label="Campaign">
              <option value="">None</option>
              {store.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectInput>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}>Add to queue</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function SchedulePostModal({ task, onClose }: { task: DesignTask; onClose: () => void }) {
  const { actions } = useMarketing();
  const [caption, setCaption] = useState(task.title);
  const [date, setDate] = useState(isoToday());
  const [time, setTime] = useState('10:00');
  const valid = caption.trim() && date && time;
  const submit = () => {
    const [h, m] = time.split(':').map(Number);
    const stamp = `${date} ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    actions.schedulePost({ platform: task.platform, caption: caption.trim(), scheduledAt: stamp, campaignId: task.campaignId, designTaskId: task.id });
    actions.moveDesign(task.id, 'Scheduled');
    onClose();
  };
  return (
    <Modal title={`Schedule “${task.title}”`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Posts to <b className="text-navy">{task.platform}</b> · {task.dimensions}</p>
        <Field label="Caption" required><TextArea value={caption} onChange={(e) => setCaption(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required><TextInput type="date" min={isoToday()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time" required><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton disabled={!valid} onClick={submit}>Schedule post</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function SendBackModal({ task, onClose }: { task: DesignTask; onClose: () => void }) {
  const { actions } = useMarketing();
  const [note, setNote] = useState('');
  return (
    <Modal title={`Send back “${task.title}”`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="What needs changing?" required><TextArea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton disabled={!note.trim()} onClick={() => { actions.moveDesign(task.id, 'In Progress', note.trim()); onClose(); }}>Send back to In Progress</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function DesignCard({ t, compact }: { t: DesignTask; compact?: boolean }) {
  const { store, role, actions } = useMarketing();
  const [scheduling, setScheduling] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const done = t.stage === 'Approved' || t.stage === 'Scheduled';
  const canDesign = MKT_CAN.design(role);
  const canApprove = MKT_CAN.approveDesign(role);

  const next: { label: string; run: () => void } | null =
    t.stage === 'Requested' && canDesign ? { label: 'Start', run: () => actions.moveDesign(t.id, 'In Progress') }
      : t.stage === 'In Progress' && canDesign ? { label: 'Send to review', run: () => actions.moveDesign(t.id, 'Ready for Review') }
        : t.stage === 'Ready for Review' && canApprove ? { label: 'Approve', run: () => actions.moveDesign(t.id, 'Approved') }
          : t.stage === 'Approved' && MKT_CAN.schedulePosts(role) ? { label: 'Schedule', run: () => setScheduling(true) }
            : null;

  return (
    <div className="dissolve-in rounded-lg border border-grey-border bg-white p-3 transition-colors hover:border-navy-light">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-navy">{t.title}</p>
        <SourceTag source={t.platform} />
      </div>
      {!compact && <p className="mt-1 line-clamp-3 text-xs text-gray-600">{t.brief}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="rounded bg-grey-bg px-1.5 py-0.5 font-medium text-gray-600">{t.dimensions}</span>
        <span className={`inline-flex items-center gap-1 ${deadlineTone(t.deadline, done)}`}><Clock size={11} /> {deadlineText(t.deadline)}</span>
      </div>
      {t.campaignId && !compact && <div className="mt-2"><CampaignTag campaigns={store.campaigns} id={t.campaignId} /></div>}
      {t.reviewNote && t.stage === 'In Progress' && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Review note: {t.reviewNote}</p>}
      {!compact && !!t.finalFiles?.length && <FileLine files={t.finalFiles} />}
      {!compact && (next || (t.stage === 'Ready for Review' && canApprove)) && (
        <div className="mt-3 flex gap-1.5">
          {t.stage === 'Ready for Review' && canApprove && <GhostButton small onClick={() => setSendingBack(true)}><RotateCcw size={12} /> Send back</GhostButton>}
          {next && <PrimaryButton small onClick={next.run}>{next.label} <ArrowRight size={12} /></PrimaryButton>}
        </div>
      )}
      {scheduling && <SchedulePostModal task={t} onClose={() => setScheduling(false)} />}
      {sendingBack && <SendBackModal task={t} onClose={() => setSendingBack(false)} />}
    </div>
  );
}

export function ProductionQueue() {
  const { store, role } = useMarketing();
  const [adding, setAdding] = useState(false);
  const [platform, setPlatform] = useState<'All' | LeadChannel>('All');
  const tasks = store.designTasks.filter((t) => platform === 'All' || t.platform === platform);
  return (
    <div className="space-y-4">
      <PageIntro text="Design work from request to scheduled post. Cards show the brief, platform, dimensions and deadline.">
        {MKT_CAN.requestContent(role) && <PrimaryButton onClick={() => setAdding(true)}><Plus size={15} /> New design request</PrimaryButton>}
      </PageIntro>
      <Chips options={['All', ...LEAD_CHANNELS] as const} value={platform} onChange={setPlatform} />
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1000px] grid-cols-5 gap-3">
          {DESIGN_STAGES.map((stage) => {
            const col = tasks.filter((t) => t.stage === stage).sort((a, b) => a.deadline.localeCompare(b.deadline));
            return (
              <div key={stage} className="rounded-xl border border-grey-border bg-grey-bg/50 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <Pill text={stage} cls={DESIGN_STYLES[stage]} />
                  <span className="text-xs font-semibold text-gray-500">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((t) => <DesignCard key={t.id} t={t} />)}
                  {col.length === 0 && <p className="px-2 py-6 text-center text-xs text-gray-400">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <VideoReview />
      {adding && <NewDesignModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function FileLine({ files }: { files: DeliveredFile[] }) {
  const f = files[files.length - 1];
  return (
    <p className="mt-2 flex items-center gap-1 truncate text-[11px] text-navy" title={f.name}>
      <Paperclip size={11} className="shrink-0 text-gray-400" />
      {f.url && /^https?:/.test(f.url) ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-navy-light">{f.name}</a> : <span className="truncate">{f.name}</span>}
      {files.length > 1 && <span className="text-gray-400">+{files.length - 1}</span>}
    </p>
  );
}

const VIDEO_STYLES: Record<VideoStatus, string> = {
  'To Edit': 'bg-amber-50 text-amber-700', 'In Progress': 'bg-blue-50 text-blue-700',
  'Ready for Review': 'bg-violet-50 text-violet-700', Completed: 'bg-emerald-50 text-emerald-700',
};

/** Video edits from the designer — reviewers approve them here or send them back. */
function VideoReview() {
  const { store, role, actions } = useMarketing();
  const [back, setBack] = useState<VideoTask | null>(null);
  const [note, setNote] = useState('');
  const canApprove = MKT_CAN.approveDesign(role);
  const order: Record<VideoStatus, number> = { 'Ready for Review': 0, 'In Progress': 1, 'To Edit': 2, Completed: 3 };
  const rows = [...store.videoTasks].sort((a, b) => order[a.status] - order[b.status] || a.deadline.localeCompare(b.deadline));
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-navy">Video edits <span className="font-normal text-gray-400">· {store.videoTasks.filter((v) => v.status === 'Ready for Review').length} waiting for review</span></h3>
      <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-grey-border bg-grey-bg/50 text-left text-xs font-semibold text-gray-500">
            <tr><th className="px-4 py-2.5">Video</th><th className="px-4 py-2.5">Platform · Length</th><th className="px-4 py-2.5">Deadline</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Final file</th><th className="px-4 py-2.5 text-right">Review</th></tr>
          </thead>
          <tbody className="divide-y divide-grey-border">
            {rows.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-2.5"><span className="font-medium text-navy">{v.title}</span>{v.person && <span className="block text-[11px] text-gray-400">Footage: {v.person} · {v.branch}</span>}</td>
                <td className="px-4 py-2.5 text-gray-600"><SourceTag source={v.platform} /> <span className="text-xs">{v.duration}</span></td>
                <td className={`whitespace-nowrap px-4 py-2.5 text-xs ${deadlineTone(v.deadline, v.status === 'Completed')}`}>{v.status === 'Completed' ? shortDay(v.deadline) : deadlineText(v.deadline)}</td>
                <td className="px-4 py-2.5"><Pill text={v.status} cls={VIDEO_STYLES[v.status]} /></td>
                <td className="max-w-[200px] px-4 py-2.5">{v.finalFiles?.length ? <FileLine files={v.finalFiles} /> : <span className="text-xs text-gray-400">—</span>}</td>
                <td className="px-4 py-2.5 text-right">
                  {v.status === 'Ready for Review' && canApprove ? (
                    <span className="inline-flex gap-1.5">
                      <GhostButton small onClick={() => { setBack(v); setNote(''); }}><RotateCcw size={12} /> Send back</GhostButton>
                      <PrimaryButton small onClick={() => actions.moveVideo(v.id, 'Completed')}><Check size={12} /> Approve</PrimaryButton>
                    </span>
                  ) : <span className="text-xs text-gray-400">{v.status === 'Completed' ? 'Approved' : 'With designer'}</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No video edits.</td></tr>}
          </tbody>
        </table>
      </div>
      {back && (
        <Modal title={`Send back “${back.title}”`} onClose={() => setBack(null)}>
          <div className="space-y-3">
            <Field label="What needs changing?" required><TextArea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setBack(null)}>Cancel</GhostButton>
              <PrimaryButton disabled={!note.trim()} onClick={() => { actions.moveVideo(back.id, 'In Progress', note.trim()); setBack(null); }}>Send back to designer</PrimaryButton>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

// ── Content Calendar ────────────────────────────────────────────────────────
interface CalItem { day: string; label: string; cls: string; kind: string }

export function ContentCalendar() {
  const { store } = useMarketing();
  const [offset, setOffset] = useState(0);
  const today = isoToday();
  const base = new Date();
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const items = useMemo<CalItem[]>(() => {
    const out: CalItem[] = [];
    store.posts.forEach((p) => {
      const d = parseLeadDate(p.scheduledAt);
      out.push({ day: d ? isoToday(d) : dayOf(p.scheduledAt), label: `${p.platform}: ${p.caption}`, cls: p.status === 'Published' ? 'bg-emerald-50 text-emerald-700' : 'bg-navy/10 text-navy', kind: p.status === 'Published' ? 'Published post' : 'Scheduled post' });
    });
    store.designTasks.filter((t) => t.stage !== 'Scheduled').forEach((t) => out.push({ day: t.deadline, label: `Design due: ${t.title}`, cls: 'bg-violet-50 text-violet-700', kind: 'Design deadline' }));
    store.contentRequests.filter((r) => r.status === 'Waiting').forEach((r) => out.push({ day: r.deadline, label: `${r.targetBranch}: ${r.needed}`, cls: 'bg-amber-50 text-amber-700', kind: 'Branch content due' }));
    return out;
  }, [store]);

  const firstWeekday = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, i) => {
    const n = i - firstWeekday + 1;
    return n >= 1 && n <= daysInMonth ? isoToday(new Date(month.getFullYear(), month.getMonth(), n)) : null;
  });
  const legend = [['Scheduled post', 'bg-navy/10 text-navy'], ['Published post', 'bg-emerald-50 text-emerald-700'], ['Design deadline', 'bg-violet-50 text-violet-700'], ['Branch content due', 'bg-amber-50 text-amber-700']];
  const monthItems = items.filter((i) => i.day.startsWith(isoToday(month).slice(0, 7))).sort((a, b) => a.day.localeCompare(b.day));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" onClick={() => setOffset((o) => o - 1)} className="rounded-lg border border-grey-border p-1.5 text-navy transition-colors hover:border-navy-light"><ChevronLeft size={16} /></button>
          <button type="button" aria-label="Next month" onClick={() => setOffset((o) => o + 1)} className="rounded-lg border border-grey-border p-1.5 text-navy transition-colors hover:border-navy-light"><ChevronRight size={16} /></button>
        </div>
        <h3 className="text-base font-semibold text-navy">{monthLabel}</h3>
        {offset !== 0 && <button type="button" onClick={() => setOffset(0)} className="text-xs font-medium text-navy-light hover:underline">Today</button>}
        <div className="flex flex-1 flex-wrap justify-end gap-1.5">{legend.map(([l, c]) => <Pill key={l} text={l} cls={c} />)}</div>
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-grey-border bg-white md:block">
        <div className="grid grid-cols-7 border-b border-grey-border bg-grey-bg/50 text-xs font-semibold text-gray-500">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="px-2 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayItems = day ? items.filter((x) => x.day === day) : [];
            return (
              <div key={i} className={`min-h-[104px] border-b border-r border-grey-border p-1.5 ${day ? '' : 'bg-grey-bg/40'}`}>
                {day && <p className={`mb-1 text-xs ${day === today ? 'inline-block rounded-full bg-navy px-1.5 font-semibold text-white' : 'text-gray-500'}`}>{Number(day.slice(8))}</p>}
                <div className="space-y-1">
                  {dayItems.slice(0, 3).map((x, j) => <p key={j} title={`${x.kind} — ${x.label}`} className={`truncate rounded px-1.5 py-0.5 text-[11px] ${x.cls}`}>{x.label}</p>)}
                  {dayItems.length > 3 && <p className="px-1 text-[11px] text-gray-400">+{dayItems.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Phone width: agenda list instead of the grid. */}
      <ul className="divide-y divide-grey-border rounded-xl border border-grey-border bg-white md:hidden">
        {monthItems.map((x, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <span className={`w-14 shrink-0 text-xs ${x.day === today ? 'font-semibold text-navy' : 'text-gray-500'}`}>{shortDay(x.day)}</span>
            <span className={`min-w-0 flex-1 truncate rounded px-1.5 py-0.5 text-xs ${x.cls}`}>{x.label}</span>
          </li>
        ))}
        {monthItems.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-400">Nothing planned this month.</li>}
      </ul>
    </div>
  );
}

// ── Content Library ─────────────────────────────────────────────────────────
export function ContentLibrary() {
  const { store } = useMarketing();
  const [type, setType] = useState<'All' | 'Designs' | 'Branch content' | 'Published'>('All');
  const [q, setQ] = useState('');
  const assets = [
    ...store.designTasks.filter((t) => t.stage === 'Approved' || t.stage === 'Scheduled').map((t) => ({
      id: t.id, type: 'Designs' as const, title: t.title, meta: `${t.platform} · ${t.dimensions}`, campaignId: t.campaignId, tag: t.stage,
    })),
    ...store.contentRequests.filter((r) => r.status !== 'Waiting').map((r) => ({
      id: r.id, type: 'Branch content' as const, title: r.topic, meta: `${r.needed} · ${r.targetCounselor}, ${r.targetBranch}`, campaignId: r.campaignId, tag: 'Received',
    })),
    ...store.posts.filter((p) => p.status === 'Published').map((p) => ({
      id: p.id, type: 'Published' as const, title: p.caption, meta: `${p.platform} · ${shortDay(dayOf(p.publishedAt ?? p.scheduledAt))}`, campaignId: p.campaignId, tag: 'Published',
    })),
  ];
  const shown = assets.filter((a) => (type === 'All' || a.type === type) && (!q.trim() || a.title.toLowerCase().includes(q.trim().toLowerCase())));
  const counts = { All: assets.length, Designs: 0, 'Branch content': 0, Published: 0 };
  assets.forEach((a) => { counts[a.type] += 1; });

  return (
    <div className="space-y-4">
      <PageIntro text="Approved designs, footage received from branches and everything already published — ready to reuse.">
        <div className="w-full sm:w-64"><TextInput value={q} placeholder="Search library" onChange={(e) => setQ(e.target.value)} /></div>
      </PageIntro>
      <Chips options={['All', 'Designs', 'Branch content', 'Published'] as const} value={type} onChange={setType} counts={counts} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((a) => (
          <div key={`${a.type}-${a.id}`} className="rounded-xl border border-grey-border bg-white p-4 transition-colors hover:border-navy-light">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{a.type}</span>
              <Pill text={a.tag} cls={a.tag === 'Published' || a.tag === 'Received' ? 'bg-emerald-50 text-emerald-700' : DESIGN_STYLES[a.tag as DesignStage]} />
            </div>
            <p className="line-clamp-2 font-medium text-navy">{a.title}</p>
            <p className="mt-1 text-xs text-gray-500">{a.meta}</p>
            {a.campaignId && <div className="mt-2"><CampaignTag campaigns={store.campaigns} id={a.campaignId} /></div>}
          </div>
        ))}
        {shown.length === 0 && <p className="rounded-xl border border-dashed border-grey-border bg-white px-4 py-10 text-center text-sm text-gray-400 sm:col-span-2 xl:col-span-3">No assets match.</p>}
      </div>
    </div>
  );
}
