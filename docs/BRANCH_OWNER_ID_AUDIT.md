# Branch / Owner ID Audit (Phase G)

Inventory only — **no columns are changed by this document or by anything in
this pass.** Every `branch`/owner-style column below is `text` holding a
**name**, not a foreign key. This is what makes the current RLS migrations
(`2026-09-27-rls-lockdown.sql` etc.) compare by string equality instead of a
join to `branches.id` / `staff.id`.

Two independent problems, tracked separately:
1. **Branch identity** — every `branch` column should be `branch_id uuid
   references branches(id)`.
2. **Owner/actor identity** — every "who did this" column should be a `uuid
   references staff(id)` instead of a staff **name** string.

Both share the same risk: a rename (branch renamed in `branches.name`, staff
member renamed in `staff.name`) does **not** cascade to historical rows,
because nothing links them by id. Today this is latent (branch/staff names
in this project rarely change), but it's a real correctness gap, and it's
exactly the "do not use names as relationships" absolute rule the security
brief calls out.

## Migration risk legend
- **Low** — one or two call sites, no cross-table name-matching depends on it.
- **Medium** — several call sites and/or one join elsewhere keyed on the name.
- **High** — many call sites, and/or other tables join to this column by name
  (a `branch_id` swap here requires touching every join partner in the same
  migration or breaking them).

## Branch identity

| Table | Column | Current type | Example | Should become | Migration risk | Dependent code |
|---|---|---|---|---|---|---|
| staff | branch | text | `"Kamaladi"` | `branch_id uuid` | **High** — every RLS policy's `same_branch()` check, `admin-staff` Edge Function's branch-scope check, StaffManagement.tsx, every other table's branch column is only meaningful relative to this one |
| branches | (identity itself) | `id text` PK | `"b1790500820980"` | keep `id`, but consider `uuid` instead of app-generated text | Low on its own, but every FK above points here |
| branches | manager | text (a staff **name**) | `"Jane Doe"` | `manager_id uuid references staff(id)` | Low — only `AllBranches.tsx` reads it for display |
| students | branch | text | `"Kamaladi"` | `branch_id uuid` | **High** — RLS, StudentList, AssignCounselorModal, branchLiveStats.ts |
| applications | branch | text | `"Kamaladi"` | `branch_id uuid` | **High** — RLS, ApplicationsList, superAdmin.ts DATASETS, receipt/finance calcs |
| fin_transactions | branch | text | `"Kamaladi"` | `branch_id uuid` | **High** — RLS, every finance view, `record_payment()` RPC (this migration) |
| expense_requests | branch | text | `"Kamaladi"` | `branch_id uuid` | Medium |
| commissions | branch | text | `"Kamaladi"` | `branch_id uuid` | Low |
| attendance | branch | text | `"Kamaladi"` | `branch_id uuid` | Medium |
| attendance_corrections | branch | text | `"Kamaladi"` | `branch_id uuid` | Medium |
| attendance_explanations | branch | text | `"Kamaladi"` | `branch_id uuid` | Medium |
| leave_records | branch | text | `"Kamaladi"` | `branch_id uuid` | Medium |
| pay_profiles | branch | text (part of composite PK `staff_name,branch`) | `"Kamaladi"` | `branch_id uuid` (and the PK itself needs rework — see below) | **High** — no surrogate id at all on this table today |
| payroll_runs | branch | text | `"Kamaladi"` | `branch_id uuid` | Medium |
| performance_reviews | branch | text | `"Kamaladi"` | `branch_id uuid` | Medium |
| onboarding_cases | branch | text | `"Kamaladi"` | `branch_id uuid` | Low |
| offboarding_cases | branch | text | `"Kamaladi"` | `branch_id uuid` | Low |
| tasks | branch | text | `"Kamaladi"` | `branch_id uuid` | Medium — Daily Task Board filters by this everywhere |
| it_tickets | branch | text | `"Kamaladi"` | `branch_id uuid` | Low |
| branch_notices | branch | text | `"Kamaladi"` | `branch_id uuid` | Low |
| branch_issues | branch | text | `"Kamaladi"` | `branch_id uuid` | Low |
| branch_day_logs | branch | text | `"Kamaladi"` | `branch_id uuid` | Low |
| branch_content_requests | branch | text | `"Kamaladi"` | `branch_id uuid` | Low |
| marketing_support_requests | branch | text | `"Kamaladi"` | `branch_id uuid` | Low |
| marketing_pings | branch | text | `"Kamaladi"` | `branch_id uuid` | Low |
| marketing_content_requests | target_branch | text | `"Kamaladi"` | `target_branch_id uuid` | Low |
| branch_transfers | from_branch, to_branch | text (×2) | `"Kamaladi"` | `from_branch_id`, `to_branch_id uuid` | Medium — RLS reads both via `in (from_branch, to_branch)` |
| holidays | applies_to | `text` — either the literal `'All'` or an array of branch **names** | `"All"` or `{"Kamaladi","Baneshwor"}` | keep the `'All'` sentinel, but replace the array with `branch_id[]` | Low |
| counselor_students | *(none)* | — | — | needs a new `branch_id` column (currently has **no branch column at all** — every RLS check in this pass joins to `staff` on `assigned_counselor = staff.name` to get it) | **High** — adding the column is easy; backfilling it correctly requires the owner-identity fix below to happen first (you need a reliable counselor→staff→branch link) |
| counselors | *(none)* | — | — | this table has no branch column either, and largely duplicates `staff` (see docs/DATABASE_AUDIT.md P3) — the real fix may be retiring this table, not adding a column to it | Medium |

## Owner / actor identity (staff name → staff id)

Grouped by table; only the columns are listed per row, not repeated commentary.

| Table | Column(s) | Current type | Example | Should become | Migration risk | Dependent code |
|---|---|---|---|---|---|---|
| students | assigned_counselor, added_by, claimed_by | text | `"Ram Sharma"` | `*_id uuid references staff(id)` | **High** — assigned_counselor is the join key `counselor_students` RLS uses to reach `staff.branch` |
| counselor_students | assigned_counselor, added_by | text | `"Ram Sharma"` | `assigned_counselor_id uuid` | **High** — same reason, plus it's this table's *only* path to branch scoping today |
| applications | counselor, added_by | text | `"Ram Sharma"` | `counselor_id uuid` | **High** — RLS `applications_select` for the `counselor` role matches on this |
| fin_transactions | by, counselor, decided_by, processed_by | text | `"Ram Sharma"` | `*_id uuid` | **High** — the new immutability trigger (this pass) reads `by`/`decided_by` for the no-self-approval check; an id swap must preserve that check |
| expense_requests | requested_by, decided_by | text | `"Ram Sharma"` | `*_id uuid` | Medium |
| attendance | staff_name | text | `"Ram Sharma"` | `staff_id uuid` | **High** — this is the row's entire identity (`unique(staff_id,date)` per docs/DATABASE_AUDIT.md is aspirational; today it's `unique` on the name if enforced at all) |
| attendance_corrections | staff_name, requested_by, decided_by | text | `"Ram Sharma"` | `*_id uuid` | Medium |
| attendance_explanations | staff_name, requested_by, submitted_by, reviewed_by | text | `"Ram Sharma"` | `*_id uuid` | Medium |
| leave_records | staff_name, decided_by | text | `"Ram Sharma"` | `*_id uuid` | Medium |
| pay_profiles | staff_name (half of the PK) | text | `"Ram Sharma"` | `staff_id uuid` as the real PK, replacing the composite `(staff_name, branch)` key entirely | **High** — most sensitive table, and the only one with no surrogate key today |
| payroll_runs | submitted_by, processed_by | text | `"Ram Sharma"` | `*_id uuid` | Low |
| performance_reviews | staff_name, reviewed_by | text | `"Ram Sharma"` | `*_id uuid` | Medium |
| onboarding_cases / offboarding_cases | created_by, employee_name | text | `"Ram Sharma"` | `*_id uuid` | Low |
| tasks | assignee, created_by, updated_by | text | `"Ram Sharma"` | `*_id uuid` | Medium — `assignee` can also be `'Anyone'` or a role name, not always a staff name, complicating a clean FK |
| it_tickets | raised_by, assignee | text | `"Ram Sharma"` | `*_id uuid` | Low — `assignee` is described as "IT engineer" but is really free text (see Phase A/B findings — no IT role exists) |
| communication_logs | logged_by | text | `"Ram Sharma"` | `logged_by_id uuid` | Low |
| branch_transfers | from_counselor, to_counselor, requested_by, decided_by | text | `"Ram Sharma"` | `*_id uuid` | Medium |
| branch_notices | posted_by | text | `"Ram Sharma"` | `posted_by_id uuid` | Low |
| branch_issues | reported_by, owner | text | `"Ram Sharma"` | `*_id uuid` | Low |
| branch_day_logs | opened_by, closed_by | text | `"Ram Sharma"` | `*_id uuid` | Low |
| branch_content_requests | requested_by | text | `"Ram Sharma"` | `requested_by_id uuid` | Low |
| marketing_support_requests | requested_by | text | `"Ram Sharma"` | `requested_by_id uuid` | Low |
| marketing_content_requests | target_counselor, requested_by, delegated_by, submitted_by | text | `"Ram Sharma"` | `*_id uuid` | Medium — `target_counselor` is a cross-department join key (branch counselor ↔ marketing) |
| marketing_leads | qualified_by, assigned_by | text | `"Priya K."` | `*_id uuid` | Low |
| marketing_campaigns / ad_spend / content_items / design_tasks / video_tasks / posts / seo_tasks | created_by / logged_by / assignee / requested_by (varies) | text | `"Priya K."` | `*_id uuid` | Low — marketing-internal only, no cross-table name joins |
| marketing_pings | by | text | `"Priya K."` | `by_id uuid` | Low |
| audit_log | by | text | `"Ram Sharma"` | `actor_id uuid` | Low — append-only, so a swap only affects future rows unless backfilled |
| service_prices | set_by | text | `"Super Admin"` | `set_by_id uuid` | Low |
| holidays | created_by | text | `"Super Admin"` | `created_by_id uuid` | Low |
| notifications | recipient_name, actor_name | text | `"Ram Sharma"` | `*_id uuid` | Medium — RLS `notifications_select` mirrors `isNotificationVisibleTo()`'s name comparison exactly; an id swap must keep that predicate correct |
| counselors | name | text | `"Ram Sharma"` | this table should probably be retired in favor of a view over `staff` (see docs/DATABASE_AUDIT.md P3 — it already duplicates `staff`) rather than patched | **High** — touches every "counselor roster" screen |

## Why this isn't being done now

- **Blast radius**: every one of the ~90 columns above has at least one
  read/write site in `src/lib/**/*Api.ts` plus UI code that displays the name
  directly (tables render "Ram Sharma", not a resolved id) — a real migration
  touches most of the ~50 files in `src/`, which is explicitly out of scope
  ("do not redesign the frontend") for a security-hardening pass.
- **`counselor_students` and `counselors` have no branch column to migrate
  yet** — step one there is *adding* a column, which is more invasive than
  changing an existing column's type, and depends on the owner-identity fix
  landing first (you need `assigned_counselor_id` before you can reliably
  backfill `branch_id` through it).
- **`pay_profiles` has no surrogate key at all** — this one probably can't be
  a small, additive migration; it likely needs a new table shape, which is
  the highest-risk single item in this list.
- **Correctness today is "good enough"** because branch/staff renames are rare
  in practice — this is a latent gap, not an active exploit path. The RLS
  lockdown already closes the actual access-control hole (who can read/write
  what) using name-equality, which is sound as long as names stay unique,
  which `branches.name` and `staff.name` are today (not enforced by a unique
  constraint, but true in practice).

## Recommended migration order, if/when this is undertaken
1. `staff.branch` → `staff.branch_id` first (everything else hangs off it).
2. Backfill an `*_id` sibling column on every table above **without dropping
   the text column yet** — write to both from the app for one release, verify
   they agree, then drop the text column in a second migration.
3. Owner/actor columns next, table by table, starting with `fin_transactions`
   and `pay_profiles` (highest sensitivity), ending with the marketing-only
   tables (lowest risk, no cross-table joins).
4. Retire `counselors` as a standalone table in favor of a view, last.

Not started. No columns changed.
