import { useState } from 'react';
import { useDesigner, TYPE_STYLES } from './designerContext';
import { Chips, EmptyRow, Pill, ReadOnlyNote, SourceTag, TableBox, Td, Th } from '../marketing/MktShared';
import { toDate } from '../../marketingDept';

const when = (v: string) => {
  const d = toDate(v);
  if (!d) return v;
  const hasTime = !/^\d{4}-\d{2}-\d{2}$/.test(v);
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(hasTime ? { hour: 'numeric', minute: '2-digit' } : {}) });
};

/** Read-only: approved content already going out, so work isn't duplicated. */
export default function ScheduledPostsView() {
  const { data } = useDesigner();
  const [view, setView] = useState<'All' | 'Scheduled' | 'Approved'>('All');
  const counts = { All: data.schedule.length, Scheduled: data.schedule.filter((s) => s.status === 'Scheduled').length, Approved: data.schedule.filter((s) => s.status === 'Approved').length };
  const rows = data.schedule.filter((s) => view === 'All' || s.status === view);
  const now = Date.now();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">Approved content that's going out. Check here before starting something new.</p>
        <Chips options={['All', 'Scheduled', 'Approved'] as const} value={view} onChange={setView} counts={counts} />
      </div>
      <TableBox min={680}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Date</Th><Th>Content Title</Th><Th>Platform</Th><Th>Type</Th><Th>Status</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((s) => {
            const past = (toDate(s.date)?.getTime() ?? now) < now - 86_400_000;
            return (
              <tr key={s.id}>
                <Td className={`whitespace-nowrap ${past ? 'text-gray-400' : 'text-navy'}`}>{when(s.date)}</Td>
                <Td className="font-medium text-navy">{s.title}</Td>
                <Td><SourceTag source={s.platform} /></Td>
                <Td><Pill text={s.type} cls={TYPE_STYLES[s.type]} /></Td>
                <Td><Pill text={s.status === 'Approved' ? 'Approved · awaiting date' : 'Scheduled'} cls={s.status === 'Approved' ? 'bg-blue-50 text-blue-700' : 'bg-navy/10 text-navy'} /></Td>
              </tr>
            );
          })}
          {rows.length === 0 && <EmptyRow cols={5} text="Nothing scheduled." />}
        </tbody>
      </TableBox>
      <ReadOnlyNote>Read-only. Scheduling is done by the Content Planner and Marketing Manager.</ReadOnlyNote>
    </div>
  );
}
