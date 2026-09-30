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
