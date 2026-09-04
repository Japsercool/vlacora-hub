#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
site="${1:-}"; domain="${2:-}"; [[ -n "$site" ]] || read -r -p 'Nieuwe PULSE website-URL: ' site
python3 - "$site" "$domain" <<'PY2'
import sys, pathlib
p=pathlib.Path('.env'); lines=p.read_text().splitlines(); vals={'PULSE_PUBLIC_URL':sys.argv[1].rstrip('/'),'PULSE_ALLOWED_ORIGIN':sys.argv[1].rstrip('/')}
if len(sys.argv)>2 and sys.argv[2]: vals.update({'PULSE_GATEWAY_DOMAIN':sys.argv[2],'PULSE_GATEWAY_PUBLIC_URL':'https://'+sys.argv[2]})
out=[]; seen=set()
for l in lines:
    k=l.split('=',1)[0] if '=' in l else ''
    if k in vals: out.append(k+'='+vals[k]); seen.add(k)
    else: out.append(l)
for k,v in vals.items():
    if k not in seen: out.append(k+'='+v)
p.write_text('\n'.join(out)+'\n')
PY2
effective_domain="$(grep '^PULSE_GATEWAY_DOMAIN=' .env | cut -d= -f2- || true)"
if [[ -n "$effective_domain" ]]; then docker compose --profile https up -d --force-recreate gateway caddy; else docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --force-recreate gateway; fi
echo "Supabase Auth redirect toevoegen: ${site%/}/auth/callback"
