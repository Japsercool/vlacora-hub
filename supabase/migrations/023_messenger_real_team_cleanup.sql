-- VLACORA HUB 0.18.2 — real Messenger
-- Applied to production already.
create table if not exists public.hub_chat_channels(
  id uuid primary key default gen_random_uuid(), station_slug text not null default 'all', name text not null default '',
  channel_type text not null default 'group' check(channel_type in ('direct','group','station')),
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.hub_chat_members(
  channel_id uuid not null references public.hub_chat_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(), last_read_at timestamptz, primary key(channel_id,user_id)
);
create table if not exists public.hub_chat_messages(
  id uuid primary key default gen_random_uuid(), channel_id uuid not null references public.hub_chat_channels(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null, content text not null,
  reply_to uuid references public.hub_chat_messages(id) on delete set null, created_at timestamptz not null default now(), edited_at timestamptz
);
alter table public.hub_chat_channels enable row level security;
alter table public.hub_chat_members enable row level security;
alter table public.hub_chat_messages enable row level security;

create or replace function public.vlacora_can_read_chat_channel(target_channel uuid)
returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from public.hub_chat_channels c where c.id=target_channel and (
  (c.channel_type='station' and public.vlacora_can_access_station(c.station_slug)) or c.created_by=auth.uid()
  or exists(select 1 from public.hub_chat_members m where m.channel_id=c.id and m.user_id=auth.uid())
)); $$;
revoke all on function public.vlacora_can_read_chat_channel(uuid) from public;
grant execute on function public.vlacora_can_read_chat_channel(uuid) to authenticated;

create or replace function public.vlacora_can_manage_chat_channel(target_channel uuid)
returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from public.hub_chat_channels c where c.id=target_channel
  and public.vlacora_can_access_station(c.station_slug)
  and (c.created_by=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager')));
$$;
revoke all on function public.vlacora_can_manage_chat_channel(uuid) from public;
grant execute on function public.vlacora_can_manage_chat_channel(uuid) to authenticated;

drop policy if exists "chat channels readable by members" on public.hub_chat_channels;
create policy "chat channels readable by members" on public.hub_chat_channels for select to authenticated using(
  (channel_type='station' and public.vlacora_can_access_station(station_slug)) or created_by=auth.uid()
  or exists(select 1 from public.hub_chat_members m where m.channel_id=id and m.user_id=auth.uid())
);
drop policy if exists "team can create chat channels" on public.hub_chat_channels;
create policy "team can create chat channels" on public.hub_chat_channels for insert to authenticated with check(created_by=auth.uid() and public.vlacora_can_access_station(station_slug));
drop policy if exists "channel managers can update chat channels" on public.hub_chat_channels;
create policy "channel managers can update chat channels" on public.hub_chat_channels for update to authenticated using(public.vlacora_can_manage_chat_channel(id)) with check(public.vlacora_can_access_station(station_slug));
drop policy if exists "channel managers can delete chat channels" on public.hub_chat_channels;
create policy "channel managers can delete chat channels" on public.hub_chat_channels for delete to authenticated using(public.vlacora_can_manage_chat_channel(id));
drop policy if exists "chat members readable in visible channels" on public.hub_chat_members;
create policy "chat members readable in visible channels" on public.hub_chat_members for select to authenticated using(public.vlacora_can_read_chat_channel(channel_id));
drop policy if exists "team can add chat members" on public.hub_chat_members;
create policy "team can add chat members" on public.hub_chat_members for insert to authenticated with check(public.vlacora_can_read_chat_channel(channel_id));
drop policy if exists "team can remove chat members" on public.hub_chat_members;
create policy "team can remove chat members" on public.hub_chat_members for delete to authenticated using(public.vlacora_can_read_chat_channel(channel_id));
drop policy if exists "members can update their chat read marker" on public.hub_chat_members;
create policy "members can update their chat read marker" on public.hub_chat_members for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "chat messages readable in visible channels" on public.hub_chat_messages;
create policy "chat messages readable in visible channels" on public.hub_chat_messages for select to authenticated using(public.vlacora_can_read_chat_channel(channel_id));
drop policy if exists "members can send chat messages" on public.hub_chat_messages;
create policy "members can send chat messages" on public.hub_chat_messages for insert to authenticated with check(sender_id=auth.uid() and public.vlacora_can_read_chat_channel(channel_id));
drop policy if exists "senders can edit own chat messages" on public.hub_chat_messages;
create policy "senders can edit own chat messages" on public.hub_chat_messages for update to authenticated using(sender_id=auth.uid()) with check(sender_id=auth.uid());
drop policy if exists "senders can delete own chat messages" on public.hub_chat_messages;
create policy "senders can delete own chat messages" on public.hub_chat_messages for delete to authenticated using(sender_id=auth.uid() or public.vlacora_current_role() in ('superadmin','stationmanager'));

create or replace function public.vlacora_cleanup_orphan_direct_chat()
returns trigger language plpgsql security definer set search_path=public as $$
declare channel_kind text; member_count integer;
begin
  select channel_type into channel_kind from public.hub_chat_channels where id=old.channel_id;
  if channel_kind is null then return old; end if;
  select count(*) into member_count from public.hub_chat_members where channel_id=old.channel_id;
  if (channel_kind='direct' and member_count<2) or member_count=0 then delete from public.hub_chat_channels where id=old.channel_id; end if;
  return old;
end; $$;
revoke all on function public.vlacora_cleanup_orphan_direct_chat() from public,anon,authenticated;
drop trigger if exists trg_cleanup_orphan_direct_chat on public.hub_chat_members;
create trigger trg_cleanup_orphan_direct_chat after delete on public.hub_chat_members for each row execute function public.vlacora_cleanup_orphan_direct_chat();

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_chat_channels') then alter publication supabase_realtime add table public.hub_chat_channels; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_chat_members') then alter publication supabase_realtime add table public.hub_chat_members; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hub_chat_messages') then alter publication supabase_realtime add table public.hub_chat_messages; end if;
end $$;
