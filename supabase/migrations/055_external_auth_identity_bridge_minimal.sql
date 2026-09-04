-- Defence in depth: de externe database krijgt alleen dezelfde UUID's als identity mirror.
-- E-mail staat al in public.profiles; auth-wachtwoorden/sessies worden nooit gekopieerd.
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
