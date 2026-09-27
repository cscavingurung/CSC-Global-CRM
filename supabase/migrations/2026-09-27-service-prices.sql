-- Service Charges: the Super Admin's price list (per service + destination country, with an
-- "All countries" fallback). Append-only — a fee change or retirement is a new row with its own
-- effective date, so a client's historical fee can always be explained.
create table if not exists service_prices (
  id text primary key,
  name text not null,
  category text not null,
  country text not null,
  fee numeric not null check (fee >= 0),
  currency text not null default 'NPR',
  effective_from date not null,
  active boolean not null default true,
  note text,
  set_by text not null,
  set_at text not null
);
create index if not exists service_prices_lookup on service_prices (lower(name), lower(country), effective_from desc);

alter table service_prices enable row level security;
-- SECURITY (docs/SECURITY_AUDIT.md): replace with "Super Admin may insert; everyone signed in may
-- read; nobody may update/delete" once Supabase Auth is in place.
drop policy if exists "anon full access" on service_prices;
create policy "anon full access" on service_prices for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table service_prices;
exception when duplicate_object then null;
end $$;
