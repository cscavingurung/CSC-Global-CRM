import { useMemo, useState } from 'react';
import { Check, Film, Paperclip, Pencil, ChevronLeft, ChevronRight, Clock, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { useMarketing } from './mktContext';
import {
  CampaignTag, Chips, Field, GhostButton, Modal, PageIntro, Pill, PlatformCheckboxes, PlatformTags, PrimaryButton, SelectInput,
  SourceTag, TextArea, TextInput,
} from './MktShared';
import { DESIGN_STAGES, MKT_CAN, SOCIAL_PLATFORMS, dayOf, isoToday, shortDay } from '../../marketingDept';
import { parseLeadDate } from '../../marketing';
import { DeliveredFile, DesignStage, DesignTask, MarketingRole, SocialPlatform, SocialPost, VideoStatus, VideoTask } from '../../types';
import { DESIGN_STYLES, deadlineKey, deadlineText, deadlineTone } from './mktUtils';

const DESIGN_PLATFORMS: SocialPlatform[] = [...SOCIAL_PLATFORMS, 'Website'];
const DIMENSIONS: Record<SocialPlatform, string[]> = {
  Facebook: ['1080×1080', '1200×630', '1080×1350'],
  Instagram: ['1080×1080', '1080×1350', '1080×1920'],
  LinkedIn: ['1200×627', '1080×1080', '1080×1350'],
  TikTok: ['1080×1920'],
  Website: ['1920×600', '1200×630', '800×800'],
};

// ── Production Queue (designer Kanban) ──────────────────────────────────────
/** New design request, or editing one that's still Requested / In Progress. One card covers every platform ticked. */
function DesignRequestModal({ task, onClose }: { task?: DesignTask; onClose: () => void }) {
  const { store, actions } = useMarketing();
  const [title, setTitle] = useState(task?.title ?? '');
  const [brief, setBrief] = useState(task?.brief ?? '');
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(task?.platforms ?? ['Instagram']);
  const [sizes, setSizes] = useState<Partial<Record<SocialPlatform, string>>>(task?.sizes ?? {});
  const sizeOf = (p: SocialPlatform) => sizes[p] ?? DIMENSIONS[p][0];
  // A size saved earlier may not be one of today's presets — keep it selectable.
  const sizeOptions = (p: SocialPlatform) => (sizes[p] && !DIMENSIONS[p].includes(sizes[p]!) ? [sizes[p]!, ...DIMENSIONS[p]] : DIMENSIONS[p]);
  const [deadline, setDeadline] = useState(task?.deadline ?? '');
  const [deadlineTime, setDeadlineTime] = useState(task?.deadlineTime ?? '17:00');
  const [campaignId, setCampaignId] = useState(task?.campaignId ?? '');
  const valid = title.trim() && brief.trim() && deadline && deadlineTime && platforms.length > 0;
  const submit = () => {
    const fields = {
      title: title.trim(), brief: brief.trim(), platforms, deadline, deadlineTime, campaignId: campaignId || undefined,
      sizes: Object.fromEntries(platforms.map((p) => [p, sizeOf(p)])),
    };
    if (task) actions.updateDesignTask(task.id, fields);
    else actions.createDesignTask(fields);
    onClose();
  };
  return (
    <Modal title={task ? `Edit “${task.title}”` : 'New design request'} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) submit(); }}>
        <Field label="Title" required><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Brief" required><TextArea value={brief} placeholder="Message, must-haves, references" onChange={(e) => setBrief(e.target.value)} /></Field>
        <PlatformCheckboxes options={DESIGN_PLATFORMS} value={platforms} onChange={setPlatforms} />
        {platforms.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {platforms.map((p) => (
              <Field key={p} label={platforms.length > 1 ? `${p} size` : 'Dimensions'} required>
                <SelectInput value={sizeOf(p)} onChange={(v) => setSizes((cur) => ({ ...cur, [p]: v }))} label={`${p} size`}>
                  {sizeOptions(p).map((d) => <option key={d}>{d}</option>)}
                </SelectInput>
              </Field>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Deadline" required><TextInput type="date" min={task ? undefined : isoToday()} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          <Field label="Time" required><TextInput type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} /></Field>
          <Field label="Campaign">
            <SelectInput value={campaignId} onChange={setCampaignId} label="Campaign">
              <option value="">None</option>
              {store.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectInput>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}>{task ? 'Save changes' : 'Add to queue'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

const VIDEO_PLATFORMS: VideoTask['platforms'] = [...SOCIAL_PLATFORMS, 'YouTube'];
// 'As per footage' keeps whatever length the raw video supports; 'Other' takes a typed length.
const VIDEO_LENGTHS = ['As per footage', '15 sec', '30 sec', '60 sec', '90 sec', '2–3 min', '5+ min', 'Other'];

/** Video editing straight to the designer — marketing supplies the footage, no branch involved. */
function VideoRequestModal({ onClose }: { onClose: () => void }) {
  const { actions } = useMarketing();
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [platforms, setPlatforms] = useState<VideoTask['platforms']>(['Instagram']);
  const [duration, setDuration] = useState('As per footage');
  const [customLength, setCustomLength] = useState('');
  const length = duration === 'Other' ? customLength.trim() : duration;
  const [deadline, setDeadline] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('17:00');
  const [priority, setPriority] = useState<NonNullable<VideoTask['priority']>>('Medium');
  const link = sourceLink.trim();
  const linkOk = /^https?:\/\/\S+$/i.test(link);
  const valid = title.trim() && instructions.trim() && linkOk && deadline && deadlineTime && platforms.length > 0 && length;
  return (
    <Modal title="New video request" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) {
        actions.createVideoTask({ title: title.trim(), instructions: instructions.trim(), sourceLink: link, platforms, duration: length, deadline, deadlineTime, priority });
        onClose();
      } }}>
        <Field label="Title" required><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Edit instructions" required><TextArea value={instructions} placeholder="Cuts, captions, music, logo, call to action" onChange={(e) => setInstructions(e.target.value)} /></Field>
        <Field label="Footage link" required>
          <TextInput value={sourceLink} placeholder="Google Drive / Dropbox link to the raw footage" onChange={(e) => setSourceLink(e.target.value)} />
          {link && !linkOk && <p className="mt-1 text-xs text-amber-700">Paste a full link starting with https://</p>}
        </Field>
        <PlatformCheckboxes options={VIDEO_PLATFORMS} value={platforms} onChange={setPlatforms} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Length" required>
            <SelectInput value={duration} onChange={setDuration} label="Length">{VIDEO_LENGTHS.map((d) => <option key={d}>{d}</option>)}</SelectInput>
            {duration === 'Other' && <div className="mt-2"><TextInput aria-label="Video length" value={customLength} placeholder="e.g. 45 sec" onChange={(e) => setCustomLength(e.target.value)} /></div>}
          </Field>
          <Field label="Deadline" required><TextInput type="date" min={isoToday()} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          <Field label="Time" required><TextInput type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} /></Field>
          <Field label="Priority">
            <SelectInput value={priority} onChange={(v) => setPriority(v as NonNullable<VideoTask['priority']>)} label="Priority">
              {(['High', 'Medium', 'Low'] as const).map((p) => <option key={p}>{p}</option>)}
            </SelectInput>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}>Send to designer</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

/** One approved design → one scheduled post per platform, each with its own caption and time. */
function SchedulePostModal({ task, onClose }: { task: DesignTask; onClose: () => void }) {
  const { actions } = useMarketing();
  const [slots, setSlots] = useState(() => task.platforms.map((platform) => ({ platform, caption: task.title, date: isoToday(), time: '10:00' })));
  const set = (i: number, patch: Partial<(typeof slots)[number]>) => setSlots((cur) => cur.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const valid = slots.every((x) => x.caption.trim() && x.date && x.time);
  const submit = () => {
    slots.forEach(({ platform, caption, date, time }) => {
      const [h, m] = time.split(':').map(Number);
      const stamp = `${date} ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
      actions.schedulePost({ platform, caption: caption.trim(), scheduledAt: stamp, campaignId: task.campaignId, designTaskId: task.id });
    });
    actions.moveDesign(task.id, 'Scheduled');
    onClose();
  };
  return (
    <Modal title={`Schedule “${task.title}”`} onClose={onClose}>
      <div className="space-y-4">
        {slots.map((x, i) => (
          <div key={x.platform} className={`space-y-3 ${i > 0 ? 'border-t border-grey-border pt-4' : ''}`}>
            <p className="flex items-center gap-2 text-xs text-gray-500"><SourceTag source={x.platform} /> {task.sizes[x.platform]}</p>
            <Field label="Caption" required><TextArea value={x.caption} onChange={(e) => set(i, { caption: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required><TextInput type="date" min={isoToday()} value={x.date} onChange={(e) => set(i, { date: e.target.value })} /></Field>
              <Field label="Time" required><TextInput type="time" value={x.time} onChange={(e) => set(i, { time: e.target.value })} /></Field>
            </div>
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton disabled={!valid} onClick={submit}>{slots.length > 1 ? `Schedule ${slots.length} posts` : 'Schedule post'}</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/** In-app confirm (no browser dialog) before a request is removed for good. */
function DeleteTaskModal({ title, kind, onConfirm, onClose }: { title: string; kind: 'design' | 'video'; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={`Delete “${title}”?`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">The {kind} request is removed from this queue and from the designer's list. This can't be undone.</p>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <GhostButton danger onClick={() => { onConfirm(); onClose(); }}><Trash2 size={14} /> Delete</GhostButton>
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

const hasPendingPosts = (posts: SocialPost[], t: DesignTask) => t.stage === 'Scheduled' && posts.some((p) => p.designTaskId === t.id && p.status === 'Scheduled');

function UnscheduleModal({ task, then, onClose }: { task: DesignTask; then?: DesignStage; onClose: () => void }) {
  const { store, actions } = useMarketing();
  const pending = store.posts.filter((p) => p.designTaskId === task.id && p.status === 'Scheduled');
  const published = store.posts.some((p) => p.designTaskId === task.id && p.status === 'Published');
  return (
    <Modal title={`Unschedule “${task.title}”?`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">These posts will be cancelled:</p>
        <ul className="space-y-1 text-sm">{pending.map((p) => <li key={p.id} className="flex items-center gap-2"><SourceTag source={p.platform} /> <span className="text-gray-600">{p.scheduledAt}</span></li>)}</ul>
        <p className="text-sm text-gray-600">{published
          ? 'Posts already published stay as they are, so the card stays in Scheduled.'
          : then && then !== 'Approved' ? `The card then moves back to ${then}.`
            : 'The card goes back to Approved, where you can schedule it again or delete it.'}</p>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Keep scheduled</GhostButton>
          <PrimaryButton onClick={() => { actions.unscheduleDesign(task.id); if (then && then !== 'Approved' && !published) actions.moveDesign(task.id, then); onClose(); }}><Undo2 size={14} /> Unschedule</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

type DropMove = 'move' | 'schedule' | 'sendBack' | 'unschedule';
/**
 * What dropping a card on a column does. Forward is one step at a time, same as the card's buttons.
 * Back can go to any earlier column: a reviewer sending work back to In Progress writes a note, and a
 * Scheduled card is unscheduled first (only while none of its posts have gone out).
 */
function dropMove(t: DesignTask, to: DesignStage, role: MarketingRole, posts: SocialPost[]): DropMove | null {
  const from = t.stage;
  const step = DESIGN_STAGES.indexOf(to) - DESIGN_STAGES.indexOf(from);
  const design = MKT_CAN.design(role);
  const review = MKT_CAN.approveDesign(role);
  if (step === 1) {
    if (from === 'Requested' || from === 'In Progress') return design ? 'move' : null;
    if (from === 'Ready for Review') return review ? 'move' : null;
    return from === 'Approved' && MKT_CAN.schedulePosts(role) ? 'schedule' : null;
  }
  if (step >= 0) return null;
  if (from === 'Scheduled') {
    const published = posts.some((p) => p.designTaskId === t.id && p.status === 'Published');
    return MKT_CAN.schedulePosts(role) && hasPendingPosts(posts, t) && (to === 'Approved' || !published) ? 'unschedule' : null;
  }
  if (from === 'Approved' || from === 'Ready for Review') {
    if (review) return to === 'In Progress' ? 'sendBack' : 'move';
    // The designer can pull their own submission back, as in their queue.
    return from === 'Ready for Review' && design ? 'move' : null;
  }
  return design ? 'move' : null; // In Progress → Requested
}

export function DesignCard({ t, compact }: { t: DesignTask; compact?: boolean }) {
  const { store, role, actions } = useMarketing();
  const [sendingBack, setSendingBack] = useState(false);
  const [editing, setEditing] = useState(false);
  const done = t.stage === 'Approved' || t.stage === 'Scheduled';
  const canEdit = MKT_CAN.requestContent(role) && (t.stage === 'Requested' || t.stage === 'In Progress');
  // Scheduled designs have posts pointing at them, so they stay.
  const canDelete = MKT_CAN.requestContent(role) && t.stage !== 'Scheduled';
  const [deleting, setDeleting] = useState(false);
  const canApprove = MKT_CAN.approveDesign(role);

  // Every other move — start, submit, approve, schedule, unschedule — is done by dragging on the board.
  const reviewing = t.stage === 'Ready for Review' && canApprove;

  return (
    <div className="dissolve-in rounded-lg border border-grey-border bg-white p-3 transition-colors hover:border-navy-light">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-navy">{t.title}</p>
        {!compact && (canEdit || canDelete) && (
          <span className="flex shrink-0">
            {canEdit && <button type="button" aria-label={`Edit ${t.title}`} onClick={() => setEditing(true)} className="rounded p-1 text-gray-400 transition-colors hover:text-navy-light"><Pencil size={13} /></button>}
            {canDelete && <button type="button" aria-label={`Delete ${t.title}`} onClick={() => setDeleting(true)} className="rounded p-1 text-gray-400 transition-colors hover:text-red-600"><Trash2 size={13} /></button>}
          </span>
        )}
      </div>
      <div className="mt-1.5"><PlatformTags platforms={t.platforms} /></div>
      {!compact && <p className="mt-1 line-clamp-3 text-xs text-gray-600">{t.brief}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {t.platforms.map((p) => (
          <span key={p} className="rounded bg-grey-bg px-1.5 py-0.5 font-medium text-gray-600">{t.platforms.length > 1 ? `${p} ` : ''}{t.sizes[p]}</span>
        ))}
        <span className={`inline-flex items-center gap-1 ${deadlineTone(t.deadline, done, t.deadlineTime)}`}><Clock size={11} /> {deadlineText(t.deadline, t.deadlineTime)}</span>
      </div>
      {t.campaignId && !compact && <div className="mt-2"><CampaignTag campaigns={store.campaigns} id={t.campaignId} /></div>}
      {t.reviewNote && t.stage === 'In Progress' && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Review note: {t.reviewNote}</p>}
      {!compact && !!t.finalFiles?.length && <FileLine files={t.finalFiles} />}
      {!compact && reviewing && (
        <div className="mt-3 flex gap-1.5">
          <GhostButton small onClick={() => setSendingBack(true)}><RotateCcw size={12} /> Send back</GhostButton>
        </div>
      )}
      {sendingBack && <SendBackModal task={t} onClose={() => setSendingBack(false)} />}
      {editing && <DesignRequestModal task={t} onClose={() => setEditing(false)} />}
      {deleting && <DeleteTaskModal title={t.title} kind="design" onConfirm={() => actions.deleteDesignTask(t.id)} onClose={() => setDeleting(false)} />}
    </div>
  );
}

export function ProductionQueue() {
  const { store, role, actions } = useMarketing();
  const [adding, setAdding] = useState<'design' | 'video' | null>(null);
  const [platform, setPlatform] = useState<'All' | SocialPlatform>('All');
  const tasks = store.designTasks.filter((t) => platform === 'All' || t.platforms.includes(platform));
  const [dragging, setDragging] = useState<DesignTask | null>(null);
  const [over, setOver] = useState<DesignStage | null>(null);
  // Drops that need more input open the same dialog the button would.
  const [dropped, setDropped] = useState<{ task: DesignTask; kind: Exclude<DropMove, 'move'>; to: DesignStage } | null>(null);
  const canDrag = (t: DesignTask) => DESIGN_STAGES.some((s) => dropMove(t, s, role, store.posts));
  const drop = (stage: DesignStage) => {
    const t = dragging;
    setDragging(null); setOver(null);
    const kind = t && dropMove(t, stage, role, store.posts);
    if (!t || !kind) return;
    if (kind === 'move') actions.moveDesign(t.id, stage);
    else setDropped({ task: t, kind, to: stage });
  };
  return (
    <div className="space-y-4">
      <PageIntro text="Design and video work for the designer, from request to scheduled post. Video edits are reviewed below the board.">
        {MKT_CAN.requestContent(role) && (
          <div className="flex flex-wrap gap-2">
            <GhostButton onClick={() => setAdding('video')}><Film size={15} /> New video request</GhostButton>
            <PrimaryButton onClick={() => setAdding('design')}><Plus size={15} /> New design request</PrimaryButton>
          </div>
        )}
      </PageIntro>
      <Chips options={['All', ...DESIGN_PLATFORMS] as const} value={platform} onChange={setPlatform} />
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1000px] grid-cols-5 gap-3">
          {DESIGN_STAGES.map((stage) => {
            const col = tasks.filter((t) => t.stage === stage).sort((a, b) => deadlineKey(a).localeCompare(deadlineKey(b)));
            const target = !!dragging && !!dropMove(dragging, stage, role, store.posts);
            return (
              <div key={stage}
                onDragOver={(e) => { if (target) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== stage) setOver(stage); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
                onDrop={(e) => { e.preventDefault(); drop(stage); }}
                className={`rounded-xl border p-2 transition-colors ${over === stage && target ? 'border-navy-light bg-navy/5' : target ? 'border-dashed border-navy-light/60 bg-grey-bg/50' : 'border-grey-border bg-grey-bg/50'} ${dragging && !target && dragging.stage !== stage ? 'opacity-60' : ''}`}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <Pill text={stage} cls={DESIGN_STYLES[stage]} />
                  <span className="text-xs font-semibold text-gray-500">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((t) => {
                    const draggable = canDrag(t);
                    return (
                      <div key={t.id} draggable={draggable}
                        onDragStart={(e) => { if (e.target !== e.currentTarget) return; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); setDragging(t); }}
                        onDragEnd={() => { setDragging(null); setOver(null); }}
                        className={`${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging?.id === t.id ? 'opacity-50' : ''}`}>
                        <DesignCard t={t} />
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
      <VideoReview />
      {dropped?.kind === 'schedule' && <SchedulePostModal task={dropped.task} onClose={() => setDropped(null)} />}
      {dropped?.kind === 'sendBack' && <SendBackModal task={dropped.task} onClose={() => setDropped(null)} />}
      {dropped?.kind === 'unschedule' && <UnscheduleModal task={dropped.task} then={dropped.to} onClose={() => setDropped(null)} />}
      {adding === 'design' && <DesignRequestModal onClose={() => setAdding(null)} />}
      {adding === 'video' && <VideoRequestModal onClose={() => setAdding(null)} />}
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
  const [removing, setRemoving] = useState<VideoTask | null>(null);
  const canDelete = MKT_CAN.requestContent(role);
  const [note, setNote] = useState('');
  const canApprove = MKT_CAN.approveDesign(role);
  const order: Record<VideoStatus, number> = { 'Ready for Review': 0, 'In Progress': 1, 'To Edit': 2, Completed: 3 };
  const rows = [...store.videoTasks].sort((a, b) => order[a.status] - order[b.status] || deadlineKey(a).localeCompare(deadlineKey(b)));
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
                <td className="px-4 py-2.5 text-gray-600"><PlatformTags platforms={v.platforms} /> <span className="text-xs">{v.duration}</span></td>
                <td className={`whitespace-nowrap px-4 py-2.5 text-xs ${deadlineTone(v.deadline, v.status === 'Completed', v.deadlineTime)}`}>{v.status === 'Completed' ? shortDay(v.deadline) : deadlineText(v.deadline, v.deadlineTime)}</td>
                <td className="px-4 py-2.5"><Pill text={v.status} cls={VIDEO_STYLES[v.status]} /></td>
                <td className="max-w-[200px] px-4 py-2.5">{v.finalFiles?.length ? <FileLine files={v.finalFiles} /> : <span className="text-xs text-gray-400">—</span>}</td>
                <td className="px-4 py-2.5 text-right">
                  {v.status === 'Ready for Review' && canApprove ? (
                    <span className="inline-flex gap-1.5">
                      <GhostButton small onClick={() => { setBack(v); setNote(''); }}><RotateCcw size={12} /> Send back</GhostButton>
                      <PrimaryButton small onClick={() => actions.moveVideo(v.id, 'Completed')}><Check size={12} /> Approve</PrimaryButton>
                    </span>
                  ) : <span className="text-xs text-gray-400">{v.status === 'Completed' ? 'Approved' : 'With designer'}</span>}
                  {canDelete && v.status !== 'Completed' && <button type="button" aria-label={`Delete ${v.title}`} onClick={() => setRemoving(v)} className="ml-2 rounded p-1 align-middle text-gray-400 transition-colors hover:text-red-600"><Trash2 size={13} /></button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No video edits.</td></tr>}
          </tbody>
        </table>
      </div>
      {removing && <DeleteTaskModal title={removing.title} kind="video" onConfirm={() => actions.deleteVideoTask(removing.id)} onClose={() => setRemoving(null)} />}
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
      id: t.id, type: 'Designs' as const, title: t.title, meta: t.platforms.map((p) => `${p} ${t.sizes[p] ?? ''}`.trim()).join(' · '), campaignId: t.campaignId, tag: t.stage,
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
