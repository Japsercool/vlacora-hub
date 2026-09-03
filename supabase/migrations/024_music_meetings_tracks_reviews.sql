-- VLACORA HUB 0.18.2 — music meetings, tracks and reviews
-- Applied to production already.

create table if not exists public.hub_music_meetings(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  title text not null,
  scheduled_at timestamptz,
  ends_at timestamptz,
  status text not null default 'planned' check(status in ('planned','active','paused','closed')),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hub_music_meeting_tracks(
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.hub_music_meetings(id) on delete cascade,
  source text not null default 'manual' check(source='manual'),
  source_song_id text,
  artist text not null default '',
  title text not null,
  category text not null default '',
  music_folder text not null default '',
  audio_url text not null default '',
  position integer not null default 0,
  decision text not null default '',
  note text not null default '',
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hub_music_meeting_reviews(
  id uuid primary key default gen_random_uuid(),
  meeting_track_id uuid not null references public.hub_music_meeting_tracks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  score numeric(4,2),
  decision text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(meeting_track_id,user_id)
);
create index if not exists hub_music_meetings_station_idx on public.hub_music_meetings(station_slug,scheduled_at desc);
create index if not exists hub_music_meeting_tracks_meeting_idx on public.hub_music_meeting_tracks(meeting_id,position,created_at);
alter table public.hub_music_meetings enable row level security;
alter table public.hub_music_meeting_tracks enable row level security;
alter table public.hub_music_meeting_reviews enable row level security;

drop policy if exists "team can read music meetings" on public.hub_music_meetings;
create policy "team can read music meetings" on public.hub_music_meetings for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can create music meetings" on public.hub_music_meetings;
create policy "team can create music meetings" on public.hub_music_meetings for insert to authenticated with check(created_by=auth.uid() and public.vlacora_can_access_station(station_slug));
drop policy if exists "team can update music meetings" on public.hub_music_meetings;
create policy "team can update music meetings" on public.hub_music_meetings for update to authenticated using(public.vlacora_can_access_station(station_slug)) with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "authorized team can delete music meetings" on public.hub_music_meetings;
create policy "authorized team can delete music meetings" on public.hub_music_meetings for delete to authenticated using(created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','muziekredactie'));

drop policy if exists "team can read meeting tracks" on public.hub_music_meeting_tracks;
create policy "team can read meeting tracks" on public.hub_music_meeting_tracks for select to authenticated using(exists(select 1 from public.hub_music_meetings m where m.id=meeting_id and public.vlacora_can_access_station(m.station_slug)));
drop policy if exists "team can create meeting tracks" on public.hub_music_meeting_tracks;
create policy "team can create meeting tracks" on public.hub_music_meeting_tracks for insert to authenticated with check(added_by=auth.uid() and exists(select 1 from public.hub_music_meetings m where m.id=meeting_id and public.vlacora_can_access_station(m.station_slug)));
drop policy if exists "team can update meeting tracks" on public.hub_music_meeting_tracks;
create policy "team can update meeting tracks" on public.hub_music_meeting_tracks for update to authenticated using(exists(select 1 from public.hub_music_meetings m where m.id=meeting_id and public.vlacora_can_access_station(m.station_slug))) with check(exists(select 1 from public.hub_music_meetings m where m.id=meeting_id and public.vlacora_can_access_station(m.station_slug)));
drop policy if exists "team can delete meeting tracks" on public.hub_music_meeting_tracks;
create policy "team can delete meeting tracks" on public.hub_music_meeting_tracks for delete to authenticated using(exists(select 1 from public.hub_music_meetings m where m.id=meeting_id and public.vlacora_can_access_station(m.station_slug)));

drop policy if exists "team can read meeting reviews" on public.hub_music_meeting_reviews;
create policy "team can read meeting reviews" on public.hub_music_meeting_reviews for select to authenticated using(exists(select 1 from public.hub_music_meeting_tracks t join public.hub_music_meetings m on m.id=t.meeting_id where t.id=meeting_track_id and public.vlacora_can_access_station(m.station_slug)));
drop policy if exists "team can write own meeting review" on public.hub_music_meeting_reviews;
create policy "team can write own meeting review" on public.hub_music_meeting_reviews for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.hub_music_meeting_tracks t join public.hub_music_meetings m on m.id=t.meeting_id where t.id=meeting_track_id and public.vlacora_can_access_station(m.station_slug)));
drop policy if exists "team can update own meeting review" on public.hub_music_meeting_reviews;
create policy "team can update own meeting review" on public.hub_music_meeting_reviews for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_music_meetings') then alter publication supabase_realtime add table public.hub_music_meetings; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_music_meeting_tracks') then alter publication supabase_realtime add table public.hub_music_meeting_tracks; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_music_meeting_reviews') then alter publication supabase_realtime add table public.hub_music_meeting_reviews; end if;
end $$;
