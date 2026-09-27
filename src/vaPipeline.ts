// Unified V/A stages — one six-stage reading of the existing offer and visa records (used by the
// V/A dashboard's visa-stage balance check).
import { ApplicationRecord } from './types';
import { getActiveOfferApplication, isStudyCase } from './clientPipeline';

export const UNIFIED_STAGES = [
  'Preparing Documents', 'Application Submitted', 'Offer Received', 'Ready for Visa Application', 'Visa Submitted', 'Decision',
] as const;
export type UnifiedStage = (typeof UNIFIED_STAGES)[number];

/** Study cases go through an institution; SOWP / PR / visit cases go straight to visa. */
export const hasOfferStage = (app: ApplicationRecord) => isStudyCase(app.purpose);

export function unifiedStage(app: ApplicationRecord): UnifiedStage {
  const v = app.visaApplication;
  if (v) {
    if (v.status === 'Visa Approved' || v.status === 'Visa Refused') return 'Decision';
    if (v.status === 'Visa Applied') return 'Visa Submitted';
    if (v.status === 'File Ready for Visa') return 'Ready for Visa Application';
    return hasOfferStage(app) ? 'Offer Received' : 'Preparing Documents';
  }
  const offer = getActiveOfferApplication(app);
  if (!offer || offer.status === 'Enrolled') return 'Preparing Documents';
  if (offer.status === 'Offer Received' || offer.status === 'Fee Paid') return 'Offer Received';
  return 'Application Submitted';
}
