-- VLACORA HUB 0.23.0 — music/format proposals + reusable attachments.

create table if not exists public.hub_music_proposals(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null,
  proposal_type text not null check(proposal_type in ('new_song','format_change','playlist_suggestion')),
  title text not null,
  artist text not null default '',
  song_title text not null default '',
  target_folder text not null default '',
  target_program_id text references public.station_programs(id) on delete set null,
  spotify_url text not null default '',
  youtube_url text not null default '',
  current_value text not null default '',
  proposed_value text not null default '',
  explanation text not null default '',
  status text not null default 'submitted' check(status in ('submitted','reviewing','approved','rejected','implemented')),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  handled_by uuid references auth.users(id) on delete set null,
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hub_music_proposals_station_status_idx on public.hub_music_proposals(station_slug,status,created_at desc);
create index if not exists hub_music_proposals_submitter_idx on public.hub_music_proposals(submitted_by,created_at desc);
alter table public.hub_music_proposals enable row level security;

drop policy if exists "station team can read music proposals" on public.hub_music_proposals;
create policy "station team can read music proposals" on public.hub_music_proposals for select to authenticated
using(public.vlacora_can_access_station(station_slug) or submitted_by=auth.uid());

drop policy if exists "station team can submit music proposals" on public.hub_music_proposals;
create policy "station team can submit music proposals" on public.hub_music_proposals for insert to authenticated
with check(submitted_by=auth.uid() and public.vlacora_can_access_station(station_slug));

drop policy if exists "proposal owners and editors can update music proposals" on public.hub_music_proposals;
create policy "proposal owners and editors can update music proposals" on public.hub_music_proposals for update to authenticated
using(
  (submitted_by=auth.uid() and status in ('submitted','reviewing'))
  or (public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer','muziekredactie','redactie') and public.vlacora_can_access_station(station_slug))
)
with check(public.vlacora_can_access_station(station_slug));

drop policy if exists "proposal owners and managers can delete music proposals" on public.hub_music_proposals;
create policy "proposal owners and managers can delete music proposals" on public.hub_music_proposals for delete to authenticated
using(
  (submitted_by=auth.uid() and status='submitted')
  or (public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer') and public.vlacora_can_access_station(station_slug))
);

-- One reusable attachment registry for all writable HUB entities.
create table if not exists public.hub_attachments(
  id uuid primary key default gen_random_uuid(),
  station_slug text not null default 'all',
  entity_type text not null,
  entity_id text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check(size_bytes>=0),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists hub_attachments_entity_idx on public.hub_attachments(entity_type,entity_id,created_at);
create index if not exists hub_attachments_station_idx on public.hub_attachments(station_slug,created_at desc);
alter table public.hub_attachments enable row level security;

create or replace function public.vlacora_can_read_attachment(a public.hub_attachments)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when a.uploaded_by=auth.uid() then true
    when a.entity_type='chat_message' then exists(
      select 1
      from public.hub_chat_messages m
      join public.hub_chat_channels c on c.id=m.channel_id
      where m.id::text=a.entity_id and (
        m.sender_id=auth.uid()
        or (c.channel_type='station' and public.vlacora_can_access_station(c.station_slug))
        or exists(select 1 from public.hub_chat_members cm where cm.channel_id=c.id and cm.user_id=auth.uid())
      )
    )
    when a.station_slug='all' then true
    else public.vlacora_can_access_station(a.station_slug)
  end;
$$;
revoke all on function public.vlacora_can_read_attachment(public.hub_attachments) from public;
grant execute on function public.vlacora_can_read_attachment(public.hub_attachments) to authenticated;

drop policy if exists "team can read allowed hub attachments" on public.hub_attachments;
create policy "team can read allowed hub attachments" on public.hub_attachments for select to authenticated
using(public.vlacora_can_read_attachment(hub_attachments));

drop policy if exists "team can register hub attachments" on public.hub_attachments;
create policy "team can register hub attachments" on public.hub_attachments for insert to authenticated
with check(uploaded_by=auth.uid() and (station_slug='all' or public.vlacora_can_access_station(station_slug)));

drop policy if exists "owners and managers can delete hub attachments" on public.hub_attachments;
create policy "owners and managers can delete hub attachments" on public.hub_attachments for delete to authenticated
using(
  uploaded_by=auth.uid()
  or (public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer') and (station_slug='all' or public.vlacora_can_access_station(station_slug)))
);

insert into storage.buckets(id,name,public,file_size_limit)
values('vlacora-hub-files','vlacora-hub-files',false,26214400)
on conflict(id) do update set public=false,file_size_limit=26214400;

drop policy if exists "hub users can upload own attachment paths" on storage.objects;
create policy "hub users can upload own attachment paths" on storage.objects for insert to authenticated
with check(bucket_id='vlacora-hub-files' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "hub users can read registered attachments" on storage.objects;
create policy "hub users can read registered attachments" on storage.objects for select to authenticated
using(bucket_id='vlacora-hub-files' and exists(select 1 from public.hub_attachments a where a.storage_path=name and public.vlacora_can_read_attachment(a)));

drop policy if exists "hub users can delete own attachment files" on storage.objects;
create policy "hub users can delete own attachment files" on storage.objects for delete to authenticated
using(bucket_id='vlacora-hub-files' and (
  (storage.foldername(name))[1]=auth.uid()::text
  or exists(select 1 from public.hub_attachments a where a.storage_path=name and public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer') and (a.station_slug='all' or public.vlacora_can_access_station(a.station_slug)))
));

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_music_proposals') then
    alter publication supabase_realtime add table public.hub_music_proposals;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_attachments') then
    alter publication supabase_realtime add table public.hub_attachments;
  end if;
end $$;
