#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MODE="${MODE:-production}"
PULSE_SITE_URL="${PULSE_SITE_URL:-}"
SUPABASE_AUTH_URL="${SUPABASE_AUTH_URL:-}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-}"
GATEWAY_DOMAIN="${GATEWAY_DOMAIN:-}"
randhex(){ od -An -N "$1" -tx1 /dev/urandom | tr -d ' \n'; }
need(){ local name="$1" prompt="$2" value="${!name:-}"; while [[ -z "$value" ]]; do read -r -p "$prompt: " value; done; printf -v "$name" '%s' "$value"; }
command -v docker >/dev/null || { echo 'Docker ontbreekt.' >&2; exit 1; }
docker compose version >/dev/null || { echo 'Docker Compose v2 ontbreekt.' >&2; exit 1; }
echo '============================================================'
echo ' PULSE SERVER 0.31 - VOLLEDIGE DOCKER INSTALLATIE'
echo '============================================================'
need PULSE_SITE_URL 'Publieke PULSE website-URL'
need SUPABASE_AUTH_URL 'Supabase Auth URL'
need SUPABASE_PUBLISHABLE_KEY 'Supabase publishable key'
if [[ "$MODE" == 'production' ]]; then need GATEWAY_DOMAIN 'Gateway-domeinnaam zonder https://'; fi
mkdir -p secrets backups data/files data/gateway data/postgrest logs
chmod 700 secrets
[[ -s secrets/postgres_password.txt ]] || randhex 32 > secrets/postgres_password.txt
[[ -s secrets/gateway_setup_token.txt ]] || randhex 32 > secrets/gateway_setup_token.txt
[[ -s secrets/gateway_master_key.txt ]] || randhex 32 > secrets/gateway_master_key.txt
[[ -s secrets/postgrest_jwt_secret.txt ]] || randhex 32 > secrets/postgrest_jwt_secret.txt
chmod 600 secrets/*.txt
GATEWAY_URL="http://127.0.0.1:8787"
[[ "$MODE" == 'production' ]] && GATEWAY_URL="https://$GATEWAY_DOMAIN"
cat > .env <<EOF
PULSE_PUBLIC_URL=${PULSE_SITE_URL%/}
PULSE_ALLOWED_ORIGIN=${PULSE_SITE_URL%/}
PULSE_GATEWAY_DOMAIN=$GATEWAY_DOMAIN
PULSE_GATEWAY_PUBLIC_URL=$GATEWAY_URL
PULSE_GATEWAY_BIND=127.0.0.1
PULSE_GATEWAY_PORT=8787
SUPABASE_AUTH_URL=${SUPABASE_AUTH_URL%/}
SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
PULSE_POSTGRES_DB=pulse
PULSE_POSTGRES_USER=pulse_app
PULSE_POSTGRES_IMAGE=postgres:17-alpine
PULSE_CADDY_IMAGE=caddy:2.10-alpine
PULSE_POSTGREST_IMAGE=postgrest/postgrest:v12.2.12
PULSE_SOURCE_STORAGE_BUCKET=vlacora-hub-files
PULSE_BACKUP_RETENTION_DAYS=30
EOF
pgpass="$(cat secrets/postgres_password.txt)"
pgjwt="$(cat secrets/postgrest_jwt_secret.txt)"
cat > data/postgrest/postgrest.conf <<EOF
db-uri = "postgres://pulse_app:${pgpass}@postgres:5432/pulse"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${pgjwt}"
server-port = 3000
openapi-mode = "disabled"
EOF
chmod 600 data/postgrest/postgrest.conf

cat > server-config.json <<EOF
{"version":"0.32.0","installedAt":"$(date -Iseconds)","mode":"$MODE","siteUrl":"${PULSE_SITE_URL%/}","gatewayUrl":"$GATEWAY_URL","gatewayDomain":"$GATEWAY_DOMAIN","postgresDatabase":"pulse","postgresUser":"pulse_app","postgresPortPublished":false,"supabaseAuthUrl":"${SUPABASE_AUTH_URL%/}"}
EOF
docker compose config >/dev/null
if [[ "$MODE" == 'production' ]]; then docker compose --profile https up -d --build; else docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build; fi
for _ in $(seq 1 90); do id="$(docker compose ps -q postgres)"; [[ -n "$id" ]] && [[ "$(docker inspect --format='{{.State.Health.Status}}' "$id" 2>/dev/null || true)" == healthy ]] && break; sleep 2; done
id="$(docker compose ps -q postgres)"; [[ -n "$id" && "$(docker inspect --format='{{.State.Health.Status}}' "$id")" == healthy ]] || { echo 'PostgreSQL niet healthy.' >&2; exit 1; }
setup="$(cat secrets/gateway_setup_token.txt)"
cat > PULSE_SERVER_KOPPELING.txt <<EOF
PULSE SERVER KOPPELING - PRIVÉ BEWAREN
Versie: 0.32.0
Gateway URL: $GATEWAY_URL
Setup-code: $setup
PULSE site: ${PULSE_SITE_URL%/}
Database: pulse (automatisch beheerde PostgreSQL 17 in Docker)
Databasegebruiker: pulse_app (alleen intern)
Poort 5432 publiek: NEE
EOF
chmod 600 PULSE_SERVER_KOPPELING.txt
printf 'PULSE-server klaar. Koppel in PULSE met Gateway URL + setup-code.\n'
