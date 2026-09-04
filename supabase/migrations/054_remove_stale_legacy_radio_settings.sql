-- Rotation One / Playout One zijn uit PULSE verwijderd. Wis alleen hun oude configuratiestubs.
delete from public.hub_settings
where setting_key = 'radio-integrations'
   or scope like 'station:ro-%';
