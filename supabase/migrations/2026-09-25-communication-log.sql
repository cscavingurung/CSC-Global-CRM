-- Communication Log on client profiles: every call, WhatsApp, email, SMS, visit or video
-- consultation with a client. Safe to run against an existing database — only creates a table.
--
-- Already folded into supabase/schema.sql for fresh databases.

create table if not exists communication_logs (
  id text primary key,
  client_key text not null,
  client_name text not null,
  channel text not null,
  direction text not null,
  occurred_at timestamptz not null,
  summary text not null,
  outcome text not null default '',
  next_action text,
  next_action_date text,
  logged_by text not null,
  logged_by_role text not null,
  created_at timestamptz not null default now()
);
create index if not exists communication_logs_client_key_idx on communication_logs (client_key);

alter table communication_logs enable row level security;
drop policy if exists "anon full access" on communication_logs;
create policy "anon full access" on communication_logs for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table communication_logs;
exception when duplicate_object then null;
end $$;
