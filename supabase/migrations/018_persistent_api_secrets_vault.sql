-- VLACORA HUB 0.14.7
-- Persistent radio API secrets backed by Supabase Vault.
-- The cleartext key is never stored in hub_settings/localStorage/GitHub.

create table if not exists public.hub_integration_secrets (
  kind text primary key check (kind in ('rotation','playout','shoutcast')),
  vault_secret_id uuid not null unique,
  api_key_header text not null default 'Authorization',
  api_key_prefix text not null default 'Bearer',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.hub_integration_secrets enable row level security;
revoke all on public.hub_integration_secrets from anon, authenticated;
grant all on public.hub_integration_secrets to service_role;

create or replace function public.vlacora_get_integration_secret(p_kind text)
returns table(api_key text, api_key_header text, api_key_prefix text)
language plpgsql security definer
set search_path = public, vault, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and coalesce(p.active,true)) then
    raise exception 'Account is niet actief';
  end if;
  if p_kind not in ('rotation','playout','shoutcast') then raise exception 'Ongeldige integratie'; end if;

  return query
  select d.decrypted_secret,s.api_key_header,s.api_key_prefix
  from public.hub_integration_secrets s
  join vault.decrypted_secrets d on d.id=s.vault_secret_id
  where s.kind=p_kind;
end;
$$;

create or replace function public.vlacora_set_integration_secret(
  p_kind text,p_api_key text,p_api_key_header text default 'Authorization',p_api_key_prefix text default 'Bearer'
)
returns void
language plpgsql security definer
set search_path = public, vault, pg_temp
as $$
declare existing_id uuid; role_name text; new_id uuid;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  select lower(coalesce(role,'')) into role_name from public.profiles where id=auth.uid() and coalesce(active,true);
  if role_name not in ('superadmin','stationmanager') then raise exception 'Alleen superadmin of stationmanager kan API-sleutels wijzigen'; end if;
  if p_kind not in ('rotation','playout','shoutcast') then raise exception 'Ongeldige integratie'; end if;
  if coalesce(trim(p_api_key),'')='' then raise exception 'API-sleutel is leeg'; end if;

  select vault_secret_id into existing_id from public.hub_integration_secrets where kind=p_kind;
  if existing_id is null then
    new_id := vault.create_secret(p_api_key,'vlacora-'||p_kind||'-api-key','VLACORA HUB '||p_kind||' API key',null);
    insert into public.hub_integration_secrets(kind,vault_secret_id,api_key_header,api_key_prefix,updated_by,updated_at)
    values(p_kind,new_id,coalesce(nullif(p_api_key_header,''),'Authorization'),coalesce(p_api_key_prefix,''),auth.uid(),now());
  else
    perform vault.update_secret(existing_id,p_api_key,'vlacora-'||p_kind||'-api-key','VLACORA HUB '||p_kind||' API key',null);
    update public.hub_integration_secrets set
      api_key_header=coalesce(nullif(p_api_key_header,''),'Authorization'),
      api_key_prefix=coalesce(p_api_key_prefix,''),
      updated_by=auth.uid(),updated_at=now()
    where kind=p_kind;
  end if;
end;
$$;

create or replace function public.vlacora_delete_integration_secret(p_kind text)
returns void
language plpgsql security definer
set search_path = public, vault, pg_temp
as $$
declare existing_id uuid; role_name text;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  select lower(coalesce(role,'')) into role_name from public.profiles where id=auth.uid() and coalesce(active,true);
  if role_name not in ('superadmin','stationmanager') then raise exception 'Alleen superadmin of stationmanager kan API-sleutels verwijderen'; end if;
  select vault_secret_id into existing_id from public.hub_integration_secrets where kind=p_kind;
  delete from public.hub_integration_secrets where kind=p_kind;
  if existing_id is not null then delete from vault.secrets where id=existing_id; end if;
end;
$$;

revoke all on function public.vlacora_get_integration_secret(text) from public, anon;
revoke all on function public.vlacora_set_integration_secret(text,text,text,text) from public, anon;
revoke all on function public.vlacora_delete_integration_secret(text) from public, anon;
grant execute on function public.vlacora_get_integration_secret(text) to authenticated, service_role;
grant execute on function public.vlacora_set_integration_secret(text,text,text,text) to authenticated, service_role;
grant execute on function public.vlacora_delete_integration_secret(text) to authenticated, service_role;
