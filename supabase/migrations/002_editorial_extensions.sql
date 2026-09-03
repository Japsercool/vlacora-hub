-- VLACORA HUB 0.3 - editorial collaboration extension
-- Proposed Supabase schema for the next real backend phase.

create table song_presentation_texts (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  track_id uuid references music_tracks(id) on delete cascade,
  artist text not null,
  title text not null,
  presentation_text text not null default '',
  internal_notes text,
  tags text[] not null default '{}',
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (station_id, track_id)
);

create table program_text_templates (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  program_name text not null,
  presenter_label text,
  intro_template text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table program_text_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references program_text_templates(id) on delete cascade,
  position integer not null default 0,
  item_name text not null,
  item_type text not null,
  instruction text,
  sample_template text,
  config jsonb not null default '{}'::jsonb
);

create table social_templates (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  name text not null,
  visual_label text,
  layout_type text not null default 'custom',
  background_style text not null default 'purple',
  caption_template text,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table social_drafts (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  template_id uuid references social_templates(id),
  artist text,
  title text,
  caption text,
  status text not null default 'draft',
  scheduled_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table music_folders (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table music_folder_tracks (
  folder_id uuid not null references music_folders(id) on delete cascade,
  track_id uuid references music_tracks(id) on delete cascade,
  artist text not null,
  title text not null,
  category_label text,
  position integer,
  primary key (folder_id, artist, title)
);

create table internal_documents (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references stations(id) on delete cascade,
  document_type text not null,
  title text not null,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  published_by uuid references profiles(id),
  published_at timestamptz not null default now()
);

create index idx_song_presentation_station on song_presentation_texts(station_id);
create index idx_program_template_station on program_text_templates(station_id);
create index idx_social_templates_station on social_templates(station_id);
create index idx_music_folders_station on music_folders(station_id);
