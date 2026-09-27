// Demo mode — shows a "don't enter real data" banner in the dashboard shell (App.tsx). On by
// default only for the local dev server; a production build turns it on solely when
// VITE_DEMO_MODE=true is set explicitly (e.g. a demo deployment). Login itself is unaffected —
// every account, real or demo, signs in through Supabase Auth.
export const DEMO_MODE: boolean = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';
