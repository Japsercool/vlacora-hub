-- VLACORA HUB 0.20.0 — program team security hardening.
drop policy if exists "team can insert program team" on public.hub_program_team;
create policy "managers can insert program team" on public.hub_program_team
for insert to authenticated with check(
  public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
  and exists(select 1 from public.station_programs p where p.id=program_id and public.vlacora_can_access_station(p.station_slug))
);

drop policy if exists "team can update program team" on public.hub_program_team;
create policy "managers can update program team" on public.hub_program_team
for update to authenticated using(
  public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
  and exists(select 1 from public.station_programs p where p.id=program_id and public.vlacora_can_access_station(p.station_slug))
) with check(
  public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
  and exists(select 1 from public.station_programs p where p.id=program_id and public.vlacora_can_access_station(p.station_slug))
);

drop policy if exists "team can delete program team" on public.hub_program_team;
create policy "managers can delete program team" on public.hub_program_team
for delete to authenticated using(
  public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
  and exists(select 1 from public.station_programs p where p.id=program_id and public.vlacora_can_access_station(p.station_slug))
);
