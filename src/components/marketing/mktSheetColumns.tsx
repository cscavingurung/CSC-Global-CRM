// Excel-sheet column sets for the Leads Specialist tabs. Branch-side columns come only from
// LeadTrack (whitelisted outcomes) — no revenue, notes or documents, same boundary as the pages.
import { Campaign, MarketingLead } from '../../types';
import { CONTACT_SLA_HOURS, FUNNEL_STEPS, JOURNEY_STEPS, LeadTrack, campaignName, trackStatusStyle, whenLabel } from '../../marketingDept';
import { CHANNEL_STYLES, STAGE_STYLES } from '../../marketingDept';
import { SheetColumn, needsAttention, stampSort } from './mktUtils';

const pill = (text: string, cls: string) => <span className={`rounded-full px-2 py-0.5 font-medium ${cls}`}>{text}</span>;
const academic = (l?: MarketingLead) => l?.academicBackground
  ?? l?.academics?.map((a) => `${a.level}${a.stream ? `, ${a.stream}` : ''}${a.gpa ? ` (${a.gpa})` : ''}`).join(' · ');

/** Lead Inbox — every captured field, the rarer ones switched off until needed. */
export function leadColumns(campaigns: Campaign[], action?: (l: MarketingLead) => React.ReactNode): SheetColumn<MarketingLead>[] {
  const cols: SheetColumn<MarketingLead>[] = [
    { key: 'name', header: 'Name', value: (l) => l.name },
    { key: 'phone', header: 'Phone', value: (l) => l.phone },
    { key: 'email', header: 'Email', value: (l) => l.email },
    { key: 'country', header: 'Country', value: (l) => l.preferredCountry },
    { key: 'program', header: 'Program / Purpose', value: (l) => l.interestedProgram ?? l.purpose },
    { key: 'intake', header: 'Intake', value: (l) => l.intake, hidden: true },
    { key: 'academic', header: 'Academic', value: academic, wide: true, hidden: true },
    { key: 'english', header: 'English Test', value: (l) => l.englishTest, hidden: true },
    { key: 'branch', header: 'Preferred Branch', value: (l) => l.preferredBranch },
    { key: 'source', header: 'Source', value: (l) => l.source, render: (l) => pill(l.source, CHANNEL_STYLES[l.source] ?? 'bg-gray-100 text-gray-600') },
    { key: 'campaign', header: 'Campaign', value: (l) => (l.campaignId ? campaignName(campaigns, l.campaignId) : '') },
    { key: 'message', header: 'Message', value: (l) => l.message, wide: true },
    { key: 'received', header: 'Received', value: (l) => l.receivedAt, sort: (l) => stampSort(l.receivedAt) },
    { key: 'stage', header: 'Stage', value: (l) => l.stage, render: (l) => pill(l.stage, STAGE_STYLES[l.stage]) },
    { key: 'qualifiedBy', header: 'Qualified By', value: (l) => l.qualifiedBy, hidden: true },
    { key: 'notes', header: 'Marketing Notes', value: (l) => l.notes, wide: true, hidden: true },
  ];
  if (action) cols.push({ key: 'action', header: 'Action', value: () => '', render: action, noExport: true });
  return cols;
}

export interface TrackRow { t: LeadTrack; l?: MarketingLead }

/** My Assigned Leads / Lead Monitoring — the lead plus its read-only branch journey. */
export function trackColumns(campaigns: Campaign[]): SheetColumn<TrackRow>[] {
  return [
    { key: 'name', header: 'Name', value: ({ l }) => l?.name },
    { key: 'phone', header: 'Phone', value: ({ l }) => l?.phone, hidden: true },
    { key: 'email', header: 'Email', value: ({ l }) => l?.email, hidden: true },
    { key: 'country', header: 'Country', value: ({ l }) => l?.preferredCountry },
    { key: 'program', header: 'Program / Purpose', value: ({ l }) => l?.interestedProgram ?? l?.purpose },
    { key: 'source', header: 'Source', value: ({ l }) => l?.source, render: ({ l }) => (l ? pill(l.source, CHANNEL_STYLES[l.source] ?? '') : null) },
    { key: 'campaign', header: 'Campaign', value: ({ l }) => (l?.campaignId ? campaignName(campaigns, l.campaignId) : '') },
    { key: 'branch', header: 'Branch', value: ({ t }) => t.branch },
    { key: 'counselor', header: 'Counselor', value: ({ t }) => t.counselor ?? 'Unclaimed' },
    { key: 'assignedBy', header: 'Assigned By', value: ({ l }) => l?.assignedBy, hidden: true },
    { key: 'assigned', header: 'Assigned', value: ({ t }) => t.assignedAt, sort: ({ t }) => stampSort(t.assignedAt) },
    { key: 'contacted', header: 'First Contact', value: ({ t }) => t.contactedAt || (t.contactedAt === '' ? 'Yes' : ''), sort: ({ t }) => stampSort(t.contactedAt) },
    { key: 'status', header: 'Status', value: ({ t }) => t.status, sort: ({ t }) => t.journey, render: ({ t }) => pill(t.status, trackStatusStyle(t)) },
    { key: 'journey', header: 'Journey Step', value: ({ t }) => `${t.journey + 1}/${JOURNEY_STEPS.length} · ${JOURNEY_STEPS[t.journey]}`, sort: ({ t }) => t.journey, hidden: true },
    { key: 'funnel', header: 'Funnel Stage', value: ({ t }) => FUNNEL_STEPS[t.step], hidden: true },
    { key: 'updated', header: 'Last Update', value: ({ t }) => t.lastUpdate, render: ({ t }) => whenLabel(t.lastUpdate) },
    { key: 'idle', header: 'Days Idle', value: ({ t }) => t.daysSinceUpdate, numeric: true },
    {
      key: 'sla', header: 'Contact SLA',
      value: ({ t }) => (t.hoursUncontacted === null ? 'Contacted' : t.slaBreached ? `Breached (${Math.round(t.hoursUncontacted)}h)` : `${Math.round(t.hoursUncontacted)}h of ${CONTACT_SLA_HOURS}h`),
      sort: ({ t }) => t.hoursUncontacted ?? -1,
      render: ({ t }) => (t.slaBreached ? pill(`Breached · ${Math.round(t.hoursUncontacted ?? 0)}h`, 'bg-red-50 text-red-700') : t.hoursUncontacted === null ? <span className="text-emerald-700">Contacted</span> : `${Math.round(t.hoursUncontacted)}h`),
    },
    {
      key: 'attention', header: 'Attention',
      value: ({ t }) => (t.slaBreached ? 'Not contacted' : t.consultationStuck ? 'Consultation stuck' : t.noActivity ? `No activity ${t.daysSinceUpdate}d` : ''),
      render: ({ t }) => (needsAttention(t) ? pill(t.slaBreached ? 'Not contacted' : t.consultationStuck ? 'Consultation stuck' : `Quiet ${t.daysSinceUpdate}d`, t.slaBreached ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700') : null),
    },
  ];
}

export const trackTone = ({ t }: TrackRow): 'red' | 'amber' | undefined => (t.slaBreached ? 'red' : needsAttention(t) ? 'amber' : undefined);

export interface AlertRow { t: LeadTrack; l?: MarketingLead; alert: string; detail: string; lastPing?: string }

/** Follow-up Status — one row per stuck lead. */
export function alertColumns(action?: (r: AlertRow) => React.ReactNode): SheetColumn<AlertRow>[] {
  const cols: SheetColumn<AlertRow>[] = [
    { key: 'name', header: 'Lead', value: (r) => r.l?.name },
    { key: 'alert', header: 'Alert', value: (r) => r.alert, render: (r) => pill(r.alert, r.t.slaBreached ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700') },
    { key: 'branch', header: 'Branch', value: (r) => r.t.branch },
    { key: 'counselor', header: 'Counselor', value: (r) => r.t.counselor ?? 'Unclaimed' },
    { key: 'status', header: 'Status', value: (r) => r.t.status, sort: (r) => r.t.journey },
    { key: 'detail', header: 'Detail', value: (r) => r.detail },
    { key: 'source', header: 'Source', value: (r) => r.l?.source, hidden: true },
    { key: 'phone', header: 'Phone', value: (r) => r.l?.phone, hidden: true },
    { key: 'updated', header: 'Last Update', value: (r) => r.t.lastUpdate, render: (r) => whenLabel(r.t.lastUpdate) },
    { key: 'idle', header: 'Days Idle', value: (r) => r.t.daysSinceUpdate, numeric: true },
    { key: 'ping', header: 'Branch Last Pinged', value: (r) => r.lastPing, sort: (r) => stampSort(r.lastPing) },
  ];
  if (action) cols.push({ key: 'action', header: 'Action', value: () => '', render: action, noExport: true });
  return cols;
}
