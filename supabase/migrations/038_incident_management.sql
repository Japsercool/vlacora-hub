-- VLACORA HUB 0.24.4
-- Meldpuntbeheer: toewijzingen, extra behandelaars, categorie-instellingen en fijnmazige editrechten.

create table if not exists public.hub_incident_collaborators(
  incident_id uuid not null references public.hub_incidents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  can_edit boolean not null default true,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(incident_id,user_id)
);
create index if not exists hub_incident_collaborators_user_idx on public.hub_incident_collaborators(user_id,incident_id);
alter table public.hub_incident_collaborators enable row level security;

create table if not exists public.hub_incident_category_settings(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  category text not null,
  active boolean not null default true,
  default_severity text not null default 'Normaal' check(default_severity in ('Laag','Normaal','Hoog','Kritiek')),
  default_assignee_user_id uuid references auth.users(id) on delete set null,
  sort_order integer not null default 100,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(station_slug,category)
);
create index if not exists hub_incident_category_settings_station_idx on public.hub_incident_category_settings(station_slug,active,sort_order,category);
alter table public.hub_incident_category_settings enable row level security;

create or replace function public.vlacora_can_manage_incidents(target_station text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.profiles p
    where p.id=auth.uid()
      and coalesce(p.active,true)
      and public.vlacora_can_access_station(target_station)
      and (
        lower(coalesce(p.role,'')) in ('superadmin','stationmanager','admin','beheer','techniek')
        or coalesce(p.permissions->>'meldpunt_beheer','none') in ('edit','publish','admin')
      )
  );
$$;

create or replace function public.vlacora_can_edit_incident(target_incident uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.hub_incidents i
    where i.id=target_incident
      and public.vlacora_can_access_station(i.station_slug)
      and (
        public.vlacora_can_manage_incidents(i.station_slug)
        or i.created_by=auth.uid()
        or i.assignee_user_id=auth.uid()
        or exists(
          select 1 from public.hub_incident_collaborators c
          where c.incident_id=i.id and c.user_id=auth.uid() and c.can_edit
        )
      )
  );
$$;

revoke all on function public.vlacora_can_manage_incidents(text) from public, anon;
revoke all on function public.vlacora_can_edit_incident(uuid) from public, anon;
grant execute on function public.vlacora_can_manage_incidents(text) to authenticated;
grant execute on function public.vlacora_can_edit_incident(uuid) to authenticated;

-- Teamleden mogen de behandelaars zien wanneer ze het dossier mogen lezen.
drop policy if exists "team can read incident collaborators" on public.hub_incident_collaborators;
create policy "team can read incident collaborators" on public.hub_incident_collaborators
for select to authenticated
using(exists(select 1 from public.hub_incidents i where i.id=incident_id and public.vlacora_can_access_station(i.station_slug)));

drop policy if exists "incident managers can add collaborators" on public.hub_incident_collaborators;
create policy "incident managers can add collaborators" on public.hub_incident_collaborators
for insert to authenticated
with check(exists(select 1 from public.hub_incidents i where i.id=incident_id and public.vlacora_can_manage_incidents(i.station_slug)));

drop policy if exists "incident managers can update collaborators" on public.hub_incident_collaborators;
create policy "incident managers can update collaborators" on public.hub_incident_collaborators
for update to authenticated
using(exists(select 1 from public.hub_incidents i where i.id=incident_id and public.vlacora_can_manage_incidents(i.station_slug)))
with check(exists(select 1 from public.hub_incidents i where i.id=incident_id and public.vlacora_can_manage_incidents(i.station_slug)));

drop policy if exists "incident managers can delete collaborators" on public.hub_incident_collaborators;
create policy "incident managers can delete collaborators" on public.hub_incident_collaborators
for delete to authenticated
using(exists(select 1 from public.hub_incidents i where i.id=incident_id and public.vlacora_can_manage_incidents(i.station_slug)));

-- Categorie-instellingen zijn leesbaar voor het station en beheerbaar via Meldpuntbeheer.
drop policy if exists "team can read incident category settings" on public.hub_incident_category_settings;
create policy "team can read incident category settings" on public.hub_incident_category_settings
for select to authenticated using(public.vlacora_can_access_station(station_slug));

drop policy if exists "incident managers can insert category settings" on public.hub_incident_category_settings;
create policy "incident managers can insert category settings" on public.hub_incident_category_settings
for insert to authenticated with check(public.vlacora_can_manage_incidents(station_slug));

drop policy if exists "incident managers can update category settings" on public.hub_incident_category_settings;
create policy "incident managers can update category settings" on public.hub_incident_category_settings
for update to authenticated using(public.vlacora_can_manage_incidents(station_slug)) with check(public.vlacora_can_manage_incidents(station_slug));

drop policy if exists "incident managers can delete category settings" on public.hub_incident_category_settings;
create policy "incident managers can delete category settings" on public.hub_incident_category_settings
for delete to authenticated using(public.vlacora_can_manage_incidents(station_slug));

-- Meldingen blijven voor het station leesbaar, maar bewerken is voortaan dossiergericht.
drop policy if exists "team can update incidents" on public.hub_incidents;
drop policy if exists "authorized handlers can update incidents" on public.hub_incidents;
create policy "authorized handlers can update incidents" on public.hub_incidents
for update to authenticated
using(public.vlacora_can_edit_incident(id))
with check(public.vlacora_can_edit_incident(id));

drop policy if exists "team can create incident updates" on public.hub_incident_updates;
drop policy if exists "authorized handlers can create incident updates" on public.hub_incident_updates;
create policy "authorized handlers can create incident updates" on public.hub_incident_updates
for insert to authenticated
with check(created_by=auth.uid() and public.vlacora_can_edit_incident(incident_id));

-- Niet-beheerders mogen een dossier behandelen, maar niet stilletjes eigenaar/categorie/ernst of inhoud wijzigen.
create or replace function public.vlacora_guard_incident_management_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if public.vlacora_can_manage_incidents(old.station_slug) then
    return new;
  end if;
  new.station_slug := old.station_slug;
  new.category := old.category;
  new.title := old.title;
  new.description := old.description;
  new.severity := old.severity;
  new.assignee_user_id := old.assignee_user_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;
revoke all on function public.vlacora_guard_incident_management_fields() from public, anon, authenticated;

drop trigger if exists hub_incidents_guard_management_fields on public.hub_incidents;
create trigger hub_incidents_guard_management_fields
before update on public.hub_incidents
for each row execute function public.vlacora_guard_incident_management_fields();

-- Standaard categorieën per bestaand station. ON CONFLICT maakt deze migratie veilig herhaalbaar.
insert into public.hub_incident_category_settings(station_slug,category,default_severity,sort_order)
select s.slug,v.category,v.severity,v.sort_order
from public.hub_stations s
cross join (values
 ('Programmering','Normaal',10),('Muziek','Laag',20),('Technisch','Hoog',30),('Vormgeving','Normaal',40),
 ('Facilities','Normaal',50),('Afwezigheid','Normaal',60),('Website / socials','Normaal',70),('Nieuws','Normaal',80),
 ('Reclame','Hoog',90),('Tip redactie','Laag',100),('Ander','Normaal',110)
) as v(category,severity,sort_order)
on conflict(station_slug,category) do nothing;

-- Realtime voor toewijzingen/categoriebeheer.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_incident_collaborators') then
    alter publication supabase_realtime add table public.hub_incident_collaborators;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_incident_category_settings') then
    alter publication supabase_realtime add table public.hub_incident_category_settings;
  end if;
end $$;
