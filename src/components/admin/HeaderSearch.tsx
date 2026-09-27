import { useState } from 'react';
import { Search } from 'lucide-react';

/** Global Search box for the top header — Enter opens the Global Search page with the query. */
export default function HeaderSearch({ onSearch }: { onSearch: (query: string) => void }) {
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) { onSearch(q.trim()); setQ(''); } }}
      className="relative hidden w-full max-w-xs md:block"
    >
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search clients, leads, staff…"
        aria-label="Global Search"
        className="h-9 w-full rounded-lg border border-grey-border bg-white pl-9 pr-3 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
      />
    </form>
  );
}
