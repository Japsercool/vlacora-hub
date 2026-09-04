-- PULSE 0.29.0
-- Veilige exportbrug voor de eenmalige migratie naar een eigen PostgreSQL-backend.
-- De functies zijn alleen bruikbaar door een ingelogde PULSE-superadmin.

create or replace function public.pulse_assert_superadmin()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null or public.vlacora_current_role() <> 'superadmin' then
    raise exception 'Alleen een PULSE-superadmin mag de datamigratie uitvoeren';
  end if;
  return true;
end;
$$;

create or replace function public.pulse_export_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  payload jsonb;
begin
  perform public.pulse_assert_superadmin();

  select jsonb_build_object(
    'generated_at', now(),
    'schema', 'public',
    'tables', coalesce(jsonb_agg(
      jsonb_build_object(
        'name', q.table_name,
        'columns', q.columns,
        'constraints', q.constraints,
        'indexes', q.indexes
      ) order by q.table_name
    ), '[]'::jsonb)
  )
  into payload
  from (
    select
      c.relname as table_name,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', a.attname,
            'type_sql', pg_catalog.format_type(a.atttypid, a.atttypmod),
            'not_null', a.attnotnull,
            'default_sql', pg_catalog.pg_get_expr(ad.adbin, ad.adrelid),
            'identity', a.attidentity,
            'generated', a.attgenerated
          ) order by a.attnum
        )
        from pg_catalog.pg_attribute a
        left join pg_catalog.pg_attrdef ad
          on ad.adrelid = a.attrelid and ad.adnum = a.attnum
        where a.attrelid = c.oid
          and a.attnum > 0
          and not a.attisdropped
      ), '[]'::jsonb) as columns,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', con.conname,
            'type', con.contype,
            'definition', pg_catalog.pg_get_constraintdef(con.oid, true)
          ) order by con.conname
        )
        from pg_catalog.pg_constraint con
        where con.conrelid = c.oid
          and con.contype in ('p','u','f','c')
      ), '[]'::jsonb) as constraints,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', ic.relname,
            'definition', pg_catalog.pg_get_indexdef(ix.indexrelid)
          ) order by ic.relname
        )
        from pg_catalog.pg_index ix
        join pg_catalog.pg_class ic on ic.oid = ix.indexrelid
        where ix.indrelid = c.oid
          and not exists (
            select 1 from pg_catalog.pg_constraint con
            where con.conindid = ix.indexrelid
          )
      ), '[]'::jsonb) as indexes
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  ) q;

  return payload;
end;
$$;

create or replace function public.pulse_export_table_count(p_table text)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  result bigint;
begin
  perform public.pulse_assert_superadmin();
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name = p_table
  ) then
    raise exception 'Onbekende PULSE-tabel: %', p_table;
  end if;

  execute format('select count(*) from public.%I', p_table) into result;
  return result;
end;
$$;

create or replace function public.pulse_export_table(
  p_table text,
  p_offset integer default 0,
  p_limit integer default 500
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  result jsonb;
  safe_limit integer;
  safe_offset integer;
begin
  perform public.pulse_assert_superadmin();
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name = p_table
  ) then
    raise exception 'Onbekende PULSE-tabel: %', p_table;
  end if;

  safe_limit := greatest(1, least(coalesce(p_limit, 500), 1000));
  safe_offset := greatest(0, coalesce(p_offset, 0));

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(src)), ''[]''::jsonb) from (select * from public.%I offset %s limit %s) src',
    p_table,
    safe_offset,
    safe_limit
  ) into result;

  return jsonb_build_object(
    'table', p_table,
    'offset', safe_offset,
    'limit', safe_limit,
    'rows', coalesce(result, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.pulse_assert_superadmin() from public, anon;
revoke all on function public.pulse_export_catalog() from public, anon;
revoke all on function public.pulse_export_table_count(text) from public, anon;
revoke all on function public.pulse_export_table(text, integer, integer) from public, anon;

grant execute on function public.pulse_assert_superadmin() to authenticated;
grant execute on function public.pulse_export_catalog() to authenticated;
grant execute on function public.pulse_export_table_count(text) to authenticated;
grant execute on function public.pulse_export_table(text, integer, integer) to authenticated;
