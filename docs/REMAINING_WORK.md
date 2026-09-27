# Remaining Work

Ordered by the phases in the brief. Estimates are rough engineering effort, not calendar time.

## Phase 1 — Critical (before any real data)
1. **Supabase Auth** sign-in (email/password, reset, session expiry), `staff.user_id`, drop `staff.password`. *(needs Supabase project access)* — ~2–3 days
2. **RLS policies + helper `current_staff()`** for all 10 existing tables; column-restricted views for staff directory and marketing. — ~3–4 days
3. **Persist finance**: `fin_transactions`, `receipt_counters` + `record_payment()` RPC (receipt number assigned in the DB, `unique(receipt_no)`), approval RPCs, no DELETE. Wire `FinanceLedgerContext` to it. — ~4–5 days
4. **Write error handling**: replace the 53 `console.error`-only catches with a rollback + visible error toast pattern. — ~1–2 days
5. Apply migration `2026-09-27-client-id-unique.sql` after resolving any duplicates it reports.
6. Rotate the anon key once RLS is live.

## Phase 2 — Core engine
7. Service Master table (after the fee decision) replacing `STANDARD_FEES`; `client_services`.
8. Persist HR (attendance with `unique(staff_id,date)`, corrections, leave with overlap constraint, holidays, payroll inputs restricted).
9. One persisted `tasks` table (creator, assignee, related client/application/issue, comments, history); migrate IT tickets, design/video/SEO tasks and onboarding tasks as filtered views where sensible.
10. Persist issues, notices, marketing store, Branch Manager workspace (requests, transfers), override/audit log.
11. Replace name-based links with ids (staff, branch, counselor).
12. Duplicate-lead detection on phone/email at intake.

## Phase 3 — Cross-role workflows
13. Marketing inbox for Branch Manager content/support requests (dead end #3).
14. Refund processing owner (dead end #6) and IT ticket owner (#4) once roles are decided.
15. Notifications: approval decisions to requester, task overdue, payment received, leave decisions.
16. Appointments (booking, conflict detection, check-in, no-show) — scope decision first.
17. Document request tracking (requested/received/under review/accepted/rejected/expired).
18. Staff agreements (template → generated → reviewed → accepted → immutable signed version).
19. Onboarding → account activation link.

## Phase 4 — Reporting
20. Server-side aggregation (SQL views/RPCs) for dashboards once data is persisted; pagination for large lists; targeted realtime (row-level) instead of whole-table re-fetch.

## Phase 5 — UX
21. Loading / error states on every list (today most show "empty" while loading).
22. Browser E2E tests (Playwright) for the main journeys — new dev dependency, ask first.

## Phase 6 — Polish
23. Lazy-load `devSeed.ts` so sample data isn't in the production bundle; remove the two fast-refresh warnings.
