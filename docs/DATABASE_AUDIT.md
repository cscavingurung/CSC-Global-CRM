# Database Audit

Source: `supabase/schema.sql` + `supabase/migrations/*.sql`, `src/lib/*Api.ts`, `src/types.ts`.

## What is actually in the database

| Table | Holds | Keys / constraints | Problems |
|---|---|---|---|
| `students` | Intake leads (walk-in & marketing) | `id text` PK | No FK to branch/counselor (stored as **names**); no uniqueness on phone/email → duplicate leads; `created_by` is a name. |
| `counselors` | Counselor roster (availability, countries) | `id text` PK | Duplicates `staff` (counselor rows exist in both); linked by name. |
| `counselor_students` | The same client after counselor assignment | `id` = `students.id` | No FK; `client_id` not unique (fixed forward — see migration below); jsonb notes/audit log. |
| `applications` | Offer attempts + visa case per client (jsonb) | `id` PK | `client_id` not unique/FK; offers & visa history in jsonb (no per-status history table); `country_pipeline`, `processing_offer_id` jsonb/text. |
| `staff` | Employees **incl. plaintext passwords** | `email unique` | P0: passwords; role/branch as free text; no `user_id`; no `created_by`/`updated_at`. |
| `branches` | Branch identity | `id` PK | Manager stored as a name. |
| `notifications` | In-app notifications | `id` PK | Recipient as name/role/branch strings. |
| `commissions` | Commission records | `id` PK | Branch/consultant as names. |
| `partners` | Institutions + courses + commission rate | `id` PK | — |
| `communication_logs` | Client call/email log | `id` PK | — |

**Everything else is not stored:** finance ledger, expenses, attendance, corrections, day logs, leave, holidays, performance reviews, pay profiles, payroll runs, onboarding/offboarding, tasks, issues, notices, marketing store (leads, campaigns, content, design/video tasks, posts, SEO), Branch Manager workspace (content/support requests, IT tickets, inter-branch transfers), Super Admin override log. These exist only in browser memory (see CRM_SYSTEM_AUDIT §B).

## Cross-cutting findings

| Severity | Finding |
|---|---|
| P0 | RLS enabled but every policy is `using (true) with check (true)` — see SECURITY_AUDIT. |
| P0 | Financial data not persisted at all. |
| P1 | IDs generated in the browser (`Date.now()`, 71 places) → collisions under concurrent use. Receipt numbers = "max + 1" in the browser → duplicates under concurrency. |
| P1 | Relationships by **name** (staff, counselor, branch, manager). Renames break history; same-name staff are indistinguishable. |
| P1 | No foreign keys anywhere → orphans possible (e.g. application whose client was deleted). |
| P1 | Client ID uniqueness not enforced (random IDs collided). Fixed in code; migration `2026-09-27-client-id-unique.sql` adds a unique index after duplicates are checked. |
| P2 | Status fields are free text (no check constraints / enums) — a typo creates an unknown state. |
| P2 | No `created_at` / `created_by` / `updated_at` / `updated_by` columns on most tables; history kept ad hoc in jsonb. |
| P2 | jsonb for offers and visa: fine for now, but reporting on offers/visa across clients needs full-table downloads. |
| P2 | Realtime re-fetches the entire table on every change (11 subscriptions); no pagination. |
| P3 | `counselors` duplicates part of `staff`. |

## Proposed schema to finish (not applied — needs Supabase Auth first)

Priority order, adapting to the current shapes in `src/types.ts` so the UI keeps working:

1. **Identity:** `staff.user_id uuid references auth.users`, `staff.branch_id`, drop `staff.password`. Add `branch_id` to every branch-scoped table (backfill from the name).
2. **Finance (one ledger, append-only):**
   - `services` — Service Master: `id, name, country (nullable), branch_id (nullable), default_fee numeric, currency default 'NPR', active, effective_from, effective_to`. **BUSINESS DECISION** for rows.
   - `client_services` — a service assigned to a client: `client_id, service_id, fee_snapshot, assigned_by, assigned_at, status (active/cancelled)`.
   - `fin_transactions` — mirrors `FinTransaction` (`kind` check in Charge/Payment/Refund/Discount/Exception), `client_id`, `branch_id`, `amount numeric check (amount > 0)`, `created_by`, `created_at`, approval columns; **no UPDATE except status via RPC, no DELETE** (void = new columns via RPC).
   - `receipt_counters` + RPC `record_payment()` that allocates the receipt number inside a transaction; `unique (receipt_no)`.
3. **HR:** `attendance (unique (staff_id, date))`, `attendance_corrections`, `leave_requests` (exclusion constraint against overlapping pending/approved leave per staff), `holidays`, `pay_profiles` (restricted), `payroll_runs`.
4. **Work:** one `tasks` table (title, description, creator, assignee, branch, department, related client/application/issue, due, priority, status, history) replacing the parallel task stores; `issues` + `issue_activity`; `approvals` view or table over request types.
5. **Audit:** `audit_log (actor_id, at, action, entity, record_id, before jsonb, after jsonb, reason)`, written by triggers on finance/approval/staff tables.
6. **Master data:** leave types & allowances, expense categories, payment methods, countries — only those the business wants configurable (see BUSINESS_RULES).
