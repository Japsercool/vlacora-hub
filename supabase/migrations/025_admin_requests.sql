
-- VLACORA HUB 0.19.8 — requests/suggestions from team members to administrators
-- Applied to the connected production Supabase project on 2026-09-02.

create table if not exists public.hub_admin_requests(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null default 'all',
  category text not null default 'feature'
    check(category in ('feature','traffic','content','station','other')),
  title text not null,
  description text not null default '',
  status text not null default 'new'
    check(status in ('new','reviewing','planned','done','rejected')),
  admin_note text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  handled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hub_admin_requests_created_by_idx
  on public.hub_admin_requests(created_by,created_at desc);
create index if not exists hub_admin_requests_status_idx
  on public.hub_admin_requests(status,created_at desc);

alter table public.hub_admin_requests enable row level security;

drop policy if exists "users can create admin requests" on public.hub_admin_requests;
create policy "users can create admin requests"
on public.hub_admin_requests for insert to authenticated
with check(
  created_by=auth.uid()
  and (station_slug='all' or public.vlacora_can_access_station(station_slug))
);

drop policy if exists "users can read own requests admins read all" on public.hub_admin_requests;
create policy "users can read own requests admins read all"
on public.hub_admin_requests for select to authenticated
using(
  created_by=auth.uid()
  or public.vlacora_current_role() in ('superadmin','admin','beheer','stationmanager')
);

drop policy if exists "admins can update requests" on public.hub_admin_requests;
create policy "admins can update requests"
on public.hub_admin_requests for update to authenticated
using(public.vlacora_current_role() in ('superadmin','admin','beheer','stationmanager'))
with check(public.vlacora_current_role() in ('superadmin','admin','beheer','stationmanager'));

drop policy if exists "users can delete own new requests" on public.hub_admin_requests;
create policy "users can delete own new requests"
on public.hub_admin_requests for delete to authenticated
using(created_by=auth.uid() and status='new');

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='hub_admin_requests'
  ) then
    alter publication supabase_realtime add table public.hub_admin_requests;
  end if;
end $$;
