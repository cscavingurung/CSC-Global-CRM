# Test Results

_Run: 2026-09-27._ Commands: `npm run typecheck`, `npx eslint .`, `npm test`, `npm run build`.

| Check | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | ✅ 0 errors |
| Lint (`eslint .`) | ✅ 0 errors, 2 pre-existing warnings (fast-refresh in `NewIntakeForm.tsx`, `currentUser.tsx`) |
| Unit tests (`npm test`) | ✅ **25 passed, 0 failed** |
| Production build | ✅ builds; verified the demo account picker is **not** in the bundle without `VITE_DEMO_MODE=true` and **is** with it |

## Test suite (`tests/`, runner `scripts/run-tests.mjs` — no extra dependencies)

**finance.test.ts** — outstanding formula; pending/rejected discounts ignored, approved applied; **processed refund does not re-open a balance (regression for P1-2)**; voided payments ignored; no negative outstanding; instalment allocation; receipt numbering per branch/year; revenue counts a payment once, net of processed refunds only; **Client IDs issued in sequence (regression for P0-7)**.

**hr.test.ts** — leave working days skip Saturdays and holidays; overlap detection (pending/approved only); balances from approved days; lateness boundaries (9:10 on time, 9:11 late, 9:31 very late); day status for leave/holiday/Saturday/absent; missing check-out flagged.

**pipeline.test.ts** — no route until a country is chosen; fee-paid files resolve without a choice; Australia: GS checklist gate, GS approved before Fee Paid, mandatory University Client ID, offer marked Fee Paid; UK Pre-CAS skip; NZ tuition hard lock and refused AIP closes the route + visa refused; USA interview needs a date and lodges the visa.

**reports.test.ts** (on the sample data) — converted clients counted once; each payment once; each visa file once; branch filter respected by every dataset.

## Not covered (and why)
- **Integration / E2E through the real UI:** no browser test runner in the project (Playwright/Cypress would be a new dependency — ask before adding). Rendering was checked with server-side renders during development.
- **Permission / RLS tests:** there are no database permissions to test yet (all policies `using (true)`). Write these with the RLS work (SECURITY_AUDIT).
- **Concurrency:** meaningless while finance lives in browser memory; add with DB sequences/constraints.
