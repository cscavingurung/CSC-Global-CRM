import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock, Lock, Mail, MapPin, Phone, UserCheck } from 'lucide-react';
import { CityPoolLead, MOCK_CITY_POOL_LEADS, claimAuditLine, claimCityPoolLead, maskName, maskPhone, timeInPool } from '../../cityLeadPool';
import { Chips, Pill, PrimaryButton, SourceTag } from '../marketing/MktShared';

// City-Wide Lead Pool — the counselor-facing workspace tab for leads Marketing has routed to a
// whole city (see cityLeadPool.ts) instead of handing one branch first pick. Every counselor at
// a branch in this city sees the same pool with contact details masked; the first one to click
// "Accept & Claim Lead" locks the record to their own branch and profile, and it moves out of
// the shared pool into their own "My Active Leads" queue with full details unlocked.
//
// Two modes: pass `leads` + `onClaim` for the real, backend-wired pool (App.tsx does — onClaim
// calls lib/studentsApi.ts's claimStudent, an atomic UPDATE ... WHERE claimed_by IS NULL, so the
// race is decided by Postgres's row lock). Omit both to run the built-in Kathmandu demo instead.

interface CityLeadPoolProps {
  /** Defaults to the demo city — Kathmandu. */
  city?: string;
  /** The signed-in counselor claiming leads. Defaults to the audit-trail example counselor. */
  me?: { name: string; branch: string };
  /** Real mode: the pool's current leads (both unclaimed and this counselor's own claims). */
  leads?: CityPoolLead[];
  /** Real mode: claims `leadId` against the backend. Must resolve only after the claim (or its
   * rejection) is durable — the UI reflects `leads` again as soon as this resolves. */
  onClaim?: (leadId: string) => Promise<'claimed' | 'already-claimed'>;
}

type Tab = 'Pool' | 'My Active Leads';

export default function CityLeadPool({ city = 'Kathmandu', me = { name: 'Rupesh Koirala', branch: 'Chitwan' }, leads: controlledLeads, onClaim }: CityLeadPoolProps) {
  const controlled = controlledLeads !== undefined && onClaim !== undefined;
  const [demoLeads, setDemoLeads] = useState<CityPoolLead[]>(() => MOCK_CITY_POOL_LEADS);
  const leads = controlled ? controlledLeads! : demoLeads;

  const [tab, setTab] = useState<Tab>('Pool');
  const [toast, setToast] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Keeps "Entered X mins ago" ticking without needing a page refresh.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const pool = leads.filter((l) => l.city === city && !l.claim);
  const mine = leads.filter((l) => l.claim?.counselorName === me.name);

  const handleClaim = async (lead: CityPoolLead) => {
    setPendingId(lead.id);
    let outcome: 'claimed' | 'already-claimed';
    if (controlled) {
      outcome = await onClaim!(lead.id);
    } else {
      const claimed = claimCityPoolLead(demoLeads, lead.id, me.name, me.branch);
      outcome = claimed ? 'claimed' : 'already-claimed';
      if (claimed) setDemoLeads(claimed);
    }
    setPendingId(null);
    if (outcome === 'claimed') {
      setToast(`${lead.fullName} claimed — full details unlocked in My Active Leads.`);
      setTab('My Active Leads');
    } else {
      setToast('Too late — another counselor already claimed this lead.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex-1 text-sm text-gray-500">
          Leads Marketing routed to the whole {city} city — not one branch — so every branch gets a fair shot.
          First counselor to accept locks it to their own branch.
        </p>
        <Pill text={`${city} City Pool`} cls="bg-navy/10 text-navy" />
      </div>
      <Chips
        options={['Pool', 'My Active Leads'] as const}
        value={tab}
        onChange={setTab}
        counts={{ Pool: pool.length, 'My Active Leads': mine.length }}
      />

      {tab === 'Pool' ? (
        pool.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-grey-border bg-white px-4 py-12 text-sm text-emerald-700">
            <CheckCircle2 size={16} /> No unclaimed leads waiting in the {city} City Pool right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pool.map((lead) => (
              <div key={lead.id} className="dissolve-in flex flex-col rounded-xl border border-grey-border bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-navy">
                    <Lock size={14} className="text-gray-400" />
                    <p className="font-semibold">{maskName(lead.fullName)}</p>
                  </div>
                  <SourceTag source={lead.source} />
                </div>
                <dl className="mt-3 flex-1 space-y-1.5 text-xs">
                  <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-400">Phone</dt><dd className="text-navy">{maskPhone(lead.fullPhone)}</dd></div>
                  <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-400">Country</dt><dd className="text-navy">{lead.interestedCountry}</dd></div>
                  <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-400">Program</dt><dd className="text-navy">{lead.targetProgram}</dd></div>
                </dl>
                <p className="mt-3 flex items-center gap-1.5 text-[11px]">
                  <Pill text={timeInPool(lead.enteredPoolAt, now)} cls="bg-amber-50 text-amber-700" />
                </p>
                <div className="mt-3 grid">
                  <PrimaryButton disabled={pendingId === lead.id} onClick={() => handleClaim(lead)}>
                    <UserCheck size={15} /> {pendingId === lead.id ? 'Claiming…' : 'Accept & Claim Lead'}
                  </PrimaryButton>
                </div>
              </div>
            ))}
          </div>
        )
      ) : mine.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-grey-border bg-white px-4 py-12 text-sm text-gray-400">
          Leads you claim from the City Pool will show up here.
        </div>
      ) : (
        <ul className="space-y-3">
          {mine.map((lead) => (
            <li key={lead.id} className="dissolve-in rounded-xl border border-grey-border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-navy">{lead.fullName}</p>
                <Pill text="Claimed" cls="bg-emerald-50 text-emerald-700" />
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-1.5 text-gray-600"><Phone size={12} className="text-gray-400" /> {lead.fullPhone}</div>
                <div className="flex items-center gap-1.5 text-gray-600"><Mail size={12} className="text-gray-400" /> {lead.email ?? '—'}</div>
                <div className="flex items-center gap-1.5 text-gray-600"><MapPin size={12} className="text-gray-400" /> {lead.interestedCountry} · {lead.targetProgram}</div>
                <div className="flex items-center gap-1.5 text-gray-600"><Building2 size={12} className="text-gray-400" /> {lead.claim?.branch} Branch</div>
              </dl>
              {lead.notes && <p className="mt-2 rounded-lg bg-grey-bg px-3 py-2 text-xs text-gray-600">Marketing note: {lead.notes}</p>}
              <p className="mt-3 flex items-start gap-1.5 border-t border-grey-border pt-2 text-[11px] text-gray-400">
                <Clock size={11} className="mt-0.5 shrink-0" /> {claimAuditLine(lead)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle2 size={18} className="flex-shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
}
