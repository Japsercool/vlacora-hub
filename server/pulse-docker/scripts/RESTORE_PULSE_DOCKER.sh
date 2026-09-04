#!/usr/bin/env bash
set -Eeuo pipefail
[[ $# -ge 1 ]] || { echo "Gebruik: $0 /pad/naar/backup"; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"; BACKUP="$(cd "$1" && pwd)"
[[ -f "$BACKUP/database.dump" ]] || { echo 'database.dump ontbreekt' >&2; exit 1; }
read -r -p 'Typ HERSTEL om huidige doeldata te overschrijven: ' ans; [[ "$ans" == HERSTEL ]] || exit 1
docker compose stop gateway caddy >/dev/null 2>&1 || true
[[ -d "$BACKUP/recovery-secrets" ]] && cp "$BACKUP"/recovery-secrets/*.txt secrets/ || true
docker compose up -d postgres; cid="$(docker compose ps -q postgres)"; docker cp "$BACKUP/database.dump" "$cid:/tmp/pulse-restore.dump" >/dev/null
docker compose exec -T postgres psql -U pulse_app -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='pulse' and pid<>pg_backend_pid();" >/dev/null
docker compose exec -T postgres dropdb -U pulse_app --if-exists pulse
docker compose exec -T postgres createdb -U pulse_app pulse
docker compose exec -T postgres pg_restore -U pulse_app -d pulse --no-owner --no-privileges /tmp/pulse-restore.dump
docker compose exec -T postgres rm -f /tmp/pulse-restore.dump
rm -rf data/files/* data/gateway/*
[[ -f "$BACKUP/files.tar.gz" ]] && tar -xzf "$BACKUP/files.tar.gz" -C data/files
[[ -f "$BACKUP/gateway-state.tar.gz" ]] && tar -xzf "$BACKUP/gateway-state.tar.gz" -C data/gateway
domain="$(grep '^PULSE_GATEWAY_DOMAIN=' .env | cut -d= -f2- || true)"
if [[ -n "$domain" ]]; then docker compose --profile https up -d --build; else docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build; fi
echo 'Herstel voltooid. Voer VERIFY_PULSE_DOCKER.sh uit.'
