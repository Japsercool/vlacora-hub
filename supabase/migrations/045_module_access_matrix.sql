create table if not exists public.hub_module_access_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  station_slug text not null default 'all',
  module_key text not null,
  access_level text not null check (access_level in ('hidden','view','edit','manage')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, station_slug, module_key)
);
create index if not exists hub_module_access_overrides_station_idx on public.hub_module_access_overrides(station_slug,module_key);
alter table public.hub_module_access_overrides enable row level security;
grant select,insert,update,delete on public.hub_module_access_overrides to authenticated;
create policy "module access own or manager read" on public.hub_module_access_overrides for select to authenticated using (user_id=auth.uid() or public.vlacora_current_role()='superadmin' or (station_slug<>'all' and public.vlacora_can_manage_station(station_slug)));
create policy "module access managers insert" on public.hub_module_access_overrides for insert to authenticated with check (public.vlacora_current_role()='superadmin' or (station_slug<>'all' and public.vlacora_can_manage_station(station_slug)));
create policy "module access managers update" on public.hub_module_access_overrides for update to authenticated using (public.vlacora_current_role()='superadmin' or (station_slug<>'all' and public.vlacora_can_manage_station(station_slug))) with check (public.vlacora_current_role()='superadmin' or (station_slug<>'all' and public.vlacora_can_manage_station(station_slug)));
create policy "module access managers delete" on public.hub_module_access_overrides for delete to authenticated using (public.vlacora_current_role()='superadmin' or (station_slug<>'all' and public.vlacora_can_manage_station(station_slug)));
