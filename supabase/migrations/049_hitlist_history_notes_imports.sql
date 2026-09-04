-- PULSE 0.29.0
-- Hitlijstarchief, bulkimporthistoriek en privé/team-updates.

create table if not exists public.hub_chart_import_batches (
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  series_key text not null,
  source_file text not null default '',
  edition_year integer,
  edition_week integer,
  status text not null default 'parsed' check (status in ('parsed','importing','imported','recomputed','failed')),
  details jsonb not null default '{}'::jsonb,
  imported_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hub_chart_updates (
  id uuid primary key default gen_random_uuid(),
  hitlist_id text not null references public.hitlists(id) on delete cascade,
  station_slug text not null,
  song_key text,
  entry_position integer,
  visibility text not null default 'team' check (visibility in ('private','managers','team')),
  body text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hub_chart_history_events (
  id uuid primary key default gen_random_uuid(),
  hitlist_id text not null references public.hitlists(id) on delete cascade,
  station_slug text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hub_chart_import_batches_series_idx
  on public.hub_chart_import_batches(station_slug, series_key, edition_year, edition_week);
create index if not exists hub_chart_updates_hitlist_idx
  on public.hub_chart_updates(hitlist_id, song_key, created_at desc);
create index if not exists hub_chart_updates_creator_idx
  on public.hub_chart_updates(created_by, visibility, created_at desc);
create index if not exists hub_chart_history_events_hitlist_idx
  on public.hub_chart_history_events(hitlist_id, created_at desc);

alter table public.hub_chart_import_batches enable row level security;
alter table public.hub_chart_updates enable row level security;
alter table public.hub_chart_history_events enable row level security;

grant select, insert, update, delete on public.hub_chart_import_batches to authenticated;
grant select, insert, update, delete on public.hub_chart_updates to authenticated;
grant select, insert on public.hub_chart_history_events to authenticated;

create policy "chart import managers read"
on public.hub_chart_import_batches
for select to authenticated
using (imported_by = auth.uid() or public.vlacora_can_manage_station(station_slug));

create policy "chart import managers insert"
on public.hub_chart_import_batches
for insert to authenticated
with check (imported_by = auth.uid() and public.vlacora_can_access_station(station_slug));

create policy "chart import managers update"
on public.hub_chart_import_batches
for update to authenticated
using (imported_by = auth.uid() or public.vlacora_can_manage_station(station_slug))
with check (imported_by = auth.uid() or public.vlacora_can_manage_station(station_slug));

create policy "chart updates read"
on public.hub_chart_updates
for select to authenticated
using (
  created_by = auth.uid()
  or (visibility = 'team' and public.vlacora_can_access_station(station_slug))
  or (visibility = 'managers' and public.vlacora_can_manage_station(station_slug))
);

create policy "chart updates insert"
on public.hub_chart_updates
for insert to authenticated
with check (created_by = auth.uid() and public.vlacora_can_access_station(station_slug));

create policy "chart updates own update"
on public.hub_chart_updates
for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "chart updates own delete"
on public.hub_chart_updates
for delete to authenticated
using (created_by = auth.uid() or public.vlacora_can_manage_station(station_slug));

create policy "chart history station read"
on public.hub_chart_history_events
for select to authenticated
using (public.vlacora_can_access_station(station_slug));

create policy "chart history station insert"
on public.hub_chart_history_events
for insert to authenticated
with check (public.vlacora_can_access_station(station_slug));
