-- VLACORA HUB 0.23.0 — central official communications with generic attachments.

create table if not exists public.hub_announcements(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  title text not null,
  body text not null default '',
  category text not null default 'Algemeen',
  importance text not null default 'normal' check(importance in ('normal','important')),
  requires_acknowledgement boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hub_announcements_station_created_idx
  on public.hub_announcements(station_slug,created_at desc);

alter table public.hub_announcements enable row level security;

drop policy if exists "station team can read announcements" on public.hub_announcements;
create policy "station team can read announcements" on public.hub_announcements for select to authenticated
using(station_slug='all' or public.vlacora_can_access_station(station_slug));

drop policy if exists "editors can create announcements" on public.hub_announcements;
create policy "editors can create announcements" on public.hub_announcements for insert to authenticated
with check(
  created_by=auth.uid()
  and (station_slug='all' or public.vlacora_can_access_station(station_slug))
  and public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer','redactie')
);

drop policy if exists "editors can update announcements" on public.hub_announcements;
create policy "editors can update announcements" on public.hub_announcements for update to authenticated
using(
  (station_slug='all' or public.vlacora_can_access_station(station_slug))
  and public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer','redactie')
)
with check(station_slug='all' or public.vlacora_can_access_station(station_slug));

drop policy if exists "managers can delete announcements" on public.hub_announcements;
create policy "managers can delete announcements" on public.hub_announcements for delete to authenticated
using(
  (station_slug='all' or public.vlacora_can_access_station(station_slug))
  and public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
);

do $$ begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='hub_announcements'
  ) then
    alter publication supabase_realtime add table public.hub_announcements;
  end if;
end $$;
