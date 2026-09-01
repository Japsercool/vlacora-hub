-- VLACORA HUB 0.14.0 — harden team writes.
drop policy if exists "users can update own profile" on public.profiles;

create or replace function public.vlacora_update_own_profile(p_display_name text,p_phone text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd.' using errcode='42501'; end if;
  update public.profiles set display_name=coalesce(nullif(trim(p_display_name),''),display_name),phone=coalesce(p_phone,''),updated_at=now() where id=auth.uid();
end;$$;
revoke all on function public.vlacora_update_own_profile(text,text) from public;
grant execute on function public.vlacora_update_own_profile(text,text) to authenticated;

create or replace function public.vlacora_can_manage_station(target_station text)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when auth.uid() is null then false
    when public.vlacora_current_role()='superadmin' then true
    when public.vlacora_current_role()='stationmanager' then exists(select 1 from public.station_memberships sm where sm.user_id=auth.uid() and sm.station_slug=target_station and sm.active)
    else false
  end;
$$;
revoke all on function public.vlacora_can_manage_station(text) from public;
grant execute on function public.vlacora_can_manage_station(text) to authenticated;

drop policy if exists "managers can insert station memberships" on public.station_memberships;
create policy "managers can insert station memberships" on public.station_memberships for insert to authenticated with check(public.vlacora_can_manage_station(station_slug));
drop policy if exists "managers can update station memberships" on public.station_memberships;
create policy "managers can update station memberships" on public.station_memberships for update to authenticated using(public.vlacora_can_manage_station(station_slug)) with check(public.vlacora_can_manage_station(station_slug));
drop policy if exists "managers can delete station memberships" on public.station_memberships;
create policy "managers can delete station memberships" on public.station_memberships for delete to authenticated using(public.vlacora_can_manage_station(station_slug));
