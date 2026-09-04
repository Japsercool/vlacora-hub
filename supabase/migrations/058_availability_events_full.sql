-- PULSE 0.32 - volledige beschikbaarheid + events/specials
create table if not exists public.hub_weekly_availability(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null default 'all',
  user_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check(weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  response text not null default 'available' check(response in ('available','maybe','unavailable')),
  check(end_time>start_time)
);

create table if not exists public.hub_availability_polls(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  title text not null,
  description text not null default '',
  poll_type text not null default 'meeting' check(poll_type in ('program','meeting','event','other')),
  starts_on date not null,
  ends_on date not null,
  day_start time not null default '09:00',
  day_end time not null default '22:00',
  slot_minutes integer not null default 60 check(slot_minutes in (15,30,45,60,90,120,180,240)),
  status text not null default 'open' check(status in ('draft','open','closed','planned','cancelled')),
  selected_option_id uuid,
  linked_program_id text references public.station_programs(id) on delete set null,
  linked_calendar_event_id uuid references public.hub_calendar_events(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  linked_hitlist_id text references public.hitlists(id) on delete set null,
  event_key text not null default '',
  confirmation_required boolean not null default false,
  use_weekly_suggestions boolean not null default true,
  response_deadline timestamptz,
  check(ends_on>=starts_on),
  check(day_end>day_start)
);

create table if not exists public.hub_availability_poll_options(
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.hub_availability_polls(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  label text not null default '',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  check(ends_at>starts_at)
);

do $$ begin
  alter table public.hub_availability_polls add constraint hub_availability_selected_option_fkey foreign key(selected_option_id) references public.hub_availability_poll_options(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.hub_availability_poll_members(
  poll_id uuid not null references public.hub_availability_polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  required boolean not null default true,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(poll_id,user_id)
);

create table if not exists public.hub_availability_responses(
  option_id uuid not null references public.hub_availability_poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response text not null check(response in ('available','maybe','unavailable')),
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key(option_id,user_id)
);

create table if not exists public.hub_availability_exceptions(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null default 'all',
  user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  response text not null check(response in ('available','maybe','unavailable')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at)
);

create table if not exists public.hub_availability_poll_roles(
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.hub_availability_polls(id) on delete cascade,
  role_key text not null,
  label text not null,
  required_count integer not null default 1 check(required_count between 0 and 100),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique(poll_id,role_key)
);

create table if not exists public.hub_availability_assignments(
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.hub_availability_polls(id) on delete cascade,
  option_id uuid not null references public.hub_availability_poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_key text not null default 'presenter',
  status text not null default 'draft' check(status in ('draft','offered','confirmed','declined','cancelled')),
  note text not null default '',
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(option_id,user_id,role_key)
);

create index if not exists hub_weekly_availability_user_idx on public.hub_weekly_availability(user_id,weekday,start_time);
create index if not exists hub_availability_polls_station_idx on public.hub_availability_polls(station_slug,starts_on,status);
create index if not exists hub_availability_options_poll_idx on public.hub_availability_poll_options(poll_id,starts_at);
create index if not exists hub_availability_exceptions_user_idx on public.hub_availability_exceptions(user_id,starts_at);
create index if not exists hub_availability_assignments_poll_idx on public.hub_availability_assignments(poll_id,option_id,role_key);

alter table public.hub_weekly_availability enable row level security;
alter table public.hub_availability_polls enable row level security;
alter table public.hub_availability_poll_options enable row level security;
alter table public.hub_availability_poll_members enable row level security;
alter table public.hub_availability_responses enable row level security;
alter table public.hub_availability_exceptions enable row level security;
alter table public.hub_availability_poll_roles enable row level security;
alter table public.hub_availability_assignments enable row level security;

grant select,insert,update,delete on public.hub_weekly_availability,public.hub_availability_polls,public.hub_availability_poll_options,public.hub_availability_poll_members,public.hub_availability_responses,public.hub_availability_exceptions,public.hub_availability_poll_roles,public.hub_availability_assignments to authenticated;

-- Policies are idempotently (re)created.
do $$ declare t text; begin
  for t in select policyname from pg_policies where schemaname='public' and tablename='hub_weekly_availability' loop execute format('drop policy if exists %I on public.hub_weekly_availability',t); end loop;
end $$;
create policy "availability readable by station team" on public.hub_weekly_availability for select to authenticated using(station_slug='all' or public.vlacora_can_access_station(station_slug));
create policy "users create own availability" on public.hub_weekly_availability for insert to authenticated with check(user_id=auth.uid() and (station_slug='all' or public.vlacora_can_access_station(station_slug)));
create policy "users update own availability" on public.hub_weekly_availability for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "users delete own availability" on public.hub_weekly_availability for delete to authenticated using(user_id=auth.uid());

create policy "availability polls readable 032" on public.hub_availability_polls for select to authenticated using(public.vlacora_can_access_station(station_slug));
create policy "availability polls creatable 032" on public.hub_availability_polls for insert to authenticated with check(created_by=auth.uid() and public.vlacora_can_access_station(station_slug));
create policy "availability polls updateable 032" on public.hub_availability_polls for update to authenticated using(created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')) with check(public.vlacora_can_access_station(station_slug));
create policy "availability polls deletable 032" on public.hub_availability_polls for delete to authenticated using(created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'));

create policy "availability options readable 032" on public.hub_availability_poll_options for select to authenticated using(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and public.vlacora_can_access_station(p.station_slug)));
create policy "availability options manageable 032" on public.hub_availability_poll_options for all to authenticated using(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))) with check(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))));

create policy "availability members readable 032" on public.hub_availability_poll_members for select to authenticated using(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and public.vlacora_can_access_station(p.station_slug)));
create policy "availability members manageable 032" on public.hub_availability_poll_members for all to authenticated using(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))) with check(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))));

create policy "availability responses readable 032" on public.hub_availability_responses for select to authenticated using(exists(select 1 from public.hub_availability_poll_options o join public.hub_availability_polls p on p.id=o.poll_id where o.id=option_id and public.vlacora_can_access_station(p.station_slug)));
create policy "availability responses insert own 032" on public.hub_availability_responses for insert to authenticated with check(user_id=auth.uid());
create policy "availability responses update own 032" on public.hub_availability_responses for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "availability responses delete own 032" on public.hub_availability_responses for delete to authenticated using(user_id=auth.uid());

create policy "availability exceptions readable 032" on public.hub_availability_exceptions for select to authenticated using(user_id=auth.uid() or station_slug='all' or public.vlacora_can_access_station(station_slug));
create policy "availability exceptions own insert 032" on public.hub_availability_exceptions for insert to authenticated with check(user_id=auth.uid() and (station_slug='all' or public.vlacora_can_access_station(station_slug)));
create policy "availability exceptions own update 032" on public.hub_availability_exceptions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "availability exceptions own delete 032" on public.hub_availability_exceptions for delete to authenticated using(user_id=auth.uid());

create policy "availability poll roles readable 032" on public.hub_availability_poll_roles for select to authenticated using(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and public.vlacora_can_access_station(p.station_slug)));
create policy "availability poll roles manageable 032" on public.hub_availability_poll_roles for all to authenticated using(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))) with check(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))));

create policy "availability assignments readable 032" on public.hub_availability_assignments for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.hub_availability_polls p where p.id=poll_id and public.vlacora_can_access_station(p.station_slug)));
create policy "availability assignments managers insert 032" on public.hub_availability_assignments for insert to authenticated with check(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))));
create policy "availability assignments managers or assignee update 032" on public.hub_availability_assignments for update to authenticated using(user_id=auth.uid() or exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))) with check(user_id=auth.uid() or exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))));
create policy "availability assignments managers delete 032" on public.hub_availability_assignments for delete to authenticated using(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))));
