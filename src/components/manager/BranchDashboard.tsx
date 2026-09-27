import { useEffect, useMemo } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ChevronRight, DoorClosed, DoorOpen, Users } from 'lucide-react';
import { NavIntent, StaffMember } from '../../types';
import {
  APPOINTMENT_STYLES, BranchDashboardSources, PIPELINE_STEPS, STAFF_STATUS_STYLES, appointmentsToday, attentionRequired,
  branchStatus, pipeline, resolveManagerPath, snapshot, staffToday, widgets,
} from '../../branchDashboard';

// ─── Branch Manager Dashboard ───────────────────────────────────────────────
// A routing hub, not an analytics page: what's happening in the branch today and what needs the
// manager. Everything is clickable. The dashboard lives in a MemoryRouter at /manager/dashboard;
// every other /manager/... path is caught by <Bridge/>, which opens the matching CRM page with the
// right filter (resolveManagerPath in branchDashboard.ts).

interface BranchDashboardProps {
  sources: BranchDashboardSources;
  managerName: string;
  onNavigateApp: (key: string, intent?: NavIntent) => void;
}

const BASE = '/manager/dashboard';

const TONE: Record<string, string> = { red: 'text-red-700', amber: 'text-amber-700', green: 'text-emerald-700' };

function Section({ title, action, children, className = '' }: { title: string; action?: { label: string; to: string }; children: React.ReactNode; className?: string }) {
  const navigate = useNavigate();
  return (
    <section className={`rounded-xl border border-grey-border bg-white ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-grey-border px-4 py-3">
        <h3 className="text-sm font-semibold text-navy">{title}</h3>
        {action && (
          <button type="button" onClick={() => navigate(action.to)} className="inline-flex items-center gap-0.5 text-xs font-medium text-navy-light hover:text-navy">
            {action.label} <ChevronRight size={13} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Dashboard({ sources, managerName }: Omit<BranchDashboardProps, 'onNavigateApp'>) {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const status = useMemo(() => branchStatus(sources, now), [sources, now]);
  const cards = useMemo(() => snapshot(sources, now), [sources, now]);
  const attention = useMemo(() => attentionRequired(sources, now), [sources, now]);
  const appts = useMemo(() => appointmentsToday(sources, now), [sources, now]);
  const people = useMemo(() => staffToday(sources, now), [sources, now]);
  const flow = useMemo(() => pipeline(sources), [sources]);
  const bottom = useMemo(() => widgets(sources, now), [sources, now]);
  const critical = attention.filter((a) => a.severity === 'critical').length;
  const hello = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  const statusCls = status.state === 'Open'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : status.state === 'Closed' ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <div className="space-y-5">
      {/* 1. Header & opening status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-navy">{hello}, {managerName.split(' ')[0]}</h2>
          <p className="text-sm text-gray-500">{sources.branch} branch · {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button type="button" onClick={() => navigate('/manager/operations/opening')} title="Branch Operations Control"
          className={`inline-flex items-center gap-2 self-start rounded-lg border px-3 py-2 text-sm transition-colors hover:border-navy-light sm:self-auto ${statusCls}`}>
          {status.state === 'Closed' ? <DoorClosed size={16} /> : <DoorOpen size={16} />}
          <span className="font-semibold uppercase tracking-wide">{status.state === 'Not Opened' ? 'Not Opened' : status.state}</span>
          <span className="text-xs opacity-80">– {status.text}</span>
          <ChevronRight size={14} className="opacity-60" />
        </button>
      </div>

      {/* 2. Today's snapshot */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <button key={c.key} type="button" onClick={() => navigate(c.path)} className="group flex flex-col rounded-xl border border-grey-border bg-white px-4 py-3 text-left transition-colors hover:border-navy-light">
            <span className="text-xs font-medium text-gray-500">{c.label}</span>
            <span className={`mt-0.5 text-2xl font-bold tabular-nums ${c.tone && c.tone !== 'green' ? TONE[c.tone] : 'text-navy'}`}>{c.value}</span>
            <span className={`mt-0.5 flex items-center justify-between text-[11px] ${c.tone ? TONE[c.tone] : 'text-gray-400'}`}>
              {c.hint}
              <ArrowRight size={12} className="text-gray-300 transition-colors group-hover:text-navy-light" />
            </span>
          </button>
        ))}
      </div>

      {/* 3. Attention required */}
      <section className={`rounded-xl border ${attention.length ? 'border-red-200 bg-red-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h3 className={`flex items-center gap-2 text-sm font-semibold ${attention.length ? 'text-red-800' : 'text-emerald-800'}`}>
            {attention.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} Attention Required
          </h3>
          {attention.length > 0 && (
            <span className="flex gap-1.5">
              {critical > 0 && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">{critical} critical</span>}
              {attention.length - critical > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">{attention.length - critical} to check</span>}
            </span>
          )}
        </div>
        {attention.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-emerald-800">Nothing needs you right now.</p>
        ) : (
          <ul className="divide-y divide-red-100 border-t border-red-100">
            {attention.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => navigate(a.path)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/70">
                  {a.severity === 'critical' ? <AlertOctagon size={16} className="shrink-0 text-red-600" /> : <AlertTriangle size={16} className="shrink-0 text-amber-600" />}
                  <span className="min-w-0 flex-1 text-sm text-navy">
                    {a.text}
                    {a.assignee && <span className="ml-2 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600">Assignee: {a.assignee}</span>}
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Appointments & staff */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={`Today’s Appointments · ${appts.length}`} action={{ label: 'Front desk', to: '/manager/appointments' }}>
          {appts.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400"><CalendarClock size={16} /> No visits or follow-ups today.</p>
          ) : (
            <ul className="divide-y divide-grey-border">
              {appts.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => navigate(a.kind === 'Follow-up' ? '/manager/leads?stage=Followup' : a.status === 'Unassigned' ? '/manager/leads?stage=New' : '/manager/appointments')}
                    className="grid w-full grid-cols-[72px_1fr_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-grey-bg/60">
                    <span className="text-xs font-medium tabular-nums text-gray-500">{a.time}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-navy">{a.client}</span>
                      <span className="block truncate text-xs text-gray-400">{a.counselor}</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${APPOINTMENT_STYLES[a.status]}`}>{a.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-grey-border px-4 py-2 text-[11px] text-gray-400">Client visits logged today and follow-ups scheduled for today.</p>
        </Section>

        <Section title={`Staff Status · ${people.length}`} action={{ label: 'Attendance', to: '/manager/hr/attendance' }}>
          <table className="w-full text-sm">
            <thead className="bg-grey-bg">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Employee</th>
                <th className="hidden px-2 py-2 text-left text-xs font-semibold text-gray-500 sm:table-cell">Role</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Tasks</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/manager/hr/staff/${encodeURIComponent(p.id)}`)} className="cursor-pointer border-b border-grey-border transition-colors last:border-0 hover:bg-grey-bg/60">
                  <td className="px-4 py-2.5">
                    <span className="block font-medium text-navy">{p.name}</span>
                    <span className="block text-[11px] text-gray-400 sm:hidden">{p.role}</span>
                  </td>
                  <td className="hidden px-2 py-2.5 text-xs text-gray-500 sm:table-cell">{p.role}</td>
                  <td className="px-2 py-2.5">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STAFF_STATUS_STYLES[p.status]}`}>{p.status}</span>
                    {p.checkIn && <span className="ml-1.5 hidden text-[11px] text-gray-400 md:inline">{p.checkIn}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.pendingTasks > 0
                      ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-800">{p.pendingTasks}</span>
                      : <span className="text-xs text-gray-300">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {people.length === 0 && <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400"><Users size={16} /> No active staff.</p>}
        </Section>
      </div>

      {/* 5. Pipeline */}
      <Section title="Lead & Client Pipeline" action={{ label: 'All leads', to: '/manager/leads' }}>
        <div className="flex items-stretch overflow-x-auto p-3">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step} className="flex min-w-[96px] flex-1 items-center">
              <button type="button" onClick={() => navigate(`/manager/leads?stage=${step}`)}
                className="flex flex-1 flex-col items-center rounded-lg border border-grey-border px-2 py-3 transition-colors hover:border-navy-light hover:bg-grey-bg/50">
                <span className="text-2xl font-bold tabular-nums text-navy">{flow[step]}</span>
                <span className="text-xs font-medium text-gray-500">{step}</span>
              </button>
              {i < PIPELINE_STEPS.length - 1 && <ChevronRight size={16} className="mx-1 shrink-0 text-gray-300" />}
            </div>
          ))}
        </div>
        <p className="border-t border-grey-border px-4 py-2 text-[11px] text-gray-400">Where your active leads and clients are right now. Closed files (not proceeding, withdrawn, visa decided) are left out.</p>
      </Section>

      {/* 6. Bottom widgets */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {bottom.map((w) => (
          <button key={w.key} type="button" onClick={() => navigate(w.path)} className="group rounded-xl border border-grey-border bg-white p-4 text-left transition-colors hover:border-navy-light">
            <span className="flex items-center justify-between text-sm font-semibold text-navy">
              {w.title}
              <ArrowRight size={14} className="text-gray-300 transition-colors group-hover:text-navy-light" />
            </span>
            <span className="mt-2 block space-y-1.5">
              {w.lines.map((l) => (
                <span key={l.label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{l.label}</span>
                  <span className={`font-semibold tabular-nums ${l.tone ? TONE[l.tone] : 'text-navy'}`}>{l.value}</span>
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Any /manager/... path other than the dashboard → open the CRM page that holds the detail. */
function Bridge({ staff, onNavigateApp }: { staff: StaffMember[]; onNavigateApp: BranchDashboardProps['onNavigateApp'] }) {
  const location = useLocation();
  useEffect(() => {
    const target = resolveManagerPath(location.pathname, location.search, staff);
    onNavigateApp(target.navKey, target.intent);
  }, [location.pathname, location.search, staff, onNavigateApp]);
  return null;
}

export default function BranchDashboard({ sources, managerName, onNavigateApp }: BranchDashboardProps) {
  return (
    <MemoryRouter initialEntries={[BASE]}>
      <Routes>
        <Route path={BASE} element={<Dashboard sources={sources} managerName={managerName} />} />
        <Route path="*" element={<Bridge staff={sources.staff} onNavigateApp={onNavigateApp} />} />
      </Routes>
    </MemoryRouter>
  );
}
