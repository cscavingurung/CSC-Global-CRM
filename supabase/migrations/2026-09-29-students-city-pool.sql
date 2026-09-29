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
