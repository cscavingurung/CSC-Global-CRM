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
