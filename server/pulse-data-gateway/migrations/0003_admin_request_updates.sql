-- PULSE 0.29.0
-- Privé conversatie en interne beheerupdates bij aanvragen/ideeën.
create table if not exists public.hub_admin_request_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.hub_admin_requests(id) on delete cascade,
  station_slug text not null default 'all',
  body text not null,
  visibility text not null default 'requester' check (visibility in ('requester','internal','team')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists hub_admin_request_updates_thread_idx on public.hub_admin_request_updates(request_id,created_at);
alter table public.hub_admin_request_updates enable row level security;
grant select,insert,delete on public.hub_admin_request_updates to authenticated;

create policy "admin request updates read"
on public.hub_admin_request_updates
for select to authenticated
using (
  exists (
    select 1 from public.hub_admin_requests r
    where r.id=request_id and (
      public.vlacora_can_manage_station(r.station_slug)
      or (r.created_by=auth.uid() and visibility in ('requester','team'))
      or (visibility='team' and public.vlacora_can_access_station(r.station_slug))
    )
  )
);

create policy "admin request updates insert"
on public.hub_admin_request_updates
for insert to authenticated
with check (
  created_by=auth.uid()
  and exists (
    select 1 from public.hub_admin_requests r
    where r.id=request_id and r.station_slug=station_slug and (
      public.vlacora_can_manage_station(r.station_slug)
      or (r.created_by=auth.uid() and visibility='requester')
    )
  )
);

create policy "admin request updates delete"
on public.hub_admin_request_updates
for delete to authenticated
using (
  created_by=auth.uid()
  or exists(select 1 from public.hub_admin_requests r where r.id=request_id and public.vlacora_can_manage_station(r.station_slug))
);
