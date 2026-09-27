import { Check, PartyPopper } from 'lucide-react';
import { CaseTask, OnboardingCase } from '../types';
import { ONBOARDING_STAGES, onboardingProgress, onboardingStage } from '../hrCases';
import { ProgressBar, StagePipeline, TaskLine } from './HrCaseParts';

// ─── Branch Hub · My Onboarding ─────────────────────────────────────────────
// What a new hire sees: a welcome, their overall progress, and only the tasks that are theirs.

interface MyOnboardingPageProps {
  onbCase: OnboardingCase;
  onToggle: (task: CaseTask) => void;
  /** Manager preview — checkboxes disabled. */
  readOnly?: boolean;
}

export default function MyOnboardingPage({ onbCase, onToggle, readOnly }: MyOnboardingPageProps) {
  const progress = onboardingProgress(onbCase);
  const done = onbCase.tasks.filter((t) => t.doneAt).length;
  const remaining = onbCase.tasks.length - done;
  const mine = onbCase.tasks.filter((t) => t.owner === 'Employee');
  const myOpen = mine.filter((t) => !t.doneAt);
  const firstName = onbCase.employeeName.split(' ')[0];

  return (
    <div className="max-w-3xl space-y-5">
      <section className="rounded-xl border border-grey-border bg-white px-6 py-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-navy-light">
          <PartyPopper size={14} /> {onbCase.code}
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-navy">Welcome to CSC Global, {firstName}!</h2>
        <p className="mt-1 text-sm text-gray-500">
          {onbCase.role} · {onbCase.branch} branch · started {onbCase.startDate}. Here’s where your onboarding stands.
        </p>

        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-sm font-semibold text-navy">{progress}% Complete</p>
            <p className="text-xs text-gray-500">{done} completed · {remaining} remaining</p>
          </div>
          <ProgressBar value={progress} size="lg" />
        </div>
        <div className="mt-5">
          <StagePipeline stages={ONBOARDING_STAGES} current={onboardingStage(onbCase)} />
        </div>
      </section>

      <section className="rounded-xl border border-grey-border bg-white">
        <div className="border-b border-grey-border px-5 py-3">
          <h3 className="text-sm font-semibold text-navy">My tasks</h3>
          <p className="text-xs text-gray-500">
            {myOpen.length === 0 ? 'You’re all done — HR, IT and your manager handle the rest.' : `${myOpen.length} left for you. HR, IT and your manager handle everything else.`}
          </p>
        </div>
        <ul className="divide-y divide-grey-border/70">
          {mine.map((t) => <TaskLine key={t.id} task={t} onToggle={() => onToggle(t)} disabled={readOnly || !!onbCase.completedAt} showStage />)}
        </ul>
      </section>

      {onbCase.completedAt && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <Check size={16} /> Onboarding complete — welcome aboard.
        </p>
      )}
    </div>
  );
}
