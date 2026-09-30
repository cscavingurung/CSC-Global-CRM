import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, UserMinus, UserPlus, X } from 'lucide-react';
import { MockUser, OffboardingCase, OffboardingReason, OnboardingCase, StaffMember, StaffRole } from '../types';
import {
  CASE_ROLES, nextCaseCode, offboardingProgress, offboardingStage, offboardingTasksFor, onboardingProgress, onboardingStage,
  onboardingTasksFor, WorkloadSources, workloadOf, workloadTotal,
} from '../hrCases';
import { dateKey, formatSubmittedAt } from '../dateTime';
import { HandoverActions } from './HandoverEngine';
import { ProgressBar } from './HrCaseParts';
import OnboardingCaseView from './OnboardingCaseView';
import OffboardingCaseView from './OffboardingCaseView';

// ─── HRM · Employee Onboarding & Offboarding ────────────────────────────────
// Landing dashboard with ONBOARDING | OFFBOARDING tabs, metric cards and a case table; each
// case opens its own workflow view.

interface OnboardingOffboardingPageProps extends HandoverActions {
  currentUser: MockUser;
  /** Branch staff. */
  staff: StaffMember[];
  onboarding: OnboardingCase[];
  offboarding: OffboardingCase[];
  sources: WorkloadSources;
  onAddOnboarding: (c: OnboardingCase) => void;
  onUpdateOnboarding: (id: string, update: (c: OnboardingCase) => Partial<OnboardingCase>) => void;
  onAddOffboarding: (c: OffboardingCase) => void;
  onUpdateOffboarding: (id: string, update: (c: OffboardingCase) => Partial<OffboardingCase>) => void;
  /** New hire's login, created when IT ticks "Create CRM account". */
  onCreateAccount: (c: OnboardingCase) => void;
  /** Sets the leaver's staff record to Inactive — never deletes it. */
  onMarkInactive: (staffName: string) => void;
}

type Tab = 'onboarding' | 'offboarding';

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';
const labelClass = 'mb-1.5 block text-xs font-semibold text-navy';

const shiftDay = (key: string, days: number) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateKey(d);
};
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000);

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className="dissolve-in relative w-full max-w-md rounded-2xl border border-grey-border bg-white">
        <div className="flex items-center justify-between border-b border-grey-border px-6 py-4">
          <h3 className="text-base font-semibold text-navy">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-navy"><X size={18} /></button>
        </div>
        <div className="space-y-4 px-6 py-5">{children}</div>
        <div className="flex gap-3 border-t border-grey-border px-6 py-4">{footer}</div>
      </div>
    </div>
  );
}

function SelectField({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} appearance-none pr-9`}>{children}</select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
    </div>
  );
}

export default function OnboardingOffboardingPage(props: OnboardingOffboardingPageProps) {
  const {
    currentUser, staff, onboarding, offboarding, sources, onAddOnboarding, onUpdateOnboarding, onAddOffboarding, onUpdateOffboarding,
    onCreateAccount, onMarkInactive, ...actions
  } = props;
  const today = dateKey(new Date());
  const year = new Date().getFullYear();
  const [tab, setTab] = useState<Tab>('onboarding');
  const [openCase, setOpenCase] = useState<{ kind: Tab; id: string } | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [creating, setCreating] = useState<Tab | null>(null);

  const leavers = offboarding.filter((c) => !c.finalizedAt).map((c) => c.employeeName);
  const workloadFor = (name: string) => workloadTotal(workloadOf(name, sources));

  // ── Metrics ──────────────────────────────────────────────────────────────
  const onbActive = onboarding.filter((c) => !c.completedAt);
  const onbMetrics = [
    { label: 'New Joiners', hint: 'started in the last 30 days', value: onboarding.filter((c) => c.startDate <= today && daysBetween(c.startDate, today) <= 30).length },
    { label: 'In Progress', hint: 'already started, not complete', value: onbActive.filter((c) => c.startDate <= today).length },
    { label: 'Starting Soon', hint: 'next 14 days', value: onbActive.filter((c) => c.startDate > today && daysBetween(today, c.startDate) <= 14).length },
  ];
  const offActive = offboarding.filter((c) => !c.finalizedAt);
  const offMetrics = [
    { label: 'Leaving Soon', hint: 'last day within 14 days', value: offActive.filter((c) => c.lastWorkingDay >= today && daysBetween(today, c.lastWorkingDay) <= 14).length },
    { label: 'Offboarding', hint: 'open cases', value: offActive.length },
    { label: 'Overdue', hint: 'past last day, not finalised', value: offActive.filter((c) => c.lastWorkingDay < today).length, alert: true },
  ];

  // ── New case forms ───────────────────────────────────────────────────────
  const [onbDraft, setOnbDraft] = useState({ name: '', email: '', role: 'Counselor' as StaffRole, startDate: shiftDay(today, 7) });
  const [offDraft, setOffDraft] = useState({ name: '', reason: 'Resignation' as OffboardingReason, noticeDate: today, lastWorkingDay: shiftDay(today, 30) });
  const offCandidates = staff.filter((s) => s.status === 'Active' && CASE_ROLES.includes(s.role) && !leavers.includes(s.name));

  const createOnboarding = () => {
    if (!onbDraft.name.trim() || !onbDraft.email.trim()) return;
    const id = `onb-${Date.now()}`;
    const at = formatSubmittedAt(new Date());
    onAddOnboarding({
      id,
      code: nextCaseCode('ONB', onboarding.map((c) => c.code), year),
      branch: currentUser.branch,
      employeeName: onbDraft.name.trim(),
      email: onbDraft.email.trim(),
      role: onbDraft.role,
      startDate: onbDraft.startDate,
      createdAt: at,
      createdBy: currentUser.name,
      tasks: onboardingTasksFor(onbDraft.role, id),
      log: [{ id: `${id}-l0`, at, by: currentUser.name, text: 'opened the onboarding case' }],
    });
    setCreating(null);
    setOnbDraft({ ...onbDraft, name: '', email: '' });
    setOpenCase({ kind: 'onboarding', id });
  };

  const createOffboarding = () => {
    const member = staff.find((s) => s.name === offDraft.name);
    if (!member) return;
    const id = `off-${Date.now()}`;
    const at = formatSubmittedAt(new Date());
    onAddOffboarding({
      id,
      code: nextCaseCode('OFF', offboarding.map((c) => c.code), year),
      branch: currentUser.branch,
      employeeName: member.name,
      role: member.role,
      reason: offDraft.reason,
      noticeDate: offDraft.noticeDate,
      lastWorkingDay: offDraft.lastWorkingDay,
      createdAt: at,
      createdBy: currentUser.name,
      tasks: offboardingTasksFor(member.role, id),
      clearance: {},
      handoverLog: [],
      log: [{ id: `${id}-l0`, at, by: currentUser.name, text: `opened the offboarding case — ${offDraft.reason.toLowerCase()}` }],
    });
    setCreating(null);
    setOpenCase({ kind: 'offboarding', id });
  };

  // ── Case views ───────────────────────────────────────────────────────────
  if (openCase?.kind === 'onboarding') {
    const c = onboarding.find((x) => x.id === openCase.id);
    if (c) {
      return (
        <OnboardingCaseView
          onbCase={c}
          currentUser={currentUser}
          onBack={() => setOpenCase(null)}
          onUpdate={(update) => onUpdateOnboarding(c.id, update)}
          onAccountCreated={onCreateAccount}
          onComplete={(done) =>
            onUpdateOnboarding(done.id, (x) => ({
              completedAt: formatSubmittedAt(new Date()),
              completedBy: currentUser.name,
              log: [...x.log, { id: `l-${Date.now()}`, at: formatSubmittedAt(new Date()), by: currentUser.name, text: 'completed onboarding' }],
            }))
          }
        />
      );
    }
  }
  if (openCase?.kind === 'offboarding') {
    const c = offboarding.find((x) => x.id === openCase.id);
    if (c) {
      return (
        <OffboardingCaseView
          offCase={c}
          currentUser={currentUser}
          staff={staff}
          sources={sources}
          leavers={leavers.filter((n) => n !== c.employeeName)}
          onBack={() => setOpenCase(null)}
          onUpdate={(update) => onUpdateOffboarding(c.id, update)}
          onFinalize={(fin) => {
            onMarkInactive(fin.employeeName);
            onUpdateOffboarding(fin.id, (x) => ({
              finalizedAt: formatSubmittedAt(new Date()),
              finalizedBy: currentUser.name,
              log: [...x.log, { id: `l-${Date.now()}`, at: formatSubmittedAt(new Date()), by: currentUser.name, text: 'finalized offboarding — marked Inactive / Former Employee' }],
            }));
          }}
          {...actions}
        />
      );
    }
  }

  // ── Landing ──────────────────────────────────────────────────────────────
  const metrics = tab === 'onboarding' ? onbMetrics : offMetrics;
  const rows = tab === 'onboarding'
    ? onboarding
      .filter((c) => showClosed || !c.completedAt)
      .sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt) || a.startDate.localeCompare(b.startDate))
      .map((c) => ({
        id: c.id, code: c.code, name: c.employeeName, branch: c.branch, role: c.role,
        status: onboardingStage(c), date: `Starts ${c.startDate}`, progress: onboardingProgress(c), alert: false, closed: !!c.completedAt,
      }))
    : offboarding
      .filter((c) => showClosed || !c.finalizedAt)
      .sort((a, b) => Number(!!a.finalizedAt) - Number(!!b.finalizedAt) || a.lastWorkingDay.localeCompare(b.lastWorkingDay))
      .map((c) => {
        const w = workloadFor(c.employeeName);
        return {
          id: c.id, code: c.code, name: c.employeeName, branch: c.branch, role: c.role,
          status: offboardingStage(c, w), date: `Last day ${c.lastWorkingDay}`, progress: offboardingProgress(c, w),
          alert: !c.finalizedAt && c.lastWorkingDay < today, closed: !!c.finalizedAt, workload: w,
        };
      });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex self-start rounded-lg border border-grey-border bg-white p-0.5">
          {(['onboarding', 'offboarding'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`rounded-md px-5 py-2 text-sm font-semibold tracking-wide ${tab === t ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCreating(tab)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light"
        >
          {tab === 'onboarding' ? <><UserPlus size={16} /> New Onboarding Case</> : <><UserMinus size={16} /> Start Offboarding</>}
        </button>
      </div>

      <div key={tab} className="dissolve-in space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-xl border border-grey-border bg-white px-5 py-4">
              <p className="text-xs font-medium text-gray-500">{m.label}</p>
              <p className={`mt-1 text-3xl font-semibold tabular-nums ${m.value === 0 ? 'text-gray-300' : 'alert' in m && m.alert ? 'text-red-600' : 'text-navy'}`}>{m.value}</p>
              <p className="text-[11px] text-gray-400">{m.hint}</p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border border-grey-border bg-white">
          <div className="flex items-center justify-between border-b border-grey-border px-5 py-3">
            <h2 className="text-sm font-semibold text-navy">{tab === 'onboarding' ? 'Onboarding cases' : 'Offboarding cases'}</h2>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="h-3.5 w-3.5 accent-navy" />
              Show {tab === 'onboarding' ? 'completed' : 'closed'}
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="bg-grey-bg text-left">
                  {['Case', 'Employee', 'Branch', 'Role', 'Status', tab === 'onboarding' ? 'Start' : 'Last day', 'Progress', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setOpenCase({ kind: tab, id: r.id })} className={`cursor-pointer border-t border-grey-border hover:bg-grey-bg/50 ${r.closed ? 'opacity-60' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold tabular-nums text-gray-500">{r.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-navy">
                      {r.name}
                      {'workload' in r && !r.closed && r.workload! > 0 && <p className="text-[11px] font-normal text-amber-700">{r.workload} open item{r.workload === 1 ? '' : 's'} to hand over</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.branch}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{r.role}</td>
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                        r.closed ? 'bg-gray-100 text-gray-600' : r.alert ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {r.alert ? `Overdue · ${r.status}` : r.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-gray-600">{r.date.replace(/^(Starts|Last day) /, '')}</td>
                    <td className="w-44 px-4 py-3"><ProgressBar value={r.progress} /></td>
                    <td className="px-3 py-3 text-gray-300"><ChevronRight size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-400">
                {tab === 'onboarding' ? 'No active onboarding cases.' : 'No one is leaving right now.'}
              </p>
            )}
          </div>
        </section>
      </div>

      {creating === 'onboarding' && (
        <Modal
          title="New Onboarding Case"
          onClose={() => setCreating(null)}
          footer={<>
            <button type="button" onClick={() => setCreating(null)} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
            <button type="button" onClick={createOnboarding} disabled={!onbDraft.name.trim() || !onbDraft.email.trim()} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40">
              <Plus size={15} className="mr-1 inline" /> Open case
            </button>
          </>}
        >
          <div>
            <label htmlFor="onb-name" className={labelClass}>Employee name</label>
            <input id="onb-name" value={onbDraft.name} onChange={(e) => setOnbDraft({ ...onbDraft, name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="onb-email" className={labelClass}>Work email</label>
            <input id="onb-email" type="email" value={onbDraft.email} onChange={(e) => setOnbDraft({ ...onbDraft, email: e.target.value })} className={inputClass} placeholder="name@csc.edu.np" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField id="onb-role" label="Role" value={onbDraft.role} onChange={(v) => setOnbDraft({ ...onbDraft, role: v as StaffRole })}>
              {CASE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </SelectField>
            <div>
              <label htmlFor="onb-start" className={labelClass}>Start date</label>
              <input id="onb-start" type="date" value={onbDraft.startDate} onChange={(e) => setOnbDraft({ ...onbDraft, startDate: e.target.value })} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-gray-500">The checklist is loaded for the {onbDraft.role} role. Their login is created when IT ticks “Create CRM account”.</p>
        </Modal>
      )}

      {creating === 'offboarding' && (
        <Modal
          title="Start Offboarding"
          onClose={() => setCreating(null)}
          footer={<>
            <button type="button" onClick={() => setCreating(null)} className="flex-1 rounded-lg border border-grey-border py-2.5 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
            <button type="button" onClick={createOffboarding} disabled={!offDraft.name || offDraft.lastWorkingDay < offDraft.noticeDate} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40">
              Open case
            </button>
          </>}
        >
          <SelectField id="off-name" label="Employee" value={offDraft.name} onChange={(v) => setOffDraft({ ...offDraft, name: v })}>
            <option value="" disabled>Choose an employee…</option>
            {offCandidates.map((s) => <option key={s.id} value={s.name}>{s.name} · {s.role}</option>)}
          </SelectField>
          {offDraft.name && (
            <p className="rounded-lg bg-grey-bg px-3 py-2 text-xs text-gray-600">
              Open workload: <span className="font-semibold text-navy">{workloadFor(offDraft.name)}</span> item{workloadFor(offDraft.name) === 1 ? '' : 's'} — handled in the Handover Engine.
            </p>
          )}
          <SelectField id="off-reason" label="Reason" value={offDraft.reason} onChange={(v) => setOffDraft({ ...offDraft, reason: v as OffboardingReason })}>
            {(['Resignation', 'Contract end', 'Termination', 'Transfer'] as const).map((r) => <option key={r} value={r}>{r}</option>)}
          </SelectField>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="off-notice" className={labelClass}>Notice date</label>
              <input id="off-notice" type="date" value={offDraft.noticeDate} onChange={(e) => setOffDraft({ ...offDraft, noticeDate: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="off-last" className={labelClass}>Last working day</label>
              <input id="off-last" type="date" value={offDraft.lastWorkingDay} min={offDraft.noticeDate} onChange={(e) => setOffDraft({ ...offDraft, lastWorkingDay: e.target.value })} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-gray-500">The employee keeps working normally until the case is finalised. Their record is never deleted.</p>
        </Modal>
      )}
    </div>
  );
}
