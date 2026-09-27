-- Enrolment document checklist (Academics, Passport, English Proficiency, Letter of
-- Recommendation + documents the V/A Officer adds), shown on the Status Tracker's Enrolled
-- step. Safe to run against an existing database — only adds a column.
--
-- Already folded into supabase/schema.sql for fresh databases.

alter table applications add column if not exists enrolment_checklist jsonb;
