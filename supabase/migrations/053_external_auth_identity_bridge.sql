-- PULSE 0.29: export uitsluitend identiteit-UUID voor de lokale auth-mirror.
-- Wachtwoorden, password hashes en sessies worden nooit geëxporteerd.
create or replace function public.pulse_export_auth_identities()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
declare result jsonb;
begin
  perform public.pulse_assert_superadmin();
  select coalesce(jsonb_agg(jsonb_build_object('id',u.id) order by u.id),'[]'::jsonb)
    into result
    from auth.users u;
  return result;
end;
$$;

revoke all on function public.pulse_export_auth_identities() from public, anon;
grant execute on function public.pulse_export_auth_identities() to authenticated;
