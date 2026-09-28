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
