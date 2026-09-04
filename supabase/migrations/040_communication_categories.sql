-- PULSE 0.25.0 — manageable categories for official communications.
-- Product rebranding does not rename existing database/RPC identifiers; those remain stable for compatibility.

create table if not exists public.hub_communication_categories(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hub_communication_categories_station_name_uidx
  on public.hub_communication_categories(station_slug,lower(name));
create index if not exists hub_communication_categories_station_sort_idx
  on public.hub_communication_categories(station_slug,active desc,sort_order,name);

alter table public.hub_communication_categories enable row level security;

drop policy if exists "team can read communication categories" on public.hub_communication_categories;
create policy "team can read communication categories" on public.hub_communication_categories
for select to authenticated
using(station_slug='all' or public.vlacora_can_access_station(station_slug));

drop policy if exists "managers can create communication categories" on public.hub_communication_categories;
create policy "managers can create communication categories" on public.hub_communication_categories
for insert to authenticated
with check(
  (station_slug='all' and public.vlacora_current_role()='superadmin')
  or (
    station_slug<>'all'
    and public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
    and public.vlacora_can_access_station(station_slug)
  )
);

drop policy if exists "managers can update communication categories" on public.hub_communication_categories;
create policy "managers can update communication categories" on public.hub_communication_categories
for update to authenticated
using(
  (station_slug='all' and public.vlacora_current_role()='superadmin')
  or (
    station_slug<>'all'
    and public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
    and public.vlacora_can_access_station(station_slug)
  )
)
with check(
  (station_slug='all' and public.vlacora_current_role()='superadmin')
  or (
    station_slug<>'all'
    and public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
    and public.vlacora_can_access_station(station_slug)
  )
);

drop policy if exists "managers can delete communication categories" on public.hub_communication_categories;
create policy "managers can delete communication categories" on public.hub_communication_categories
for delete to authenticated
using(
  (station_slug='all' and public.vlacora_current_role()='superadmin')
  or (
    station_slug<>'all'
    and public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
    and public.vlacora_can_access_station(station_slug)
  )
);

insert into public.hub_communication_categories(station_slug,name,sort_order)
values
  ('all','Algemeen',10),
  ('all','Programmering',20),
  ('all','Redactie',30),
  ('all','Muziek',40),
  ('all','Social',50),
  ('all','Techniek',60)
on conflict do nothing;
