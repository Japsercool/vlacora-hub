-- PULSE hitlijsthistoriek op de eigen PostgreSQL-backend.
create or replace function public.pulse_chart_song_key(p_artist text, p_title text)
returns text language sql immutable set search_path=public,pg_catalog as $$
  select trim(both '-' from regexp_replace(
    lower(trim(coalesce(p_artist,'')) || '|' || trim(coalesce(p_title,''))),
    '[^a-z0-9|]+', '-', 'g'
  ));
$$;

create or replace function public.pulse_chart_canonical_series_key(p_name text, p_series_key text)
returns text language sql immutable set search_path=public,pg_catalog as $$
  select case
    when coalesce(p_series_key,'') ~* '-week-[0-9]+$'
      then regexp_replace(coalesce(p_series_key,''), '-week-[0-9]+$', '', 'i')
    when trim(coalesce(p_series_key,'')) <> '' then trim(p_series_key)
    else trim(both '-' from regexp_replace(
      lower(regexp_replace(coalesce(p_name,''), '\s+week\s+[0-9]+.*$', '', 'i')),
      '[^a-z0-9]+', '-', 'g'
    ))
  end;
$$;

create or replace function public.pulse_recompute_chart_series(p_station text, p_series text)
returns integer language plpgsql set search_path=public,pg_catalog as $$
declare
  ed record; item record; new_entries jsonb; history jsonb := '{}'::jsonb;
  previous_positions jsonb := '{}'::jsonb; current_positions jsonb; song_key text;
  previous_position integer; old_weeks integer; old_peak integer; current_position integer;
  new_weeks integer; new_peak integer; trend text; delta integer; previous_edition text := null; changed integer := 0;
begin
  if p_station is null or trim(p_station)='' or p_series is null or trim(p_series)='' then return 0; end if;
  for ed in
    select id,entries from public.hitlists
    where station_slug=p_station and series_key=p_series
    order by coalesce(edition_year,extract(year from coalesce(valid_from,publish_date,created_at::date))::integer,9999),
             coalesce(edition_week,extract(week from coalesce(valid_from,publish_date,created_at::date))::integer,99),
             coalesce(valid_from,publish_date,created_at::date),created_at,id
  loop
    new_entries:='[]'::jsonb; current_positions:='{}'::jsonb;
    for item in select value,ordinality::integer pos from jsonb_array_elements(coalesce(ed.entries,'[]'::jsonb)) with ordinality order by ordinality loop
      current_position:=item.pos;
      song_key:=public.pulse_chart_song_key(item.value->>'artist',item.value->>'title');
      if song_key='' then song_key:='position-'||current_position::text; end if;
      previous_position:=case when previous_positions ? song_key then (previous_positions->>song_key)::integer else null end;
      old_weeks:=coalesce((history->song_key->>'weeks')::integer,0);
      old_peak:=case when history ? song_key and (history->song_key ? 'peak') then (history->song_key->>'peak')::integer else null end;
      new_weeks:=old_weeks+1; new_peak:=least(current_position,coalesce(old_peak,current_position));
      delta:=case when previous_position is null then null else previous_position-current_position end;
      trend:=case when previous_position is null then 'new' when previous_position>current_position then 'up' when previous_position<current_position then 'down' else 'same' end;
      new_entries:=new_entries||jsonb_build_array(item.value||jsonb_build_object('songKey',song_key,'previousPosition',previous_position,'weeks',new_weeks,'peak',new_peak,'trend',trend,'delta',delta));
      current_positions:=jsonb_set(current_positions,array[song_key],to_jsonb(current_position),true);
      history:=jsonb_set(history,array[song_key],jsonb_build_object('weeks',new_weeks,'peak',new_peak),true);
    end loop;
    update public.hitlists set entries=new_entries,previous_edition_id=previous_edition,updated_at=now()
      where id=ed.id and (entries is distinct from new_entries or previous_edition_id is distinct from previous_edition);
    if found then changed:=changed+1; end if;
    previous_positions:=current_positions; previous_edition:=ed.id;
  end loop;
  return changed;
end;
$$;

create or replace function public.pulse_hitlist_prepare_series()
returns trigger language plpgsql set search_path=public,pg_catalog as $$
begin new.series_key:=public.pulse_chart_canonical_series_key(new.name,new.series_key); return new; end;
$$;

create or replace function public.pulse_hitlist_recompute_after_change()
returns trigger language plpgsql set search_path=public,pg_catalog as $$
begin
  if pg_trigger_depth()>1 then return new; end if;
  perform public.pulse_recompute_chart_series(new.station_slug,new.series_key);
  if tg_op='UPDATE' and (old.station_slug,old.series_key) is distinct from (new.station_slug,new.series_key) then
    perform public.pulse_recompute_chart_series(old.station_slug,old.series_key);
  end if;
  return new;
end;
$$;

drop trigger if exists pulse_hitlist_prepare_series_trg on public.hitlists;
create trigger pulse_hitlist_prepare_series_trg before insert or update of name,series_key on public.hitlists for each row execute function public.pulse_hitlist_prepare_series();
drop trigger if exists pulse_hitlist_recompute_after_change_trg on public.hitlists;
create trigger pulse_hitlist_recompute_after_change_trg after insert or update of entries,edition_year,edition_week,series_key,station_slug,valid_from,publish_date on public.hitlists for each row execute function public.pulse_hitlist_recompute_after_change();
