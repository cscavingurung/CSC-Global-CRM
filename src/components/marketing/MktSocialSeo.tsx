import { useState } from 'react';
import { ArrowDown, ArrowUp, Minus, Plus } from 'lucide-react';
import { useMarketing } from './mktContext';
import {
  CampaignTag, Card, Chips, EmptyRow, Field, GhostButton, Kpi, Modal, PageIntro, Pill, PrimaryButton, SelectInput,
  SourceTag, TableBox, Td, TextArea, TextInput, Th,
} from './MktShared';
import { LEAD_CHANNELS, MKT_CAN, ago, dayOf, isoToday, shortDay } from '../../marketingDept';
import { parseLeadDate } from '../../marketing';
import { clampDateInput } from '../../dateTime';
import { LeadChannel, SeoTask, SocialPost } from '../../types';
import { deadlineText, deadlineTone } from './mktUtils';

const when = (stamp: string) => {
  const d = parseLeadDate(stamp);
  return d ? d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : stamp;
};

function NewPostModal({ onClose }: { onClose: () => void }) {
  const { store, actions } = useMarketing();
  const [platform, setPlatform] = useState<LeadChannel>('Facebook');
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState(isoToday());
  const [time, setTime] = useState('10:00');
  const [campaignId, setCampaignId] = useState('');
  const valid = caption.trim() && date && time;
  return (
    <Modal title="Schedule a post" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const [h, m] = time.split(':').map(Number);
        actions.schedulePost({ platform, caption: caption.trim(), scheduledAt: `${date} ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`, campaignId: campaignId || undefined });
        onClose();
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platform" required>
            <SelectInput value={platform} onChange={(v) => setPlatform(v as LeadChannel)} label="Platform">
              {LEAD_CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </SelectInput>
          </Field>
          <Field label="Campaign">
            <SelectInput value={campaignId} onChange={setCampaignId} label="Campaign">
              <option value="">None</option>
              {store.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Date" required><TextInput type="date" min={isoToday()} value={date} onChange={(e) => setDate(e.target.value)} onBlur={(e) => { const c = clampDateInput(e.target.value, { min: isoToday() }); if (c) setDate(c); }} /></Field>
          <Field label="Time" required><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Field label="Caption" required><TextArea value={caption} onChange={(e) => setCaption(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!valid}>Schedule</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function PublishModal({ post, onClose }: { post: SocialPost; onClose: () => void }) {
  const { actions } = useMarketing();
  const [reach, setReach] = useState('');
  const [engagements, setEngagements] = useState('');
  const [leads, setLeads] = useState('');
  const num = (v: string) => (v === '' ? undefined : Math.max(0, Number(v)));
  return (
    <Modal title="Mark as published" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{post.caption}</p>
        <p className="text-xs text-gray-400">First numbers are optional — add them now or later.</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Reach"><TextInput type="number" min={0} value={reach} onChange={(e) => setReach(e.target.value)} /></Field>
          <Field label="Engagements"><TextInput type="number" min={0} value={engagements} onChange={(e) => setEngagements(e.target.value)} /></Field>
          <Field label="Leads"><TextInput type="number" min={0} value={leads} onChange={(e) => setLeads(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => { actions.publishPost(post.id, { reach: num(reach), engagements: num(engagements), leads: num(leads) }); onClose(); }}>Mark published</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function ScheduledPosts() {
  const { store, role } = useMarketing();
  const [adding, setAdding] = useState(false);
  const [publishing, setPublishing] = useState<SocialPost | null>(null);
  const [platform, setPlatform] = useState<'All' | LeadChannel>('All');
  const can = MKT_CAN.schedulePosts(role);
  const now = Date.now();
  const rows = store.posts
    .filter((p) => p.status === 'Scheduled' && (platform === 'All' || p.platform === platform))
    .sort((a, b) => (parseLeadDate(a.scheduledAt)?.getTime() ?? 0) - (parseLeadDate(b.scheduledAt)?.getTime() ?? 0));

  return (
    <div className="space-y-4">
      <PageIntro text="The posting queue, soonest first. Overdue posts are highlighted — publish them or reschedule.">
        {can && <PrimaryButton onClick={() => setAdding(true)}><Plus size={15} /> Schedule post</PrimaryButton>}
      </PageIntro>
      <Chips options={['All', ...LEAD_CHANNELS] as const} value={platform} onChange={setPlatform} />
      <TableBox min={760}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>When</Th><Th>Platform</Th><Th>Caption</Th><Th>Campaign</Th><Th right /></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((p) => {
            const late = (parseLeadDate(p.scheduledAt)?.getTime() ?? now) < now;
            return (
              <tr key={p.id} className={late ? 'bg-amber-50/50' : ''}>
                <Td className={`whitespace-nowrap ${late ? 'font-semibold text-amber-700' : 'text-navy'}`}>{when(p.scheduledAt)}{late && <span className="block text-[11px] font-normal">Past due</span>}</Td>
                <Td><SourceTag source={p.platform} /></Td>
                <Td className="max-w-[320px] text-gray-600">{p.caption}</Td>
                <Td><CampaignTag campaigns={store.campaigns} id={p.campaignId} /></Td>
                <Td right>{can && <GhostButton small onClick={() => setPublishing(p)}>Mark published</GhostButton>}</Td>
              </tr>
            );
          })}
          {rows.length === 0 && <EmptyRow cols={5} text="Nothing scheduled." />}
        </tbody>
      </TableBox>
      {adding && <NewPostModal onClose={() => setAdding(false)} />}
      {publishing && <PublishModal post={publishing} onClose={() => setPublishing(null)} />}
    </div>
  );
}

export function PublishedPosts() {
  const { store } = useMarketing();
  const [platform, setPlatform] = useState<'All' | LeadChannel>('All');
  const all = store.posts.filter((p) => p.status === 'Published');
  const rows = all.filter((p) => platform === 'All' || p.platform === platform)
    .sort((a, b) => (parseLeadDate(b.publishedAt)?.getTime() ?? 0) - (parseLeadDate(a.publishedAt)?.getTime() ?? 0));
  const sum = (k: 'reach' | 'engagements' | 'leads') => rows.reduce((n, p) => n + (p[k] ?? 0), 0);
  const reach = sum('reach');

  return (
    <div className="space-y-4">
      <Chips options={['All', ...LEAD_CHANNELS] as const} value={platform} onChange={setPlatform} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Posts" value={rows.length} />
        <Kpi label="Reach" value={reach.toLocaleString('en-IN')} />
        <Kpi label="Engagement rate" value={reach ? `${((sum('engagements') / reach) * 100).toFixed(1)}%` : '—'} />
        <Kpi label="Leads from posts" value={sum('leads')} />
      </div>
      <TableBox min={820}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Published</Th><Th>Platform</Th><Th>Caption</Th><Th>Campaign</Th><Th right>Reach</Th><Th right>Engagements</Th><Th right>Leads</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((p) => (
            <tr key={p.id}>
              <Td className="whitespace-nowrap text-gray-500">{shortDay(dayOf(p.publishedAt ?? p.scheduledAt))}<span className="block text-[11px] text-gray-400">{ago(p.publishedAt)}</span></Td>
              <Td><SourceTag source={p.platform} /></Td>
              <Td className="max-w-[300px] text-gray-600">{p.caption}</Td>
              <Td><CampaignTag campaigns={store.campaigns} id={p.campaignId} /></Td>
              <Td right>{p.reach?.toLocaleString('en-IN') ?? '—'}</Td>
              <Td right>{p.engagements?.toLocaleString('en-IN') ?? '—'}</Td>
              <Td right className="font-semibold text-navy">{p.leads ?? '—'}</Td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={7} text="Nothing published yet." />}
        </tbody>
      </TableBox>
    </div>
  );
}

// ── SEO ─────────────────────────────────────────────────────────────────────
export function SeoDashboard() {
  const { store } = useMarketing();
  const kw = store.keywords;
  const avg = kw.length ? kw.reduce((n, k) => n + k.position, 0) / kw.length : 0;
  const month = isoToday().slice(0, 7);
  const webLeads = store.leads.filter((l) => l.source === 'Website' && (parseLeadDate(l.receivedAt) ? isoToday(parseLeadDate(l.receivedAt)!).startsWith(month) : false)).length;
  const open = store.seoTasks.filter((t) => t.status !== 'Done').length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Tracked keywords" value={kw.length} />
        <Kpi label="In top 10" value={kw.filter((k) => k.position <= 10).length} tone="green" />
        <Kpi label="Average position" value={avg.toFixed(1)} />
        <Kpi label="Website leads this month" value={webLeads} hint={`${open} open SEO task${open === 1 ? '' : 's'}`} />
      </div>
      <TableBox min={720}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Keyword</Th><Th right>Position</Th><Th right>Change</Th><Th right>Monthly searches</Th><Th>Ranking page</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {[...kw].sort((a, b) => a.position - b.position).map((k) => {
            const diff = k.previous - k.position;
            return (
              <tr key={k.keyword}>
                <Td className="font-medium text-navy">{k.keyword}</Td>
                <Td right>{k.position}</Td>
                <Td right>
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {diff > 0 ? <ArrowUp size={12} /> : diff < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}{diff !== 0 ? Math.abs(diff) : ''}
                  </span>
                </Td>
                <Td right>{k.monthlySearches.toLocaleString('en-IN')}</Td>
                <Td className="text-xs text-gray-500">{k.url}</Td>
              </tr>
            );
          })}
        </tbody>
      </TableBox>
    </div>
  );
}

const SEO_STYLES: Record<SeoTask['status'], string> = { 'To Do': 'bg-amber-50 text-amber-700', 'In Progress': 'bg-blue-50 text-blue-700', Done: 'bg-emerald-50 text-emerald-700' };
const SEO_TYPES: SeoTask['type'][] = ['Blog Post', 'On-page', 'Technical', 'Backlinks', 'Keyword Research'];

export function SeoTasks() {
  const { store, role, actions, me } = useMarketing();
  const can = MKT_CAN.seo(role);
  const [filter, setFilter] = useState<'All' | SeoTask['status']>('All');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<SeoTask['type']>('Blog Post');
  const [keyword, setKeyword] = useState('');
  const [due, setDue] = useState('');
  const counts = { All: store.seoTasks.length, 'To Do': 0, 'In Progress': 0, Done: 0 };
  store.seoTasks.forEach((t) => { counts[t.status] += 1; });
  const rows = store.seoTasks.filter((t) => filter === 'All' || t.status === filter).sort((a, b) => a.due.localeCompare(b.due));

  return (
    <div className="space-y-4">
      {can && (
        <Card title="Add SEO task">
          <form className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end" onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !due) return;
            actions.addSeoTask({ title: title.trim(), type, keyword: keyword.trim() || undefined, assignee: me, due, status: 'To Do' });
            setTitle(''); setKeyword(''); setDue('');
          }}>
            <Field label="Task" required><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Type"><SelectInput value={type} onChange={(v) => setType(v as SeoTask['type'])} label="Type">{SEO_TYPES.map((t) => <option key={t}>{t}</option>)}</SelectInput></Field>
            <Field label="Keyword"><TextInput value={keyword} onChange={(e) => setKeyword(e.target.value)} /></Field>
            <Field label="Due" required><TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
            <PrimaryButton type="submit" disabled={!title.trim() || !due}><Plus size={15} /> Add</PrimaryButton>
          </form>
        </Card>
      )}
      <Chips options={['All', 'To Do', 'In Progress', 'Done'] as const} value={filter} onChange={setFilter} counts={counts} />
      <TableBox min={760}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Task</Th><Th>Type</Th><Th>Owner</Th><Th>Due</Th><Th>Status</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((t) => (
            <tr key={t.id}>
              <Td><span className="font-medium text-navy">{t.title}</span>{(t.keyword || t.url) && <span className="block text-[11px] text-gray-400">{t.keyword ?? t.url}</span>}</Td>
              <Td className="text-gray-600">{t.type}</Td>
              <Td className="text-gray-600">{t.assignee}</Td>
              <Td className={`whitespace-nowrap text-xs ${deadlineTone(t.due, t.status === 'Done')}`}>{t.status === 'Done' ? shortDay(t.due) : deadlineText(t.due)}</Td>
              <Td>
                {can ? (
                  <select value={t.status} aria-label="Status" onChange={(e) => actions.setSeoStatus(t.id, e.target.value as SeoTask['status'])} className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-navy-light ${SEO_STYLES[t.status]}`}>
                    {(['To Do', 'In Progress', 'Done'] as const).map((s) => <option key={s}>{s}</option>)}
                  </select>
                ) : <Pill text={t.status} cls={SEO_STYLES[t.status]} />}
              </Td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={5} text="No tasks in this view." />}
        </tbody>
      </TableBox>
    </div>
  );
}
