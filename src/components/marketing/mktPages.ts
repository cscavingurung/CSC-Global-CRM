import MarketingDashboard from './MktDashboards';
import { LeadsAssignment, LeadsInbox, LeadsMonitoring, LeadsQualification } from './MktLeads';
import { ContentCalendar, ContentLibrary, ProductionQueue } from './MktContent';
import { ContentCalendarPage, ContentHistoryPage, RequestsView } from './MktContentPlanner';
import { AdvertisingPage, CampaignPerformance, CampaignsPage } from './MktCampaigns';
import { PublishedPosts, ScheduledPosts, SeoDashboard, SeoTasks } from './MktSocialSeo';
import { BranchConversion, CampaignReports, LeadReports } from './MktReports';
import { AddLeadPage, FollowUpStatus, MyAssignedLeads } from './MktLeadsSpecialist';

/** Marketing sidebar key → page. */
export const MARKETING_PAGES: Record<string, () => JSX.Element> = {
  overview: MarketingDashboard,
  'mkt-inbox': LeadsInbox,
  'mkt-qualification': LeadsQualification,
  'mkt-assignment': LeadsAssignment,
  'mkt-monitoring': LeadsMonitoring,
  'ls-add-lead': AddLeadPage,
  'ls-my-leads': MyAssignedLeads,
  'ls-followups': FollowUpStatus,
  'mkt-calendar': ContentCalendar,
  'mkt-requests': RequestsView,
  'cp-calendar': ContentCalendarPage,
  'cp-requests': RequestsView,
  'cp-history': ContentHistoryPage,
  'mkt-production': ProductionQueue,
  'mkt-library': ContentLibrary,
  'mkt-campaign-list': CampaignsPage,
  'mkt-advertising': AdvertisingPage,
  'mkt-performance': CampaignPerformance,
  'mkt-scheduled': ScheduledPosts,
  'mkt-published': PublishedPosts,
  'mkt-seo-dashboard': SeoDashboard,
  'mkt-seo-tasks': SeoTasks,
  'mkt-report-leads': LeadReports,
  'mkt-report-campaigns': CampaignReports,
  'mkt-report-branches': BranchConversion,
};
