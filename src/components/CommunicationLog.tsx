import { useMemo, useState } from 'react';
import {
  ChevronRight, Phone, MessageCircle, Mail, MessageSquareText, Users, Video, Plus,
  ArrowUpRight, ArrowDownLeft, CalendarClock, type LucideIcon,
} from 'lucide-react';
import { CommunicationChannel, CommunicationDirection, CommunicationEntry } from '../types';
import { useCommunications } from '../communications';
import { useCurrentUser } from '../currentUser';
import { ROLE_LABELS } from '../mockData';
import { dateKey, formatActivityTime } from '../dateTime';

interface CommunicationLogProps {
  /** Client ID (clientIdFor) — the same key on the counselor record and the application. */
  clientKey: string;
  clientName: string;
}

const CHANNELS: { value: CommunicationChannel; icon: LucideIcon; tone: string }[] = [
  { value: 'Phone call', icon: Phone, tone: 'bg-blue-50 text-blue-700' },
  { value: 'WhatsApp', icon: MessageCircle, tone: 'bg-green-50 text-green-700' },
  { value: 'Email', icon: Mail, tone: 'bg-navy/10 text-navy' },
  { value: 'SMS', icon: MessageSquareText, tone: 'bg-teal-50 text-teal-700' },
  { value: 'In-person', icon: Users, tone: 'bg-amber-50 text-amber-700' },
  { value: 'Video consultation', icon: Video, tone: 'bg-purple-50 text-purple-700' },
];
const CHANNEL_META = Object.fromEntries(CHANNELS.map((c) => [c.value, c])) as Record<CommunicationChannel, (typeof CHANNELS)[number]>;

const OUTCOMES = [
  'Reached — conversation held',
  'No answer',
  'Left message / voicemail',
  'Interested — moving forward',
  'Needs time to decide',
  'Documents requested',
  'Documents received',
  'Not interested',
  'Other',
];

const inputClass = 'w-full border border-grey-border rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light';
const labelClass = 'block text-xs font-medium text-gray-500 mb-1';

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
function localDateTimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextActionTiming(date: string): { text: string; tone: string } {
  const today = dateKey(new Date());
  if (date < today) return { text: 'Overdue', tone: 'bg-red-50 text-red-700' };
  if (date === today) return { text: 'Today', tone: 'bg-amber-50 text-amber-700' };
  return {
    text: new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    tone: 'bg-blue-50 text-blue-700',
  };
}

const emptyForm = () => ({
  channel: 'Phone call' as CommunicationChannel,
  direction: 'Outbound' as CommunicationDirection,
  occurredAt: localDateTimeValue(new Date()),
  summary: '',
  outcome: OUTCOMES[0],
  nextAction: '',
  nextActionDate: '',
});

/**
 * Communication Log for one client: a compact clickable item (placed in the profile's details,
 * next to Consultation Notes) that slides out a panel listing every interaction, newest first,
 * with a form to log a new one.
 */
export default function CommunicationLog({ clientKey, clientName }: CommunicationLogProps) {
  const { entries, addEntry } = useCommunications();
  const currentUser = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<CommunicationChannel | 'all'>('all');
  const [form, setForm] = useState(emptyForm);

  const clientEntries = useMemo(
    () => entries.filter((e) => e.clientKey === clientKey).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [entries, clientKey]
  );
  const visible = filter === 'all' ? clientEntries : clientEntries.filter((e) => e.channel === filter);
  // The next thing someone promised to do — the most useful line when opening the log.
  const upcoming = clientEntries
    .filter((e) => e.nextAction && e.nextActionDate)
    .sort((a, b) => (a.nextActionDate as string).localeCompare(b.nextActionDate as string))
    .find((e) => (e.nextActionDate as string) >= dateKey(new Date())) ?? null;

  const latest = clientEntries[0] ?? null;
  const canSave = !!form.summary.trim() && !!form.occurredAt && !!currentUser;

  const save = () => {
    if (!canSave || !currentUser) return;
    addEntry({
      id: `cl${Date.now()}`,
      clientKey,
      clientName,
      channel: form.channel,
      direction: form.direction,
      occurredAt: new Date(form.occurredAt).toISOString(),
      summary: form.summary.trim(),
      outcome: form.outcome,
      nextAction: form.nextAction.trim() || undefined,
      nextActionDate: form.nextAction.trim() && form.nextActionDate ? form.nextActionDate : undefined,
      loggedBy: currentUser.name,
      loggedByRole: currentUser.role,
      createdAt: new Date().toISOString(),
    });
    setForm(emptyForm());
    setShowForm(false);
    setFilter('all');
  };

  return (
    <>
      {/* Compact trigger — styled like a profile detail item so it sits inline in a details row */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open communication log"
        className="group flex items-center gap-3 rounded-lg border border-grey-border bg-white px-3 py-2 text-left transition-colors hover:border-navy-light hover:bg-grey-bg"
      >
        <span className="w-8 h-8 rounded-lg bg-grey-bg flex items-center justify-center flex-shrink-0 group-hover:bg-white">
          <MessageSquareText className="text-navy" size={15} />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-gray-400">Communication Log</span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-navy whitespace-nowrap">
            {clientEntries.length} interaction{clientEntries.length === 1 ? '' : 's'}
            {latest && <span className="text-xs font-normal text-gray-400">· {formatActivityTime(new Date(latest.occurredAt), false)}</span>}
            {upcoming && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${nextActionTiming(upcoming.nextActionDate as string).tone}`}>
                Next {nextActionTiming(upcoming.nextActionDate as string).text}
              </span>
            )}
          </span>
        </span>
        <ChevronRight size={16} className="ml-1 text-gray-300 flex-shrink-0 transition-colors group-hover:text-navy" />
      </button>

      {/* Panel */}
      {open && (
        <>
          <button type="button" aria-label="Close communication log" className="fixed inset-0 z-[55] bg-navy-dark/20 lg:bg-transparent cursor-default" onClick={() => setOpen(false)} />
          <aside className="dissolve-in fixed inset-y-0 right-0 z-[56] w-full sm:w-[440px] bg-white border-l border-grey-border flex flex-col">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-grey-border">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-8 h-8 rounded-lg border border-grey-border flex items-center justify-center text-navy hover:bg-grey-bg">
                <ChevronRight size={16} />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-navy">Communication Log</h2>
                <p className="text-xs text-gray-400 truncate">{clientName} · {clientEntries.length} interaction{clientEntries.length === 1 ? '' : 's'}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy-light"
              >
                <Plus size={14} className={`transition-transform duration-300 ${showForm ? 'rotate-45' : ''}`} />{showForm ? 'Cancel' : 'Log'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Log form — stays mounted and expands its height (0fr → 1fr), so everything below
                  slides down to make room instead of jumping; collapsing slides it back up. */}
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${showForm ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                aria-hidden={!showForm}
              >
              <div className="overflow-hidden">
                <div className={`border-b border-grey-border bg-grey-bg/60 p-4 space-y-3 transition-opacity duration-300 ${showForm ? 'opacity-100' : 'opacity-0'}`}>
                  <div>
                    <p className={labelClass}>Channel</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CHANNELS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setForm({ ...form, channel: c.value })}
                          className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-medium ${
                            form.channel === c.value ? 'border-navy bg-white text-navy' : 'border-grey-border bg-white text-gray-500 hover:text-navy'
                          }`}
                        >
                          <c.icon size={15} />{c.value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className={labelClass}>Direction</p>
                      <div className="grid grid-cols-2 gap-1 rounded-lg border border-grey-border bg-white p-0.5">
                        {(['Outbound', 'Inbound'] as CommunicationDirection[]).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setForm({ ...form, direction: d })}
                            className={`rounded-md py-1.5 text-xs font-medium ${form.direction === d ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'}`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Date &amp; time</label>
                      <input type="datetime-local" value={form.occurredAt} max={localDateTimeValue(new Date())} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Summary <span className="text-red-600">*</span></label>
                    <textarea
                      value={form.summary}
                      onChange={(e) => setForm({ ...form, summary: e.target.value })}
                      rows={3}
                      placeholder="What was discussed?"
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Outcome</label>
                    <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} className={inputClass}>
                      {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-[1fr_140px] gap-2">
                    <div>
                      <label className={labelClass}>Next action</label>
                      <input value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} placeholder="e.g. Send offer letter checklist" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Due</label>
                      <input type="date" value={form.nextActionDate} disabled={!form.nextAction.trim()} onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })} className={`${inputClass} disabled:opacity-40`} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!canSave}
                    className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save interaction
                  </button>
                </div>
              </div>
              </div>

              {/* Next action */}
              {upcoming && (
                <div className="mx-4 mt-4 flex items-start gap-2.5 rounded-lg border border-grey-border px-3 py-2.5">
                  <CalendarClock size={15} className="text-navy mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Next action</p>
                    <p className="text-sm text-navy">{upcoming.nextAction}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${nextActionTiming(upcoming.nextActionDate as string).tone}`}>
                    {nextActionTiming(upcoming.nextActionDate as string).text}
                  </span>
                </div>
              )}

              {/* Channel filter */}
              {clientEntries.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto px-4 pt-4 pb-1">
                  {(['all', ...CHANNELS.map((c) => c.value)] as (CommunicationChannel | 'all')[]).map((c) => {
                    const count = c === 'all' ? clientEntries.length : clientEntries.filter((e) => e.channel === c).length;
                    if (c !== 'all' && count === 0) return null;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFilter(c)}
                        className={`flex-shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-medium ${
                          filter === c ? 'bg-navy text-white border-navy' : 'bg-white border-grey-border text-gray-500 hover:text-navy'
                        }`}
                      >
                        {c === 'all' ? 'All' : c} {count}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Entries */}
              <div className="p-4 space-y-3">
                {visible.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500">No interactions logged yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Log calls, messages and meetings so everyone sees the full history.</p>
                  </div>
                )}
                {visible.map((e) => (
                  <LogEntry key={e.id} entry={e} />
                ))}
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function LogEntry({ entry: e }: { entry: CommunicationEntry }) {
  const meta = CHANNEL_META[e.channel];
  const Icon = meta?.icon ?? Phone;
  const DirectionIcon = e.direction === 'Inbound' ? ArrowDownLeft : ArrowUpRight;
  return (
    <div className="dissolve-in rounded-lg border border-grey-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta?.tone ?? 'bg-gray-100 text-gray-600'}`}>
            <Icon size={14} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy truncate">{e.channel}</p>
            <p className="text-[11px] text-gray-400">{formatActivityTime(new Date(e.occurredAt))}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
          <DirectionIcon size={11} />{e.direction}
        </span>
      </div>
      <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{e.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-navy/10 text-navy">{e.outcome}</span>
      </div>
      {e.nextAction && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-grey-bg px-2.5 py-1.5">
          <p className="text-xs text-navy min-w-0"><span className="text-gray-400">Next: </span>{e.nextAction}</p>
          {e.nextActionDate && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${nextActionTiming(e.nextActionDate).tone}`}>
              {nextActionTiming(e.nextActionDate).text}
            </span>
          )}
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-2">Logged by {e.loggedBy} · {ROLE_LABELS[e.loggedByRole]}</p>
    </div>
  );
}
