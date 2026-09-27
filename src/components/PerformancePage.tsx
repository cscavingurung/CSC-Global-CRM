import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ClipboardCheck, Database, FileText, Plus, Search, UserCheck, X } from 'lucide-react';
import { MockUser, OnboardingCase, PerformanceReview, ReviewAssessment, StaffMember } from '../types';
import {
  ASSESSMENTS, ASSESSMENT_STYLES, CrmSources, attentionReasons, halfYearLabel, metricsFor, reviewStatus,
} from '../performance';
import { dateKey, formatActivityTime, formatSubmittedAt, parseSubmittedAt } from '../dateTime';

// ─── HRM · Performance ──────────────────────────────────────────────────────
// One page: branch overview cards, an employee list, and for the selected employee their
// CRM numbers (read-only, computed from existing records) plus written reviews. No scores,
// ratings, rankings or automated judgements — the manager writes, the CRM counts.

interface PerformancePageProps {
  currentUser: MockUser;
  /** Branch staff. */
  staff: StaffMember[];
  sources: CrmSources;
  reviews: PerformanceReview[];
  onboarding: OnboardingCase[];
  onSaveReview: (r: PerformanceReview) => void;
}

const inputClass =
  'w-full border border-grey-border rounded-lg px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';

const when = (stamp?: string) => {
  const d = stamp ? parseSubmittedAt(stamp) : null;
  return d ? formatActivityTime(d, false) : '';
};

const REVIEWED_ROLES = ['Counselor', 'V/A Officer', 'Front Desk Officer'];

interface Draft {
  period: string;
  overall: string;
  strengths: string;
  improvements: string;
  goals: string;
  assessment: ReviewAssessment | '';
  acknowledged: boolean;
}

export default function PerformancePage({ currentUser, staff, sources, reviews, onboarding, onSaveReview }: PerformancePageProps) {
  const today = dateKey(new Date());
  const year = today.slice(0, 4);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  // Everyone the Branch Manager reviews, with their CRM numbers and review state.
  const people = useMemo(() => staff
    .filter((s) => s.status === 'Active' && REVIEWED_ROLES.includes(s.role))
    .map((member) => {
      const metrics = metricsFor(member.name, member.role, sources, today);
      const rs = reviewStatus(member.name, reviews, onboarding, today);
      return { member, metrics, ...rs, attention: attentionReasons(metrics, rs.last) };
    })
    .sort((a, b) => Number(a.status === 'Up to Date') - Number(b.status === 'Up to Date') || a.member.name.localeCompare(b.member.name)),
  [staff, sources, reviews, onboarding, today]);

  const [selectedName, setSelectedName] = useState<string>(people[0]?.member.name ?? '');
  const selected = people.find((p) => p.member.name === selectedName) ?? people[0];
  const history = selected
    ? reviews.filter((r) => r.staffName === selected.member.name).sort((a, b) => (parseSubmittedAt(b.reviewedAt)?.getTime() ?? 0) - (parseSubmittedAt(a.reviewedAt)?.getTime() ?? 0))
    : [];

  const names = new Set(people.map((p) => p.member.name));
  const branchReviews = reviews.filter((r) => names.has(r.staffName));
  const cards = [
    { label: 'Employees Due for Review', value: people.filter((p) => p.status === 'Due').length, tone: 'text-amber-600', icon: <ClipboardCheck size={14} /> },
    { label: 'Reviews Completed', value: branchReviews.filter((r) => r.reviewedAt.startsWith(year)).length, tone: 'text-emerald-600', icon: <CheckCircle size={14} />, hint: `in ${year}` },
    { label: 'Reviews Pending', value: branchReviews.filter((r) => !r.acknowledged).length, tone: 'text-blue-600', icon: <UserCheck size={14} />, hint: 'awaiting acknowledgement' },
    { label: 'Employees Needing Attention', value: people.filter((p) => p.attention.length > 0).length, tone: 'text-red-600', icon: <AlertTriangle size={14} /> },
  ];

  // ── New review ──
  const blank = (): Draft => ({ period: halfYearLabel(new Date()), overall: '', strengths: '', improvements: '', goals: '', assessment: '', acknowledged: false });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tried, setTried] = useState(false);
  const missing = draft && (!draft.period.trim() ? 'Add the review period.' : !draft.overall.trim() ? 'Add overall comments.' : !draft.assessment ? 'Choose the manager’s assessment.' : null);
  const save = () => {
    setTried(true);
    if (!draft || missing || !selected || !draft.assessment) return;
    const at = formatSubmittedAt(new Date());
    onSaveReview({
      id: `rev-${Date.now()}`, staffName: selected.member.name, branch: currentUser.branch, period: draft.period.trim(),
      overall: draft.overall.trim(), strengths: draft.strengths.trim(), improvements: draft.improvements.trim(), goals: draft.goals.trim(),
      assessment: draft.assessment, acknowledged: draft.acknowledged, acknowledgedAt: draft.acknowledged ? at : undefined,
      reviewedBy: currentUser.name, reviewedAt: at,
    });
    setDraft(null);
    setTried(false);
    setToast(`Review saved for ${selected.member.name}${draft.acknowledged ? '' : ' — awaiting their acknowledgement'}.`);
    window.setTimeout(() => setToast(''), 3500);
  };
  const acknowledge = (r: PerformanceReview) => onSaveReview({ ...r, acknowledged: true, acknowledgedAt: formatSubmittedAt(new Date()) });

  const visible = people.filter((p) => !search.trim() || `${p.member.name} ${p.member.role}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-5">
      {/* 1 — Branch overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-grey-border bg-white px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">{c.icon}{c.label}</p>
            <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${c.value === 0 ? 'text-gray-300' : c.tone}`}>{c.value}</p>
            {c.hint && <p className="text-[11px] text-gray-400">{c.hint}</p>}
          </div>
        ))}
      </div>

      {/* 2 — Split layout */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* 3 — Employee list */}
        <section className="rounded-xl border border-grey-border bg-white lg:sticky lg:top-4">
          <div className="border-b border-grey-border p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees" className="w-full rounded-lg border border-grey-border py-2 pl-9 pr-3 text-sm focus:border-navy-light focus:outline-none" />
            </div>
          </div>
          <ul className="max-h-[60vh] divide-y divide-grey-border overflow-y-auto">
            {visible.map((p) => {
              const active = p.member.name === selected?.member.name;
              return (
                <li key={p.member.id}>
                  <button
                    type="button"
                    onClick={() => { setSelectedName(p.member.name); setDraft(null); }}
                    aria-current={active}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-navy/5' : 'hover:bg-grey-bg/60'}`}
                  >
                    <span className={`h-8 w-1 flex-shrink-0 rounded-full ${active ? 'bg-navy' : 'bg-transparent'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-navy">
                        {p.member.name}
                        {p.attention.length > 0 && <AlertTriangle size={12} className="text-red-500" aria-label="Needs attention" />}
                      </span>
                      <span className="block text-xs text-gray-500">{p.member.role}</span>
                    </span>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${p.status === 'Due' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{p.status}</span>
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-400">No employees found.</li>}
          </ul>
        </section>

        {/* 4 + 5 — Selected employee */}
        {selected && (
          <div key={selected.member.name} className="dissolve-in min-w-0 space-y-5">
            <section className="rounded-xl border border-grey-border bg-white">
              <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-navy">{selected.member.name}</h2>
                  <p className="text-sm text-gray-500">{selected.member.role} · {selected.member.branch} branch</p>
                  <p className="mt-1 text-xs text-gray-500">{selected.note}</p>
                </div>
                <span className={`self-start rounded-full px-2.5 py-1 text-xs font-medium ${selected.status === 'Due' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>Review {selected.status === 'Due' ? 'due' : 'up to date'}</span>
              </div>
              {selected.attention.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-grey-border bg-red-50/40 px-5 py-2.5">
                  <AlertTriangle size={14} className="text-red-600" />
                  <span className="text-xs font-semibold text-red-700">Needs attention:</span>
                  {selected.attention.map((a) => <span key={a} className="rounded-full bg-white px-2 py-0.5 text-xs text-red-700 ring-1 ring-red-200">{a}</span>)}
                </div>
              )}

              {/* Part A — CRM-driven metrics */}
              <div className="border-t border-grey-border px-5 py-4">
                <p className="mb-3 flex items-start gap-2 rounded-lg bg-grey-bg px-3 py-2 text-xs text-gray-600">
                  <Database size={14} className="mt-0.5 flex-shrink-0 text-navy-light" />
                  <span>These numbers are <b>read-only</b> and pulled automatically from the CRM — leads, applications, the Communication Log and the Daily Task Board. Nothing is entered twice. Hover a number to see where it comes from.</span>
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {selected.metrics.map((m) => (
                    <div key={m.label} title={m.source} className={`rounded-lg border px-3 py-2.5 ${m.warn ? 'border-amber-200 bg-amber-50/40' : 'border-grey-border'}`}>
                      <p className="text-[11px] text-gray-500">{m.label}</p>
                      <p className={`text-xl font-semibold tabular-nums ${m.warn ? 'text-amber-700' : 'text-navy'}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Part B — Reviews */}
            <section className="rounded-xl border border-grey-border bg-white">
              <div className="flex items-center justify-between border-b border-grey-border px-5 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-navy">Reviews</h3>
                  <p className="text-xs text-gray-500">{history.length} on record</p>
                </div>
                {!draft && (
                  <button type="button" onClick={() => { setDraft(blank()); setTried(false); }} className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-light">
                    <Plus size={15} /> Record New Review
                  </button>
                )}
              </div>

              {draft && (
                <div className="dissolve-in space-y-4 border-b border-grey-border bg-grey-bg/40 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-navy">New review</p>
                    <button type="button" onClick={() => setDraft(null)} aria-label="Cancel" className="text-gray-400 hover:text-navy"><X size={16} /></button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="rv-period" className="mb-1.5 block text-xs font-semibold text-navy">Review period</label>
                      <input id="rv-period" value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })} className={inputClass} placeholder="e.g. Jul – Dec 2026" />
                    </div>
                    <div>
                      <label htmlFor="rv-emp" className="mb-1.5 block text-xs font-semibold text-navy">Employee</label>
                      <input id="rv-emp" value={`${selected.member.name} · ${selected.member.role}`} readOnly className={`${inputClass} bg-grey-bg text-gray-600`} />
                    </div>
                  </div>
                  {([
                    ['overall', 'Overall comments', 'How the period went overall'],
                    ['strengths', 'Strengths', 'What they do well'],
                    ['improvements', 'Areas for improvement', 'What to work on'],
                    ['goals', 'Goals for next period', 'Clear, specific goals'],
                  ] as const).map(([key, label, hint]) => (
                    <div key={key}>
                      <label htmlFor={`rv-${key}`} className="mb-1.5 block text-xs font-semibold text-navy">{label}</label>
                      <textarea id={`rv-${key}`} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} rows={key === 'overall' ? 3 : 2} placeholder={hint} className={`${inputClass} resize-y`} />
                    </div>
                  ))}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                    <div>
                      <label htmlFor="rv-assess" className="mb-1.5 block text-xs font-semibold text-navy">Manager’s assessment</label>
                      <div className="relative">
                        <select id="rv-assess" value={draft.assessment} onChange={(e) => setDraft({ ...draft, assessment: e.target.value as ReviewAssessment })} className={`${inputClass} appearance-none pr-9`}>
                          <option value="" disabled>Choose…</option>
                          {ASSESSMENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-grey-border bg-white px-3 py-2.5">
                      <input type="checkbox" checked={draft.acknowledged} onChange={(e) => setDraft({ ...draft, acknowledged: e.target.checked })} className="mt-0.5 h-4 w-4 accent-navy" />
                      <span>
                        <span className="block text-sm text-navy">Employee acknowledgement</span>
                        <span className="block text-[11px] text-gray-400">{selected.member.name.split(' ')[0]} has seen and discussed this review</span>
                      </span>
                    </label>
                  </div>
                  {tried && missing && <p className="text-xs text-red-600">{missing}</p>}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-grey-border bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-grey-bg">Cancel</button>
                    <button type="button" onClick={save} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">Save Review</button>
                  </div>
                </div>
              )}

              {history.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">No reviews yet for {selected.member.name.split(' ')[0]}.</p>
              ) : (
                <ol className="divide-y divide-grey-border">
                  {history.map((r, i) => (
                    <ReviewItem key={r.id} review={r} defaultOpen={i === 0} onAcknowledge={() => acknowledge(r)} />
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
}

function ReviewItem({ review: r, defaultOpen, onAcknowledge }: { review: PerformanceReview; defaultOpen: boolean; onAcknowledge: () => void }) {
  const [open, setOpen] = useState(defaultOpen);
  const sections = [
    ['Overall comments', r.overall],
    ['Strengths', r.strengths],
    ['Areas for improvement', r.improvements],
    ['Goals for next period', r.goals],
  ].filter(([, v]) => v);
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-left hover:bg-grey-bg/40">
        <FileText size={15} className="text-gray-400" />
        <span className="text-sm font-semibold text-navy">{r.period}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ASSESSMENT_STYLES[r.assessment]}`}>{r.assessment}</span>
        <span className="text-xs text-gray-500">{when(r.reviewedAt)} · by {r.reviewedBy}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${r.acknowledged ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
          {r.acknowledged ? 'Acknowledged' : 'Awaiting acknowledgement'}
        </span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="dissolve-in space-y-3 px-5 pb-4 pl-12">
          {sections.map(([label, text]) => (
            <div key={label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
              <p className="whitespace-pre-line text-sm text-gray-700">{text}</p>
            </div>
          ))}
          {r.acknowledged ? (
            <p className="text-[11px] text-gray-400">Acknowledged by the employee {when(r.acknowledgedAt)}</p>
          ) : (
            <button type="button" onClick={onAcknowledge} className="rounded-lg border border-navy px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy hover:text-white">
              Record employee acknowledgement
            </button>
          )}
        </div>
      )}
    </li>
  );
}
