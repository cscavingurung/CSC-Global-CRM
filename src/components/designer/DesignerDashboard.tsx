import { AlertTriangle, ArrowRight, Film, Hourglass, PenTool, RotateCcw } from 'lucide-react';
import { useDesigner, PRIORITY_STYLES, TYPE_STYLES, VIDEO_STYLES, priorityRank } from './designerContext';
import { Card, Kpi, Pill, SourceTag } from '../marketing/MktShared';
import { DESIGN_STYLES, deadlineText, deadlineTone } from '../marketing/mktUtils';
import { isoToday, shortDay, weekBounds } from '../../marketingDept';
import GreetingBanner from '../GreetingBanner';

interface Job { id: string; kind: 'design' | 'video'; title: string; type: string; platform: string; deadline: string; priority?: string; status: string; note?: string; noFootage?: boolean }

/** "What do I need to do?" — the queues at a glance. */
export default function DesignerDashboard() {
  const { me, data, go } = useDesigner();
  const today = isoToday();
  const [, weekEnd] = weekBounds(today);
  const designs = data.designTasks;
  const videos = data.videoTasks;
  const openDesigns = designs.filter((d) => d.stage === 'Requested' || d.stage === 'In Progress');
  const openVideos = videos.filter((v) => v.status === 'To Edit' || v.status === 'In Progress');

  const jobs: Job[] = [
    ...openDesigns.map((d): Job => ({ id: d.id, kind: 'design', title: d.title, type: d.type ?? 'Post', platform: d.platform, deadline: d.deadline, priority: d.priority, status: d.stage, note: d.reviewNote })),
    ...openVideos.map((v): Job => ({ id: v.id, kind: 'video', title: v.title, type: 'Video', platform: v.platform, deadline: v.deadline, priority: v.priority, status: v.status, note: v.reviewNote, noFootage: !v.sourceLink })),
  ];
  // Overdue first, then priority, then deadline. Jobs still waiting on footage go last — nothing to edit yet.
  const doNext = jobs.filter((j) => !j.noFootage).sort((a, b) =>
    Number(b.deadline < today) - Number(a.deadline < today) || priorityRank(a.priority) - priorityRank(b.priority) || a.deadline.localeCompare(b.deadline));
  const sentBack = jobs.filter((j) => j.note && j.status === 'In Progress');
  const inReview = [
    ...designs.filter((d) => d.stage === 'Ready for Review').map((d) => ({ id: d.id, kind: 'design' as const, title: d.title })),
    ...videos.filter((v) => v.status === 'Ready for Review').map((v) => ({ id: v.id, kind: 'video' as const, title: v.title })),
  ];
  const noFootage = openVideos.filter((v) => !v.sourceLink);
  const dueToday = openDesigns.filter((d) => d.deadline === today);
  const overdueDesigns = openDesigns.filter((d) => d.deadline < today);
  const dueWeek = jobs.filter((j) => j.deadline >= today && j.deadline <= weekEnd);
  const toEdit = videos.filter((v) => v.status === 'To Edit' && v.sourceLink);
  const scheduled = data.schedule.filter((s) => s.status === 'Scheduled');
  const openJob = (j: { id: string; kind: 'design' | 'video' }) => go(j.kind === 'design' ? 'designs' : 'videos', j.id);

  const card = (label: string, value: number, hint: string, to: string, tone?: 'red' | 'amber' | 'green') => (
    <button type="button" onClick={() => go(to)} className="text-left transition-opacity hover:opacity-80">
      <Kpi label={label} value={value} hint={hint} tone={tone} />
    </button>
  );

  return (
    <div className="space-y-4">
      <GreetingBanner name={me} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {card('Designs due today', dueToday.length, overdueDesigns.length ? `${overdueDesigns.length} overdue` : 'Nothing overdue', 'designs', overdueDesigns.length ? 'red' : dueToday.length ? 'amber' : undefined)}
        {card('Due this week', dueWeek.length, `Designs + videos until ${shortDay(weekEnd)}`, 'designs')}
        {card('Videos waiting for editing', toEdit.length, 'Footage is in', 'videos', toEdit.length ? 'amber' : undefined)}
        {card('Waiting for material', noFootage.length + data.waitingMaterial.length, 'Still with the branches', 'videos')}
        {card('Ready for review', inReview.length, 'Submitted by you', 'designs')}
        {card('Scheduled posts', scheduled.length, 'Already going out', 'scheduled', 'green')}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <Card title="Do next" action={<span className="text-xs text-gray-400">Overdue first, then priority</span>}>
          <ul className="divide-y divide-grey-border">
            {doNext.slice(0, 7).map((j) => (
              <li key={j.id}>
                <button type="button" onClick={() => openJob(j)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-grey-bg/60">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-grey-bg text-navy">{j.kind === 'video' ? <Film size={14} /> : <PenTool size={14} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-navy">{j.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <Pill text={j.type} cls={TYPE_STYLES[j.type]} /><SourceTag source={j.platform} />
                      {j.priority && <Pill text={j.priority} cls={PRIORITY_STYLES[j.priority]} />}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-xs ${deadlineTone(j.deadline)}`}>{deadlineText(j.deadline)}</span>
                    <span className="mt-0.5 inline-block"><Pill text={j.status} cls={j.kind === 'video' ? VIDEO_STYLES[j.status as keyof typeof VIDEO_STYLES] : DESIGN_STYLES[j.status as keyof typeof DESIGN_STYLES]} /></span>
                  </span>
                </button>
              </li>
            ))}
            {doNext.length === 0 && <li className="px-5 py-8 text-center text-sm text-emerald-700">Queue clear — nice work.</li>}
          </ul>
          {doNext.length > 7 && <p className="border-t border-grey-border px-5 py-2 text-xs text-gray-400">+{doNext.length - 7} more in the queues</p>}
        </Card>

        <div className="space-y-4">
          {sentBack.length > 0 && (
            <Card title={`Sent back to you · ${sentBack.length}`}>
              <ul className="divide-y divide-grey-border">
                {sentBack.map((j) => (
                  <li key={j.id}>
                    <button type="button" onClick={() => openJob(j)} className="flex w-full items-start gap-2 px-5 py-2.5 text-left transition-colors hover:bg-grey-bg/60">
                      <RotateCcw size={14} className="mt-0.5 shrink-0 text-amber-600" />
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-navy">{j.title}</span><span className="block text-xs text-amber-800">“{j.note}”</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title={`Waiting for material · ${noFootage.length + data.waitingMaterial.length}`}>
            <ul className="divide-y divide-grey-border">
              {noFootage.map((v) => (
                <li key={v.id}>
                  <button type="button" onClick={() => openJob({ id: v.id, kind: 'video' })} className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-sm transition-colors hover:bg-grey-bg/60">
                    <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                    <span className="min-w-0 flex-1 truncate text-navy">{v.title}</span>
                    <span className="text-xs text-gray-400">no footage yet</span>
                  </button>
                </li>
              ))}
              {data.waitingMaterial.map((m) => (
                <li key={m.id} className="flex items-center gap-2 px-5 py-2.5 text-sm">
                  <Hourglass size={14} className="shrink-0 text-gray-400" />
                  <span className="min-w-0 flex-1 truncate text-navy" title={m.topic}>{m.topic}</span>
                  <span className="shrink-0 text-xs text-gray-400">{m.needed} · {m.branch} · due {shortDay(m.deadline)}</span>
                </li>
              ))}
              {noFootage.length + data.waitingMaterial.length === 0 && <li className="px-5 py-6 text-center text-sm text-gray-400">Nothing on its way.</li>}
            </ul>
            <p className="border-t border-grey-border px-5 py-2 text-[11px] text-gray-400">Coming from branch counselors — it lands in your queue once the Content Planner sends it.</p>
          </Card>
          <Card title={`Waiting for review · ${inReview.length}`}>
            <ul className="divide-y divide-grey-border">
              {inReview.map((j) => (
                <li key={j.id}>
                  <button type="button" onClick={() => openJob(j)} className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-sm transition-colors hover:bg-grey-bg/60">
                    {j.kind === 'video' ? <Film size={14} className="text-violet-600" /> : <PenTool size={14} className="text-violet-600" />}
                    <span className="min-w-0 flex-1 truncate text-navy">{j.title}</span>
                    <ArrowRight size={12} className="text-gray-400" />
                  </button>
                </li>
              ))}
              {inReview.length === 0 && <li className="px-5 py-6 text-center text-sm text-gray-400">Nothing waiting on a reviewer.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
