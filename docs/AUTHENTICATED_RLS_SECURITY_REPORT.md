# Authenticated RLS + Security Matrix Validation

Live, authenticated testing against the real Supabase project, done via direct REST/RPC calls
(never the UI) using 12 throwaway test accounts created and destroyed for this pass. Every
result below is an actual observed HTTP response, not an inference from reading policy SQL.
Test accounts, test branches, and all fixture data have been deleted; the database is
verified back to exactly the pre-existing real `staff`/`branches` rows. Five test
`fin_transactions` rows could not be deleted (immutability trigger applies to every caller,
including the service role) and were voided in place instead, clearly tagged
`"reason":"security test cleanup - not a real transaction"`.

**Migrations this phase produced, in apply order** (all already applied and re-verified live):
1. `2026-09-27-counselor-isolation-fix.sql` — P0 fix
2. `2026-09-27-marketing-branch-leak-fix.sql` — P0 fix
3. `2026-09-27-fin-trigger-column-quoting-fix.sql` — bug fix (trigger was non-functional)
4. `2026-09-27-record-payment-audit-fix.sql` — bug fix (RPC was non-functional)

---

## A. Executive Security Summary

| Area | Status |
|---|---|
| Overall RLS status | **PASS WITH FINDINGS** — two P0s found live, fixed, and re-verified closed; no known open P0s remain |
| Authentication | PASS — all 11 accounts authenticated correctly; identity/role/branch/marketing-sub-role mapping was correct for all 11; deactivation revokes access in real time even against an unexpired JWT |
| Branch isolation | PASS (after fix) — `staff`, `students`, `counselor_students`, `applications`, `fin_transactions` all independently verified; the marketing-placeholder-branch leak (below) was a distinct bug from branch isolation itself and is now closed |
| Counselor isolation | PASS (after fix) — was a confirmed P0 (peer counselor could read+write another counselor's client) until fixed and re-verified this session |
| Finance protection | PASS (after fix) — the immutability trigger and `record_payment()` RPC were **both non-functional** (unrelated SQL bugs) until fixed live this session; now fully verified: core fields immutable, delete blocked, self-approval blocked, receipt numbering collision-safe, negative amounts rejected, branch-spoofing rejected |
| Marketing sub-role security | PASS (after fix) — sub-role differentiation (Manager/Leads/Content/Graphics) verified correct; the branch-placeholder leak that let Graphics Designer read `fin_transactions`/`tasks`/`it_tickets` is closed |
| Anonymous access | PASS — read, write, and RPC all independently re-verified blocked after every migration in this phase |
| Audit protection | PASS (partial) — Super Admin-only read confirmed, non-admin read/write denied confirmed, RPC-driven entries confirmed written correctly; **broader audit coverage (role changes, non-RPC finance edits) was not independently exercised this pass** — audit_log only ever gets a row when something explicitly inserts one, and the only insert paths tested were `record_payment()` and the pre-existing Super Admin override path |
| Production readiness | **NOT READY** — this phase closed the RLS/finance-integrity gaps it targeted, but branch/owner text-vs-uuid identity (docs/BRANCH_OWNER_ID_AUDIT.md), the still-live `"Finance"` dead-end role option in Staff Management, and several sections below marked "not independently tested" remain open |

---

## B. Authenticated RLS Matrix

ALLOW = confirmed via a successful live request. DENY = confirmed via a live request that was
rejected (empty result / RLS error / RPC error). N/A = role does not exist in this codebase.

| Role | Own Data | Same Branch | Other Branch | Finance | HR | Marketing | System (audit/staff writes) |
|---|---|---|---|---|---|---|---|
| Super Admin (T01) | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW (read) | ALLOW |
| Branch Manager (T02/T03) | ALLOW | ALLOW | DENY | ALLOW (own branch; amend/void restricted to this role) | ALLOW (own branch; cannot self-edit own pay_profile) | DENY | DENY (cannot self-promote or create a Super Admin) |
| Counselor (T04/T05) | ALLOW | LIMITED (own clients only, not peers' — see Defect #1) | DENY | LIMITED (can create Charge/Payment/Exception rows in own branch; cannot amend/delete any) | DENY (except own attendance row) | DENY | DENY |
| Front Desk (T06) | ALLOW | ALLOW (students/applications/counselor_students, branch-wide) | DENY | LIMITED (can create Payment rows; cannot delete, void, approve, or amend) | DENY | DENY | DENY |
| V/A Officer (T07) | ALLOW | ALLOW (branch-wide applications, not owner-restricted) | DENY | LIMITED (can create Charge rows; cannot amend/delete existing) | DENY | DENY | DENY |
| Marketing Manager (T08) | ALLOW | N/A (branch-less by design) | N/A | DENY | DENY | ALLOW (full domain) | DENY |
| Leads Specialist (T09) | ALLOW | N/A | N/A | DENY | DENY | LIMITED (leads/pings only) | DENY |
| Content Planner (T10) | ALLOW | N/A | N/A | DENY | DENY | LIMITED (content/coordination only) | DENY |
| Graphics Designer (T11) | ALLOW | N/A | N/A | DENY | DENY | LIMITED (design/video/posts only) | DENY |
| Finance | N/A — no such role in `src/types.ts` `Role` union; finance operations are distributed across Branch Manager/Front Desk/Counselor/V-A-Officer/Super Admin (see docs/ROLE_PERMISSION_AUDIT.md) | | | | | | |
| IT | N/A — no such role exists; `it_tickets` is readable/writable by any staff member in the ticket's own branch, with no concept of "the IT department" (see Defect Register #7, non-blocking) | | | | | | |
| Customer Service | N/A — no such role exists in this codebase | | | | | | |

---

## C. Cross-Branch Matrix (actual tested results)

| Table | Own branch read | Other branch read | Own branch write | Other branch write |
|---|---|---|---|---|
| `staff` | PASS | PASS (DENY confirmed both directions, T02↔T03) | PASS | N/A not attempted (read isolation already conclusive) |
| `students` | PASS | PASS (DENY, both list and direct-by-id) | PASS | PASS (DENY — UPDATE and DELETE both, 0 rows affected) |
| `counselor_students` | PASS | N/A (no second branch fixture with an assigned counselor) | PASS | N/A |
| `applications` | PASS | PASS (DENY) | PASS | N/A not attempted (read isolation already conclusive) |
| `fin_transactions` | PASS | PASS (DENY) | PASS | N/A not attempted |

---

## D. Counselor Ownership Matrix (actual tested results)

| Test | Expected | Actual (first run) | Actual (after fix) | Result |
|---|---|---|---|---|
| Counselor A reads own student | Allowed | Allowed | Allowed | PASS |
| Counselor A reads Counselor B's student | Denied | **Allowed — read T05's client, id `sectest-student-b`** | Denied (empty) | **FAIL → FIXED, re-tested PASS** |
| Counselor A updates own permitted record | Allowed | Allowed | Allowed | PASS |
| Counselor A updates Counselor B's record | Denied | **Allowed — successfully wrote `consultation_notes: "hijacked by T04"` into T05's client row** | Denied (0 rows updated) | **FAIL → FIXED, re-tested PASS** |
| Counselor A reads Branch B student | Denied | Denied | Denied | PASS |
| Counselor A modifies finance (amend existing txn) | Denied | Denied | Denied | PASS |
| Branch Manager (own branch) still sees both counselors' clients | Allowed | — | Allowed | PASS (fix didn't overcorrect) |
| Front Desk / V-A Officer (own branch) still see both counselors' clients | Allowed | — | Allowed | PASS (fix didn't overcorrect) |

---

## E. Marketing Sub-Role Matrix (actual tested results)

ALLOW/DENY reflect live requests. Cells marked "not tested" had no fixture created for that
exact resource this pass, not a confirmed pass or fail.

| Resource | Marketing Manager | Leads Specialist | Content Planner | Graphics Designer |
|---|---|---|---|---|
| Marketing Leads | ALLOW (tested) | ALLOW (tested) | DENY (tested) | DENY (tested) |
| Marketing Pings | not independently tested (same policy shape as Leads, high confidence) | not independently tested | N/A by design | N/A by design |
| Campaigns / Ad Spend / SEO (manager-only tier) | ALLOW (tested — created a campaign) | not tested | DENY (tested — rejected) | not tested |
| Content Requests / Items | ALLOW by design (untested this pass) | N/A by design | ALLOW by design (untested this pass) | read-only on Content Items by design (untested this pass) |
| Design Queue / Video / Posts | ALLOW (tested — Manager reads Designer's task) | DENY (tested — rejected) | N/A by design (untested) | ALLOW (tested — created a design task) |
| Student Private Data (`students`, `counselor_students`, `applications`) | DENY (tested) | DENY (tested) | not independently tested (same `not is_marketing()` guard, high confidence) | DENY (tested) |
| Finance (`fin_transactions`) | not independently tested (same guard as Graphics Designer's confirmed-fixed case) | not independently tested | not independently tested | **DENY — was ALLOW before fix, confirmed FAIL then confirmed FIXED** |
| HR (`attendance`, `pay_profiles`) | not independently tested | not independently tested | not independently tested | DENY (tested) |
| Branch Operations (`tasks`, `it_tickets`) | not independently tested | not independently tested | not independently tested | **DENY — was ALLOW before fix, confirmed FAIL then confirmed FIXED** |

---

## F. Finance Security Results

| Test | Expected | Actual | Result |
|---|---|---|---|
| UPDATE amount on existing transaction (Super Admin) | Denied | First attempt: trigger crashed with a SQL error (`record "new" has no field "by"`) instead of cleanly denying — meant the immutability trigger was **not functioning at all**, on any UPDATE, for anyone. Fixed (column quoting). Re-tested: denied with a clear `23514` message. | **FAIL → FIXED → PASS** |
| UPDATE client_id / receipt_no on existing transaction | Denied | Same root cause; denied cleanly after fix | PASS (after fix) |
| DELETE a transaction | Denied | Denied (0 rows; no delete policy exists for any role) | PASS |
| Legitimate metadata-only void (status/void fields) | Allowed | Failed with the same trigger bug before the fix; succeeded cleanly after, core fields (amount, etc.) unchanged | PASS (after fix) |
| Self-approval (requester = approver) | Denied | Denied — `"the requester (SECTEST T02 BranchMgrA) cannot approve or reject their own request"` | PASS |
| Third-party approval (different approver) | Allowed | Allowed | PASS |
| Direct manipulation of `receipt_counters` | Denied | Denied (read: empty; write: `42501` RLS violation) — table has zero policies, default-deny for every role | PASS |
| `record_payment()` — authorized role, valid input | Success, receipt issued | First attempt failed (`audit_log.from_value` NOT NULL violation) — RPC was **completely non-functional**. Fixed. Re-tested: succeeded, receipt `RCT-SEC-2026-000001` | **FAIL → FIXED → PASS** |
| `record_payment()` — sequential calls, no collision | Distinct receipt numbers | `000001` then `000002` on immediate consecutive calls | PASS |
| `record_payment()` — unauthorized role (Marketing) | Denied | Denied — `"Role marketing is not permitted to record financial transactions"` | PASS |
| `record_payment()` — negative amount | Denied | Denied — `"Amount must be zero or a positive number"` | PASS |
| `record_payment()` — branch spoofing (non-admin specifying another branch) | Denied | Denied — `"Cannot record a transaction for another branch"` | PASS |
| `record_payment()` — audit record created | An audit_log row exists for the payment | Confirmed via Super Admin read: `record: "fin_transactions:fin...", field: "create", reason: "record_payment RPC"` | PASS |
| Concurrent payment collision | Not tested — the atomic `INSERT...ON CONFLICT DO UPDATE...RETURNING` pattern used is a standard, race-safe Postgres idiom (the row lock during the UPDATE prevents two backends from reading the same `next_no`), but no actual concurrent/parallel request pair was fired this session to observe it under real contention | Not independently load-tested | **NOT TESTED** |

---

## G. Direct API Bypass Results

Every one of these was a direct authenticated REST/RPC call, never the UI.

| # | Attempt | Result |
|---|---|---|
| 1 | Branch Manager A reads Branch B student by direct id | DENIED |
| 2 | Branch Manager A updates/deletes Branch B student by direct id | DENIED (both) |
| 3 | Branch Manager B reads Branch A applications | DENIED |
| 4 | Counselor A reads/updates peer Counselor B's client by direct id | **ALLOWED (P0 bug) → fixed → DENIED** |
| 5 | Front Desk deletes a payment it created | DENIED |
| 6 | Front Desk voids/amends a payment it created | DENIED |
| 7 | Front Desk approves its own (well, anyone's) discount | DENIED — role not permitted to decide at all |
| 8 | V-A Officer amends an existing payment | DENIED |
| 9 | V-A Officer creates a new charge | ALLOWED (matches documented intended behavior, not a bug) |
| 10 | Graphics Designer reads `fin_transactions` | **ALLOWED (P0 bug) → fixed → DENIED** |
| 11 | Graphics Designer reads `tasks` / `it_tickets` | **ALLOWED (same bug) → fixed → DENIED** |
| 12 | Graphics Designer reads `students` | DENIED (this one was correctly scoped from the start) |
| 13 | Leads Specialist reads design/video tasks | DENIED |
| 14 | Content Planner creates a marketing campaign (manager-only tier) | DENIED |
| 15 | Any non-Super-Admin reads `audit_log` | DENIED |
| 16 | Any non-Super-Admin writes/tampers `audit_log` | DENIED (no update policy exists) |
| 17 | Direct read/write of `receipt_counters` | DENIED (both) |
| 18 | Branch Manager promotes self to Super Admin | DENIED |
| 19 | Branch Manager creates a new Super Admin staff row | DENIED |
| 20 | Anonymous (no session) read of `staff`/`fin_transactions` | DENIED |
| 21 | Anonymous write (INSERT) | DENIED (`401`) |
| 22 | Anonymous call to `record_payment()` RPC | DENIED (`28000`, caught inside the function itself) |

---

## H. Authentication Results

All 11 primary test accounts (T01–T11) plus the one-off escalation test account:

| Account | Auth user created | Signed in successfully | `staff` row resolves via `auth_user_id = auth.uid()` | Role/branch/marketing-role matched expected | 
|---|---|---|---|---|
| T01 Super Admin | YES | YES | YES | YES |
| T02 Branch Manager A | YES | YES | YES | YES |
| T03 Branch Manager B | YES | YES | YES | YES |
| T04 Counselor A1 | YES | YES | YES | YES |
| T05 Counselor A2 | YES | YES | YES | YES |
| T06 Front Desk | YES | YES | YES | YES |
| T07 V/A Officer | YES | YES | YES | YES |
| T08 Marketing Manager | YES | YES | YES | YES |
| T09 Leads Specialist | YES | YES | YES | YES |
| T10 Content Planner | YES | YES | YES | YES |
| T11 Graphics Designer | YES | YES | YES | YES |

No authentication or identity-mapping failure occurred for any account — nothing was skipped
per the "stop that user's downstream testing" rule.

**Edge cases tested:**
- Deactivated staff, still-valid JWT: all data access immediately denied (`counselor_students` returned empty); own `staff` row remained readable showing `status:"Inactive"` (benign — no cross-user data, just confirms their own deactivation to them). PASS.
- Anonymous (no `Authorization`, or anon-key-as-bearer): denied everywhere. PASS.

**Edge cases NOT tested this pass** (flagging rather than guessing): expired session (would require waiting out a real token TTL or forging `exp`, neither attempted), missing employee record (an `auth.users` row with no matching `staff` row — the design should fail-closed since every `current_*()` helper returns NULL with no match, but not independently exercised), wrong/malformed role or branch text values written directly (bypassing the app's own `StaffRole` type checking).

---

## I. Audit Log Results

| Action tested | Audit record produced? | Actor/timestamp/record/reason captured? |
|---|---|---|
| `record_payment()` call (×2) | YES, automatically by the RPC | YES — actor (`by`), timestamp-derived id, `record` (`fin_transactions:<id>`), `field: "create"`, `reason: "record_payment RPC"` |
| Direct `fin_transactions` insert (not via RPC) | NO | The pre-existing app flows (Front Desk payments, counselor charges, discount/exception requests) write `fin_transactions` directly via `upsertFinTransaction()`, not through `record_payment()` — none of those paths write to `audit_log`. Only the Super Admin task-override path and the new RPC do. |
| Role change / branch change on `staff` | NO | No trigger or app code writes `audit_log` on a `staff` update — confirmed by inspection, not tested live (there was nothing to observe) |
| Non-admin attempting to read `audit_log` | Correctly denied | N/A |
| Non-admin attempting to write/alter `audit_log` | Correctly denied (no update policy) | N/A |

**Finding**: the docx's broader "audit sensitive actions: login, role changes, permission
changes, finance, approvals, data export, account activation" requirement is **not met** —
`audit_log` today only receives rows from the Super Admin override path and the new
`record_payment()` RPC. Every other financial mutation (discount/exception request, approval
decision, void, refund) currently produces zero audit trail. This is a pre-existing gap
(documented in docs/SECURITY_AUDIT.md item 4) that this phase did not close — record_payment()
audits its own inserts, but nothing else does. Not fixed here because closing it properly means
routing every finance write through an RPC (a frontend change) or adding triggers to every
finance/HR table (a larger, separate piece of work) — out of scope for "small, isolated fix."

---

## J. Defect Register

| ID | Severity | Module | Role | Test | Expected | Actual | Security Impact | Root Cause | Recommended Fix | Production Blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| DEF-01 | **P0** | `counselor_students` RLS | Counselor | Counselor A reading/writing Counselor B's client | Denied | **Allowed** — read and wrote a peer's client record | A counselor could read and silently alter another counselor's private client notes/status in the live app, via direct API, with no UI trace | The branch-wide fallback clause used `not is_marketing()` instead of an explicit role list, so any non-marketing role (including a peer counselor) matched it | Applied: `2026-09-27-counselor-isolation-fix.sql` — narrowed to `is_branch_manager() or is_receptionist() or is_application_officer()` | **Was YES — now FIXED and re-verified** |
| DEF-02 | **P0** | `fin_transactions`, `expense_requests`, `commissions`, `tasks`, `it_tickets`, `branch_notices`, `branch_issues`, `branch_day_logs`, `branch_transfers` RLS | Marketing (any sub-role) | Graphics Designer reading `fin_transactions` | Denied | **Allowed** — read all rows for the branch, including amounts | Any Marketing staff account can read/write branch finance, HR-adjacent ops, and IT tickets for whichever branch its placeholder `branch` column happens to equal — which for any Marketing account created by the real Super Admin today is `"Head Office"`, a real operating branch | Nine tables used a bare `same_branch(branch)` check without excluding Marketing, unlike `students`/`counselor_students`/`applications` which correctly excluded it | Applied: `2026-09-27-marketing-branch-leak-fix.sql` — added `and not is_marketing()` to every affected policy | **Was YES — now FIXED and re-verified. Very likely was already live-exploitable in production before this fix, independent of this test session's fixtures.** |
| DEF-03 | P1 | `fin_transactions_protect()` trigger | All | Any UPDATE to `fin_transactions`, including legitimate voids | Trigger enforces immutability rules | Trigger **crashed** on every single UPDATE with `record "new" has no field "by"`, meaning it neither correctly blocked bad updates nor allowed good ones — the immutability feature shipped in a completely broken state | PL/pgSQL failed to resolve the unquoted column reference `new.by`/`old.by` | Applied: `2026-09-27-fin-trigger-column-quoting-fix.sql` — quoted as `new."by"` | **Was YES (finance immutability entirely non-functional) — now FIXED and re-verified** |
| DEF-04 | P1 | `record_payment()` RPC | All authorized roles | Any call to `record_payment()` | Payment recorded, receipt issued | **Every call failed** with `audit_log.from_value` NOT NULL violation — the RPC was 100% non-functional as shipped | RPC passed `null` for `from_value` on a creation-type audit event; live schema requires NOT NULL there | Applied: `2026-09-27-record-payment-audit-fix.sql` — pass `''` instead of `null` | **Was YES (the only DB-controlled payment path didn't work at all) — now FIXED and re-verified** |
| DEF-05 | P2 | `audit_log` coverage | All | Discount/refund/exception decisions, direct `fin_transactions` writes, `staff` role/branch changes | Sensitive actions produce an audit trail | No audit row is produced for any of these — only `record_payment()` and the pre-existing Super Admin override path write to `audit_log` | No trigger or RPC wraps these mutation paths | Either route these writes through RPCs that audit themselves, or add `AFTER INSERT/UPDATE` triggers on the relevant tables | No (pre-existing gap, not a regression from this phase) |
| DEF-06 | P2 | `staffApi.ts` / `StaffManagement.tsx` | Super Admin (UI) | Selecting "Finance" as a new staff member's role | Either a working role or not offered | Creates a `staff.role = 'Finance'` value that has **no mapping** in `STAFF_ROLE_TO_ROLE` or this phase's RLS `current_staff()` CASE — the resulting account gets `app_role = NULL` and is denied by every policy, effectively creating a permanently locked-out account | Dead/incomplete UI option predating a "Finance" role decision that was never made (flagged as an open business decision in docs/ROLE_PERMISSION_AUDIT.md and docs/PRODUCTION_READINESS.md) | Business decision required: either formalize a Finance role end-to-end, or remove the dropdown option. Not fixed here — it's a frontend/business-model decision, not an isolated security fix. | No (doesn't grant access — it locks an account out; still worth fixing before someone hits it in practice) |
| DEF-07 | P2 | `it_tickets` RLS | (no IT role exists) | Any branch staff resolving/assigning a ticket | Only "IT" can resolve | Any active staff member in the ticket's branch can update status/assignee/resolution — there is no way to restrict this further because no IT role/table exists | No IT role in the codebase (confirmed, not assumed) | Business decision required (add an IT role, or accept branch-wide resolution as-is) | No |
| DEF-08 | P3 | `communication_logs` RLS | Any active staff | Reading another branch's/client's communication log entries | Branch/client-scoped | Scoped only to "any active staff, company-wide" — the table has no branch column and `client_key`'s exact join target across `students`/`counselor_students`/`applications` was never confirmed, so no tighter policy was written | Ambiguous schema (flagged, not guessed at) | Confirm what `client_key` actually references, then scope properly | No |

---

## K. Production Blockers

1. **Branch/owner identity is still name-based, not uuid-based** (docs/BRANCH_OWNER_ID_AUDIT.md) — a branch or staff rename silently orphans historical RLS-relevant relationships. Not exploitable today (names don't change often), but a real data-integrity risk before scaling.
2. **`audit_log` coverage is far short of the docx's requirement** (DEF-05) — most sensitive financial/approval actions produce no audit trail today.
3. **The "Finance" dead-end role option** (DEF-06) exists in the live Staff Management UI and will silently lock out any account created with it.
4. **Concurrent-payment collision behavior was never actually observed under real concurrency** (only sequential calls were tested) — the pattern used is a standard safe idiom, but this phase's own rules require testing, not assuming.

None of these are "RLS is open" issues — the RLS/finance work verified in this report holds.
They are the next layer down.

## L. Non-Blockers (P2/P3)

DEF-05, DEF-06, DEF-07, DEF-08 above, plus: the chunk-size build warning (pre-existing,
cosmetic), `tests/reports.test.ts` importing a deleted `src/devSeed` (pre-existing, unrelated
to this phase), and the several "not independently tested" cells in the matrices above where
the same already-verified policy pattern applies (documented, not hidden).

## M. Recommended Next Phase

In order:
1. Close DEF-05 (audit_log coverage) for at least the finance decision paths (discount/refund
   approve-reject, void) — these are the highest-value gaps given docx §18's emphasis.
2. Resolve DEF-06 (Finance role dead end) as a business decision, then implement whichever way
   it's decided.
3. Decide whether `record_payment()` should become the *only* path to create a `fin_transactions`
   row (requires a frontend change to call the RPC instead of `upsertFinTransaction()` — explicitly
   out of scope for this phase, needs to be its own approved piece of work).
4. Begin the branch/owner uuid migration per docs/BRANCH_OWNER_ID_AUDIT.md's recommended order,
   starting with `staff.branch_id`.
5. Actually load-test `record_payment()` under real concurrency (parallel requests) rather than
   relying on the idiom being theoretically safe.

**Not started, per instruction: UUID migration itself, production deployment, any unrelated
feature development.**
