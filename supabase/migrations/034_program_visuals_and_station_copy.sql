-- VLACORA HUB 0.23.0 — visual program pages + safer station copy.

alter table public.hub_program_profiles
  add column if not exists cover_url text not null default '';

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'vlacora-program-assets','vlacora-program-assets',true,8388608,
  array['image/png','image/jpeg','image/webp']
)
on conflict(id) do update set
  public=true,
  file_size_limit=8388608,
  allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists "team can read program assets" on storage.objects;
create policy "team can read program assets" on storage.objects for select to authenticated
using(bucket_id='vlacora-program-assets');

drop policy if exists "editors can upload program assets" on storage.objects;
create policy "editors can upload program assets" on storage.objects for insert to authenticated
with check(
  bucket_id='vlacora-program-assets'
  and (storage.foldername(name))[2]=auth.uid()::text
  and public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer','redactie','presentator')
);

drop policy if exists "editors can update program assets" on storage.objects;
create policy "editors can update program assets" on storage.objects for update to authenticated
using(
  bucket_id='vlacora-program-assets'
  and ((storage.foldername(name))[2]=auth.uid()::text or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))
)
with check(bucket_id='vlacora-program-assets');

drop policy if exists "editors can delete program assets" on storage.objects;
create policy "editors can delete program assets" on storage.objects for delete to authenticated
using(
  bucket_id='vlacora-program-assets'
  and ((storage.foldername(name))[2]=auth.uid()::text or public.vlacora_current_role() in ('superadmin','stationmanager','admin','beheer'))
);

-- Existing station copy RPC, extended so program cover photos move with the rest of a program profile.
create or replace function public.vlacora_clone_station_configuration(
  source_station text,
  target_station text,
  p_sections text[] default array['settings','programming','team','templates','social','contacts']::text[]
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  src record;
  new_program_id text;
  copied_programs int:=0;
  copied_templates int:=0;
  copied_social int:=0;
  copied_team int:=0;
  copied_contacts int:=0;
begin
  if public.vlacora_current_role() <> 'superadmin' then
    raise exception 'Alleen superadmin kan zenderconfiguratie kopiëren.' using errcode='42501';
  end if;
  if source_station=target_station then raise exception 'Bron en doel moeten verschillend zijn.' using errcode='22023'; end if;
  if not exists(select 1 from public.hub_stations where slug=source_station) then raise exception 'Bronzender bestaat niet.' using errcode='22023'; end if;
  if not exists(select 1 from public.hub_stations where slug=target_station) then raise exception 'Doelzender bestaat niet.' using errcode='22023'; end if;

  if 'settings'=any(p_sections) then
    insert into public.hub_settings(scope,setting_key,value,updated_by,updated_at)
    select 'station:'||target_station,setting_key,value,auth.uid(),now()
    from public.hub_settings where scope='station:'||source_station
    on conflict(scope,setting_key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end if;

  if 'programming'=any(p_sections) then
    for src in select * from public.station_programs where station_slug=source_station order by day,start_time loop
      new_program_id:=target_station||'-'||replace(gen_random_uuid()::text,'-','');
      insert into public.station_programs(id,station_slug,day,start_time,end_time,name,host,format,notes,active,updated_by,updated_at)
      values(new_program_id,target_station,src.day,src.start_time,src.end_time,src.name,src.host,src.format,src.notes,src.active,auth.uid(),now());
      copied_programs:=copied_programs+1;

      if to_regclass('public.hub_program_profiles') is not null then
        insert into public.hub_program_profiles(
          program_id,station_slug,summary,studio_info,jingle_notes,fixed_items,document_links,
          editorial_template_ids,social_template_ids,cover_url,created_by,updated_by,created_at,updated_at
        )
        select new_program_id,target_station,summary,studio_info,jingle_notes,fixed_items,document_links,
          '[]'::jsonb,'[]'::jsonb,cover_url,auth.uid(),auth.uid(),now(),now()
        from public.hub_program_profiles where program_id=src.id
        on conflict(program_id) do nothing;
      end if;

      if to_regclass('public.hub_program_team') is not null then
        insert into public.hub_program_team(program_id,user_id,role,is_primary,created_at)
        select new_program_id,user_id,role,is_primary,now() from public.hub_program_team where program_id=src.id
        on conflict(program_id,user_id) do nothing;
      end if;
    end loop;
  end if;

  if 'team'=any(p_sections) then
    insert into public.station_memberships(user_id,station_slug,role,permissions,active,updated_at)
    select user_id,target_station,role,permissions,active,now() from public.station_memberships where station_slug=source_station
    on conflict(user_id,station_slug) do update set role=excluded.role,permissions=excluded.permissions,active=excluded.active,updated_at=excluded.updated_at;
    get diagnostics copied_team=row_count;
  end if;

  if 'templates'=any(p_sections) then
    if to_regclass('public.hub_editorial_templates') is not null then
      insert into public.hub_editorial_templates(station_slug,name,program_name,sequence,assignments,notes,active,created_by,updated_by,created_at,updated_at)
      select target_station,name,program_name,sequence,assignments,notes,active,auth.uid(),auth.uid(),now(),now()
      from public.hub_editorial_templates where station_slug=source_station;
      get diagnostics copied_templates=row_count;
    end if;
    if to_regclass('public.hub_templates') is not null then
      insert into public.hub_templates(station_slug,name,category,description,fields,automations,active,created_by,updated_by,created_at,updated_at)
      select target_station,name,category,description,fields,automations,active,auth.uid(),auth.uid(),now(),now()
      from public.hub_templates where station_slug=source_station;
    end if;
  end if;

  if 'social'=any(p_sections) then
    if to_regclass('public.hub_brand_kits') is not null then
      insert into public.hub_brand_kits(station_slug,brand_name,logo_url,primary_color,secondary_color,accent_color,background_color,text_color,font_family,default_cta,default_hashtags,updated_by,updated_at)
      select target_station,brand_name,logo_url,primary_color,secondary_color,accent_color,background_color,text_color,font_family,default_cta,default_hashtags,auth.uid(),now()
      from public.hub_brand_kits where station_slug=source_station
      on conflict(station_slug) do update set brand_name=excluded.brand_name,logo_url=excluded.logo_url,primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,accent_color=excluded.accent_color,background_color=excluded.background_color,text_color=excluded.text_color,font_family=excluded.font_family,default_cta=excluded.default_cta,default_hashtags=excluded.default_hashtags,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
    end if;
    if to_regclass('public.hub_social_templates') is not null then
      insert into public.hub_social_templates(station_slug,name,content_type,aspect_ratio,caption_template,config,active,created_by,updated_by,created_at,updated_at)
      select target_station,name,content_type,aspect_ratio,caption_template,config,active,auth.uid(),auth.uid(),now(),now()
      from public.hub_social_templates where station_slug=source_station;
      get diagnostics copied_social=row_count;
    end if;
    if to_regclass('public.hub_social_copy_blocks') is not null then
      insert into public.hub_social_copy_blocks(station_slug,name,category,content,active,created_by,updated_by,created_at,updated_at)
      select target_station,name,category,content,active,auth.uid(),auth.uid(),now(),now()
      from public.hub_social_copy_blocks where station_slug=source_station;
    end if;
  end if;

  if 'contacts'=any(p_sections) and to_regclass('public.hub_contacts') is not null then
    insert into public.hub_contacts(station_slug,category,name,company,role_title,email,phone,emergency,visibility,notes,created_by,updated_by,created_at,updated_at)
    select target_station,category,name,company,role_title,email,phone,emergency,visibility,notes,auth.uid(),auth.uid(),now(),now()
    from public.hub_contacts where station_slug=source_station;
    get diagnostics copied_contacts=row_count;
  end if;

  return jsonb_build_object('programs',copied_programs,'templates',copied_templates,'socialTemplates',copied_social,'teamMemberships',copied_team,'contacts',copied_contacts);
end;$$;
revoke all on function public.vlacora_clone_station_configuration(text,text,text[]) from public;
revoke all on function public.vlacora_clone_station_configuration(text,text,text[]) from anon;
grant execute on function public.vlacora_clone_station_configuration(text,text,text[]) to authenticated;
