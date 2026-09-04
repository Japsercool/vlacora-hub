#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

randhex() { od -An -N "$1" -tx1 /dev/urandom | tr -d ' \n'; }
ask() { var="$1"; prompt="$2"; eval "value=\${$var:-}"; while [ -z "$value" ]; do printf "%s: " "$prompt"; read -r value; done; eval "$var=\$value"; }

command -v docker >/dev/null 2>&1 || { echo "Docker ontbreekt."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 ontbreekt."; exit 1; }

ask PULSE_PUBLIC_URL "PULSE website URL/origin"
PULSE_ALLOWED_ORIGIN="$PULSE_PUBLIC_URL"
ask SUPABASE_AUTH_URL "Supabase Auth URL"
ask SUPABASE_PUBLISHABLE_KEY "Supabase publishable key"

printf "Optionele HTTPS gateway-domeinnaam (Enter = :8787): "
read -r PULSE_GATEWAY_DOMAIN || true
PULSE_GATEWAY_EMAIL=""
if [ -n "${PULSE_GATEWAY_DOMAIN:-}" ]; then
  printf "E-mail voor HTTPS-certificaat: "
  read -r PULSE_GATEWAY_EMAIL
fi

mkdir -p secrets backups
chmod 700 secrets
[ -f secrets/postgres_password.txt ] || randhex 32 > secrets/postgres_password.txt
[ -f secrets/gateway_setup_token.txt ] || randhex 32 > secrets/gateway_setup_token.txt
[ -f secrets/gateway_master_key.txt ] || randhex 32 > secrets/gateway_master_key.txt
chmod 600 secrets/*.txt

cat > .env <<ENV
PULSE_PUBLIC_URL=$PULSE_PUBLIC_URL
PULSE_ALLOWED_ORIGIN=$PULSE_ALLOWED_ORIGIN
SUPABASE_AUTH_URL=$SUPABASE_AUTH_URL
SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
PULSE_POSTGRES_DB=pulse
PULSE_POSTGRES_USER=pulse_app
PULSE_GATEWAY_PORT=8787
PULSE_GATEWAY_DOMAIN=${PULSE_GATEWAY_DOMAIN:-}
PULSE_GATEWAY_PUBLIC_URL=$( [ -n "${PULSE_GATEWAY_DOMAIN:-}" ] && printf "https://%s" "$PULSE_GATEWAY_DOMAIN" || true )
PULSE_GATEWAY_EMAIL=${PULSE_GATEWAY_EMAIL:-}
PULSE_SOURCE_STORAGE_BUCKET=vlacora-hub-files
ENV

if [ -n "${PULSE_GATEWAY_DOMAIN:-}" ]; then docker compose --profile https up -d --build; else docker compose up -d --build; fi
setup_token="$(cat secrets/gateway_setup_token.txt)"
if [ -n "${PULSE_GATEWAY_DOMAIN:-}" ]; then gateway_url="https://$PULSE_GATEWAY_DOMAIN"; else gateway_url="http://<DEZE-SERVER>:8787"; fi
cat > PULSE_SERVER_KOPPELING.txt <<TXT
PULSE SERVER KOPPELING
Gateway URL: $gateway_url
Setup-code: $setup_token
Database: automatisch beheerde PostgreSQL in Docker
Databasepoort 5432: NIET gepubliceerd
TXT

chmod 600 PULSE_SERVER_KOPPELING.txt
echo "Klaar. Gebruik in PULSE alleen Gateway URL + Setup-code."
echo "De website-URL kun je later wijzigen zonder datamigratie."
cat PULSE_SERVER_KOPPELING.txt
