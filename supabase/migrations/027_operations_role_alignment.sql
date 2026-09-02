
-- VLACORA HUB 0.20.0 — role alignment for Operations Suite.

drop policy if exists "team can read contacts" on public.hub_contacts;
create policy "team can read contacts" on public.hub_contacts
for select to authenticated using(
  (station_slug='all' or public.vlacora_can_access_station(station_slug))
  and (visibility='team' or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))
);

drop policy if exists "managers can create contacts" on public.hub_contacts;
create policy "managers can create contacts" on public.hub_contacts
for insert to authenticated with check(
  public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer')
  and (station_slug='all' or public.vlacora_can_access_station(station_slug))
);

drop policy if exists "managers can update contacts" on public.hub_contacts;
create policy "managers can update contacts" on public.hub_contacts
for update to authenticated
using(public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))
with check(station_slug='all' or public.vlacora_can_access_station(station_slug));

drop policy if exists "managers can delete contacts" on public.hub_contacts;
create policy "managers can delete contacts" on public.hub_contacts
for delete to authenticated
using(public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'));

drop policy if exists "submitter or editorial can update content" on public.hub_content_inbox;
create policy "submitter or editorial can update content" on public.hub_content_inbox
for update to authenticated
using(
  submitted_by=auth.uid()
  or public.vlacora_current_role() in (
    'superadmin','stationmanager','admin','beheer',
    'redactie','muziekredactie','social','social & marketing'
  )
)
with check(public.vlacora_can_access_station(station_slug));
