-- VLACORA HUB - initial multi-station schema
-- This file is not applied automatically in the demo.

create extension if not exists "pgcrypto";

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table stations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  short_name text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  first_name text,
  last_name text,
  avatar_url text,
  is_superadmin boolean not null default false,
  created_at timestamptz not null default now()
);

create table station_members (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null,
  is_active boolean not null default true,
  unique (station_id, user_id)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  station_id uuid references stations(id),
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'normal',
  assigned_to uuid references profiles(id),
  created_by uuid references profiles(id),
  due_at timestamptz,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references stations(id),
  category text not null,
  title text not null,
  description text not null,
  severity text not null default 'normal',
  status text not null default 'open',
  reported_by uuid references profiles(id),
  assigned_to uuid references profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table chat_channels (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references stations(id),
  name text,
  channel_type text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table chat_members (
  channel_id uuid not null references chat_channels(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references chat_channels(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  content text,
  reply_to uuid references chat_messages(id),
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references stations(id),
  title text not null,
  body text not null,
  category text,
  importance text not null default 'normal',
  requires_acknowledgement boolean not null default false,
  published_by uuid references profiles(id),
  published_at timestamptz not null default now(),
  expires_at timestamptz
);

create table announcement_reads (
  announcement_id uuid references announcements(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references stations(id),
  event_type text not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  created_by uuid references profiles(id),
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);

create table music_tracks (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references stations(id),
  artist text not null,
  title text not null,
  release_date date,
  label text,
  genre text,
  bpm numeric,
  artwork_url text,
  preview_url text,
  status text not null default 'inbox',
  created_at timestamptz not null default now()
);

create table music_votes (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references music_tracks(id) on delete cascade,
  user_id uuid not null references profiles(id),
  score numeric,
  radio_fit numeric,
  energy numeric,
  comment text,
  created_at timestamptz not null default now(),
  unique(track_id, user_id)
);

create table music_meetings (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id),
  title text not null,
  starts_at timestamptz not null,
  status text not null default 'planned',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table music_meeting_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references music_meetings(id) on delete cascade,
  track_id uuid not null references music_tracks(id),
  position integer,
  decision text,
  target_category text,
  start_date date
);

create table charts (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id),
  name text not null,
  size integer not null,
  is_active boolean not null default true
);

create table chart_editions (
  id uuid primary key default gen_random_uuid(),
  chart_id uuid not null references charts(id),
  edition_date date not null,
  status text not null default 'draft',
  published_at timestamptz
);

create table chart_entries (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references chart_editions(id) on delete cascade,
  track_id uuid references music_tracks(id),
  position integer not null,
  previous_position integer,
  peak_position integer,
  weeks_on_chart integer not null default 1,
  movement integer,
  is_new boolean not null default false,
  is_reentry boolean not null default false,
  unique(edition_id, position)
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  station_id uuid references stations(id),
  user_id uuid references profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
