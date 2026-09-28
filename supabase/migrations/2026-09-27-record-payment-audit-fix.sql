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
