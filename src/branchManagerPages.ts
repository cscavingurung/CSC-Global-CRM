// Scaffold content for Branch Manager sub-tabs that don't have a working page yet. Each entry
// describes what the page is for and the features planned for it, so the placeholder doubles
// as a spec. Remove an entry once its real page is built and routed in App.tsx.

export interface ScaffoldInfo {
  description: string;
  features: string[];
}

export const BM_SCAFFOLDS: Record<string, ScaffoldInfo> = {
  // Operation Management


  // Standalone
  approvals: {
    description: 'Everything waiting on the Branch Manager’s sign-off, in one queue.',
    features: ['Leave approvals', 'Refund approvals', 'Discount approvals', 'Escalated issues', 'Approval history'],
  },
};
