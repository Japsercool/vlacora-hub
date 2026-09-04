-- PULSE 0.32.0
-- Inventariseer de bestaande PULSE Storage-objecten voor migratie naar de eigen server.
create or replace function public.pulse_export_storage_objects()
returns jsonb
language plpgsql
stable
security definer
set search_path='public','storage','pg_catalog'
as $$
declare payload jsonb;
begin
  perform public.pulse_assert_superadmin();
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket', o.bucket_id,
        'name', o.name,
        'public', b.public
      ) order by o.bucket_id,o.name
    ),
    '[]'::jsonb
  )
  into payload
  from storage.objects o
  join storage.buckets b on b.id=o.bucket_id
  where o.bucket_id in (
    'vlacora-hub-files',
    'vlacora-profile-photos',
    'vlacora-program-assets',
    'vlacora-social-assets'
  );
  return payload;
end;
$$;
revoke all on function public.pulse_export_storage_objects() from public,anon;
grant execute on function public.pulse_export_storage_objects() to authenticated;
