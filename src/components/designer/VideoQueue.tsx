import { useState } from 'react';
import { AlertTriangle, Clock, ExternalLink, Film, Paperclip, Play, RotateCcw, Send } from 'lucide-react';
import { useDesigner, PRIORITY_STYLES, VIDEO_STATUSES, VIDEO_STYLES, priorityRank } from './designerContext';
import { BriefBlock, UploadZone } from './DesignerShared';
import { GhostButton, Modal, Pill, PrimaryButton, SourceTag } from '../marketing/MktShared';
import { deadlineText, deadlineTone } from '../marketing/mktUtils';
import { shortDay, whenLabel } from '../../marketingDept';
import { VideoTask } from '../../types';

function VideoDetail({ task, onClose }: { task: VideoTask; onClose: () => void }) {
  const { me, actions, flash } = useDesigner();
  const editable = task.status === 'To Edit' || task.status === 'In Progress';
  const files = task.finalFiles ?? [];
  return (
    <Modal title={task.title} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Pill text={task.status} cls={VIDEO_STYLES[task.status]} />
          <SourceTag source={task.platform} />
          {task.priority && <Pill text={`${task.priority} priority`} cls={PRIORITY_STYLES[task.priority]} />}
          <span className={deadlineTone(task.deadline, !editable)}>{task.status === 'Completed' ? `Completed ${whenLabel(task.completedAt)}` : deadlineText(task.deadline)}</span>
          <span className="text-gray-400">· requested by {task.requestedBy}</span>
        </div>
        {task.reviewNote && task.status === 'In Progress' && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><RotateCcw size={14} className="mt-0.5 shrink-0" /> Reviewer: “{task.reviewNote}”</p>
        )}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <BriefBlock title="Source video">
              {task.sourceLink
                ? <a href={task.sourceLink} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-grey-border px-3 py-2 text-sm font-medium text-navy transition-colors hover:border-navy-light hover:text-navy-light"><Film size={14} /> <span className="truncate">Open raw footage</span> <ExternalLink size={12} /></a>
                : <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle size={14} /> No footage yet — still with the branch.</p>}
              {task.person && <p className="mt-1.5 text-xs text-gray-500">Recorded by {task.person} ({task.branch})</p>}
            </BriefBlock>
            <BriefBlock title="Instructions"><p className="whitespace-pre-line text-sm text-gray-700">{task.instructions}</p></BriefBlock>
          </div>
          <div className="space-y-4">
            <dl className="divide-y divide-grey-border rounded-lg border border-grey-border text-sm">
              {([['Platform', task.platform], ['Duration', task.duration], ['Deadline', whenLabel(task.deadline)]] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between px-3 py-2"><dt className="text-gray-500">{k}</dt><dd className="font-medium text-navy">{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>
        <BriefBlock title="Final edited file">
          <UploadZone files={files} me={me} kind="video" accept="video/*" readOnly={!editable}
            onChange={(next) => actions.updateVideo(task.id, { finalFiles: next, ...(task.status === 'To Edit' && next.length ? { status: 'In Progress' as const } : {}) })} />
        </BriefBlock>
        <div className="flex flex-col-reverse gap-2 border-t border-grey-border pt-4 sm:flex-row sm:items-center sm:justify-end">
          {task.status === 'To Edit' && (
            <>
              {!task.sourceLink && <p className="text-xs text-amber-700 sm:mr-auto">You can start, but the footage hasn't arrived yet.</p>}
              <PrimaryButton onClick={() => { actions.updateVideo(task.id, { status: 'In Progress' }); flash('Editing started.'); }}><Play size={14} /> Start editing</PrimaryButton>
            </>
          )}
          {task.status === 'In Progress' && (
            <>
              {!files.length && <p className="text-xs text-gray-400 sm:mr-auto">Upload the edited video to submit it.</p>}
              <PrimaryButton disabled={!files.length} onClick={() => { actions.updateVideo(task.id, { status: 'Ready for Review' }); flash('Submitted for review.'); onClose(); }}><Send size={14} /> Submit for review</PrimaryButton>
            </>
          )}
          {task.status === 'Ready for Review' && (
            <>
              <p className="text-xs text-gray-500 sm:mr-auto">Waiting for the Marketing Manager to review.</p>
              <GhostButton onClick={() => { actions.updateVideo(task.id, { status: 'In Progress' }); flash('Pulled back to In Progress.'); }}><RotateCcw size={14} /> Keep editing</GhostButton>
            </>
          )}
          {task.status === 'Completed' && <p className="text-sm text-emerald-700">Approved and completed.</p>}
        </div>
      </div>
    </Modal>
  );
}

export default function VideoQueue() {
  const { data, openId } = useDesigner();
  const [openTask, setOpenTask] = useState<string | null>(openId && data.videoTasks.some((v) => v.id === openId) ? openId : null);
  const task = data.videoTasks.find((v) => v.id === openTask);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Video edits, separate from static designs. Click a card for the footage, instructions and the upload area.</p>
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[920px] grid-cols-4 gap-3">
          {VIDEO_STATUSES.map((s) => {
            const col = data.videoTasks.filter((v) => v.status === s)
              .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.deadline.localeCompare(b.deadline));
            return (
              <div key={s} className="rounded-xl border border-grey-border bg-grey-bg/50 p-2">
                <div className="mb-2 flex items-center justify-between px-1"><Pill text={s} cls={VIDEO_STYLES[s]} /><span className="text-xs font-semibold text-gray-500">{col.length}</span></div>
                <div className="space-y-2">
                  {col.map((v) => {
                    const done = v.status === 'Completed';
                    return (
                      <button key={v.id} type="button" onClick={() => setOpenTask(v.id)} className="dissolve-in block w-full rounded-lg border border-grey-border bg-white p-3 text-left transition-colors hover:border-navy-light">
                        <p className="text-sm font-semibold leading-snug text-navy">{v.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <SourceTag source={v.platform} />
                          <span className="rounded bg-grey-bg px-1.5 py-0.5 font-medium text-gray-600">{v.duration}</span>
                          {v.priority && !done && <Pill text={v.priority} cls={PRIORITY_STYLES[v.priority]} />}
                        </div>
                        <p className={`mt-2 inline-flex items-center gap-1 text-[11px] ${deadlineTone(v.deadline, done)}`}><Clock size={11} /> {done ? `Done ${shortDay(v.deadline)}` : deadlineText(v.deadline)}</p>
                        {!v.sourceLink && !done && <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700"><AlertTriangle size={11} /> Waiting for footage</p>}
                        {v.reviewNote && v.status === 'In Progress' && <p className="mt-1 line-clamp-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">↩ {v.reviewNote}</p>}
                        {!!v.finalFiles?.length && <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-gray-500"><Paperclip size={10} /> {v.finalFiles[v.finalFiles.length - 1].name}</p>}
                      </button>
                    );
                  })}
                  {col.length === 0 && <p className="px-2 py-6 text-center text-xs text-gray-400">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {task && <VideoDetail task={task} onClose={() => setOpenTask(null)} />}
    </div>
  );
}
