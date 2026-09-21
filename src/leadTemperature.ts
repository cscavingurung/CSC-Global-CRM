import { LeadTemperature } from './types';

export const LEAD_TEMPERATURES: LeadTemperature[] = ['Hot', 'Mild', 'Cold'];

// Soft-tinted pills only — never solid fills.
export const LEAD_TEMPERATURE_STYLES: Record<LeadTemperature, string> = {
  Hot: 'bg-red-50 text-red-700 border-red-200',
  Mild: 'bg-amber-50 text-amber-700 border-amber-200',
  Cold: 'bg-slate-50 text-slate-600 border-slate-200',
};

export const LEAD_TEMPERATURE_HINTS: Record<LeadTemperature, string> = {
  Hot: 'Ready to move now',
  Mild: 'Interested, needs nurturing',
  Cold: 'Low intent for now',
};
