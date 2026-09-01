-- VLACORA HUB 0.11.0 - editable hitlists
-- Run after 010_vlacora_hub_core.sql.

create table if not exists public.hitlists (
  id text primary key,
  station_slug text not null,
  name text not null,
  edition_label text not null,
  publish_date date,
  valid_from date,
  valid_to date,
  size integer not null default 50 check(size between 1 and 1000),
  status text not null default 'draft' check(status in ('draft','published','archived')),
  previous_edition_id text,
  program_name text not null default '',
  notes text not null default '',
  entries jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hitlists_station_publish_idx on public.hitlists(station_slug,publish_date desc);
create index if not exists hitlists_station_status_idx on public.hitlists(station_slug,status);

alter table public.hitlists enable row level security;

drop policy if exists "team can read hitlists" on public.hitlists;
create policy "team can read hitlists" on public.hitlists for select to authenticated using(true);
drop policy if exists "team can insert hitlists" on public.hitlists;
create policy "team can insert hitlists" on public.hitlists for insert to authenticated with check(true);
drop policy if exists "team can update hitlists" on public.hitlists;
create policy "team can update hitlists" on public.hitlists for update to authenticated using(true) with check(true);
drop policy if exists "team can delete hitlists" on public.hitlists;
create policy "team can delete hitlists" on public.hitlists for delete to authenticated using(true);
