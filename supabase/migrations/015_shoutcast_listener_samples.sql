-- VLACORA HUB 0.14.0 — low-frequency SHOUTcast history.
-- Live UI refresh may run every 30/60 sec, but the DB stores max one row per 10-minute bucket.
create table if not exists public.shoutcast_listener_samples(
  station_slug text not null,bucket_at timestamptz not null,listeners integer not null default 0 check(listeners>=0),
  peak_listeners integer not null default 0 check(peak_listeners>=0),unique_listeners integer not null default 0 check(unique_listeners>=0),
  average_time_seconds integer not null default 0 check(average_time_seconds>=0),stream_online boolean not null default false,
  song_title text not null default '',updated_at timestamptz not null default now(),primary key(station_slug,bucket_at)
);
create index if not exists shoutcast_listener_samples_recent_idx on public.shoutcast_listener_samples(station_slug,bucket_at desc);
alter table public.shoutcast_listener_samples enable row level security;
drop policy if exists "team can read shoutcast samples" on public.shoutcast_listener_samples;
create policy "team can read shoutcast samples" on public.shoutcast_listener_samples for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can insert shoutcast samples" on public.shoutcast_listener_samples;
create policy "team can insert shoutcast samples" on public.shoutcast_listener_samples for insert to authenticated with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can update shoutcast samples" on public.shoutcast_listener_samples;
create policy "team can update shoutcast samples" on public.shoutcast_listener_samples for update to authenticated using(public.vlacora_can_access_station(station_slug)) with check(public.vlacora_can_access_station(station_slug));
