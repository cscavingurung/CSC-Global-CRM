-- ============================================================================
-- CSC Global Portal — consolidated Supabase schema.
--
-- Concatenation of every migration under supabase/migrations/, in the order
-- each one actually depends on the last (not just filename/date order — several
-- same-day files fix or build on an earlier one; see each section's own header).
-- Run top to bottom against a fresh database to reach the current schema.
-- The original per-change migration files have been removed; git history still
-- has them if the individual change history is ever needed.
-- ============================================================================

-- ============================================================================
-- Source: supabase/migrations/2026-09-27-rls-lockdown.sql
-- ============================================================================
-- ============================================================================
-- RLS lockdown — Phase 4 of the backend security brief (Prompt/You are now
-- acting as the Senior Backend Architect....docx).
--
-- Context: every table currently has `for all using (true) with check (true)`
-- (see docs/SECURITY_AUDIT.md, docs/ROLE_PERMISSION_AUDIT.md) — the anon key
-- shipped in the browser bundle has full read/write on all 42 tables. This
-- migration replaces every permissive policy with role/branch-scoped ones
-- built on the app's REAL identity model, not the docx's aspirational one:
--
--   auth.users (Supabase Auth) --auth_user_id--> staff (role, branch, status)
--
-- Known, deliberate simplifications (see docs/DATABASE_AUDIT.md and the
-- anomalies this migration's own design pass turned up) carried forward
-- rather than fixed here, because fixing them is a separate migration:
--   - branch is a TEXT name on every table, not a branch_id uuid FK. Every
--     policy below compares branch by name. Renaming a branch in `branches`
--     will NOT cascade to historical rows — a known, pre-existing gap.
--   - "who owns this row" is a TEXT staff name (assigned_counselor, by,
--     created_by, staff_name, ...), not a uuid FK to `staff.id`. Same caveat.
--   - fin_transactions has no VOID/REVERSAL/ADJUSTMENT RPC yet — RLS here
--     restricts *who* can write it, but an authorized writer can still
--     upsert over an existing row's amount/kind. True immutability needs a
--     trigger or RPC (a later phase), not just RLS.
--   - Marketing sub-roles (Marketing Manager / Leads Specialist / Content
--     Planner / Graphics Designer) are NOT split apart here — `marketingRole`
--     isn't even persisted today (dropped by src/lib/staffApi.ts), so there is
--     nothing to gate on yet. Every `role = 'Marketing'` staff member gets the
--     same marketing-domain access this pass.
--   - There is no "Finance" or "IT" role in the frontend's Role type (see
--     docs/ROLE_PERMISSION_AUDIT.md — flagged as an open business decision).
--     Finance-table and IT-ticket access below is granted by branch
--     membership + Branch Manager/Super Admin, matching how the UI already
--     routes those features to the roles that actually exist today.
--
-- Safe to re-run: every statement is idempotent (`drop policy if exists` +
-- `create policy`, `create or replace function`, `enable row level security`
-- is itself idempotent).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Drop every existing policy on these tables first, whatever it's named.
--
-- The old permissive policies (`for all using (true)`) were created outside
-- this repo (schema.sql was empty) under unknown names. Postgres OR-combines
-- multiple permissive policies on the same table — so if an old `using(true)`
-- policy survives under a name this file doesn't know, it alone still grants
-- full access no matter how restrictive the new policies below are. Dropping
-- by name only (as every `drop policy if exists <name>` below does) can't
-- reach a policy whose name we don't know, hence this dynamic sweep first.
-- ----------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'staff','branches','students','counselors','counselor_students','applications',
        'notifications','partners','commissions','service_prices','audit_log',
        'fin_transactions','expense_requests','attendance','attendance_corrections',
        'attendance_explanations','holidays','leave_records','pay_profiles','payroll_runs',
        'performance_reviews','onboarding_cases','offboarding_cases','tasks','it_tickets',
        'communication_logs','branch_transfers','branch_notices','branch_issues',
        'branch_day_logs','branch_content_requests','marketing_support_requests',
        'marketing_leads','marketing_campaigns','marketing_ad_spend','marketing_content_requests',
        'marketing_content_items','marketing_design_tasks','marketing_video_tasks','marketing_posts',
        'marketing_seo_tasks','marketing_seo_keywords','marketing_pings'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 1. Identity helper functions
--
-- All SECURITY DEFINER + STABLE: they run as the function owner (bypassing
-- RLS on `staff`), which is what avoids the recursive-RLS trap the docx
-- warns about in §6 (a policy on `staff` that queries `staff` through a
-- non-SECURITY-DEFINER function would recurse into itself).
-- ----------------------------------------------------------------------------

create index if not exists idx_staff_auth_user_id on public.staff (auth_user_id);

-- One lookup of the caller's staff row, reused by every helper below.
-- Maps the DB's Title-Case StaffRole to the app's snake_case Role (see
-- src/mockData.ts STAFF_ROLE_TO_ROLE) so RLS speaks the same vocabulary as
-- the frontend's `Role` type.
create or replace function public.current_staff()
returns table (
  id text,
  name text,
  email text,
  staff_role text,
  app_role text,
  marketing_role text,
  branch text,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.email,
    s.role as staff_role,
    case s.role
      when 'Super Admin' then 'super_admin'
      when 'Marketing' then 'marketing'
      when 'Branch Manager' then 'branch_manager'
      when 'Front Desk Officer' then 'receptionist'
      when 'Counselor' then 'counselor'
      when 'V/A Officer' then 'application_officer'
      else null
    end as app_role,
    null::text as marketing_role, -- not persisted yet (see header note)
    s.branch,
    s.status
  from public.staff s
  where s.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_role() returns text
language sql stable security definer set search_path = public as $$
  select app_role from public.current_staff() where status = 'Active';
$$;

create or replace function public.current_branch() returns text
language sql stable security definer set search_path = public as $$
  select branch from public.current_staff() where status = 'Active';
$$;

create or replace function public.current_staff_name() returns text
language sql stable security definer set search_path = public as $$
  select name from public.current_staff() where status = 'Active';
$$;

create or replace function public.current_staff_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.current_staff() where status = 'Active';
$$;

create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.current_staff() where status = 'Active');
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable as $$ select public.current_role() = 'super_admin'; $$;

create or replace function public.is_branch_manager() returns boolean
language sql stable as $$ select public.current_role() = 'branch_manager'; $$;

create or replace function public.is_marketing() returns boolean
language sql stable as $$ select public.current_role() = 'marketing'; $$;

create or replace function public.is_counselor() returns boolean
language sql stable as $$ select public.current_role() = 'counselor'; $$;

create or replace function public.is_receptionist() returns boolean
language sql stable as $$ select public.current_role() = 'receptionist'; $$;

create or replace function public.is_application_officer() returns boolean
language sql stable as $$ select public.current_role() = 'application_officer'; $$;

-- true if a branch-name column on the row being checked matches the caller's
-- own branch. NULL-safe (a null branch column never matches).
create or replace function public.same_branch(row_branch text) returns boolean
language sql stable as $$ select row_branch is not distinct from public.current_branch() and row_branch is not null; $$;


-- ----------------------------------------------------------------------------
-- 2. Identity tables: staff, branches, counselors
-- ----------------------------------------------------------------------------

alter table public.staff enable row level security;

drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff for select
using (
  public.is_super_admin()
  or auth_user_id = auth.uid()
  or public.is_marketing()
  or public.same_branch(branch)
);

drop policy if exists staff_insert on public.staff;
create policy staff_insert on public.staff for insert
with check (
  public.is_super_admin()
  or (public.is_branch_manager() and public.same_branch(branch) and role <> 'Super Admin')
);

drop policy if exists staff_update on public.staff;
create policy staff_update on public.staff for update
using (
  public.is_super_admin()
  or (public.is_branch_manager() and public.same_branch(branch))
)
with check (
  public.is_super_admin()
  or (public.is_branch_manager() and public.same_branch(branch) and role <> 'Super Admin')
);

drop policy if exists staff_delete on public.staff;
create policy staff_delete on public.staff for delete
using (
  public.is_super_admin()
  or (public.is_branch_manager() and public.same_branch(branch) and role <> 'Super Admin')
);

alter table public.branches enable row level security;

drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches for select using (public.is_active_staff());

drop policy if exists branches_insert on public.branches;
create policy branches_insert on public.branches for insert with check (public.is_super_admin());

drop policy if exists branches_update on public.branches;
create policy branches_update on public.branches for update using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists branches_delete on public.branches;
create policy branches_delete on public.branches for delete using (public.is_super_admin());

alter table public.counselors enable row level security;

drop policy if exists counselors_select on public.counselors;
create policy counselors_select on public.counselors for select using (public.is_active_staff());

drop policy if exists counselors_insert on public.counselors;
create policy counselors_insert on public.counselors for insert with check (public.is_super_admin() or public.is_branch_manager());

drop policy if exists counselors_update on public.counselors;
create policy counselors_update on public.counselors for update
using (public.is_super_admin() or public.is_branch_manager())
with check (public.is_super_admin() or public.is_branch_manager());

drop policy if exists counselors_delete on public.counselors;
create policy counselors_delete on public.counselors for delete using (public.is_super_admin() or public.is_branch_manager());


-- ----------------------------------------------------------------------------
-- 3. Client pipeline: students, counselor_students, applications,
--    notifications, communication_logs, branch_transfers
-- ----------------------------------------------------------------------------

alter table public.students enable row level security;

drop policy if exists students_select on public.students;
create policy students_select on public.students for select
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists students_insert on public.students;
create policy students_insert on public.students for insert
with check (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists students_update on public.students;
create policy students_update on public.students for update
using (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()))
with check (public.is_super_admin() or (public.same_branch(branch) and not public.is_marketing()));

drop policy if exists students_delete on public.students;
create policy students_delete on public.students for delete
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

-- counselor_students has no branch column of its own — branch is derived by
-- joining assigned_counselor (a staff NAME) back to staff.branch.
alter table public.counselor_students enable row level security;

drop policy if exists counselor_students_select on public.counselor_students;
create policy counselor_students_select on public.counselor_students for select
using (
  public.is_super_admin()
  or assigned_counselor = public.current_staff_name()
  or (
    not public.is_marketing()
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and public.same_branch(s.branch)
    )
  )
);

drop policy if exists counselor_students_insert on public.counselor_students;
create policy counselor_students_insert on public.counselor_students for insert
with check (
  public.is_super_admin()
  or assigned_counselor = public.current_staff_name()
  or (
    not public.is_marketing()
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and public.same_branch(s.branch)
    )
  )
);

drop policy if exists counselor_students_update on public.counselor_students;
create policy counselor_students_update on public.counselor_students for update
using (
  public.is_super_admin()
  or assigned_counselor = public.current_staff_name()
  or (
    not public.is_marketing()
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and public.same_branch(s.branch)
    )
  )
)
with check (
  public.is_super_admin()
  or assigned_counselor = public.current_staff_name()
  or (
    not public.is_marketing()
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and public.same_branch(s.branch)
    )
  )
);

drop policy if exists counselor_students_delete on public.counselor_students;
create policy counselor_students_delete on public.counselor_students for delete
using (
  public.is_super_admin()
  or (
    public.is_branch_manager()
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and public.same_branch(s.branch)
    )
  )
);

alter table public.applications enable row level security;

drop policy if exists applications_select on public.applications;
create policy applications_select on public.applications for select
using (
  public.is_super_admin()
  or (public.same_branch(branch) and (public.is_branch_manager() or public.is_receptionist() or public.is_application_officer()))
  or (public.is_counselor() and counselor = public.current_staff_name() and public.same_branch(branch))
);

drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications for insert
with check (
  public.is_super_admin()
  or (public.same_branch(branch) and (public.is_branch_manager() or public.is_receptionist() or public.is_application_officer()))
  or (public.is_counselor() and counselor = public.current_staff_name() and public.same_branch(branch))
);

drop policy if exists applications_update on public.applications;
create policy applications_update on public.applications for update
using (
  public.is_super_admin()
  or (public.same_branch(branch) and (public.is_branch_manager() or public.is_receptionist() or public.is_application_officer()))
  or (public.is_counselor() and counselor = public.current_staff_name() and public.same_branch(branch))
)
with check (
  public.is_super_admin()
  or (public.same_branch(branch) and (public.is_branch_manager() or public.is_receptionist() or public.is_application_officer()))
  or (public.is_counselor() and counselor = public.current_staff_name() and public.same_branch(branch))
);

drop policy if exists applications_delete on public.applications;
create policy applications_delete on public.applications for delete
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

-- Mirrors isNotificationVisibleTo() in src/notifications.ts exactly.
alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
using (
  public.is_super_admin()
  or (
    role = public.current_role()
    and (
      (recipient_name is not null and recipient_name = public.current_staff_name())
      or (recipient_name is null and (branch is null or public.same_branch(branch)))
    )
  )
);

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check (public.is_active_staff());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update
using (
  public.is_super_admin()
  or (
    role = public.current_role()
    and (
      (recipient_name is not null and recipient_name = public.current_staff_name())
      or (recipient_name is null and (branch is null or public.same_branch(branch)))
    )
  )
)
with check (
  public.is_super_admin()
  or (
    role = public.current_role()
    and (
      (recipient_name is not null and recipient_name = public.current_staff_name())
      or (recipient_name is null and (branch is null or public.same_branch(branch)))
    )
  )
);

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete
using (
  public.is_super_admin()
  or (
    role = public.current_role()
    and (
      (recipient_name is not null and recipient_name = public.current_staff_name())
      or (recipient_name is null and (branch is null or public.same_branch(branch)))
    )
  )
);

-- No branch/owner column found (client_key isn't a confirmed FK to one
-- specific client table) — scoped to "any signed-in staff" for now rather
-- than left fully open. Tighten once client_key's target table is confirmed.
alter table public.communication_logs enable row level security;

drop policy if exists communication_logs_select on public.communication_logs;
create policy communication_logs_select on public.communication_logs for select using (public.is_active_staff());

drop policy if exists communication_logs_insert on public.communication_logs;
create policy communication_logs_insert on public.communication_logs for insert with check (public.is_active_staff());

alter table public.branch_transfers enable row level security;

drop policy if exists branch_transfers_select on public.branch_transfers;
create policy branch_transfers_select on public.branch_transfers for select
using (public.is_super_admin() or public.current_branch() in (from_branch, to_branch));

drop policy if exists branch_transfers_insert on public.branch_transfers;
create policy branch_transfers_insert on public.branch_transfers for insert
with check (public.is_super_admin() or public.same_branch(to_branch));

drop policy if exists branch_transfers_update on public.branch_transfers;
create policy branch_transfers_update on public.branch_transfers for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(from_branch)))
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(from_branch)));


-- ----------------------------------------------------------------------------
-- 4. Finance: fin_transactions, expense_requests, service_prices,
--    commissions, partners
--
-- No "Finance" role exists (see header note) — scoped by branch membership,
-- matching how the UI already routes payments/charges through Front Desk,
-- Counselor, V/A Officer and Branch Manager screens.
-- ----------------------------------------------------------------------------

alter table public.fin_transactions enable row level security;

drop policy if exists fin_transactions_select on public.fin_transactions;
create policy fin_transactions_select on public.fin_transactions for select
using (public.is_super_admin() or public.same_branch(branch));

drop policy if exists fin_transactions_insert on public.fin_transactions;
create policy fin_transactions_insert on public.fin_transactions for insert
with check (public.is_super_admin() or public.same_branch(branch));

-- Amending/voiding an existing row (the "update" half of upsert) is
-- deliberately tighter than creating one: only Branch Manager/Super Admin.
drop policy if exists fin_transactions_update on public.fin_transactions;
create policy fin_transactions_update on public.fin_transactions for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)))
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

alter table public.expense_requests enable row level security;

drop policy if exists expense_requests_select on public.expense_requests;
create policy expense_requests_select on public.expense_requests for select
using (public.is_super_admin() or public.same_branch(branch));

drop policy if exists expense_requests_insert on public.expense_requests;
create policy expense_requests_insert on public.expense_requests for insert
with check (public.is_super_admin() or public.same_branch(branch));

drop policy if exists expense_requests_update on public.expense_requests;
create policy expense_requests_update on public.expense_requests for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)))
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

-- Append-only price list — no update/delete policy at all (default-deny).
alter table public.service_prices enable row level security;

drop policy if exists service_prices_select on public.service_prices;
create policy service_prices_select on public.service_prices for select using (public.is_active_staff());

drop policy if exists service_prices_insert on public.service_prices;
create policy service_prices_insert on public.service_prices for insert with check (public.is_super_admin());

alter table public.commissions enable row level security;

drop policy if exists commissions_select on public.commissions;
create policy commissions_select on public.commissions for select
using (public.is_super_admin() or public.same_branch(branch));

drop policy if exists commissions_update on public.commissions;
create policy commissions_update on public.commissions for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)))
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

alter table public.partners enable row level security;

drop policy if exists partners_select on public.partners;
create policy partners_select on public.partners for select using (public.is_active_staff());

drop policy if exists partners_insert on public.partners;
create policy partners_insert on public.partners for insert with check (public.is_super_admin());

drop policy if exists partners_update on public.partners;
create policy partners_update on public.partners for update using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists partners_delete on public.partners;
create policy partners_delete on public.partners for delete using (public.is_super_admin());


-- ----------------------------------------------------------------------------
-- 5. HR (docx §20 — sensitive). All keyed by staff_name (text) + branch.
-- ----------------------------------------------------------------------------

alter table public.attendance enable row level security;

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name());

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance for insert
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name());

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name())
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name());

alter table public.attendance_corrections enable row level security;

drop policy if exists attendance_corrections_select on public.attendance_corrections;
create policy attendance_corrections_select on public.attendance_corrections for select
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name());

drop policy if exists attendance_corrections_insert on public.attendance_corrections;
create policy attendance_corrections_insert on public.attendance_corrections for insert
with check (public.is_super_admin() or staff_name = public.current_staff_name() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists attendance_corrections_update on public.attendance_corrections;
create policy attendance_corrections_update on public.attendance_corrections for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)))
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

alter table public.attendance_explanations enable row level security;

drop policy if exists attendance_explanations_select on public.attendance_explanations;
create policy attendance_explanations_select on public.attendance_explanations for select
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name());

drop policy if exists attendance_explanations_insert on public.attendance_explanations;
create policy attendance_explanations_insert on public.attendance_explanations for insert
with check (public.is_super_admin() or staff_name = public.current_staff_name() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists attendance_explanations_update on public.attendance_explanations;
create policy attendance_explanations_update on public.attendance_explanations for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name())
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name());

alter table public.holidays enable row level security;

drop policy if exists holidays_select on public.holidays;
create policy holidays_select on public.holidays for select using (public.is_active_staff());

drop policy if exists holidays_insert on public.holidays;
create policy holidays_insert on public.holidays for insert with check (public.is_super_admin() or public.is_branch_manager());

drop policy if exists holidays_update on public.holidays;
create policy holidays_update on public.holidays for update
using (public.is_super_admin() or public.is_branch_manager())
with check (public.is_super_admin() or public.is_branch_manager());

drop policy if exists holidays_delete on public.holidays;
create policy holidays_delete on public.holidays for delete using (public.is_super_admin() or public.is_branch_manager());

alter table public.leave_records enable row level security;

drop policy if exists leave_records_select on public.leave_records;
create policy leave_records_select on public.leave_records for select
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name());

drop policy if exists leave_records_insert on public.leave_records;
create policy leave_records_insert on public.leave_records for insert
with check (public.is_super_admin() or staff_name = public.current_staff_name() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists leave_records_update on public.leave_records;
create policy leave_records_update on public.leave_records for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)))
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

-- Most sensitive HR table (bank details, salary). Employees may READ their
-- own row (to see e.g. payment method on file) but never write it — only a
-- manager/admin sets pay data.
alter table public.pay_profiles enable row level security;

drop policy if exists pay_profiles_select on public.pay_profiles;
create policy pay_profiles_select on public.pay_profiles for select
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name());

drop policy if exists pay_profiles_insert on public.pay_profiles;
create policy pay_profiles_insert on public.pay_profiles for insert
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists pay_profiles_update on public.pay_profiles;
create policy pay_profiles_update on public.pay_profiles for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)))
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

-- Payroll RUNS are aggregate (cover every employee in the branch) — not
-- exposed to individual employees, only managers/admin.
alter table public.payroll_runs enable row level security;

drop policy if exists payroll_runs_select on public.payroll_runs;
create policy payroll_runs_select on public.payroll_runs for select
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists payroll_runs_insert on public.payroll_runs;
create policy payroll_runs_insert on public.payroll_runs for insert
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists payroll_runs_update on public.payroll_runs;
create policy payroll_runs_update on public.payroll_runs for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)))
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

-- Employees may read their own review (to acknowledge it) but not write it.
alter table public.performance_reviews enable row level security;

drop policy if exists performance_reviews_select on public.performance_reviews;
create policy performance_reviews_select on public.performance_reviews for select
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name());

drop policy if exists performance_reviews_insert on public.performance_reviews;
create policy performance_reviews_insert on public.performance_reviews for insert
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

-- The employee's only permitted write is acknowledging their own review —
-- allow update when self, but the app should only ever set acknowledged/
-- acknowledgedAt in that path (RLS can't restrict to specific columns
-- without a view; noted as a follow-up).
drop policy if exists performance_reviews_update on public.performance_reviews;
create policy performance_reviews_update on public.performance_reviews for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name())
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or staff_name = public.current_staff_name());

alter table public.onboarding_cases enable row level security;

drop policy if exists onboarding_cases_select on public.onboarding_cases;
create policy onboarding_cases_select on public.onboarding_cases for select
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists onboarding_cases_insert on public.onboarding_cases;
create policy onboarding_cases_insert on public.onboarding_cases for insert
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists onboarding_cases_update on public.onboarding_cases;
create policy onboarding_cases_update on public.onboarding_cases for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)))
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

alter table public.offboarding_cases enable row level security;

drop policy if exists offboarding_cases_select on public.offboarding_cases;
create policy offboarding_cases_select on public.offboarding_cases for select
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists offboarding_cases_insert on public.offboarding_cases;
create policy offboarding_cases_insert on public.offboarding_cases for insert
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists offboarding_cases_update on public.offboarding_cases;
create policy offboarding_cases_update on public.offboarding_cases for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)))
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));


-- ----------------------------------------------------------------------------
-- 6. Ops: tasks, it_tickets, branch_notices, branch_issues,
--    branch_day_logs, branch_content_requests, marketing_support_requests
-- ----------------------------------------------------------------------------

alter table public.tasks enable row level security;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (public.is_super_admin() or public.same_branch(branch));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert with check (public.is_super_admin() or public.same_branch(branch));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update
using (public.is_super_admin() or public.same_branch(branch))
with check (public.is_super_admin() or public.same_branch(branch));

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)) or created_by = public.current_staff_name());

-- No dedicated "IT" role exists yet (see header note) — any branch staff can
-- raise/update a ticket in their own branch; resolving is not further
-- restricted to Branch Manager because there is no reliable way today to
-- tell "the IT person" apart from anyone else in the branch.
alter table public.it_tickets enable row level security;

drop policy if exists it_tickets_select on public.it_tickets;
create policy it_tickets_select on public.it_tickets for select using (public.is_super_admin() or public.same_branch(branch));

drop policy if exists it_tickets_insert on public.it_tickets;
create policy it_tickets_insert on public.it_tickets for insert with check (public.is_super_admin() or public.same_branch(branch));

drop policy if exists it_tickets_update on public.it_tickets;
create policy it_tickets_update on public.it_tickets for update
using (public.is_super_admin() or public.same_branch(branch))
with check (public.is_super_admin() or public.same_branch(branch));

alter table public.branch_notices enable row level security;

drop policy if exists branch_notices_select on public.branch_notices;
create policy branch_notices_select on public.branch_notices for select using (public.is_super_admin() or public.same_branch(branch));

drop policy if exists branch_notices_insert on public.branch_notices;
create policy branch_notices_insert on public.branch_notices for insert
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

-- Deliberately open to any branch staff member, not just the Branch Manager:
-- acknowledging a notice (appending to `receipts`) goes through the same
-- generic updateBranchNotice() call as editing title/message, and RLS can't
-- tell those apart without a column-restricted view/RPC (a follow-up).
drop policy if exists branch_notices_update on public.branch_notices;
create policy branch_notices_update on public.branch_notices for update
using (public.is_super_admin() or public.same_branch(branch))
with check (public.is_super_admin() or public.same_branch(branch));

alter table public.branch_issues enable row level security;

drop policy if exists branch_issues_select on public.branch_issues;
create policy branch_issues_select on public.branch_issues for select using (public.is_super_admin() or public.same_branch(branch));

drop policy if exists branch_issues_insert on public.branch_issues;
create policy branch_issues_insert on public.branch_issues for insert with check (public.is_super_admin() or public.same_branch(branch));

drop policy if exists branch_issues_update on public.branch_issues;
create policy branch_issues_update on public.branch_issues for update
using (public.is_super_admin() or public.same_branch(branch))
with check (public.is_super_admin() or public.same_branch(branch));

alter table public.branch_day_logs enable row level security;

drop policy if exists branch_day_logs_select on public.branch_day_logs;
create policy branch_day_logs_select on public.branch_day_logs for select using (public.is_super_admin() or public.same_branch(branch));

drop policy if exists branch_day_logs_insert on public.branch_day_logs;
create policy branch_day_logs_insert on public.branch_day_logs for insert
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists branch_day_logs_update on public.branch_day_logs;
create policy branch_day_logs_update on public.branch_day_logs for update
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)))
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

-- Cross-department: a branch requests content FROM Marketing.
alter table public.branch_content_requests enable row level security;

drop policy if exists branch_content_requests_select on public.branch_content_requests;
create policy branch_content_requests_select on public.branch_content_requests for select
using (public.is_super_admin() or public.same_branch(branch) or public.is_marketing());

drop policy if exists branch_content_requests_insert on public.branch_content_requests;
create policy branch_content_requests_insert on public.branch_content_requests for insert
with check (public.is_super_admin() or public.same_branch(branch));

drop policy if exists branch_content_requests_update on public.branch_content_requests;
create policy branch_content_requests_update on public.branch_content_requests for update
using (public.is_super_admin() or public.same_branch(branch) or public.is_marketing())
with check (public.is_super_admin() or public.same_branch(branch) or public.is_marketing());

drop policy if exists branch_content_requests_delete on public.branch_content_requests;
create policy branch_content_requests_delete on public.branch_content_requests for delete
using (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

-- Cross-department: a branch requests marketing SUPPORT (budget/campaign ask).
alter table public.marketing_support_requests enable row level security;

drop policy if exists marketing_support_requests_select on public.marketing_support_requests;
create policy marketing_support_requests_select on public.marketing_support_requests for select
using (public.is_super_admin() or public.same_branch(branch) or public.is_marketing());

drop policy if exists marketing_support_requests_insert on public.marketing_support_requests;
create policy marketing_support_requests_insert on public.marketing_support_requests for insert
with check (public.is_super_admin() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists marketing_support_requests_update on public.marketing_support_requests;
create policy marketing_support_requests_update on public.marketing_support_requests for update
using (public.is_super_admin() or public.is_marketing())
with check (public.is_super_admin() or public.is_marketing());


-- ----------------------------------------------------------------------------
-- 7. Marketing department (docx §21 — centralized, cross-branch by design).
--
-- marketing_leads holds pre-assignment client PII and must stay Marketing/
-- Super-Admin-only until it becomes a `students` row (out of this table's
-- reach) — matches "Marketing must not retrieve full private student data"
-- read the other way: branch roles must not read raw marketing leads either.
-- ----------------------------------------------------------------------------

alter table public.marketing_leads enable row level security;
drop policy if exists marketing_leads_all on public.marketing_leads;
create policy marketing_leads_all on public.marketing_leads for all
using (public.is_super_admin() or public.is_marketing())
with check (public.is_super_admin() or public.is_marketing());

alter table public.marketing_campaigns enable row level security;
drop policy if exists marketing_campaigns_all on public.marketing_campaigns;
create policy marketing_campaigns_all on public.marketing_campaigns for all
using (public.is_super_admin() or public.is_marketing())
with check (public.is_super_admin() or public.is_marketing());

alter table public.marketing_ad_spend enable row level security;
drop policy if exists marketing_ad_spend_all on public.marketing_ad_spend;
create policy marketing_ad_spend_all on public.marketing_ad_spend for all
using (public.is_super_admin() or public.is_marketing())
with check (public.is_super_admin() or public.is_marketing());

-- Cross-department: Marketing delegates a content request to a branch
-- counselor, who submits files back on the same row.
alter table public.marketing_content_requests enable row level security;

drop policy if exists marketing_content_requests_select on public.marketing_content_requests;
create policy marketing_content_requests_select on public.marketing_content_requests for select
using (public.is_super_admin() or public.is_marketing() or public.same_branch(target_branch));

drop policy if exists marketing_content_requests_insert on public.marketing_content_requests;
create policy marketing_content_requests_insert on public.marketing_content_requests for insert
with check (public.is_super_admin() or public.is_marketing());

drop policy if exists marketing_content_requests_update on public.marketing_content_requests;
create policy marketing_content_requests_update on public.marketing_content_requests for update
using (public.is_super_admin() or public.is_marketing() or public.same_branch(target_branch))
with check (public.is_super_admin() or public.is_marketing() or public.same_branch(target_branch));

drop policy if exists marketing_content_requests_delete on public.marketing_content_requests;
create policy marketing_content_requests_delete on public.marketing_content_requests for delete
using (public.is_super_admin() or public.is_marketing());

alter table public.marketing_content_items enable row level security;
drop policy if exists marketing_content_items_all on public.marketing_content_items;
create policy marketing_content_items_all on public.marketing_content_items for all
using (public.is_super_admin() or public.is_marketing())
with check (public.is_super_admin() or public.is_marketing());

alter table public.marketing_design_tasks enable row level security;
drop policy if exists marketing_design_tasks_all on public.marketing_design_tasks;
create policy marketing_design_tasks_all on public.marketing_design_tasks for all
using (public.is_super_admin() or public.is_marketing())
with check (public.is_super_admin() or public.is_marketing());

alter table public.marketing_video_tasks enable row level security;
drop policy if exists marketing_video_tasks_all on public.marketing_video_tasks;
create policy marketing_video_tasks_all on public.marketing_video_tasks for all
using (public.is_super_admin() or public.is_marketing())
with check (public.is_super_admin() or public.is_marketing());

alter table public.marketing_posts enable row level security;
drop policy if exists marketing_posts_all on public.marketing_posts;
create policy marketing_posts_all on public.marketing_posts for all
using (public.is_super_admin() or public.is_marketing())
with check (public.is_super_admin() or public.is_marketing());

alter table public.marketing_seo_tasks enable row level security;
drop policy if exists marketing_seo_tasks_all on public.marketing_seo_tasks;
create policy marketing_seo_tasks_all on public.marketing_seo_tasks for all
using (public.is_super_admin() or public.is_marketing())
with check (public.is_super_admin() or public.is_marketing());

alter table public.marketing_seo_keywords enable row level security;
drop policy if exists marketing_seo_keywords_all on public.marketing_seo_keywords;
create policy marketing_seo_keywords_all on public.marketing_seo_keywords for all
using (public.is_super_admin() or public.is_marketing())
with check (public.is_super_admin() or public.is_marketing());

-- A Leads Specialist's alert to a branch — also readable by that branch's
-- own manager (they're the recipient), not just Marketing.
alter table public.marketing_pings enable row level security;

drop policy if exists marketing_pings_select on public.marketing_pings;
create policy marketing_pings_select on public.marketing_pings for select
using (public.is_super_admin() or public.is_marketing() or (public.is_branch_manager() and public.same_branch(branch)));

drop policy if exists marketing_pings_insert on public.marketing_pings;
create policy marketing_pings_insert on public.marketing_pings for insert with check (public.is_super_admin() or public.is_marketing());

-- upsert() needs an UPDATE policy too (ON CONFLICT DO UPDATE) — without one,
-- the insert half succeeds but a conflicting re-upsert would be denied.
drop policy if exists marketing_pings_update on public.marketing_pings;
create policy marketing_pings_update on public.marketing_pings for update
using (public.is_super_admin() or public.is_marketing())
with check (public.is_super_admin() or public.is_marketing());

drop policy if exists marketing_pings_delete on public.marketing_pings;
create policy marketing_pings_delete on public.marketing_pings for delete using (public.is_super_admin() or public.is_marketing());


-- ----------------------------------------------------------------------------
-- 8. Audit log — append-only, Super Admin read (matches the app: the only
--    writer today is the Super Admin task-status override path).
-- ----------------------------------------------------------------------------

alter table public.audit_log enable row level security;

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select using (public.is_super_admin());

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert with check (public.is_active_staff());

-- No update/delete policy anywhere in this file for audit_log: default-deny,
-- matching its "no update/delete anywhere in the app" append-only design.


-- ============================================================================
-- Source: supabase/migrations/2026-09-27-marketing-role-fix.sql
-- ============================================================================
-- ============================================================================
-- Phase F — fix staff.marketingRole being silently dropped.
--
-- src/lib/staffApi.ts never mapped `marketingRole` to/from a DB column, so
-- every Marketing staff member's sub-role (Marketing Manager / Leads
-- Specialist / Content Planner / Graphics Designer) was lost on every
-- reload — src/components/Login.tsx's `match.marketingRole ?? 'Marketing
-- Manager'` fallback masked this by always defaulting to Marketing Manager.
-- Fixed in code (staffApi.ts, StaffManagement.tsx add-staff form). This
-- migration adds the column that code now actually reads/writes, and makes
-- current_staff() (defined in 2026-09-27-rls-lockdown.sql) return the real
-- value instead of the hardcoded `null` it shipped with (marketingRole
-- wasn't persisted anywhere yet at the time that migration was written).
--
-- Safe to re-run.
-- ============================================================================

alter table public.staff
  add column if not exists marketing_role text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'staff_marketing_role_check'
  ) then
    alter table public.staff
      add constraint staff_marketing_role_check
      check (marketing_role is null or marketing_role in (
        'Marketing Manager', 'Leads Specialist', 'Content Planner', 'Graphics Designer'
      ));
  end if;
end $$;

create or replace function public.current_staff()
returns table (
  id text,
  name text,
  email text,
  staff_role text,
  app_role text,
  marketing_role text,
  branch text,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.email,
    s.role as staff_role,
    case s.role
      when 'Super Admin' then 'super_admin'
      when 'Marketing' then 'marketing'
      when 'Branch Manager' then 'branch_manager'
      when 'Front Desk Officer' then 'receptionist'
      when 'Counselor' then 'counselor'
      when 'V/A Officer' then 'application_officer'
      else null
    end as app_role,
    s.marketing_role,
    s.branch,
    s.status
  from public.staff s
  where s.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_marketing_role() returns text
language sql stable security definer set search_path = public as $$
  select marketing_role from public.current_staff() where status = 'Active' and app_role = 'marketing';
$$;


-- ============================================================================
-- Source: supabase/migrations/2026-09-27-marketing-subroles.sql
-- ============================================================================
-- ============================================================================
-- Phase F (continued) — now that staff.marketing_role is actually persisted
-- (2026-09-27-marketing-role-fix.sql), replace the blanket "any Marketing
-- staff" policies on the marketing-domain tables (2026-09-27-rls-lockdown.sql
-- §7) with sub-role-scoped ones, matching the docx §4 role descriptions:
--
--   Marketing Manager   — everything in the marketing domain.
--   Leads Specialist    — marketing_leads, marketing_pings only.
--   Content Planner     — content requests/items + cross-branch coordination.
--   Graphics Designer   — design/video production + scheduled posts only.
--
-- Every Marketing sub-role was already excluded from student/HR/finance/
-- application data by the base RLS lockdown — this only narrows access
-- *within* the marketing domain, it does not grant anything new.
--
-- Safe to re-run.
-- ============================================================================

create or replace function public.is_marketing_manager() returns boolean
language sql stable as $$
  select public.is_marketing() and (public.current_marketing_role() is null or public.current_marketing_role() = 'Marketing Manager');
$$;
-- NULL sub-role (an account created before this fix, or via direct SQL) is
-- treated as Marketing Manager — the same default Login.tsx already applies
-- client-side (`match.marketingRole ?? 'Marketing Manager'`), so an
-- unmigrated account doesn't suddenly lose access it had yesterday.

create or replace function public.is_leads_specialist() returns boolean
language sql stable as $$ select public.is_marketing() and public.current_marketing_role() = 'Leads Specialist'; $$;

create or replace function public.is_content_planner() returns boolean
language sql stable as $$ select public.is_marketing() and public.current_marketing_role() = 'Content Planner'; $$;

create or replace function public.is_graphics_designer() returns boolean
language sql stable as $$ select public.is_marketing() and public.current_marketing_role() = 'Graphics Designer'; $$;


-- ---- Leads Specialist domain: leads + branch pings -------------------------

drop policy if exists marketing_leads_all on public.marketing_leads;
create policy marketing_leads_all on public.marketing_leads for all
using (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist());

drop policy if exists marketing_pings_select on public.marketing_pings;
create policy marketing_pings_select on public.marketing_pings for select
using (
  public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist()
  or (public.is_branch_manager() and public.same_branch(branch))
);

drop policy if exists marketing_pings_insert on public.marketing_pings;
create policy marketing_pings_insert on public.marketing_pings for insert
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist());

drop policy if exists marketing_pings_update on public.marketing_pings;
create policy marketing_pings_update on public.marketing_pings for update
using (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist());

drop policy if exists marketing_pings_delete on public.marketing_pings;
create policy marketing_pings_delete on public.marketing_pings for delete
using (public.is_super_admin() or public.is_marketing_manager() or public.is_leads_specialist());


-- ---- Manager-only: campaigns, spend, SEO (budget/strategy tools) ----------

drop policy if exists marketing_campaigns_all on public.marketing_campaigns;
create policy marketing_campaigns_all on public.marketing_campaigns for all
using (public.is_super_admin() or public.is_marketing_manager())
with check (public.is_super_admin() or public.is_marketing_manager());

drop policy if exists marketing_ad_spend_all on public.marketing_ad_spend;
create policy marketing_ad_spend_all on public.marketing_ad_spend for all
using (public.is_super_admin() or public.is_marketing_manager())
with check (public.is_super_admin() or public.is_marketing_manager());

drop policy if exists marketing_seo_tasks_all on public.marketing_seo_tasks;
create policy marketing_seo_tasks_all on public.marketing_seo_tasks for all
using (public.is_super_admin() or public.is_marketing_manager())
with check (public.is_super_admin() or public.is_marketing_manager());

drop policy if exists marketing_seo_keywords_all on public.marketing_seo_keywords;
create policy marketing_seo_keywords_all on public.marketing_seo_keywords for all
using (public.is_super_admin() or public.is_marketing_manager())
with check (public.is_super_admin() or public.is_marketing_manager());


-- ---- Content Planner & Branch Coordinator domain --------------------------

drop policy if exists marketing_content_requests_select on public.marketing_content_requests;
create policy marketing_content_requests_select on public.marketing_content_requests for select
using (
  public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner()
  or public.same_branch(target_branch)
);

drop policy if exists marketing_content_requests_insert on public.marketing_content_requests;
create policy marketing_content_requests_insert on public.marketing_content_requests for insert
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists marketing_content_requests_update on public.marketing_content_requests;
create policy marketing_content_requests_update on public.marketing_content_requests for update
using (
  public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner()
  or public.same_branch(target_branch)
)
with check (
  public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner()
  or public.same_branch(target_branch)
);

drop policy if exists marketing_content_requests_delete on public.marketing_content_requests;
create policy marketing_content_requests_delete on public.marketing_content_requests for delete
using (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());

-- Content Planner manages items end-to-end; Graphics Designer needs read
-- access too (they execute the design/video work an item tracks).
drop policy if exists marketing_content_items_all on public.marketing_content_items;
create policy marketing_content_items_select on public.marketing_content_items for select
using (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner() or public.is_graphics_designer());

drop policy if exists marketing_content_items_insert on public.marketing_content_items;
create policy marketing_content_items_insert on public.marketing_content_items for insert
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists marketing_content_items_update on public.marketing_content_items;
create policy marketing_content_items_update on public.marketing_content_items for update
using (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists marketing_content_items_delete on public.marketing_content_items;
create policy marketing_content_items_delete on public.marketing_content_items for delete
using (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists branch_content_requests_select on public.branch_content_requests;
create policy branch_content_requests_select on public.branch_content_requests for select
using (public.is_super_admin() or public.same_branch(branch) or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists branch_content_requests_update on public.branch_content_requests;
create policy branch_content_requests_update on public.branch_content_requests for update
using (public.is_super_admin() or public.same_branch(branch) or public.is_marketing_manager() or public.is_content_planner())
with check (public.is_super_admin() or public.same_branch(branch) or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists marketing_support_requests_select on public.marketing_support_requests;
create policy marketing_support_requests_select on public.marketing_support_requests for select
using (public.is_super_admin() or public.same_branch(branch) or public.is_marketing_manager() or public.is_content_planner());

drop policy if exists marketing_support_requests_update on public.marketing_support_requests;
create policy marketing_support_requests_update on public.marketing_support_requests for update
using (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_content_planner());


-- ---- Graphics Designer domain: design/video production + scheduled posts --

drop policy if exists marketing_design_tasks_all on public.marketing_design_tasks;
create policy marketing_design_tasks_all on public.marketing_design_tasks for all
using (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer());

drop policy if exists marketing_video_tasks_all on public.marketing_video_tasks;
create policy marketing_video_tasks_all on public.marketing_video_tasks for all
using (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer());

drop policy if exists marketing_posts_all on public.marketing_posts;
create policy marketing_posts_all on public.marketing_posts for all
using (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer())
with check (public.is_super_admin() or public.is_marketing_manager() or public.is_graphics_designer());


-- ============================================================================
-- Source: supabase/migrations/2026-09-27-marketing-branch-leak-fix.sql
-- ============================================================================
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


-- ============================================================================
-- Source: supabase/migrations/2026-09-27-finance-integrity.sql
-- ============================================================================
-- ============================================================================
-- Finance integrity — Phases C & D of the security follow-up.
--
-- Phase C: fin_transactions must be immutable once recorded (docx §9). RLS
-- alone (2026-09-27-rls-lockdown.sql) restricts *who* can write a row, but an
-- authorized writer (Branch Manager/Super Admin) can still `upsert` over an
-- existing row's amount/kind/client/receipt number — RLS has no concept of
-- "this specific column may never change." A BEFORE UPDATE/DELETE trigger
-- does, and it applies regardless of which client/role/RPC touches the row,
-- so the frontend genuinely cannot be trusted (or need to be trusted) to
-- enforce this — matches the docx's explicit requirement.
--
-- Also closes a real, currently-unguarded gap: nothing today stops a Branch
-- Manager approving their OWN discount/refund/exception request (confirmed
-- in src/components/ClientFinancials.tsx — `by: currentUser.name` at request
-- time — and src/components/ManagerApprovalCenter.tsx — `decidedBy:
-- currentUser.name` at decision time — with no requester-vs-approver check
-- anywhere). The trigger below blocks that at the database level too.
--
-- Phase D: record_payment() — a SECURITY DEFINER RPC that authenticates the
-- caller server-side, validates branch/role/amount/client, and allocates a
-- collision-safe receipt number atomically.
--
-- IMPORTANT SCOPE NOTE (read before assuming this "closes" Phase D): the
-- frontend does NOT call this RPC. Every payment/charge screen
-- (FrontDeskPaymentsPage, DocumentChargesPanel, ServiceFeesPanel,
-- ClientFinancials) still calls upsertFinTransaction() directly, which is a
-- plain `.from('fin_transactions').upsert(...)`. That direct-insert path
-- remains allowed by the Phase-4 RLS policy (branch-scoped, matching how the
-- UI already works) because rewiring those screens to call
-- `supabase.rpc('record_payment', ...)` instead is a FRONTEND change, and the
-- brief for this pass says not to redesign the frontend. So: this RPC is
-- correctly built and ready, but it is not yet the only way to create a
-- payment — true single-writer enforcement (revoking direct INSERT once the
-- frontend is migrated to call the RPC) is a follow-up, not done here. The
-- immutability trigger above still protects every row regardless of which
-- path created it.
--
-- Safe to re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Constraints: no negative amounts, receipt numbers are unique.
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fin_transactions_amount_nonnegative'
  ) then
    alter table public.fin_transactions
      add constraint fin_transactions_amount_nonnegative check (amount >= 0);
  end if;
end $$;

-- Partial (receipt_no is null for non-payment rows like a pending Discount
-- request that hasn't been paid against yet).
create unique index if not exists fin_transactions_receipt_no_key
  on public.fin_transactions (receipt_no)
  where receipt_no is not null;


-- ----------------------------------------------------------------------------
-- 2. Immutability + no-self-approval trigger.
-- ----------------------------------------------------------------------------

create or replace function public.fin_transactions_protect()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'fin_transactions rows cannot be deleted — use a Refund/void instead of removing history'
      using errcode = '42501';
  end if;

  -- tg_op = 'UPDATE' from here on.

  -- Core historical facts, once set, never change. Workflow/decision fields
  -- (status, void, decided_*, processed_*, note, method*) may still change —
  -- that's how void/approve/reject/process legitimately work today.
  if new.id is distinct from old.id
    or new.branch is distinct from old.branch
    or new.kind is distinct from old.kind
    or new.client_id is distinct from old.client_id
    or new.client_name is distinct from old.client_name
    or new.counselor is distinct from old.counselor
    or new.country is distinct from old.country
    or new.service is distinct from old.service
    or new.amount is distinct from old.amount
    or new.at is distinct from old.at
    or new.by is distinct from old.by
    or new.receipt_no is distinct from old.receipt_no
    or new.standard_fee is distinct from old.standard_fee
    or new.ref_of is distinct from old.ref_of
  then
    raise exception 'fin_transactions: amount, client, branch, kind, receipt number and transaction date are immutable once recorded — record a new Refund/Discount/Exception row instead of editing this one'
      using errcode = '23514';
  end if;

  -- No self-approval: whoever originally requested this row (`by`) may not
  -- also be the one recording the decision (`decided_by`) on it.
  if new.decided_by is not null
    and new.decided_by is distinct from old.decided_by
    and new.decided_by = old.by
  then
    raise exception 'fin_transactions: the requester (%) cannot approve or reject their own request', old.by
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists fin_transactions_protect on public.fin_transactions;
create trigger fin_transactions_protect
before update or delete on public.fin_transactions
for each row execute function public.fin_transactions_protect();


-- ----------------------------------------------------------------------------
-- 3. Collision-safe receipt numbering.
-- ----------------------------------------------------------------------------

create table if not exists public.receipt_counters (
  branch text primary key,
  next_no bigint not null default 0
);

-- No policies at all, on purpose: with RLS enabled and zero policies, every
-- operation is denied for anon/authenticated. Only record_payment() (SECURITY
-- DEFINER, runs as the function owner) can touch this table.
alter table public.receipt_counters enable row level security;


-- ----------------------------------------------------------------------------
-- 4. record_payment() — see the scope note at the top of this file.
-- ----------------------------------------------------------------------------

create or replace function public.record_payment(
  p_client_id text,
  p_client_name text,
  p_counselor text,
  p_country text,
  p_service text,
  p_amount numeric,
  p_kind text default 'Payment',           -- 'Payment' | 'Charge' | 'Exception'
  p_branch text default null,              -- Super Admin may specify; everyone else is forced to their own branch
  p_method text default null,
  p_method_note text default null,
  p_note text default null,
  p_title text default null
)
returns public.fin_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch text;
  v_actor text;
  v_role text;
  v_seq bigint;
  v_receipt text;
  v_id text;
  v_row public.fin_transactions;
begin
  v_role := public.current_role();
  v_actor := public.current_staff_name();

  if v_role is null then
    raise exception 'Not authenticated as an active staff member' using errcode = '28000';
  end if;

  if v_role not in ('super_admin', 'branch_manager', 'receptionist', 'counselor', 'application_officer') then
    raise exception 'Role % is not permitted to record financial transactions', v_role using errcode = '42501';
  end if;

  if p_kind not in ('Payment', 'Charge', 'Exception') then
    raise exception 'record_payment only creates Payment/Charge/Exception rows' using errcode = '22023';
  end if;

  if v_role = 'super_admin' then
    v_branch := coalesce(p_branch, public.current_branch());
  else
    if p_branch is not null and p_branch is distinct from public.current_branch() then
      raise exception 'Cannot record a transaction for another branch' using errcode = '42501';
    end if;
    v_branch := public.current_branch();
  end if;

  if v_branch is null then
    raise exception 'Caller has no branch on record' using errcode = '42501';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Amount must be zero or a positive number' using errcode = '22023';
  end if;

  if p_client_id is null or length(trim(p_client_id)) = 0 then
    raise exception 'client_id is required' using errcode = '23502';
  end if;

  -- The client record must actually exist in this branch. The client id
  -- model is currently name/text-based and spread across three tables (see
  -- the Phase G inventory) — this checks all three rather than assuming one.
  if not exists (
    select 1 from public.students st where st.id = p_client_id and st.branch = v_branch
    union all
    select 1 from public.counselor_students cs
      join public.staff s on s.name = cs.assigned_counselor
      where cs.id = p_client_id and s.branch = v_branch
    union all
    select 1 from public.applications ap where ap.id = p_client_id and ap.branch = v_branch
  ) then
    raise exception 'No client % found in branch %', p_client_id, v_branch using errcode = '23503';
  end if;

  -- Atomic, collision-safe allocation: the UPDATE ... RETURNING happens under
  -- the row's own lock, so two concurrent callers for the same branch cannot
  -- receive the same sequence number.
  insert into public.receipt_counters as rc (branch, next_no)
  values (v_branch, 1)
  on conflict (branch) do update set next_no = rc.next_no + 1
  returning rc.next_no into v_seq;

  v_receipt := format('RCT-%s-%s-%s',
    upper(left(regexp_replace(v_branch, '[^A-Za-z]', '', 'g') || 'XXX', 3)),
    to_char(now(), 'YYYY'),
    lpad(v_seq::text, 6, '0')
  );

  v_id := 'fin' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || v_seq::text;

  insert into public.fin_transactions (
    id, branch, kind, client_id, client_name, counselor, country, service,
    title, amount, at, by, method, method_note, note, receipt_no, status
  ) values (
    v_id, v_branch, p_kind, p_client_id, p_client_name,
    coalesce(p_counselor, v_actor), coalesce(p_country, ''), p_service,
    p_title, p_amount, to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS'), v_actor,
    p_method, p_method_note, p_note, v_receipt,
    case when p_kind = 'Payment' then 'Recorded' else 'Pending Approval' end
  )
  returning * into v_row;

  insert into public.audit_log (id, at, by, record, field, from_value, to_value, reason)
  values (
    'aud' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS'), v_actor,
    'fin_transactions:' || v_id, 'create',
    null, p_kind || ' ' || p_amount::text, 'record_payment RPC'
  );

  return v_row;
end;
$$;

revoke all on function public.record_payment(text,text,text,text,text,numeric,text,text,text,text,text,text) from public;
grant execute on function public.record_payment(text,text,text,text,text,numeric,text,text,text,text,text,text) to authenticated;


-- ============================================================================
-- Source: supabase/migrations/2026-09-27-fin-trigger-column-quoting-fix.sql
-- ============================================================================
-- ============================================================================
-- Bug fix — fin_transactions_protect() trigger fails at runtime with
-- "record \"new\" has no field \"by\"" on EVERY update, including a
-- legitimate metadata-only void. `by` is a real column (confirmed via REST:
-- every insert/read shows it), but PL/pgSQL's record field resolution
-- chokes on the unquoted identifier `by` in `new.by` / `old.by` position.
-- Quoting it as new."by" / old."by" forces literal identifier interpretation
-- and resolves it. Quoting `at` defensively too, for the same reason (also
-- SQL-syntax-adjacent: AT TIME ZONE, AT LOCAL).
--
-- This means the finance-integrity migration's immutability trigger has
-- been completely non-functional since it was created — every UPDATE to
-- fin_transactions (void, decide, process — all of them) was failing with
-- this error, not just the ones that should have been blocked. Confirmed via
-- live testing: even a legitimate void-only update by Super Admin failed.
--
-- Safe to re-run.
-- ============================================================================

create or replace function public.fin_transactions_protect()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'fin_transactions rows cannot be deleted — use a Refund/void instead of removing history'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.branch is distinct from old.branch
    or new.kind is distinct from old.kind
    or new.client_id is distinct from old.client_id
    or new.client_name is distinct from old.client_name
    or new.counselor is distinct from old.counselor
    or new.country is distinct from old.country
    or new.service is distinct from old.service
    or new.amount is distinct from old.amount
    or new."at" is distinct from old."at"
    or new."by" is distinct from old."by"
    or new.receipt_no is distinct from old.receipt_no
    or new.standard_fee is distinct from old.standard_fee
    or new.ref_of is distinct from old.ref_of
  then
    raise exception 'fin_transactions: amount, client, branch, kind, receipt number and transaction date are immutable once recorded — record a new Refund/Discount/Exception row instead of editing this one'
      using errcode = '23514';
  end if;

  if new.decided_by is not null
    and new.decided_by is distinct from old.decided_by
    and new.decided_by = old."by"
  then
    raise exception 'fin_transactions: the requester (%) cannot approve or reject their own request', old."by"
      using errcode = '42501';
  end if;

  return new;
end;
$$;


-- ============================================================================
-- Source: supabase/migrations/2026-09-27-record-payment-audit-fix.sql
-- ============================================================================
-- ============================================================================
-- Bug fix — record_payment() failed on every call with:
--   null value in column "from_value" of relation "audit_log" violates
--   not-null constraint
-- audit_log.from_value is NOT NULL in the live schema (not documented
-- anywhere we had access to — found live, via this RPC actually failing).
-- A "create" event has no prior value by definition, so the fix is to pass
-- an empty string instead of null, not to relax the constraint.
--
-- Safe to re-run.
-- ============================================================================

create or replace function public.record_payment(
  p_client_id text,
  p_client_name text,
  p_counselor text,
  p_country text,
  p_service text,
  p_amount numeric,
  p_kind text default 'Payment',
  p_branch text default null,
  p_method text default null,
  p_method_note text default null,
  p_note text default null,
  p_title text default null
)
returns public.fin_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch text;
  v_actor text;
  v_role text;
  v_seq bigint;
  v_receipt text;
  v_id text;
  v_row public.fin_transactions;
begin
  v_role := public.current_role();
  v_actor := public.current_staff_name();

  if v_role is null then
    raise exception 'Not authenticated as an active staff member' using errcode = '28000';
  end if;

  if v_role not in ('super_admin', 'branch_manager', 'receptionist', 'counselor', 'application_officer') then
    raise exception 'Role % is not permitted to record financial transactions', v_role using errcode = '42501';
  end if;

  if p_kind not in ('Payment', 'Charge', 'Exception') then
    raise exception 'record_payment only creates Payment/Charge/Exception rows' using errcode = '22023';
  end if;

  if v_role = 'super_admin' then
    v_branch := coalesce(p_branch, public.current_branch());
  else
    if p_branch is not null and p_branch is distinct from public.current_branch() then
      raise exception 'Cannot record a transaction for another branch' using errcode = '42501';
    end if;
    v_branch := public.current_branch();
  end if;

  if v_branch is null then
    raise exception 'Caller has no branch on record' using errcode = '42501';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Amount must be zero or a positive number' using errcode = '22023';
  end if;

  if p_client_id is null or length(trim(p_client_id)) = 0 then
    raise exception 'client_id is required' using errcode = '23502';
  end if;

  if not exists (
    select 1 from public.students st where st.id = p_client_id and st.branch = v_branch
    union all
    select 1 from public.counselor_students cs
      join public.staff s on s.name = cs.assigned_counselor
      where cs.id = p_client_id and s.branch = v_branch
    union all
    select 1 from public.applications ap where ap.id = p_client_id and ap.branch = v_branch
  ) then
    raise exception 'No client % found in branch %', p_client_id, v_branch using errcode = '23503';
  end if;

  insert into public.receipt_counters as rc (branch, next_no)
  values (v_branch, 1)
  on conflict (branch) do update set next_no = rc.next_no + 1
  returning rc.next_no into v_seq;

  v_receipt := format('RCT-%s-%s-%s',
    upper(left(regexp_replace(v_branch, '[^A-Za-z]', '', 'g') || 'XXX', 3)),
    to_char(now(), 'YYYY'),
    lpad(v_seq::text, 6, '0')
  );

  v_id := 'fin' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || v_seq::text;

  insert into public.fin_transactions (
    id, branch, kind, client_id, client_name, counselor, country, service,
    title, amount, "at", "by", method, method_note, note, receipt_no, status
  ) values (
    v_id, v_branch, p_kind, p_client_id, p_client_name,
    coalesce(p_counselor, v_actor), coalesce(p_country, ''), p_service,
    p_title, p_amount, to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS'), v_actor,
    p_method, p_method_note, p_note, v_receipt,
    case when p_kind = 'Payment' then 'Recorded' else 'Pending Approval' end
  )
  returning * into v_row;

  insert into public.audit_log (id, "at", "by", record, field, from_value, to_value, reason)
  values (
    'aud' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS'), v_actor,
    'fin_transactions:' || v_id, 'create',
    '', p_kind || ' ' || p_amount::text, 'record_payment RPC'
  );

  return v_row;
end;
$$;


-- ============================================================================
-- Source: supabase/migrations/2026-09-27-counselor-isolation-fix.sql
-- ============================================================================
-- ============================================================================
-- P0 fix — counselor_students granted branch-wide access to counselors.
--
-- Found during live authenticated RLS testing: 2026-09-27-rls-lockdown.sql's
-- counselor_students policies used `not is_marketing()` as the "branch-wide"
-- fallback clause, intending to grant Branch Manager/Receptionist/Application
-- Officer full branch visibility (matching applications_select, which does
-- this correctly). But `not is_marketing()` is also true for a Counselor —
-- so any counselor could read AND WRITE any other counselor's clients in the
-- same branch. Confirmed live: T04 (counselor) successfully overwrote T05's
-- (peer counselor) client's consultation_notes via a direct authenticated
-- REST call.
--
-- Fix: replace the `not is_marketing()` fallback with the same explicit
-- role list applications_select already uses correctly. A counselor's only
-- path to a row is now exactly `assigned_counselor = current_staff_name()`.
--
-- Safe to re-run.
-- ============================================================================

drop policy if exists counselor_students_select on public.counselor_students;
create policy counselor_students_select on public.counselor_students for select
using (
  public.is_super_admin()
  or assigned_counselor = public.current_staff_name()
  or (
    (public.is_branch_manager() or public.is_receptionist() or public.is_application_officer())
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and public.same_branch(s.branch)
    )
  )
);

drop policy if exists counselor_students_insert on public.counselor_students;
create policy counselor_students_insert on public.counselor_students for insert
with check (
  public.is_super_admin()
  or assigned_counselor = public.current_staff_name()
  or (
    (public.is_branch_manager() or public.is_receptionist() or public.is_application_officer())
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and public.same_branch(s.branch)
    )
  )
);

drop policy if exists counselor_students_update on public.counselor_students;
create policy counselor_students_update on public.counselor_students for update
using (
  public.is_super_admin()
  or assigned_counselor = public.current_staff_name()
  or (
    (public.is_branch_manager() or public.is_receptionist() or public.is_application_officer())
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and public.same_branch(s.branch)
    )
  )
)
with check (
  public.is_super_admin()
  or assigned_counselor = public.current_staff_name()
  or (
    (public.is_branch_manager() or public.is_receptionist() or public.is_application_officer())
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and public.same_branch(s.branch)
    )
  )
);

-- counselor_students_delete was already correctly scoped to is_branch_manager()
-- only — no counselor path existed there, so it's unaffected and unchanged.


-- ============================================================================
-- Source: supabase/migrations/2026-09-29-rls-initplan-perf.sql
-- ============================================================================
-- ============================================================================
-- RLS performance fix — every policy in 2026-09-27-rls-lockdown.sql calls
-- helper functions (is_super_admin(), same_branch(branch), current_role(),
-- ...) directly in USING/WITH CHECK. None of those calls are wrapped in a
-- `select`, so Postgres cannot hoist them into a one-time InitPlan — it
-- re-invokes them, and the `staff` table lookup inside current_staff() they
-- all funnel through, ONCE PER ROW of every table scanned. That's the classic
-- Supabase RLS performance trap (their linter's `auth_rls_initplan` warning)
-- and it's why fetching a table got much slower once real RLS replaced the
-- old `using (true)` policies — most visibly right after login, when
-- src/App.tsx fires ~40 table fetches at once.
--
-- Fix: wrap every helper-function call in `(select ...)` so Postgres treats
-- it as an uncorrelated subquery — computed once per query, cached, and
-- reused for every row — instead of a per-row function call. `same_branch(x)`
-- calls are inlined as `x is not null and x = (select current_branch())`,
-- which is exactly what same_branch()'s own body does, so this changes
-- nothing about who can see or write what — only how many times the
-- underlying staff lookup runs. Generated by mechanically re-wrapping every
-- policy from the lockdown migration; each one is otherwise byte-for-byte
-- the same boolean expression.
--
-- Safe to re-run: same drop-then-create pattern as the lockdown migration.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 2. Identity tables: staff, branches, counselors
-- ----------------------------------------------------------------------------

alter table public.staff enable row level security;

drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff for select
using (
  (select public.is_super_admin())
  or auth_user_id = (select auth.uid())
  or (select public.is_marketing())
  or (branch is not null and branch = (select public.current_branch()))
);

drop policy if exists staff_insert on public.staff;
create policy staff_insert on public.staff for insert
with check (
  (select public.is_super_admin())
  or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch())) and role <> 'Super Admin')
);

drop policy if exists staff_update on public.staff;
create policy staff_update on public.staff for update
using (
  (select public.is_super_admin())
  or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch())))
)
with check (
  (select public.is_super_admin())
  or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch())) and role <> 'Super Admin')
);

drop policy if exists staff_delete on public.staff;
create policy staff_delete on public.staff for delete
using (
  (select public.is_super_admin())
  or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch())) and role <> 'Super Admin')
);

alter table public.branches enable row level security;

drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches for select using ((select public.is_active_staff()));

drop policy if exists branches_insert on public.branches;
create policy branches_insert on public.branches for insert with check ((select public.is_super_admin()));

drop policy if exists branches_update on public.branches;
create policy branches_update on public.branches for update using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

drop policy if exists branches_delete on public.branches;
create policy branches_delete on public.branches for delete using ((select public.is_super_admin()));

alter table public.counselors enable row level security;

drop policy if exists counselors_select on public.counselors;
create policy counselors_select on public.counselors for select using ((select public.is_active_staff()));

drop policy if exists counselors_insert on public.counselors;
create policy counselors_insert on public.counselors for insert with check ((select public.is_super_admin()) or (select public.is_branch_manager()));

drop policy if exists counselors_update on public.counselors;
create policy counselors_update on public.counselors for update
using ((select public.is_super_admin()) or (select public.is_branch_manager()))
with check ((select public.is_super_admin()) or (select public.is_branch_manager()));

drop policy if exists counselors_delete on public.counselors;
create policy counselors_delete on public.counselors for delete using ((select public.is_super_admin()) or (select public.is_branch_manager()));


-- ----------------------------------------------------------------------------
-- 3. Client pipeline: students, counselor_students, applications,
--    notifications, communication_logs, branch_transfers
-- ----------------------------------------------------------------------------

alter table public.students enable row level security;

drop policy if exists students_select on public.students;
create policy students_select on public.students for select
using ((select public.is_super_admin()) or ((branch is not null and branch = (select public.current_branch())) and not (select public.is_marketing())));

drop policy if exists students_insert on public.students;
create policy students_insert on public.students for insert
with check ((select public.is_super_admin()) or ((branch is not null and branch = (select public.current_branch())) and not (select public.is_marketing())));

drop policy if exists students_update on public.students;
create policy students_update on public.students for update
using ((select public.is_super_admin()) or ((branch is not null and branch = (select public.current_branch())) and not (select public.is_marketing())))
with check ((select public.is_super_admin()) or ((branch is not null and branch = (select public.current_branch())) and not (select public.is_marketing())));

drop policy if exists students_delete on public.students;
create policy students_delete on public.students for delete
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.counselor_students enable row level security;

drop policy if exists counselor_students_select on public.counselor_students;
create policy counselor_students_select on public.counselor_students for select
using (
  (select public.is_super_admin())
  or assigned_counselor = (select public.current_staff_name())
  or (
    not (select public.is_marketing())
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and (s.branch is not null and s.branch = (select public.current_branch()))
    )
  )
);

drop policy if exists counselor_students_insert on public.counselor_students;
create policy counselor_students_insert on public.counselor_students for insert
with check (
  (select public.is_super_admin())
  or assigned_counselor = (select public.current_staff_name())
  or (
    not (select public.is_marketing())
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and (s.branch is not null and s.branch = (select public.current_branch()))
    )
  )
);

drop policy if exists counselor_students_update on public.counselor_students;
create policy counselor_students_update on public.counselor_students for update
using (
  (select public.is_super_admin())
  or assigned_counselor = (select public.current_staff_name())
  or (
    not (select public.is_marketing())
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and (s.branch is not null and s.branch = (select public.current_branch()))
    )
  )
)
with check (
  (select public.is_super_admin())
  or assigned_counselor = (select public.current_staff_name())
  or (
    not (select public.is_marketing())
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and (s.branch is not null and s.branch = (select public.current_branch()))
    )
  )
);

drop policy if exists counselor_students_delete on public.counselor_students;
create policy counselor_students_delete on public.counselor_students for delete
using (
  (select public.is_super_admin())
  or (
    (select public.is_branch_manager())
    and exists (
      select 1 from public.staff s
      where s.name = counselor_students.assigned_counselor
        and (s.branch is not null and s.branch = (select public.current_branch()))
    )
  )
);

alter table public.applications enable row level security;

drop policy if exists applications_select on public.applications;
create policy applications_select on public.applications for select
using (
  (select public.is_super_admin())
  or ((branch is not null and branch = (select public.current_branch())) and ((select public.is_branch_manager()) or (select public.is_receptionist()) or (select public.is_application_officer())))
  or ((select public.is_counselor()) and counselor = (select public.current_staff_name()) and (branch is not null and branch = (select public.current_branch())))
);

drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications for insert
with check (
  (select public.is_super_admin())
  or ((branch is not null and branch = (select public.current_branch())) and ((select public.is_branch_manager()) or (select public.is_receptionist()) or (select public.is_application_officer())))
  or ((select public.is_counselor()) and counselor = (select public.current_staff_name()) and (branch is not null and branch = (select public.current_branch())))
);

drop policy if exists applications_update on public.applications;
create policy applications_update on public.applications for update
using (
  (select public.is_super_admin())
  or ((branch is not null and branch = (select public.current_branch())) and ((select public.is_branch_manager()) or (select public.is_receptionist()) or (select public.is_application_officer())))
  or ((select public.is_counselor()) and counselor = (select public.current_staff_name()) and (branch is not null and branch = (select public.current_branch())))
)
with check (
  (select public.is_super_admin())
  or ((branch is not null and branch = (select public.current_branch())) and ((select public.is_branch_manager()) or (select public.is_receptionist()) or (select public.is_application_officer())))
  or ((select public.is_counselor()) and counselor = (select public.current_staff_name()) and (branch is not null and branch = (select public.current_branch())))
);

drop policy if exists applications_delete on public.applications;
create policy applications_delete on public.applications for delete
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
using (
  (select public.is_super_admin())
  or (
    role = (select public.current_role())
    and (
      (recipient_name is not null and recipient_name = (select public.current_staff_name()))
      or (recipient_name is null and (branch is null or (branch is not null and branch = (select public.current_branch()))))
    )
  )
);

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check ((select public.is_active_staff()));

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update
using (
  (select public.is_super_admin())
  or (
    role = (select public.current_role())
    and (
      (recipient_name is not null and recipient_name = (select public.current_staff_name()))
      or (recipient_name is null and (branch is null or (branch is not null and branch = (select public.current_branch()))))
    )
  )
)
with check (
  (select public.is_super_admin())
  or (
    role = (select public.current_role())
    and (
      (recipient_name is not null and recipient_name = (select public.current_staff_name()))
      or (recipient_name is null and (branch is null or (branch is not null and branch = (select public.current_branch()))))
    )
  )
);

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete
using (
  (select public.is_super_admin())
  or (
    role = (select public.current_role())
    and (
      (recipient_name is not null and recipient_name = (select public.current_staff_name()))
      or (recipient_name is null and (branch is null or (branch is not null and branch = (select public.current_branch()))))
    )
  )
);

alter table public.communication_logs enable row level security;

drop policy if exists communication_logs_select on public.communication_logs;
create policy communication_logs_select on public.communication_logs for select using ((select public.is_active_staff()));

drop policy if exists communication_logs_insert on public.communication_logs;
create policy communication_logs_insert on public.communication_logs for insert with check ((select public.is_active_staff()));

alter table public.branch_transfers enable row level security;

drop policy if exists branch_transfers_select on public.branch_transfers;
create policy branch_transfers_select on public.branch_transfers for select
using ((select public.is_super_admin()) or (select public.current_branch()) in (from_branch, to_branch));

drop policy if exists branch_transfers_insert on public.branch_transfers;
create policy branch_transfers_insert on public.branch_transfers for insert
with check ((select public.is_super_admin()) or (to_branch is not null and to_branch = (select public.current_branch())));

drop policy if exists branch_transfers_update on public.branch_transfers;
create policy branch_transfers_update on public.branch_transfers for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (from_branch is not null and from_branch = (select public.current_branch()))))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (from_branch is not null and from_branch = (select public.current_branch()))));


-- ----------------------------------------------------------------------------
-- 4. Finance: fin_transactions, expense_requests, service_prices,
--    commissions, partners
-- ----------------------------------------------------------------------------

alter table public.fin_transactions enable row level security;

drop policy if exists fin_transactions_select on public.fin_transactions;
create policy fin_transactions_select on public.fin_transactions for select
using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists fin_transactions_insert on public.fin_transactions;
create policy fin_transactions_insert on public.fin_transactions for insert
with check ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists fin_transactions_update on public.fin_transactions;
create policy fin_transactions_update on public.fin_transactions for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.expense_requests enable row level security;

drop policy if exists expense_requests_select on public.expense_requests;
create policy expense_requests_select on public.expense_requests for select
using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists expense_requests_insert on public.expense_requests;
create policy expense_requests_insert on public.expense_requests for insert
with check ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists expense_requests_update on public.expense_requests;
create policy expense_requests_update on public.expense_requests for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.service_prices enable row level security;

drop policy if exists service_prices_select on public.service_prices;
create policy service_prices_select on public.service_prices for select using ((select public.is_active_staff()));

drop policy if exists service_prices_insert on public.service_prices;
create policy service_prices_insert on public.service_prices for insert with check ((select public.is_super_admin()));

alter table public.commissions enable row level security;

drop policy if exists commissions_select on public.commissions;
create policy commissions_select on public.commissions for select
using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists commissions_update on public.commissions;
create policy commissions_update on public.commissions for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.partners enable row level security;

drop policy if exists partners_select on public.partners;
create policy partners_select on public.partners for select using ((select public.is_active_staff()));

drop policy if exists partners_insert on public.partners;
create policy partners_insert on public.partners for insert with check ((select public.is_super_admin()));

drop policy if exists partners_update on public.partners;
create policy partners_update on public.partners for update using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

drop policy if exists partners_delete on public.partners;
create policy partners_delete on public.partners for delete using ((select public.is_super_admin()));


-- ----------------------------------------------------------------------------
-- 5. HR
-- ----------------------------------------------------------------------------

alter table public.attendance enable row level security;

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()));

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance for insert
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()));

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()));

alter table public.attendance_corrections enable row level security;

drop policy if exists attendance_corrections_select on public.attendance_corrections;
create policy attendance_corrections_select on public.attendance_corrections for select
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()));

drop policy if exists attendance_corrections_insert on public.attendance_corrections;
create policy attendance_corrections_insert on public.attendance_corrections for insert
with check ((select public.is_super_admin()) or staff_name = (select public.current_staff_name()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists attendance_corrections_update on public.attendance_corrections;
create policy attendance_corrections_update on public.attendance_corrections for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.attendance_explanations enable row level security;

drop policy if exists attendance_explanations_select on public.attendance_explanations;
create policy attendance_explanations_select on public.attendance_explanations for select
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()));

drop policy if exists attendance_explanations_insert on public.attendance_explanations;
create policy attendance_explanations_insert on public.attendance_explanations for insert
with check ((select public.is_super_admin()) or staff_name = (select public.current_staff_name()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists attendance_explanations_update on public.attendance_explanations;
create policy attendance_explanations_update on public.attendance_explanations for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()));

alter table public.holidays enable row level security;

drop policy if exists holidays_select on public.holidays;
create policy holidays_select on public.holidays for select using ((select public.is_active_staff()));

drop policy if exists holidays_insert on public.holidays;
create policy holidays_insert on public.holidays for insert with check ((select public.is_super_admin()) or (select public.is_branch_manager()));

drop policy if exists holidays_update on public.holidays;
create policy holidays_update on public.holidays for update
using ((select public.is_super_admin()) or (select public.is_branch_manager()))
with check ((select public.is_super_admin()) or (select public.is_branch_manager()));

drop policy if exists holidays_delete on public.holidays;
create policy holidays_delete on public.holidays for delete using ((select public.is_super_admin()) or (select public.is_branch_manager()));

alter table public.leave_records enable row level security;

drop policy if exists leave_records_select on public.leave_records;
create policy leave_records_select on public.leave_records for select
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()));

drop policy if exists leave_records_insert on public.leave_records;
create policy leave_records_insert on public.leave_records for insert
with check ((select public.is_super_admin()) or staff_name = (select public.current_staff_name()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists leave_records_update on public.leave_records;
create policy leave_records_update on public.leave_records for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.pay_profiles enable row level security;

drop policy if exists pay_profiles_select on public.pay_profiles;
create policy pay_profiles_select on public.pay_profiles for select
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()));

drop policy if exists pay_profiles_insert on public.pay_profiles;
create policy pay_profiles_insert on public.pay_profiles for insert
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists pay_profiles_update on public.pay_profiles;
create policy pay_profiles_update on public.pay_profiles for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.payroll_runs enable row level security;

drop policy if exists payroll_runs_select on public.payroll_runs;
create policy payroll_runs_select on public.payroll_runs for select
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists payroll_runs_insert on public.payroll_runs;
create policy payroll_runs_insert on public.payroll_runs for insert
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists payroll_runs_update on public.payroll_runs;
create policy payroll_runs_update on public.payroll_runs for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.performance_reviews enable row level security;

drop policy if exists performance_reviews_select on public.performance_reviews;
create policy performance_reviews_select on public.performance_reviews for select
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()));

drop policy if exists performance_reviews_insert on public.performance_reviews;
create policy performance_reviews_insert on public.performance_reviews for insert
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists performance_reviews_update on public.performance_reviews;
create policy performance_reviews_update on public.performance_reviews for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or staff_name = (select public.current_staff_name()));

alter table public.onboarding_cases enable row level security;

drop policy if exists onboarding_cases_select on public.onboarding_cases;
create policy onboarding_cases_select on public.onboarding_cases for select
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists onboarding_cases_insert on public.onboarding_cases;
create policy onboarding_cases_insert on public.onboarding_cases for insert
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists onboarding_cases_update on public.onboarding_cases;
create policy onboarding_cases_update on public.onboarding_cases for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.offboarding_cases enable row level security;

drop policy if exists offboarding_cases_select on public.offboarding_cases;
create policy offboarding_cases_select on public.offboarding_cases for select
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists offboarding_cases_insert on public.offboarding_cases;
create policy offboarding_cases_insert on public.offboarding_cases for insert
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists offboarding_cases_update on public.offboarding_cases;
create policy offboarding_cases_update on public.offboarding_cases for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));


-- ----------------------------------------------------------------------------
-- 6. Ops: tasks, it_tickets, branch_notices, branch_issues,
--    branch_day_logs, branch_content_requests, marketing_support_requests
-- ----------------------------------------------------------------------------

alter table public.tasks enable row level security;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert with check ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update
using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())))
with check ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))) or created_by = (select public.current_staff_name()));

alter table public.it_tickets enable row level security;

drop policy if exists it_tickets_select on public.it_tickets;
create policy it_tickets_select on public.it_tickets for select using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists it_tickets_insert on public.it_tickets;
create policy it_tickets_insert on public.it_tickets for insert with check ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists it_tickets_update on public.it_tickets;
create policy it_tickets_update on public.it_tickets for update
using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())))
with check ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

alter table public.branch_notices enable row level security;

drop policy if exists branch_notices_select on public.branch_notices;
create policy branch_notices_select on public.branch_notices for select using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists branch_notices_insert on public.branch_notices;
create policy branch_notices_insert on public.branch_notices for insert
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists branch_notices_update on public.branch_notices;
create policy branch_notices_update on public.branch_notices for update
using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())))
with check ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

alter table public.branch_issues enable row level security;

drop policy if exists branch_issues_select on public.branch_issues;
create policy branch_issues_select on public.branch_issues for select using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists branch_issues_insert on public.branch_issues;
create policy branch_issues_insert on public.branch_issues for insert with check ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists branch_issues_update on public.branch_issues;
create policy branch_issues_update on public.branch_issues for update
using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())))
with check ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

alter table public.branch_day_logs enable row level security;

drop policy if exists branch_day_logs_select on public.branch_day_logs;
create policy branch_day_logs_select on public.branch_day_logs for select using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists branch_day_logs_insert on public.branch_day_logs;
create policy branch_day_logs_insert on public.branch_day_logs for insert
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists branch_day_logs_update on public.branch_day_logs;
create policy branch_day_logs_update on public.branch_day_logs for update
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))))
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.branch_content_requests enable row level security;

drop policy if exists branch_content_requests_select on public.branch_content_requests;
create policy branch_content_requests_select on public.branch_content_requests for select
using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())) or (select public.is_marketing()));

drop policy if exists branch_content_requests_insert on public.branch_content_requests;
create policy branch_content_requests_insert on public.branch_content_requests for insert
with check ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())));

drop policy if exists branch_content_requests_update on public.branch_content_requests;
create policy branch_content_requests_update on public.branch_content_requests for update
using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())) or (select public.is_marketing()));

drop policy if exists branch_content_requests_delete on public.branch_content_requests;
create policy branch_content_requests_delete on public.branch_content_requests for delete
using ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

alter table public.marketing_support_requests enable row level security;

drop policy if exists marketing_support_requests_select on public.marketing_support_requests;
create policy marketing_support_requests_select on public.marketing_support_requests for select
using ((select public.is_super_admin()) or (branch is not null and branch = (select public.current_branch())) or (select public.is_marketing()));

drop policy if exists marketing_support_requests_insert on public.marketing_support_requests;
create policy marketing_support_requests_insert on public.marketing_support_requests for insert
with check ((select public.is_super_admin()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists marketing_support_requests_update on public.marketing_support_requests;
create policy marketing_support_requests_update on public.marketing_support_requests for update
using ((select public.is_super_admin()) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (select public.is_marketing()));


-- ----------------------------------------------------------------------------
-- 7. Marketing department
-- ----------------------------------------------------------------------------

alter table public.marketing_leads enable row level security;
drop policy if exists marketing_leads_all on public.marketing_leads;
create policy marketing_leads_all on public.marketing_leads for all
using ((select public.is_super_admin()) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (select public.is_marketing()));

alter table public.marketing_campaigns enable row level security;
drop policy if exists marketing_campaigns_all on public.marketing_campaigns;
create policy marketing_campaigns_all on public.marketing_campaigns for all
using ((select public.is_super_admin()) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (select public.is_marketing()));

alter table public.marketing_ad_spend enable row level security;
drop policy if exists marketing_ad_spend_all on public.marketing_ad_spend;
create policy marketing_ad_spend_all on public.marketing_ad_spend for all
using ((select public.is_super_admin()) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (select public.is_marketing()));

alter table public.marketing_content_requests enable row level security;

drop policy if exists marketing_content_requests_select on public.marketing_content_requests;
create policy marketing_content_requests_select on public.marketing_content_requests for select
using ((select public.is_super_admin()) or (select public.is_marketing()) or (target_branch is not null and target_branch = (select public.current_branch())));

drop policy if exists marketing_content_requests_insert on public.marketing_content_requests;
create policy marketing_content_requests_insert on public.marketing_content_requests for insert
with check ((select public.is_super_admin()) or (select public.is_marketing()));

drop policy if exists marketing_content_requests_update on public.marketing_content_requests;
create policy marketing_content_requests_update on public.marketing_content_requests for update
using ((select public.is_super_admin()) or (select public.is_marketing()) or (target_branch is not null and target_branch = (select public.current_branch())))
with check ((select public.is_super_admin()) or (select public.is_marketing()) or (target_branch is not null and target_branch = (select public.current_branch())));

drop policy if exists marketing_content_requests_delete on public.marketing_content_requests;
create policy marketing_content_requests_delete on public.marketing_content_requests for delete
using ((select public.is_super_admin()) or (select public.is_marketing()));

alter table public.marketing_content_items enable row level security;
drop policy if exists marketing_content_items_all on public.marketing_content_items;
create policy marketing_content_items_all on public.marketing_content_items for all
using ((select public.is_super_admin()) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (select public.is_marketing()));

alter table public.marketing_design_tasks enable row level security;
drop policy if exists marketing_design_tasks_all on public.marketing_design_tasks;
create policy marketing_design_tasks_all on public.marketing_design_tasks for all
using ((select public.is_super_admin()) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (select public.is_marketing()));

alter table public.marketing_video_tasks enable row level security;
drop policy if exists marketing_video_tasks_all on public.marketing_video_tasks;
create policy marketing_video_tasks_all on public.marketing_video_tasks for all
using ((select public.is_super_admin()) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (select public.is_marketing()));

alter table public.marketing_posts enable row level security;
drop policy if exists marketing_posts_all on public.marketing_posts;
create policy marketing_posts_all on public.marketing_posts for all
using ((select public.is_super_admin()) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (select public.is_marketing()));

alter table public.marketing_seo_tasks enable row level security;
drop policy if exists marketing_seo_tasks_all on public.marketing_seo_tasks;
create policy marketing_seo_tasks_all on public.marketing_seo_tasks for all
using ((select public.is_super_admin()) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (select public.is_marketing()));

alter table public.marketing_seo_keywords enable row level security;
drop policy if exists marketing_seo_keywords_all on public.marketing_seo_keywords;
create policy marketing_seo_keywords_all on public.marketing_seo_keywords for all
using ((select public.is_super_admin()) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (select public.is_marketing()));

alter table public.marketing_pings enable row level security;

drop policy if exists marketing_pings_select on public.marketing_pings;
create policy marketing_pings_select on public.marketing_pings for select
using ((select public.is_super_admin()) or (select public.is_marketing()) or ((select public.is_branch_manager()) and (branch is not null and branch = (select public.current_branch()))));

drop policy if exists marketing_pings_insert on public.marketing_pings;
create policy marketing_pings_insert on public.marketing_pings for insert with check ((select public.is_super_admin()) or (select public.is_marketing()));

drop policy if exists marketing_pings_update on public.marketing_pings;
create policy marketing_pings_update on public.marketing_pings for update
using ((select public.is_super_admin()) or (select public.is_marketing()))
with check ((select public.is_super_admin()) or (select public.is_marketing()));

drop policy if exists marketing_pings_delete on public.marketing_pings;
create policy marketing_pings_delete on public.marketing_pings for delete using ((select public.is_super_admin()) or (select public.is_marketing()));


-- ----------------------------------------------------------------------------
-- 8. Audit log
-- ----------------------------------------------------------------------------

alter table public.audit_log enable row level security;

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select using ((select public.is_super_admin()));

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert with check ((select public.is_active_staff()));


-- ============================================================================
-- Source: supabase/migrations/2026-09-29-students-city-pool.sql
-- ============================================================================
-- ============================================================================
-- City-Wide Lead Pool — schema + RLS for routing a Marketing lead to every
-- branch in a city instead of one branch, and letting the first counselor to
-- claim it lock it to their own branch (first-accept-first-get).
--
-- Builds on the existing single-branch "blind broadcast" pool
-- (students.broadcast_branch / claimed_by / claimed_at, wired in
-- src/App.tsx's handleMarketingPush / handleAcceptLead): this adds a second,
-- city-wide broadcast column (`broadcast_city`) alongside it, so the same
-- claim mechanics now work at either scope.
--
-- Also fixes a real gap this feature would otherwise inherit: students_insert
-- (2026-09-29-rls-initplan-perf.sql) requires `not is_marketing()`, so a
-- genuine Marketing-role account can never satisfy it — `insert into students`
-- from handleMarketingPush / handleMarketingPushToCityPool has been silently
-- failing RLS for real Marketing users all along (swallowed by the `.catch`
-- in App.tsx). Fixed here with a narrow carve-out: Marketing may INSERT only
-- an unclaimed broadcast row (broadcast_branch or broadcast_city set,
-- claimed_by null) — no broader read/write access to students is granted.
--
-- Safe to re-run: `add column if not exists`, `drop policy if exists` +
-- `create policy`, `create or replace function`.
-- ============================================================================

alter table public.students add column if not exists broadcast_city text;
create index if not exists idx_students_broadcast_city on public.students (broadcast_city) where broadcast_city is not null;

alter table public.marketing_leads add column if not exists city_pool text;

-- The city (branches.location) of the caller's own branch — null for staff
-- with no branch or an unrecognised one. STABLE + SECURITY DEFINER, same
-- pattern as current_branch() and friends (avoids RLS recursion on `staff`).
create or replace function public.current_branch_city() returns text
language sql stable security definer set search_path = public as $$
  select b.location from public.branches b where b.name = public.current_branch();
$$;

drop policy if exists students_select on public.students;
create policy students_select on public.students for select
using (
  (select public.is_super_admin())
  or ((branch is not null and branch = (select public.current_branch())) and not (select public.is_marketing()))
  or (
    not (select public.is_marketing())
    and claimed_by is null
    and broadcast_city is not null
    and broadcast_city = (select public.current_branch_city())
  )
);

drop policy if exists students_insert on public.students;
create policy students_insert on public.students for insert
with check (
  (select public.is_super_admin())
  or ((branch is not null and branch = (select public.current_branch())) and not (select public.is_marketing()))
  or (
    (select public.is_marketing())
    and (broadcast_branch is not null or broadcast_city is not null)
    and claimed_by is null
  )
);

drop policy if exists students_update on public.students;
create policy students_update on public.students for update
using (
  (select public.is_super_admin())
  or ((branch is not null and branch = (select public.current_branch())) and not (select public.is_marketing()))
  or (
    not (select public.is_marketing())
    and claimed_by is null
    and broadcast_city is not null
    and broadcast_city = (select public.current_branch_city())
  )
)
with check (
  (select public.is_super_admin())
  or ((branch is not null and branch = (select public.current_branch())) and not (select public.is_marketing()))
);

-- students_delete is unchanged (Branch Manager, own branch, or Super Admin) —
-- an unclaimed pool lead has no owning branch manager yet, by design.


-- ============================================================================
-- Source: supabase/migrations/2026-09-30-marketing-lead-tracking.sql
-- ============================================================================
-- ============================================================================
-- Fix: Marketing's "Lead Monitoring" page (src/components/marketing/MktLeads.tsx
-- LeadsMonitoring, nav key mkt-monitoring) shows every assigned lead stuck at
-- "In branch queue" / "Unclaimed" forever, for every Marketing sub-role
-- including Marketing Manager.
--
-- Root cause: trackMarketingLeads() (src/marketingDept.ts) joins each assigned
-- marketing_leads row to `students`, `counselor_students` and `applications`
-- to work out the lead's real branch, counselor and funnel step. But
-- 2026-09-27-rls-lockdown.sql (and reaffirmed by 2026-09-27-marketing-
-- branch-leak-fix.sql, a P0 fix for a real PII leak) denies Marketing any
-- `select` on those three tables — intentionally, since Marketing accounts
-- carry a meaningless placeholder `branch` value that must never be used to
-- match real branch-scoped rows. Net effect: `students`/`counselor_students`/
-- `applications` are always empty for a Marketing session, so the join never
-- finds anything, and every tracked lead looks unclaimed.
--
-- Fix here does NOT touch that RLS (doing so would reopen the P0 leak).
-- Instead: three narrow, read-only, SECURITY DEFINER functions, each
-- returning only the columns trackMarketingLeads actually reads, and only
-- for rows that are the intake/consultation/application behind one of THIS
-- org's own marketing_leads (never a whole branch's data, never phone/email/
-- address/documents/money). Each function re-checks is_marketing() itself,
-- so calling it as any other role returns zero rows regardless of who calls
-- it from the client.
--
-- Safe to re-run.
-- ============================================================================

create or replace function public.marketing_tracked_intakes()
returns table (
  id text,
  branch text,
  broadcast_branch text,
  assigned_counselor text,
  claimed_at text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.branch, s.broadcast_branch, s.assigned_counselor, s.claimed_at
  from public.students s
  where public.is_marketing()
    and exists (select 1 from public.marketing_leads ml where ml.intake_id = s.id);
$$;

create or replace function public.marketing_tracked_consultations()
returns table (
  id text,
  client_id text,
  assigned_counselor text,
  assigned_date text,
  consultation_status text,
  completed_date text,
  outcome text,
  follow_up_date text
)
language sql stable security definer set search_path = public as $$
  select cs.id, cs.client_id, cs.assigned_counselor, cs.assigned_date, cs.consultation_status,
         cs.completed_date, cs.outcome, cs.follow_up_date
  from public.counselor_students cs
  where public.is_marketing()
    and exists (select 1 from public.marketing_leads ml where ml.intake_id = cs.id);
$$;

create or replace function public.marketing_tracked_applications()
returns table (
  client_id text,
  offer_applications jsonb,
  visa_application jsonb,
  consultation_date text,
  withdrawn boolean
)
language sql stable security definer set search_path = public as $$
  select a.client_id, a.offer_applications, a.visa_application, a.consultation_date, a.withdrawn
  from public.applications a
  where public.is_marketing()
    and a.client_id is not null
    and exists (
      select 1 from public.counselor_students cs
      join public.marketing_leads ml on ml.intake_id = cs.id
      where cs.client_id = a.client_id
    );
$$;

grant execute on function public.marketing_tracked_intakes() to authenticated;
grant execute on function public.marketing_tracked_consultations() to authenticated;
grant execute on function public.marketing_tracked_applications() to authenticated;


-- ============================================================================
-- Source: supabase/migrations/2026-09-30-marketing-lead-revenue.sql
-- ============================================================================
-- ============================================================================
-- Follow-up to 2026-09-30-marketing-lead-tracking.sql — the same RLS gap
-- (Marketing has no select on the tables trackMarketingLeads needs) also
-- zeroes out the "marketing-attributed revenue" figure Lead Monitoring shows
-- the Marketing Manager: fin_transactions_select denies Marketing entirely
-- (2026-09-27-marketing-branch-leak-fix.sql), so `finTransactions` is always
-- empty for a Marketing session and trackMarketingLeads' revenue sum is
-- always 0, even though App.tsx already gates the figure to Marketing
-- Manager only (see the `marketingSeesRevenue` check in App.tsx).
--
-- Same fix shape: one narrow SECURITY DEFINER function, returning only the
-- columns isLivePayment()/isPaidOutRefund() (src/finance.ts) need — kind,
-- amount, void, status, client — and only for transactions belonging to a
-- client behind one of THIS org's own marketing_leads. Never a branch's full
-- ledger, never receipts/notes/method/who-collected-it. Gated on
-- is_marketing_manager() (not is_marketing()), matching the client-side rule
-- that only the Manager sub-role sees revenue at all.
--
-- Safe to re-run.
-- ============================================================================

create or replace function public.marketing_tracked_revenue()
returns table (
  client_id text,
  kind text,
  amount numeric,
  void jsonb,
  status text
)
language sql stable security definer set search_path = public as $$
  select t.client_id, t.kind, t.amount, t.void, t.status
  from public.fin_transactions t
  where public.is_marketing_manager()
    and exists (
      select 1 from public.counselor_students cs
      join public.marketing_leads ml on ml.intake_id = cs.id
      where cs.client_id = t.client_id
    );
$$;

grant execute on function public.marketing_tracked_revenue() to authenticated;




-- ============================================================================
-- Fix: a client a counselor adds ("Add Client") can vanish from their Clients
-- list after a refresh.
--
-- Root cause: the next Client ID (CSC-<year>-<n>) was computed in the browser
-- as max+1 over the counselor_students/applications rows the caller can SEE —
-- and RLS limits those to the caller's own branch. Another branch may already
-- hold that number, so the counselor_students insert hits the unique index on
-- client_id and fails; the intake row is saved as 'Assigned' to the counselor
-- but their client-list row never is. Same for a Receptionist/Branch Manager
-- assigning a new client.
--
-- Fix: issue the number here, across ALL branches. Returns only the next ID
-- string — no client data is exposed.
--
-- Safe to re-run.
-- ============================================================================

create or replace function public.next_client_id(p_year int) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_prefix text := 'CSC-' || p_year || '-';
  v_max int;
begin
  if not public.is_active_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select coalesce(max(substring(ids.client_id from length(v_prefix) + 1)::int), 1000) into v_max
  from (
    select client_id from public.counselor_students
    union all
    select client_id from public.applications
  ) ids
  where ids.client_id ~ ('^' || v_prefix || '[0-9]+$');
  return v_prefix || (v_max + 1);
end;
$$;

grant execute on function public.next_client_id(int) to authenticated;
