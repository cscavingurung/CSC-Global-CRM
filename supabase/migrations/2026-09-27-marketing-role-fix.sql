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
