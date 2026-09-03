-- VLACORA HUB 0.24.0 — persistent hitlijst-songgeheugen.
-- Bewaart alleen songidentiteit/links, niet de volledige hitlijsteditie.

create table if not exists public.hub_chart_song_memory(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  song_key text not null,
  artist text not null,
  title text not null,
  song_id text not null default '',
  spotify_url text not null default '',
  youtube_url text not null default '',
  use_count integer not null default 1 check(use_count >= 0),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(station_slug,song_key)
);

create index if not exists hub_chart_song_memory_recent_idx on public.hub_chart_song_memory(station_slug,last_used_at desc);
create index if not exists hub_chart_song_memory_artist_title_idx on public.hub_chart_song_memory(station_slug,artist,title);

alter table public.hub_chart_song_memory enable row level security;

drop policy if exists "station team can read chart song memory" on public.hub_chart_song_memory;
create policy "station team can read chart song memory" on public.hub_chart_song_memory
for select to authenticated using(public.vlacora_can_access_station(station_slug));

drop policy if exists "station team can insert chart song memory" on public.hub_chart_song_memory;
create policy "station team can insert chart song memory" on public.hub_chart_song_memory
for insert to authenticated with check(public.vlacora_can_access_station(station_slug));

drop policy if exists "station team can update chart song memory" on public.hub_chart_song_memory;
create policy "station team can update chart song memory" on public.hub_chart_song_memory
for update to authenticated using(public.vlacora_can_access_station(station_slug)) with check(public.vlacora_can_access_station(station_slug));

drop policy if exists "managers can delete chart song memory" on public.hub_chart_song_memory;
create policy "managers can delete chart song memory" on public.hub_chart_song_memory
for delete to authenticated using(public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer') and public.vlacora_can_access_station(station_slug));

-- Seed geheugen zuinig uit bestaande hitlijsten. Dubbels worden samengevoegd.
insert into public.hub_chart_song_memory(station_slug,song_key,artist,title,song_id,use_count,last_used_at)
select h.station_slug,
       lower(regexp_replace(coalesce(e->>'artist','')||'|||'||coalesce(e->>'title',''),'[^a-zA-Z0-9]+',' ','g')),
       e->>'artist',e->>'title',coalesce(e->>'songId',''),count(*)::int,max(h.updated_at)
from public.hitlists h
cross join lateral jsonb_array_elements(coalesce(h.entries,'[]'::jsonb)) e
where nullif(trim(e->>'artist'),'') is not null and nullif(trim(e->>'title'),'') is not null
group by h.station_slug,lower(regexp_replace(coalesce(e->>'artist','')||'|||'||coalesce(e->>'title',''),'[^a-zA-Z0-9]+',' ','g')),e->>'artist',e->>'title',coalesce(e->>'songId','')
on conflict(station_slug,song_key) do update set
  artist=excluded.artist,title=excluded.title,
  song_id=case when excluded.song_id<>'' then excluded.song_id else public.hub_chart_song_memory.song_id end,
  use_count=greatest(public.hub_chart_song_memory.use_count,excluded.use_count),
  last_used_at=greatest(public.hub_chart_song_memory.last_used_at,excluded.last_used_at),updated_at=now();
