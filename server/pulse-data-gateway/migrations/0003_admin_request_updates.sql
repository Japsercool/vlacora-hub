create table if not exists public.hub_admin_request_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  station_slug text not null default 'all',
  body text not null,
  visibility text not null default 'requester',
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists hub_admin_request_updates_thread_idx on public.hub_admin_request_updates(request_id,created_at);
