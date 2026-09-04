-- PULSE 0.32.0
-- Minieme routing-pointer in Supabase naast Auth. Alle operationele PULSE-data
-- verhuist naar de eigen PostgreSQL; deze rij vertelt nieuwe browsers alleen
-- waar die data-backend te vinden is.
create table if not exists public.pulse_backend_pointer (
  scope text primary key default 'global',
  active_backend text not null default 'supabase' check(active_backend in ('supabase','external_postgres')),
  gateway_url text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.pulse_backend_pointer enable row level security;
grant select,insert,update on public.pulse_backend_pointer to authenticated;

drop policy if exists "pulse backend pointer read" on public.pulse_backend_pointer;
create policy "pulse backend pointer read" on public.pulse_backend_pointer
for select to authenticated using (true);

drop policy if exists "pulse backend pointer superadmin insert" on public.pulse_backend_pointer;
create policy "pulse backend pointer superadmin insert" on public.pulse_backend_pointer
for insert to authenticated with check (public.vlacora_current_role()='superadmin');

drop policy if exists "pulse backend pointer superadmin update" on public.pulse_backend_pointer;
create policy "pulse backend pointer superadmin update" on public.pulse_backend_pointer
for update to authenticated
using (public.vlacora_current_role()='superadmin')
with check (public.vlacora_current_role()='superadmin');

insert into public.pulse_backend_pointer(scope,active_backend,gateway_url)
select 'global',active_backend,gateway_url
from public.hub_data_backend_configs
where scope='global'
on conflict(scope) do update
set active_backend=excluded.active_backend,
    gateway_url=excluded.gateway_url,
    updated_at=now();
