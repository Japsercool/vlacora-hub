-- Niet-geheime doelmetadata. Wachtwoorden blijven uitsluitend op de PULSE Data Gateway.
alter table public.hub_data_backend_configs
  add column if not exists target_host text not null default '',
  add column if not exists target_port integer not null default 5432,
  add column if not exists target_user text not null default '',
  add column if not exists file_migration_enabled boolean not null default true;
