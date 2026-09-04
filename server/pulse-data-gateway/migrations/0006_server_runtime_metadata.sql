create table if not exists pulse_meta.server_runtime (
  singleton boolean primary key default true check (singleton),
  gateway_version text not null default '',
  last_upgrade_at timestamptz,
  updated_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

insert into pulse_meta.server_runtime(singleton,gateway_version,last_upgrade_at,details)
values(true,'0.32.0',now(),jsonb_build_object('managedDocker',true))
on conflict(singleton) do update set gateway_version=excluded.gateway_version,last_upgrade_at=now(),updated_at=now();
