-- VLACORA HUB 0.15.0
-- TOPplaylist-style editorial workspaces and true per-hour editorial templates.

create table if not exists public.hub_editorial_templates(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  name text not null,
  program_name text not null default '',
  sequence jsonb not null default '[]'::jsonb,
  assignments jsonb not null default '[]'::jsonb,
  notes text not null default '',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hub_editorial_templates_station_idx on public.hub_editorial_templates(station_slug,program_name,name);
alter table public.hub_editorial_templates enable row level security;

drop policy if exists "team can read editorial templates" on public.hub_editorial_templates;
create policy "team can read editorial templates" on public.hub_editorial_templates for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "editors can create editorial templates" on public.hub_editorial_templates;
create policy "editors can create editorial templates" on public.hub_editorial_templates for insert to authenticated with check(public.vlacora_current_role() in ('superadmin','stationmanager','redactie','muziekredactie') and public.vlacora_can_access_station(station_slug));
drop policy if exists "editors can update editorial templates" on public.hub_editorial_templates;
create policy "editors can update editorial templates" on public.hub_editorial_templates for update to authenticated using(public.vlacora_current_role() in ('superadmin','stationmanager','redactie','muziekredactie') and public.vlacora_can_access_station(station_slug)) with check(public.vlacora_current_role() in ('superadmin','stationmanager','redactie','muziekredactie') and public.vlacora_can_access_station(station_slug));
drop policy if exists "managers can delete editorial templates" on public.hub_editorial_templates;
create policy "managers can delete editorial templates" on public.hub_editorial_templates for delete to authenticated using(public.vlacora_current_role() in ('superadmin','stationmanager'));

create table if not exists public.hub_editorial_workspaces(
  station_slug text not null,
  air_date date not null,
  air_hour smallint not null check(air_hour between 0 and 23),
  items jsonb not null default '[]'::jsonb,
  source_revision text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(station_slug,air_date,air_hour)
);
create index if not exists hub_editorial_workspaces_updated_idx on public.hub_editorial_workspaces(updated_at desc);
alter table public.hub_editorial_workspaces enable row level security;

drop policy if exists "team can read editorial workspaces" on public.hub_editorial_workspaces;
create policy "team can read editorial workspaces" on public.hub_editorial_workspaces for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "editors can insert editorial workspaces" on public.hub_editorial_workspaces;
create policy "editors can insert editorial workspaces" on public.hub_editorial_workspaces for insert to authenticated with check(public.vlacora_current_role() in ('superadmin','stationmanager','redactie','muziekredactie','presentator') and public.vlacora_can_access_station(station_slug));
drop policy if exists "editors can update editorial workspaces" on public.hub_editorial_workspaces;
create policy "editors can update editorial workspaces" on public.hub_editorial_workspaces for update to authenticated using(public.vlacora_can_access_station(station_slug)) with check(public.vlacora_current_role() in ('superadmin','stationmanager','redactie','muziekredactie','presentator') and public.vlacora_can_access_station(station_slug));

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_editorial_templates') then alter publication supabase_realtime add table public.hub_editorial_templates; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_editorial_workspaces') then alter publication supabase_realtime add table public.hub_editorial_workspaces; end if;
end $$;
