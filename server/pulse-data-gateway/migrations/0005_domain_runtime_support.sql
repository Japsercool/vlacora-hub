-- 0.30.1: site/gateway URL metadata is part of the normal PULSE schema snapshot.
-- Gateway CORS is stored in /app/data/domains.json so a domain change does not require a database migration.
create table if not exists pulse_runtime_urls (
  id smallint primary key default 1 check (id = 1),
  site_url text not null default '',
  gateway_public_url text not null default '',
  updated_at timestamptz not null default now()
);
insert into pulse_runtime_urls(id) values(1) on conflict(id) do nothing;
