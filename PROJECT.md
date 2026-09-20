# CSC Global Management Portal

A role-based management portal for CSC Global, an education/visa consultancy. It has grown from a linear intake pipeline into a fuller CRM: it tracks clients end-to-end from first contact (walk-in or a marketing-generated lead) through counselor assignment, consultation, university offer, visa application, and outcome, plus a marketing lead-broadcast/claim workflow, commissions, and partner (college/university) management, across multiple branches.

## Stack

- **React 18** + **TypeScript**, built with **Vite 5**
- **Tailwind CSS 3** for styling, **lucide-react** for icons
- **@supabase/supabase-js**: every role's data is now wired to live Supabase tables, including commissions and partners (previously in-memory-only — see below).
  - There is no demo/mock data fallback anymore — every table's `fetch*()` call sets state directly from whatever Supabase returns (including an empty array), so the app always reflects real database state. `src/demoData.ts` (the old `DEMO_*` seed set) and the old `MOCK_*` data arrays in `src/mockData.ts` (`MOCK_COUNSELORS`, `MOCK_APPLICATIONS`, `MOCK_STAFF`, `MOCK_ACTIVITY_FEED`, `MOCK_BRANCHES`, `MOCK_NOTIFICATIONS`, `MOCK_COMMISSIONS`, `MOCK_PARTNERS`, `OVERVIEW_STATS`, etc.) have been deleted. `mockData.ts` now only holds `NAV_CONFIG`, `ROLE_LABELS`, `ROLE_BADGE_STYLES`, `STAFF_ROLE_TO_ROLE`, `COUNTRIES`, `PURPOSES` — none of it is seed/demo data, all of it is static UI/mapping config still actively used.
  - **Commissions** (`commissions` table, `src/lib/commissionsApi.ts`): fetch + update only — `CommissionsPage.tsx` has no add/delete UI, so the API surface matches actual usage (no unused insert/delete). ↔ `CommissionRecord`.
  - **Partners** (`partners` table, `src/lib/partnersApi.ts`): full CRUD (`PartnersPage.tsx` supports add/edit/delete colleges & universities and their `courses[]`/`commissionRate`). ↔ `Partner`.
  - A pass through every existing `lib/*Api.ts` file found several fields added to `types.ts` after the Supabase wiring was first built that were silently dropped on write (present in local state and the UI, but never persisted, so they'd vanish on refresh/realtime re-fetch) — now fixed: `students` (`addedBy`, `visitDateTime`, `referredThrough`, `platformSource`, `broadcastBranch`, `broadcastAt`, `claimedBy`, `claimedAt`, `revisitedAt`), `counselor_students` (`clientId`, `enrolments`, `addedBy`, `visitDateTime`, `referredThrough`, `platformSource`, `revisitedAt`, `followUpNote`), `applications` (`clientId`, `addedBy`, `platformSource`, `visitDateTime`), `notifications` (`leadId`). `deleteStudent`/`deleteCounselorStudent`/`deleteApplication`/`deleteNotification` were also added — every table's lib file now has the full CRUD surface its usage needs.
  - Counselor: `counselorStudents` state (My Clients, Enrolled, Follow Ups, Archive, Overview) ↔ `counselor_students` table, via `src/lib/counselorStudentsApi.ts`. Rows are created for real when a Receptionist assigns a student to a counselor (`handleAssign` in `src/App.tsx`), or when a counselor accepts a broadcast marketing lead (`handleAcceptLead` → `handleAssign`) — there's no separate "create" UI for this table.
  - Receptionist: `students` state (Leads/New Intake, Clients list, Assign Counselor, Assigned Clients, Visitors, Overview) ↔ `students` table via `src/lib/studentsApi.ts`; the counselor roster (`counselors` state — availability/assigned-count shown on Assign Counselor and Overview) ↔ `counselors` table via `src/lib/counselorsApi.ts`, full CRUD. A roster row is created/deleted automatically when a Super Admin or Branch Manager adds/removes a Counselor-role staff member in Staff Management (which also prompts for a "Specialization Country" — see `StaffManagement.tsx`), and `activeAssignments` is now recomputed live from `counselor_students` (`counselorsWithLiveCounts` in `App.tsx`) rather than a stored integer.
  - Application Officer: `applications` state (Clients, Enrolled queue, Offer Applications, Visa Applications, Status Updates) ↔ `applications` table via `src/lib/applicationsApi.ts`. A row is created for real when a Counselor marks a consultation's outcome as "Proceeding" (`handleUpdateCounselorStudent` in `src/App.tsx`) — there's no separate "create" UI for this table. The old flat `statusHistory: jsonb` model is gone; see **Data model** below for the current `offerApplications[]` + `visaApplication` shape (`src/clientPipeline.ts`).
  - Marketing (new role area, not in the original build): `marketing-add-lead` logs a campaign lead (`handleAddMarketingLead`) tagged with a `platformSource` (Facebook/Instagram/Website/Tiktok/LinkedIn/Others, `src/marketing.ts`) — it stays branch-less until broadcast. `marketing-broadcast` (`MarketingBroadcastPage.tsx`) sends a lead to a branch group as a blind claim pool (`handleBroadcastLead`); any counselor in that branch can be first to accept it via the notification bell or the lead itself (`handleAcceptLead`), which both assigns it and hides the contact details from everyone else. `marketing-clients` is a read-only view-only tab tracking those leads through the pipeline.
  - Branch Manager Overview: the four stat cards (Total Students This Month / Active Consultations / Applications In Progress / Decided This Month) are computed live by `computeBranchOverviewStats()` in `src/branchLiveStats.ts`, filtering the real `students`/`counselorStudents`/`applications` state by the signed-in manager's `branch`. `counselor_students` rows carry no `branch` of their own, so "Active Consultations" is scoped by looking up the assigned counselor's `branch` via their `staff` record (matched by name). "Today's Activity" is derived live from the branch-scoped `branch_manager`-role notifications created alongside New Intake / Assign Counselor / Consultation Ready (see `createBranchManagerNotification` in `src/notifications.ts`).
  - Super Admin Overview: the same four stat cards as Branch Manager, but company-wide — computed live by `computeCompanyOverviewStats()` in `src/branchLiveStats.ts`, with no branch filtering. The "All Branches" page (add/delete, plus manager auto-assignment when a Branch Manager is added/removed in Staff) ↔ `branches` table via `src/lib/branchesApi.ts` — but `branches` only holds identity (name/location/manager); its per-branch numbers are computed live by `computeBranchLiveStats()` in `src/branchLiveStats.ts`.
  - Staff (shared by Super Admin and Branch Manager): `staff` state ↔ `staff` table via `src/lib/staffApi.ts`, full CRUD (add/update status/remove).
  - **Client Profile** (`ClientProfile.tsx`, the largest component in the app at ~48KB): the full editable record for a single client — status, notes (`ClientNote[]`), custom checklist items, offer/visa attempt history, refusal reapply, refund requests. Editing is gated by `canEditClientProfile()` (`clientPipeline.ts`) — every role except the front desk (Receptionist), who gets a read-only view.
  - **Branch scoping**: every role except Super Admin only ever sees their own branch's data — `src/App.tsx` pre-filters before handing state down as `branchStudents`/`branchApplications`/`branchCounselors`/`branchStaff`/`stageScopedApplications` (each a `useMemo` keyed on `user`), rather than relying on `StudentList`/`ApplicationsList`'s own `showBranchFilter` prop (which only renders a branch-picker dropdown for Super Admin). Counselors additionally only see their own assigned clients (`myCounselorStudents`, `stageScopedApplications`). Marketing works across every branch but only ever sees leads its own team generated (`marketingLeads`).
  - Notifications (the bell, shared by every role): `notifications` state ↔ `notifications` table via `src/lib/notificationsApi.ts`. Four trigger types now (`NotificationTrigger` in `types.ts`): `new-intake`, `assigned-to-counselor`, `consultation-ready`, and the new `lead-broadcast` (a blind marketing lead any counselor at the target branch can claim straight from the bell dropdown — `onAcceptLead` prop threaded through `DashboardShell.tsx` → `NotificationBell.tsx`).
  - **Realtime**: `students`, `counselors`, `counselor_students`, `applications`, `staff`, `branches`, `notifications`, `commissions` and `partners` are all subscribed to via `src/lib/realtimeSubscribe.ts` — any INSERT/UPDATE/DELETE re-fetches and pushes live to every open session.
  - **`supabase/schema.sql`**: single idempotent file covering every table (`students`, `counselors`, `counselor_students`, `applications`, `staff`, `branches`, `notifications`, plus `commissions`/`partners`) — each section does `create table if not exists` with the full current schema, `alter table ... add column if not exists` for fields added after a table's original creation (so it's safe to re-run against an existing table), RLS enabled with a permissive anon policy (matching the no-auth-layer convention noted below), and adds itself to the `supabase_realtime` publication. No seed data — every table starts genuinely empty, and (now that the demo-data fallback is gone, see above) every page will show that emptiness directly rather than masking it. Re-created in this working copy since it (and `.env.example`) weren't present — run the whole file in the Supabase SQL Editor; `src/lib/supabaseClient.ts` reads `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from a local `.env` (see `.env.example`), and without them every list in the app is simply empty (no Supabase client, no demo fallback).
- Self-built, standalone project — no external scaffolding tool or asset pipeline it depends on. Project convention is to use the `@/` import alias for `src/` and to keep UI production-quality (Tailwind + lucide-react only, no extra UI libs unless necessary) — see `UI_UX_GUIDELINES.md` for the full design-system conventions (badge tinting rules, spacing, etc). The CSC Global logo images live at `src/components/images/Logo.png` (Login) and `Logo2.png` (sidebar).

## How it works

`src/App.tsx` is the single stateful root (~790 lines): it holds all app data (students, counselor students, applications, staff, branches, commissions, partners, notifications) in `useState`, fetched from Supabase with a demo-data fallback, and passes handlers down as props — there is no router, context (besides `CurrentUserContext` for the signed-in user), or global store. Navigation is a simple `activeKey` string switched in `renderPage()`.

- **Auth**: `Login.tsx` checks the entered email/password against the live `staff` table (`STAFF_ROLE_TO_ROLE` in `src/mockData.ts` maps a `StaffMember`'s Title-Case `role` to the app's internal snake_case `Role`). A match must also have `status: 'Active'`. **It also now has a "Continue without a password" role picker** — pick any of the seven roles and it logs you in as the first Active staff member of that role (or a synthetic fake user if none exists), with no credentials at all. This is a real auth bypass sitting in shipped code, on top of the already-noted lack of hashing/session/Supabase Auth — fine for a demo, needs to be removed before any real deployment. Both the Add Staff form and `Login.tsx` validate email/password format against the same shared regexes (`EMAIL_PATTERN`, `PASSWORD_PATTERN` — 9–15 characters, at least one letter and one number — in `src/validation.ts`). Passwords are still stored and compared in plaintext.
- **Special route**: visiting `/intake` renders `NewIntakeForm` standalone (outside the dashboard shell).
- **Roles** (`src/types.ts`): `super_admin`, `marketing`, `finance`, `branch_manager`, `receptionist`, `counselor`, `application_officer`. Each role gets a distinct nav menu (`NAV_CONFIG` in `mockData.ts`, some items marked `viewOnly`) and a distinct overview page.
- **Data model** (`src/types.ts`): `IntakeStudent` (now carries `referredThrough`/`platformSource`/`broadcastBranch`/`claimedBy` for the marketing funnel, and `revisitedAt` for logged repeat visits) → `CounselorStudent` (consultation status/notes/outcome, plus `leadTemperature` Hot/Mild/Cold and `followUpNote` when a follow-up is scheduled, `enrolments[]` chosen when marking "Proceeding") → `ApplicationRecord`. The old single `statusHistory` log is gone; an `ApplicationRecord` now holds `offerApplications: OfferApplication[]` (one entry per institution attempt — Enrolled → Applied → Offer Received/Rejected → Fee Paid; a Rejected attempt stays as history, and a new attempt can be added to "Re-apply") plus `visaApplication: VisaApplication | null` (Preparing Documents → File Ready → Visa Applied → Approved/Refused, with a 3-item default checklist plus custom items, refusal `history[]`, and post-refusal refund requests). `src/clientPipeline.ts` derives a single unified 8-step stepper across both stages for the UI (`pipelineStepsFor()`/`getPipelineStep()`), branching between the full Study-case pipeline and a shorter direct pipeline for SOWP/Visit cases (`isStudyCase()`). Each client also gets a portfolio-wide `clientId` (`CSC-YYYY-####`, `src/clientId.ts`) and can accumulate staff `ClientNote[]`. Also `StaffMember`, `Branch`, `Partner` (with `courses[]` and a `commissionRate`), and `CommissionRecord`.
- **Notifications**: `AppNotification` (`src/types.ts`) is live Supabase state, fetched with realtime. Four factories in `src/notifications.ts` create and insert them: `createIntakeNotification`, `createAssignmentNotification`, `createConsultationReadyNotification`, and `createLeadBroadcastNotification` (new — fires when Marketing broadcasts a lead to a branch, addressed to every counselor there until one claims it). `NotificationBell.tsx` (rendered in `DashboardShell.tsx`'s header) filters the full list per-viewer via `isNotificationVisibleTo` and can accept a broadcast lead directly from the dropdown.
- **Theming**: `DashboardShell.tsx`'s user menu includes a 4-option brand theme switcher (`src/theme.ts` — CSC Navy/CSC Red/Midnight/Harbour Blue, persisted to `localStorage`, applied via a `data-theme` attribute) and an "Options" modal showing the signed-in user's account details.
- **Branch namespace**: company branch entities (the six real branches used by `students`/`staff`/`applications`) are managed through the "All Branches" page and `branches` table; see `AllBranches.tsx`/`branchesApi.ts`. (The `MOCK_USERS`/role-namespace-vs-company-branch mismatch noted in earlier versions of this doc was specific to old static mock data that no longer exists in the codebase at all.)

## Structure

```
src/
  App.tsx                 # root state + routing switch (~790 lines)
  types.ts                # shared domain types
  mockData.ts              # NAV_CONFIG, role labels/badges, role mapping, COUNTRIES/PURPOSES — no seed data
  clientPipeline.ts        # offer/visa stage logic, unified 8-step pipeline stepper, status tone/styling
  marketing.ts              # platform-source badges, isMarketingLead(), lead/consultation/application matching
  leadTemperature.ts        # Hot/Mild/Cold badge styles + hints
  clientId.ts                # portal-wide Client ID (CSC-YYYY-####) generation/lookup
  theme.ts                   # brand theme switcher (persisted to localStorage)
  currentUser.tsx            # CurrentUserContext + useCurrentUser()
  exportSheet.ts             # dependency-free CSV export (downloadSheet())
  reportPeriod.ts            # shared Today/7d/30d/6m/1y/All Time filter options
  counselorStatus.ts        # shared availability badge + sort logic for counselors (no caseload cap)
  validation.ts             # shared email/password regexes + isValidEmail()
  dateFilter.ts              # shared matchesDateRange() for date-range filters
  dateTime.ts                # shared parseSubmittedAt() / dateKey() / formatWait()
  branchLiveStats.ts         # computeBranchLiveStats()/computeBranchOverviewStats()/computeCompanyOverviewStats()
  notifications.ts           # notification factories, formatRelativeTime(), isNotificationVisibleTo()
  lib/
    supabaseClient.ts         # Supabase client, initialized from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
    counselorStudentsApi.ts   # fetch/update counselor_students table (camelCase <-> snake_case mapping)
    studentsApi.ts             # fetch/insert/update students table
    counselorsApi.ts           # fetch/insert/update/delete counselors table
    applicationsApi.ts         # fetch/update/insert applications table
    staffApi.ts                  # fetch/insert/update/delete staff table
    branchesApi.ts               # fetch/insert/update/delete branches table
    notificationsApi.ts          # fetch/insert/delete notifications table, mark one/many read
    commissionsApi.ts             # fetch/update commissions table (no add/delete UI exists)
    partnersApi.ts                 # fetch/insert/update/delete partners table
    realtimeSubscribe.ts         # subscribeToTable() — INSERT/UPDATE/DELETE -> re-fetch, for live cross-session sync
  components/
    Login.tsx                  # credential login + "continue without a password" role picker
    DashboardShell.tsx          # sidebar/topbar layout wrapper — theme switcher, Options modal, renders NotificationBell
    NotificationBell.tsx        # shared bell + dropdown, incl. broadcast-lead claim, used by all roles
    OverviewPage.tsx / BranchManagerOverview.tsx / SuperAdminOverview.tsx / ReceptionistOverview.tsx /
      CounselorOverview.tsx / ApplicationOfficerOverview.tsx / MarketingOverview.tsx
    AllBranches.tsx             # branch CRUD (add/delete branch)
    NewIntakeForm.tsx           # public intake form (/intake route) — also embedded for New Intake / Add Lead
    StudentList.tsx / StudentProfile.tsx / StudentDetailDrawer.tsx / AssignCounselorModal.tsx / AssignCounselorPage.tsx
    AssignedClientsPage.tsx / VisitorsPage.tsx     # front desk: assigned clients, revisit logging
    MyStudents.tsx / CounselorClientsPage.tsx / ConsultationsPage.tsx / FollowUpsPage.tsx / ArchivePage.tsx
    ClientProfile.tsx           # full editable client record (largest component, ~48KB) — gated by canEditClientProfile()
    ApplicationsList.tsx / ApplicationDetailDrawer.tsx / StatusUpdatesKanban.tsx / EnrolledQueuePage.tsx
    MarketingOverview.tsx / MarketingBroadcastPage.tsx / MarketingClientsPage.tsx   # lead gen + blind branch broadcast/claim
    PartnersPage.tsx             # college/university partners, courses, commission rates
    CommissionsPage.tsx
    StaffManagement.tsx / StaffActivityPanel.tsx
    ReportsPage.tsx
    GreetingBanner.tsx / DateRangeFilter.tsx / CompactDateRangeFilter.tsx / PeriodFilter.tsx   # shared UI bits
    ComingSoon.tsx              # placeholder for unbuilt nav items
```

~14,300 lines of TypeScript/TSX across ~50 files in `src/` (flat `components/` directory, no nested feature folders).

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, `eslint.config.js`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run preview` — preview a production build

## Notable gaps / likely next steps

- **Auth bypass**: `Login.tsx`'s "Continue without a password" role picker logs anyone into any role with zero credentials — this needs to be removed or gated before any real deployment, on top of the pre-existing plaintext-password/no-session-layer issue.
- No routing library: page/view switching is manual `activeKey` string matching, and `/intake` detection is a raw `window.location.pathname` check.
- `App.tsx` is a large, growing monolith (~810 lines and rising) with every handler and cross-cutting `useMemo` in one file — worth watching as the marketing/pipeline features keep expanding it.
- Several nav items likely render `ComingSoon` (placeholder) — check `NAV_CONFIG` vs. `renderPage()` in `App.tsx` for which keys aren't implemented yet.
- No test setup (no test runner/config present).
- `npm run lint` currently crashes on every file (`TypeError: Cannot read properties of undefined (reading 'allowShortCircuit')` inside `@typescript-eslint/no-unused-expressions`) — a pre-existing dependency version mismatch between the installed `eslint@9.39.5` and `typescript-eslint@^8.3.0` in `package.json`/`package-lock.json`, not caused by any specific file. `npm run typecheck` and `npm run build` are unaffected and both pass. Worth a `npm install`/lockfile refresh or pinning compatible versions.
