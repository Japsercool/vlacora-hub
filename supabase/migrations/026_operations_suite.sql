
-- VLACORA HUB 0.20.0 — daily operations suite
-- Presenter dashboards, program pages, absences/replacements, contacts,
-- content inbox and operational warnings.

create table if not exists public.hub_program_profiles(
  program_id text primary key references public.station_programs(id) on delete cascade,
  station_slug text not null,
  summary text not null default '',
  studio_info text not null default '',
  jingle_notes text not null default '',
  fixed_items jsonb not null default '[]'::jsonb,
  document_links jsonb not null default '[]'::jsonb,
  editorial_template_ids jsonb not null default '[]'::jsonb,
  social_template_ids jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hub_program_team(
  program_id text not null references public.station_programs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'presentator',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(program_id,user_id)
);

create table if not exists public.hub_absences(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text not null default '',
  notes text not null default '',
  status text not null default 'approved'
    check(status in ('requested','approved','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_on>=starts_on)
);

create table if not exists public.hub_absence_coverages(
  id uuid primary key default gen_random_uuid(),
  absence_id uuid not null references public.hub_absences(id) on delete cascade,
  program_id text not null references public.station_programs(id) on delete cascade,
  air_date date not null,
  replacement_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'unassigned'
    check(status in ('unassigned','asked','confirmed','declined')),
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(absence_id,program_id,air_date)
);

create table if not exists public.hub_contacts(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null default 'all',
  category text not null default 'partner'
    check(category in ('presentator','producer','techniek','sales','nieuws','partner','hosting','nood','other')),
  name text not null,
  company text not null default '',
  role_title text not null default '',
  email text not null default '',
  phone text not null default '',
  emergency boolean not null default false,
  visibility text not null default 'team'
    check(visibility in ('team','management')),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hub_content_inbox(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  content_type text not null default 'idea'
    check(content_type in ('idea','news','guest','social','music','contest','other')),
  title text not null,
  description text not null default '',
  status text not null default 'new'
    check(status in ('new','reviewing','planned','used','rejected')),
  target_program_id text references public.station_programs(id) on delete set null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  scheduled_for timestamptz,
  team_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hub_operational_warnings(
  warning_key text primary key,
  station_slug text not null,
  code text not null,
  severity text not null default 'warning'
    check(severity in ('info','warning','critical')),
  title text not null,
  body text not null default '',
  status text not null default 'open'
    check(status in ('open','resolved','ignored')),
  action_path text not null default '',
  source text not null default 'VLACORA',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists hub_program_profiles_station_idx on public.hub_program_profiles(station_slug);
create index if not exists hub_program_team_user_idx on public.hub_program_team(user_id);
create index if not exists hub_absences_station_dates_idx on public.hub_absences(station_slug,starts_on,ends_on);
create index if not exists hub_absences_user_dates_idx on public.hub_absences(user_id,starts_on,ends_on);
create index if not exists hub_absence_coverages_replacement_idx on public.hub_absence_coverages(replacement_user_id,air_date);
create index if not exists hub_contacts_station_idx on public.hub_contacts(station_slug,category,name);
create index if not exists hub_content_inbox_station_status_idx on public.hub_content_inbox(station_slug,status,created_at desc);
create index if not exists hub_content_inbox_submitter_idx on public.hub_content_inbox(submitted_by,created_at desc);
create index if not exists hub_operational_warnings_station_idx on public.hub_operational_warnings(station_slug,status,severity,last_seen_at desc);

alter table public.hub_program_profiles enable row level security;
alter table public.hub_program_team enable row level security;
alter table public.hub_absences enable row level security;
alter table public.hub_absence_coverages enable row level security;
alter table public.hub_contacts enable row level security;
alter table public.hub_content_inbox enable row level security;
alter table public.hub_operational_warnings enable row level security;

drop policy if exists "team can read program profiles" on public.hub_program_profiles;
create policy "team can read program profiles" on public.hub_program_profiles
for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can write program profiles" on public.hub_program_profiles;
create policy "team can write program profiles" on public.hub_program_profiles
for insert to authenticated with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can update program profiles" on public.hub_program_profiles;
create policy "team can update program profiles" on public.hub_program_profiles
for update to authenticated using(public.vlacora_can_access_station(station_slug))
with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "managers can delete program profiles" on public.hub_program_profiles;
create policy "managers can delete program profiles" on public.hub_program_profiles
for delete to authenticated using(public.vlacora_current_role() in ('superadmin','stationmanager'));

drop policy if exists "team can read program team" on public.hub_program_team;
create policy "team can read program team" on public.hub_program_team
for select to authenticated using(exists(
  select 1 from public.station_programs p where p.id=program_id and public.vlacora_can_access_station(p.station_slug)
));
drop policy if exists "team can insert program team" on public.hub_program_team;
create policy "team can insert program team" on public.hub_program_team
for insert to authenticated with check(exists(
  select 1 from public.station_programs p where p.id=program_id and public.vlacora_can_access_station(p.station_slug)
));
drop policy if exists "team can update program team" on public.hub_program_team;
create policy "team can update program team" on public.hub_program_team
for update to authenticated using(exists(
  select 1 from public.station_programs p where p.id=program_id and public.vlacora_can_access_station(p.station_slug)
)) with check(exists(
  select 1 from public.station_programs p where p.id=program_id and public.vlacora_can_access_station(p.station_slug)
));
drop policy if exists "team can delete program team" on public.hub_program_team;
create policy "team can delete program team" on public.hub_program_team
for delete to authenticated using(exists(
  select 1 from public.station_programs p where p.id=program_id and public.vlacora_can_access_station(p.station_slug)
));

drop policy if exists "team can read absences" on public.hub_absences;
create policy "team can read absences" on public.hub_absences
for select to authenticated using(user_id=auth.uid() or public.vlacora_can_access_station(station_slug));
drop policy if exists "users can create absences" on public.hub_absences;
create policy "users can create absences" on public.hub_absences
for insert to authenticated with check(
  created_by=auth.uid() and public.vlacora_can_access_station(station_slug)
  and (user_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager'))
);
drop policy if exists "users or managers can update absences" on public.hub_absences;
create policy "users or managers can update absences" on public.hub_absences
for update to authenticated using(
  user_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager')
) with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "users or managers can delete absences" on public.hub_absences;
create policy "users or managers can delete absences" on public.hub_absences
for delete to authenticated using(
  user_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager')
);

drop policy if exists "team can read absence coverage" on public.hub_absence_coverages;
create policy "team can read absence coverage" on public.hub_absence_coverages
for select to authenticated using(exists(
  select 1 from public.hub_absences a where a.id=absence_id and (a.user_id=auth.uid() or public.vlacora_can_access_station(a.station_slug))
));
drop policy if exists "team can write absence coverage" on public.hub_absence_coverages;
create policy "team can write absence coverage" on public.hub_absence_coverages
for insert to authenticated with check(exists(
  select 1 from public.hub_absences a where a.id=absence_id and (a.user_id=auth.uid() or public.vlacora_can_access_station(a.station_slug))
));
drop policy if exists "team can update absence coverage" on public.hub_absence_coverages;
create policy "team can update absence coverage" on public.hub_absence_coverages
for update to authenticated using(exists(
  select 1 from public.hub_absences a where a.id=absence_id and (a.user_id=auth.uid() or public.vlacora_can_access_station(a.station_slug))
)) with check(exists(
  select 1 from public.hub_absences a where a.id=absence_id and (a.user_id=auth.uid() or public.vlacora_can_access_station(a.station_slug))
));
drop policy if exists "team can delete absence coverage" on public.hub_absence_coverages;
create policy "team can delete absence coverage" on public.hub_absence_coverages
for delete to authenticated using(exists(
  select 1 from public.hub_absences a where a.id=absence_id and (a.user_id=auth.uid() or public.vlacora_can_access_station(a.station_slug))
));

drop policy if exists "team can read contacts" on public.hub_contacts;
create policy "team can read contacts" on public.hub_contacts
for select to authenticated using(
  (station_slug='all' or public.vlacora_can_access_station(station_slug))
  and (visibility='team' or public.vlacora_current_role() in ('superadmin','stationmanager'))
);
drop policy if exists "managers can create contacts" on public.hub_contacts;
create policy "managers can create contacts" on public.hub_contacts
for insert to authenticated with check(
  public.vlacora_current_role() in ('superadmin','stationmanager')
  and (station_slug='all' or public.vlacora_can_access_station(station_slug))
);
drop policy if exists "managers can update contacts" on public.hub_contacts;
create policy "managers can update contacts" on public.hub_contacts
for update to authenticated using(public.vlacora_current_role() in ('superadmin','stationmanager'))
with check(station_slug='all' or public.vlacora_can_access_station(station_slug));
drop policy if exists "managers can delete contacts" on public.hub_contacts;
create policy "managers can delete contacts" on public.hub_contacts
for delete to authenticated using(public.vlacora_current_role() in ('superadmin','stationmanager'));

drop policy if exists "team can read content inbox" on public.hub_content_inbox;
create policy "team can read content inbox" on public.hub_content_inbox
for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can submit content" on public.hub_content_inbox;
create policy "team can submit content" on public.hub_content_inbox
for insert to authenticated with check(submitted_by=auth.uid() and public.vlacora_can_access_station(station_slug));
drop policy if exists "submitter or editorial can update content" on public.hub_content_inbox;
create policy "submitter or editorial can update content" on public.hub_content_inbox
for update to authenticated using(
  submitted_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager','redactie','muziekredactie','social')
) with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "submitter or managers can delete content" on public.hub_content_inbox;
create policy "submitter or managers can delete content" on public.hub_content_inbox
for delete to authenticated using(
  submitted_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager')
);

drop policy if exists "team can read operational warnings" on public.hub_operational_warnings;
create policy "team can read operational warnings" on public.hub_operational_warnings
for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can create operational warnings" on public.hub_operational_warnings;
create policy "team can create operational warnings" on public.hub_operational_warnings
for insert to authenticated with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can update operational warnings" on public.hub_operational_warnings;
create policy "team can update operational warnings" on public.hub_operational_warnings
for update to authenticated using(public.vlacora_can_access_station(station_slug))
with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "managers can delete operational warnings" on public.hub_operational_warnings;
create policy "managers can delete operational warnings" on public.hub_operational_warnings
for delete to authenticated using(public.vlacora_current_role() in ('superadmin','stationmanager'));

do $$
declare t text;
begin
  foreach t in array array[
    'hub_program_profiles','hub_program_team','hub_absences','hub_absence_coverages',
    'hub_contacts','hub_content_inbox','hub_operational_warnings'
  ] loop
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
