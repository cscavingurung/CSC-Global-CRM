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
