import { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Paperclip, Play, RotateCcw, Search, Send } from 'lucide-react';
import { useDesigner, DESIGN_STATUSES, PRIORITY_STYLES, TYPE_STYLES, priorityRank } from './designerContext';
import { BriefBlock, UploadZone } from './DesignerShared';
import { Chips, EmptyRow, GhostButton, Modal, Pill, PrimaryButton, SelectInput, SourceTag, TableBox, Td, Th } from '../marketing/MktShared';
import { DESIGN_STYLES, deadlineText, deadlineTone } from '../marketing/mktUtils';
import { isoToday, shortDay } from '../../marketingDept';
import { DesignStage, DesignTask } from '../../types';

const TYPES = ['All types', 'Post', 'Story', 'Reel', 'Poster'];

/** Task brief + delivery. The designer can start, deliver files and submit; approving is the reviewer's. */
function DesignDetail({ task, onClose }: { task: DesignTask; onClose: () => void }) {
  const { me, actions, flash } = useDesigner();
  const [copied, setCopied] = useState(false);
  const editable = task.stage === 'Requested' || task.stage === 'In Progress';
  const files = task.finalFiles ?? [];
  const copy = () => {
    if (!task.caption) return;
    navigator.clipboard?.writeText(task.caption).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => undefined);
  };

  return (
    <Modal title={task.title} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Pill text={task.stage} cls={DESIGN_STYLES[task.stage]} />
          <Pill text={task.type ?? 'Post'} cls={TYPE_STYLES[task.type ?? 'Post']} />
          <SourceTag source={task.platform} />
          {task.priority && <Pill text={`${task.priority} priority`} cls={PRIORITY_STYLES[task.priority]} />}
          <span className={deadlineTone(task.deadline, !editable)}>{deadlineText(task.deadline)}</span>
          <span className="text-gray-400">· requested by {task.requestedBy}</span>
        </div>
        {task.reviewNote && task.stage === 'In Progress' && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><RotateCcw size={14} className="mt-0.5 shrink-0" /> Reviewer: “{task.reviewNote}”</p>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <BriefBlock title="Content / caption">
              {task.caption ? (
                <div className="relative rounded-lg border border-grey-border bg-grey-bg/50 p-3 pr-10 text-sm text-navy">
                  {task.caption}
                  <button type="button" onClick={copy} aria-label="Copy caption" className="absolute right-2 top-2 rounded p-1 text-gray-400 transition-colors hover:text-navy-light">{copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}</button>
                </div>
              ) : <p className="text-sm text-gray-400">No caption — design only.</p>}
            </BriefBlock>
            <BriefBlock title="Instructions"><p className="whitespace-pre-line text-sm text-gray-700">{task.brief}</p></BriefBlock>
            <BriefBlock title="Required size"><p className="inline-block rounded bg-grey-bg px-2 py-1 text-sm font-medium text-navy">{task.dimensions}</p></BriefBlock>
          </div>
          <div className="space-y-4">
            <BriefBlock title="Reference material">
              {task.references?.length ? (
                <ul className="space-y-1">{task.references.map((r) => (
                  <li key={r}><a href={r} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-sm text-navy hover:text-navy-light"><ExternalLink size={12} className="shrink-0" /> <span className="truncate">{r.replace(/^https?:\/\/(www\.)?/, '')}</span></a></li>
                ))}</ul>
              ) : <p className="text-sm text-gray-400">None given.</p>}
            </BriefBlock>
            <BriefBlock title="Attached assets">
              {task.assets?.length ? (
                <ul className="space-y-1">{task.assets.map((a) => (
                  <li key={a.name} className="flex items-center gap-1.5 text-sm">
                    <Paperclip size={12} className="shrink-0 text-gray-400" />
                    {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate text-navy hover:text-navy-light">{a.name}</a> : <span className="truncate text-gray-700">{a.name}</span>}
                  </li>
                ))}</ul>
              ) : <p className="text-sm text-gray-400">No assets attached.</p>}
            </BriefBlock>
          </div>
        </div>

        <BriefBlock title="Final design">
          <UploadZone files={files} me={me} kind="design" accept="image/*,application/pdf,.psd,.ai,.svg" readOnly={!editable}
            onChange={(next) => actions.updateDesign(task.id, { finalFiles: next, ...(task.stage === 'Requested' && next.length ? { stage: 'In Progress' as const } : {}) })} />
        </BriefBlock>

        <div className="flex flex-col-reverse gap-2 border-t border-grey-border pt-4 sm:flex-row sm:items-center sm:justify-end">
          {task.stage === 'Requested' && <PrimaryButton onClick={() => { actions.updateDesign(task.id, { stage: 'In Progress' }); flash('Started — it\'s now In Progress.'); }}><Play size={14} /> Start working</PrimaryButton>}
          {task.stage === 'In Progress' && (
            <>
              {!files.length && <p className="text-xs text-gray-400 sm:mr-auto">Upload the final design to submit it.</p>}
              <PrimaryButton disabled={!files.length} onClick={() => { actions.updateDesign(task.id, { stage: 'Ready for Review' }); flash('Submitted for review.'); onClose(); }}><Send size={14} /> Submit for review</PrimaryButton>
            </>
          )}
          {task.stage === 'Ready for Review' && (
            <>
              <p className="text-xs text-gray-500 sm:mr-auto">Waiting for the Marketing Manager to review.</p>
              <GhostButton onClick={() => { actions.updateDesign(task.id, { stage: 'In Progress' }); flash('Pulled back to In Progress.'); }}><RotateCcw size={14} /> Keep editing</GhostButton>
            </>
          )}
          {(task.stage === 'Approved' || task.stage === 'Scheduled') && <p className="text-sm text-emerald-700">{task.stage === 'Approved' ? 'Approved — the planner will schedule it.' : 'Approved and scheduled.'}</p>}
        </div>
      </div>
    </Modal>
  );
}

export default function DesignQueue() {
  const { data, openId } = useDesigner();
  const [status, setStatus] = useState<'Active' | 'All' | DesignStage>('Active');
  const [type, setType] = useState('All types');
  const [q, setQ] = useState('');
  const [openTask, setOpenTask] = useState<string | null>(openId && data.designTasks.some((d) => d.id === openId) ? openId : null);
  const today = isoToday();
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: data.designTasks.length, Active: data.designTasks.filter((d) => d.stage === 'Requested' || d.stage === 'In Progress').length };
    DESIGN_STATUSES.forEach((s) => { c[s] = data.designTasks.filter((d) => d.stage === s).length; });
    return c;
  }, [data.designTasks]);
  const needle = q.trim().toLowerCase();
  const rows = data.designTasks
    .filter((d) => (status === 'All' || (status === 'Active' ? d.stage === 'Requested' || d.stage === 'In Progress' : d.stage === status))
      && (type === 'All types' || (d.type ?? 'Post') === type)
      && (!needle || [d.title, d.brief, d.caption ?? '', d.requestedBy].some((v) => v.toLowerCase().includes(needle))))
    .sort((a, b) => Number(b.deadline < today && b.stage !== 'Approved' && b.stage !== 'Scheduled') - Number(a.deadline < today && a.stage !== 'Approved' && a.stage !== 'Scheduled')
      || priorityRank(a.priority) - priorityRank(b.priority) || a.deadline.localeCompare(b.deadline));
  const task = data.designTasks.find((d) => d.id === openTask);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex-1"><Chips options={['Active', 'All', ...DESIGN_STATUSES] as const} value={status} onChange={setStatus} counts={counts} /></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search designs" className="w-full rounded-lg border border-grey-border py-2 pl-9 pr-3 text-sm focus:border-navy-light focus:outline-none" />
          </div>
          <div className="sm:w-36"><SelectInput value={type} onChange={setType} label="Type">{TYPES.map((t) => <option key={t}>{t}</option>)}</SelectInput></div>
        </div>
      </div>
      <TableBox min={900}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Content Title</Th><Th>Type</Th><Th>Platform</Th><Th>Requested By</Th><Th>Deadline</Th><Th>Priority</Th><Th>Status</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((d) => {
            const done = d.stage === 'Approved' || d.stage === 'Scheduled';
            return (
              <tr key={d.id} onClick={() => setOpenTask(d.id)} className={`cursor-pointer transition-colors hover:bg-grey-bg/60 ${!done && d.deadline < today ? 'bg-red-50/40' : ''}`}>
                <Td>
                  <span className="font-medium text-navy">{d.title}</span>
                  <span className="line-clamp-1 block max-w-[320px] text-[11px] text-gray-400">{d.reviewNote && d.stage === 'In Progress' ? `↩ ${d.reviewNote}` : d.caption ?? d.brief}</span>
                </Td>
                <Td><Pill text={d.type ?? 'Post'} cls={TYPE_STYLES[d.type ?? 'Post']} /></Td>
                <Td><SourceTag source={d.platform} /><span className="mt-0.5 block text-[11px] text-gray-400">{d.dimensions}</span></Td>
                <Td className="text-gray-600">{d.requestedBy}</Td>
                <Td className={`whitespace-nowrap text-xs ${deadlineTone(d.deadline, done)}`}>{done ? shortDay(d.deadline) : deadlineText(d.deadline)}</Td>
                <Td>{d.priority ? <Pill text={d.priority} cls={PRIORITY_STYLES[d.priority]} /> : <span className="text-gray-300">—</span>}</Td>
                <Td><Pill text={d.stage} cls={DESIGN_STYLES[d.stage]} />{!!d.finalFiles?.length && <span className="mt-1 flex items-center gap-1 text-[11px] text-gray-400"><Paperclip size={10} /> {d.finalFiles.length} file{d.finalFiles.length === 1 ? '' : 's'}</span>}</Td>
              </tr>
            );
          })}
          {rows.length === 0 && <EmptyRow cols={7} text={status === 'Active' ? 'No open design work — nice.' : 'No designs match.'} />}
        </tbody>
      </TableBox>
      <p className="text-[11px] text-gray-400">Click a design for the full brief and to upload the final file.</p>
      {task && <DesignDetail task={task} onClose={() => setOpenTask(null)} />}
    </div>
  );
}
