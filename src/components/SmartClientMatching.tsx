import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ApplicationRecord, CounselorStudent } from '../types';
import { COUNTRIES, INTAKE_MONTHS, generateIntakeYears, splitCountries } from '../mockData';
import { isVisaApproved, isVisaRefused } from '../clientPipeline';
import {
  BUDGET_RANGES, ENGLISH_TESTS, EnglishTest, Program, PROGRAMS, PROGRAM_FIELDS, QUALIFICATION_LEVELS,
} from '../programCatalog';

interface SmartClientMatchingProps {
  /** The counselor's own clients — used to prefill the criteria from a client profile. */
  clients: CounselorStudent[];
  /** Every CSC application across all branches — the source of the historical insights. */
  applications: ApplicationRecord[];
}

interface Criteria {
  qualification: string;
  gpa: string;
  englishTest: EnglishTest;
  englishScore: string;
  budget: string;
  country: string;
  field: string;
  intakeMonth: string;
  intakeYear: string;
}

const EMPTY: Criteria = {
  qualification: '', gpa: '', englishTest: 'IELTS', englishScore: '', budget: 'any',
  country: '', field: '', intakeMonth: '', intakeYear: '',
};

const fieldClass = 'w-full rounded-md border border-grey-border bg-white px-2.5 py-2 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light';
const labelClass = 'block text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-1';

type SortBy = 'fit' | 'approval' | 'tuition' | 'deadline';

// GPA input accepts a 4.0-scale GPA or a percentage (anything above 4 is treated as %).
function toGpa(value: string): number | null {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return null;
  return n > 4 ? Math.min(4, n / 25) : n;
}

// Client records store English as free text like "IELTS 6.5" or "PTE 65".
function parseEnglish(raw: string): { test: EnglishTest; score: string } | null {
  const match = raw.match(/(IELTS|PTE|TOEFL|Duolingo)\s*([\d.]+)/i);
  if (!match) return null;
  const test = ENGLISH_TESTS.find((t) => t.toLowerCase() === match[1].toLowerCase());
  return test ? { test, score: match[2] } : null;
}

const qualificationRank = (level: string) => QUALIFICATION_LEVELS.indexOf(level);

// Next start date for this program's intake — the target month/year when given, else the
// soonest upcoming intake — minus its deadline window.
function applicationDeadline(program: Program, month: string, year: string): { intake: string; deadline: Date } {
  const now = new Date();
  const candidates = (month && program.intakes.includes(month) ? [month] : program.intakes).flatMap((m) => {
    const mi = INTAKE_MONTHS.indexOf(m);
    const years = year ? [Number(year)] : [now.getFullYear(), now.getFullYear() + 1];
    return years.map((y) => new Date(y, mi, 1));
  });
  const upcoming = candidates.filter((d) => d > now).sort((a, b) => a.getTime() - b.getTime());
  const start = upcoming[0] ?? candidates[0];
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() - program.deadlineWeeks * 7);
  return { intake: `${INTAKE_MONTHS[start.getMonth()]} ${start.getFullYear()}`, deadline };
}

const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function approvalStyle(rate: number): string {
  if (rate >= 80) return 'bg-green-50 text-green-700';
  if (rate >= 60) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

const money = (n: number) => `$${n.toLocaleString()}`;

/** Met-criteria meter: one small segment per criterion entered. */
function FitMeter({ met, total }: { met: number; total: number }) {
  if (total === 0) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex gap-0.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-3 w-1.5 rounded-sm ${i < met ? (met === total ? 'bg-green-600' : 'bg-navy') : 'bg-gray-200'}`} />
        ))}
      </span>
      <span className="text-xs tabular-nums text-gray-600">{met}/{total}</span>
    </span>
  );
}

export default function SmartClientMatching({ clients, applications }: SmartClientMatchingProps) {
  const [criteria, setCriteria] = useState<Criteria>(EMPTY);
  const [clientId, setClientId] = useState('');
  const [fullOnly, setFullOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('fit');
  const [expanded, setExpanded] = useState<string | null>(null);
  const set = (patch: Partial<Criteria>) => setCriteria((prev) => ({ ...prev, ...patch }));

  const prefillFromClient = (id: string) => {
    setClientId(id);
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    // Highest qualification = the entry furthest up the ladder.
    const highest = [...client.academics].sort((a, b) => qualificationRank(b.level) - qualificationRank(a.level))[0];
    const english = parseEnglish(client.ieltsPte);
    setCriteria({
      ...EMPTY,
      qualification: highest && qualificationRank(highest.level) >= 0 ? highest.level : '',
      gpa: highest?.gpa ?? '',
      englishTest: english?.test ?? 'IELTS',
      englishScore: english?.score ?? '',
      country: splitCountries(client.country).find((c) => COUNTRIES.includes(c)) ?? '',
    });
  };

  // Historical insights per program: the catalog baseline plus every live CSC application
  // (all branches) that applied to the same institution and program.
  const insights = useMemo(() => {
    const map = new Map<string, { approved: number; refused: number; enrolled: number }>();
    PROGRAMS.forEach((p) => {
      const matching = applications.filter((a) =>
        a.offerApplications.some((o) => o.institution === p.institution && (!o.course || o.course === p.program))
      );
      map.set(p.id, {
        approved: p.history.approved + matching.filter(isVisaApproved).length,
        refused: p.history.refused + matching.filter(isVisaRefused).length,
        enrolled: p.history.enrolled + matching.length,
      });
    });
    return map;
  }, [applications]);

  const results = useMemo(() => {
    const gpa = toGpa(criteria.gpa);
    const score = parseFloat(criteria.englishScore);
    const budgetMax = BUDGET_RANGES.find((b) => b.key === criteria.budget)?.max ?? Infinity;

    return PROGRAMS
      // Country and field narrow the search; everything else is scored as met / not met.
      .filter((p) => !criteria.country || p.country === criteria.country)
      .filter((p) => !criteria.field || p.field === criteria.field)
      .map((p) => {
        const checks: { label: string; met: boolean }[] = [];
        if (criteria.qualification) {
          checks.push({ label: `Qualification: ${p.minQualification}+`, met: qualificationRank(criteria.qualification) >= qualificationRank(p.minQualification) });
        }
        if (gpa !== null) checks.push({ label: `GPA ${p.minGpa.toFixed(1)}+`, met: gpa >= p.minGpa });
        if (!Number.isNaN(score)) {
          const required = p.english[criteria.englishTest];
          checks.push({
            label: required === undefined ? `${criteria.englishTest} not accepted` : `${criteria.englishTest} ${required}+`,
            met: required !== undefined && score >= required,
          });
        }
        if (budgetMax !== Infinity) checks.push({ label: 'Within budget', met: p.tuitionUsd <= budgetMax });
        if (criteria.intakeMonth) checks.push({ label: `${criteria.intakeMonth} intake`, met: p.intakes.includes(criteria.intakeMonth) });

        const stats = insights.get(p.id)!;
        const decided = stats.approved + stats.refused;
        const approvalRate = decided > 0 ? Math.round((stats.approved / decided) * 100) : null;
        const { intake, deadline } = applicationDeadline(p, criteria.intakeMonth, criteria.intakeYear);
        return { program: p, checks, metCount: checks.filter((c) => c.met).length, stats, decided, approvalRate, intake, deadline };
      })
      .filter((r) => !fullOnly || r.metCount === r.checks.length)
      .sort((a, b) => {
        const fit = b.metCount / Math.max(1, b.checks.length) - a.metCount / Math.max(1, a.checks.length);
        const approval = (b.approvalRate ?? -1) - (a.approvalRate ?? -1);
        if (sortBy === 'approval') return approval || fit;
        if (sortBy === 'tuition') return a.program.tuitionUsd - b.program.tuitionUsd || fit;
        if (sortBy === 'deadline') return a.deadline.getTime() - b.deadline.getTime() || fit;
        return fit || approval;
      });
  }, [criteria, fullOnly, insights, sortBy]);

  const intakeYears = generateIntakeYears(3);

  const SortHeader = ({ label, value, align = 'left' }: { label: string; value: SortBy; align?: 'left' | 'right' }) => (
    <th className={`px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button type="button" onClick={() => setSortBy(value)} className={`inline-flex items-center gap-1 hover:text-navy ${sortBy === value ? 'text-navy' : ''}`}>
        {label}{sortBy === value && <ChevronDown size={12} />}
      </button>
    </th>
  );
  const PlainHeader = ({ label, align = 'left' }: { label: string; align?: 'left' | 'right' }) => (
    <th className={`px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 ${align === 'right' ? 'text-right' : 'text-left'}`}>{label}</th>
  );

  const Details = ({ r }: { r: (typeof results)[number] }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
      <div>
        <p className={labelClass}>Admission requirements</p>
        <p className="text-navy">{r.program.admission}</p>
        <p className="text-gray-500 mt-1">Minimum {r.program.minQualification} · GPA {r.program.minGpa.toFixed(1)}</p>
        <p className="text-gray-500">{r.program.duration} · intakes {r.program.intakes.join(', ')}</p>
      </div>
      <div>
        <p className={labelClass}>English requirements</p>
        <table className="text-sm">
          <tbody>
            {ENGLISH_TESTS.map((t) => (
              <tr key={t}>
                <td className="pr-4 py-0.5 text-gray-500">{t}</td>
                <td className="py-0.5 tabular-nums text-navy">{r.program.english[t] ?? <span className="text-gray-400">Not accepted</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-gray-500 mt-2">Apply by <span className="text-navy font-medium">{formatDate(r.deadline)}</span> for {r.intake}</p>
      </div>
      <div>
        <p className={labelClass}>Client vs requirements</p>
        {r.checks.length === 0 ? (
          <p className="text-gray-400">Enter the client’s details above to compare.</p>
        ) : (
          <ul className="space-y-1">
            {r.checks.map((c) => (
              <li key={c.label} className={c.met ? 'text-green-700' : 'text-amber-700'}>
                <span className="inline-block w-4">{c.met ? '✓' : '✗'}</span>{c.label}
              </li>
            ))}
          </ul>
        )}
        <p className="text-gray-500 mt-2">
          CSC history: {r.stats.approved} approved, {r.stats.refused} refused, {r.stats.enrolled} enrolled
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Criteria bar */}
      <div className="bg-white border border-grey-border rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-grey-border">
          <h2 className="text-sm font-semibold text-navy">Client criteria</h2>
          <div className="flex items-center gap-3">
            <select value={clientId} onChange={(e) => prefillFromClient(e.target.value)} className={`${fieldClass} w-auto`} aria-label="Fill from client">
              <option value="">Fill from a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => { setCriteria(EMPTY); setClientId(''); }} className="text-sm text-navy-light hover:text-navy whitespace-nowrap">
              Reset
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-x-3 gap-y-3 px-4 py-3">
          <div className="col-span-2 md:col-span-1 xl:col-span-1">
            <label className={labelClass}>Qualification</label>
            <select value={criteria.qualification} onChange={(e) => set({ qualification: e.target.value })} className={fieldClass}>
              <option value="">Any</option>
              {QUALIFICATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>GPA / %</label>
            <input value={criteria.gpa} onChange={(e) => set({ gpa: e.target.value })} inputMode="decimal" placeholder="e.g. 3.2" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>English test</label>
            <select value={criteria.englishTest} onChange={(e) => set({ englishTest: e.target.value as EnglishTest })} className={fieldClass}>
              {ENGLISH_TESTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Overall score</label>
            <input value={criteria.englishScore} onChange={(e) => set({ englishScore: e.target.value })} inputMode="decimal" placeholder="e.g. 6.5" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Budget / year</label>
            <select value={criteria.budget} onChange={(e) => set({ budget: e.target.value })} className={fieldClass}>
              {BUDGET_RANGES.map((b) => <option key={b.key} value={b.key}>{b.key === 'any' ? 'Any' : `≤ ${money(b.max)}`}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <select value={criteria.country} onChange={(e) => set({ country: e.target.value })} className={fieldClass}>
              <option value="">Any</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Field of study</label>
            <select value={criteria.field} onChange={(e) => set({ field: e.target.value })} className={fieldClass}>
              <option value="">Any</option>
              {PROGRAM_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Intake</label>
            <div className="flex gap-1.5">
              <select value={criteria.intakeMonth} onChange={(e) => set({ intakeMonth: e.target.value })} className={fieldClass} aria-label="Intake month">
                <option value="">Month</option>
                {INTAKE_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={criteria.intakeYear} onChange={(e) => set({ intakeYear: e.target.value })} className={fieldClass} aria-label="Intake year">
                <option value="">Year</option>
                {intakeYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="border-l-2 border-navy bg-white border-y border-r border-y-grey-border border-r-grey-border rounded-r-md px-4 py-3 text-sm text-navy">
        <span className="font-semibold">Note:</span> These matches are based on historical data and stated requirements. This information is for guidance only and does not guarantee admission or visa approval.
      </p>

      {/* Results */}
      <div className="bg-white border border-grey-border rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-grey-border">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-navy tabular-nums">{results.length}</span> program{results.length === 1 ? '' : 's'} · sorted by{' '}
            {{ fit: 'fit', approval: 'visa approval', tuition: 'tuition', deadline: 'deadline' }[sortBy]}
          </p>
          <label className="inline-flex items-center gap-2 text-sm text-navy cursor-pointer">
            <input type="checkbox" checked={fullOnly} onChange={(e) => setFullOnly(e.target.checked)} className="accent-navy" />
            Meets every criterion
          </label>
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-gray-500">No programs match. Try a wider country, field or budget.</p>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden lg:table w-full">
              <thead className="bg-grey-bg border-b border-grey-border">
                <tr>
                  <PlainHeader label="Institution / Program" />
                  <PlainHeader label="Location" />
                  <SortHeader label="Tuition / yr" value="tuition" align="right" />
                  <SortHeader label="Next intake · deadline" value="deadline" />
                  <SortHeader label="Fit" value="fit" />
                  <SortHeader label="Visa approval" value="approval" />
                  <PlainHeader label="Enrolled" align="right" />
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const open = expanded === r.program.id;
                  return (
                    <Fragment key={r.program.id}>
                      <tr
                        onClick={() => setExpanded(open ? null : r.program.id)}
                        className={`border-b border-grey-border cursor-pointer hover:bg-grey-bg ${open ? 'bg-grey-bg' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <p className="text-sm font-medium text-navy">{r.program.program}</p>
                          <p className="text-xs text-gray-500">{r.program.institution} · {r.program.level} · {r.program.duration}</p>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600">{r.program.city}<span className="block text-xs text-gray-400">{r.program.country}</span></td>
                        <td className="px-3 py-3 text-sm text-navy text-right tabular-nums">{money(r.program.tuitionUsd)}</td>
                        <td className="px-3 py-3 text-sm text-navy tabular-nums">{r.intake}<span className="block text-xs text-gray-400">apply by {formatDate(r.deadline)}</span></td>
                        <td className="px-3 py-3"><FitMeter met={r.metCount} total={r.checks.length} /></td>
                        <td className="px-3 py-3">
                          {r.approvalRate === null ? (
                            <span className="text-xs text-gray-400">No data</span>
                          ) : (
                            <>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${approvalStyle(r.approvalRate)}`}>{r.approvalRate}%</span>
                              <span className="block text-[11px] text-gray-400 mt-0.5">{r.decided} decisions</span>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-navy text-right tabular-nums">{r.stats.enrolled}</td>
                        <td className="px-2 py-3 text-gray-400">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                      </tr>
                      {open && (
                        <tr className="border-b border-grey-border bg-grey-bg/60">
                          <td colSpan={8} className="px-4 py-4"><Details r={r} /></td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile list */}
            <div className="lg:hidden divide-y divide-grey-border">
              {results.map((r) => {
                const open = expanded === r.program.id;
                return (
                  <div key={r.program.id}>
                    <button type="button" onClick={() => setExpanded(open ? null : r.program.id)} className="w-full text-left px-4 py-3 hover:bg-grey-bg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy">{r.program.program}</p>
                          <p className="text-xs text-gray-500">{r.program.institution} · {r.program.city}, {r.program.country}</p>
                        </div>
                        {r.approvalRate !== null && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums flex-shrink-0 ${approvalStyle(r.approvalRate)}`}>{r.approvalRate}%</span>
                        )}
                      </div>
                      <dl className="grid grid-cols-3 gap-2 mt-2 text-xs">
                        <div><dt className="text-gray-400">Tuition</dt><dd className="text-navy tabular-nums">{money(r.program.tuitionUsd)}</dd></div>
                        <div><dt className="text-gray-400">Intake</dt><dd className="text-navy">{r.intake}</dd></div>
                        <div><dt className="text-gray-400">Fit</dt><dd><FitMeter met={r.metCount} total={r.checks.length} /></dd></div>
                      </dl>
                    </button>
                    {open && <div className="px-4 pb-4 bg-grey-bg/60 pt-3"><Details r={r} /></div>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
