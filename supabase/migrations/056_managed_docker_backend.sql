alter table public.hub_data_backend_configs
  add column if not exists deployment_mode text not null default 'managed_docker' check (deployment_mode in ('managed_docker','existing_postgres')),
  add column if not exists gateway_setup_complete boolean not null default false,
  add column if not exists gateway_version text not null default '',
  add column if not exists server_label text not null default '',
  add column if not exists postgres_managed boolean not null default true;

comment on column public.hub_data_backend_configs.deployment_mode is 'managed_docker = PostgreSQL and PULSE Gateway are provisioned together by the PULSE server installer; existing_postgres = user supplies external PostgreSQL credentials.';
comment on column public.hub_data_backend_configs.postgres_managed is 'True when PostgreSQL credentials are generated and kept server-side by the PULSE managed Docker stack.';
