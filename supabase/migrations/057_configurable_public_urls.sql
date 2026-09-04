alter table public.hub_data_backend_configs
  add column if not exists public_site_url text not null default '',
  add column if not exists gateway_public_url text not null default '',
  add column if not exists allowed_origins jsonb not null default '[]'::jsonb,
  add column if not exists domain_status text not null default 'not_configured',
  add column if not exists domain_updated_at timestamptz;

update public.hub_data_backend_configs
set gateway_public_url = coalesce(nullif(gateway_public_url,''), gateway_url),
    allowed_origins = case
      when jsonb_typeof(allowed_origins) = 'array' then allowed_origins
      else '[]'::jsonb
    end
where scope='global';
