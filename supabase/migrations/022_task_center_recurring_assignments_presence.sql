-- VLACORA HUB 0.18.0 — Task Center
-- Applied to production: recurring tasks, multi-person assignments, task history and realtime.

create table if not exists public.hub_tasks(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  title text not null,
  description text not null default '',
  status text not null default 'todo' check(status in ('todo','in_progress','review','done')),
  priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  recurrence_kind text not null default 'none' check(recurrence_kind in ('none','daily','weekly','monthly')),
  recurrence_interval integer not null default 1 check(recurrence_interval between 1 and 365),
  recurrence_config jsonb not null default '{}'::jsonb,
  series_id uuid,
  recurrence_index integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists hub_tasks_station_status_due_idx on public.hub_tasks(station_slug,status,due_at);
create index if not exists hub_tasks_series_idx on public.hub_tasks(series_id,recurrence_index);
create unique index if not exists hub_tasks_series_occurrence_unique on public.hub_tasks(series_id,recurrence_index) where series_id is not null;
alter table public.hub_tasks enable row level security;

drop policy if exists "team can read hub tasks" on public.hub_tasks;
create policy "team can read hub tasks" on public.hub_tasks for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can create hub tasks" on public.hub_tasks;
create policy "team can create hub tasks" on public.hub_tasks for insert to authenticated with check(created_by=auth.uid() and public.vlacora_can_access_station(station_slug));
drop policy if exists "team can update hub tasks" on public.hub_tasks;
create policy "team can update hub tasks" on public.hub_tasks for update to authenticated using(public.vlacora_can_access_station(station_slug)) with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "authorized team can delete hub tasks" on public.hub_tasks;
create policy "authorized team can delete hub tasks" on public.hub_tasks for delete to authenticated using(created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager'));

create table if not exists public.hub_task_assignees(
  task_id uuid not null references public.hub_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key(task_id,user_id)
);
create index if not exists hub_task_assignees_user_idx on public.hub_task_assignees(user_id,task_id);
alter table public.hub_task_assignees enable row level security;
drop policy if exists "team can read task assignees" on public.hub_task_assignees;
create policy "team can read task assignees" on public.hub_task_assignees for select to authenticated using(exists(select 1 from public.hub_tasks t where t.id=task_id and public.vlacora_can_access_station(t.station_slug)));
drop policy if exists "team can insert task assignees" on public.hub_task_assignees;
create policy "team can insert task assignees" on public.hub_task_assignees for insert to authenticated with check(exists(select 1 from public.hub_tasks t where t.id=task_id and public.vlacora_can_access_station(t.station_slug)));
drop policy if exists "team can delete task assignees" on public.hub_task_assignees;
create policy "team can delete task assignees" on public.hub_task_assignees for delete to authenticated using(exists(select 1 from public.hub_tasks t where t.id=task_id and public.vlacora_can_access_station(t.station_slug)));

create table if not exists public.hub_task_events(
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.hub_tasks(id) on delete cascade,
  event_type text not null default 'comment' check(event_type in ('created','updated','status','assignment','comment','recurrence')),
  body text not null default '',
  from_status text,
  to_status text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists hub_task_events_task_idx on public.hub_task_events(task_id,created_at);
alter table public.hub_task_events enable row level security;
drop policy if exists "team can read task events" on public.hub_task_events;
create policy "team can read task events" on public.hub_task_events for select to authenticated using(exists(select 1 from public.hub_tasks t where t.id=task_id and public.vlacora_can_access_station(t.station_slug)));
drop policy if exists "team can create task events" on public.hub_task_events;
create policy "team can create task events" on public.hub_task_events for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.hub_tasks t where t.id=task_id and public.vlacora_can_access_station(t.station_slug)));

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_tasks') then alter publication supabase_realtime add table public.hub_tasks; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_task_assignees') then alter publication supabase_realtime add table public.hub_task_assignees; end if;
end $$;
