-- VLACORA HUB 0.14.0
-- Persistent settings, real team profile metadata, incident workflow and template builder.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists job_title text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists last_seen_at timestamptz;

update public.profiles p set email=u.email,updated_at=now()
from auth.users u where u.id=p.id and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name,email)
  values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),nullif(split_part(coalesce(new.email,''),'@',1),''),'VLACORA gebruiker'),new.email)
  on conflict(id) do update set email=excluded.email,display_name=case when coalesce(public.profiles.display_name,'')='' then excluded.display_name else public.profiles.display_name end,updated_at=now();
  return new;
end;$$;
revoke all on function public.handle_new_user() from public;

create or replace function public.vlacora_current_role()
returns text language sql stable security definer set search_path=public as $$
  select coalesce((select lower(p.role) from public.profiles p where p.id=auth.uid() and p.active),'');
$$;
revoke all on function public.vlacora_current_role() from public;
grant execute on function public.vlacora_current_role() to authenticated;

create or replace function public.vlacora_can_access_station(target_station text)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when auth.uid() is null then false
    when target_station is null or target_station='all' then true
    when public.vlacora_current_role()='superadmin' then true
    when not exists(select 1 from public.station_memberships sm0 where sm0.station_slug=target_station and sm0.active) then true
    else exists(select 1 from public.station_memberships sm where sm.station_slug=target_station and sm.user_id=auth.uid() and sm.active)
  end;
$$;
revoke all on function public.vlacora_can_access_station(text) from public;
grant execute on function public.vlacora_can_access_station(text) to authenticated;

create table if not exists public.hub_settings(
  scope text not null,
  setting_key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(scope,setting_key)
);
create index if not exists hub_settings_updated_idx on public.hub_settings(updated_at desc);
alter table public.hub_settings enable row level security;

create or replace function public.vlacora_can_manage_setting(target_scope text)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when auth.uid() is null then false
    when public.vlacora_current_role()='superadmin' then true
    when target_scope=('user:'||auth.uid()::text) then true
    when public.vlacora_current_role()='stationmanager' and target_scope like 'station:%' then exists(
      select 1 from public.station_memberships sm where sm.user_id=auth.uid() and sm.active and sm.station_slug=substring(target_scope from 9)
    )
    else false
  end;
$$;
revoke all on function public.vlacora_can_manage_setting(text) from public;
grant execute on function public.vlacora_can_manage_setting(text) to authenticated;

drop policy if exists "team can read hub settings" on public.hub_settings;
create policy "team can read hub settings" on public.hub_settings for select to authenticated
using(scope='global' or scope=('user:'||auth.uid()::text) or (scope like 'station:%' and public.vlacora_can_access_station(substring(scope from 9))));
drop policy if exists "authorized users can insert hub settings" on public.hub_settings;
create policy "authorized users can insert hub settings" on public.hub_settings for insert to authenticated with check(public.vlacora_can_manage_setting(scope));
drop policy if exists "authorized users can update hub settings" on public.hub_settings;
create policy "authorized users can update hub settings" on public.hub_settings for update to authenticated using(public.vlacora_can_manage_setting(scope)) with check(public.vlacora_can_manage_setting(scope));
drop policy if exists "authorized users can delete hub settings" on public.hub_settings;
create policy "authorized users can delete hub settings" on public.hub_settings for delete to authenticated using(public.vlacora_can_manage_setting(scope));

create table if not exists public.hub_incidents(
  id uuid primary key default gen_random_uuid(),station_slug text not null,category text not null default 'Ander',title text not null,description text not null default '',
  severity text not null default 'Normaal' check(severity in ('Laag','Normaal','Hoog','Kritiek')),
  status text not null default 'Open' check(status in ('Open','In behandeling','Wachten op info','Opgelost','Gesloten')),
  assignee_user_id uuid references auth.users(id) on delete set null,created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),resolved_at timestamptz
);
create index if not exists hub_incidents_station_status_idx on public.hub_incidents(station_slug,status,updated_at desc);
alter table public.hub_incidents enable row level security;

create table if not exists public.hub_incident_updates(
  id uuid primary key default gen_random_uuid(),incident_id uuid not null references public.hub_incidents(id) on delete cascade,
  update_type text not null default 'update' check(update_type in ('created','update','status','assignment','resolution')),
  body text not null default '',status text,created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now()
);
create index if not exists hub_incident_updates_incident_idx on public.hub_incident_updates(incident_id,created_at);
alter table public.hub_incident_updates enable row level security;

drop policy if exists "team can read incidents" on public.hub_incidents;
create policy "team can read incidents" on public.hub_incidents for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can create incidents" on public.hub_incidents;
create policy "team can create incidents" on public.hub_incidents for insert to authenticated with check(created_by=auth.uid() and public.vlacora_can_access_station(station_slug));
drop policy if exists "team can update incidents" on public.hub_incidents;
create policy "team can update incidents" on public.hub_incidents for update to authenticated using(public.vlacora_can_access_station(station_slug)) with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can read incident updates" on public.hub_incident_updates;
create policy "team can read incident updates" on public.hub_incident_updates for select to authenticated using(exists(select 1 from public.hub_incidents i where i.id=incident_id and public.vlacora_can_access_station(i.station_slug)));
drop policy if exists "team can create incident updates" on public.hub_incident_updates;
create policy "team can create incident updates" on public.hub_incident_updates for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.hub_incidents i where i.id=incident_id and public.vlacora_can_access_station(i.station_slug)));

create table if not exists public.hub_templates(
  id uuid primary key default gen_random_uuid(),station_slug text,name text not null,category text not null default 'Workflow',description text not null default '',
  fields jsonb not null default '[]'::jsonb,automations jsonb not null default '[]'::jsonb,active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists hub_templates_station_idx on public.hub_templates(station_slug,category,name);
alter table public.hub_templates enable row level security;
drop policy if exists "team can read templates" on public.hub_templates;
create policy "team can read templates" on public.hub_templates for select to authenticated using(station_slug is null or station_slug='all' or public.vlacora_can_access_station(station_slug));
drop policy if exists "editors can create templates" on public.hub_templates;
create policy "editors can create templates" on public.hub_templates for insert to authenticated with check(public.vlacora_current_role() in ('superadmin','stationmanager','redactie','muziekredactie','techniek') and (station_slug is null or station_slug='all' or public.vlacora_can_access_station(station_slug)));
drop policy if exists "editors can update templates" on public.hub_templates;
create policy "editors can update templates" on public.hub_templates for update to authenticated using(public.vlacora_current_role() in ('superadmin','stationmanager','redactie','muziekredactie','techniek') and (station_slug is null or station_slug='all' or public.vlacora_can_access_station(station_slug))) with check(public.vlacora_current_role() in ('superadmin','stationmanager','redactie','muziekredactie','techniek'));
drop policy if exists "managers can delete templates" on public.hub_templates;
create policy "managers can delete templates" on public.hub_templates for delete to authenticated using(public.vlacora_current_role() in ('superadmin','stationmanager'));

create or replace function public.vlacora_update_team_member(target_user_id uuid,p_display_name text,p_role text,p_job_title text,p_active boolean,p_permissions jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare normalized_role text:=lower(trim(coalesce(p_role,'')));
begin
  if public.vlacora_current_role()<>'superadmin' then raise exception 'Alleen een superadmin kan teamprofielen beheren.' using errcode='42501'; end if;
  if normalized_role not in ('superadmin','stationmanager','muziekredactie','redactie','presentator','social & marketing','techniek','kijker') then raise exception 'Ongeldige VLACORA-rol.' using errcode='22023'; end if;
  update public.profiles set display_name=coalesce(nullif(trim(p_display_name),''),display_name),role=normalized_role,job_title=coalesce(p_job_title,''),active=coalesce(p_active,true),permissions=coalesce(p_permissions,'{}'::jsonb),updated_at=now() where id=target_user_id;
  if not found then raise exception 'Gebruiker niet gevonden.' using errcode='P0002'; end if;
end;$$;
revoke all on function public.vlacora_update_team_member(uuid,text,text,text,boolean,jsonb) from public;
grant execute on function public.vlacora_update_team_member(uuid,text,text,text,boolean,jsonb) to authenticated;

create or replace function public.vlacora_replace_station_memberships(target_user_id uuid,p_memberships jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if public.vlacora_current_role()<>'superadmin' then raise exception 'Alleen een superadmin kan stationrechten beheren.' using errcode='42501'; end if;
  if jsonb_typeof(coalesce(p_memberships,'[]'::jsonb))<>'array' then raise exception 'Stationrechten moeten een lijst zijn.' using errcode='22023'; end if;
  delete from public.station_memberships where user_id=target_user_id;
  insert into public.station_memberships(user_id,station_slug,role,permissions,active,updated_at)
  select target_user_id,trim(x->>'stationSlug'),lower(coalesce(nullif(trim(x->>'role'),''),(select role from public.profiles where id=target_user_id),'kijker')),coalesce(x->'permissions','{}'::jsonb),coalesce((x->>'active')::boolean,true),now()
  from jsonb_array_elements(coalesce(p_memberships,'[]'::jsonb)) x where coalesce(trim(x->>'stationSlug'),'')<>'';
end;$$;
revoke all on function public.vlacora_replace_station_memberships(uuid,jsonb) from public;
grant execute on function public.vlacora_replace_station_memberships(uuid,jsonb) to authenticated;

create or replace function public.vlacora_touch_last_seen() returns void language sql security definer set search_path=public as $$
  update public.profiles set last_seen_at=now() where id=auth.uid();
$$;
revoke all on function public.vlacora_touch_last_seen() from public;
grant execute on function public.vlacora_touch_last_seen() to authenticated;

create or replace function public.sync_profile_email_from_auth() returns trigger language plpgsql security definer set search_path=public as $$
begin update public.profiles set email=new.email,updated_at=now() where id=new.id;return new;end;$$;
drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated after update of email on auth.users for each row when(old.email is distinct from new.email) execute procedure public.sync_profile_email_from_auth();
revoke all on function public.sync_profile_email_from_auth() from public;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_incidents') then alter publication supabase_realtime add table public.hub_incidents; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_incident_updates') then alter publication supabase_realtime add table public.hub_incident_updates; end if;
end $$;
