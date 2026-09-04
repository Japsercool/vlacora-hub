create or replace function public.pulse_export_runtime_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path='public','pg_catalog'
as $$
declare payload jsonb;
begin
  perform public.pulse_assert_superadmin();
  select jsonb_build_object(
    'functions', coalesce((select jsonb_agg(jsonb_build_object(
      'name',p.proname,
      'identity_args',pg_get_function_identity_arguments(p.oid),
      'definition',pg_get_functiondef(p.oid)
    ) order by p.proname,pg_get_function_identity_arguments(p.oid))
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and (p.proname like 'vlacora_%' or p.proname like 'pulse_hitlist_%' or p.proname like 'pulse_recompute_%' or p.proname like 'pulse_chart_%' or p.proname='pulse_seed_announcement_recipients')
    ),'[]'::jsonb),
    'triggers', coalesce((select jsonb_agg(jsonb_build_object(
      'table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true)
    ) order by c.relname,t.tgname)
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and not t.tgisinternal
    ),'[]'::jsonb),
    'policies', coalesce((select jsonb_agg(jsonb_build_object(
      'table',p.tablename,'name',p.policyname,'permissive',p.permissive,'roles',p.roles,'cmd',p.cmd,'qual',p.qual,'with_check',p.with_check
    ) order by p.tablename,p.policyname)
      from pg_policies p where p.schemaname='public'
    ),'[]'::jsonb),
    'rls', coalesce((select jsonb_agg(jsonb_build_object(
      'table',c.relname,'enabled',c.relrowsecurity,'forced',c.relforcerowsecurity
    ) order by c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'
    ),'[]'::jsonb)
  ) into payload;
  return payload;
end;
$$;
revoke all on function public.pulse_export_runtime_catalog() from public,anon;
grant execute on function public.pulse_export_runtime_catalog() to authenticated;
