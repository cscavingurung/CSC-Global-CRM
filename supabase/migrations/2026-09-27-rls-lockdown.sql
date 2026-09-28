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
