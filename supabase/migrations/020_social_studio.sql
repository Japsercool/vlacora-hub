-- VLACORA HUB 0.16.0 — Social Studio
-- Production migration is already applied to the connected Supabase project.

create table if not exists public.hub_brand_kits(
  station_slug text primary key,
  brand_name text not null default '',
  logo_url text not null default '',
  primary_color text not null default '#27269f',
  secondary_color text not null default '#4d38ff',
  accent_color text not null default '#ef4a5d',
  background_color text not null default '#101124',
  text_color text not null default '#ffffff',
  font_family text not null default 'Inter',
  default_cta text not null default 'Luister nu live',
  default_hashtags text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.hub_brand_kits enable row level security;

create table if not exists public.hub_social_templates(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  name text not null,
  content_type text not null default 'custom',
  aspect_ratio text not null default '4:5',
  caption_template text not null default '',
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hub_social_templates enable row level security;

create table if not exists public.hub_social_posts(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  template_id uuid references public.hub_social_templates(id) on delete set null,
  title text not null default '',
  status text not null default 'concept' check(status in ('concept','review','approved','published','archived')),
  format text not null default '4:5',
  payload jsonb not null default '{}'::jsonb,
  caption text not null default '',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hub_social_posts enable row level security;

create table if not exists public.hub_social_assets(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  name text not null,
  kind text not null default 'image',
  storage_path text not null,
  public_url text not null default '',
  tags text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.hub_social_assets enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vlacora-social-assets','vlacora-social-assets',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];

-- RLS policies are included in the applied production migration.
