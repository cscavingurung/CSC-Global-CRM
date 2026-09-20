
create table if not exists students (
  id text primary key,
  name text not null,
  phone text not null,
  email text not null,
  country text not null,
  purpose text not null,
  dob text not null,
  gender text not null,
  marital_status text not null,
  academic_qualification text not null,
  ielts_pte text not null,
  work_experience text not null,
  submitted_at text not null,
  added_by text,
  visit_date_time text,
  referred_through text,
  platform_source text,
  broadcast_branch text,
  broadcast_at text,
  claimed_by text,
  claimed_at text,
  revisited_at text,
  status text not null default 'New',
  assigned_counselor text,
  branch text not null default ''
);

alter table students add column if not exists added_by text;
alter table students add column if not exists visit_date_time text;
alter table students add column if not exists referred_through text;
alter table students add column if not exists platform_source text;
alter table students add column if not exists broadcast_branch text;
alter table students add column if not exists broadcast_at text;
alter table students add column if not exists claimed_by text;
alter table students add column if not exists claimed_at text;
alter table students add column if not exists revisited_at text;

alter table students enable row level security;
drop policy if exists "anon full access" on students;
create policy "anon full access" on students for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table students;
exception when duplicate_object then null;
end $$;



create table if not exists counselors (
  id text primary key,
  name text not null,
  country text not null default '',
  active_assignments integer not null default 0,
  availability text not null default 'Available'
);

alter table counselors enable row level security;
drop policy if exists "anon full access" on counselors;
create policy "anon full access" on counselors for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table counselors;
exception when duplicate_object then null;
end $$;



create table if not exists counselor_students (
  id text primary key,
  client_id text,
  enrolments jsonb,
  name text not null,
  phone text not null,
  email text not null,
  country text not null,
  purpose text not null,
  dob text not null,
  gender text not null,
  marital_status text not null,
  academic_qualification text not null,
  ielts_pte text not null,
  work_experience text not null,
  submitted_at text not null,
  added_by text,
  visit_date_time text,
  referred_through text,
  platform_source text,
  revisited_at text,
  assigned_date text not null,
  assigned_counselor text not null,
  consultation_status text not null default 'Awaiting Consultation',
  consultation_notes text not null default '',
  follow_up_date text,
  completed_date text,
  outcome text not null default 'Pending',
  lead_temperature text,
  follow_up_note text
);

alter table counselor_students add column if not exists client_id text;
alter table counselor_students add column if not exists enrolments jsonb;
alter table counselor_students add column if not exists added_by text;
alter table counselor_students add column if not exists visit_date_time text;
alter table counselor_students add column if not exists referred_through text;
alter table counselor_students add column if not exists platform_source text;
alter table counselor_students add column if not exists revisited_at text;
alter table counselor_students add column if not exists lead_temperature text;
alter table counselor_students add column if not exists follow_up_note text;

alter table counselor_students enable row level security;
drop policy if exists "anon full access" on counselor_students;
create policy "anon full access" on counselor_students for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table counselor_students;
exception when duplicate_object then null;
end $$;


create table if not exists applications (
  id text primary key,
  client_id text,
  name text not null,
  phone text not null,
  email text not null,
  country text not null,
  purpose text not null,
  dob text,
  gender text,
  marital_status text,
  academic_qualification text,
  ielts_pte text,
  work_experience text,
  counselor text not null,
  consultation_date text not null,
  added_by text,
  platform_source text,
  visit_date_time text,
  consultation_notes text not null default '',
  branch text not null,
  offer_applications jsonb not null default '[]',
  visa_application jsonb,
  withdrawn boolean not null default false,
  withdrawn_date text,
  notes jsonb not null default '[]'
);

alter table applications add column if not exists client_id text;
alter table applications add column if not exists added_by text;
alter table applications add column if not exists platform_source text;
alter table applications add column if not exists visit_date_time text;
alter table applications add column if not exists notes jsonb not null default '[]';

alter table applications enable row level security;
drop policy if exists "anon full access" on applications;
create policy "anon full access" on applications for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table applications;
exception when duplicate_object then null;
end $$;



create table if not exists staff (
  id text primary key,
  name text not null,
  email text not null unique,
  password text not null,
  role text not null,
  status text not null default 'Active',
  branch text not null
);

alter table staff enable row level security;
drop policy if exists "anon full access" on staff;
create policy "anon full access" on staff for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table staff;
exception when duplicate_object then null;
end $$;



create table if not exists branches (
  id text primary key,
  name text not null,
  location text not null default '',
  manager text
);

alter table branches enable row level security;
drop policy if exists "anon full access" on branches;
create policy "anon full access" on branches for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table branches;
exception when duplicate_object then null;
end $$;



create table if not exists notifications (
  id text primary key,
  trigger text not null,
  student_name text not null,
  message_before text not null default '',
  message_after text not null default '',
  created_at timestamptz not null default now(),
  read boolean not null default false,
  navigate_to text not null default '',
  role text not null,
  branch text,
  recipient_name text,
  lead_id text
);

alter table notifications add column if not exists lead_id text;

alter table notifications enable row level security;
drop policy if exists "anon full access" on notifications;
create policy "anon full access" on notifications for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table notifications;
exception when duplicate_object then null;
end $$;



create table if not exists commissions (
  id text primary key,
  student_name text not null,
  branch text not null,
  consultant text not null,
  partner text not null,
  full_fee numeric not null default 0,
  commission_rate numeric not null default 0,
  commission_status text not null default 'Pending'
);

alter table commissions enable row level security;
drop policy if exists "anon full access" on commissions;
create policy "anon full access" on commissions for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table commissions;
exception when duplicate_object then null;
end $$;



create table if not exists partners (
  id text primary key,
  name text not null,
  type text not null default 'University',
  commission_rate numeric not null default 0,
  courses jsonb not null default '[]'
);

alter table partners enable row level security;
drop policy if exists "anon full access" on partners;
create policy "anon full access" on partners for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table partners;
exception when duplicate_object then null;
end $$;
