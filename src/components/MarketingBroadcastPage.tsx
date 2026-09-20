import { useMemo, useState } from 'react';
import { Radar, Search, CheckCircle } from 'lucide-react';
import { IntakeStudent } from '../types';
import { platformBadgeStyle, isMarketingLead } from '../marketing';

interface MarketingBroadcastPageProps {
  students: IntakeStudent[];
  branches: string[];
  onBroadcast: (leadId: string, branch: string) => void;
}

export default function MarketingBroadcastPage({ students, branches, onBroadcast }: MarketingBroadcastPageProps) {
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<Record<string, string>>({});

  const leads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students
      .filter(isMarketingLead)
      .filter((lead) => !lead.claimedBy)
      .filter((lead) => (term ? lead.name.toLowerCase().includes(term) || lead.phone.includes(term) : true));
  }, [students, search]);

  const pool = leads.filter((lead) => !lead.broadcastBranch);
  const broadcast = leads.filter((lead) => lead.broadcastBranch);

  const renderRow = (lead: IntakeStudent) => {
    const branch = selectedBranch[lead.id] ?? '';
    return (
      <tr key={lead.id} className="border-b border-grey-border last:border-0 hover:bg-grey-bg/50 transition-colors">
        <td className="px-5 py-3.5">
          <p className="text-sm font-medium text-navy">{lead.name}</p>
          <p className="text-xs text-gray-400">{lead.phone} · {lead.email}</p>
        </td>
        <td className="px-4 py-3.5">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${platformBadgeStyle(lead.platformSource)}`}>
            {lead.platformSource}
          </span>
        </td>
        <td className="px-4 py-3.5 text-sm text-gray-600">{lead.country}</td>
        <td className="px-4 py-3.5 text-sm text-gray-600">{lead.purpose}</td>
        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-500">{lead.submittedAt}</td>
        <td className="px-5 py-3.5">
          {lead.broadcastBranch ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              Awaiting claim · {lead.broadcastBranch}
            </span>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <select
                aria-label={`Branch group for ${lead.name}`}
                value={branch}
                onChange={(e) => setSelectedBranch((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                className="appearance-none rounded-lg border border-grey-border bg-white px-3 py-2 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
              >
                <option value="">Select branch group</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!branch}
                onClick={() => onBroadcast(lead.id, branch)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-light active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                <Radar size={15} />
                Broadcast to Branch
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const table = (rows: IntakeStudent[], emptyText: string) =>
    rows.length === 0 ? (
      <div className="rounded-xl border border-grey-border bg-white py-12 text-center text-sm text-gray-400">{emptyText}</div>
    ) : (
      <div className="overflow-x-auto rounded-xl border border-grey-border bg-white">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-grey-border bg-grey-bg">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Lead</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Platform Source</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Country of Interest</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Case Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Added</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>{rows.map(renderRow)}</tbody>
        </table>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-grey-border bg-white p-4">
        <p className="text-sm text-navy">
          Broadcast a lead to a branch group and every counselor in that branch is notified — with contact details hidden.
          The first counselor to accept claims the client.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone"
          className="w-full rounded-lg border border-grey-border py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-navy">Unassigned Leads ({pool.length})</h3>
        {table(pool, 'No unassigned marketing leads.')}
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy">
          <CheckCircle size={15} className="text-gray-400" />
          Broadcast — Awaiting Claim ({broadcast.length})
        </h3>
        {table(broadcast, 'Nothing waiting in a branch pool.')}
      </div>
    </div>
  );
}
