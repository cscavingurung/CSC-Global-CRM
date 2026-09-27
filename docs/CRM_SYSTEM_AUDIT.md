# CSC Global CRM — System Audit

_Audit date: 2026-09-27. Scope: the whole repository (`src/`, `supabase/`, build config). Companion documents: [ROLE_PERMISSION_AUDIT](ROLE_PERMISSION_AUDIT.md) · [DATABASE_AUDIT](DATABASE_AUDIT.md) · [SECURITY_AUDIT](SECURITY_AUDIT.md) · [WORKFLOW_AUDIT](WORKFLOW_AUDIT.md) · [WORKFLOW_DEAD_ENDS](WORKFLOW_DEAD_ENDS.md) · [BUSINESS_RULES](BUSINESS_RULES.md) · [TEST_RESULTS](TEST_RESULTS.md) · [REMAINING_WORK](REMAINING_WORK.md) · [PRODUCTION_READINESS](PRODUCTION_READINESS.md)._

## Bottom line

The frontend is broad and largely complete as a **demonstration of every role's workflow**. It is **not a production system yet**:

1. **There is no backend authorization.** Every Supabase table has a policy of `using (true) with check (true)` for the public (anon) key. Anyone who opens the site can read and change every table directly, including staff passwords. (P0)
2. **There is no real authentication.** Until this audit, sign-in was a list of staff to click — no password. Passwords are stored in plain text in the `staff` table. (P0)
3. **Most business data is never saved.** Finance (charges, payments, receipts, discounts, refunds), HR (attendance, leave, payroll, onboarding), tasks, issues, notices, marketing and the Branch Manager workspace live only in browser memory, seeded with sample data. A reload loses every change, and two users never see each other's work. (P0 for finance, P1 for the rest)

Everything below explains the architecture, each module's status and every finding, with severity.

## A. Current architecture

| Layer | What exists |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 + Tailwind 3 + lucide-react. Single-page app; `src/App.tsx` (~2,000 lines) is the root that holds every store in `useState` and every mutation handler. Page switching is by sidebar key (`activeKey`); a few modules (Finance, Marketing, Designer, Counselor Marketing, Front Desk Marketing, Branch Manager Workspace, Branch Manager Dashboard, Super Admin Command Center) use a `MemoryRouter` scoped to the module. |
| Backend | **None of its own.** The browser talks to Supabase directly with the public anon key (`src/lib/*Api.ts`). No Edge Functions, no server, no RPCs. |
| Database | Supabase Postgres. 10 tables in `supabase/schema.sql` (+5 migrations): `students`, `counselors`, `counselor_students`, `applications`, `staff`, `branches`, `notifications`, `commissions`, `partners`, `communication_logs`. Text primary keys generated in the browser (`Date.now()`-based). No foreign keys. |
| Auth | None at the database level. The app compares against the `staff` table in the browser (now; previously no check). No Supabase Auth, no sessions, no expiry. |
| Storage | None. File "uploads" keep only a file name or a browser-session blob URL. |
| Realtime | 11 table subscriptions; any change re-fetches the whole table. |
| State | React state in `App.tsx` + two contexts (`FinanceLedgerContext`, `CommunicationsContext`, `CurrentUserContext`). |
| Demo data | `src/devSeed.ts` (~2,000 lines). Now used only in demo mode (`src/appMode.ts`). |
| Tests | None before this audit. Now `npm test` (dependency-free runner, 25 unit tests). |
| Deployment | Vercel (`vercel.json` SPA rewrite). Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, new `VITE_DEMO_MODE`. |

**Role architecture:** internal roles `super_admin`, `marketing` (sub-roles Marketing Manager, Leads Specialist, Content Planner, Graphics Designer), `branch_manager`, `receptionist` (Front Desk), `counselor`, `application_officer` (V/A Officer — application *and* visa). Navigation per role in `NAV_CONFIG` (`src/mockData.ts`). Enforcement is entirely in the browser — see [ROLE_PERMISSION_AUDIT](ROLE_PERMISSION_AUDIT.md).

**Key relationships (implicit, no FKs):** `students.id` = `counselor_students.id` (the same client through intake → counselor), `counselor_students.client_id` = `applications.client_id` = finance ledger `clientId`. Staff are linked everywhere **by name**, not id; branches by **name**.

## B. Modules and status

Status key: **A** full (UI + backend + DB + permissions + tests) · **B** UI only (works in browser memory, not saved) · **C** backend only · **D** partial · **E** broken · **F** missing.

| Module | Status | Notes |
|---|---|---|
| Sign-in / sessions | **E → D** (fixed part) | Was a no-password picker. Now: password form outside demo mode, inactive staff blocked, deactivated staff signed out. Still no Supabase Auth, plaintext passwords (P0). |
| Leads — Front Desk intake, assign counselor, visitors | D | Saved (`students`, `counselor_students`). No server-side permission. Duplicate-lead detection absent. |
| Marketing leads (raw → qualified → assigned) | B | Marketing store is memory-only; assignment creates a real `students` row. |
| Counselor clients, consultation, follow-ups, enrolled | D | Saved. |
| Client Profile, Status Tracker, country routes | D | Saved on `applications` (jsonb). Status transitions enforced only in UI. |
| Applications / offer / visa (V/A Officer) | D | Saved. One application record per client with multiple offer attempts + one visa case (with refusal history). |
| Finance — charges, payments, receipts, discounts, refunds, plans, outstanding | **B** | Memory only. **Fixed:** outstanding after refunds; service fee could not be set (dead end). |
| Commissions, Partners | D | Saved; no permissions. |
| Staff Management | D | Saved, incl. plaintext passwords (P0). |
| Branches | D | Saved. |
| Notifications | D | Saved; visibility filtered in the browser only. |
| Daily Task Board / Task Oversight | B | Memory only. |
| Issues & Escalations / Help Desk | B | Memory only. |
| Branch Communication (notices) | B | Memory only. |
| Attendance, corrections, Late & Absence, day logs | B | Memory only. One-record-per-day enforced in the handler only. |
| Leave, Holidays | B | Memory only. |
| Performance, Payroll inputs, HR reports | B | Memory only; salary visible to Branch Manager in browser memory. |
| Onboarding / Offboarding, Handover Engine | B | Memory only; no link to account creation. |
| Staff agreements | **F** | Not implemented. |
| Manager Approval Center | B | Unified inbox over leave, corrections, discounts, refunds, exceptions, expenses, branch transfers; decisions in memory except transfers' effect on client records. |
| Branch Manager workspace (marketing requests, transfers, IT tickets) | B / D | Transfers write to saved client records; requests/tickets are memory only. |
| Branch Manager dashboard | D | Correct live aggregates of the data above (inherits "memory only" for unsaved stores). |
| Super Admin Command Center, Excel exports, Monthly report | D | Live aggregates; exports work. Audit log memory only. |
| Marketing department (content planner, designer, campaigns, SEO, reports) | B | Memory only. |
| Appointments | **F** | No appointment model. "Appointments" on dashboards are derived from visits/follow-ups. |
| Document requests (requested/received/rejected per document) | **F** | Only tick-box checklists (enrolment, visa, country route). |
| Global search | D | Super Admin only; searches in-browser data. |
| Audit trail | D | Pieces: client handover/transfer log, override log, transfer log, issue activity, attendance amendments. No general audit log; none saved except client-record ones. |

## C. Critical findings (summary — detail in the linked documents)

### P0 — Critical
| # | Finding | Status |
|---|---|---|
| P0-1 | Every table open to the anon key (`using (true)`) — read/modify/delete everything, incl. by direct API calls. | **Open** — needs Supabase Auth + RLS ([SECURITY_AUDIT](SECURITY_AUDIT.md)). |
| P0-2 | Staff passwords stored in plain text and readable by anyone via the anon key. | **Open** — needs Supabase Auth. |
| P0-3 | Sign-in required no password; any person could act as any employee. | **Fixed** outside demo mode (password form); full fix needs Supabase Auth. |
| P0-4 | Inactive / deactivated employees could still sign in and keep working. | **Fixed** (blocked at sign-in; signed out when deactivated). |
| P0-5 | Sample data mixes with real data in any build (empty tables fell back to fake records; unsaved stores started from fake records). | **Fixed** — demo data only with `VITE_DEMO_MODE=true` or the dev server. |
| P0-6 | Finance ledger (payments, receipts, discounts, refunds) is not saved — lost on reload; users see different ledgers. | **Open** — needs finance tables ([DATABASE_AUDIT](DATABASE_AUDIT.md) §Proposed). |
| P0-7 | Client IDs were random 4-digit numbers → collisions after ~100 clients/year; the ledger groups money by Client ID, so two clients' payments would merge. | **Fixed** (sequential) + migration for a unique index. |

### P1 — High
| # | Finding | Status |
|---|---|---|
| P1-1 | No way to set a new client's service fee → payment can never be recorded ("Nothing is due"). | **Fixed** — Service Fees panel (Client Profile → Financials). Fee list is a business decision. |
| P1-2 | A processed refund re-opened the client's balance (client shown as owing the refunded amount again). | **Fixed** + regression test. |
| P1-3 | HR, tasks, issues, notices, marketing, workspace data not saved. | Open. |
| P1-4 | Database write failures are only logged to the console (53 places); the screen shows the change as saved. | Open. |
| P1-5 | Receipt numbers and record IDs are generated in the browser — duplicates under concurrent use once saved. | Open (needs DB sequences). |
| P1-6 | Staff and branches are linked by **name**; renaming a person or branch breaks history, permissions and filters. | Open (needs ids). |
| P1-7 | No appointment booking (counselor/time conflicts impossible to detect). | Missing feature (business decision on scope). |

### P2 — Medium
Whole-table fetches and whole-table realtime re-fetch (no pagination); no document request tracking; no general audit log; several parallel "task" engines (Daily Tasks, IT tickets, design/video/SEO tasks, onboarding tasks); counselor revenue attribution after handover undefined; lead de-duplication missing; timezone assumed = browser; onboarding not connected to account creation; staff agreements missing.

### P3 — Low
Sample data shipped in the production bundle (unused); two pre-existing fast-refresh lint warnings; `PROJECT.md` partly out of date (updated in this pass).

## What changed in this audit
See [PRODUCTION_READINESS](PRODUCTION_READINESS.md) → Completed.
