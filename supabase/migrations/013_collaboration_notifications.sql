-- VLACORA HUB 0.13.0 — collaboration, station roles and required notifications
-- Run after 010_vlacora_hub_core.sql and 011_hitlists.sql.

create table if not exists public.station_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  station_slug text not null,
  role text not null default 'kijker',
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(user_id,station_slug)
);
create index if not exists station_memberships_station_idx on public.station_memberships(station_slug,active);

create table if not exists public.hub_notifications (
  id uuid primary key default gen_random_uuid(),
  station_slug text,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  category text not null default 'Algemeen',
  severity text not null default 'info' check(severity in ('info','warning','critical')),
  requires_acknowledgement boolean not null default false,
  action_path text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists hub_notifications_created_idx on public.hub_notifications(created_at desc);
create index if not exists hub_notifications_station_idx on public.hub_notifications(station_slug,created_at desc);
create index if not exists hub_notifications_recipient_idx on public.hub_notifications(recipient_user_id,created_at desc);

create table if not exists public.hub_notification_receipts (
  notification_id uuid not null references public.hub_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz,
  acknowledged_at timestamptz,
  primary key(notification_id,user_id)
);
create index if not exists hub_notification_receipts_user_idx on public.hub_notification_receipts(user_id);

create or replace function public.vlacora_can_access_station(target_station text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    target_station is null
    or target_station='all'
    or not exists (
      select 1 from public.station_memberships sm0
      where sm0.station_slug=target_station and sm0.active
    )
    or exists (
      select 1 from public.station_memberships sm
      where sm.station_slug=target_station and sm.user_id=auth.uid() and sm.active
    );
$$;

alter table public.station_memberships enable row level security;
alter table public.hub_notifications enable row level security;
alter table public.hub_notification_receipts enable row level security;

drop policy if exists "team can read station memberships" on public.station_memberships;
create policy "team can read station memberships"
on public.station_memberships for select to authenticated using(true);

drop policy if exists "managers can insert station memberships" on public.station_memberships;
create policy "managers can insert station memberships"
on public.station_memberships for insert to authenticated
with check (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','stationmanager'))
);

drop policy if exists "managers can update station memberships" on public.station_memberships;
create policy "managers can update station memberships"
on public.station_memberships for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','stationmanager')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','stationmanager')));

drop policy if exists "managers can delete station memberships" on public.station_memberships;
create policy "managers can delete station memberships"
on public.station_memberships for delete to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','stationmanager')));

drop policy if exists "users can read relevant notifications" on public.hub_notifications;
create policy "users can read relevant notifications"
on public.hub_notifications for select to authenticated
using (
  (recipient_user_id is null or recipient_user_id=auth.uid())
  and public.vlacora_can_access_station(station_slug)
  and (expires_at is null or expires_at > now())
);

drop policy if exists "team can create notifications" on public.hub_notifications;
create policy "team can create notifications"
on public.hub_notifications for insert to authenticated
with check (
  created_by=auth.uid()
  and exists(
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.role in ('superadmin','stationmanager','redactie','muziekredactie','social','techniek')
  )
);

drop policy if exists "creators can update notifications" on public.hub_notifications;
create policy "creators can update notifications"
on public.hub_notifications for update to authenticated
using (
  created_by=auth.uid()
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','stationmanager'))
)
with check (
  created_by=auth.uid()
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','stationmanager'))
);

drop policy if exists "creators can delete notifications" on public.hub_notifications;
create policy "creators can delete notifications"
on public.hub_notifications for delete to authenticated
using (
  created_by=auth.uid()
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','stationmanager'))
);

drop policy if exists "users can read own notification receipts" on public.hub_notification_receipts;
create policy "users can read own notification receipts"
on public.hub_notification_receipts for select to authenticated using(user_id=auth.uid());

drop policy if exists "users can insert own notification receipts" on public.hub_notification_receipts;
create policy "users can insert own notification receipts"
on public.hub_notification_receipts for insert to authenticated with check(user_id=auth.uid());

drop policy if exists "users can update own notification receipts" on public.hub_notification_receipts;
create policy "users can update own notification receipts"
on public.hub_notification_receipts for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Realtime only for the two small notification tables.
-- Presence itself is ephemeral and is NOT written to Postgres.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='hub_notifications'
  ) then
    alter publication supabase_realtime add table public.hub_notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='hub_notification_receipts'
  ) then
    alter publication supabase_realtime add table public.hub_notification_receipts;
  end if;
end $$;
