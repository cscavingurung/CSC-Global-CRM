-- ============================================================================
-- P0 fix — Marketing staff leaking into branch-scoped finance/ops data via
-- their placeholder `branch` column.
--
-- Found during live authenticated RLS testing: Marketing accounts get an
-- arbitrary placeholder branch (whatever branch the admin who created them
-- was in — see src/components/StaffManagement.tsx's
-- `branch: isCompanyWide ? currentUser?.branch || '' : ...`), even though
-- marketing is conceptually branch-less. 2026-09-27-rls-lockdown.sql
-- correctly excluded Marketing from students/counselor_students/applications
-- with an explicit `and not is_marketing()` guard on the branch-match clause,
-- but the same guard was missing on fin_transactions, expense_requests,
-- commissions, tasks, it_tickets, branch_notices, branch_issues,
-- branch_day_logs and branch_transfers — every one of them used a bare
-- `same_branch(branch)` fallback.
--
-- Confirmed live: T11 (Graphics Designer, placeholder branch =
-- SECURITY_TEST_BRANCH_A) successfully read every row in fin_transactions
-- for that branch, including real amounts. Because this depends only on the
-- placeholder branch value coincidentally matching a real branch name — not
-- on anything test-specific — this is very likely already exploitable in
-- production today, for any Marketing account created under the same admin
-- branch as real operational data (e.g. "Head Office").
--
-- Fix: add `and not is_marketing()` to every bare same_branch() fallback
-- below, matching the pattern already used correctly on students/
-- counselor_students/applications. Tables where Marketing is INTENTIONALLY
-- granted cross-department access (branch_content_requests,
-- marketing_support_requests) are untouched — that access is deliberate,
-- not a coincidence-of-branch-value bug.
--
-- Safe to re-run.
-- ============================================================================

-- fin_transactions
drop policy if exists fin_transactions_select on public.fin_transactions;
create policy fin_transactions_select on public.fin_transactions for select
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists fin_transactions_insert on public.fin_transactions;
create policy fin_transactions_insert on public.fin_transactions for insert
with check (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

-- expense_requests
drop policy if exists expense_requests_select on public.expense_requests;
create policy expense_requests_select on public.expense_requests for select
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists expense_requests_insert on public.expense_requests;
create policy expense_requests_insert on public.expense_requests for insert
with check (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

-- commissions
drop policy if exists commissions_select on public.commissions;
create policy commissions_select on public.commissions for select
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

-- tasks
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert
with check (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()))
with check (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

-- it_tickets
drop policy if exists it_tickets_select on public.it_tickets;
create policy it_tickets_select on public.it_tickets for select
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists it_tickets_insert on public.it_tickets;
create policy it_tickets_insert on public.it_tickets for insert
with check (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists it_tickets_update on public.it_tickets;
create policy it_tickets_update on public.it_tickets for update
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()))
with check (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

-- branch_notices
drop policy if exists branch_notices_select on public.branch_notices;
create policy branch_notices_select on public.branch_notices for select
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists branch_notices_update on public.branch_notices;
create policy branch_notices_update on public.branch_notices for update
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()))
with check (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

-- branch_issues
drop policy if exists branch_issues_select on public.branch_issues;
create policy branch_issues_select on public.branch_issues for select
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists branch_issues_insert on public.branch_issues;
create policy branch_issues_insert on public.branch_issues for insert
with check (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists branch_issues_update on public.branch_issues;
create policy branch_issues_update on public.branch_issues for update
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()))
with check (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

-- branch_day_logs (insert/update were already correctly role-gated via
-- is_branch_manager() — only select needs this fix)
drop policy if exists branch_day_logs_select on public.branch_day_logs;
create policy branch_day_logs_select on public.branch_day_logs for select
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

-- branch_transfers (update was already correctly role-gated via
-- is_branch_manager() — select and insert need this fix)
drop policy if exists branch_transfers_select on public.branch_transfers;
create policy branch_transfers_select on public.branch_transfers for select
using (public.is_super_admin() or (public.current_branch() in (from_branch, to_branch) and not public.is_marketing()));

drop policy if exists branch_transfers_insert on public.branch_transfers;
create policy branch_transfers_insert on public.branch_transfers for insert
with check (public.is_super_admin() or (public.same_branch(to_branch) and not public.is_marketing()));
