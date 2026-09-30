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
