import { useMemo, useState } from 'react';
import { Search, Footprints, RotateCcw, UserPlus, X, Check } from 'lucide-react';
import { CounselorStudent, IntakeStudent } from '../types';
import { dateKey } from '../dateTime';
import CompactDateRangeFilter from './CompactDateRangeFilter';
import { matchesDateRange } from '../dateFilter';

interface VisitorsPageProps {
  students: IntakeStudent[];
  counselorStudents: CounselorStudent[];
  /** Records a returning client's visit right now (front desk "Add Revisited Client"). */
  onLogRevisit: (clientId: string) => void;
}

type VisitorKind = 'Walk-in' | 'Returning';
type KindFilter = 'all' | VisitorKind;

interface VisitorRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  country: string;
  purpose: string;
  visit: string;
  kind: VisitorKind;
  handledBy: string;
  referredThrough: string;
}

const KIND_STYLES: Record<VisitorKind, string> = {
  'Walk-in': 'bg-blue-50 text-blue-700',
  Returning: 'bg-amber-50 text-amber-700',
};

/** Front desk log of everyone who came through the door — fresh walk-ins and returning clients. */
export default function VisitorsPage({ students, counselorStudents, onLogRevisit }: VisitorsPageProps) {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showRevisitModal, setShowRevisitModal] = useState(false);
  const [revisitSearch, setRevisitSearch] = useState('');
  const [justLogged, setJustLogged] = useState<string | null>(null);

  const rows = useMemo<VisitorRow[]>(() => {
    const assignedIds = new Set(counselorStudents.map((c) => c.id));

    const walkIns: VisitorRow[] = students.map((s) => ({
      id: `s-${s.id}`,
      name: s.name,
      phone: s.phone,
      email: s.email,
      country: s.country,
      purpose: s.purpose,
      visit: s.revisitedAt ?? s.visitDateTime ?? s.submittedAt,
      // A lead that already has a counselor, or that the desk logged back in, has been here before.
      kind: s.revisitedAt || assignedIds.has(s.id) ? 'Returning' : 'Walk-in',
      handledBy: s.addedBy ?? 'Front Desk',
      referredThrough: s.referredThrough ?? 'Walk Ins',
    }));

    const returning: VisitorRow[] = counselorStudents
      .filter((c) => !students.some((s) => s.id === c.id))
      .map((c) => ({
        id: `c-${c.id}`,
        name: c.name,
        phone: c.phone,
        email: c.email,
        country: c.country,
        purpose: c.purpose,
        visit: c.revisitedAt ?? c.visitDateTime ?? c.submittedAt,
        kind: 'Returning' as VisitorKind,
        handledBy: c.assignedCounselor,
        referredThrough: c.referredThrough ?? 'Walk Ins',
      }));

    return [...walkIns, ...returning].sort((a, b) => b.visit.localeCompare(a.visit));
  }, [students, counselorStudents]);

  const today = dateKey(new Date());

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || r.name.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q);
    const matchesKind = kindFilter === 'all' || r.kind === kindFilter;
    return matchesSearch && matchesKind && matchesDateRange(r.visit, dateFrom, dateTo);
  });

  const todayCount = rows.filter((r) => r.visit.slice(0, 10) === today).length;

  // Everyone already on file, so the desk can log a repeat visit without re-typing details.
  const knownClients = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; phone: string; country: string; purpose: string; lastVisit: string }>();
    counselorStudents.forEach((c) =>
      byId.set(c.id, { id: c.id, name: c.name, phone: c.phone, country: c.country, purpose: c.purpose, lastVisit: c.revisitedAt ?? c.visitDateTime ?? c.submittedAt })
    );
    students.forEach((s) => {
      if (!byId.has(s.id)) {
        byId.set(s.id, { id: s.id, name: s.name, phone: s.phone, country: s.country, purpose: s.purpose, lastVisit: s.revisitedAt ?? s.visitDateTime ?? s.submittedAt });
      }
    });
    const q = revisitSearch.trim().toLowerCase();
    return [...byId.values()]
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, counselorStudents, revisitSearch]);

  const logRevisit = (id: string, name: string) => {
    onLogRevisit(id);
    setJustLogged(name);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Visitors today', value: todayCount, icon: Footprints },
          { label: 'Walk-ins', value: rows.filter((r) => r.kind === 'Walk-in').length, icon: Footprints },
          { label: 'Returning clients', value: rows.filter((r) => r.kind === 'Returning').length, icon: RotateCcw },
        ].map((card) => (
          <div key={card.label} className="stat-card">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-navy/5">
              <card.icon className="text-navy" size={20} />
            </div>
            <p className="text-3xl font-bold text-navy">{card.value}</p>
            <p className="mt-1 text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-grey-border bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-grey-border p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone"
              className="w-full rounded-lg border border-grey-border py-2 pl-9 pr-3 text-sm text-navy placeholder:text-gray-400 focus:border-navy focus:outline-none"
            />
          </div>

          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-grey-border p-1">
            {(['all', 'Walk-in', 'Returning'] as KindFilter[]).map((k) => (
              <button
                key={k}
                onClick={() => setKindFilter(k)}
                aria-pressed={kindFilter === k}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  kindFilter === k ? 'bg-navy text-white' : 'text-gray-500 hover:bg-navy/5 hover:text-navy'
                }`}
              >
                {k === 'all' ? 'All' : k === 'Walk-in' ? 'Walk-ins' : 'Returning'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const isToday = dateFrom === today && dateTo === today;
                setDateFrom(isToday ? '' : today);
                setDateTo(isToday ? '' : today);
              }}
              aria-pressed={dateFrom === today && dateTo === today}
              className={`rounded-lg border border-grey-border px-3 py-1.5 text-xs font-medium ${
                dateFrom === today && dateTo === today ? 'bg-navy text-white' : 'text-gray-500 hover:bg-navy/5 hover:text-navy'
              }`}
            >
              Today
            </button>
            <CompactDateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </div>

          <button
            onClick={() => { setShowRevisitModal(true); setJustLogged(null); setRevisitSearch(''); }}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-light"
          >
            <UserPlus size={16} />
            Add Revisited Client
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-grey-border text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-semibold">Client Name</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Country / Case Type</th>
                <th className="px-4 py-3 font-semibold">Visit Date and Time</th>
                <th className="px-4 py-3 font-semibold">Referred Through</th>
                <th className="px-4 py-3 font-semibold">Handled By</th>
                <th className="px-4 py-3 font-semibold">Visitor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-grey-border last:border-0 hover:bg-grey-bg">
                  <td className="px-4 py-3 font-medium text-navy">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <span className="block">{r.phone}</span>
                    <span className="block text-xs">{r.email}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.country} — {r.purpose}</td>
                  <td className="px-4 py-3 text-gray-500">{r.visit}</td>
                  <td className="px-4 py-3 text-gray-500">{r.referredThrough}</td>
                  <td className="px-4 py-3 text-gray-500">{r.handledBy}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${KIND_STYLES[r.kind]}`}>
                      {r.kind}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                    No visitors match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Revisited Client */}
      {showRevisitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={() => setShowRevisitModal(false)} />
          <div className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-grey-border bg-white">
            <div className="flex items-center justify-between border-b border-grey-border px-5 py-4">
              <h2 className="text-base font-semibold text-navy">Add Revisited Client</h2>
              <button onClick={() => setShowRevisitModal(false)} className="text-gray-400 transition-colors hover:text-navy">
                <X size={20} />
              </button>
            </div>
            <div className="border-b border-grey-border p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  value={revisitSearch}
                  onChange={(e) => setRevisitSearch(e.target.value)}
                  placeholder="Search existing clients by name or phone"
                  className="w-full rounded-lg border border-grey-border py-2.5 pl-9 pr-3 text-sm text-navy placeholder:text-gray-400 focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
                />
              </div>
              {justLogged && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  <Check size={12} />
                  Visit logged for {justLogged}
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {knownClients.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-grey-bg">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy">{c.name}</p>
                    <p className="truncate text-xs text-gray-400">{c.phone} · {c.country} — {c.purpose}</p>
                    <p className="text-xs text-gray-400">Last visit: {c.lastVisit}</p>
                  </div>
                  <button
                    onClick={() => logRevisit(c.id, c.name)}
                    className="flex-shrink-0 rounded-lg border border-grey-border px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
                  >
                    Log Visit
                  </button>
                </div>
              ))}
              {knownClients.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">No matching clients on file.</p>
              )}
            </div>
            <div className="border-t border-grey-border p-4">
              <button
                onClick={() => setShowRevisitModal(false)}
                className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
