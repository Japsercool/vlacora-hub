-- VLACORA HUB 0.10.0
-- Run this once in the Supabase SQL editor after creating your project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'redactie',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)))
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles(id,display_name)
select id,coalesce(raw_user_meta_data->>'display_name',split_part(email,'@',1)) from auth.users
on conflict(id) do nothing;

create table if not exists public.station_programs (
  id text primary key,
  station_slug text not null,
  day integer not null check(day between 0 and 6),
  start_time time not null,
  end_time time not null,
  name text not null,
  host text not null default '',
  format text not null default 'Muziekprogramma',
  notes text not null default '',
  active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists station_programs_station_day_idx on public.station_programs(station_slug,day,start_time);

alter table public.profiles enable row level security;
alter table public.station_programs enable row level security;

drop policy if exists "team can read profiles" on public.profiles;
create policy "team can read profiles" on public.profiles for select to authenticated using(true);
drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile" on public.profiles for update to authenticated using(auth.uid()=id) with check(auth.uid()=id);

drop policy if exists "team can read programming" on public.station_programs;
create policy "team can read programming" on public.station_programs for select to authenticated using(true);
drop policy if exists "team can insert programming" on public.station_programs;
create policy "team can insert programming" on public.station_programs for insert to authenticated with check(true);
drop policy if exists "team can update programming" on public.station_programs;
create policy "team can update programming" on public.station_programs for update to authenticated using(true) with check(true);
drop policy if exists "team can delete programming" on public.station_programs;
create policy "team can delete programming" on public.station_programs for delete to authenticated using(true);
