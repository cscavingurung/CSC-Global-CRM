# Production Readiness

## Verdict

**Not ready for real CSC data.** The frontend is close to complete, but the system has no backend authorization, no real authentication, and most business data (including all money) is not saved. Use it as a demo only (`VITE_DEMO_MODE=true`) until Phase 1 of [REMAINING_WORK](REMAINING_WORK.md) is done.

## System status

| Area | Status |
|---|---|
| Frontend | ✅ Broad and consistent; every role has working screens. |
| Backend | ❌ None — the browser talks to the database directly. |
| Database | ⚠️ 10 tables; finance, HR, tasks, issues, marketing not stored; no FKs; ids made in the browser. |
| Security | ❌ All tables fully open to the public key; plaintext passwords. |
| Authentication | ⚠️ Password check in the browser (added now); no Supabase Auth. |
| Permissions | ⚠️ Enforced in the UI and some handlers only. |
| Financial | ⚠️ Formulas now correct and tested; ledger not saved; receipt numbers browser-side. |
| Workflows | ⚠️ Most complete end to end in the UI; dead ends listed in WORKFLOW_DEAD_ENDS. |
| Reporting | ✅ Numbers trace to their rows (clickable, exportable); limited by unsaved data. |
| Testing | ⚠️ 25 unit tests (new); no E2E or permission tests. |

## Completed in this audit
1. **Sign-in:** password required outside demo mode; single error message; inactive employees blocked; deactivated employees signed out immediately (`Login.tsx`, `App.tsx`).
2. **Demo mode switch** (`src/appMode.ts`): sample data and the account picker only on the dev server or with `VITE_DEMO_MODE=true`; production builds start from real data only and don't contain the picker. A banner marks demo mode on every screen.
3. **Refund bug:** processed refunds no longer re-open a paid balance (`src/finance.ts`); Financials summary shows fee net of refunds.
4. **Service-fee dead end:** new Service Fees panel lets the counselor / Branch Manager put the client's service on their account at the standard fee (snapshotted), special prices via discount approval (`ServiceFeesPanel.tsx`).
5. **Client ID collisions:** sequential Client IDs + unique-index migration (`src/clientId.ts`, `supabase/migrations/2026-09-27-client-id-unique.sql`).
6. **Test suite:** `npm test`, 25 tests across finance, HR, country routes and reports.
7. Documentation: the ten audit documents in `/docs`.

## Action needed on deployment
- **The Vercel demo will switch to the password screen and empty data** unless you add `VITE_DEMO_MODE=true` in Vercel → Project → Settings → Environment Variables. For a real deployment leave it unset.
- Staff need passwords set in Staff Management to sign in outside demo mode.

## Before real CSC data (exact list)
1. Supabase Auth + RLS on every table + remove stored passwords (P0-1, P0-2).
2. Finance tables with DB-assigned receipt numbers and no deletes (P0-6, P1-5).
3. Error handling on writes (P1-4).
4. Persist HR, tasks, issues, marketing, workspace (P1-3) — or explicitly keep those modules switched off until they are.
5. Business decisions below answered (at least service fees and approval limits).
6. Apply the Client ID uniqueness migration.
7. Rotate the anon key.

## Business decisions required
| Decision | Where it's used |
|---|---|
| Service list, fees, currency, whether fees vary by country/branch | Service Fees panel / future Service Master |
| Who assigns services; who approves special prices; discount and refund limits | Service Fees, Approval Center |
| Who approves a Branch Manager's own leave/expenses | Approval Center |
| Who processes refund payouts; who handles IT tickets | Refunds, IT Support |
| Roles to add: Finance, IT, Customer Service, Partner/BD, separate Visa Officer | Role model, RLS |
| Revenue & commission attribution after handover/transfer; commission rates | Revenue by counselor, commissions |
| Refund treatment (credit reducing the fee — implemented) confirm | Outstanding |
| Leave allowances, carry-over, half days; weekly off (Saturday); shift 9:00, 10-min grace, 30-min late limit | HR |
| Payroll rules | Payroll inputs |
| Appointment booking scope; document tracking scope; agreement template wording | New modules |

## Recommended (can wait)
Service Master UI for Super Admin; lazy-loaded sample data; E2E tests; server-side aggregates for dashboards; per-role global search.
