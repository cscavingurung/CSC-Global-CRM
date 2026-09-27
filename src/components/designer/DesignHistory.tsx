import { useState } from 'react';
import { ExternalLink, Search, X } from 'lucide-react';
import { useDesigner, HISTORY_STYLES, TYPE_STYLES } from './designerContext';
import { Chips, EmptyRow, Pill, SourceTag, TableBox, Td, Th } from '../marketing/MktShared';
import { whenLabel } from '../../marketingDept';

const TYPES = ['All', 'Post', 'Story', 'Reel', 'Poster', 'Video'] as const;

/** Searchable log of finished work. */
export default function DesignHistory() {
  const { data, me } = useDesigner();
  const [q, setQ] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]>('All');
  const [mine, setMine] = useState(false);
  const needle = q.trim().toLowerCase();
  const rows = data.history.filter((h) => (type === 'All' || h.type === type) && (!mine || h.designer === me)
    && (!needle || [h.title, h.platform, h.designer].some((v) => v.toLowerCase().includes(needle))));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search past work, e.g. "Canada"' className="w-full rounded-lg border border-grey-border py-2.5 pl-9 pr-8 text-sm focus:border-navy-light focus:outline-none" />
          {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy"><X size={14} /></button>}
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <Chips options={TYPES} value={type} onChange={setType} />
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="rounded border-grey-border text-navy focus:ring-navy-light" /> Only my work
          </label>
        </div>
      </div>
      {needle && <p className="text-xs text-gray-500">{rows.length} result{rows.length === 1 ? '' : 's'} for “{q.trim()}”.</p>}
      <TableBox min={860}>
        <thead className="border-b border-grey-border bg-grey-bg/50"><tr><Th>Content Title</Th><Th>Date</Th><Th>Platform</Th><Th>Type</Th><Th>Designer</Th><Th>Status</Th><Th>Published Link</Th></tr></thead>
        <tbody className="divide-y divide-grey-border">
          {rows.map((h) => (
            <tr key={h.id}>
              <Td className="font-medium text-navy">{h.title}</Td>
              <Td className="whitespace-nowrap text-gray-500">{whenLabel(h.date)}</Td>
              <Td><SourceTag source={h.platform} /></Td>
              <Td><Pill text={h.type} cls={TYPE_STYLES[h.type]} /></Td>
              <Td className="text-gray-600">{h.designer}</Td>
              <Td><Pill text={h.status} cls={HISTORY_STYLES[h.status]} /></Td>
              <Td>{h.link
                ? <a href={h.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-navy transition-colors hover:text-navy-light">Open <ExternalLink size={11} /></a>
                : <span className="text-xs text-gray-400">{h.status === 'Published' ? 'No link' : 'Not published yet'}</span>}</Td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={7} text="No completed work matches." />}
        </tbody>
      </TableBox>
    </div>
  );
}
