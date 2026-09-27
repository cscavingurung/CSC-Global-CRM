import { useState } from 'react';
import { ArrowLeft, Check, Eye, Lock } from 'lucide-react';
import { CaseTask, MockUser, OnboardingCase } from '../types';
import { ONBOARDING_STAGES, criticalOpen, onboardingProgress, onboardingStage } from '../hrCases';
import { formatSubmittedAt } from '../dateTime';
import { OwnerBadge, OwnerMatrix, ProgressBar, StagePipeline, TaskLine } from './HrCaseParts';
import MyOnboardingPage from './MyOnboardingPage';

// ─── Onboarding case ────────────────────────────────────────────────────────
// Pipeline, role-based training, a task matrix by owner and the completion gate. The Branch
// Manager can tick any task on behalf of HR/IT (recorded under their own name).

interface OnboardingCaseViewProps {
  onbCase: OnboardingCase;
  currentUser: MockUser;
  onBack: () => void;
  onUpdate: (update: (c: OnboardingCase) => Partial<OnboardingCase>) => void;
  /** Tick "Create CRM account" → the new hire gets a login. */
  onAccountCreated: (c: OnboardingCase) => void;
  onComplete: (c: OnboardingCase) => void;
}

export default function OnboardingCaseView({ onbCase, currentUser, onBack, onUpdate, onAccountCreated, onComplete }: OnboardingCaseViewProps) {
  const [preview, setPreview] = useState(false);
  const stage = onboardingStage(onbCase);
  const progress = onboardingProgress(onbCase);
  const blockers = criticalOpen(onbCase);
  const done = !!onbCase.completedAt;
  const training = onbCase.tasks.filter((t) => t.kind === 'training');

  const toggle = (task: CaseTask) => {
    const nowDone = !task.doneAt;
    const at = formatSubmittedAt(new Date());
    onUpdate((c) => ({
      tasks: c.tasks.map((t) => (t.id === task.id ? { ...t, doneAt: nowDone ? at : undefined, doneBy: nowDone ? currentUser.name : undefined } : t)),
      log: [...c.log, { id: `l-${Date.now()}`, at, by: currentUser.name, text: `${nowDone ? 'completed' : 'reopened'} “${task.label}”` }],
    }));
    if (nowDone && task.label === 'Create CRM account') onAccountCreated(onbCase);
  };

  if (preview) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          <Eye size={16} /> Previewing what {onbCase.employeeName} sees in Branch Hub → My Onboarding.
          <button type="button" onClick={() => setPreview(false)} className="ml-auto font-semibold hover:underline">Back to case</button>
        </div>
        <MyOnboardingPage onbCase={onbCase} readOnly onToggle={() => {}} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-light hover:text-navy">
        <ArrowLeft size={16} /> All cases
      </button>

      <section className="rounded-xl border border-grey-border bg-white">
        <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start">
          <div className="flex-1">
            <p className="text-xs font-semibold tabular-nums text-gray-500">{onbCase.code} · Onboarding</p>
            <h2 className="mt-1 text-lg font-semibold text-navy">{onbCase.employeeName}</h2>
            <p className="text-sm text-gray-500">{onbCase.role} · {onbCase.branch} · starts {onbCase.startDate} · {onbCase.email}</p>
          </div>
          <button type="button" onClick={() => setPreview(true)} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-grey-border px-3 py-2 text-sm font-medium text-navy hover:border-navy-light hover:bg-grey-bg">
            <Eye size={15} /> Employee view
          </button>
        </div>
        <div className="px-5 py-3"><ProgressBar value={progress} /></div>
        <div className="border-t border-grey-border px-5 py-5">
          <StagePipeline stages={ONBOARDING_STAGES} current={stage} />
        </div>
      </section>

      {/* Role-based checklist */}
      <section className="rounded-xl border border-grey-border bg-white">
        <div className="border-b border-grey-border px-5 py-3">
          <h3 className="text-sm font-semibold text-navy">Role checklist · {onbCase.role}</h3>
          <p className="text-xs text-gray-500">Loaded automatically for the {onbCase.role} role, on top of the standard onboarding tasks.</p>
        </div>
        <ul className="divide-y divide-grey-border/70">
          {training.map((t) => (
            <TaskLine key={t.id} task={t} onToggle={() => toggle(t)} disabled={done || t.owner === 'Employee'} showStage aside={<OwnerBadge owner={t.owner} />} />
          ))}
        </ul>
      </section>

      {/* Delegated task matrix */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-navy">Tasks by owner</h3>
          <p className="text-xs text-gray-500">HR, IT and the Branch Manager each see their own list. Employee tasks are ticked by {onbCase.employeeName} in My Onboarding.</p>
        </div>
        <OwnerMatrix
          tasks={onbCase.tasks}
          owners={['HR', 'IT', 'Branch Manager', 'Employee']}
          onToggle={toggle}
          canTick={(t) => !done && t.owner !== 'Employee'}
        />
      </section>

      {/* Completion gate */}
      <section className={`rounded-xl border px-5 py-4 ${done ? 'border-emerald-200 bg-emerald-50/40' : 'border-grey-border bg-white'}`}>
        {done ? (
          <p className="flex items-center gap-2 text-sm text-emerald-800">
            <Check size={16} /> Onboarding completed {onbCase.completedAt} by {onbCase.completedBy}.
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-semibold text-navy">Complete Onboarding</p>
              {blockers.length === 0 ? (
                <p className="text-xs text-emerald-700">All required HR, IT and Branch Manager setup is verified.</p>
              ) : (
                <p className="text-xs text-gray-500">
                  <Lock size={11} className="mr-1 inline" />
                  {blockers.length} required item{blockers.length === 1 ? '' : 's'} left:{' '}
                  {blockers.slice(0, 3).map((b) => `${b.label} (${b.owner})`).join(', ')}{blockers.length > 3 ? '…' : ''}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onComplete(onbCase)}
              disabled={blockers.length > 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={16} /> Complete Onboarding
            </button>
          </div>
        )}
      </section>

      {/* Log */}
      <section className="rounded-xl border border-grey-border bg-white px-5 py-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Case log</p>
        <ul className="space-y-1">
          {[...onbCase.log].reverse().slice(0, 12).map((l) => (
            <li key={l.id} className="text-xs text-gray-600"><span className="tabular-nums text-gray-400">{l.at}</span> · <span className="font-medium text-navy">{l.by}</span> {l.text}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
