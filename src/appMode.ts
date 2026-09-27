// Demo mode — the account picker on the sign-in screen and the sample data (devSeed.ts).
// On by default only for the local dev server; a production build turns it on solely when
// VITE_DEMO_MODE=true is set explicitly (e.g. a demo deployment). Real CSC data must never run
// in demo mode: sample records would mix with real ones and anyone could sign in as anyone.
export const DEMO_MODE: boolean = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';
