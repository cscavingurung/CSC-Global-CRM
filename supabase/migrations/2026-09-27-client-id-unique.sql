-- Client IDs must be unique: the finance ledger, commissions and reports group records by them.
-- Older builds generated a random 4-digit Client ID, so check for duplicates before adding the
-- constraint:
--
--   select client_id, count(*) from counselor_students where client_id is not null group by 1 having count(*) > 1;
--
-- Resolve any rows returned (give one of each pair a new ID, and update its application and
-- finance rows to match), then run:
create unique index if not exists counselor_students_client_id_key on counselor_students (client_id) where client_id is not null;
