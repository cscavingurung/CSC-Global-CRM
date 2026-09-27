-- Records who triggered each notification, shown as "by <name>" on dashboard activity feeds.
-- Safe to run against an existing database — only adds a column.
--
-- Already folded into supabase/schema.sql for fresh databases.

alter table notifications add column if not exists actor_name text;
