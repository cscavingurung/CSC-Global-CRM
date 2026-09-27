import { useCallback, useState } from 'react';
import { MemoryRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation, useOutletContext } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCircle, CheckCircle2, ChevronDown, ClipboardList, Clock, Inbox, Paperclip, RotateCcw, Send } from 'lucide-react';
import { CounselorRequest } from '../../counselorMarketing';
import { DeliveredFile } from '../../types';
import { UploadZone, BriefBlock } from '../designer/DesignerShared';
import { Modal, Pill, PrimaryButton, GhostButton } from '../marketing/MktShared';
import { deadlineText, deadlineTone } from '../marketing/mktUtils';
import { whenLabel } from '../../marketingDept';

// ─── Branch staff · Marketing collaboration ─────────────────────────────────
// An inbox for content requests from the Marketing Department's Content Planner — sent to a
// counselor or Front Desk Officer directly, or delegated to them by their Branch Manager. Two
// nested routes — Pending (the inbox) and Completed (history) — inside one layout whose toggle is
// a pair of NavLinks. The router is a MemoryRouter scoped to this tab, like the other routed
// modules in the CRM. The two roles share the flow and differ only in wording (VARIANTS).
//
// ROLE BOUNDARY: branch staff only fulfil requests. This tab receives CounselorRequest[] (see
// counselorMarketing.ts) — never marketing analytics, ad budgets or content schedules, and for
// the Front Desk nothing from their restricted financial records.

export type InboxVariant = 'counselor' | 'frontDesk';

const VARIANTS: Record<InboxVariant, {
  base: string; intro: string; pending: string; pendingTab: string; completedTab: string; submit: string; notes: string;
  notesPlaceholder: string; upload: 'material' | 'media'; accept: string; footer: string;
}> = {
  counselor: {
    base: '/counselor/marketing',
    intro: 'Content the Marketing team has asked you to record — videos, photos or testimonials.',
    pending: 'Action Required', pendingTab: 'Pending Requests', completedTab: 'Completed Requests',
    submit: 'Submit to Marketing', notes: 'Notes / caption',
    notesPlaceholder: 'e.g. Take 2 is the best one. Client consent form is in the folder.',
    upload: 'material', accept: 'video/*,image/*,application/pdf,.doc,.docx',
    footer: 'Submitted content goes straight to the Content Planner who asked for it.',
  },
  frontDesk: {
    base: '/front-desk/marketing',
    intro: 'Photos and short videos Marketing needs from reception — visa grant moments, client quotes, branch shots.',
    pending: 'Pending Collection', pendingTab: 'Pending Requests', completedTab: 'Completed Requests',
    submit: 'Upload & Send to Marketing', notes: 'Caption Notes / Client Quote',
    notesPlaceholder: 'e.g. “CSC made the whole visa process stress-free!” — client agreed to be tagged.',
    upload: 'media', accept: 'image/*,video/*',
    footer: 'Uploads go straight to the Marketing team member who asked for them.',
  },
};

interface Ctx {
  me: string;
  requests: CounselorRequest[];
  onSubmit: (id: string, files: DeliveredFile[], note: string) => void;
  flash: (m: string) => void;
  variant: InboxVariant;
}

/** "Priya Karki (Marketing Manager)", plus the Branch Manager when they delegated it. */
function RequestedBy({ req }: { req: CounselorRequest }) {
  return (
    <>
      {req.requestedBy} <span className="text-gray-400">· {req.requestedByRole}</span>
      {req.delegatedBy && <span className="block text-[11px] text-gray-500">Delegated by {req.delegatedBy} (Branch Manager)</span>}
    </>
  );
}
const useCtx = () => useOutletContext<Ctx>();

// ── Submit content ──────────────────────────────────────────────────────────
function SubmitPanel({ req, onClose }: { req: CounselorRequest; onClose: () => void }) {
  const { me, onSubmit, flash, variant } = useCtx();
  const v = VARIANTS[variant];
  const [files, setFiles] = useState<DeliveredFile[]>([]);
  const [note, setNote] = useState('');
  return (
    <Modal title={req.topic} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Pill text={v.pending} cls="bg-amber-100 text-amber-800" />
          <span className="rounded bg-grey-bg px-2 py-0.5 font-medium text-navy">{req.needed}</span>
          <span className={deadlineTone(req.deadline)}>{deadlineText(req.deadline)}</span>
          <span className="text-gray-400">· from {req.requestedBy} ({req.requestedByRole}){req.delegatedBy ? `, delegated by ${req.delegatedBy}` : ''}</span>
        </div>
        {req.redoReason && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><RotateCcw size={14} className="mt-0.5 shrink-0" /> Please redo: “{req.redoReason}”</p>
        )}
        <BriefBlock title={variant === 'frontDesk' ? 'Instructions from Marketing' : 'Brief / instructions'}>
          <p className="whitespace-pre-line rounded-lg border border-grey-border bg-grey-bg/50 p-3 text-sm text-gray-700">
            {req.brief || `Please record: ${req.needed} about “${req.topic}”.`}
          </p>
        </BriefBlock>
        <BriefBlock title="Your content">
          <UploadZone files={files} onChange={setFiles} me={me} kind={v.upload} accept={v.accept} />
        </BriefBlock>
        <BriefBlock title={v.notes}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            placeholder={v.notesPlaceholder}
            className="w-full resize-y rounded-lg border border-grey-border px-3 py-2.5 text-sm text-navy focus:border-navy-light focus:outline-none focus:ring-1 focus:ring-navy-light" />
        </BriefBlock>
        <div className="flex flex-col-reverse gap-2 border-t border-grey-border pt-4 sm:flex-row sm:items-center sm:justify-end">
          {!files.length && <p className="text-xs text-gray-400 sm:mr-auto">Add at least one file or link to submit.</p>}
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton disabled={!files.length} onClick={() => { onSubmit(req.id, files, note.trim()); flash(`Sent to Marketing — ${req.requestedBy.split(' ')[0]} has been notified.`); onClose(); }}>
            <Send size={14} /> {v.submit}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Pending (the inbox) ─────────────────────────────────────────────────────
function PendingRequests() {
  const { requests, variant } = useCtx();
  const v = VARIANTS[variant];
  const [open, setOpen] = useState<string | null>(null);
  const pending = requests.filter((r) => r.status === 'Pending').sort((a, b) => a.deadline.localeCompare(b.deadline));
  const req = pending.find((r) => r.id === open);
  if (pending.length === 0) {
    return <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-grey-border bg-white px-4 py-12 text-sm text-emerald-700"><CheckCircle2 size={16} /> No requests waiting — you're all caught up.</p>;
  }
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {pending.map((r) => (
          <button key={r.id} type="button" onClick={() => setOpen(r.id)} className="dissolve-in flex flex-col rounded-xl border border-grey-border bg-white p-4 text-left transition-colors hover:border-navy-light">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold leading-snug text-navy">{r.topic}</p>
              <Pill text={v.pending} cls="shrink-0 bg-amber-100 text-amber-800" />
            </div>
            <dl className="mt-3 flex-1 space-y-1.5 text-xs">
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-gray-400">Requested by</dt><dd className="text-navy"><RequestedBy req={r} /></dd></div>
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-gray-400">Format</dt><dd className="font-medium text-navy">{r.needed}</dd></div>
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-gray-400">Deadline</dt><dd className={deadlineTone(r.deadline)}>{deadlineText(r.deadline)}</dd></div>
              {r.brief && <div className="flex gap-2"><dt className="w-24 shrink-0 text-gray-400">Instructions</dt><dd className="line-clamp-2 text-gray-600">{r.brief}</dd></div>}
            </dl>
            {(r.redoReason || r.reminders > 0) && (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-700">
                {r.redoReason ? <><RotateCcw size={11} /> Asked to redo</> : <><Bell size={11} /> Reminded {r.reminders}×</>}
              </p>
            )}
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-navy">Open & submit <Send size={11} /></span>
          </button>
        ))}
      </div>
      {req && <SubmitPanel req={req} onClose={() => setOpen(null)} />}
    </>
  );
}

// ── Completed (history) ─────────────────────────────────────────────────────
function CompletedRequests() {
  const { requests } = useCtx();
  const [expanded, setExpanded] = useState<string | null>(null);
  const done = requests.filter((r) => r.status === 'Submitted')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  if (done.length === 0) return <p className="rounded-xl border border-dashed border-grey-border bg-white px-4 py-12 text-center text-sm text-gray-400">Nothing submitted yet.</p>;
  return (
    <ul className="divide-y divide-grey-border overflow-hidden rounded-xl border border-grey-border bg-white">
      {done.map((r) => {
        const isOpen = expanded === r.id;
        return (
          <li key={r.id}>
            <button type="button" onClick={() => setExpanded(isOpen ? null : r.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-grey-bg/60">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-navy">{r.topic}</p>
                <p className="text-xs text-gray-400">{r.needed} · for {r.requestedBy}</p>
              </div>
              <span className="shrink-0 text-xs text-gray-500">{r.submittedAt ?? '—'}</span>
              <Pill text="Submitted" cls="bg-emerald-100 text-emerald-800" />
              <ChevronDown size={15} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="dissolve-in space-y-2 border-t border-grey-border bg-grey-bg/40 px-5 py-3 text-sm">
                <p className="text-xs text-gray-500">Submitted {r.submittedAt ? whenLabel(r.submittedAt) : ''}</p>
                {r.submittedFiles?.length ? (
                  <ul className="space-y-1">{r.submittedFiles.map((f) => (
                    <li key={f.id} className="flex items-center gap-1.5 text-navy"><Paperclip size={12} className="text-gray-400" />
                      {f.url && /^https?:/.test(f.url) ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-navy-light">{f.name}</a> : <span className="truncate">{f.name}</span>}
                    </li>
                  ))}</ul>
                ) : <p className="text-xs text-gray-400">Delivered outside the CRM (marked received by Marketing).</p>}
                {r.submittedNote && <p className="text-gray-600">“{r.submittedNote}”</p>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────
function MarketingLayout({ me, requests, onSubmit, variant }: Omit<Ctx, 'flash'>) {
  const v = VARIANTS[variant];
  const location = useLocation();
  const [toast, setToast] = useState('');
  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(''), 3200); }, []);
  const pending = requests.filter((r) => r.status === 'Pending');
  const overdue = pending.filter((r) => deadlineTone(r.deadline).includes('red')).length;
  const tab = (to: string, icon: React.ReactNode, label: string, n: number) => (
    <NavLink to={`${v.base}/${to}`} className={({ isActive }) => `inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}>
      {icon} {label} <span className="rounded-full bg-white/20 px-1.5 text-[11px] tabular-nums">{n}</span>
    </NavLink>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">{v.intro}</p>
        <div className="inline-flex shrink-0 rounded-lg border border-grey-border bg-white p-0.5">
          {tab('pending', <Inbox size={14} />, v.pendingTab, pending.length)}
          {tab('completed', <ClipboardList size={14} />, v.completedTab, requests.length - pending.length)}
        </div>
      </div>
      {overdue > 0 && location.pathname.endsWith('/pending') && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle size={15} /> {overdue} request{overdue === 1 ? ' is' : 's are'} past the deadline.</p>
      )}
      <div key={location.pathname} className="dissolve-in">
        <Outlet context={{ me, requests, onSubmit, flash, variant } satisfies Ctx} />
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-gray-400"><Clock size={11} /> {v.footer}</p>
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white animate-fade-in">
          <CheckCircle size={18} className="flex-shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
}

export default function CounselorMarketing({ me, requests, onSubmit, variant = 'counselor' }: Omit<Ctx, 'flash' | 'variant'> & { variant?: InboxVariant }) {
  const BASE = VARIANTS[variant].base;
  return (
    <MemoryRouter initialEntries={[`${BASE}/pending`]}>
      <Routes>
        <Route path={BASE} element={<MarketingLayout me={me} requests={requests} onSubmit={onSubmit} variant={variant} />}>
          <Route index element={<Navigate to="pending" replace />} />
          <Route path="pending" element={<PendingRequests />} />
          <Route path="completed" element={<CompletedRequests />} />
        </Route>
        <Route path="*" element={<Navigate to={`${BASE}/pending`} replace />} />
      </Routes>
    </MemoryRouter>
  );
}
