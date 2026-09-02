-- VLACORA HUB 0.17.0 — Social Studio Phase 2
-- Review workflow, copy blocks and calendar workflow.
-- This migration has already been applied to the connected production project.

alter table public.hub_social_posts add column if not exists review_requested_at timestamptz;
alter table public.hub_social_posts add column if not exists approved_at timestamptz;
alter table public.hub_social_posts add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.hub_social_posts add column if not exists changes_requested_at timestamptz;

create table if not exists public.hub_social_copy_blocks(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  name text not null,
  category text not null default 'Algemeen',
  content text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hub_social_copy_blocks_station_idx on public.hub_social_copy_blocks(station_slug,category,name);
alter table public.hub_social_copy_blocks enable row level security;

drop policy if exists "team can read social copy blocks" on public.hub_social_copy_blocks;
create policy "team can read social copy blocks" on public.hub_social_copy_blocks
for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can insert social copy blocks" on public.hub_social_copy_blocks;
create policy "team can insert social copy blocks" on public.hub_social_copy_blocks
for insert to authenticated with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can update social copy blocks" on public.hub_social_copy_blocks;
create policy "team can update social copy blocks" on public.hub_social_copy_blocks
for update to authenticated using(public.vlacora_can_access_station(station_slug))
with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "editors can delete social copy blocks" on public.hub_social_copy_blocks;
create policy "editors can delete social copy blocks" on public.hub_social_copy_blocks
for delete to authenticated using(
  public.vlacora_can_access_station(station_slug)
  and public.vlacora_current_role() in ('superadmin','stationmanager','redactie','muziekredactie')
);

create table if not exists public.hub_social_review_events(
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.hub_social_posts(id) on delete cascade,
  station_slug text not null,
  event_type text not null check(event_type in ('comment','review_requested','approved','changes_requested','published')),
  comment text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists hub_social_review_events_post_idx on public.hub_social_review_events(post_id,created_at);
alter table public.hub_social_review_events enable row level security;

drop policy if exists "team can read social review events" on public.hub_social_review_events;
create policy "team can read social review events" on public.hub_social_review_events
for select to authenticated using(public.vlacora_can_access_station(station_slug));
drop policy if exists "team can add social review events" on public.hub_social_review_events;
create policy "team can add social review events" on public.hub_social_review_events
for insert to authenticated with check(public.vlacora_can_access_station(station_slug));

revoke update,delete on public.hub_social_review_events from authenticated;

do $$ begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='hub_social_posts'
  ) then alter publication supabase_realtime add table public.hub_social_posts; end if;
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='hub_social_review_events'
  ) then alter publication supabase_realtime add table public.hub_social_review_events; end if;
end $$;
