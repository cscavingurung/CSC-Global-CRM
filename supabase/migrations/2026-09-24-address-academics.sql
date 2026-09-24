-- Adds the Address field and replaces the single Academic Qualification field with a
-- repeatable Academic list (level, stream, GPA, completion year) on the Add Client / Add
-- Lead form. Safe to run against an existing database — only adds columns and relaxes a
-- legacy constraint; nothing existing is dropped or renamed.
--
-- Already folded into supabase/schema.sql for fresh databases — this file is just the
-- incremental version to run against a database that predates today's change.

alter table students add column if not exists address text not null default '';
alter table students add column if not exists academics jsonb not null default '[]';

-- Legacy column, no longer written by the app — relaxed so old rows aren't required to carry it.
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'students' and column_name = 'academic_qualification') then
    alter table students alter column academic_qualification drop not null;
  end if;
end $$;

alter table counselor_students add column if not exists address text not null default '';
alter table counselor_students add column if not exists academics jsonb not null default '[]';

do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'counselor_students' and column_name = 'academic_qualification') then
    alter table counselor_students alter column academic_qualification drop not null;
  end if;
end $$;

alter table applications add column if not exists address text;
alter table applications add column if not exists academics jsonb not null default '[]';
