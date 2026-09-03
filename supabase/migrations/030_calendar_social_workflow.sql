-- VLACORA HUB 0.22.0 — central calendar + richer social workflow.
-- Keeps Supabase/PostgreSQL as the current backend and remains portable to PostgreSQL.

create table if not exists public.hub_calendar_events(
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'station' check(scope in ('personal','station','organization')),
  station_slug text not null default 'all',
  owner_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text not null default '',
  event_type text not null default 'meeting',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text not null default '',
  source_type text not null default 'manual',
  source_id text,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hub_calendar_events_time_idx on public.hub_calendar_events(starts_at,ends_at);
create index if not exists hub_calendar_events_station_idx on public.hub_calendar_events(station_slug,starts_at);
create index if not exists hub_calendar_events_owner_idx on public.hub_calendar_events(owner_user_id,starts_at);
alter table public.hub_calendar_events enable row level security;

create table if not exists public.hub_calendar_event_attendees(
  event_id uuid not null references public.hub_calendar_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  response text not null default 'invited' check(response in ('invited','accepted','declined','tentative')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(event_id,user_id)
);
create index if not exists hub_calendar_event_attendees_user_idx on public.hub_calendar_event_attendees(user_id,event_id);
alter table public.hub_calendar_event_attendees enable row level security;

-- A personal event is visible to its owner, creator and invitees. Station events
-- follow station access. Organisation events are visible to every authenticated HUB user.
drop policy if exists "calendar events are readable" on public.hub_calendar_events;
create policy "calendar events are readable" on public.hub_calendar_events for select to authenticated using(
  scope='organization'
  or (scope='station' and public.vlacora_can_access_station(station_slug))
  or (scope='personal' and (
    owner_user_id=auth.uid() or created_by=auth.uid()
    or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
    or exists(select 1 from public.hub_calendar_event_attendees a where a.event_id=id and a.user_id=auth.uid())
  ))
);

drop policy if exists "calendar events can be created" on public.hub_calendar_events;
create policy "calendar events can be created" on public.hub_calendar_events for insert to authenticated with check(
  created_by=auth.uid()
  and (
    (scope='personal' and (owner_user_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))
    or (scope='station' and public.vlacora_can_access_station(station_slug))
    or (scope='organization' and public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer','redactie','muziekredactie','social'))
  )
);

drop policy if exists "calendar events can be updated" on public.hub_calendar_events;
create policy "calendar events can be updated" on public.hub_calendar_events for update to authenticated using(
  created_by=auth.uid() or owner_user_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
) with check(
  created_by=auth.uid() or owner_user_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
);

drop policy if exists "calendar events can be deleted" on public.hub_calendar_events;
create policy "calendar events can be deleted" on public.hub_calendar_events for delete to authenticated using(
  created_by=auth.uid() or owner_user_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
);

drop policy if exists "calendar attendees are readable" on public.hub_calendar_event_attendees;
create policy "calendar attendees are readable" on public.hub_calendar_event_attendees for select to authenticated using(
  user_id=auth.uid() or exists(select 1 from public.hub_calendar_events e where e.id=event_id)
);
drop policy if exists "calendar attendees can be added" on public.hub_calendar_event_attendees;
create policy "calendar attendees can be added" on public.hub_calendar_event_attendees for insert to authenticated with check(
  added_by=auth.uid() and exists(
    select 1 from public.hub_calendar_events e where e.id=event_id
    and (e.created_by=auth.uid() or e.owner_user_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))
  )
);
drop policy if exists "calendar attendees can be changed" on public.hub_calendar_event_attendees;
create policy "calendar attendees can be changed" on public.hub_calendar_event_attendees for update to authenticated using(
  user_id=auth.uid() or exists(select 1 from public.hub_calendar_events e where e.id=event_id and (e.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))
) with check(true);
drop policy if exists "calendar attendees can be removed" on public.hub_calendar_event_attendees;
create policy "calendar attendees can be removed" on public.hub_calendar_event_attendees for delete to authenticated using(
  user_id=auth.uid() or exists(select 1 from public.hub_calendar_events e where e.id=event_id and (e.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))
);

-- Enrich existing social posts. Nothing here requires a social-network API.
alter table public.hub_social_posts add column if not exists platforms text[] not null default '{}'::text[];
alter table public.hub_social_posts add column if not exists campaign text not null default '';
alter table public.hub_social_posts add column if not exists content_pillar text not null default '';
alter table public.hub_social_posts add column if not exists objective text not null default '';
alter table public.hub_social_posts add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.hub_social_posts add column if not exists reviewer_id uuid references auth.users(id) on delete set null;
alter table public.hub_social_posts add column if not exists due_at timestamptz;
alter table public.hub_social_posts add column if not exists publication_url text not null default '';
alter table public.hub_social_posts add column if not exists internal_notes text not null default '';
alter table public.hub_social_posts add column if not exists checklist jsonb not null default '{"copy":false,"visual":false,"rights":false,"links":false}'::jsonb;
create index if not exists hub_social_posts_assigned_idx on public.hub_social_posts(assigned_to,status,due_at);
create index if not exists hub_social_posts_campaign_idx on public.hub_social_posts(station_slug,campaign,scheduled_at);

-- Keep existing status vocabulary for backward compatibility. The richer workflow is
-- represented with review metadata, owner/reviewer, due date, schedule and checklist.

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_calendar_events') then
    alter publication supabase_realtime add table public.hub_calendar_events;
  end if;
end $$;
