create schema if not exists pulse_meta;
create table if not exists pulse_meta.backend_state(
  singleton boolean primary key default true check (singleton),
  active_backend text not null default 'external_postgres',
  source text not null default 'supabase',
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
