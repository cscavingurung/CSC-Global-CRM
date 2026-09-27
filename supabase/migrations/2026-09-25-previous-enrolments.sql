-- Re-enrolling a closed file (e.g. after a refund) archives that round's offers and visa
-- attempt into previous_enrolments, so the Status Tracker can start again for a new course
-- or country. Safe to run against an existing database — only adds a column.
--
-- Already folded into supabase/schema.sql for fresh databases.

alter table applications add column if not exists previous_enrolments jsonb not null default '[]';
