import { Check, Lock } from 'lucide-react';
import { CaseOwner, CaseTask } from '../types';
import { OWNER_STYLES } from '../hrCases';
import { timeOf } from '../branchOps';

// Building blocks shared by the onboarding and offboarding case views.

export function ProgressBar({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 overflow-hidden rounded-full bg-gray-100 ${size === 'lg' ? 'h-3' : 'h-1.5'}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all duration-300 ${value === 100 ? 'bg-emerald-500' : 'bg-navy'}`} style={{ width: `${value}%` }} />
      </div>
      {size === 'sm' && <span className="w-9 text-right text-xs tabular-nums text-gray-500">{value}%</span>}
    </div>
  );
}

export function StagePipeline({ stages, current }: { stages: readonly string[]; current: string }) {
  const at = stages.indexOf(current);
  return (
    <ol className="flex items-start overflow-x-auto pb-1" aria-label={`Stage: ${current}`}>
      {stages.map((s, i) => {
        const done = i < at || (i === at && i === stages.length - 1);
        const here = i === at;
        return (
          <li key={s} className="flex min-w-[92px] flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : i <= at ? 'bg-navy' : 'bg-grey-border'}`} />
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  done ? 'border-navy bg-navy text-white' : here ? 'border-navy bg-white text-navy ring-2 ring-navy/15' : 'border-grey-border bg-white text-gray-400'
                }`}
                aria-current={here ? 'step' : undefined}
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === stages.length - 1 ? 'invisible' : i < at ? 'bg-navy' : 'bg-grey-border'}`} />
            </div>
            <span className={`mt-1.5 text-xs ${here ? 'font-semibold text-navy' : i < at ? 'text-navy' : 'text-gray-400'}`}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function OwnerBadge({ owner }: { owner: CaseOwner | string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OWNER_STYLES[owner] ?? 'bg-gray-100 text-gray-600'}`}>{owner}</span>;
}

/** One tickable task line. */
export function TaskLine({ task, onToggle, disabled, showStage, aside }: {
  task: CaseTask; onToggle: () => void; disabled?: boolean; showStage?: boolean;
  /** Rendered at the end of the row, e.g. an owner badge. */
  aside?: React.ReactNode;
}) {
  const done = !!task.doneAt;
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={done}
        aria-label={`${task.label}: ${done ? 'done' : 'not done'}`}
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
          done ? 'border-navy bg-navy text-white' : 'border-gray-300 bg-white hover:border-navy'
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {done && <Check size={13} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${done ? 'text-gray-400 line-through decoration-gray-300' : 'text-navy'}`}>
          {task.label}
          {task.critical && !done && <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-red-700"><Lock size={9} /> Required</span>}
          {task.kind === 'training' && <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-blue-700">Role training</span>}
        </p>
        <p className="text-[11px] text-gray-400">
          {showStage && <>{task.stage}</>}
          {done && <>{showStage ? ' · ' : ''}{task.doneBy} · {task.doneAt?.split(' ')[0]} {timeOf(task.doneAt)}</>}
        </p>
      </div>
      {aside && <span className="flex-shrink-0 pt-0.5">{aside}</span>}
    </li>
  );
}

/** Tasks grouped by who owns them — the delegated task matrix. */
export function OwnerMatrix({ tasks, owners, onToggle, canTick }: {
  tasks: CaseTask[];
  owners: CaseOwner[];
  onToggle: (task: CaseTask) => void;
  canTick: (task: CaseTask) => boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {owners.map((owner) => {
        const list = tasks.filter((t) => t.owner === owner);
        if (list.length === 0) return null;
        const done = list.filter((t) => t.doneAt).length;
        return (
          <div key={owner} className="rounded-lg border border-grey-border">
            <div className="flex items-center justify-between border-b border-grey-border px-4 py-2.5">
              <OwnerBadge owner={owner} />
              <span className={`text-xs tabular-nums ${done === list.length ? 'text-emerald-700' : 'text-gray-500'}`}>{done}/{list.length}</span>
            </div>
            <ul className="divide-y divide-grey-border/70">
              {list.map((t) => <TaskLine key={t.id} task={t} onToggle={() => onToggle(t)} disabled={!canTick(t)} showStage />)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
