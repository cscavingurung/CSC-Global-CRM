import { useState } from 'react';
import { ArrowLeft, Check, KeyRound, Lock, ShieldOff, UserX } from 'lucide-react';
import { CaseTask, ClearanceDept, MockUser, OffboardingCase, StaffMember } from '../types';
import { CLEARANCE_DEPTS, OFFBOARDING_STAGES, WorkloadSources, offboardingProgress, offboardingStage, workloadOf, workloadTotal } from '../hrCases';
import { dateKey, formatSubmittedAt } from '../dateTime';
import HandoverEngine, { HandoverActions } from './HandoverEngine';
import { OwnerBadge, ProgressBar, StagePipeline, TaskLine } from './HrCaseParts';

// ─── Offboarding case ───────────────────────────────────────────────────────
// Notice → Handover → Access & Assets → Clearance → Exit Interview → Closed. Finalising
// never deletes the employee: their staff record is set to Inactive so every client note,
// application and log entry they authored keeps its name.

interface OffboardingCaseViewProps extends HandoverActions {
  offCase: OffboardingCase;
  currentUser: MockUser;
  staff: StaffMember[];
  sources: WorkloadSources;
  /** Other people mid-offboarding — can't receive handover work. */
  leavers: string[];
  onBack: () => void;
  onUpdate: (update: (c: OffboardingCase) => Partial<OffboardingCase>) => void;
  onFinalize: (c: OffboardingCase) => void;
}

export default function OffboardingCaseView({
  offCase, currentUser, staff, sources, leavers, onBack, onUpdate, onFinalize, ...actions
}: OffboardingCaseViewProps) {
  const today = dateKey(new Date());
  const workload = workloadTotal(workloadOf(offCase.employeeName, sources));
  const stage = offboardingStage(offCase, workload);
  const progress = offboardingProgress(offCase, workload);
  const closed = !!offCase.finalizedAt;
  const overdue = !closed && offCase.lastWorkingDay < today;
  const member = staff.find((s) => s.name === offCase.employeeName);
  const [notes, setNotes] = useState('');

  const log = (text: string) => ({ id: `l-${Date.now()}`, at: formatSubmittedAt(new Date()), by: currentUser.name, text });

  const toggle = (task: CaseTask) => {
    const nowDone = !task.doneAt;
    const at = formatSubmittedAt(new Date());
    onUpdate((c) => ({
      tasks: c.tasks.map((t) => (t.id === task.id ? { ...t, doneAt: nowDone ? at : undefined, doneBy: nowDone ? currentUser.name : undefined } : t)),
      log: [...c.log, log(`${nowDone ? 'completed' : 'reopened'} “${task.label}”`)],
    }));
  };

  const assetTasks = offCase.tasks.filter((t) => t.kind === 'asset');
  const accessTasks = offCase.tasks.filter((t) => t.kind === 'access');
  const otherTasks = offCase.tasks.filter((t) => !t.kind);
  const accessRevoked = accessTasks.every((t) => t.doneAt);
  const assetsBack = assetTasks.every((t) => t.doneAt);

  // Each department signs off only once its own part is actually done.
  const clearanceBlock = (d: ClearanceDept): string | null => {
    if (d === 'Branch Manager' && workload > 0) return `${workload} open item${workload === 1 ? '' : 's'} still to hand over`;
    if (d === 'IT' && !accessRevoked) return 'IT access not fully revoked';
    if (d === 'HR' && !assetsBack) return 'Assets not all returned';
    return null;
  };
  const sign = (d: ClearanceDept) =>
    onUpdate((c) => ({ clearance: { ...c.clearance, [d]: { by: currentUser.name, at: formatSubmittedAt(new Date()) } }, log: [...c.log, log(`signed ${d} clearance`)] }));
  const unsign = (d: ClearanceDept) =>
    onUpdate((c) => {
      const next = { ...c.clearance };
      delete next[d];
      return { clearance: next, log: [...c.log, log(`withdrew ${d} clearance`)] };
    });
  const allCleared = CLEARANCE_DEPTS.every((d) => offCase.clearance[d]);

  const recordInterview = (declined: boolean) => {
    onUpdate((c) => ({
      exitInterview: { at: formatSubmittedAt(new Date()), by: currentUser.name, notes: declined ? '' : notes.trim(), declined },
      log: [...c.log, log(declined ? 'recorded: employee declined the exit interview' : 'recorded the exit interview')],
    }));
    setNotes('');
  };

  const section = 'rounded-xl border border-grey-border bg-white';

  return (
    <div className="max-w-6xl space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-light hover:text-navy">
        <ArrowLeft size={16} /> All cases
      </button>

      {/* Header */}
      <section className={section}>
        <div className="flex flex-col gap-2 px-5 pt-5 sm:flex-row sm:items-start">
          <div className="flex-1">
            <p className="text-xs font-semibold tabular-nums text-gray-500">{offCase.code} · Offboarding · {offCase.reason}</p>
            <h2 className="mt-1 text-lg font-semibold text-navy">{offCase.employeeName}</h2>
            <p className="text-sm text-gray-500">
              {offCase.role} · {offCase.branch} · notice {offCase.noticeDate} · last working day <span className={overdue ? 'font-semibold text-red-700' : 'text-navy'}>{offCase.lastWorkingDay}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {overdue && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">Overdue</span>}
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${member?.status === 'Inactive' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700'}`}>
              {member?.status === 'Inactive' ? 'Inactive / Former Employee' : 'Active'}
            </span>
          </div>
        </div>
        <div className="px-5 py-3"><ProgressBar value={progress} /></div>
        <div className="border-t border-grey-border px-5 py-5">
          <StagePipeline stages={OFFBOARDING_STAGES} current={stage} />
        </div>
      </section>

      {/* Notice + handover meeting */}
      <section className={section}>
        <h3 className="border-b border-grey-border px-5 py-3 text-sm font-semibold text-navy">Notice & handover</h3>
        <ul className="divide-y divide-grey-border/70">
          {otherTasks.map((t) => (
            <TaskLine key={t.id} task={t} onToggle={() => toggle(t)} disabled={closed} showStage aside={<OwnerBadge owner={t.owner} />} />
          ))}
        </ul>
      </section>

      {/* Handover engine */}
      <HandoverEngine
        offCase={offCase}
        sources={sources}
        staff={staff}
        unavailable={[offCase.employeeName, ...leavers]}
        currentUserName={currentUser.name}
        readOnly={closed}
        onLog={(transfer) => onUpdate((c) => ({ handoverLog: [...c.handoverLog, transfer] }))}
        {...actions}
      />

      {/* Assets & access */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[
          { title: 'Assets returned', icon: <KeyRound size={16} />, list: assetTasks, ok: assetsBack },
          { title: 'Access revoked', icon: <ShieldOff size={16} />, list: accessTasks, ok: accessRevoked },
        ].map((g) => (
          <section key={g.title} className={section}>
            <div className="flex items-center gap-2 border-b border-grey-border px-5 py-3">
              <span className="text-gray-400">{g.icon}</span>
              <h3 className="text-sm font-semibold text-navy">{g.title}</h3>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${g.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {g.list.filter((t) => t.doneAt).length}/{g.list.length}
              </span>
            </div>
            <ul className="divide-y divide-grey-border/70">
              {g.list.map((t) => <TaskLine key={t.id} task={t} onToggle={() => toggle(t)} disabled={closed} aside={<OwnerBadge owner={t.owner} />} />)}
            </ul>
            {g.title === 'Access revoked' && (
              <p className="border-t border-grey-border px-5 py-2.5 text-[11px] text-gray-500">The CRM account is set to Inactive automatically when the case is finalised.</p>
            )}
          </section>
        ))}
      </div>

      {/* Clearance matrix */}
      <section className={section}>
        <div className="border-b border-grey-border px-5 py-3">
          <h3 className="text-sm font-semibold text-navy">Clearance</h3>
          <p className="text-xs text-gray-500">Every department signs off before the employee can be finalised.</p>
        </div>
        <div className="grid grid-cols-1 gap-px bg-grey-border sm:grid-cols-2 lg:grid-cols-4">
          {CLEARANCE_DEPTS.map((d) => {
            const signed = offCase.clearance[d];
            const block = clearanceBlock(d);
            return (
              <div key={d} className={`flex flex-col gap-2 px-5 py-4 ${signed ? 'bg-emerald-50/40' : 'bg-white'}`}>
                <div className="flex items-center justify-between">
                  <OwnerBadge owner={d} />
                  {signed ? <Check size={16} className="text-emerald-600" /> : <Lock size={14} className="text-gray-300" />}
                </div>
                {signed ? (
                  <>
                    <p className="text-sm font-medium text-emerald-800">Cleared</p>
                    <p className="text-[11px] text-gray-500">{signed.by} · {signed.at}</p>
                    {!closed && <button type="button" onClick={() => unsign(d)} className="self-start text-[11px] text-gray-400 hover:text-red-700">Withdraw</button>}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">Not signed</p>
                    {block && <p className="text-[11px] text-amber-700">{block}</p>}
                    <button
                      type="button"
                      onClick={() => sign(d)}
                      disabled={!!block || closed}
                      className="mt-auto rounded-lg border border-navy px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy hover:text-white disabled:cursor-not-allowed disabled:border-grey-border disabled:text-gray-400 disabled:hover:bg-transparent"
                    >
                      Sign {d} clearance
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Exit interview */}
      <section className={`${section} px-5 py-4`}>
        <h3 className="text-sm font-semibold text-navy">Exit interview</h3>
        {offCase.exitInterview ? (
          <p className="mt-1 text-sm text-gray-700">
            {offCase.exitInterview.declined ? 'Employee declined the exit interview.' : `“${offCase.exitInterview.notes || 'No notes'}”`}
            <span className="block text-[11px] text-gray-400">{offCase.exitInterview.by} · {offCase.exitInterview.at}</span>
          </p>
        ) : closed ? (
          <p className="mt-1 text-sm text-gray-400">Not recorded.</p>
        ) : (
          <div className="mt-2 space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Reason for leaving, feedback on the team and role, anything to improve…"
              className="w-full resize-y rounded-lg border border-grey-border px-3 py-2 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => recordInterview(false)} disabled={!notes.trim()} className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40">Save interview notes</button>
              <button type="button" onClick={() => recordInterview(true)} className="rounded-lg border border-grey-border px-3 py-2 text-sm font-medium text-navy hover:bg-grey-bg">Employee declined</button>
            </div>
          </div>
        )}
      </section>

      {/* Finalise */}
      <section className={`rounded-xl border px-5 py-4 ${closed ? 'border-grey-border bg-grey-bg/60' : 'border-grey-border bg-white'}`}>
        {closed ? (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <UserX size={16} /> Finalised {offCase.finalizedAt} by {offCase.finalizedBy}. {offCase.employeeName} is now Inactive / Former Employee — their record and client history are kept.
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-semibold text-navy">Finalize Offboarding & Mark Inactive</p>
              <p className="text-xs text-gray-500">
                {allCleared
                  ? `Sets ${offCase.employeeName} to Inactive / Former Employee. Nothing is deleted — their client history keeps their name.`
                  : `Waiting on clearance from ${CLEARANCE_DEPTS.filter((d) => !offCase.clearance[d]).join(', ')}.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onFinalize(offCase)}
              disabled={!allCleared}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40"
            >
              <UserX size={16} /> Finalize Offboarding & Mark Inactive
            </button>
          </div>
        )}
      </section>

      <section className={`${section} px-5 py-4`}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Case log</p>
        <ul className="space-y-1">
          {[...offCase.log].reverse().slice(0, 12).map((l) => (
            <li key={l.id} className="text-xs text-gray-600"><span className="tabular-nums text-gray-400">{l.at}</span> · <span className="font-medium text-navy">{l.by}</span> {l.text}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
