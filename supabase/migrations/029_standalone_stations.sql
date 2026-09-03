-- VLACORA HUB 0.21.0 — standalone station registry.
-- Station identity is owned by VLACORA itself; no Rotation/Playout dependency is required.

create table if not exists public.hub_stations(
  slug text primary key check(slug ~ '^[a-z0-9][a-z0-9-]{0,47}$'),
  name text not null,
  short text not null default 'ST',
  accent text not null default '#5438ff',
  timezone text not null default 'Europe/Brussels',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hub_stations_active_sort_idx on public.hub_stations(active,sort_order,name);
alter table public.hub_stations enable row level security;

drop policy if exists "team can read hub stations" on public.hub_stations;
create policy "team can read hub stations" on public.hub_stations for select to authenticated using(true);
drop policy if exists "superadmin can insert hub stations" on public.hub_stations;
create policy "superadmin can insert hub stations" on public.hub_stations for insert to authenticated with check(public.vlacora_current_role()='superadmin');
drop policy if exists "superadmin can update hub stations" on public.hub_stations;
create policy "superadmin can update hub stations" on public.hub_stations for update to authenticated using(public.vlacora_current_role()='superadmin') with check(public.vlacora_current_role()='superadmin');
drop policy if exists "superadmin can delete hub stations" on public.hub_stations;
create policy "superadmin can delete hub stations" on public.hub_stations for delete to authenticated using(public.vlacora_current_role()='superadmin');

insert into public.hub_stations(slug,name,short,accent,timezone,active,sort_order)
values
 ('versuz','Versuz Radio','VZ','#5438ff','Europe/Brussels',true,10),
 ('club-fm','Club FM','CF','#e94157','Europe/Brussels',true,20),
 ('vlacora-one','Vlacora One','V1','#127a65','Europe/Brussels',true,30)
on conflict(slug) do nothing;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_stations') then
    alter publication supabase_realtime add table public.hub_stations;
  end if;
end $$;


-- Normalize music-meeting metadata to the standalone HUB schema.
do $$ begin
  if to_regclass('public.hub_music_meeting_tracks') is not null then
    alter table public.hub_music_meeting_tracks add column if not exists music_folder text not null default '';
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='hub_music_meeting_tracks' and column_name='rotation_folder') then
      update public.hub_music_meeting_tracks set music_folder=coalesce(nullif(music_folder,''),rotation_folder,'');
      alter table public.hub_music_meeting_tracks drop column rotation_folder;
    end if;
    update public.hub_music_meeting_tracks set source='manual' where source is distinct from 'manual';
    alter table public.hub_music_meeting_tracks drop constraint if exists hub_music_meeting_tracks_source_check;
    alter table public.hub_music_meeting_tracks add constraint hub_music_meeting_tracks_source_check check(source='manual');
  end if;
end $$;

-- Remove legacy radio-engine storage/integration objects from existing VLACORA databases.
delete from public.hub_operational_warnings
where code in ('playlist-coverage','news-missing','encoder-offline','stream-offline','heartbeat-stale','playout-unreachable');

drop table if exists public.shoutcast_listener_samples cascade;
drop table if exists public.radio_stations cascade;
drop function if exists public.vlacora_get_integration_secret(text);
drop function if exists public.vlacora_set_integration_secret(text,text,text,text);
drop function if exists public.vlacora_delete_integration_secret(text);
drop table if exists public.hub_integration_secrets cascade;

do $$ begin
  if to_regclass('vault.secrets') is not null then
    execute $q$delete from vault.secrets where name in ('vlacora-rotation-api-key','vlacora-playout-api-key','vlacora-shoutcast-api-key')$q$;
  end if;
end $$;
