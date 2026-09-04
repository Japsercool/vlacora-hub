-- VLACORA HUB 0.24.4
-- Geef nieuw aangemaakte stations automatisch de standaard Meldpunt-categorieën.
create or replace function public.vlacora_seed_incident_categories_for_station()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.hub_incident_category_settings(station_slug,category,default_severity,sort_order)
  values
    (new.slug,'Programmering','Normaal',10),(new.slug,'Muziek','Laag',20),(new.slug,'Technisch','Hoog',30),(new.slug,'Vormgeving','Normaal',40),
    (new.slug,'Facilities','Normaal',50),(new.slug,'Afwezigheid','Normaal',60),(new.slug,'Website / socials','Normaal',70),(new.slug,'Nieuws','Normaal',80),
    (new.slug,'Reclame','Hoog',90),(new.slug,'Tip redactie','Laag',100),(new.slug,'Ander','Normaal',110)
  on conflict(station_slug,category) do nothing;
  return new;
end;
$$;
revoke all on function public.vlacora_seed_incident_categories_for_station() from public,anon,authenticated;

drop trigger if exists hub_stations_seed_incident_categories on public.hub_stations;
create trigger hub_stations_seed_incident_categories
after insert on public.hub_stations
for each row execute function public.vlacora_seed_incident_categories_for_station();
