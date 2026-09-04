create table if not exists public.hub_chart_import_batches (
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  series_key text not null,
  source_file text not null default '',
  edition_year integer,
  edition_week integer,
  status text not null default 'parsed',
  details jsonb not null default '{}'::jsonb,
  imported_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hub_chart_updates (
  id uuid primary key default gen_random_uuid(),
  hitlist_id text not null,
  station_slug text not null,
  song_key text,
  entry_position integer,
  visibility text not null default 'team',
  body text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hub_chart_history_events (
  id uuid primary key default gen_random_uuid(),
  hitlist_id text not null,
  station_slug text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists hub_chart_import_batches_series_idx on public.hub_chart_import_batches(station_slug,series_key,edition_year,edition_week);
create index if not exists hub_chart_updates_hitlist_idx on public.hub_chart_updates(hitlist_id,song_key,created_at desc);
create index if not exists hub_chart_history_events_hitlist_idx on public.hub_chart_history_events(hitlist_id,created_at desc);
