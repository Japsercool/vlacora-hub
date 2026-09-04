-- PULSE 0.32 target runtime migration. The initial source migration copies the
-- full schema. This migration keeps an already switched PostgreSQL backend
-- upgradeable when availability/events are introduced by a later PULSE release.
alter table if exists public.hub_weekly_availability add column if not exists response text not null default 'available';
alter table if exists public.hub_availability_polls add column if not exists linked_hitlist_id text;
alter table if exists public.hub_availability_polls add column if not exists event_key text not null default '';
alter table if exists public.hub_availability_polls add column if not exists confirmation_required boolean not null default false;
alter table if exists public.hub_availability_polls add column if not exists use_weekly_suggestions boolean not null default true;
alter table if exists public.hub_availability_polls add column if not exists response_deadline timestamptz;

create table if not exists public.hub_availability_exceptions(
 id uuid primary key default gen_random_uuid(), station_slug text not null default 'all', user_id uuid not null,
 starts_at timestamptz not null, ends_at timestamptz not null, response text not null, note text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.hub_availability_poll_roles(
 id uuid primary key default gen_random_uuid(), poll_id uuid not null, role_key text not null, label text not null,
 required_count integer not null default 1, sort_order integer not null default 100, created_at timestamptz not null default now(), unique(poll_id,role_key)
);
create table if not exists public.hub_availability_assignments(
 id uuid primary key default gen_random_uuid(), poll_id uuid not null, option_id uuid not null, user_id uuid not null,
 role_key text not null default 'presenter', status text not null default 'draft', note text not null default '', assigned_by uuid,
 assigned_at timestamptz not null default now(), confirmed_at timestamptz, updated_at timestamptz not null default now(), unique(option_id,user_id,role_key)
);

-- Constraints/indexes for upgrades of an already external backend.
do $$ begin
  alter table public.hub_weekly_availability add constraint hub_weekly_availability_response_check check(response in ('available','maybe','unavailable'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.hub_availability_exceptions add constraint hub_availability_exceptions_user_id_fkey foreign key(user_id) references public.profiles(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.hub_availability_exceptions add constraint hub_availability_exceptions_check check(ends_at>starts_at);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.hub_availability_exceptions add constraint hub_availability_exceptions_response_check check(response in ('available','maybe','unavailable'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.hub_availability_polls add constraint hub_availability_polls_linked_hitlist_id_fkey foreign key(linked_hitlist_id) references public.hitlists(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.hub_availability_poll_roles add constraint hub_availability_poll_roles_poll_id_fkey foreign key(poll_id) references public.hub_availability_polls(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.hub_availability_poll_roles add constraint hub_availability_poll_roles_required_count_check check(required_count>=0 and required_count<=100);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.hub_availability_assignments add constraint hub_availability_assignments_poll_id_fkey foreign key(poll_id) references public.hub_availability_polls(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.hub_availability_assignments add constraint hub_availability_assignments_option_id_fkey foreign key(option_id) references public.hub_availability_poll_options(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.hub_availability_assignments add constraint hub_availability_assignments_user_id_fkey foreign key(user_id) references public.profiles(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.hub_availability_assignments add constraint hub_availability_assignments_assigned_by_fkey foreign key(assigned_by) references public.profiles(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.hub_availability_assignments add constraint hub_availability_assignments_status_check check(status in ('draft','offered','confirmed','declined','cancelled'));
exception when duplicate_object then null; end $$;

create index if not exists hub_availability_exceptions_user_idx on public.hub_availability_exceptions(user_id,starts_at);
create index if not exists hub_availability_polls_hitlist_idx on public.hub_availability_polls(linked_hitlist_id) where linked_hitlist_id is not null;
create index if not exists hub_availability_assignments_poll_idx on public.hub_availability_assignments(poll_id,option_id);

alter table public.hub_availability_exceptions enable row level security;
alter table public.hub_availability_poll_roles enable row level security;
alter table public.hub_availability_assignments enable row level security;
grant select,insert,update,delete on public.hub_availability_exceptions,public.hub_availability_poll_roles,public.hub_availability_assignments to authenticated;

drop policy if exists "availability exceptions readable" on public.hub_availability_exceptions;
create policy "availability exceptions readable" on public.hub_availability_exceptions for select to authenticated
using(user_id=auth.uid() or station_slug='all' or public.vlacora_can_access_station(station_slug));
drop policy if exists "availability exceptions own insert" on public.hub_availability_exceptions;
create policy "availability exceptions own insert" on public.hub_availability_exceptions for insert to authenticated
with check(user_id=auth.uid() and (station_slug='all' or public.vlacora_can_access_station(station_slug)));
drop policy if exists "availability exceptions own update" on public.hub_availability_exceptions;
create policy "availability exceptions own update" on public.hub_availability_exceptions for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "availability exceptions own delete" on public.hub_availability_exceptions;
create policy "availability exceptions own delete" on public.hub_availability_exceptions for delete to authenticated using(user_id=auth.uid());

drop policy if exists "availability poll roles readable" on public.hub_availability_poll_roles;
create policy "availability poll roles readable" on public.hub_availability_poll_roles for select to authenticated
using(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and public.vlacora_can_access_station(p.station_slug)));
drop policy if exists "availability poll roles manageable" on public.hub_availability_poll_roles;
create policy "availability poll roles manageable" on public.hub_availability_poll_roles for all to authenticated
using(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))))
with check(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))));

drop policy if exists "availability assignments readable" on public.hub_availability_assignments;
create policy "availability assignments readable" on public.hub_availability_assignments for select to authenticated
using(user_id=auth.uid() or exists(select 1 from public.hub_availability_polls p where p.id=poll_id and public.vlacora_can_access_station(p.station_slug)));
drop policy if exists "availability assignments managers insert" on public.hub_availability_assignments;
create policy "availability assignments managers insert" on public.hub_availability_assignments for insert to authenticated
with check(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))));
drop policy if exists "availability assignments managers or assignee update" on public.hub_availability_assignments;
create policy "availability assignments managers or assignee update" on public.hub_availability_assignments for update to authenticated
using(user_id=auth.uid() or exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))))
with check(user_id=auth.uid() or exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))));
drop policy if exists "availability assignments managers delete" on public.hub_availability_assignments;
create policy "availability assignments managers delete" on public.hub_availability_assignments for delete to authenticated
using(exists(select 1 from public.hub_availability_polls p where p.id=poll_id and (p.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))));

notify pgrst,'reload schema';
