import { ReactNode, useState } from 'react';

type View = 'clients' | 'visitors' | 'add';

const VIEWS: { key: View; label: string }[] = [
  { key: 'clients', label: 'Leads & Clients' },
  { key: 'visitors', label: 'Visitors' },
  { key: 'add', label: 'Add New Lead' },
];

interface LeadVisitorManagementProps {
  clients: ReactNode;
  visitors: ReactNode;
  addLead: ReactNode;
}

/** Branch Manager's Lead & Visitor Management — the client list, visitor log and lead form under one sub-tab. */
export default function LeadVisitorManagement({ clients, visitors, addLead }: LeadVisitorManagementProps) {
  const [view, setView] = useState<View>('clients');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-lg border border-grey-border bg-white p-1 w-fit">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium ${view === v.key ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy hover:bg-grey-bg'}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div key={view} className="dissolve-in">
        {view === 'clients' && clients}
        {view === 'visitors' && visitors}
        {view === 'add' && addLead}
      </div>
    </div>
  );
}
