-- VLACORA HUB 0.23.0 — standalone workflow round 2.
-- Idempotent migration that also installs the missing 0.21/0.22 standalone pieces
-- on databases that were already running VLACORA before those migrations existed.

-- -----------------------------------------------------------------------------
-- 1. Standalone VLACORA stations (Supabase Auth remains the fixed login provider)
-- -----------------------------------------------------------------------------
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
create policy "superadmin can insert hub stations" on public.hub_stations for insert to authenticated
with check(public.vlacora_current_role()='superadmin');
drop policy if exists "superadmin can update hub stations" on public.hub_stations;
create policy "superadmin can update hub stations" on public.hub_stations for update to authenticated
using(public.vlacora_current_role()='superadmin') with check(public.vlacora_current_role()='superadmin');
drop policy if exists "superadmin can delete hub stations" on public.hub_stations;
create policy "superadmin can delete hub stations" on public.hub_stations for delete to authenticated
using(public.vlacora_current_role()='superadmin');

insert into public.hub_stations(slug,name,short,accent,timezone,active,sort_order)
values
 ('versuz','Versuz Radio','VZ','#5438ff','Europe/Brussels',true,10),
 ('club-fm','Club FM','CF','#e94157','Europe/Brussels',true,20),
 ('vlacora-one','Vlacora One','V1','#127a65','Europe/Brussels',true,30)
on conflict(slug) do nothing;

-- Copy station configuration without copying operational history. This is deliberately
-- configuration-focused: programming/program pages, team access, templates, brand/social,
-- contacts and station settings. Posts, tasks, meetings and historical hitlist editions stay history.
create or replace function public.vlacora_clone_station_configuration(
  source_station text,
  target_station text,
  p_sections text[] default array['settings','programming','team','templates','social','contacts']::text[]
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  src record;
  new_program_id text;
  copied_programs int:=0;
  copied_templates int:=0;
  copied_social int:=0;
  copied_team int:=0;
  copied_contacts int:=0;
begin
  if public.vlacora_current_role() <> 'superadmin' then raise exception 'Alleen superadmin kan zenderconfiguratie kopiëren.' using errcode='42501'; end if;
  if source_station=target_station then raise exception 'Bron en doel moeten verschillend zijn.' using errcode='22023'; end if;
  if not exists(select 1 from public.hub_stations where slug=source_station) then raise exception 'Bronzender bestaat niet.' using errcode='22023'; end if;
  if not exists(select 1 from public.hub_stations where slug=target_station) then raise exception 'Doelzender bestaat niet.' using errcode='22023'; end if;

  if 'settings'=any(p_sections) then
    insert into public.hub_settings(scope,setting_key,value,updated_by,updated_at)
    select 'station:'||target_station,setting_key,value,auth.uid(),now()
    from public.hub_settings where scope='station:'||source_station
    on conflict(scope,setting_key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end if;

  if 'programming'=any(p_sections) then
    -- Copy each weekly program and its page/team. Existing target programming is left intact.
    for src in select * from public.station_programs where station_slug=source_station order by day,start_time loop
      new_program_id:=target_station||'-'||replace(gen_random_uuid()::text,'-','');
      insert into public.station_programs(id,station_slug,day,start_time,end_time,name,host,format,notes,active,updated_by,updated_at)
      values(new_program_id,target_station,src.day,src.start_time,src.end_time,src.name,src.host,src.format,src.notes,src.active,auth.uid(),now());
      copied_programs:=copied_programs+1;

      if to_regclass('public.hub_program_profiles') is not null then
        insert into public.hub_program_profiles(program_id,station_slug,summary,studio_info,jingle_notes,fixed_items,document_links,editorial_template_ids,social_template_ids,created_by,updated_by,created_at,updated_at)
        select new_program_id,target_station,summary,studio_info,jingle_notes,fixed_items,document_links,'[]'::jsonb,'[]'::jsonb,auth.uid(),auth.uid(),now(),now()
        from public.hub_program_profiles where program_id=src.id
        on conflict(program_id) do nothing;
      end if;
      if to_regclass('public.hub_program_team') is not null then
        insert into public.hub_program_team(program_id,user_id,role,is_primary,created_at)
        select new_program_id,user_id,role,is_primary,now() from public.hub_program_team where program_id=src.id
        on conflict(program_id,user_id) do nothing;
      end if;
    end loop;
  end if;

  if 'team'=any(p_sections) then
    insert into public.station_memberships(user_id,station_slug,role,permissions,active,updated_at)
    select user_id,target_station,role,permissions,active,now() from public.station_memberships where station_slug=source_station
    on conflict(user_id,station_slug) do update set role=excluded.role,permissions=excluded.permissions,active=excluded.active,updated_at=excluded.updated_at;
    get diagnostics copied_team=row_count;
  end if;

  if 'templates'=any(p_sections) then
    if to_regclass('public.hub_editorial_templates') is not null then
      insert into public.hub_editorial_templates(station_slug,name,program_name,sequence,assignments,notes,active,created_by,updated_by,created_at,updated_at)
      select target_station,name,program_name,sequence,assignments,notes,active,auth.uid(),auth.uid(),now(),now()
      from public.hub_editorial_templates where station_slug=source_station;
      get diagnostics copied_templates=row_count;
    end if;
    if to_regclass('public.hub_templates') is not null then
      insert into public.hub_templates(station_slug,name,category,description,fields,automations,active,created_by,updated_by,created_at,updated_at)
      select target_station,name,category,description,fields,automations,active,auth.uid(),auth.uid(),now(),now()
      from public.hub_templates where station_slug=source_station;
    end if;
  end if;

  if 'social'=any(p_sections) then
    if to_regclass('public.hub_brand_kits') is not null then
      insert into public.hub_brand_kits(station_slug,brand_name,logo_url,primary_color,secondary_color,accent_color,background_color,text_color,font_family,default_cta,default_hashtags,updated_by,updated_at)
      select target_station,brand_name,logo_url,primary_color,secondary_color,accent_color,background_color,text_color,font_family,default_cta,default_hashtags,auth.uid(),now()
      from public.hub_brand_kits where station_slug=source_station
      on conflict(station_slug) do update set brand_name=excluded.brand_name,logo_url=excluded.logo_url,primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,accent_color=excluded.accent_color,background_color=excluded.background_color,text_color=excluded.text_color,font_family=excluded.font_family,default_cta=excluded.default_cta,default_hashtags=excluded.default_hashtags,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
    end if;
    if to_regclass('public.hub_social_templates') is not null then
      insert into public.hub_social_templates(station_slug,name,content_type,aspect_ratio,caption_template,config,active,created_by,updated_by,created_at,updated_at)
      select target_station,name,content_type,aspect_ratio,caption_template,config,active,auth.uid(),auth.uid(),now(),now()
      from public.hub_social_templates where station_slug=source_station;
      get diagnostics copied_social=row_count;
    end if;
    if to_regclass('public.hub_social_copy_blocks') is not null then
      insert into public.hub_social_copy_blocks(station_slug,name,category,content,active,created_by,updated_by,created_at,updated_at)
      select target_station,name,category,content,active,auth.uid(),auth.uid(),now(),now()
      from public.hub_social_copy_blocks where station_slug=source_station;
    end if;
  end if;

  if 'contacts'=any(p_sections) and to_regclass('public.hub_contacts') is not null then
    insert into public.hub_contacts(station_slug,category,name,company,role_title,email,phone,emergency,visibility,notes,created_by,updated_by,created_at,updated_at)
    select target_station,category,name,company,role_title,email,phone,emergency,visibility,notes,auth.uid(),auth.uid(),now(),now()
    from public.hub_contacts where station_slug=source_station;
    get diagnostics copied_contacts=row_count;
  end if;

  return jsonb_build_object('programs',copied_programs,'templates',copied_templates,'socialTemplates',copied_social,'teamMemberships',copied_team,'contacts',copied_contacts);
end;$$;
revoke all on function public.vlacora_clone_station_configuration(text,text,text[]) from public;
grant execute on function public.vlacora_clone_station_configuration(text,text,text[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Calendar: personal really means personal. Not even admins can read it.
-- -----------------------------------------------------------------------------
create table if not exists public.hub_calendar_events(
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'station' check(scope in ('personal','station','organization')),
  station_slug text not null default 'all',
  owner_user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  event_type text not null default 'meeting',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text not null default '',
  source_type text not null default 'manual',
  source_id text,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hub_calendar_events_time_idx on public.hub_calendar_events(starts_at,ends_at);
create index if not exists hub_calendar_events_station_idx on public.hub_calendar_events(station_slug,starts_at);
create index if not exists hub_calendar_events_owner_idx on public.hub_calendar_events(owner_user_id,starts_at);
alter table public.hub_calendar_events enable row level security;

create table if not exists public.hub_calendar_event_attendees(
  event_id uuid not null references public.hub_calendar_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  response text not null default 'invited' check(response in ('invited','accepted','declined','tentative')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(event_id,user_id)
);
create index if not exists hub_calendar_event_attendees_user_idx on public.hub_calendar_event_attendees(user_id,event_id);
alter table public.hub_calendar_event_attendees enable row level security;

drop policy if exists "calendar events are readable" on public.hub_calendar_events;
create policy "calendar events are readable" on public.hub_calendar_events for select to authenticated using(
  (scope='personal' and owner_user_id=auth.uid())
  or scope='organization'
  or (scope='station' and public.vlacora_can_access_station(station_slug))
);
drop policy if exists "calendar events can be created" on public.hub_calendar_events;
create policy "calendar events can be created" on public.hub_calendar_events for insert to authenticated with check(
  created_by=auth.uid() and (
    (scope='personal' and owner_user_id=auth.uid())
    or (scope='station' and public.vlacora_can_access_station(station_slug))
    or (scope='organization' and public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer','redactie','muziekredactie','social','social & marketing'))
  )
);
drop policy if exists "calendar events can be updated" on public.hub_calendar_events;
create policy "calendar events can be updated" on public.hub_calendar_events for update to authenticated using(
  (scope='personal' and owner_user_id=auth.uid())
  or (scope='station' and public.vlacora_can_access_station(station_slug) and (created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))
  or (scope='organization' and (created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))
) with check(
  (scope='personal' and owner_user_id=auth.uid())
  or (scope='station' and public.vlacora_can_access_station(station_slug))
  or scope='organization'
);
drop policy if exists "calendar events can be deleted" on public.hub_calendar_events;
create policy "calendar events can be deleted" on public.hub_calendar_events for delete to authenticated using(
  (scope='personal' and owner_user_id=auth.uid())
  or (scope='station' and public.vlacora_can_access_station(station_slug) and (created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))
  or (scope='organization' and (created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))
);

drop policy if exists "calendar attendees are readable" on public.hub_calendar_event_attendees;
create policy "calendar attendees are readable" on public.hub_calendar_event_attendees for select to authenticated using(
  exists(select 1 from public.hub_calendar_events e where e.id=event_id and e.scope<>'personal' and (e.scope='organization' or public.vlacora_can_access_station(e.station_slug)))
);
drop policy if exists "calendar attendees can be added" on public.hub_calendar_event_attendees;
create policy "calendar attendees can be added" on public.hub_calendar_event_attendees for insert to authenticated with check(
  added_by=auth.uid() and exists(select 1 from public.hub_calendar_events e where e.id=event_id and e.scope<>'personal' and (
    e.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
  ))
);
drop policy if exists "calendar attendees can be changed" on public.hub_calendar_event_attendees;
create policy "calendar attendees can be changed" on public.hub_calendar_event_attendees for update to authenticated using(
  user_id=auth.uid() or exists(select 1 from public.hub_calendar_events e where e.id=event_id and e.scope<>'personal' and (e.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))
) with check(true);
drop policy if exists "calendar attendees can be removed" on public.hub_calendar_event_attendees;
create policy "calendar attendees can be removed" on public.hub_calendar_event_attendees for delete to authenticated using(
  user_id=auth.uid() or exists(select 1 from public.hub_calendar_events e where e.id=event_id and e.scope<>'personal' and (e.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')))
);

-- -----------------------------------------------------------------------------
-- 3. Social workflow fields (needed by 0.22+ UI on older databases)
-- -----------------------------------------------------------------------------
alter table public.hub_social_posts add column if not exists platforms text[] not null default '{}'::text[];
alter table public.hub_social_posts add column if not exists campaign text not null default '';
alter table public.hub_social_posts add column if not exists content_pillar text not null default '';
alter table public.hub_social_posts add column if not exists objective text not null default '';
alter table public.hub_social_posts add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.hub_social_posts add column if not exists reviewer_id uuid references auth.users(id) on delete set null;
alter table public.hub_social_posts add column if not exists due_at timestamptz;
alter table public.hub_social_posts add column if not exists publication_url text not null default '';
alter table public.hub_social_posts add column if not exists internal_notes text not null default '';
alter table public.hub_social_posts add column if not exists checklist jsonb not null default '{"copy":false,"visual":false,"rights":false,"links":false}'::jsonb;
create index if not exists hub_social_posts_assigned_idx on public.hub_social_posts(assigned_to,status,due_at);
create index if not exists hub_social_posts_campaign_idx on public.hub_social_posts(station_slug,campaign,scheduled_at);

-- -----------------------------------------------------------------------------
-- 4. DJ / presenter photos
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text not null default '';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vlacora-profile-photos','vlacora-profile-photos',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists "authenticated can read vlacora profile photos" on storage.objects;
create policy "authenticated can read vlacora profile photos" on storage.objects for select to authenticated using(bucket_id='vlacora-profile-photos');
drop policy if exists "team can upload vlacora profile photos" on storage.objects;
create policy "team can upload vlacora profile photos" on storage.objects for insert to authenticated with check(
  bucket_id='vlacora-profile-photos' and (
    (storage.foldername(name))[1]=auth.uid()::text
    or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
  )
);
drop policy if exists "team can update vlacora profile photos" on storage.objects;
create policy "team can update vlacora profile photos" on storage.objects for update to authenticated using(
  bucket_id='vlacora-profile-photos' and ((storage.foldername(name))[1]=auth.uid()::text or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))
) with check(
  bucket_id='vlacora-profile-photos' and ((storage.foldername(name))[1]=auth.uid()::text or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))
);
drop policy if exists "team can delete vlacora profile photos" on storage.objects;
create policy "team can delete vlacora profile photos" on storage.objects for delete to authenticated using(
  bucket_id='vlacora-profile-photos' and ((storage.foldername(name))[1]=auth.uid()::text or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))
);

create or replace function public.vlacora_set_profile_avatar(target_user_id uuid,p_avatar_url text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd.' using errcode='42501'; end if;
  if target_user_id<>auth.uid() and public.vlacora_current_role() not in ('superadmin','stationmanager','admin','beheer') then
    raise exception 'Geen recht om deze foto te wijzigen.' using errcode='42501';
  end if;
  update public.profiles set avatar_url=coalesce(p_avatar_url,''),updated_at=now() where id=target_user_id;
end;$$;
revoke all on function public.vlacora_set_profile_avatar(uuid,text) from public;
grant execute on function public.vlacora_set_profile_avatar(uuid,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Absence impact and date-specific programming overrides
-- -----------------------------------------------------------------------------
alter table public.hub_absence_coverages add column if not exists coverage_mode text not null default 'required';
do $$ begin
  if not exists(select 1 from pg_constraint where conname='hub_absence_coverages_mode_check') then
    alter table public.hub_absence_coverages add constraint hub_absence_coverages_mode_check check(coverage_mode in ('required','optional'));
  end if;
end $$;

-- Admin/beheer may register absences for team members and manage replacements.
drop policy if exists "users can create absences" on public.hub_absences;
create policy "users can create absences" on public.hub_absences for insert to authenticated with check(
  created_by=auth.uid() and public.vlacora_can_access_station(station_slug) and (
    user_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
  )
);
drop policy if exists "users or managers can update absences" on public.hub_absences;
create policy "users or managers can update absences" on public.hub_absences for update to authenticated using(
  user_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
) with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "users or managers can delete absences" on public.hub_absences;
create policy "users or managers can delete absences" on public.hub_absences for delete to authenticated using(
  user_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
);

create table if not exists public.hub_program_overrides(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  program_id text not null references public.station_programs(id) on delete cascade,
  air_date date not null,
  status text not null default 'needs_replacement' check(status in ('needs_replacement','can_run','covered','cancelled')),
  original_user_id uuid references auth.users(id) on delete set null,
  replacement_user_id uuid references auth.users(id) on delete set null,
  source_absence_id uuid references public.hub_absences(id) on delete cascade,
  source_coverage_id uuid unique references public.hub_absence_coverages(id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique(program_id,air_date,source_absence_id)
);
create index if not exists hub_program_overrides_station_date_idx on public.hub_program_overrides(station_slug,air_date,status);
alter table public.hub_program_overrides enable row level security;
drop policy if exists "team can read program overrides" on public.hub_program_overrides;
create policy "team can read program overrides" on public.hub_program_overrides for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "managers can manage program overrides" on public.hub_program_overrides;
create policy "managers can manage program overrides" on public.hub_program_overrides for all to authenticated
using(public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer') and public.vlacora_can_access_station(station_slug))
with check(public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer') and public.vlacora_can_access_station(station_slug));

create or replace function public.vlacora_sync_program_override_from_coverage()
returns trigger language plpgsql security definer set search_path=public as $$
declare a record; next_status text;
begin
  if tg_op='DELETE' then
    delete from public.hub_program_overrides where source_coverage_id=old.id;
    return old;
  end if;
  select id,station_slug,user_id into a from public.hub_absences where id=new.absence_id;
  if a.id is null then return new; end if;
  next_status:=case
    when new.status='confirmed' and new.replacement_user_id is not null then 'covered'
    when new.coverage_mode='optional' then 'can_run'
    else 'needs_replacement'
  end;
  insert into public.hub_program_overrides(station_slug,program_id,air_date,status,original_user_id,replacement_user_id,source_absence_id,source_coverage_id,notes,updated_at)
  values(a.station_slug,new.program_id,new.air_date,next_status,a.user_id,new.replacement_user_id,a.id,new.id,new.notes,now())
  on conflict(source_coverage_id) do update set status=excluded.status,replacement_user_id=excluded.replacement_user_id,notes=excluded.notes,updated_at=now();
  return new;
end;$$;

drop trigger if exists hub_absence_coverage_sync_override on public.hub_absence_coverages;
create trigger hub_absence_coverage_sync_override after insert or update or delete on public.hub_absence_coverages
for each row execute procedure public.vlacora_sync_program_override_from_coverage();

-- Backfill overrides for already existing coverages.
insert into public.hub_program_overrides(station_slug,program_id,air_date,status,original_user_id,replacement_user_id,source_absence_id,source_coverage_id,notes,updated_at)
select a.station_slug,c.program_id,c.air_date,
  case when c.status='confirmed' and c.replacement_user_id is not null then 'covered' when c.coverage_mode='optional' then 'can_run' else 'needs_replacement' end,
  a.user_id,c.replacement_user_id,a.id,c.id,c.notes,now()
from public.hub_absence_coverages c join public.hub_absences a on a.id=c.absence_id
on conflict(source_coverage_id) do nothing;

-- -----------------------------------------------------------------------------
-- 6. Editorial version history
-- -----------------------------------------------------------------------------
create table if not exists public.hub_editorial_workspace_versions(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  air_date date not null,
  air_hour smallint not null check(air_hour between 0 and 23),
  revision integer not null,
  items jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(station_slug,air_date,air_hour,revision)
);
create index if not exists hub_editorial_versions_lookup_idx on public.hub_editorial_workspace_versions(station_slug,air_date,air_hour,revision desc);
alter table public.hub_editorial_workspace_versions enable row level security;
drop policy if exists "team can read editorial versions" on public.hub_editorial_workspace_versions;
create policy "team can read editorial versions" on public.hub_editorial_workspace_versions for select to authenticated using(public.vlacora_can_access_station(station_slug));

create or replace function public.vlacora_editorial_revision_before_save()
returns trigger language plpgsql security definer set search_path=public as $$
declare old_rev integer;
begin
  if tg_op='INSERT' then
    new.source_revision:='1';
  elsif new.items is distinct from old.items then
    begin old_rev:=old.source_revision::integer; exception when others then old_rev:=0; end;
    new.source_revision:=(old_rev+1)::text;
  else
    new.source_revision:=old.source_revision;
  end if;
  return new;
end;$$;

drop trigger if exists hub_editorial_revision_before_save on public.hub_editorial_workspaces;
create trigger hub_editorial_revision_before_save before insert or update on public.hub_editorial_workspaces
for each row execute procedure public.vlacora_editorial_revision_before_save();

create or replace function public.vlacora_editorial_version_after_save()
returns trigger language plpgsql security definer set search_path=public as $$
declare rev integer;
begin
  if tg_op='UPDATE' and new.items is not distinct from old.items then return new; end if;
  begin rev:=new.source_revision::integer; exception when others then rev:=1; end;
  insert into public.hub_editorial_workspace_versions(station_slug,air_date,air_hour,revision,items,created_by,created_at)
  values(new.station_slug,new.air_date,new.air_hour,rev,new.items,new.updated_by,now())
  on conflict(station_slug,air_date,air_hour,revision) do update set items=excluded.items,created_by=excluded.created_by,created_at=excluded.created_at;
  return new;
end;$$;

drop trigger if exists hub_editorial_version_after_save on public.hub_editorial_workspaces;
create trigger hub_editorial_version_after_save after insert or update on public.hub_editorial_workspaces
for each row execute procedure public.vlacora_editorial_version_after_save();

-- -----------------------------------------------------------------------------
-- 7. Hitlist series: weekly, yearly and one-off specials; historical Excel import metadata
-- -----------------------------------------------------------------------------
alter table public.hitlists add column if not exists chart_kind text not null default 'weekly';
alter table public.hitlists add column if not exists series_key text not null default '';
alter table public.hitlists add column if not exists edition_year integer;
alter table public.hitlists add column if not exists edition_week integer;
alter table public.hitlists add column if not exists recurrence text not null default 'weekly';
alter table public.hitlists add column if not exists source_label text not null default '';
do $$ begin
  if not exists(select 1 from pg_constraint where conname='hitlists_chart_kind_check') then alter table public.hitlists add constraint hitlists_chart_kind_check check(chart_kind in ('weekly','annual','special')); end if;
  if not exists(select 1 from pg_constraint where conname='hitlists_recurrence_check') then alter table public.hitlists add constraint hitlists_recurrence_check check(recurrence in ('weekly','annual','none')); end if;
  if not exists(select 1 from pg_constraint where conname='hitlists_edition_week_check') then alter table public.hitlists add constraint hitlists_edition_week_check check(edition_week is null or edition_week between 1 and 53); end if;
end $$;
create index if not exists hitlists_series_publish_idx on public.hitlists(station_slug,series_key,publish_date desc);

-- -----------------------------------------------------------------------------
-- Realtime registration (safe/idempotent)
-- -----------------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['hub_stations','hub_calendar_events','hub_program_overrides','hub_editorial_workspace_versions'] loop
    if to_regclass('public.'||t) is not null and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
